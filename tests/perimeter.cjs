'use strict';
/* Run with node tests/perimeter.cjs. Uses an installed playwright-core and
   Chrome; the game itself still has no package manager or build step. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || require.resolve('playwright-core', {
  paths: [process.cwd(), path.resolve(__dirname, '../../war-survival')],
}));
const root = path.resolve(__dirname, '..');
const LEVELS_LENGTH = 7;
const out = process.env.PERIMETER_REVIEW_DIR || path.resolve(root, '../../dino-perimeter-review');
fs.mkdirSync(out, {recursive:true});
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (path.relative(root,file).startsWith('..')) return res.writeHead(403).end();
  try {
    const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.wasm':'application/wasm'};
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
let browser;
const errors = [];
const results = [];
const pass = (test, detail) => { results.push({test,detail}); console.log('PASS:',test,detail || ''); };
const monitor = page => page.on('pageerror',e => errors.push(e.message));
async function freeze(page) { await page.evaluate(() => {G.state='review';G.paused=false;G.time=6;G.sceneTime=6;render(0);}); }
async function snap(page,name) {await page.screenshot({path:path.join(out,name+'.png')});}

(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context = await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});
  await context.route('https://**/*',route=>route.abort());
  const page = await context.newPage();monitor(page);
  await page.goto(base);
  await page.waitForFunction(() => PerimeterScene.ready);
  await page.locator('#levelCards .levelCard:not(.resume)').first().click();
  await freeze(page);
  await page.locator('#game').screenshot({path:path.join(out,'sector7-final-map.png')});
  await snap(page,'sector7-desktop');
  assert.equal(await page.evaluate(()=>G.perimeterScene.painted),true);
  pass('Menu deployment loads the painted scene and live paddock');

  const routing = await page.evaluate(() => {
    const pts=LEVELS[0].paths[0];
    return {points:pts.map(p=>[p.x,p.y]),blocked:canPlace(500,250),yard:canPlace(120,495),control:canPlace(1150,460),
      pads:[[250,235],[350,260],[630,380],[800,300],[900,490],[480,490]].map(([x,y])=>canPlace(x,y)),
      road:canPlace(500,430)};
  });
  assert.deepEqual(routing.points,[[-40,150],[300,150],[300,430],[700,430],[700,180],[1000,180],[1000,560],[1320,560]]);
  assert.equal(routing.blocked,false);assert.equal(routing.yard,false);assert.equal(routing.control,false);assert.equal(routing.road,false);
  assert.ok(routing.pads.every(Boolean));
  pass('All original route coordinates preserved; facilities blocked and six tactical positions open');

  // Use real mouse/keyboard input to place the first defense and trigger wave 1.
  await page.evaluate(()=>{G.state='playing';G.paused=false;});
  await page.keyboard.press('Digit1');
  const b=await page.locator('#game').boundingBox();
  await page.mouse.click(b.x+350/1280*b.width,b.y+260/720*b.height);
  await page.waitForFunction(()=>G.towers.length===1);
  const battle=await page.evaluate(()=>{
    G.state='review';G.paused=false;save.settings.invincible=true;
    G.cash=10000;placeTower('flamer',630,380,true);placeTower('missile',800,300,true);placeTower('mortar',900,490,true);
    for(let i=0;i<1000;i++)step(.05);
    render(0);return {wave:G.wave,active:G.waveActive,kills:G.stat.kills,towers:G.towers.length,error:document.querySelector('#errbox').textContent};
  });
  assert.equal(battle.towers,4);assert.ok(battle.wave>=1);assert.ok(battle.kills>0);assert.equal(battle.error,'');
  await page.locator('#game').screenshot({path:path.join(out,'sector7-combat.png')});
  pass('Mouse placement, first-wave countdown and 50 seconds of combat',battle);

  const saveCheck=await page.evaluate(()=>{
    G.towers.push({key:'gatling',x:450,y:260,ulv:1,invested:500,mode:'first',cd:0,angle:0,flash:0});
    saveRun();const before=save.run.towers.map(t=>[t.key,t.x,t.y,t.ulv,t.invested]);const cash=save.run.cash,wave=save.run.wave;
    startLevel(0,'resume');G.state='review';render(0);
    return {before,after:G.towers.map(t=>[t.key,t.x,t.y,t.ulv,t.invested]),cashBefore:cash,cashAfter:G.cash,waveBefore:wave,waveAfter:G.wave};
  });
  assert.deepEqual(saveCheck.before,saveCheck.after);assert.equal(saveCheck.cashBefore,saveCheck.cashAfter);assert.equal(saveCheck.waveBefore,saveCheck.waveAfter);
  pass('Saved towers, including a preexisting paddock emplacement, cash and wave restored exactly');

  const motion=await page.evaluate(()=>{
    G.paused=true;const t=G.sceneTime;render(.05);const paused=G.sceneTime===t;
    G.paused=false;G.speed=10;render(.05);const delta=G.sceneTime-t;
    const stamps=[];const actorCounts=[];
    for(const tm of [0,6,14,17,25,32,35.99,36,60,120,3600]){
      const a=PerimeterScene.animalStates(tm);actorCounts.push(a.filter(d=>d.alpha>.05).length);
      if(!a.every(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.x>420&&d.x<590&&d.y>170&&d.y<289))throw Error('Resident left pen');
      G.sceneTime=tm;render(0);stamps.push(cv.toDataURL().slice(-160));
    }
    return {paused,delta,actors:Math.max(...actorCounts),different:new Set(stamps).size>1};
  });
  assert.ok(motion.paused);assert.ok(Math.abs(motion.delta-.05)<1e-8);assert.equal(motion.actors,3);assert.ok(motion.different);
  pass('Residents stay confined through long sessions; third animal appears; scenery respects pause and 10× speed');

  const gait=await page.evaluate(()=>{
    let minFacingDot=1,plantedSlip=0,plantedSamples=0,cruiseSpeed=0;
    const dt=1/120;
    for(let t=0;t<90;t+=1/30){
      const a=PerimeterScene.animalStates(t),b=PerimeterScene.animalStates(t+dt);
      for(let i=0;i<a.length;i++){
        const p=a[i],q=b[i];if(p.alpha<.1||q.alpha<.1||p.speed<1)continue;
        const dx=q.x-p.x,dz=(q.y-p.y)/PaddockRaptors.GROUND,L=Math.hypot(dx,dz);
        if(L>.001)minFacingDot=Math.min(minFacingDot,(dx*Math.cos(p.heading)+dz*Math.sin(p.heading))/L);
      }
      const p=a[0],q=b[0];cruiseSpeed=Math.max(cruiseSpeed,p.speed);
      // Compare the actual planted toe in WORLD space, on a straight run.
      if(Math.abs(Math.sin(p.heading))<.001&&p.speed>30&&q.phase>=p.phase){
        for(const side of [-1,1]){
          const f=PaddockRaptors.footPose(p.phase,side),g=PaddockRaptors.footPose(q.phase,side);
          if(f.lift||g.lift)continue;
          const before=p.x+Math.cos(p.heading)*p.size*f.x,after=q.x+Math.cos(q.heading)*q.size*g.x;
          plantedSlip=Math.max(plantedSlip,Math.abs(after-before)/dt);plantedSamples++;
        }
      }
    }
    const c=document.createElement('canvas');c.width=128;c.height=96;const ctx=c.getContext('2d'),widths=[];
    for(let i=0;i<32;i++){
      ctx.clearRect(0,0,128,96);PaddockRaptors.drawPose(ctx,i*Math.PI*2/32,.8,false);
      const p=ctx.getImageData(0,0,128,96).data;let lo=128,hi=0;
      for(let y=0;y<96;y++)for(let x=0;x<128;x++)if(p[(y*128+x)*4+3]>100){lo=Math.min(lo,x);hi=Math.max(hi,x);}
      widths.push(hi-lo+1);
    }
    return {minFacingDot,plantedSlip,plantedSamples,cruiseSpeed,minTurnWidth:Math.min(...widths),atlasBytes:PaddockRaptors.atlasBytes};
  });
  assert.ok(gait.minFacingDot>.995,'A resident is facing away from its travel direction');
  assert.ok(gait.plantedSamples>100);assert.ok(gait.plantedSlip<1,'Planted feet slide instead of holding their ground');
  assert.ok(gait.cruiseSpeed>=30,'Main patrol still moves in slow motion');
  assert.ok(gait.minTurnWidth>=15,'A turn collapses the body into a flat sliver');
  assert.ok(gait.atlasBytes<27*1024*1024);
  pass('Forward-facing patrols, grounded feet and solid silhouettes at all 32 turn angles',gait);

  // Keep a fixed patch of flank registered to the torso across a full walk.
  // The old height-based material bands flashed by ~18 brightness levels.
  const bellyVariation=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;
    const c=canvas.getContext('2d'),brightness=[];
    for(let i=0;i<16;i++){
      const phase=i*Math.PI*2/16,bob=Math.sin(phase*2)*.017;
      c.clearRect(0,0,128,96);c.save();c.translate(0,Math.sqrt(1-.62*.62)*bob*30);
      PaddockRaptors.drawPose(c,0,phase,false);c.restore();
      const pixels=c.getImageData(64,46,5,5).data;let sum=0;
      for(let p=0;p<pixels.length;p+=4)sum+=(pixels[p]+pixels[p+1]+pixels[p+2])/3;
      brightness.push(sum/25);
    }
    return Math.max(...brightness)-Math.min(...brightness);
  });
  assert.ok(bellyVariation<3,'Raptor belly shading flashes during its walk');
  pass('Belly brightness remains stable across all 16 walking poses',bellyVariation);

  const perf=await page.evaluate(()=>{
    G.state='review';G.towers=[];G.dinos=[];G.fx=[];G.projs=[];G.texts=[];G.corpses=[];G.decals=[];G.tourists=[];G.over=false;G.paused=false;
    const times=[];for(let i=0;i<150;i++){const t=performance.now();render(1/60);times.push(performance.now()-t);}
    times.sort((a,b)=>a-b);return {medianMs:times[75],p95Ms:times[142],imageBytes:633952};
  });
  assert.ok(perf.p95Ms<25,'Empty-scene rendering unexpectedly slow');pass('Desktop render budget (CPU submission, not GPU frame rate)',perf);

  // Every other map still supplies a compatible background to the game loop.
  for(let idx=1;idx<LEVELS_LENGTH;idx++){
    const ok=await page.evaluate(idx=>{startLevel(idx,'fresh',1);G.state='review';render(.016);return !G.perimeterScene&&G.bg.width===1280&&!document.querySelector('#errbox').textContent;},idx);
    assert.ok(ok,'Map '+idx+' failed');
  }
  pass('All six other maps retain compatible background outputs');

  // Delayed decode must refresh art without changing state or camera.
  const slow=await context.newPage();monitor(slow);let release;
  await slow.route('**/sector7-facility.webp',async route=>{await new Promise(resolve=>release=resolve);await route.continue();});
  await slow.goto(base,{waitUntil:'domcontentloaded'});
  const initial=await slow.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';G.cam={x:90,y:70,zoom:1.4};G.cash=789;return !G.perimeterScene.painted;});
  assert.ok(initial);release();await slow.waitForFunction(()=>G.perimeterScene.painted);
  assert.deepEqual(await slow.evaluate(()=>[G.cash,G.wave,G.cam.x,G.cam.y,G.cam.zoom]),[789,0,90,70,1.4]);
  pass('Late artwork replaces fallback without resetting cash, wave or camera');await slow.close();
  const missing=await context.newPage();monitor(missing);await missing.route('**/sector7-facility.webp',route=>route.abort());
  await missing.goto(base);await missing.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';G.sceneTime=6;render(0);});
  assert.equal(await missing.evaluate(()=>G.perimeterScene.painted),false);
  await snap(missing,'sector7-fallback');pass('Missing image still produces a complete playable procedural facility');await missing.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await mobile.route('https://**/*',route=>route.abort());const phone=await mobile.newPage();monitor(phone);
  await phone.goto(base);await phone.waitForFunction(()=>PerimeterScene.ready);
  await phone.locator('#levelCards .levelCard:not(.resume)').first().tap();await freeze(phone);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const promptBox=await phone.locator('#startPrompt').boundingBox(),mapBox=await phone.locator('#game').boundingBox();
  assert.ok(promptBox.height<55);assert.ok(promptBox.y>mapBox.y+mapBox.height*.7);
  await snap(phone,'sector7-phone');
  await phone.evaluate(()=>{G.cam={x:260,y:80,zoom:2};G.sceneTime=14;render(0);});await snap(phone,'sector7-phone-paddock');
  await phone.setViewportSize({width:844,height:390});await phone.evaluate(()=>{resetCam();render(0);});await snap(phone,'sector7-phone-landscape');
  pass('390px portrait and 844px landscape, map camera and paddock close-up render without horizontal overflow');
  await phone.setViewportSize({width:390,height:844});
  await phone.evaluate(()=>{resetCam();G.state='playing';G.paused=false;});
  await phone.locator('.shopCard[data-key="gatling"]').tap();
  const touchPoint=await phone.evaluate(()=>{const b=cv.getBoundingClientRect();return {x:b.x+(250-G.cam.x)*G.cam.zoom*b.width/W,y:b.y+(235-G.cam.y)*G.cam.zoom*b.height/H+PLACE_LIFT_PX};});
  await phone.touchscreen.tap(touchPoint.x,touchPoint.y);
  await phone.waitForFunction(()=>G.towers.length===1);
  await freeze(phone);await snap(phone,'sector7-phone-built');
  pass('Real touch selection and placement account for the raised mobile weapon preview');
  await phone.emulateMedia({reducedMotion:'reduce'});
  const reduced=await phone.evaluate(()=>{
    const a=document.createElement('canvas');a.width=1280;a.height=720;const c=a.getContext('2d');
    const draw=t=>{c.clearRect(0,0,1280,720);PerimeterScene.draw(c,t,G.perimeterScene);PerimeterScene.weather(c,t,1280,720);PerimeterScene.atmosphere(c,t,1280,720);return a.toDataURL();};
    return draw(1)===draw(100);
  });assert.ok(reduced);pass('Reduced motion keeps the complete ambient scene still');await mobile.close();

  const offline=await browser.newContext();await offline.route('https://**/*',route=>route.abort());const offlinePage=await offline.newPage();monitor(offlinePage);
  await offlinePage.goto(base);await offlinePage.evaluate(()=>navigator.serviceWorker.ready);await offlinePage.reload();
  await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  const cacheName=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE = '([^']+)'/)[1];
  const cached=await offlinePage.evaluate(async name=>{const c=await caches.open(name);return !!(await c.match('js/perimeter.js'))&&!!(await c.match('js/paddock-raptors.js'))&&!!(await c.match('assets/maps/sector7-facility.webp'));},cacheName);assert.ok(cached);
  await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>PerimeterScene.ready);
  await offlinePage.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';render(0);});
  assert.equal(await offlinePage.evaluate(()=>G.perimeterScene.painted),true);pass('Service worker precaches scene code and artwork; a fully offline reload plays');await offline.close();

  // Read the actual player-facing modal, rather than only checking source data.
  await page.evaluate(()=>{buildChangelog();document.querySelector('#changelog').classList.remove('hidden');});
  assert.match(await page.locator('#clogList').textContent(),/Sector 7 rebuilt/);
  await snap(page,'sector7-whats-new');
  const changelog=await page.evaluate(()=>({version:VERSION,entries:CHANGELOG}));
  assert.equal(changelog.entries[0].v,changelog.version);
  assert.equal(new Set(changelog.entries.map(c=>c.date)).size,changelog.entries.length);
  assert.ok(changelog.entries[0].items.every(i=>i.length<120));
  pass('Player-facing update modal, version and unique changelog dates');

  assert.deepEqual(errors,[]);assert.equal(await page.locator('#errbox').textContent(),'');
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({testedAt:new Date().toISOString(),results,errors},null,2));
  console.log('All perimeter checks passed. Screenshots:',out);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
