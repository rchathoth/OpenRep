/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser runner. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { demonstrateEngine, verifyDemo } = require('./engine-demo.cjs');
const base = process.env.TEST_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errors = [];
  async function makePage(mock = false) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
    if (mock) await context.addInitScript(() => {
      window.engineMock = { mode: 'ok', calls: [], stops: [], terminated: 0, delay: 250, initDelay: 150 };
      window.Worker = class {
        postMessage(message) {
          const state = window.engineMock;
          if (message.type === 'init') {
            if (state.mode === 'init-error') setTimeout(() => this.emit({ type: 'error', message: 'Engine unavailable; reload to retry.' }), 150);
            else setTimeout(() => this.emit({ type: 'ready' }), state.initDelay);
          } else if (message.type === 'stop') {
            state.stops.push(message.id);
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.emit({ type: 'result', id: message.id, move: 'e2e4' }), 50);
          } else if (message.type === 'search') {
            state.calls.push(message);
            const mode = state.mode;
            const black = message.fen.split(' ')[1] === 'b';
            this.timer = setTimeout(() => {
              if (mode === 'validation-error' || mode === 'reply-error' && black) this.emit({ type: 'error', id: message.id, message: 'Engine search timed out. Please retry.' });
              else this.emit({ type: 'result', id: message.id, move: mode === 'malformed' ? 'bad' : mode === 'illegal' ? 'e2e5' : mode === 'mate' ? 'g6g7' : mode === 'capture' ? 'a1a2' : mode === 'promotion' ? 'a7a8n' : black ? 'e7e5' : 'e2e4' });
            }, state.delay);
          }
        }
        emit(data) { if (!this.dead) this.onmessage?.({ data }); }
        terminate() { this.dead = true; clearTimeout(this.timer); window.engineMock.terminated++; }
      };
    });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    return { context, page };
  }
  function helpers(page) {
    const fen = () => page.locator('.board-shell').getAttribute('data-fen');
    const ready = () => page.waitForFunction(() => document.querySelector('[data-engine-status]')?.getAttribute('data-engine-status') === 'ready' && !document.querySelector('.board-status'));
    async function drop(from, to) {
      const a = await page.locator(`[data-square="${from}"]`).boundingBox();
      const b = await page.locator(`[data-square="${to}"]`).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await page.mouse.up();
      // dnd-kit suppresses clicks for 50 ms after a drag. Let that listener
      // detach before clicking toolbar buttons (the engine is still thinking).
      await page.waitForTimeout(75);
    }
    async function start(side = 'w', mode = 'ok', wait = true) {
      await page.goto(base);
      await page.evaluate(mode => { if (window.engineMock) window.engineMock.mode = mode; }, mode);
      if (side === 'b') await page.getByLabel('I play').selectOption('b');
      await page.getByRole('button', { name: 'Start training' }).click();
      if (wait) await ready();
    }
    async function custom(pieces, mode) {
      await page.goto(base);
      await page.evaluate(mode => { window.engineMock.mode = mode; }, mode);
      const occupied = await page.locator('[data-square]:has([data-piece])').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-square')));
      for (const square of occupied) await page.locator(`[data-square="${square}"]`).click({ button: 'right' });
      for (const [piece, square] of pieces) {
        await page.getByRole('button', { name: `Place ${piece}`, exact: true }).click();
        await page.locator(`[data-square="${square}"]`).click();
      }
      await page.getByRole('button', { name: 'Start training' }).click(); await ready();
    }
    return { fen, ready, drop, start, custom };
  }
  try {
    // Real WASM and real nested workers, with networking disabled after startup.
    const live = await makePage();
    verifyDemo(await demonstrateEngine(live.page));
    console.log('PASS real worker stop, reuse, and main-thread responsiveness');
    const h = helpers(live.page);
    await h.start();
    const wasm = await live.page.request.get(`${base}/engine/stockfish-19.0.0/stockfish-19-lite-single.wasm`);
    assert.equal(wasm.status(), 200); assert.match(wasm.headers()['content-type'], /application\/wasm/);
    assert.match(wasm.headers()['cache-control'], /immutable/);
    assert.equal((await live.page.request.post(`${base}/api/eval`, { data: {} })).status(), 404);
    const actions = [];
    live.page.on('request', request => { if (request.resourceType() !== 'websocket') actions.push(request.url()); });
    await live.context.setOffline(true);
    for (let turn = 0; turn < 2; turn++) {
      const before = await h.fen();
      await live.page.getByRole('button', { name: 'Hint', exact: true }).click();
      await live.page.waitForFunction(() => document.querySelector('[data-hint-stage="1"]'));
      await live.page.getByRole('button', { name: 'Hint', exact: true }).click();
      const move = await live.page.locator('.board-shell').getAttribute('data-hint-move');
      assert.match(move, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
      const copy = new Chess(before); copy.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      await h.drop(move.slice(0, 2), move.slice(2, 4));
      await live.page.getByText(`${(turn + 1) * 2} half-moves played`, { exact: false }).waitFor(); await h.ready();
      assert.equal(new Chess(await h.fen()).turn(), 'w');
    }
    assert.deepEqual(actions, [], 'Training must not make network requests');
    await live.page.waitForTimeout(350);
    await live.page.screenshot({ path: '/private/tmp/openreps-desktop.png', fullPage: true });
    await live.context.setOffline(false);
    await h.start('b'); assert.equal(new Chess(await h.fen()).turn(), 'b');
    await live.page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await live.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await live.page.waitForTimeout(350);
    await live.page.screenshot({ path: '/private/tmp/openreps-mobile.png', fullPage: true });
    await live.context.close();
    console.log('PASS real WASM initialization, MIME/cache headers, removed eval endpoint, two offline turns, hints, Black start and mobile');

    const { context, page } = await makePage(true);
    const { fen, ready, drop, start, custom } = helpers(page);
    const mode = value => page.evaluate(value => { window.engineMock.mode = value; }, value);
    const calls = () => page.evaluate(() => window.engineMock.calls);
    const hint = page.getByRole('status', { name: 'Hint' });
    await start(); const initial = await fen();
    await drop('e2', 'e5');
    await page.getByText('That move is not legal in this position.', { exact: true }).waitFor();
    assert.equal((await calls()).length, 0); assert.equal(await hint.textContent(), '');
    for (const failure of ['validation-error', 'malformed', 'illegal']) {
      await mode(failure); await drop('e2', 'e4');
      await page.getByText('Your move was not accepted.', { exact: false }).waitFor();
      assert.equal(await fen(), initial); assert.equal(await hint.textContent(), '');
    }
    await mode('ok'); await drop('d2', 'd4');
    await page.getByLabel('Incorrect move').waitFor(); await ready();
    assert.equal(await fen(), initial);
    const stableHint = await hint.textContent(); assert.match(stableHint, /Consider your opponent/);
    const count = (await calls()).length;
    await drop('g1', 'f3'); await ready();
    assert.equal(await hint.textContent(), stableHint); assert.equal((await calls()).length, count);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    assert.equal(await page.locator('.board-shell').getAttribute('data-hint-piece'), 'e2');
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    assert.equal(await page.locator('.board-shell').getAttribute('data-hint-move'), 'e2e4');
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    assert.equal(await page.locator('.board-shell').getAttribute('data-hint-stage'), '0');
    await mode('reply-error'); await drop('e2', 'e4'); await drop('d2', 'd4');
    await page.getByRole('button', { name: 'Retry engine reply' }).waitFor();
    assert.equal(new Chess(await fen()).turn(), 'b'); assert.equal((await calls()).length, count + 1);
    assert.equal(await hint.textContent(), '');
    await mode('ok'); await page.getByRole('button', { name: 'Retry engine reply' }).click(); await ready();
    assert.equal(new Chess(await fen()).turn(), 'w'); assert.equal((await calls()).length, count + 2);
    console.log('PASS illegal/incorrect moves, engine errors, stable hints, exact cached bestmove, input lock and reply retry');

    await start();
    await page.evaluate(() => { window.engineMock.delay = 1000; });
    // Double clicks in one JS task must be guarded synchronously.
    await page.getByRole('button', { name: 'Hint', exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.waitForFunction(() => window.engineMock.calls.length === 1);
    await drop('e2', 'e4'); await ready();
    assert.ok((await page.evaluate(() => window.engineMock.stops.length)) >= 1);
    assert.equal(new Chess(await fen()).turn(), 'w');
    console.log('PASS rapid hint clicks and hint-to-move cancellation');

    await start(); await page.evaluate(() => { window.engineMock.delay = 1000; });
    await drop('e2', 'e4'); assert.equal(await fen(), initial, 'Never commit before engine validation');
    await page.getByRole('button', { name: 'Setup', exact: true }).click();
    await page.getByRole('button', { name: 'Start training' }).waitFor();
    await page.waitForTimeout(1100);
    assert.ok((await page.evaluate(() => window.engineMock.terminated)) >= 1);
    assert.equal(await page.locator('[data-engine-status]').count(), 0);
    await page.getByRole('button', { name: 'Start training' }).click(); await ready(); assert.equal(await fen(), initial);
    console.log('PASS leaving while thinking terminates engine and ignores old results');

    await start(); await page.evaluate(() => { window.engineMock.delay = 1000; });
    await drop('e2', 'e4');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByText('Engine search paused while this tab was hidden. Please retry.', { exact: true }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await ready(); assert.equal(await fen(), initial);
    await drop('e2', 'e4'); await ready(); assert.equal(new Chess(await fen()).turn(), 'w');
    console.log('PASS tab suspension cancels without committing; retry resumes');

    await page.goto(base);
    await page.evaluate(() => { window.engineMock.initDelay = 750; });
    await page.getByLabel('I play').selectOption('b');
    await page.getByRole('button', { name: 'Start training' }).click();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Retry engine reply' }).waitFor();
    assert.equal((await calls()).length, 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Retry engine reply' }).click(); await ready();
    assert.equal(new Chess(await fen()).turn(), 'b');
    console.log('PASS hiding during initialization defers the automatic opening move');

    await start('w', 'init-error', false);
    await page.getByText('Engine unavailable; reload to retry.', { exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Hint', exact: true }).isDisabled());
    await drop('e2', 'e4'); assert.equal(await fen(), initial); assert.equal((await calls()).length, 0);
    console.log('PASS initialization failure never accepts unchecked moves');

    await page.setViewportSize({ width: 390, height: 844 });
    await custom([['wK','f6'],['wQ','g6'],['bK','h8']], 'mate');
    await drop('g6', 'g1'); await ready(); assert.equal(await hint.textContent(), 'Hint Look for checks.');
    await page.screenshot({ path: '/private/tmp/openreps-hint-mobile.png', fullPage: true });
    await drop('g6', 'g7'); await page.getByText('Training complete — checkmate.', { exact: true }).waitFor();
    assert.equal((await calls()).length, 1); assert.equal(await hint.textContent(), '');
    await custom([['wK','h1'],['wR','a1'],['bP','a2'],['bK','h8']], 'capture');
    await drop('a1', 'b1'); await ready(); assert.equal(await hint.textContent(), 'Hint Look for captures.');
    await custom([['wK','f6'],['bK','h8']], 'ok');
    await page.getByText('Training complete — draw.', { exact: true }).waitFor(); assert.equal((await calls()).length, 0);
    await custom([['wK','h1'],['wP','a7'],['bK','h8']], 'promotion');
    await page.getByLabel('Promotion piece').selectOption('n'); await drop('a7', 'a8');
    await page.getByText('Training complete — draw.', { exact: true }).waitFor();
    assert.equal((await calls()).length, 1); assert.equal(new Chess(await fen()).get('a8').type, 'n');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS mobile hints, checkmate, capture, draw and underpromotion');
    await context.close(); assert.deepEqual(errors, []);
    console.log('PASS no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
