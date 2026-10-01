import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { commonLegalMoves, parseOpeningCandidates, sampleWeightedMove } from '../lib/opening.ts';

test('weighted sampling uses deterministic frequency boundaries', () => {
  const rows = [{ uci: 'e2e4', count: 6 }, { uci: 'd2d4', count: 3 }, { uci: 'c2c4', count: 1 }];
  assert.equal(sampleWeightedMove(rows, () => 0), 'e2e4');
  assert.equal(sampleWeightedMove(rows, () => 0.599), 'e2e4');
  assert.equal(sampleWeightedMove(rows, () => 0.6), 'd2d4');
  assert.equal(sampleWeightedMove(rows, () => 0.9), 'c2c4');
  assert.equal(sampleWeightedMove([{ uci: 'a2a3', count: 1 }], () => 0.999), 'a2a3');
  assert.equal(sampleWeightedMove([], () => 0), null);
  assert.equal(sampleWeightedMove([{ uci: 'a2a3', count: 0 }], () => 0), null);
  assert.equal(sampleWeightedMove(rows, () => 1), null);
});

test('parsing rejects malformed rows; common selection is legal, merged, sorted, and 95% inclusive', () => {
  const parsed = parseOpeningCandidates({ moves: [
    { uci: 'e2e4', count: 600 }, { uci: 'd2d4', count: 300 }, { uci: 'g1f3', count: 100 },
    { uci: 'e2e5', count: 10000 }, { uci: 'e7e5', count: -1 }, { uci: 'd2d4', count: 1.5 }, null,
  ] });
  assert.equal(parsed.length, 4);
  assert.deepEqual(commonLegalMoves(new Chess().fen(), parsed), [
    { uci: 'e2e4', count: 600 }, { uci: 'd2d4', count: 300 }, { uci: 'g1f3', count: 100 },
  ]);
  assert.deepEqual(commonLegalMoves(new Chess().fen(), [
    { uci: 'e2e4', count: 600 }, { uci: 'e2e4', count: 300 }, { uci: 'd2d4', count: 100 },
  ]), [{ uci: 'e2e4', count: 900 }, { uci: 'd2d4', count: 100 }]);
  assert.deepEqual(commonLegalMoves(new Chess().fen(), [
    { uci: 'd2d4', count: 1 }, { uci: 'e2e4', count: 1 }, { uci: 'c2c4', count: 1 },
  ]), [{ uci: 'c2c4', count: 1 }, { uci: 'd2d4', count: 1 }, { uci: 'e2e4', count: 1 }]);
});

test('candidate validation handles castling, underpromotion, en passant, and does not mutate the game', () => {
  const cases = [
    ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1h1', 'e1g1'],
    ['7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n', 'a7a8n'],
    ['7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', 'e5d6', 'e5d6'],
  ];
  for (const [fen, candidate, expected] of cases) {
    const game = new Chess(fen); const before = game.fen(); const history = game.history();
    assert.deepEqual(commonLegalMoves(fen, [{ uci: candidate, count: 10 }]), [{ uci: expected, count: 10 }]);
    assert.equal(game.fen(), before); assert.deepEqual(game.history(), history);
  }
});
