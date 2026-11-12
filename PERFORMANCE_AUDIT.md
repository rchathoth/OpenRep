OpenRep performance audit — October 21, 2026

The largest opportunity is to move engine analysis off the interaction path. The app currently waits until the player attempts a move or requests a hint to discover the expected move. A correct uncached attempt then triggers a second, sequential search for the opponent. Optimizing React alone will leave those waits in place.

This audit examined all application components, styling, chess helpers, engine/client/worker/UCI code, asset preparation, Next configuration, dependencies, product documentation, and the existing test scenarios. No application source was changed. The recommendations below are ranked by likely user-visible impact for the current app; estimates describe opportunities, not measured improvements from implementations.

Local production measurements:

| Measurement | Desktop Chrome | Emulated mobile page, 4× CPU throttle |
| --- | ---: | ---: |
| First correct attempt through opponent reply and ready UI | 2,080 ms | 1,152 ms |
| Player engine search, measured at adapter messages | 1,001 ms | 503 ms |
| Opponent engine search, measured at adapter messages | 1,000 ms | 500 ms |
| Start-training action through ready UI | 219 ms | 393 ms |
| Restart from setup through ready UI | 144 ms | 179 ms |
| First contentful paint | 120 ms | 564 ms |
| Observed tasks longer than 50 ms | None | 97 ms during loading; 65 and 61 ms around starting training |

The mobile page used 150 ms network latency and 200,000 bytes/sec download throttling. That emulation does not establish equivalent throttling of nested engine workers; engine initialization figures are localhost measurements, not cold cellular-download benchmarks. CPU throttling is also not a measurement of real phone engine throughput. These are individual diagnostic runs, not medians or p95 results. Action timings include browser automation overhead and do not necessarily wait for the final piece animation to finish. Desktop and mobile settings intentionally use different search budgets.

The modern browser requested about 584 KB of uncompressed JavaScript, about 174 KB encoded on the wire, excluding the legacy nomodule polyfill. CSS was about 31 KB raw / 7 KB gzip. The font was 133 KB raw / 72 KB gzip. Initial HTML was about 85 KB raw / 9.5 KB gzip. The WASM engine was 1,787,571 bytes raw; local compression experiments produced 1,180,400 bytes with gzip and 1,094,038 bytes with Brotli. The local Next server already returned gzip for actual WASM GET requests. The font currently has `Cache-Control: public, max-age=0`; the versioned engine correctly has a one-year immutable cache policy.

1. **Compute the expected player move while the player thinks. Very high impact; medium effort.**

   Evidence: [TrainerBoard.tsx:81](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:81), [TrainerBoard.tsx:218](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:218), and [settings.ts:6](/Users/rohit/Projects/openrep/openrep/lib/engine/settings.ts:6). `expectedForPosition` runs only for a hint or an attempt. Start a bounded MultiPV-1 analysis when the engine is ready and whenever a player-turn position is published. Freeze its first validated result for that position, as the app already does after a hint. Let hints and attempts await the same in-flight promise instead of launching another search. Do not disable board input merely because this preparation is running.

   Once preparation finishes, move validation can become a cache lookup instead of a 500–1,000 ms wait. A player who moves immediately still waits for the unfinished analysis. Tradeoff: one search is performed even when the player never moves, increasing CPU use and battery consumption. Cancel obsolete work on position changes, hidden tabs, and session exit. Keep the current stale-result and legality guards. This preserves the selected search budget and hint/validation consistency, although timing-based engine choices are not guaranteed identical between runs.

2. **Prepare the opponent response on the expected player-move branch. Very high impact; medium-to-large effort.**

   Evidence: [TrainerBoard.tsx:233](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:233) and [opponent.ts:42](/Users/rohit/Projects/openrep/openrep/lib/opponent.ts:42). After preparing the expected player move, apply it to a private game copy and run the existing candidate search for that successor position. Store candidate analysis, then perform the existing random selection only after the player actually commits the expected move. Do not touch the live game or show hidden analysis.

   When the player thinks longer than both searches, both validation and the opponent reply can be ready before the attempt. This can hide almost the entire measured two-second desktop search pipeline without reducing the search budget or candidate count. Tradeoff: extra speculative work and cancellation/cache complexity. Use the same worker sequentially rather than adding a CPU-hungry second engine. Preserve actual history for terminal/draw checks and revalidate that the live successor position matches the prepared result. Preparation must yield to foreground requests and stop when the tab is hidden.

