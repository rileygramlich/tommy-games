// Drives a game that runs entirely in this browser: solo against bots,
// pass-and-play around one device, or any mix of the two.
import { botDelay } from './settings.svelte.js';
import { randomSeed } from '../games/rng.js';

// Phases that are pauses rather than decisions, across every game on the shelf.
const AUTO_PHASES = new Set(['trickEnd', 'turnEnd']);
const WAIT_PHASES = new Set(['roundEnd', 'handEnd', 'gameEnd', 'show']);

export class LocalTable {
  view = $state(null);
  /** Pass-and-play curtain: true while the device is between two human players. */
  curtain = $state(null);
  error = $state('');
  thinking = $state(false);

  #game; #state; #dict; #timer = null; #focus = 0; #humans;

  constructor({ game, players, options = {}, dict = null, seed = randomSeed() }) {
    this.#game = game;
    this.#dict = dict;
    this.#humans = players.map((p, i) => (p.isBot ? -1 : i)).filter((i) => i >= 0);
    this.#state = game.engine.createGame({ players, options, seed });
    this.#focus = this.#humans[0] ?? 0;
    this.#sync();
    this.#schedule();
  }

  get engine() { return this.#game.engine; }
  get isSoloHuman() { return this.#humans.length <= 1; }
  get players() { return this.#state.players; }
  get focusSeat() { return this.#focus; }

  #activeSeat() {
    const seats = this.engine.activeSeats(this.#state);
    return seats.length ? seats[0] : null;
  }

  #sync() {
    const active = this.#activeSeat();
    // Solo play keeps the camera on the human. Pass-and-play follows the turn.
    if (!this.isSoloHuman && active != null && this.#humans.includes(active) && active !== this.#focus) {
      this.#focus = active;
      this.curtain = { seat: active, name: this.#state.players[active].name };
    }
    this.view = this.engine.view(this.#state, this.#focus);
    this.view.activeSeat = active;
    this.view.isYourTurn = active === this.#focus;
    this.view.humanSeats = this.#humans.slice();
  }

  reveal() { this.curtain = null; }

  send(move) {
    if (move?.type === 'continue') return this.continue_();
    const active = this.#activeSeat();
    if (active == null) return;
    if (!this.#humans.includes(active)) return;
    const result = this.engine.applyMove(this.#state, active, move);
    if (!result.ok) { this.error = result.error; return result; }
    this.error = '';
    this.#sync();
    this.#schedule();
    return result;
  }

  /** Advance a paused phase (end of trick, end of round). */
  continue_() {
    const active = this.#activeSeat();
    if (active == null) return;
    this.engine.applyMove(this.#state, active, { type: 'continue' });
    this.#sync();
    this.#schedule();
  }

  #schedule() {
    clearTimeout(this.#timer);
    this.thinking = false;
    if (this.engine.isOver(this.#state)) return;
    const active = this.#activeSeat();
    if (active == null) return;
    const phase = this.#state.phase;

    // Beats that clear themselves after a moment: a finished trick, a played-out
    // backgammon turn. Long enough to see what happened.
    if (AUTO_PHASES.has(phase)) {
      this.#timer = setTimeout(() => { this.continue_(); }, Math.max(900, botDelay() * 1.6));
      return;
    }
    // Summaries wait for someone to read them, unless the table is all bots.
    if (WAIT_PHASES.has(phase)) {
      if (!this.#humans.length) this.#timer = setTimeout(() => this.continue_(), 400);
      return;
    }
    if (this.#humans.includes(active)) return;

    this.thinking = true;
    this.#timer = setTimeout(() => {
      const seatView = this.engine.view(this.#state, active);
      const move = this.#game.bot.chooseMove(seatView, Math.random, this.#dict);
      const result = this.engine.applyMove(this.#state, active, move);
      if (!result.ok) {
        // A bot should never do this; fall back to any legal move so play continues.
        const fallback = this.engine.legalMoves(this.#state, active)[0];
        if (fallback) this.engine.applyMove(this.#state, active, fallback);
        console.warn('bot move rejected:', result.error, move);
      }
      this.#sync();
      this.#schedule();
    }, botDelay());
  }

  destroy() { clearTimeout(this.#timer); }
}
