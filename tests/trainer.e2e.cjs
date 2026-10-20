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
    const context = await browser.newContext({ viewport: { width: 1000, height: 1100 }, hasTouch: true });
    if (mock) await context.addInitScript(() => {
      window.engineMock = { mode: 'ok', calls: [], stops: [], terminated: 0, delay: 250, initDelay: 150, script: [], replies: [] };
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
              else this.emit({ type: 'result', id: message.id, move: message.multiPV > 1 && state.replies.length ? state.replies.shift() : mode === 'scripted' ? state.script.shift() : mode === 'malformed' ? 'bad' : mode === 'illegal' ? 'e2e5' : mode === 'mate' ? 'g6g7' : mode === 'capture' ? 'a1a2' : mode === 'promotion' ? 'a7a8n' : black ? 'e7e5' : message.fen.includes('4P3') ? 'g1f3' : 'e2e4' });
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
      await page.locator('.board-shell').scrollIntoViewIfNeeded();
      const a = await page.locator(`[data-square="${from}"]`).boundingBox();
      const b = await page.locator(`[data-square="${to}"]`).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await page.mouse.up();
      // dnd-kit suppresses clicks for 50 ms after a drag. Let that listener
      // detach before clicking toolbar buttons (the engine is still thinking).
      await page.waitForTimeout(75);
    }
    async function start(side = 'w', mode = 'ok', wait = true, replyMoves = [], playerMoves = []) {
      await page.goto(base);
      await page.evaluate(mode => { if (window.engineMock) window.engineMock.mode = mode; }, mode);
      await page.evaluate(({ replyMoves, playerMoves }) => { if (window.engineMock) { window.engineMock.script = playerMoves; window.engineMock.replies = replyMoves.map(move => typeof move === 'string' ? move : move.uci); } }, { replyMoves, playerMoves });
      if (side === 'b') await page.getByLabel('I play').selectOption('b');
      await page.getByRole('button', { name: 'Start training' }).click();
      if (wait) await ready();
    }
    async function custom(pieces, mode, { side = 'w', playerMoves = [], replyMoves = [], disabledRights = [] } = {}) {
      await page.goto(base);
      await page.evaluate(mode => { window.engineMock.mode = mode; }, mode);
      const occupied = await page.locator('[data-square]:has([data-piece])').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-square')));
      for (const square of occupied) await page.locator(`[data-square="${square}"]`).click({ button: 'right' });
      for (const [piece, square] of pieces) {
        await page.getByRole('button', { name: `Place ${piece[0] === 'w' ? 'White' : 'Black'} ${{ K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' }[piece[1]]}`, exact: true }).click();
        await page.locator(`[data-square="${square}"]`).click();
      }
      await page.getByLabel('I play').selectOption(side);
      await page.getByLabel('Side to move').selectOption(side);
      for (const label of disabledRights) await page.getByLabel(label, { exact: true }).uncheck();
      await page.evaluate(({ playerMoves, replyMoves }) => {
        window.engineMock.script = playerMoves;
        window.engineMock.replies = replyMoves;
      }, { playerMoves, replyMoves });
      await page.getByRole('button', { name: 'Start training' }).click(); await ready();
    }
    return { fen, ready, drop, start, custom };
  }
  try {
    // Real WASM and real nested workers, with all training network access disabled.
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
      await live.page.waitForFunction(plies => document.querySelector('.session-progress')?.value === plies, (turn + 1) * 2); await h.ready();
      assert.equal(new Chess(await h.fen()).turn(), 'w');
    }
    assert.deepEqual(actions, [], 'Training must remain entirely local');
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
    const tap = square => page.locator(`[data-square="${square}"]`).tap();
    const tapMove = async (from, to) => { await tap(from); await tap(to); };
    const selected = () => page.locator('[data-selected="true"]').count();
    const shot = name => page.screenshot({ path: `/private/tmp/openreps-${name}.png`, fullPage: true });
    await start('b', 'ok', true, [{ uci: 'e2e4', count: 25 }]);
    await page.waitForFunction(() => document.querySelector('.board-shell')?.getAttribute('data-fen')?.includes('4P3'));
    assert.equal((await calls()).length, 1, 'Starting as Black should search opponent candidates');
    assert.equal((await calls())[0].multiPV, 5);
    await start('w', 'ok', true, ['c7c5']);
    await drop('e2', 'e4'); await ready();
    assert.match(await fen(), /2p5/);
    assert.deepEqual((await calls()).map(call => call.multiPV), [1, 5]);
    assert.deepEqual(await page.locator('.move-pairs li').allTextContents(), ['1.e4c5']);
    assert.equal(await page.locator('.latest-move').textContent(), 'c5');
    console.log('PASS local opponent search and exact player validation');
    const castlePieces = [['wK','e1'],['wR','a1'],['wR','h1'],['bK','e8'],['bR','a8'],['bR','h8']];
    for (const [side, from, to, rook, rookTo, replyMove, useTap] of [
      ['w','e1','g1','h1','f1','e8c8',false],
      ['w','e1','c1','a1','d1','e8g8',true],
      ['b','e8','g8','h8','f8','e1c1',true],
      ['b','e8','c8','a8','d8','e1g1',false],
    ]) {
      await custom(castlePieces, 'scripted', { side, playerMoves: [from + rook], replyMoves: [replyMove] });
      assert.equal((await fen()).split(' ')[2], 'KQkq');
      if (useTap) await tapMove(from, rook); else await drop(from, to);
      await ready();
      const result = new Chess(await fen());
      assert.equal(result.get(to)?.type, 'k');
      assert.equal(result.get(rookTo)?.type, 'r');
      assert.equal(result.get(from), undefined);
      assert.equal(result.get(rook), undefined);
      assert.equal(result.fen().split(' ')[2], '-');
      assert.equal(await page.locator('.move-pairs li').count(), side === 'w' ? 1 : 2);
      assert.match((await page.locator('.move-pairs li').allTextContents()).join(' '), /O-O/);
    }
    await custom(castlePieces, 'scripted', { disabledRights: ['White kingside'] });
    const noCastle = await fen();
    assert.equal(noCastle.split(' ')[2], 'Qkq');
    await drop('e1', 'g1');
    await page.getByText('That move is not legal in this position.', { exact: true }).waitFor();
    assert.equal(await fen(), noCastle);
    assert.equal((await calls()).length, 0);
    console.log('PASS custom castling rights, all four castles, rook taps, engine normalization and disabled rights');
    const depthLine = ['g1f3','b8a6','f3g1','d7d6','g1f3','d6d5','h2h4','f7f6','b1c3','a6b8','g2g3','g7g5','c3b5','b8c6','b5a7','d8d7','f3d4','f6f5','a2a4','h7h5'];
    async function reachDepth(side) {
      const playerMoves = depthLine.filter((_, index) => index % 2 === (side === 'w' ? 0 : 1));
      const replyMoves = depthLine.filter((_, index) => index % 2 === (side === 'w' ? 1 : 0));
      await start(side, 'scripted', true, replyMoves, playerMoves);
      for (let turn = 0; turn < 10; turn++) {
        const uci = playerMoves[turn];
        await drop(uci.slice(0, 2), uci.slice(2, 4));
        await ready();
      }
      await page.getByRole('dialog', { name: 'Good depth reached' }).waitFor();
      assert.equal(await page.getByRole('progressbar', { name: 'Half-moves practiced' }).getAttribute('value'), '20');
      assert.equal((await calls()).length, 20);
      assert.equal(await page.locator('.move-pairs li').count(), 10);
      assert.equal(await page.locator('.latest-move').textContent(), 'h5');
      return { requestCount: (await calls()).filter(call => call.multiPV > 1).length, fen: await fen() };
    }
    const depthWhite = await reachDepth('w');
    const completionDialog = page.getByRole('dialog', { name: 'Good depth reached' });
    await completionDialog.getByRole('button', { name: 'Practice different lines' }).focus();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Practice different lines');
    await page.keyboard.press('Escape'); await completionDialog.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Setup', exact: true }).evaluate(button => document.activeElement === button), true);
    assert.equal(await page.getByRole('button', { name: 'Hint', exact: true }).isDisabled(), true);
    assert.equal(await fen(), depthWhite.fen);
    await page.getByRole('button', { name: 'Setup', exact: true }).click();
    await page.getByRole('button', { name: 'Start training' }).waitFor();
    const depthBlack = await reachDepth('b');
    assert.equal(depthBlack.requestCount, 10, 'The final player move must not request another opponent reply');
    await page.getByRole('dialog', { name: 'Good depth reached' }).getByRole('button', { name: 'Practice different lines' }).click();
    await page.getByRole('button', { name: 'Start training' }).waitFor();
    console.log('PASS 20-ply cap, completion dialog, keyboard dismissal, locked review, and return to setup');
    async function layout(width) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(350);
      await page.locator('.board-shell').waitFor({ state: 'visible' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
      const board = await page.locator('.board-shell').boundingBox();
      assert.ok(Math.abs(board.width - board.height) < 2, `Square board at ${width}`);
      for (const control of await page.locator('.app-main button:visible, .app-main select:visible').all()) {
        const box = await control.boundingBox();
        assert.ok(box.height >= 44, `Touch target height at ${width}`);
        assert.ok(box.width >= 44, `Touch target width at ${width}`);
      }
    }

    await page.goto(base);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Remove pieces', exact: true }).tap();
    await page.waitForFunction(() => document.querySelector('.remove-toggle').getAttribute('aria-pressed') === 'true');
    await tap('e1'); await tap('e3');

    assert.equal(await page.locator('[data-square="e1"] [data-piece]').count(), 0);
    await page.getByRole('button', { name: 'Start training' }).tap();
    await page.getByRole('alert').getByText('Training positions need exactly one white king and one black king.').waitFor();
    await page.getByRole('button', { name: 'Place White King', exact: true }).tap();
    assert.equal(await page.getByRole('button', { name: 'Remove pieces', exact: true }).getAttribute('aria-pressed'), 'false');
    await tap('e1');
    await page.locator('[data-square="e1"] [data-piece="wK"]').waitFor();
    await page.getByLabel('I play').selectOption('b');
    await page.getByLabel('Side to move').selectOption('b');
    await page.getByRole('button', { name: 'Remove pieces', exact: true }).tap();
    await page.getByRole('button', { name: 'Reset position', exact: true }).tap();
    assert.equal(await page.getByLabel('I play').inputValue(), 'b');
    assert.equal(await page.getByLabel('Side to move').inputValue(), 'w');
    assert.equal(await page.getByRole('button', { name: 'Remove pieces', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.locator('.error-message').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-square] [data-piece]').count(), 32);
    const blackBottom = await page.locator('[data-square="e8"]').boundingBox();
    const whiteTop = await page.locator('[data-square="e1"]').boundingBox();
    assert.ok(blackBottom.y > whiteTop.y, 'Reset retains Black orientation');
    for (const width of [1440, 1000, 768, 390, 320]) {
      await layout(width); await shot(`setup-${width}`);
    }
    await page.keyboard.press('Tab');
    await page.getByRole('button', { name: 'Start training' }).focus();
    assert.equal(await page.getByRole('button', { name: 'Start training' }).evaluate(button => getComputedStyle(button).outlineStyle), 'solid');
    console.log('PASS touch editing, validation, reset, orientation and setup layouts');

    await start(); const tapInitial = await fen();
    await tap('e2'); assert.equal(await selected(), 1);
    await tap('e2'); assert.equal(await selected(), 0);
    await tap('e2'); await tap('d2');
    assert.equal(await page.locator('[data-square="d2"] [data-selected="true"]').count(), 1);
    await tap('d5');
    await page.getByText('That move is not legal in this position.', { exact: true }).waitFor();
    assert.equal(await selected(), 0); assert.equal((await calls()).length, 0);
    await tapMove('d2', 'd4'); await ready();
    assert.equal(await fen(), tapInitial); assert.equal(await selected(), 0);
    assert.match(await hint.textContent(), /Consider your opponent/);
    await shot('incorrect-hint');
    await page.getByRole('button', { name: 'Hint', exact: true }).tap();
    await tap('e2');
    assert.equal(await page.locator('[data-square="e2"] [data-selected="true"][data-highlighted="true"]').count(), 1);
    await tap('e2');
    await mode('reply-error'); await tapMove('e2', 'e4');
    await page.getByRole('button', { name: 'Retry opponent reply' }).waitFor();
    await shot('retry');
    await mode('ok'); await page.getByRole('button', { name: 'Retry opponent reply' }).tap(); await ready();
    const tapResult = await fen();
    await start(); await drop('e2', 'e4'); await ready();
    assert.equal(await fen(), tapResult, 'Tap and drag have equivalent validated outcomes');
    for (const width of [1440, 1000, 768, 390, 320]) {
      await layout(width); await shot(`ready-${width}`);
    }
    await start(); await page.evaluate(() => { window.engineMock.delay = 1000; });
    await page.getByRole('button', { name: 'Hint', exact: true }).tap();
    await tapMove('e2', 'e4'); assert.equal(await selected(), 0);
    await ready(); assert.equal(await fen(), tapInitial); assert.equal((await calls()).length, 1);
    await start(); await page.evaluate(() => { window.engineMock.delay = 3000; });
    await tapMove('e2', 'e4');
    assert.equal(await fen(), tapInitial, 'Tap does not commit before validation');
    await tapMove('d2', 'd4');
    await shot('thinking'); await ready(); assert.equal(new Chess(await fen()).turn(), 'w');
    assert.equal((await calls()).length, 2, 'Busy taps do not queue a move');
    await start('b'); await tapMove('e7', 'e5'); await ready();
    assert.equal(new Chess(await fen()).turn(), 'b');
    assert.equal(new Chess(await fen()).get('e5').color, 'b');
    await start('w', 'validation-error'); await tapMove('e2', 'e4');
    await page.getByText('Your move was not accepted.', { exact: false }).waitFor();
    assert.equal(await fen(), tapInitial);
    await mode('ok'); await tapMove('e2', 'e4'); await ready();
    await custom([['wK','h1'],['wP','a7'],['bK','h8']], 'promotion');
    await page.getByLabel('Promotion piece').selectOption('n'); await tapMove('a7', 'a8');
    await page.getByText('Training complete — draw.', { exact: true }).waitFor();
    assert.equal(new Chess(await fen()).get('a8').type, 'n');
    await page.waitForTimeout(350); await shot('complete');
    await tap('h1'); assert.equal(await selected(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.status-dot').evaluate(dot => getComputedStyle(dot).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('PASS tap input, hints, underpromotion, Black, input locks, retries and training layouts');

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
    await page.getByRole('button', { name: 'Retry opponent reply' }).waitFor();
    assert.equal(new Chess(await fen()).turn(), 'b'); assert.equal((await calls()).length, count + 1);
    assert.equal(await hint.textContent(), '');
    await mode('ok'); await page.getByRole('button', { name: 'Retry opponent reply' }).click(); await ready();
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
    await page.getByRole('button', { name: 'Retry opponent reply' }).waitFor();
    assert.equal((await calls()).length, 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Retry opponent reply' }).click(); await ready();
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
    await start();
    await page.locator('.board-shell').scrollIntoViewIfNeeded();
    const touchFrom = await page.locator('[data-square="e2"]').boundingBox();
    const touchTo = await page.locator('[data-square="e4"]').boundingBox();
    const cdp = await context.newCDPSession(page);
    const point = fraction => ({ x: touchFrom.x + touchFrom.width / 2 + (touchTo.x - touchFrom.x) * fraction, y: touchFrom.y + touchFrom.height / 2 + (touchTo.y - touchFrom.y) * fraction });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0)] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(step / 10)] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ready();
    assert.equal(await fen(), tapResult, 'Touch drag has the same outcome as mouse drag and taps');
    assert.equal(await selected(), 0);
    await cdp.detach();
    console.log('PASS touch dragging remains compatible with tap input');
    await context.close(); assert.deepEqual(errors, []);
    console.log('PASS no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
