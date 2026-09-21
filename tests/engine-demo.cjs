/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node/Playwright demonstration. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

// A standalone browser Worker demo, independent of React and training rules.
// The server must be running so the demo can load the same-origin WASM assets.
async function demonstrateEngine(page) {
  const base = process.env.TEST_URL || 'http://localhost:3000';
  await page.goto(`${base}/engine/stockfish-19.0.0/SOURCE.txt`);
  return page.evaluate(() => new Promise((resolve, reject) => {
    const engine = new Worker('/engine/stockfish-19.0.0/stockfish-19-lite-single.js');
    const result = { name: '', moves: [], heartbeats: 0, stopElapsedMs: 0 };
    let phase = 'init', stoppedAt = 0;
    const heartbeat = setInterval(() => result.heartbeats++, 10);
    let stopTimer;
    const cleanup = () => { clearInterval(heartbeat); clearTimeout(deadline); clearTimeout(stopTimer); engine.terminate(); };
    const deadline = setTimeout(() => { cleanup(); reject(new Error('Engine demo timed out')); }, 30000);
    engine.onerror = event => { cleanup(); reject(new Error(event.message)); };
    engine.onmessage = ({ data }) => {
      const line = String(data);
      if (line.startsWith('id name ')) result.name = line.slice(8);
      if (line === 'uciok') {
        engine.postMessage('setoption name Threads value 1');
        engine.postMessage('setoption name Hash value 16');
        engine.postMessage('setoption name MultiPV value 1');
        engine.postMessage('isready');
      } else if (line === 'readyok') {
        phase = 'stopping';
        engine.postMessage('position startpos');
        engine.postMessage('go movetime 10000');
        stopTimer = setTimeout(() => { stoppedAt = performance.now(); engine.postMessage('stop'); }, 150);
      } else if (line.startsWith('bestmove ')) {
        result.moves.push(line.split(/\s+/)[1]);
        if (phase === 'stopping') {
          result.stopElapsedMs = performance.now() - stoppedAt;
          phase = 'reply';
          engine.postMessage('position startpos moves e2e4');
          engine.postMessage('go movetime 500');
        } else {
          cleanup(); resolve(result);
        }
      }
    };
    engine.postMessage('uci');
  }));
}

function verifyDemo(result) {
  assert.match(result.name, /Stockfish.*19/);
  assert.equal(result.moves.length, 2);
  for (const move of result.moves) assert.match(move, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
  assert.ok(result.stopElapsedMs < 2000, 'The real engine must honor stop promptly');
  assert.ok(result.heartbeats >= 10, 'The main thread must remain responsive while the engine searches');
}

module.exports = { demonstrateEngine, verifyDemo };
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    try {
      const result = await demonstrateEngine(await browser.newPage());
      verifyDemo(result);
      console.log('PASS standalone Stockfish worker demo:', result);
    } finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