3. **Replace the blanket search budget with a fast, bounded policy. Very high impact; small initial change, substantial quality validation.**

   Evidence: [settings.ts:6](/Users/rohit/Projects/openrep/openrep/lib/engine/settings.ts:6), [engine-client.ts:115](/Users/rohit/Projects/openrep/openrep/lib/engine/engine-client.ts:115), and [uci.ts:11](/Users/rohit/Projects/openrep/openrep/lib/engine/uci.ts:11). Consider a 150–300 ms quick mode, a separate opponent budget, and a stronger mode for complex positions. Comparing two searches at 200 ms rather than 1,000 ms removes roughly 1.6 seconds of requested thinking time when both remain on the interaction path. That is arithmetic from the settings, not a quality-validated recommendation to use 200 ms everywhere.

   A local start-position experiment returned `e2e4` at 150, 300, 500, and 1,000 ms with MultiPV 1, but that single position does not establish tactical reliability. MultiPV 5 selected a different first move at shorter budgets, illustrating the tradeoff. Shortening search can change which move is accepted, miss tactics, or change which opponent moves pass the 100 cp filter. An adaptive policy can use completed depths, best-move stability, and score separation as heuristics, with a hard time cap; these are not proofs of correctness. Once an answer is exposed to the user, keep it frozen. Benchmark a representative position set before changing defaults.

4. **Reuse analysis across sessions, and optionally ship precomputed opening positions. High impact for repeat practice; medium effort.**

   Evidence: [TrainerBoard.tsx:42](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:42). The cache contains one expected move and disappears with the session. Introduce a bounded in-memory cache, then optionally IndexedDB for repeated positions. Store player validation and opponent candidate analysis separately. Key results by full position state, engine version, search policy, and MultiPV; preserve actual game-history terminal checks before reuse. Do not keep a previously sampled opponent move as the only cache entry, because that would remove reply variety.

   Repeated opening practice can avoid searches altogether on cache hits. A small, lazily loaded, pre-analyzed opening pack could also make common first visits fast. Tradeoff: cache invalidation, storage, and a deliberate canonical-analysis policy. A precomputed engine answer need not match a fresh time-limited search on every device. Curated packs cover only known positions; arbitrary user arrangements still need the local engine. Generating an unrestricted five-move branching tree would grow quickly, so bound coverage and fetch only needed data.

5. **Warm the engine during setup and retain an idle session across practice runs. High on slow first loads; moderate on warm desktop. Medium effort.**

   Evidence: [TrainerBoard.tsx:160](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:160), [TrainerBoard.tsx:197](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:197), and [page.tsx:44](/Users/rohit/Projects/openrep/openrep/app/page.tsx:44). The worker begins only after Start training, and returning to setup disposes it. Warm it during an idle period after the setup page becomes usable, or on clear training intent, and place ownership above the setup/training switch. Abort searches when leaving a session while retaining an idle engine for a bounded period.

   This moves download/compile/handshake time out of the start action and avoids repeated initialization. The measured local startup cost was roughly 0.2–0.4 seconds including UI transition; actual cold-network cost depends on deployment and connection. Tradeoff: earlier bandwidth and retained worker/WASM/hash memory. Respect data-saving preferences, prioritize initial page resources, and release the engine after an idle timeout. Versioned assets are already cached correctly; warming helps timing and instantiation rather than fixing missing HTTP caching.

6. **Skip analysis when there is exactly one legal move. High for affected positions; limited frequency. Small effort.**

   Evidence: [training.ts:27](/Users/rohit/Projects/openrep/openrep/lib/training.ts:27) and [opponent.ts:51](/Users/rohit/Projects/openrep/openrep/lib/opponent.ts:51). Both flows still search even when there is only one legal move. Once actual game-over/session checks have passed, a sole legal move is necessarily the expected move or the only opponent choice. Return it directly.

   This saves a full 500–1,000 ms search whenever the case occurs, without reducing playing strength. Tradeoff: small additional branching and the need to preserve promotion choices, castling normalization, and terminal checks. Its overall benefit depends on how often users practice forced positions; it is uncommon in ordinary opening positions.

7. **Shorten training piece animations and fix the pending-drop experience. Medium perceived impact; small-to-medium effort.**

   Evidence: [TrainerBoard.tsx:318](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:318), [TrainerBoard.tsx:243](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:243), and [PositionSetup.tsx:113](/Users/rohit/Projects/openrep/openrep/components/PositionSetup.tsx:113). Setup already sets `showAnimations: false`. Training inherits `showAnimations: true` and `animationDurationInMs: 300` from installed react-chessboard. Try 80–120 ms, an instant mode, or no training animations. Explicitly connect the board's animation option to reduced-motion preferences; the CSS media rule does not clear the library's JavaScript animation timer.

   This reduces the time a move takes to visually settle, especially after the analysis waits are removed. It does not remove engine thinking time, and animation can overlap the following search. Returning `false` from every drop also makes the piece return while validation is pending. When a stable cached answer exists, validate and commit synchronously; for uncached checks, a pending preview can improve feedback without accepting an unchecked move. Tradeoff: less visual continuity and, for previews, additional reconciliation logic.

