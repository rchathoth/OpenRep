import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { POST } from '../app/api/opening/route.ts';
import { getOpponentMove } from '../lib/opponent.ts';

const routeFetch = async (_url, options) => POST(new Request('http://localhost/api/opening', options));
function position() { const game = new Chess(); game.move('e4'); return game; }

test('repeated replies through the opening route preserve weights and sample afresh', async () => {
  const original = globalThis.fetch;
  let upstreamCalls = 0;
  let randomCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    return Response.json({ moves: [
      { uci: 'e7e5', white: 20, draws: 10, black: 30 },
      { uci: 'c7c5', white: 10, draws: 10, black: 10 },
      { uci: 'e7e6', white: 3, draws: 3, black: 4 },
    ] });
  };
  try {
    const game = position();
    const before = game.fen();
    const counts = {};
    const engine = { async findBestMove() { assert.fail('Usable database moves must avoid Stockfish'); } };
    for (let trial = 0; trial < 100; trial++) {
      const result = await getOpponentMove(game, new AbortController().signal, engine, {
        fetch: routeFetch,
        // Midpoints uniformly cover [0, 1); exact counts avoid statistical flakiness.
        random: () => { randomCalls++; return (trial + 0.5) / 100; },
      });
      assert.equal(result.source, 'lichess');
      counts[result.move] = (counts[result.move] ?? 0) + 1;
    }
    assert.deepEqual(counts, { e7e5: 60, c7c5: 30, e7e6: 10 });
    assert.equal(randomCalls, 100);
    assert.equal(upstreamCalls, 100);
    assert.equal(game.fen(), before);
    assert.deepEqual(game.history(), ['e4']);
  } finally { globalThis.fetch = original; }
});

test('upstream 401 becomes a route 502 and repeats the Stockfish fallback instead of sampling', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('Authorization Required', { status: 401 });
  try {
    const game = position();
    const counts = {};
    let searches = 0;
    const engine = { async findBestMove() { searches++; return 'e7e5'; } };
    for (let trial = 0; trial < 5; trial++) {
      const result = await getOpponentMove(game, new AbortController().signal, engine, {
        fetch: async (url, options) => {
          const response = await routeFetch(url, options);
          assert.equal(response.status, 502);
          return response;
        },
        random: () => assert.fail('Failed database requests must not sample'),
      });
      assert.equal(result.source, 'stockfish');
      counts[result.move] = (counts[result.move] ?? 0) + 1;
    }
    assert.deepEqual(counts, { e7e5: 5 });
    assert.equal(searches, 5);
  } finally { globalThis.fetch = original; }
});
