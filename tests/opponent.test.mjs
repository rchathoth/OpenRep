import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getOpponentMove } from '../lib/opponent.ts';

function engine(move = 'e7e5', onSearch = () => {}) {
  return { async findBestMove({ signal }) { onSearch(); signal.throwIfAborted(); return move; } };
}
function response(payload, status = 200) { return { ok: status >= 200 && status < 300, status, async json() { return payload; } }; }
function opponentTurn() { const game = new Chess(); game.move('e2e4'); return game; }

test('a usable database candidate avoids Stockfish and returns a legal move', async () => {
  const game = opponentTurn(); let searches = 0;
  const beforeHistory = game.history();
  const result = await getOpponentMove(game, new AbortController().signal, engine('e7e5', () => searches++), {
    fetch: async (_url, options) => { assert.equal(JSON.parse(options.body).fen, game.fen()); return response({ moves: [{ uci: 'e7e5', count: 10 }] }); },
    random: () => 0,
  });
  assert.deepEqual(result, { move: 'e7e5', source: 'lichess' }); assert.equal(searches, 0);
  assert.deepEqual(game.history(), beforeHistory);
});

test('empty, invalid, and unavailable database responses fall back to Stockfish', async () => {
  for (const fetch of [async () => response({ moves: [] }), async () => response({ moves: [{ uci: 'a1a8', count: 10 }] }), async () => response({}, 502), async () => { throw new Error('offline'); }]) {
    const game = opponentTurn(); let searches = 0;
    const result = await getOpponentMove(game, new AbortController().signal, engine('e7e5', () => searches++), { fetch });
    assert.deepEqual(result, { move: 'e7e5', source: 'stockfish' }); assert.equal(searches, 1);
  }
});

test('request timeout falls back; fallback errors propagate', async () => {
  const game = opponentTurn();
  const timed = await getOpponentMove(game, new AbortController().signal, engine(), {
    timeoutMs: 2,
    fetch: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  });
  assert.deepEqual(timed, { move: 'e7e5', source: 'stockfish' });
  await assert.rejects(getOpponentMove(game, new AbortController().signal, { async findBestMove() { throw new Error('engine failed'); } }, {
    fetch: async () => response({ moves: [] }),
  }), /engine failed/);
});

test('caller cancellation and stale positions reject without starting fallback', async () => {
  const game = opponentTurn(); const abort = new AbortController(); let searches = 0;
  const pending = getOpponentMove(game, abort.signal, engine('e7e5', () => searches++), {
    fetch: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  });
  abort.abort(); await assert.rejects(pending); assert.equal(searches, 0);

  const secondGame = opponentTurn(); let release;
  const stale = getOpponentMove(secondGame, new AbortController().signal, engine('e7e5', () => searches++), {
    fetch: () => new Promise(resolve => { release = resolve; }),
  });
  await new Promise(resolve => setImmediate(resolve));
  secondGame.move('g8f6'); release(response({ moves: [] }));
  await assert.rejects(stale, /position changed/); assert.equal(searches, 0);
});
