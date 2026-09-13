'use strict';
// Desktop/phone entry, navigation, keyboard dialogs, social crawlers and offline shell.
// HOME_REVIEW_URL runs the same interactions on production in disposable storage.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || require.resolve('playwright-core', {paths: [process.cwd(), path.resolve(__dirname, '../../war-survival')]}));
const root = path.resolve(__dirname, '..'), out = process.env.HOME_REVIEW_DIR || path.resolve(root, '../../dino-perimeter-review/home1670');
fs.mkdirSync(out, {recursive: true});
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.wasm':'application/wasm'};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname, file = path.resolve(root, '.' + pathname.replace(/\/$/, '/index.html'));
  if (path.relative(root, file).startsWith('..')) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
let browser;
const errors = [], report = {layouts: [], dialogs: [], errors};
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.HOME_REVIEW_URL || 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader']});
  async function context(options = {}) {
    const context = await browser.newContext({serviceWorkers: 'block', ...options});
    await context.route('https://www.googletagmanager.com/**', r => r.abort());
    await context.route('https://**.google-analytics.com/**', r => r.abort());
    return context;
  }
  const desktop = await context({viewport: {width: 1440, height: 1000}}), p = await desktop.newPage();
  p.on('pageerror', error => errors.push(error.message));
  await p.goto(base); await p.evaluate(() => { save.settings.mute = true; });
  await p.evaluate(() => Creatures.ready(MENU_BOSSES));
  for (const [width, height] of [[1440,1000], [1280,720], [768,1024], [390,844], [360,800], [320,568], [844,390]]) {
    await p.setViewportSize({width, height});
    await p.evaluate(() => { document.getElementById('menu').scrollTo({top:0,behavior:'instant'}); });
    await p.waitForTimeout(100);
    const layout = await p.evaluate(() => {
      const menu = document.getElementById('menu'), cta = document.getElementById('btnQuickPlay').getBoundingClientRect();
      const controls = [...document.querySelectorAll('.home-header button')].map(b => ({id:b.id, width:b.getBoundingClientRect().width, height:b.getBoundingClientRect().height, name:b.getAttribute('aria-label') || b.textContent.trim()}));
      return {width:innerWidth, height:innerHeight, overflow:menu.scrollWidth > menu.clientWidth, ctaTop:cta.top, ctaBottom:cta.bottom, controls, cards:document.querySelectorAll('#levelCards button').length};
    });
    assert.equal(layout.overflow, false, JSON.stringify(layout)); assert.equal(layout.cards, 7);
    if (height > 500) assert.ok(layout.ctaTop >= 0 && layout.ctaBottom < height, 'Play is visible without scrolling at ' + width);
    assert.ok(layout.controls.every(b => b.name && b.width >= 40 && b.height >= 44));
    await p.screenshot({path:path.join(out, `home-${width}x${height}.png`)});
    await p.locator('.browse-zones').click(); await p.waitForTimeout(350);
    await p.screenshot({path:path.join(out, `zones-${width}x${height}.png`)});
    assert.equal(await p.locator('#zones').evaluate(el => el.getBoundingClientRect().top < 100), true);
    report.layouts.push(layout);
  }
  console.log('PASS: seven desktop/tablet/phone layouts, visible Play, named touch targets and no horizontal overflow.');
  await p.setViewportSize({width:390,height:844});
  await p.evaluate(() => { document.getElementById('menu').scrollTo({top:0,behavior:'instant'}); });
  for (const [button, dialog] of [['btnLab','lab'], ['btnStickers','stickers'], ['btnStudio','studio'], ['btnAch','achievements'], ['btnTips','tips'], ['btnSettings','settings'], ['verChip','changelog']]) {
    await p.locator('#' + button).click();
    await p.waitForFunction(id => document.getElementById(id).contains(document.activeElement), dialog);
    assert.equal(await p.locator('#' + dialog).getAttribute('aria-modal'), 'true');
    for (let i = 0; i < 16; i++) await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(id => document.getElementById(id).contains(document.activeElement), dialog), true);
    await p.screenshot({path:path.join(out, dialog + '-phone.png')});
    await p.keyboard.press('Escape');
    await p.waitForFunction(id => document.activeElement.id === id, button);
    assert.equal(await p.locator('#menu').evaluate(el => el.inert), false);
    report.dialogs.push(dialog);
  }
  console.log('PASS: all seven menus open; keyboard focus stays inside and Escape returns to the opener.');
  await p.locator('#sceneToggle').click(); assert.equal(await p.locator('#menu').getAttribute('data-scene'), 'day');
  assert.equal(await p.locator('#sceneToggle').getAttribute('aria-label'), 'Switch to night ambience');
  await p.locator('#sceneToggle').click();
  await p.locator('#diffPick summary').click(); await p.locator('#diffInput').fill('999'); await p.locator('#diffInput').press('Tab');
  assert.equal(await p.locator('#diffInput').inputValue(), '10');
  await p.locator('#diffInput').fill('2'); await p.locator('#diffInput').press('Tab');
  await p.locator('#diffPick summary').press('Escape');
  await p.locator('.levelCard[data-zone="2"]').focus(); await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => G.levelIdx), 2); assert.equal(await p.evaluate(() => G.difficulty), 2);
  await p.locator('#btnMenu').click();
  await p.evaluate(() => { save.run = null; buildMenu(); });
  await p.locator('#btnQuickPlay').click(); assert.equal(await p.evaluate(() => G.levelIdx), 0);
  await p.evaluate(() => { G.paused = true; placeTower('flamer',250,235); G.cash = 0; saveRun(); });
  await p.locator('#btnMenu').click(); assert.equal(await p.locator('#quickPlayLabel').innerText(), 'Continue run');
  assert.match(await p.locator('#quickPlayHint').innerText(), /Wave 0\/100/);
  // Cancelling a new location must leave the saved run and Continue action intact.
  p.once('dialog', d => d.dismiss());
  await p.evaluate(() => { save.run.wave = 1; buildMenu(); });
  await p.locator('.levelCard[data-zone="1"]').click(); assert.equal(await p.evaluate(() => G.state), 'menu');
  await p.evaluate(() => { save.run.wave = 0; buildMenu(); });
  await p.locator('#btnQuickPlay').click();
  assert.equal(await p.evaluate(() => G.towers.length), 1); assert.equal(await p.evaluate(() => G.cash), 0);
  assert.ok(await p.evaluate(() => G.autoTimer > 0));
  await p.evaluate(() => { G.paused = false; }); await p.waitForFunction(() => G.wave === 1 && G.waveActive);
  await p.evaluate(() => { G.paused = true; });
  console.log('PASS: keyboard zone entry, difficulty limits, Play/Continue, saved-run cancellation and zero-cash resume.');
  await p.locator('#btnMenu').click();
  await p.evaluate(() => { Object.defineProperty(navigator,'share',{configurable:true,value:undefined}); Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text => { window.copiedGameLink = text; }}}); });
  await p.locator('#btnShare').click(); assert.equal(await p.evaluate(() => window.copiedGameLink), 'https://vibecodingmatt.github.io/dino-defense/');
  await p.evaluate(() => { Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async () => { throw Error('denied'); }}}); });
  await p.locator('#btnShare').click(); await p.locator('#copyGameLink').click();
  assert.match(await p.locator('#copyLinkStatus').innerText(), /Select and copy/); await p.keyboard.press('Escape');
  await p.evaluate(() => { Object.defineProperty(navigator,'share',{configurable:true,value:async data => { window.nativeShareData = data; }}); });
  await p.locator('#btnShare').click(); assert.equal(await p.evaluate(() => window.nativeShareData.url), 'https://vibecodingmatt.github.io/dino-defense/');
  await p.evaluate(() => { Object.defineProperty(navigator,'share',{configurable:true,value:async () => { throw new DOMException('cancelled','AbortError'); }}); });
  await p.locator('#btnShare').click(); assert.equal(await p.locator('#shareDialog').isVisible(), false);
  console.log('PASS: native sharing, copy-link fallback, clipboard denial and native-share cancellation.');
  await desktop.close();
  const touch = await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}), mobile = await touch.newPage();
  mobile.on('pageerror', error => errors.push(error.message)); await mobile.goto(base);
  const clock = await mobile.evaluate(() => menuT); await mobile.waitForTimeout(200); assert.equal(await mobile.evaluate(() => menuT), clock);
  await mobile.locator('#btnSettings').tap(); await mobile.locator('#optSceneMotion').check(); await mobile.locator('#setClose').tap();
  await mobile.waitForTimeout(150); assert.ok(await mobile.evaluate(() => menuT) > clock);
  await mobile.reload(); assert.equal(await mobile.evaluate(() => menuScenePaused), false);
  await mobile.locator('#btnQuickPlay').tap(); assert.equal(await mobile.evaluate(() => G.state), 'playing');
  await touch.close();
  console.log('PASS: real touch Play, reduced-motion scenery clock and persisted animation preference.');
  const crawler = await context({javaScriptEnabled:false}), bot = await crawler.newPage(); await bot.goto(base);
  report.metadata = await bot.evaluate(() => ({title:document.title, canonical:document.querySelector('link[rel="canonical"]').href, og:[...document.querySelectorAll('meta[property^="og:"]')].map(m=>[m.getAttribute('property'),m.content]), twitter:document.querySelector('meta[name="twitter:card"]').content, schema:JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)}));
  const og = Object.fromEntries(report.metadata.og);
  assert.equal(report.metadata.twitter, 'summary_large_image'); assert.equal(og['og:image:width'],'1200'); assert.equal(og['og:image:height'],'630'); assert.ok(og['og:image:alt']);
  assert.equal(report.metadata.schema.name, 'Dino Defense'); assert.equal(og['og:url'],report.metadata.canonical);
  const imagePath = new URL(og['og:image']).pathname.split('/dino-defense/')[1], imageResponse = await bot.request.get(base + imagePath);
  assert.equal(imageResponse.status(),200); assert.match(imageResponse.headers()['content-type'],/image\/jpeg/);
  const dimensions = await bot.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); return [image.naturalWidth,image.naturalHeight]; }, base + imagePath);
  assert.deepEqual(dimensions,[1200,630]); assert.ok((await imageResponse.body()).length < 400000);
  await crawler.close(); console.log('PASS: social title, descriptions, canonical, large card, structured data and 1200×630 JPEG without JavaScript.');
  const offline = await context({serviceWorkers:'allow'}), op = await offline.newPage(); op.on('pageerror', error => errors.push(error.message)); await op.goto(base);
  await op.evaluate(() => navigator.serviceWorker.ready); await op.waitForFunction(() => !!navigator.serviceWorker.controller);
  await offline.setOffline(true); await op.reload();
  await op.locator('#btnSettings').click(); await op.keyboard.press('Escape');
  assert.equal(await op.locator('#btnQuickPlay').isVisible(),true);
  const assets = await op.evaluate(async () => { const names = await caches.keys(), cache = await caches.open(names.find(n => n.startsWith('dino-defense-'))); return Promise.all(['home.css','js/home.js','icons/interface.svg','icons/favicon.svg'].map(async file => !!await cache.match(file))); });
  assert.ok(assets.every(Boolean)); await op.screenshot({path:path.join(out,'offline-home.png')});
  await offline.close(); assert.deepEqual(errors,[]);
  console.log('PASS: offline homepage, icons and working dialogs; zero browser errors.');
  report.base=base; report.checkedAt=new Date().toISOString(); fs.writeFileSync(path.join(out,'homepage-verification.json'),JSON.stringify(report,null,2));
})().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => { await browser?.close(); server.close(); });
