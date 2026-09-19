'use strict';
// Actual charge/projectile/damage flow, economy, body treatments and player UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.EXTINCTION_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/extinction/local');fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[root,path.resolve(root,'../war-survival')]}));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.EXTINCTION_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const errors=[],reports=[];
 for(const [name,width,height,touch,canvas]of [['desktop',1440,1000,false,false],['phone',390,844,true,false],['small-phone',320,568,true,false],['landscape',844,390,true,false],['canvas',1280,900,false,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,serviceWorkers:'block'});await context.route('https://www.googletagmanager.com/**',r=>r.abort());
  if(canvas)await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...a){return /^webgl/.test(k)?null:get.call(this,k,...a);};});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await page.evaluate(()=>{save.settings.mute=true;startLevel(0,'fresh',1);G.wave=39;G.waveActive=false;G.autoTimer=-1;G.spawnQ=[];G.cash=2600;G.paused=false;updateHUD();});
  await page.locator('.shopCard[data-key="extinction"]')[touch?'tap':'click']();await page.locator('#game').scrollIntoViewIfNeeded();
  const place=await page.evaluate(touch=>{const r=cv.getBoundingClientRect(),s=FieldCommand.suggested();return {x:r.left+(s.x-G.cam.x)*G.cam.zoom*r.width/W,y:r.top+(s.y-G.cam.y)*G.cam.zoom*r.height/H+(touch?PLACE_LIFT_PX:0)};},touch);
  if(touch)await page.touchscreen.tap(place.x,place.y);else await page.mouse.click(place.x,place.y);
  assert.deepEqual(await page.evaluate(()=>({count:G.towers.length,key:G.towers[0]?.key,cash:G.cash})),{count:1,key:'extinction',cash:0});
  const report=await page.evaluate(async name=>{
   save.settings.mute=true;save.settings.music=false;await Creatures.ready(['velociraptor','triceratops','trex','indominus']);
   startLevel(0,'fresh',1);G.state='review';G.paused=false;G.wave=40;G.waveActive=true;G.spawnQ=[];
   const def=TOWERS.extinction,rows=[];
   function reset(lv=0){G.dinos=[];G.fx=[];G.corpses=[];G.projs=[];G.bolts=[];G.clouds=[];G.zapQ=[];G.links=[];G.tourists=[];G.snatch=null;G.texts=[];G.decals=[];G.towers=[{key:'extinction',ulv:lv,x:140,y:230,angle:0,mode:'first',cd:0,invested:def.cost}];return G.towers[0];}
   function dino(dist,hp=20000,key='velociraptor'){spawnDino(key,0,false);const d=G.dinos.at(-1);d.dist=dist;d.speed=0;d.hp=d.maxHp=hp;d.armor=0;d.entranceT=0;return d;}
   for(let lv=0;lv<3;lv++){
    const t=reset(lv),d=dino(160),st=towerStats(t);d.armor=99999;const before=d.hp;
    fireTower(t,.2);if(G.projs.length||d.hp!==before||!(t.novaCharge>0))throw Error('Charge skipped');
    let clock=.2;while(!G.projs.length&&clock<2){fireTower(t,1/120);clock+=1/120;}
    if(G.projs.length!==1)throw Error('Missing charged shot');const pr=G.projs[0],m=Arsenal.anchor(t,0,true);
    if(Math.hypot(pr.x-m.x,pr.y-m.y)>1e-8)throw Error('Muzzle mismatch');
    const near=dino(180),edge=dino(160+st.splash+5.6),outside=dino(160+st.splash+20),fly=dino(160,20000,'pteranodon'),immune=dino(160);immune.noHurt=true;
    const cloak=dino(160,20000,'indominus');cloak.cloaked=true;cloak.revealT=0;
    for(let n=0;n<90;n++)updateProjs(1/120);
    if(Math.abs(before-d.hp-st.dmg)>1e-5)throw Error('Core damage/armor');
    if(!(near.hp<20000&&edge.hp<20000&&edge.hp>near.hp))throw Error('No blast falloff');
    if(outside.hp!==20000||fly.hp!==20000||immune.hp!==20000||cloak.hp!==20000||cloak.plasmaT)throw Error('Invalid splash target '+JSON.stringify({lv,impact:[pr.tx,pr.ty],outside:[outside.hp,dinoPos(outside)],fly:fly.hp,immune:immune.hp,cloak:cloak.hp,plasma:cloak.plasmaT}));
    if(!(d.plasmaT>0))throw Error('Missing thermal fracture');d.armor=0;let hp=d.hp;damage(d,100,true,{key:'sniper',x:0});if(Math.abs(hp-d.hp-120)>1e-7)throw Error('Fracture vulnerability');
    updateDinos(2.5);hp=d.hp;damage(d,100,true,{key:'sniper',x:0});if(Math.abs(hp-d.hp-100)>1e-7)throw Error('Fracture did not expire');
    rows.push({lv,damage:st.dmg,charge:Extinction.chargeTime(st),reload:1/st.rof,radius:st.splash,coreDps:st.dmg/(Extinction.chargeTime(st)+1/st.rof)});
   }
   let t=reset();const dead=dino(160,1),cash=G.cash,kills=G.stat.kills;for(let n=0;n<180;n++){fireTower(t,1/120);updateProjs(1/120);}
   if(!dead.dead||G.stat.kills!==kills+1||G.cash!==cash+dead.bounty||G.fx.filter(f=>f.sequence==='sunfall').length!==1)throw Error('Lost/duplicate kill credit');
   t=reset();dino(160);fireTower(t,.3);G.dinos=[];fireTower(t,.1);if(t.novaCharge||G.projs.length)throw Error('Lost target did not cancel');
   t=reset();dino(160,20000,'pteranodon');fireTower(t,1);if(t.novaCharge||G.projs.length)throw Error('Targeting flyers');
   t=reset();const close=dino(160),pos=dinoPos(close);t.x=pos.x;t.y=pos.y;fireTower(t,1);if(t.novaCharge||G.projs.length)throw Error('Minimum range');
   // Compare actual repeated shots against a tank. Includes windup and flight.
   const sustained=[];for(const key of ['mortar','extinction']){t=reset();t.key=key;const d=dino(160,1e7);for(let n=0;n<60*60;n++){fireTower(t,1/60);updateProjs(1/60);updateDinos(1/60);}sustained.push({key,damage:1e7-d.hp});}
   if(!(sustained[1].damage>sustained[0].damage*1.8&&sustained[1].damage<sustained[0].damage*3.2))throw Error('Sustained damage escaped intended tier');
   t=reset();G.wave=38;G.waveActive=false;if(towerUnlocked('extinction'))throw Error('Early unlock');G.wave=39;if(!towerUnlocked('extinction'))throw Error('Wave 40 prep remains locked');
   G.towers=[];if(towerCost('extinction')!==2600)throw Error('Base price');G.towers=[t];if(towerCost('extinction')!==3900||UPG.cost(def,0)!==3120||UPG.cost(def,1)!==5200)throw Error('Prices');
   const maps=[];
   if(name==='desktop')for(let map=0;map<LEVELS.length;map++){
    startLevel(map,'fresh',1);G.state='playing';G.paused=true;G.wave=39;G.waveActive=false;G.cash=20000;
    const pi=pathForKey('velociraptor'),path=G.paths[pi];let spot;
    search:for(let y=150;y<620;y+=40)for(let x=100;x<1160;x+=40){if(!canPlace(x,y))continue;for(let dist=80;dist<path.len-80;dist+=40){const p=samplePath(path,dist),dd=Math.hypot(p.x-x,p.y-y);if(dd>55&&dd<110){spot={x,y,dist};break search;}}}
    if(!spot)throw Error('No valid map fixture '+map);placeTower('extinction',spot.x,spot.y);if(G.towers.length!==1||G.cash!==17400)throw Error('Map purchase '+map);
    const tower=G.towers[0];tower.ulv=2;tower.invested=10920;tower.mode='strong';saveRun();const saved=JSON.stringify(snapshot().towers);startLevel(map,'resume');G.paused=true;
    if(JSON.stringify(snapshot().towers)!==saved||G.cash!==17400)throw Error('Saved Extinction lost '+map);
    G.state='review';G.dinos=[];spawnDino('velociraptor',pi,false);const d=G.dinos.at(-1);d.dist=spot.dist;d.speed=0;d.hp=1;d.armor=0;
    for(let i=0;i<180;i++){fireTower(G.towers[0],1/120);updateProjs(1/120);}if(!d.dead)throw Error('Map attack '+map);maps.push(map);
   }
   startLevel(0,'fresh',1);G.state='review';G.paused=false;G.wave=40;G.waveActive=true;G.spawnQ=[];
   const sheet=document.createElement('canvas');sheet.width=1500;sheet.height=1000;const c=sheet.getContext('2d');c.fillStyle='#14222b';c.fillRect(0,0,1500,1000);
   for(let lv=0;lv<3;lv++){c.save();c.translate(240+lv*500,280);c.scale(4,4);Arsenal.base(c,0,0,'extinction',false,lv);Arsenal.turret(c,{key:'extinction',ulv:lv,x:0,y:0,angle:-.32,novaCharge:.85,cd:0},0,1.2);c.restore();c.fillStyle='#f6d6a0';c.font='24px sans-serif';c.fillText(Arsenal.info('extinction',lv).name,100+lv*500,70);}
   const actor={...DINOS.triceratops,key:'triceratops',size:52,artHeading:.3,phase:.8};
   for(let i=0;i<3;i++){const x=240+i*500,y=660,f={kind:'novaBlast',x,y,r:125,t:[.13,.35,1.5][i],dur:2.65,lv:2,seed:3};drawDino(c,{...actor,plasmaT:2},x,y,1,.8,1,0);DinoFX.status(c,{...actor,plasmaT:2},x,y,1,.8,0,1);Extinction.draw(c,f);c.fillStyle='#edd6ae';c.font='20px sans-serif';c.fillText(['Containment collapse','Plasma bloom','Thermal fractures'][i],100+i*500,900);}
   window.extinctionSheet=sheet.toDataURL();
   const weapon={key:'extinction',ulv:2,x:250,y:250,angle:.3,novaCharge:.6,novaTime:.4},blast={kind:'novaBlast',x:350,y:280,r:100,t:.4,dur:2.65,lv:2,seed:5},pr={kind:'nova',tower:weapon,x:320,y:250,t:.2,lv:2,trail:[]},fx=[];
   DinoFX.death(fx,actor,{x:370,y:250},weapon);fx[0].t=.8;
   const before=JSON.stringify({weapon,blast,pr,fx,actor}),random=Math.random;Math.random=()=>{throw Error('Renderer consumes simulation randomness');};
   try{for(let i=0;i<5;i++){Arsenal.turret(c,weapon,0,9+i);Extinction.draw(c,blast);Extinction.projectile(c,pr);DinoFX.drawDeath(c,fx[0]);DinoFX.status(c,{...actor,plasmaT:2},200,250,1,.8,0,i);}}finally{Math.random=random;}
   if(JSON.stringify({weapon,blast,pr,fx,actor})!==before)throw Error('Drawing mutates combat');
   const samples=[];for(let i=0;i<60;i++){const begin=performance.now();for(let j=0;j<6;j++){Arsenal.turret(c,{...weapon,x:120+j*180,novaCharge:i%9/8,novaTime:i/60},0,i/60);Extinction.draw(c,{...blast,x:120+j*180,t:.1+i/45});}if(i>10)samples.push(performance.now()-begin);}
   samples.sort((a,b)=>a-b);const p95=samples[Math.floor(samples.length*.95)];if(p95>65||Arsenal.cacheBytes>64e6)throw Error('Cannon effect budget '+p95);
   // Stage the real player UI with a charged weapon and living herd.
   t=reset(0);for(const [i,k]of ['triceratops','velociraptor','stegosaurus','ankylosaurus'].entries())dino(140+i*40,10000,k);
   t.novaCharge=.72;t.novaTime=1.2;G.cash=20000;G.state='playing';G.paused=true;G.wave=40;G.waveActive=true;G.time=1.2;selectTower(t);updateHUD();render(0);
   return {name,rows,sustained,maps,p95,models:Arsenal.cachedSprites,cache:Arsenal.cacheBytes};
  },name);
  fs.writeFileSync(path.join(out,name+'-showcase.png'),Buffer.from((await page.evaluate(()=>extinctionSheet)).split(',')[1],'base64'));
  const frozen=await page.evaluate(()=>JSON.stringify({t:G.towers[0],fx:G.fx,p:G.projs}));await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>JSON.stringify({t:G.towers[0],fx:G.fx,p:G.projs})),frozen);
  for(let lv=1;lv<=2;lv++){const before=await page.evaluate(()=>G.cash);await page.locator('#up_main')[touch?'tap':'click']();assert.equal(await page.evaluate(()=>G.towers[0].ulv),lv);assert.equal(await page.evaluate(()=>G.cash),before-(lv===1?3120:5200));}
  assert.equal(await page.locator('#up_main').isDisabled(),true);await page.screenshot({path:path.join(out,name+'-upgrade.png'),fullPage:true});await page.locator('#tpClose')[touch?'tap':'click']();
  if(!touch){for(let i=0;i<10;i++){await page.keyboard.press(String((i+1)%10));assert.equal(await page.evaluate(()=>G.placing),(await page.evaluate(()=>Object.keys(TOWERS)))[i]);}await page.keyboard.press('Escape');}
  await page.locator('#btnResume')[touch?'tap':'click']();await page.waitForFunction(()=>G.fx.some(f=>f.kind==='novaBlast'));await page.evaluate(()=>{G.paused=true;updateHUD();});await page.screenshot({path:path.join(out,name+'-game.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);reports.push(report);console.log('PASS:',name,'charge, impact, immunity, fracture, economy, kill credit, pause, real upgrades and controls',report);await context.close();
 }
 const context=await browser.newContext();await context.route('https://www.googletagmanager.com/**',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();
 assert.equal(await page.evaluate(async()=>{await GameAudioFX.prepare();return typeof Extinction==='object'&&GameAudioFX.bankStatus().ready&&GameAudioFX.names.includes('novaImpact')&&Arsenal.model('extinction',2).faces.length>1000;}),true);await context.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({base,reports,errors},null,2));console.log('PASS: complete weapon and new sound bank reload offline');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