8. **Reduce font cost and give the font an immutable, versioned URL. Medium initial-load impact; small effort.**

   Evidence: [globals.css:3](/Users/rohit/Projects/openrep/openrep/app/globals.css:3) and [layout.tsx:1](/Users/rohit/Projects/openrep/openrep/app/layout.tsx:1). The variable TTF transfers about 72 KB gzip, substantial next to 174 KB of initial JS. Convert to WOFF2, subset the character coverage actually needed, and use `next/font/local` or equivalent preload/fallback-metric handling. A system-font option eliminates this custom font transfer entirely. Keep `font-display: swap` or an intentional equivalent.

   Tradeoff: system fonts alter the visual identity; aggressive subsetting limits language support. Preserve punctuation and all intended characters. Content-hashed/versioned font URLs permit long-lived caching safely. The font is already self-hosted, so moving it to a third-party provider would not solve this cost. See [Next font documentation](https://nextjs.org/docs/app/getting-started/fonts).

9. **Isolate board rendering and reduce board remounts. Medium on slower devices; medium effort.**

   Evidence: [page.tsx:44](/Users/rohit/Projects/openrep/openrep/app/page.tsx:44), [PositionSetup.tsx:107](/Users/rohit/Projects/openrep/openrep/components/PositionSetup.tsx:107), and [TrainerBoard.tsx:266](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:266). Setup and training mount separate board trees. Each trainer status/hint/overlay update also recreates the board options, arrows, and callbacks. `moveHint` is a new object on each render, invalidating the `squareRenderer` callback whenever a hint exists. The installed library creates a fresh context-provider value when its provider renders.

   Extract a memoized board view, stabilize actual board inputs, and let status and controls update independently. Consider retaining one board shell through the setup/training transition if profiling confirms remount cost. Tradeoff: more component boundaries and callback discipline; a persistent board must reset arrows, selection, and drag state correctly between modes. Some updates, including FEN, selection, hints, and drag permissions, legitimately require board updates. The desktop trace did not show a rendering bottleneck; prioritize the mobile load/start tasks.

10. **Split training-only code from setup, and narrow the client boundary. Modest initial-load impact; small-to-medium effort.**

    Evidence: [page.tsx:1](/Users/rohit/Projects/openrep/openrep/app/page.tsx:1) and [page.tsx:5](/Users/rohit/Projects/openrep/openrep/app/page.tsx:5). The entire page is a Client Component and both setup and trainer are statically imported. Move static header/guide/footer markup into the server page around a smaller interactive practice component. Dynamically load the trainer, with an idle/intent prefetch to avoid a new Start training delay.

    Tradeoff: deferred code introduces a first-use fetch if prefetch has not completed. Both screens already require chess.js and react-chessboard, so lazy-loading the trainer does not remove those shared dependencies from setup. The combined page chunk was only about 10 KB gzip, making this smaller than the engine opportunities. Converting the page shell to Server Components also does not remove React or the interactive board. See [Next lazy-loading documentation](https://nextjs.org/docs/app/guides/lazy-loading).

11. **Verify edge delivery and compression in the actual deployment. Conditional impact; small-to-medium effort.**

    Evidence: [next.config.ts:4](/Users/rohit/Projects/openrep/openrep/next.config.ts:4). Keep the current immutable engine URLs and Next's hashed chunk caching. Check deployed WASM MIME type, content encoding, CDN hit rates, cache headers, and compression for JS/CSS/fonts. Brotli could trim approximately 86 KB from this engine relative to the measured gzip output; it will not remove a one-second search budget. The local server already compresses responses, so the entire raw-to-compressed difference is not a new optimization.

    The production build already prerenders `/` statically, and there is no application API/database request on the training path. Static export and CDN hosting could simplify hosting or improve a poorly configured deployment, but static export alone does not remove client JS or speed engine analysis. It also requires replacing `next.config` response headers with equivalent host configuration. Tradeoff: host-specific configuration and, for static export, constraints on future server features. No production URL or CDN telemetry was provided, so this is a deployment check rather than a confirmed live-site bottleneck.

12. **Reduce repeated chess bookkeeping. Low impact today; small effort.**

    Evidence: [TrainerBoard.tsx:31](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:31), [TrainerBoard.tsx:62](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:62), [TrainerBoard.tsx:78](/Users/rohit/Projects/openrep/openrep/components/TrainerBoard.tsx:78), and [session.ts:8](/Users/rohit/Projects/openrep/openrep/lib/session.ts:8). `useRef(new Chess(startingFen))` evaluates a constructor on every render even though React keeps only the original ref value. Reading the side to move constructs another game. `publish()` reconstructs history twice, and repeated completion checks also call `history().length`. In installed chess.js, `history()` undoes/replays the game and produces SAN; it is not a constant-time length lookup.

    Initialize the game lazily, include turn/ply count in the committed snapshot, retain the `Move` returned by each commit for presentation, and calculate terminal state once per committed position where feasible. Keep chess.js's actual game history for repetition. A local eight-ply microbenchmark put a constructor near 0.017 ms, `history().length` near 0.196 ms, and verbose history near 0.226 ms per call. The session is capped at ten plies, so these are cleanup opportunities, not the main delay. Tradeoff: derived state must stay synchronized with commits and retries.

13. **Only remove decorative CSS effects if profiling identifies paint cost. Very low impact in current traces; small effort.**

    Evidence: [globals.css:150](/Users/rohit/Projects/openrep/openrep/app/globals.css:150), [globals.css:173](/Users/rohit/Projects/openrep/openrep/app/globals.css:173), and [globals.css:176](/Users/rohit/Projects/openrep/openrep/app/globals.css:176). The loading dot is a small opacity animation. Success/error feedback lasts 900 ms visually, but the timers do not postpone the engine reply. Removing feedback, shadows, or hover transitions will not eliminate the measured search waits. Keep useful feedback, and consider removing the color/box-shadow transitions only for low-power/instant modes if traces justify it. Tradeoff: weaker visual feedback for a likely small saving. Unreferenced default SVG files likewise do not affect downloads just by existing in `public/`.

Engine and architecture alternatives require separate decisions:

| Option | Expected speed effect | Tradeoff / recommendation |
| --- | --- | --- |
| Current Stockfish 19 lite single-threaded WASM | Already a compact browser build; scheduling and caching changes address the measured waits directly | Keep as the default. The [maintainer recommends lite single-threaded for most browser projects](https://github.com/nmrugg/stockfish.js/). |
| Multithreaded lite Stockfish | May reach useful analysis sooner on capable desktops, permitting a shorter budget | Does not shorten a fixed `go movetime 1000` by itself. Requires a different build, cross-origin isolation, worker/CPU/memory management, and a single-thread fallback. Current settings explicitly reject threads other than one. More battery use; isolation can affect integrations. Benchmark equal-quality latency before adopting. |
| Full-network Stockfish | Stronger analysis; no guaranteed improvement in interaction latency | The maintainer lists the full browser build around 94 MB versus roughly 1.7 MB for the current lite-single build. A poor first-load tradeoff for this trainer. |
| Chess.com's Torch | No demonstrated speed advantage for this application | [Chess.com documents Torch on its own Analysis page](https://www.chess.com/news/view/torch-engine-available-on-chesscom?alert=content). This audit found no official embeddable distribution/license to make it a supported drop-in here. Engine strength rankings are not a browser latency benchmark. Switching engines would also change the training answers. |
| Native server-side engine or analysis service | Could help weak devices or provide shared precomputed analysis | Requires network round trips, hosting/queue capacity, and operational cost; loses the current browser-local/offline-after-initialization behavior recorded in PRODUCT.md. A cached opening pack plus local fallback is less disruptive. |
| Smaller custom/tap-only board | Could reduce DnD code, hydration, and drag-related rendering | The measured board-library chunk is about 22 KB gzip, so benchmark the gain first. A tap-only version sacrifices dragging; a complete replacement must rebuild touch, keyboard support, arrows, promotion behavior, and move animations. Not an early priority. |
| Replace Next with a smaller static frontend | Could reduce framework code for a one-page app with no backend | Large migration relative to the app-specific bundle. A React-based replacement still retains React/React DOM and board dependencies. Static export is a smaller deployment change but does not deliver the same client-code reduction. Measure a prototype before committing. |

The first implementation pass should prepare and share expected-move searches, prepare the expected branch's reply, preserve analysis across repeat practice, and shorten the training animation. Those changes offer the largest perceived improvement while retaining the existing analysis budgets and varied-reply behavior. Then compare a quick search policy against the current policy on opening, tactical, forced-mate, castling, and promotion positions. Track warm move-to-feedback latency separately from cold engine readiness and visual settlement.

Validation limits: `npm run build` hit an environment restriction when Turbopack attempted to bind a build-worker port. A production build with `npx next build --webpack` succeeded, including TypeScript checking and static prerendering. Browser measurements used that build in local Chrome 155 with the real WASM engine, not a mock. The audit harness and raw diagnostic results are in `/private/tmp/openrep-perf-audit.cjs` and `/private/tmp/openrep-perf-audit.json`. There were no implementation changes to validate with a new regression suite. Production-network p50/p95, real-phone thermals/battery use, and quality parity across a position corpus remain unmeasured.
