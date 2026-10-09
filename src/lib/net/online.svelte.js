// WebSocket client for online tables. Mirrors the LocalTable surface so the
// game screens do not care whether the rules are running here or on a server.
const TOKEN_KEY = 'tommy-games:token';
const GUEST_KEY = 'tommy-games:guest-name';
// A free host sleeps when nobody is playing and takes up to a minute to wake,
// so keep trying for a few minutes, never more than five seconds apart.
const MAX_ATTEMPTS = 60;
const MAX_DELAY = 5000;

function stored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key, value) {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* private mode */ }
}

export class Online {
  status = $state('idle');   // idle | connecting | online | closed | error
  error = $state('');
  user = $state(null);
  rooms = $state([]);
  room = $state(null);
  view = $state(null);
  url = $state('');
  /** True while retrying a server that is probably still waking up. */
  waking = $state(false);

  #ws = null;
  #attempts = 0;
  #retry = null;
  #closed = false;

  connect(url) {
    this.url = url;
    this.#closed = false;
    this.#open();
    // A phone drops its socket in the background; come straight back when it
    // is looked at again or gets its network back, instead of waiting out a retry.
    this.#wake ??= () => {
      if (this.#closed || document.visibilityState === 'hidden') return;
      if (!this.#ws || this.#ws.readyState > WebSocket.OPEN) { this.#attempts = 0; this.#open(); }
    };
    document.addEventListener('visibilitychange', this.#wake);
    window.addEventListener('online', this.#wake);
  }

  #wake = null;

  #open() {
    if (!this.url) { this.error = 'No server address set.'; this.status = 'error'; return; }
    clearTimeout(this.#retry);
    this.status = 'connecting';
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.status = 'error';
      this.error = 'That server address is not valid.';
      return;
    }
    this.#ws = ws;

    ws.onopen = () => {
      this.status = 'online';
      this.error = '';
      this.#attempts = 0;
      this.waking = false;
      const token = stored(TOKEN_KEY);
      const guestName = stored(GUEST_KEY);
      if (token) this.send({ type: 'auth', token });
      else if (guestName && this.user?.guest) this.send({ type: 'guest', name: guestName });
    };
    ws.onmessage = (event) => this.#handle(JSON.parse(event.data));
    ws.onerror = () => { this.error = 'Could not reach the server.'; };
    ws.onclose = () => {
      if (this.status === 'online') this.status = 'closed';
      if (this.#ws === ws) this.#ws = null;
      if (this.#closed || this.#attempts >= MAX_ATTEMPTS) return;
      this.#attempts += 1;
      if (this.#attempts >= 3) this.waking = true;
      this.#retry = setTimeout(() => this.#open(), Math.min(MAX_DELAY, 800 * this.#attempts));
    };
  }

  #handle(msg) {
    switch (msg.type) {
      case 'session':
        this.user = msg.user;
        store(TOKEN_KEY, msg.token);
        if (!msg.user) store(GUEST_KEY, null);
        this.error = '';
        // Back after a dropped connection: take the same seat again.
        if (msg.user && this.room) this.send({ type: 'joinRoom', roomId: this.room.id });
        break;
      case 'lobby':
        this.rooms = msg.rooms;
        if (!msg.rooms.some((r) => r.id === this.room?.id)) { /* keep current room view */ }
        break;
      case 'room':
        this.room = msg.room;
        if (!msg.room.started) this.view = null;
        break;
      case 'view':
        this.view = msg.view;
        break;
      case 'error':
        this.error = msg.message;
        // A stale token should not leave us stuck on a sign-in loop.
        if (msg.message === 'Session expired.') {
          store(TOKEN_KEY, null);
          // A guest outlived a server restart: same name, fresh session.
          const guestName = stored(GUEST_KEY);
          if (guestName) { this.error = ''; this.send({ type: 'guest', name: guestName }); }
        }
        break;
    }
  }

  send(message) {
    if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(message));
    else this.error = 'Not connected.';
  }

  register(username, password) { store(GUEST_KEY, null); this.send({ type: 'register', username, password }); }
  login(username, password) { store(GUEST_KEY, null); this.send({ type: 'login', username, password }); }
  guest(name) { store(GUEST_KEY, name.trim()); this.send({ type: 'guest', name }); }
  logout() { this.send({ type: 'logout' }); this.room = null; this.view = null; }
  refreshLobby() { this.send({ type: 'lobby' }); }
  createRoom(game, name, options) { this.send({ type: 'createRoom', game, name, options }); }
  joinRoom(roomId) { this.send({ type: 'joinRoom', roomId }); }
  leaveRoom() { this.send({ type: 'leaveRoom' }); this.room = null; this.view = null; }
  addBot() { this.send({ type: 'addBot' }); }
  removeSeat(userId) { this.send({ type: 'removeSeat', userId }); }
  setOptions(options) { this.send({ type: 'setOptions', options }); }
  start() { this.send({ type: 'start' }); }
  move(move) { this.send({ type: 'move', move }); }
  chat(text) { this.send({ type: 'chat', text }); }

  close() {
    this.#closed = true;
    clearTimeout(this.#retry);
    if (this.#wake) {
      document.removeEventListener('visibilitychange', this.#wake);
      window.removeEventListener('online', this.#wake);
    }
    this.#ws?.close();
    this.status = 'idle';
  }
}

/** Adapter that lets the game screens drive an online table unchanged. */
export class RemoteTable {
  constructor(online) { this.online = online; }
  get view() { return this.online.view; }
  get error() { return this.online.error; }
  get curtain() { return null; }   // hands are private per connection online
  get thinking() { return false; }
  reveal() {}
  send(move) { this.online.move(move); }
}
