# Tommy Games

A small, growing shelf of card games that run in a browser. Two are on it so far:

- **Wizard** — trick-taking where you must predict your tricks exactly. 3–6 players.
- **Quiddler** — eight rounds of letter cards; spell your whole hand and go out. 2–8 players.

Three ways to play each one:

| Mode | What it needs |
| --- | --- |
| Solo against bots | Nothing — it all runs in the tab |
| Pass-and-play | Nothing — hands hide behind a curtain between turns |
| Online with friends | The little WebSocket server in `server/` running somewhere |

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
src/lib/games/<game>/engine.js   pure rules: createGame, legalMoves, applyMove, view
src/lib/games/<game>/bot.js      picks a move given one seat's view
src/lib/games/<game>/*Table.svelte   the table screen
src/lib/stores/localTable.svelte.js  runs an engine in the browser, drives bots
src/lib/net/online.svelte.js         the same surface, backed by a WebSocket
server/                              lobby, accounts, and authoritative tables
```

The engines are plain ES modules with no DOM and no framework. The browser runs
them for solo and pass-and-play games; the server runs the identical file for
online games, and never sends a seat anything it should not see — `view(state,
seat)` is the only way state leaves the engine. Bots read that same view, so they
know exactly as much as a person in that chair.

**Adding a game** means writing those two modules plus a table screen, then adding
an entry to `src/lib/games/registry.js`. Nothing else needs to know about it.

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
