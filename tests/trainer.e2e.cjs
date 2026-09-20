/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test supports NODE_PATH for a bundled Playwright runtime. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
  const page = await browser.newPage({viewport:{width:1000,height:1100}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const base=process.env.TEST_URL || 'http://localhost:3000';
  const fen=()=>page.locator('.board-shell').getAttribute('data-fen');
  async function drop(from,to) {
    const a=await page.locator(`[data-square="${from}"]`).boundingBox();
    const b=await page.locator(`[data-square="${to}"]`).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12}); await page.mouse.up();
  }
  async function ready() { await page.waitForFunction(()=>!document.querySelector('.board-status')); }
  async function start(side='w') {
    await page.goto(base);
    if(side==='b') await page.getByLabel('I play').selectOption('b');
    await page.getByRole('button',{name:'Start training'}).click();
  }
  try {
    await start();
    const liveRequests=[];
    page.on('request',req=>{if(req.url().endsWith('/api/eval')) liveRequests.push(req.postDataJSON().fen);});
    for(let turn=0;turn<(process.env.SKIP_LIVE_EVAL === '1' ? 0 : 2);turn++) {
      const before=await fen();
      const res=await page.request.post(`${base}/api/eval`,{data:{fen:before}});
      assert.equal(res.status(),200,await res.text());
      const {move}=await res.json();
      const next=new Chess(before); next.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
      const startIndex=liveRequests.length;
      await drop(move.slice(0,2),move.slice(2,4));
      await page.waitForFunction(n=>document.querySelector('.trainer-bar')?.parentElement?.textContent.includes(`${n} half-moves played`),(turn+1)*2,{timeout:25000});
      await ready();
      assert.deepEqual(liveRequests.slice(startIndex),[before,next.fen()]);
      assert.equal(new Chess(await fen()).turn(),'w');
      console.log(`PASS live turn ${turn+1}: ${move}, automatic engine reply, user control restored`);
    }
    await page.waitForTimeout(350);
    await page.screenshot({path:'/private/tmp/openreps-desktop.png',fullPage:true});
    let mode='wrong', calls=[];
    await page.route('**/api/eval',async route=>{
      const position=route.request().postDataJSON().fen; calls.push(position);
      const black=new Chess(position).turn()==='b';
      if(mode==='validation-error' || mode==='reply-error' && black) return route.fulfill({status:404,json:{error:'No cloud evaluation is available.'}});
      if(mode==='malformed') return route.fulfill({status:200,body:'not json'});
      await new Promise(resolve=>setTimeout(resolve,250));
      return route.fulfill({json:{move:mode==='mate'?'g6g7':mode==='quiet-queen'?'g6g1':mode==='capture'?'a1a2':mode==='promotion'?'a7a8n':black?'e7e5':'e2e4'}});
    });
    await start();
    const initial=await fen();
    const hint=page.getByRole('status',{name:'Hint'});
    const fallback='Consider your opponent’s threats and your available options.';
    assert.equal(await hint.textContent(),'');
    await drop('e2','e5');
    await page.getByText('That move is not legal in this position.',{exact:true}).waitFor();
    assert.equal(await hint.textContent(),''); assert.equal(calls.length,0);
    mode='validation-error';
    await drop('d2','d4');
    await page.getByText('Your move was not accepted.',{exact:false}).waitFor();
    assert.equal(await hint.textContent(),'');
    mode='wrong'; calls=[];
    await drop('d2','d4');
    await page.getByLabel('Incorrect move').waitFor();
    assert.equal(await fen(),initial); assert.equal(calls.length,1);
    assert.equal(await hint.textContent(),`Hint ${fallback}`);
    await drop('g1','f3'); await ready();
    assert.equal(await hint.textContent(),`Hint ${fallback}`);
    await drop('e2','e5');
    await page.getByText('That move is not legal in this position.',{exact:true}).waitFor();
    assert.equal(await hint.textContent(),`Hint ${fallback}`);
    console.log('PASS wrong move snaps back with red X');
    for(const failure of ['validation-error','malformed']) {
      mode=failure; await drop('e2','e4');
      await page.getByText('Your move was not accepted.',{exact:false}).waitFor();
      assert.equal(await fen(),initial);
      assert.equal(await hint.textContent(),`Hint ${fallback}`);
    }
    console.log('PASS validation failures never accept user move');
    mode='reply-error'; calls=[];
    await drop('e2','e4');
    await drop('d2','d4'); // Duplicate drag while locked must not start another request.
    await page.getByRole('button',{name:'Retry engine reply'}).waitFor();
    assert.equal(await hint.textContent(),'');
    assert.equal(calls.length,2); assert.equal(new Chess(await fen()).turn(),'b');
    mode='ok';
    await page.getByRole('button',{name:'Retry engine reply'}).click(); await ready();
    assert.equal(new Chess(await fen()).turn(),'w'); assert.equal(calls.length,3);
    assert.equal(await hint.textContent(),'');
    console.log('PASS hint lifecycle: illegal moves, failures, repeated mistakes, and accepted move');
    console.log('PASS duplicate input blocked; failed reply retries without replaying user move');
    await start('b');
    await page.waitForFunction(()=>document.querySelector('[data-fen]')?.getAttribute('data-fen')?.split(' ')[1]==='b'); await ready();
    assert.ok((await fen()).includes('4P3'));
    console.log('PASS engine opens automatically when user plays Black');
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.waitForTimeout(350);
    await page.screenshot({path:'/private/tmp/openreps-mobile.png',fullPage:true});
    async function custom(pieces) {
      await page.goto(base);
      const occupied=await page.locator('[data-square]:has([data-piece])').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-square')));
      for (const square of occupied) await page.locator(`[data-square="${square}"]`).click({button:'right'});
      for (const [piece,square] of pieces) {
        await page.getByRole('button',{name:`Place ${piece}`,exact:true}).click();
        await page.locator(`[data-square="${square}"]`).click();
      }
      await page.getByRole('button',{name:'Start training'}).click();
    }
    mode='mate'; calls=[];
    await custom([['wK','f6'],['wQ','g6'],['bK','h8']]);
    await drop('g6','g1'); await ready();
    assert.equal(await hint.textContent(),'Hint Look for checks.');
    mode='quiet-queen';
    await drop('g6','f5'); await ready();
    assert.equal(await hint.textContent(),'Hint Look for checks.');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:'/private/tmp/openreps-hint-mobile.png',fullPage:true});
    mode='mate'; calls=[];
    await drop('g6','g7');
    await page.getByText('Training complete — checkmate.',{exact:true}).waitFor();
    assert.equal(calls.length,1);
    assert.equal(await hint.textContent(),'');
    console.log('PASS mating user move ends session without querying reply');
    mode='capture';
    await custom([['wK','h1'],['wR','a1'],['bP','a2'],['bK','h8']]);
    await drop('a1','b1'); await ready();
    assert.equal(await hint.textContent(),'Hint Look for captures.');
    await page.getByRole('button',{name:'Setup',exact:true}).click();
    assert.equal(await page.locator('.hint-card').count(),0);
    await page.getByRole('button',{name:'Start training'}).click();
    assert.equal(await hint.textContent(),'');
    console.log('PASS conceptual checks, captures, stable hints, and session reset');
    calls=[];
    await custom([['wK','f6'],['bK','h8']]);
    await page.getByText('Training complete — draw.',{exact:true}).waitFor();
    assert.equal(calls.length,0);
    mode='promotion'; calls=[];
    await custom([['wK','h1'],['wP','a7'],['bK','h8']]);
    await page.getByLabel('Promotion piece').selectOption('n');
    await drop('a7','a8');
    await page.getByText('Training complete — draw.',{exact:true}).waitFor();
    assert.equal(calls.length,1);
    assert.equal(new Chess(await fen()).get('a8').type,'n');
    console.log('PASS game-over start and underpromotion handling');
    assert.deepEqual(errors,[]);
    console.log('PASS mobile layout and no browser errors');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
