import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { EngineClient } from '../lib/engine/engine-client.ts';
import { defaultSettings } from '../lib/engine/settings.ts';
import { parseBestMove, searchCommands, UciSession } from '../lib/engine/uci.ts';
import { getExpectedMove } from '../lib/training.ts';

const fen = new Chess().fen();
const tick = () => new Promise(resolve => setImmediate(resolve));
class FakeWorker {
  sent = []; terminated = false;
  postMessage(message) { this.sent.push(message); }
  terminate() { this.terminated = true; }
  emit(data) { this.onmessage?.({ data }); }
  result(id, move = 'e2e4') { this.emit({ type: 'result', id, move }); }
  searches() { return this.sent.filter(message => message.type === 'search'); }
}
function harness(t, options = {}) {
  const worker = new FakeWorker();
  const client = new EngineClient({ workerFactory: () => worker, ...options });
  t.after(() => client.dispose());
  return { client, worker };
}
async function ready(client, worker) {
  const promise = client.initialize(); worker.emit({ type: 'ready' }); await promise;
}

test('single-thread defaults conserve mobile CPU; invalid settings are rejected', () => {
  assert.deepEqual(defaultSettings(), { movetime: 1000, threads: 1, hashMb: 16 });
  assert.equal(defaultSettings(true).movetime, 500);
  for (const patch of [{ threads: 2 }, { hashMb: 0 }, { movetime: 0 }, { depth: 0 }]) {
    assert.throws(() => new EngineClient({ settings: { ...defaultSettings(), ...patch } }));
  }
});

test('UCI commands preserve raw FEN, bound time/depth, and reject command injection', () => {
  assert.deepEqual(searchCommands(fen, 750), [`position fen ${fen}`, 'go movetime 750']);
  assert.equal(searchCommands(fen, 500, 12)[1], 'go movetime 500 depth 12');
  for (const invalid of ['', 'not fen', `${fen}\nquit`]) assert.throws(() => searchCommands(invalid, 750));
  for (const ms of [-1, 0, NaN, Infinity, 1.5, 10001]) assert.throws(() => searchCommands(fen, ms));
});

test('bestmove parsing handles ponder, promotion, castling, noise and no-move output', () => {
  assert.equal(parseBestMove('info depth 18 score cp 34 pv e2e4'), undefined);
  assert.equal(parseBestMove(' bestmove e2e4 ponder e7e5 '), 'e2e4');
  assert.equal(parseBestMove('bestmove a7a8n'), 'a7a8n');
  assert.equal(parseBestMove('bestmove e1g1'), 'e1g1');
  for (const invalid of ['bestmove', 'bestmove (none)', 'bestmove 0000', 'bestmove a7a8k', 'bestmove e2e4 garbage']) {
    assert.throws(() => parseBestMove(invalid));
  }
});

test('worker session handshakes before searching and associates stop results with the original ID', () => {
  const sent = [], events = [];
  const session = new UciSession(command => sent.push(command), event => events.push(event));
  session.command({ type: 'init', settings: defaultSettings() });
  assert.deepEqual(sent, ['uci']);
  assert.throws(() => session.command({ type: 'search', id: 1, fen, movetime: 750 }));
  session.line('id name Stockfish\nuciok');
  assert.deepEqual(sent.slice(1), ['setoption name Threads value 1', 'setoption name Hash value 16', 'setoption name MultiPV value 1', 'setoption name UCI_Chess960 value false', 'isready']);
  session.line('readyok');
  assert.deepEqual(events, [{ type: 'ready' }]);
  session.command({ type: 'search', id: 1, fen, movetime: 750 });
  session.command({ type: 'stop', id: 999 }); assert.notEqual(sent.at(-1), 'stop');
  session.command({ type: 'stop', id: 1 }); assert.equal(sent.at(-1), 'stop');
  assert.throws(() => session.command({ type: 'search', id: 2, fen, movetime: 750 }));
  session.line('bestmove e2e4'); assert.deepEqual(events.at(-1), { type: 'result', id: 1, move: 'e2e4' });
  session.command({ type: 'search', id: 2, fen, movetime: 750 });
  session.line('bestmove (none)'); assert.equal(events.at(-1).id, 2); assert.equal(events.at(-1).type, 'error');
  session.command({ type: 'search', id: 3, fen, movetime: 750 });
});

