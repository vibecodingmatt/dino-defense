'use strict';
// Local or deployed six-map integration review, with isolated browser saves.
// MAP_REVIEW_URL selects a live base URL. Evidence stays outside runtime assets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=process.env.MAP_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/maps1660/local');fs.mkdirSync(out,{recursive:true});
const keys=['visitor','aviary','delta','lockwood','proving','lagoon'];
const original=[
  [[[-40,120],[400,120],[400,360],[900,360],[900,600],[1320,600]],[[-40,620],[400,620],[400,360],[900,360],[900,600],[1320,600]]],
  [[[-40,360],[210,360],[210,120],[520,120],[520,600],[820,600],[820,200],[1100,200],[1100,450],[1320,450]]],
  [[[-40,90],[1080,90],[1080,300],[220,300],[220,530],[1320,530]]],
  [[[-40,200],[300,200],[300,500],[640,500],[640,160],[980,160],[980,430],[1320,430]],[[200,-40],[200,340],[640,340],[640,160],[980,160],[980,430],[1320,430]]],
  [[[-40,360],[1320,360]]],
  [[[-40,150],[350,150],[350,320],[700,320],[700,160],[1050,160],[1050,440],[1320,440]],[[-40,560],[300,560],[500,480],[820,480],[1010,570],[1160,500],[1320,440]]],
];
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;const errors=[],report={maps:[],errors};const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const monitor=p=>p.on('pageerror',e=>errors.push(e.message));
async function saveCanvas(p,name,expr='G.bg') {const png=await p.evaluate(expr=>eval(expr).toDataURL().split(',')[1],expr);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));}
(async()=>{
  if(!process.env.MAP_REVIEW_URL)await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=process.env.MAP_REVIEW_URL||'http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});await context.route('https://www.googletagmanager.com/**',r=>r.abort());
  const p=await context.newPage();monitor(p);await p.goto(base);await p.waitForFunction(()=>SanctuaryScene.status().every(s=>s.ready));
  await p.evaluate(()=>{save.settings.mute=true;save.settings.music=false;save.settings.fieldGuide=false;});await p.screenshot({path:path.join(out,'home.png')});
  await p.locator('#verChip').click();report.changelog=await p.locator('#clogList').innerText();await p.screenshot({path:path.join(out,'whats-new.png')});await p.locator('#clogClose').click();
  for(let i=1;i<7;i++){
    const state=await p.evaluate(async i=>{startLevel(i,'fresh',1);G.state='review';G.paused=false;G.sceneTime=18;G.time=18;save.settings.invincible=true;await Creatures.ready(['velociraptor','pteranodon','ichthyosaurus']);render(0);return {painted:G.sanctuaryScene?.painted,paths:G.level.paths.map(pts=>pts.map(p=>[p.x,p.y])),maze:!!G.level.maze,water:G.level.waterPaths||[]};},i);
    assert.equal(state.painted,true);assert.deepEqual(state.paths,original[i-1]);
    await saveCanvas(p,keys[i-1]+'-background');
    await p.evaluate(()=>{ctx.save();ctx.lineWidth=1.2;ctx.strokeStyle='#ff00db';for(const pts of G.level.paths){ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.stroke();}ctx.restore();});await saveCanvas(p,keys[i-1]+'-route-alignment','cv');
    // Real keyboard + pointer placement on a legal square starts wave one.
    const pos=await p.evaluate(()=>{for(let y=220;y<560;y+=64)for(let x=256;x<1000;x+=64)if(canPlace(x,y))return {x,y};throw Error('No legal build space');});
    await p.evaluate(()=>{G.state='playing';G.paused=true;});await p.keyboard.press('Digit1');const b=await p.locator('#game').boundingBox();await p.mouse.click(b.x+pos.x/1280*b.width,b.y+pos.y/720*b.height);await p.waitForFunction(()=>G.towers.length===1);
    const battle=await p.evaluate(()=>{
      G.state='review';G.paused=false;G.cash=100000;save.settings.invincible=true;
      for(let y=200;y<590;y+=80)for(let x=256;x<1100;x+=128)if(canPlace(x,y)&&G.towers.length<9)placeTower(G.towers.length%2?'missile':'flamer',x,y,true);
      const count=G.towers.length;for(let n=0;n<1500;n++)step(.04);G.sceneTime=18;render(0);
      const before=G.towers.map(t=>[t.key,t.x,t.y,t.ulv,t.invested]);G.state='playing';saveRun();const cash=G.cash,wave=G.wave,savedWave=save.run.wave,idx=G.levelIdx,kills=G.stat.kills;
      startLevel(idx,'resume');G.state='review';G.paused=false;G.sceneTime=18;render(0);
      return {count,kills,wave,savedWave,restoredWave:G.wave,cash,restoredCash:G.cash,before,after:G.towers.map(t=>[t.key,t.x,t.y,t.ulv,t.invested]),error:document.querySelector('#errbox').textContent,flow:!G.level.maze||!!mazeRoutePts()};
    });
    assert.ok(battle.count>=4);assert.ok(battle.wave>=1);assert.ok(battle.kills>0);assert.equal(battle.restoredWave,battle.savedWave);assert.equal(battle.restoredCash,battle.cash);assert.deepEqual(battle.before,battle.after);assert.equal(battle.error,'');assert.equal(battle.flow,true);
    // Capture loaded species and weapons on both land and aquatic routes.
    await p.evaluate(()=>{G.dinos=[];G.tourists=[];G.banner=null;G.wave=3;G.waveActive=true;G.autoTimer=-1;updateStartPrompt();updateHUD();for(let pi=0;pi<G.paths.length;pi++)for(let k=0;k<6;k++){spawnDino((G.level.waterPaths||[]).includes(pi)?'ichthyosaurus':k%3===0?'pteranodon':'velociraptor',pi,false);const d=G.dinos.at(-1);d.dist=130+k*180;d.entranceT=0;if(G.level.maze){d.mx=140+k*135;d.my=360;}}G.paused=false;render(0);});
    await p.screenshot({path:path.join(out,keys[i-1]+'-desktop.png')});await saveCanvas(p,keys[i-1]+'-combat','cv');
    const motion=await p.evaluate(()=>{
      const scene=G.sceneTime;G.paused=true;render(.05);const paused=G.sceneTime===scene;G.paused=false;G.speed=10;render(.05);const delta=G.sceneTime-scene;G.speed=1;G.paused=true;
      const c=document.createElement('canvas');c.width=1280;c.height=720;const gc=c.getContext('2d'),stamp=t=>{gc.clearRect(0,0,1280,720);SanctuaryScene.draw(gc,G.level.art,t,[]);SanctuaryScene.atmosphere(gc,G.level.art,t);return c.toDataURL();};
      const rng=Math.random;let a,b,again;Math.random=()=>{throw Error('Scenery consumes gameplay RNG');};try{a=stamp(2);b=stamp(18);again=stamp(2);}finally{Math.random=rng;}
      return {paused,delta,moving:a!==b,deterministic:a===again};
    });assert.equal(motion.paused,true);assert.ok(Math.abs(motion.delta-.05)<1e-7);assert.equal(motion.moving,true);assert.equal(motion.deterministic,true);
    const perf=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const gc=c.getContext('2d'),samples=[];for(let i=0;i<120;i++){const now=performance.now();gc.drawImage(G.bg,0,0);SanctuaryScene.draw(gc,G.level.art,i/30,G.towers);SanctuaryScene.atmosphere(gc,G.level.art,i/30);samples.push(performance.now()-now);}samples.sort((a,b)=>a-b);return {medianMs:samples[60],p95Ms:samples[114]};});assert.ok(perf.p95Ms<25,'Scenery CPU submission exceeded budget');
    report.maps.push({key:keys[i-1],state,battle,motion,perf});console.log('PASS:',keys[i-1],'painted routes, pointer placement, combat, exact resume and deterministic paused/10x scenery',perf);
  }
  // Ambient regression: a living combat raptor must not trigger the random
  // Sector 7 snarl/bellow timer, nor can the decorative residents emit sounds.
  const voices=await p.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';G.paused=false;G.waveActive=true;G.spawnQ=[];spawnDino('velociraptor',0,false);G.dinos[0].speed=0;G.dinos[0].entranceT=0;G.voxAmb=.0001;const saved={...SFX},events=[];for(const k of Object.keys(SFX))SFX[k]=()=>events.push(k);try{for(let i=0;i<200;i++)step(.05);render(0);return events.filter(k=>['snarl','bellow'].includes(k));}finally{Object.assign(SFX,saved);G.paused=true;}});assert.deepEqual(voices,[]);console.log('PASS: living raptors and decorative paddock produce no random Perimeter growls');
  await p.emulateMedia({reducedMotion:'reduce'});const reduced=await p.evaluate(()=>SanctuaryScene.keys.map(key=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d'),s=t=>{g.clearRect(0,0,1280,720);SanctuaryScene.draw(g,key,t);SanctuaryScene.atmosphere(g,key,t);return c.toDataURL();};return s(0)===s(24);}));assert.ok(reduced.every(Boolean));report.reduced=reduced;console.log('PASS: all six scenes hold completely still under reduced motion');
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),mobile=await phone.newPage();monitor(mobile);await mobile.goto(base);await mobile.waitForFunction(()=>SanctuaryScene.status().every(s=>s.ready));
  await mobile.evaluate(()=>{save.settings.fieldGuide=false;});
  for(let i=1;i<7;i++){
    await mobile.evaluate(i=>{startLevel(i,'fresh',1);G.state='review';G.paused=false;G.sceneTime=18;render(0);},i);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const prompt=await mobile.locator('#startPrompt').boundingBox(),map=await mobile.locator('#game').boundingBox();assert.ok(prompt.height<55);assert.ok(prompt.y>map.y+map.height*.7);
    await mobile.screenshot({path:path.join(out,keys[i-1]+'-phone-arrival.png')});
    await mobile.evaluate(()=>{G.state='playing';G.paused=false;});await mobile.locator('#btnOverview').tap();await mobile.locator('.shopCard[data-key="gatling"]').tap();
    const touch=await mobile.evaluate(()=>{for(let y=220;y<560;y+=64)for(let x=256;x<1000;x+=64)if(canPlace(x,y)){const b=cv.getBoundingClientRect();return {x:b.x+(x-G.cam.x)*G.cam.zoom*b.width/W,y:b.y+(y-G.cam.y)*G.cam.zoom*b.height/H+PLACE_LIFT_PX};}throw Error('No touch placement');});
    await mobile.touchscreen.tap(touch.x,touch.y);await mobile.waitForFunction(()=>G.towers.length===1);
    await mobile.evaluate(()=>{G.state='review';G.paused=false;updateStartPrompt();render(0);});await mobile.screenshot({path:path.join(out,keys[i-1]+'-phone.png')});
  }
  await mobile.setViewportSize({width:844,height:390});await mobile.evaluate(()=>render(0));await mobile.screenshot({path:path.join(out,'lagoon-landscape.png')});await phone.close();console.log('PASS: six phone layouts and landscape capture');
  const failed=await browser.newContext({serviceWorkers:'block'});await failed.route('**/assets/maps/*-sanctuary.webp',r=>r.abort());const fp=await failed.newPage();monitor(fp);await fp.goto(base);await fp.waitForFunction(()=>SanctuaryScene.status().every(s=>s.failed));
  for(let i=1;i<7;i++){const fallback=await fp.evaluate(i=>{startLevel(i,'fresh',1);G.state='review';G.paused=true;render(0);return {painted:!!G.sanctuaryScene,paths:G.paths.length,pixels:G.bg.getContext('2d').getImageData(640,360,1,1).data[3]};},i);assert.equal(fallback.painted,false);assert.equal(fallback.pixels,255);await saveCanvas(fp,keys[i-1]+'-fallback');}await failed.close();console.log('PASS: every map has a complete image-failure fallback');
  const delayed=await browser.newContext({serviceWorkers:'block'}),pending=[];await delayed.route('**/assets/maps/*-sanctuary.webp',r=>pending.push(r));const dp=await delayed.newPage();monitor(dp);await dp.goto(base,{waitUntil:'domcontentloaded'});await dp.waitForFunction(()=>typeof G!=='undefined');
  const before=await dp.evaluate(()=>{startLevel(6,'fresh',1);G.state='review';G.paused=true;G.cash=10000;placeTower('flamer',450,240,true);G.cam={zoom:1.4,x:57,y:83};G.sceneTime=17;return {towers:JSON.stringify(G.towers),cam:JSON.stringify(G.cam),sceneTime:G.sceneTime,bg:G.bg.toDataURL(),thumb:document.querySelectorAll('.lvThumb')[6].toDataURL()};});assert.ok(JSON.parse(before.towers).length);
  const route=pending.find(r=>r.request().url().includes('lagoon-'));assert.ok(route);await route.fulfill({status:200,contentType:'image/webp',body:fs.readFileSync(path.join(root,'assets/maps/lagoon-sanctuary.webp'))});await dp.waitForFunction(()=>G.sanctuaryScene?.painted);
  const after=await dp.evaluate(()=>({towers:JSON.stringify(G.towers),cam:JSON.stringify(G.cam),sceneTime:G.sceneTime,bg:G.bg.toDataURL(),thumb:document.querySelectorAll('.lvThumb')[6].toDataURL()}));assert.equal(after.towers,before.towers);assert.equal(after.cam,before.cam);assert.equal(after.sceneTime,before.sceneTime);assert.notEqual(hash(after.bg),hash(before.bg));assert.notEqual(hash(after.thumb),hash(before.thumb));for(const r of pending)if(r!==route)await r.abort();await delayed.close();console.log('PASS: late image swaps refresh terrain and menu thumbnail without resetting weapons, camera or clock');
  const offlineContext=await browser.newContext(),op=await offlineContext.newPage();monitor(op);await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.waitForFunction(()=>!!navigator.serviceWorker.controller);await offlineContext.setOffline(true);await op.reload({waitUntil:'domcontentloaded'});await op.waitForFunction(()=>SanctuaryScene.status().every(s=>s.ready));
  report.offline=await op.evaluate(()=>({keys:SanctuaryScene.status(),cache:typeof VERSION!=='undefined'?VERSION:null}));for(let i=1;i<7;i++)assert.equal(await op.evaluate(i=>{startLevel(i,'fresh',1);G.state='review';G.paused=true;render(0);return G.sanctuaryScene.painted;},i),true);await offlineContext.close();console.log('PASS: all six painted environments load and render after a real offline reload');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: no browser errors; evidence:',out);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server.listening)server.close();});
