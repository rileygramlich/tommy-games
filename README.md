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
| **Checkers** | 2 | Standard draughts, jumps compulsory, kings both ways |
| **Connect Four** | 2 | Drop a disc, take a line of four, mind the column you open |
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
server/suggestions.js                validates and stores shelf suggestions
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
- **Checkers** — American/English draughts. Captures are compulsory, kings move one
  square rather than flying, and crowning ends the turn even mid-chain. A draw is
  called after forty moves with no capture and no crowning.
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
loads it once and does prefix lookups by binary search, which is what keeps the
bots fast enough to think on every turn.

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

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8787` | Port to listen on. Most hosts set this for you. |
| `MONGODB_URI` | *(unset)* | Keep accounts in MongoDB instead of a file, e.g. `mongodb+srv://…/tommy-games`. For hosts whose disk is wiped on restart. |
| `GOOGLE_CLIENT_ID` | *(unset)* | Turns on Sign in with Google. The server sends it to the site and checks every Google token against it. |
| `DATA_DIR` | `server/data` | Where accounts are kept when `MONGODB_URI` is unset. Point it at a volume that survives restarts. |
| `ALLOWED_ORIGINS` | *(any)* | Comma-separated list of sites allowed to connect. |
| `BOT_DELAY` / `TRICK_PAUSE` | `900` / `1600` | Pacing, in milliseconds. |
| `AUTH_ATTEMPTS` / `AUTH_WINDOW` | `20` / `60000` | Sign-in tries allowed per address per window. |
| `MAX_ROOMS` | `200` | How many tables may exist at once. |
| `MAX_PAYLOAD` | `65536` | Largest message accepted, in bytes. |
| `ROOM_GRACE` | `600000` | How long a table with nobody connected waits before closing, in milliseconds. |

The site is served over `https://`, so the server has to be reachable over
`wss://` — a browser refuses a plain `ws://` socket from a secure page. Any host
that terminates TLS for you gives you this for free.

### Putting it online

Free hosts that keep WebSockets open are the thing to look for; several free
tiers either forbid them or cut them off after a few minutes.

1. Push this repository to GitHub.
2. On [Render](https://render.com), choose **New → Blueprint** and pick this
   repository. `render.yaml` describes a free Docker web service with
   `ALLOWED_ORIGINS` set to the published site. (Any other host that runs a
   container and keeps WebSockets open works too.)
3. Render asks for `MONGODB_URI`: a MongoDB connection string with the database
   name after the host (`…mongodb.net/tommy-games?…`). A free Atlas cluster is
   plenty. Without it, accounts would vanish every time the free plan sleeps;
   on a host with a persistent volume, set `DATA_DIR` to it instead.
4. Check `https://<your-server>/health` — it answers with the room count and the
   list of games.
5. In this repository, add an Actions **variable** named `GAME_SERVER_URL` under
   *Settings → Secrets and variables → Actions → Variables*, set to
   `wss://<your-server>`. The next deploy bakes it into the site, and online
   play connects without anyone having to paste an address.

Anyone who has not set that variable can still enter a server address by hand
under *Settings → Online play*, which is also how you point the site at a server
running on your own machine (`npm run server`, then `ws://localhost:8787`).

A host that sleeps when idle is usually fine: an open WebSocket counts as
traffic, so a table in progress keeps the server awake. The cost is up to a
minute of cold start for whoever connects first; the site nudges the server
awake as soon as the shelf opens, and online play keeps retrying until it
answers. `.github/workflows/keep-awake.yml` also pings it every ten minutes on
evenings, Calgary time, once `GAME_SERVER_URL` is set. It does not keep it up
around the clock on purpose: Render's free plan allows 750 instance hours a
month across all your services.

Nobody needs an account to play: pick a name and you are a guest, kept in the
server's memory only. Accounts are for anyone who wants their name and stats to
stick between sessions: either Sign in with Google, or a username and a
scrypt-hashed password. Either way the account holds a display name and a
win/loss record, nothing more; from Google it keeps only the account ID and
first name, not the email.

### Turning on Sign in with Google

1. In the [Google Cloud console](https://console.cloud.google.com), create a
   project (or reuse one), then **APIs & Services → OAuth consent screen**:
   External, app name *Tommy Games*, your email as support and developer
   contact. Basic sign-in needs no extra scopes and no verification.
2. **Credentials → Create credentials → OAuth client ID**, type *Web
   application*. Under **Authorized JavaScript origins** add
   `https://rileygramlich.github.io` and, for local play, `http://localhost:5173`.
   No redirect URIs are needed: the button hands the browser a token directly.
3. Copy the client ID (`…apps.googleusercontent.com`) into the server's
   `GOOGLE_CLIENT_ID` on Render. The button appears on the next page load; there
   is nothing to rebuild on the site.

Phones drop their connection whenever the browser goes to the background, so a
dropped connection keeps your seat: come back, and you sit down where you were.
A table closes after ten minutes with nobody connected.

## Credits

The pictures on the cards are public-domain paintings, found on Wikimedia
Commons and cropped to card shape (`public/art`, listed in `src/lib/art.js`).
None of them is drawn for this site, and none is the art of the published
games. Each game's rules page credits its own.

| Card | Painting |
| --- | --- |
| Duke | Giovanni Bellini, *Doge Leonardo Loredan*, c. 1501 — National Gallery, London |
| Assassin | Titian, *The Bravo*, c. 1515–20 — Kunsthistorisches Museum, Vienna |
| Captain | Rembrandt, *The Night Watch* (Captain Frans Banninck Cocq), 1642 — Rijksmuseum |
| Ambassador | Hans Holbein the Younger, *The Ambassadors* (Jean de Dinteville), 1533 — National Gallery, London |
| Contessa | Jean-Auguste-Dominique Ingres, *Comtesse d'Haussonville*, 1845 — The Frick Collection |
| Inquisitor | El Greco, *Cardinal Fernando Niño de Guevara*, c. 1600 — The Metropolitan Museum of Art |
| Embezzler | after Marinus van Reymerswaele, *The Tax Collectors*, 1600s — National Museum in Warsaw |
| Wizard | John William Waterhouse, *The Magic Circle*, 1886 — Tate Britain |
| Jester | Jan Matejko, *Stańczyk*, 1862 — National Museum in Warsaw |

The checkers crown is Tabler Icons' `crown` (MIT).


Quiddler is published by Set Enterprises; Wizard by Ken Fisher and US Games
Systems. This is a fan-made table for playing them, not affiliated with either.