test('client queues until initialized, serializes searches, ignores stale IDs, and reuses its worker', async t => {
  const { client, worker } = harness(t);
  const first = client.findBestMove({ fen });
  const second = client.findBestMove({ fen, movetime: 500 });
  assert.equal(worker.searches().length, 0);
  worker.emit({ type: 'ready' }); await tick();
  assert.equal(worker.searches().length, 1);
  worker.result(100); assert.equal(worker.searches().length, 1);
  worker.result(1); assert.equal(await first, 'e2e4');
  assert.equal(worker.searches().length, 2); assert.equal(worker.searches()[1].movetime, 500);
  worker.result(1, 'd2d4'); worker.result(2, 'g1f3'); assert.equal(await second, 'g1f3');
  // Unsolicited/malformed result messages while idle cannot dereference a
  // nonexistent request or poison the next search.
  worker.emit({ type: 'result' });
  const third = client.findBestMove({ fen }); await tick(); worker.result(3);
  assert.equal(await third, 'e2e4');
  assert.equal(worker.sent.filter(message => message.type === 'init').length, 1);
});

test('aborting active search rejects immediately but drains bestmove before the next FEN', async t => {
  const { client, worker } = harness(t); await ready(client, worker);
  const controller = new AbortController();
  const first = client.findBestMove({ fen, signal: controller.signal });
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = client.findBestMove({ fen }); await tick();
  controller.abort(); await rejected;
  assert.equal(worker.sent.at(-1).type, 'stop'); assert.equal(worker.searches().length, 1);
  worker.result(1); assert.equal(worker.searches().length, 2);
  worker.result(2, 'd2d4'); assert.equal(await second, 'd2d4');
});

test('aborting before initialization or while queued never starts that search', async t => {
  const { client, worker } = harness(t);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(client.findBestMove({ fen, signal: cancelled.signal }), { name: 'AbortError' });
  assert.equal(worker.sent.length, 0);
  const controller = new AbortController();
  const pending = client.findBestMove({ fen, signal: controller.signal });
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  controller.abort(); await rejection; worker.emit({ type: 'ready' }); await tick();
  assert.equal(worker.searches().length, 0);
});

test('stop rejects active and queued requests; dispose terminates and forbids reuse', async t => {
  const { client, worker } = harness(t); await ready(client, worker);
  const requests = [client.findBestMove({ fen }), client.findBestMove({ fen })];
  const rejections = requests.map(p => assert.rejects(p, { name: 'AbortError' }));
  await tick(); client.stop(); await Promise.all(rejections);
  worker.result(1); assert.equal(worker.searches().length, 1);
  client.dispose(); assert.ok(worker.terminated);
  await assert.rejects(client.findBestMove({ fen }), /unavailable/);
});

test('init timeout and constructor failure fail closed', async t => {
  const { client, worker } = harness(t, { initTimeoutMs: 10 });
  await assert.rejects(client.findBestMove({ fen }), /unavailable/); assert.ok(worker.terminated);
  const unsupported = new EngineClient({ workerFactory: () => { throw new Error('unsupported'); } });
  await assert.rejects(unsupported.initialize(), /unavailable/); unsupported.dispose();
});

test('worker crashes and unreadable messages reject every pending request', async t => {
  for (const kind of ['onerror', 'onmessageerror']) {
    const { client, worker } = harness(t); await ready(client, worker);
    const a = assert.rejects(client.findBestMove({ fen }), /unavailable/);
    const b = assert.rejects(client.findBestMove({ fen }), /unavailable/);
    worker[kind]({ preventDefault() {} }); await Promise.all([a, b]); assert.ok(worker.terminated);
  }
});

