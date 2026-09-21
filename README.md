# OpenReps

A minimal chess trainer using Next.js App Router, React, Tailwind, react-chessboard, chess.js, and browser-local Stockfish 19.

## Run

Use Node 22.18+ or Node 24+, then:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Arrange a position, choose your side, and start training. The untouched standard position retains castling rights. Custom arrangements start without castling or en-passant rights. Choose the promotion piece before moving a pawn to the last rank.

A legal attempt is compared to Stockfish's exact best move from the **pre-move** position. Incorrect moves snap back with a red X. A correct move is committed only after engine validation, then Stockfish searches the **new** position and plays its reply. Starting as Black triggers the engine's opening move. The session ends at checkmate, a draw, or returning to setup.

The first validated engine result for an unchanged position is reused for hints and move checks, so repeated attempts cannot disagree with an earlier hint. This version uses exact `bestmove` acceptance (`MultiPV = 1`); centipawn tolerance is deferred.

After an incorrect legal attempt, a conceptual hint appears below the status. Checks take priority over captures, including en passant; other moves receive a general thinking prompt. That hint stays the same until a move is accepted or the session ends. Illegal moves and engine failures do not generate conceptual hints. The **Hint** button separately cycles through highlighting the piece, showing the move arrow, and hiding the visual hint.

`lib/hints.ts` separates stable concept IDs, families, and approved wording from classification. The classifier retains all matching concepts and selects a primary one. The catalog supports forcing moves, tactics, positional play, pawn play, and defense; only checks and captures have detectors today. Unclassified moves use a separate fallback.

## Browser engine

Training uses the lite single-threaded WASM build from the pinned `stockfish@19.0.0` package. The roughly 1.7 MB WASM includes its neural network. The engine's JS/WASM assets download from this app during initialization; subsequent searches, hints, move checks, and replies make **no network requests**. The old `/api/eval` route is removed. `/api/opening` remains an optional setup feature, independent of training.

- `lib/engine/engine-client.ts` owns one reusable worker session, initializes lazily, assigns request IDs, serializes searches, and handles abort signals, timeouts, crashes, and disposal. Its API is `initialize()`, `findBestMove({ fen, movetime?, signal? })`, `stop()`, and `dispose()`.
- `lib/engine/stockfish.worker.ts` is a small protocol adapter worker with one long-lived child worker running the unmodified upstream engine. `lib/engine/uci.ts` handles the UCI handshake, commands, and `bestmove` parsing entirely off the main thread. Neither worker knows about React or training rules.
- `lib/training.ts` generates FENs, rejects game-over positions (including repetition history), validates engine output using a chess.js copy, and normalizes castling. It does not mutate the training game.
- `TrainerBoard` owns the engine lifetime and pending-action lock. Changing the starting position/side or leaving training aborts pending work and terminates both workers. No unchecked move is accepted after initialization or search failure.

Defaults in `lib/engine/settings.ts` are 1000 ms per position on desktop, 500 ms on mobile or devices reporting four or fewer logical CPUs, one thread, and 16 MB hash. The supported settings type also includes optional depth, but the UI uses time-based search. There is no background analysis or pondering; hiding the tab cancels searches to conserve CPU/battery. Search deadlines are checked again when results arrive after suspension. No battery API permission is required.

The board shows **Starting engine…**, **Engine is thinking…**, and **Engine unavailable; reload to retry.** Initialization has a 30-second limit; searches have a five-second grace period beyond their time budget. A cancellation sends `stop` and drains that search's final `bestmove` before starting another position. If the engine does not stop within two seconds, it is terminated. Invalid moves and ordinary search failures can be retried; unavailable/crashed engines require a reload. If the player's move was already accepted, **Retry engine reply** continues from that position without replaying it.

## Production and caching

```sh
npm run build
npm run start
```

The `predev`, `prebuild`, and `prestart` scripts run `scripts/prepare-engine.mjs`, copying only the pinned lite single-threaded engine, GPL license, and source notice into `public/engine/stockfish-19.0.0/`. Generated assets are ignored by Git. Install dependencies before building and include `public/` in the deployment artifact. The preparation script requires Node's native TypeScript support, as do unit tests.

Next.js bundles the TypeScript adapter via `new Worker(new URL(..., import.meta.url))`; it creates the static upstream engine worker only in the browser. There is no server-side engine evaluation. Next.js serves `.wasm` as `application/wasm`. `next.config.ts` gives the versioned engine assets `Cache-Control: public, max-age=31536000, immutable`; preserve this header at the CDN. Keep the versioned URLs immutable, and update the asset path and notices whenever upgrading the package. Adapter chunks use Next.js's own asset hashing/caching.

The single-threaded build needs no `SharedArrayBuffer`, COOP, or COEP configuration. A deployment with a Content Security Policy must allow same-origin workers, same-origin WASM fetching, and WebAssembly compilation. This project assumes deployment at `/`; if adding a Next.js `basePath`, also prefix the static engine and license URLs in `settings.ts`.

Stockfish's license and exact corresponding source links are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses/Stockfish-GPL-3.0.txt](licenses/Stockfish-GPL-3.0.txt). The training UI links to the served license and source notice. Preserve these when deploying or redistributing the engine.

## Verify

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

With the dev server running, execute `npm run test:e2e`. Repeat against `npm run start` to verify production worker chunk URLs and WASM loading. `npm run demo:engine` runs a standalone real Worker demo that handshakes, searches, stops, and reuses Stockfish while checking main-thread responsiveness; this check is also included in the full browser suite. Set `TEST_URL` to use another server address and `CHROME_PATH` for a Chrome executable other than `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

The browser suite initializes the real WASM engine and plays two turns with network access disabled after initialization, checks asset MIME/cache headers, and tests starting as Black and mobile layout. It then uses a test-only Worker replacement injected by Playwright for deterministic incorrect moves, hints, failures/retries, rapid clicks, cancellation, tab suspension, initialization failure, checkmate, draw, and underpromotion. Production code contains no mock-engine switch. Screenshots are saved under `/private/tmp/openreps-*.png`.

Unit tests cover UCI commands and parsing, settings, request serialization, stale IDs, aborts, stop/drain, timeouts, worker failures, legality, promotion, castling, en passant, and game-over rules. The existing conceptual and visual hint unit tests remain.
