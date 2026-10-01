import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/opening/route.ts';

const validFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const request = body => new Request('http://localhost/api/opening', { method: 'POST', headers: { 'content-type': 'application/json' }, body });

test('opening API validates JSON and FEN without contacting upstream', async () => {
  const original = globalThis.fetch; let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not fetch'); };
  try {
    assert.equal((await POST(request('{'))).status, 400);
    assert.equal((await POST(request(JSON.stringify({ fen: 'bad fen' })))).status, 400);
    assert.equal(called, false);
  } finally { globalThis.fetch = original; }
});

test('opening API returns safe aggregate frequencies and sets query/cache limits', async () => {
  const original = globalThis.fetch; let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url: new URL(url), options };
    return Response.json({ moves: [
      { uci: 'e2e4', white: 3, draws: 2, black: 4 },
      { uci: 'd2d4', white: 0, draws: 0, black: 0 },
      { uci: 'c2c4', white: 1.2, draws: 2, black: 3 },
      { uci: 7, white: 1, draws: 1, black: 1 },
    ] });
  };
  try {
    const response = await POST(request(JSON.stringify({ fen: validFen })));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { moves: [{ uci: 'e2e4', count: 9 }] });
    assert.equal(captured.url.searchParams.get('moves'), '256');
    assert.equal(captured.url.searchParams.get('topGames'), '0');
    assert.equal(captured.url.searchParams.get('recentGames'), '0');
    assert.equal(captured.url.searchParams.get('variant'), 'standard');
    assert.equal(captured.url.searchParams.get('speeds'), 'blitz,rapid,classical');
    assert.equal(captured.url.searchParams.has('ratings'), false);
    assert.equal(captured.options.next.revalidate, 300);
    assert.ok(captured.options.signal instanceof AbortSignal);
  } finally { globalThis.fetch = original; }
});

test('empty data returns 200; malformed envelopes and upstream HTTP failures return 502', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ moves: [] });
    assert.deepEqual(await (await POST(request(JSON.stringify({ fen: validFen })))).json(), { moves: [] });
    globalThis.fetch = async () => Response.json({ nope: [] });
    assert.equal((await POST(request(JSON.stringify({ fen: validFen })))).status, 502);
    globalThis.fetch = async () => new Response('', { status: 429 });
    assert.equal((await POST(request(JSON.stringify({ fen: validFen })))).status, 502);
  } finally { globalThis.fetch = original; }
});

test('an upstream abort at the request deadline returns 504', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  try { assert.equal((await POST(request(JSON.stringify({ fen: validFen })))).status, 504); }
  finally { globalThis.fetch = original; }
});