test('search timeout sends stop, permits retry after drain, and hard-stops unresponsive engines', async t => {
  const { client, worker } = harness(t, { searchGraceMs: 5, stopTimeoutMs: 20 }); await ready(client, worker);
  await assert.rejects(client.findBestMove({ fen, movetime: 1 }), /timed out/);
  assert.equal(worker.sent.at(-1).type, 'stop'); worker.result(1);
  const retry = client.findBestMove({ fen }); await tick(); worker.result(2); assert.equal(await retry, 'e2e4');
  const abort = new AbortController();
  const pending = assert.rejects(client.findBestMove({ fen, signal: abort.signal }), { name: 'AbortError' });
  await tick(); abort.abort(); await pending;
  await new Promise(resolve => setTimeout(resolve, 35)); assert.ok(worker.terminated);
});

test('deadline check discards a result delivered before an overdue timer on tab resume', async t => {
  const { client, worker } = harness(t); await ready(client, worker);
  const pending = assert.rejects(client.findBestMove({ fen }), /timed out/); await tick();
  const now = Date.now;
  try { Date.now = () => now() + 60_000; worker.result(1); }
  finally { Date.now = now; }
  await pending;
});

test('search errors are retryable and do not poison the worker', async t => {
  const { client, worker } = harness(t); await ready(client, worker);
  const failed = assert.rejects(client.findBestMove({ fen }), /no move/); await tick();
  worker.emit({ type: 'error', id: 1, message: 'no move' }); await failed;
  const retry = client.findBestMove({ fen }); await tick(); worker.result(2); assert.equal(await retry, 'e2e4');
});

test('training validates engine moves on a copy, normalizes castling and preserves underpromotion', async () => {
  for (const [position, output, expected] of [
    [fen, 'e2e4', 'e2e4'],
    ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1', 'e1g1'],
    ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1h1', 'e1g1'],
    ['r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8a8', 'e8c8'],
    ['7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n', 'a7a8n'],
    ['7k/8/8/3pP3/8/8/8/7K w - d6 0 1', 'e5d6', 'e5d6'],
  ]) {
    const game = new Chess(position), before = game.fen();
    const signal = new AbortController().signal;
    const engine = { async findBestMove(request) { assert.equal(request.fen, before); assert.equal(request.signal, signal); return output; } };
    assert.equal(await getExpectedMove(game, signal, engine), expected); assert.equal(game.fen(), before); assert.equal(game.history().length, 0);
  }
});

test('illegal/malformed engine moves are rejected; changed positions and cancellation cannot commit', async () => {
  for (const move of ['e2e5', 'a1a8', 'e1h1', '0000', '(none)', 'e2e4\nquit', null]) {
    await assert.rejects(getExpectedMove(new Chess(), new AbortController().signal, { async findBestMove() { return move; } }), /invalid|illegal/);
  }
  const game = new Chess();
  await assert.rejects(getExpectedMove(game, new AbortController().signal, { async findBestMove() { game.move('d4'); return 'e2e4'; } }), /changed/);
  const controller = new AbortController();
  await assert.rejects(getExpectedMove(new Chess(), controller.signal, { async findBestMove() { controller.abort(); return 'e2e4'; } }), { name: 'AbortError' });
});

test('mate, stalemate, insufficient material, fifty-move and repetition draws never search', async () => {
  const games = [
    new Chess('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1'),
    new Chess('7k/5Q2/5K2/8/8/8/8/8 b - - 0 1'),
    new Chess('7k/8/8/8/8/8/8/7K w - - 0 1'),
    new Chess('7k/8/8/8/8/8/R7/7K w - - 100 1'),
  ];
  const repeated = new Chess();
  for (const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) repeated.move(move);
  games.push(repeated);
  for (const game of games) {
    await assert.rejects(getExpectedMove(game, new AbortController().signal, { findBestMove() { assert.fail('Must not search game-over positions'); } }), /game over/);
  }
});
