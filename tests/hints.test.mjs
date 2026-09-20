import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { classifyHint, hintText } from '../lib/hints.ts';

const cases = [
  ['check', '7k/8/6Q1/8/8/8/8/K7 w - - 0 1', 'g6g7', ['forcing.check'], 'Look for checks.'],
  ['capture', '7k/8/8/8/8/8/p7/R6K w - - 0 1', 'a1a2', ['forcing.capture'], 'Look for captures.'],
  ['checking capture', '7k/8/8/8/8/8/7p/K6R w - - 0 1', 'h1h2', ['forcing.check', 'forcing.capture'], 'Look for checks.'],
  ['quiet move', new Chess().fen(), 'e2e4', [], 'Consider your opponent’s threats and your available options.'],
  ['en passant', '7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', 'e5d6', ['forcing.capture'], 'Look for captures.'],
  ['promotion check', '7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8q', ['forcing.check'], 'Look for checks.'],
  ['quiet underpromotion', '7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n', [], 'Consider your opponent’s threats and your available options.'],
  ['capture promotion', '1r5k/P7/8/8/8/8/8/7K w - - 0 1', 'a7b8q', ['forcing.check', 'forcing.capture'], 'Look for checks.'],
  ['Black checking capture', 'k6r/7P/8/8/8/8/8/7K b - - 0 1', 'h8h7', ['forcing.check', 'forcing.capture'], 'Look for checks.'],
];

for (const [name, fen, move, concepts, text] of cases) {
  test(`classifies ${name} with approved wording and no position mutation`, () => {
    const game = new Chess(fen);
    const before = game.fen();
    const history = game.history();
    const result = classifyHint(before, move);
    assert.deepEqual(result, { concepts, primary: concepts[0] ?? null });
    assert.equal(hintText(result), text);
    assert.equal(game.fen(), before);
    assert.deepEqual(game.history(), history);
    assert.deepEqual(classifyHint(before, move), result);
  });
}
