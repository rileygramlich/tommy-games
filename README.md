# Tommy Games

A small, growing shelf of card and board games that run in a browser, on a phone
or on a desk. Ten are on it so far:

| Game | Players | What it is |
| --- | --- | --- |
| **Wizard** | 3–6 | Trick-taking where you must predict your tricks exactly |
| **Quiddler** | 2–8 | Eight rounds of letter cards; spell your hand and go out |
| **Euchre** | 4 | Two teams, twenty-four cards, and a jack that changes sides |
| **Cribbage** | 2 | Peg to thirty-one, then count fifteens all the way to 121 |
| **Sequence** | 2–3 | Cover the card, build five in a row, mind the jacks |
| **Backgammon** | 2 | The oldest race there is, played to a match score |
| **Coup** | 2–6 | Two influences, a pile of coins, and permission to lie |
| **Mastermind** | 2 | Hide four pegs, or break the other player's in ten |
| **Reversi** | 2 | Bracket a line and the whole line flips |
| **Yahtzee** | 1–6 | Five dice, thirteen boxes, no way to fill them all well |

Three ways to play each one:

| Mode | What it needs |
| --- | --- |
| Solo against bots | Nothing — it all runs in the tab |
| Pass-and-play | Nothing — hands hide behind a curtain between turns |
| Online with friends | The little WebSocket server in `server/` running somewhere |

Every screen is built for a phone first: no horizontal scrolling at 360px, cards
and boards sized in viewport units, 40px tap targets, and overlays that behave
like sheets.

## Running it

```bash
npm install
npm run dev        # the site, on http://localhost:5173
npm run server     # the online game server, on ws://localhost:8787
npm test           # rules, solver, and an end-to-end online game
```

For online play, put the server address into **Settings → Online play**
(`ws://localhost:8787` when running locally).

## How it fits together

```
src/lib/games/<game>/engine.js       pure rules: createGame, legalMoves, applyMove, view
src/lib/games/<game>/bot.js          picks a move given one seat's view
src/lib/games/<game>/*Table.svelte   the table screen
src/lib/games/registry.js            the shelf: one entry per game, everything reads this
src/lib/games/cards.js               a standard deck, shared by the card games
src/lib/stores/localTable.svelte.js  runs an engine in the browser, drives bots
src/lib/net/online.svelte.js         the same surface, backed by a WebSocket
server/                              lobby, accounts, and authoritative tables
```

The engines are plain ES modules with no DOM and no framework. The browser runs
them for solo and pass-and-play games; the server runs the identical file for
online games, and never sends a seat anything it should not see — `view(state,
seat)` is the only way state leaves the engine. Bots read that same view, so they
know exactly as much as a person in that chair.

Engines agree on a handful of phase names so the tables know what to do with
them without knowing the game: `trickEnd` and `turnEnd` clear themselves after a
beat, while `roundEnd`, `handEnd`, `gameEnd` and `show` wait for a person to read
them. Anything else is a decision the seat on turn has to make.

**Adding a game** means writing those two modules plus a table screen, then adding
one entry to `src/lib/games/registry.js` — the shelf, the setup screen with its
house rules, the rules page and the router all read from there. The server keeps
its own map of engines in `server/rooms.js` so online play picks it up too.

There is an unlinked card gallery at `#/cards` that renders every card face at
every size, which is easier than dealing hands until the one you want shows up.

### Notes on fidelity

Three places where this shelf is not the printed game, all of them flagged in the
game's own rules page too:

- **Sequence** — the board is not a copy of the retail layout. It is built the
  same way in spirit (every non-jack card twice, free corners, suits running in a
  spiral) but the arrangement is generated.
- **Backgammon** — no doubling cube.
- **Coup** — the base game is as printed. Responses go round in turn order rather
  than as a free-for-all race, since nobody can shout across a browser. Choosing
  which five characters are in play is the idea behind the Rebellion expansion,
  but the Inquisitor and Embezzler here are alternates from other Coup sets, not
  reproductions of Rebellion cards. In faction play, conversion cannot be used to
  empty a faction — otherwise two coins ends the game.

### Quiddler's word list

`public/data/quiddler-words.txt` is 52k words, built from the system dictionary by
`npm run dict`: lowercase entries only (so no proper nouns), 3–10 letters, no
vowel-free abbreviations, plus the standard tournament two-letter set. The client
loads it once and does prefix lookups by binary search, which is what makes the
solver behind "Arrange for me" — and the bots — fast enough to run on every turn.

## Deploying

**The site** goes to GitHub Pages on every push to `main` via
`.github/workflows/deploy.yml`. Turn it on under *Settings → Pages → Source:
GitHub Actions*. Pages from a **private** repository needs GitHub Pro or Team; on
a free plan the repo has to be public for the site to publish.

**The server** is a normal Node process — GitHub Pages cannot host it, since it
only serves files. Anywhere that runs a container or a Node app will do:

```bash
docker build -t tommy-games-server .
docker run -p 8787:8787 -v tommy-data:/data tommy-games-server
```

Environment variables: `PORT`, `DATA_DIR` (where accounts are kept),
`ALLOWED_ORIGINS` (comma-separated, restricts who may connect), and
`BOT_DELAY` / `TRICK_PAUSE` for pacing. Serve it over `wss://` if the site is on
`https://`, or browsers will block the connection.

Accounts are a username, a scrypt-hashed password, and a win/loss record. They
exist so your name and stats stick between sessions — nothing more.

## Credits

Quiddler is published by Set Enterprises; Wizard by Ken Fisher and US Games
Systems. This is a fan-made table for playing them, not affiliated with either.
