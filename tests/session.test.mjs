import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getCompletionReason, MAX_TRAINING_PLIES } from '../lib/session.ts';

function apply(game, sequence) { for (const [from, to] of sequence) game.move({ from, to }); }

test('session limit counts only new committed plies independent of FEN fullmove and side', () => {
  assert.equal(MAX_TRAINING_PLIES, 20);
  const scenarios = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [['g1','f3'],['g8','f6'],['b1','c3'],['b8','c6'],['a2','a3'],['a7','a6'],['h2','h3'],['h7','h6'],['d2','d3'],['d7','d6'],['c1','d2'],['c8','d7'],['a1','b1'],['a8','b8'],['b2','b3'],['b7','b6'],['e2','e3'],['e7','e6'],['f1','e2'],['f8','e7']]],
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 51', [['g8','f6'],['g1','f3'],['b8','c6'],['b1','c3'],['a7','a6'],['a2','a3'],['h7','h6'],['h2','h3'],['d7','d6'],['d2','d3'],['c8','d7'],['c1','d2'],['a8','b8'],['a1','b1'],['b7','b6'],['b2','b3'],['e7','e6'],['e2','e3'],['f8','e7'],['f1','e2']]],
  ];
  for (const [fen, line] of scenarios) {
    const game = new Chess(fen);
    assert.equal(getCompletionReason(game), null);
    apply(game, line.slice(0, 18));
    assert.equal(game.history().length, 18);
    assert.equal(getCompletionReason(game), null);
    apply(game, line.slice(18));
    assert.equal(game.history().length, 20);
    assert.equal(getCompletionReason(game), 'depth-limit');
  }
});

test('checkmate and draw have priority over depth-limit', () => {
  const mate = new Chess();
  apply(mate, [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]);
  assert.equal(getCompletionReason(mate), 'checkmate');
  const draw = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(getCompletionReason(draw), 'draw');
});
