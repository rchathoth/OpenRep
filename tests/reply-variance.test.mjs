import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getOpponentMove } from '../lib/opponent.ts';

test('each opponent turn samples afresh with uniform variance among qualifying lines', async () => {
  const game = new Chess(); game.move('e4');
  const counts = {}; let searches = 0;
  const engine = { async findCandidateMoves() {
    searches++;
    return { move: 'e7e5', lines: ['e7e5', 'c7c5', 'e7e6'].map((move, index) => ({ move, score: { type: 'cp', value: 50 - index * 50 } })) };
  } };
  for (let trial = 0; trial <  90; trial++) {
    const { move } = await getOpponentMove(game, new AbortController().signal, engine, { random: () => (trial + 0.5) / 90 });
    counts[move] = (counts[move] ?? 0) + 1;
  }
  assert.deepEqual(counts, { e7e5: 30, c7c5: 30, e7e6: 30 });
  assert.equal(searches, 90);
  assert.deepEqual(game.history(), ['e4']);
});
