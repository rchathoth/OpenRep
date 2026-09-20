# OpenReps

A minimal chess trainer using Next.js App Router, React, Tailwind, react-chessboard and chess.js.

## Run

Install dependencies with `npm install`, then run `npm run dev` and open http://localhost:3000.

Arrange a position, choose your side, and start training. The untouched standard position retains castling rights. Custom arrangements start without castling or en-passant rights.

Each legal attempt is checked against the top engine move from the **pre-move** position. Incorrect moves snap back with a red X. Correct moves are accepted, then the engine's best move from the **new** position is fetched and played automatically. The session continues until game over or returning to setup. Choose the promotion piece before moving a pawn to the last rank.

After an incorrect legal attempt, a conceptual hint appears below the status. Checks take priority over captures (including en passant); other moves receive a general thinking prompt. The hint stays the same until a move is accepted or the session ends. Illegal moves and evaluation failures do not generate hints. No hint names a piece, square, or move.

`lib/hints.ts` separates stable concept IDs, families, and approved wording from classification. The classifier retains all matching concepts and selects a primary one. The catalog supports forcing moves, tactics, positional play, pawn play, and defense; only checks and captures have detectors today. Unclassified moves use a separate fallback, not a positional label.

Only the server route `/api/eval` contacts Lichess cloud evaluation. This is a database of evaluated positions, not an on-demand engine: some positions have no evaluation. An unavailable evaluation never accepts an unchecked user move. If evaluation fails after an accepted move, use **Retry engine reply** to continue from the same position.

## Verify

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build` (or `npm run build -- --webpack` if a restricted environment prevents Turbopack from opening its worker port)
- `npm test` (Node 22.18+ or 24+ for native TypeScript stripping)
- `npm run test:e2e` with the dev server running and Playwright available. The browser suite uses two live Lichess turns, then controlled responses for rejection, failure/retry, duplicate input, Black starts, game over and promotion. Live checks need network access and cloud coverage.

The browser test can use a bundled Playwright install via `NODE_PATH=/path/to/node_modules npm run test:e2e`, or a local `npm install --no-save playwright`. Set `CHROME_PATH` for your Chrome executable (defaults to macOS Google Chrome) and `TEST_URL` for a server other than http://localhost:3000. Screenshots are written to `/private/tmp/openreps-desktop.png` and `/private/tmp/openreps-mobile.png`.

Use `SKIP_LIVE_EVAL=1 npm run test:e2e` to run the controlled browser scenarios, including hint classification and lifecycle, without live Lichess checks. The hint layout screenshot is written to `/private/tmp/openreps-hint-mobile.png`.
