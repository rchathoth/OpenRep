# Stockfish.js 19.0.0

OpenReps distributes the unmodified `stockfish-19-lite-single.js` and
`stockfish-19-lite-single.wasm` from the pinned npm package `stockfish@19.0.0`.

Stockfish.js 19 (c) 2026, Chess.com, LLC.
Based on Stockfish (c) T. Romstad, M. Costalba, J. Kiiski, G. Linscott,
and other contributors. Lite neural network by Chris Bao (sscg13).

Stockfish is free software licensed under the GNU General Public License,
version 3. You may redistribute and modify it under that license. It is
provided WITHOUT ANY WARRANTY, including merchantability or fitness for a
particular purpose. The full license is in `licenses/Stockfish-GPL-3.0.txt`
and is served alongside the engine at
`/engine/stockfish-19.0.0/COPYING.txt`.

Corresponding source and build scripts for this exact package revision:

- Source: https://github.com/nmrugg/stockfish.js/tree/54fde71d90c7c403964f6cacef48f7bbec495df1
- Source archive (no charge): https://github.com/nmrugg/stockfish.js/archive/54fde71d90c7c403964f6cacef48f7bbec495df1.tar.gz
- Build instructions: https://github.com/nmrugg/stockfish.js/blob/54fde71d90c7c403964f6cacef48f7bbec495df1/README.md
- Embedded lite network: https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue
- Upstream Stockfish: https://github.com/official-stockfish/Stockfish

The engine's JS and WASM are copied without modification by
`scripts/prepare-engine.mjs`. Keep these notices, the license, and access to
the corresponding source available alongside any deployed/distributed engine.
If you change the engine, supply the corresponding modified source and build
instructions and update the versioned asset path and notices.
