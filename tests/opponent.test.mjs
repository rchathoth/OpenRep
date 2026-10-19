import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getOpponentMove, selectOpponentMove } from '../lib/opponent.ts';

const cp = (move, value) => ({ move, score: { type: 'cp', value } });
const mate = (move, value) => ({ move, score: { type: 'mate', value } });
function position() { const game = new Chess(); game.move('e4'); return game; }
const noRandom = () => assert.fail('A forced reply must not sample');

test('opponent requests five lines, samples legal moves within 100cp, and preserves the game', async () => {
  const game = position(), before = game.fen();
  const lines = [cp('e7e5', 40), cp('c7c5', 0), cp('e7e6', -60), cp('d7d5', -61), cp('a1a8', 30)];
  for (const [random, expected] of [[0, 'e7e5'], [0.4, 'c7c5'], [0.99, 'e7e6']]) {
    const result = await getOpponentMove(game, new AbortController().signal, {
      async findCandidateMoves(request) {
        assert.equal(request.fen, before); assert.equal(request.multiPV, 5);
        return { move: 'e7e5', lines };
      },
    }, { random: () => random });
    assert.deepEqual(result, { move: expected, source: 'stockfish' });
  }
  assert.equal(game.fen(), before); assert.deepEqual(game.history(), ['e4']);
});

test('forcing position keeps its sole qualifying move and requests only the legal count', async () => {
  // Black is in check; Kb7 and Kb8 are legal, but only Kb7 is within 100cp.
  const game = new Chess('k7/8/8/8/8/8/R7/7K b - - 0 1');
  assert.deepEqual(game.moves().sort(), ['Kb7', 'Kb8']);
  const result = await getOpponentMove(game, new AbortController().signal, {
    async findCandidateMoves({ multiPV }) {
      assert.equal(multiPV, 2);
      return { move: 'a8b7', lines: [cp('a8b7', -100), cp('a8b8', -201)] };
    },
  }, { random: noRandom });
  assert.equal(result.move, 'a8b7');
});

test('unavailable scores, one candidate, illegal best moves, and invalid random values', () => {
  const fen = position().fen();
  for (const lines of [[], [cp('e7e5', 5)], [{ move: 'e7e5' }], [cp('e7e5', 5), { move: 'c7c5' }]]) {
    assert.equal(selectOpponentMove(fen, { move: 'e7e5', lines }, noRandom), 'e7e5');
  }
  assert.throws(() => selectOpponentMove(fen, { move: 'a1a8', lines: [] }), /illegal/);
  for (const value of [NaN, -1, 1]) assert.equal(selectOpponentMove(fen, { move: 'e7e5', lines: [cp('e7e5', 0), cp('c7c5', 0)] }, () => value), 'e7e5');
});

test('mate scores preserve winning mates and exclude faster losing mates', () => {
  const fen = position().fen();
  assert.equal(selectOpponentMove(fen, { move: 'e7e5', lines: [mate('e7e5', 2), mate('c7c5', 5), cp('e7e6', 9999), mate('d7d5', -1)] }, () => 0.99), 'c7c5');
  assert.equal(selectOpponentMove(fen, { move: 'e7e5', lines: [mate('e7e5', 2), cp('c7c5', 9999), mate('e7e6', -2)] }, noRandom), 'e7e5');
  assert.equal(selectOpponentMove(fen, { move: 'e7e5', lines: [mate('e7e5', -5), mate('c7c5', -5), mate('e7e6', -2)] }, () => 0.99), 'c7c5');
  assert.equal(selectOpponentMove(fen, { move: 'e7e5', lines: [cp('e7e5', -9000), mate('c7c5', -1)] }, noRandom), 'e7e5');
});

test('cancellation and changed positions discard results; engine failures permit reply retry', async () => {
  const game = position(), abort = new AbortController(); let calls = 0;
  const engine = { async findCandidateMoves() { calls++; abort.abort(); return { move: 'e7e5', lines: [] }; } };
  await assert.rejects(getOpponentMove(game, abort.signal, engine), { name: 'AbortError' });
  await assert.rejects(getOpponentMove(game, abort.signal, engine), { name: 'AbortError' });
  assert.equal(calls, 1);
  await assert.rejects(getOpponentMove(game, new AbortController().signal, {
    async findCandidateMoves() { game.move('Nf6'); return { move: 'e7e5', lines: [] }; },
  }), /position changed/);
  let fail = true;
  const retryEngine = { async findCandidateMoves() { if (fail) throw new Error('search failed'); return { move: 'e7e5', lines: [] }; } };
  await assert.rejects(getOpponentMove(position(), new AbortController().signal, retryEngine), /search failed/);
  fail = false;
  assert.equal((await getOpponentMove(position(), new AbortController().signal, retryEngine)).move, 'e7e5');
});
