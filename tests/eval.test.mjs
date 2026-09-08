import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/eval/route.ts';
import { Chess } from 'chess.js';
const fen = new Chess().fen();
const request = (position = fen) => new Request('http://localhost/api/eval', {method:'POST', body:JSON.stringify({fen:position})});
async function upstream(value, status, check) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => { check?.(url); return new Response(typeof value === 'string' ? value : JSON.stringify(value), {status}); };
  try { return await POST(request()); } finally { globalThis.fetch = original; }
}
test('raw FEN is encoded once and only the top PV first move is used', async () => {
  const result = await upstream({pvs:[{moves:'  e2e4   e7e5 '},{moves:'d2d4'}]},200,url=>{
    assert.equal(url.searchParams.get('fen'),fen); assert.equal(url.searchParams.get('multiPv'),'1');
    assert.ok(!url.href.includes('%25'));
  });
  assert.deepEqual(await result.json(),{move:'e2e4'});
});
test('rejects missing, malformed, and illegal PVs', async () => {
  for (const value of [null, {}, {pvs:[]}, {pvs:[null]}, {pvs:[{moves:42}]}, {pvs:[{moves:'e2e5'}]}, 'bad JSON']) {
    assert.equal((await upstream(value,200)).status,502);
  }
});
test('handles cache miss, rate limiting and upstream failure', async () => {
  for (const [status, expected] of [[404,404],[429,429],[500,502]]) assert.equal((await upstream({},status)).status,expected);
});
test('rejects invalid requests and game-over positions without upstream calls', async () => {
  assert.equal((await POST(new Request('http://localhost', {method:'POST',body:'null'}))).status,400);
  assert.equal((await POST(request('invalid'))).status,400);
  assert.equal((await POST(request('8/8/8/8/8/8/6k1/4K3 w - - 0 1'))).status,409);
});
test('normalizes castling and preserves promotion suffix', async () => {
  const original=globalThis.fetch;
  try {
    for(const [position,uci,expected] of [
      ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1h1','e1g1'],
      ['7k/P7/8/8/8/8/8/7K w - - 0 1','a7a8n','a7a8n']]) {
      globalThis.fetch=async()=>Response.json({pvs:[{moves:uci}]});
      assert.deepEqual(await (await POST(request(position))).json(),{move:expected});
    }
  } finally { globalThis.fetch=original; }
});
