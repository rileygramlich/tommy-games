// WebSocket client for online tables. Mirrors the LocalTable surface so the
// game screens do not care whether the rules are running here or on a server.
const TOKEN_KEY = 'tommy-games:token';

export class Online {
  status = $state('idle');   // idle | connecting | online | closed | error
  error = $state('');
  user = $state(null);
  rooms = $state([]);
  room = $state(null);
  view = $state(null);
  url = $state('');

  #ws = null;
  #attempts = 0;
  #retry = null;

  connect(url) {
    this.url = url;
    this.#open();
  }

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
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) this.send({ type: 'auth', token });
    };
    ws.onmessage = (event) => this.#handle(JSON.parse(event.data));
    ws.onerror = () => { this.error = 'Could not reach the server.'; };
    ws.onclose = () => {
      if (this.status === 'online') this.status = 'closed';
      this.#ws = null;
      if (this.#attempts < 5) {
        this.#attempts += 1;
        this.#retry = setTimeout(() => this.#open(), 800 * this.#attempts);
      }
    };
  }

  #handle(msg) {
    switch (msg.type) {
      case 'session':
        this.user = msg.user;
        if (msg.token) localStorage.setItem(TOKEN_KEY, msg.token);
        else localStorage.removeItem(TOKEN_KEY);
        this.error = '';
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
        if (msg.message === 'Session expired.') localStorage.removeItem(TOKEN_KEY);
        break;
    }
  }

  send(message) {
    if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(message));
    else this.error = 'Not connected.';
  }

  register(username, password) { this.send({ type: 'register', username, password }); }
  login(username, password) { this.send({ type: 'login', username, password }); }
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
    clearTimeout(this.#retry);
    this.#attempts = 99;
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
