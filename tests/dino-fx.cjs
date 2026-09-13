'use strict';
// Combat integration, rendering purity, animated anchors and bounded caches.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review');fs.mkdirSync(out,{recursive:true});
for(const key of ['dino-fx','weapon-fx','creatures','game','armory-guide'])new vm.Script(fs.readFileSync(path.join(root,'js',key+'.js'),'utf8'),{filename:key});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const errors=[],results=[];let browser;const pass=(test,detail)=>{results.push({test,detail});console.log('PASS:',test,detail||'');};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});await context.route('https://**/*',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
 assert.equal(await page.evaluate(async()=>(await Creatures.ready()).filter(Boolean).length),33);
 await page.evaluate(()=>{save.settings.mute=true;save.settings.music=false;startLevel(0,'fresh',1);G.state='review';G.paused=false;});
 const combat=await page.evaluate(()=>{
   const result=[];for(const key of Object.keys(TOWERS))for(let lv=0;lv<=TOWERS[key].maxUp;lv++){
     G.dinos=[];G.fx=[];G.corpses=[];spawnDino('velociraptor',0,false);const d=G.dinos[0],src={key,ulv:lv,x:10,y:20,kills:0};d.dist=280;d.hp=1;d.armor=0;
     const kills=G.stat.kills;damage(d,50,true,src);const f=G.fx.find(f=>f.kind==='weaponDeath');
     if(!d.dead||G.stat.kills!==kills+1||!f||f.sequence!==DinoFX.sequences[key]||f.d.key!==d.key||f.lv!==lv)throw Error('Lost finisher/credit '+key+lv);
     const count=G.fx.length;damage(d,50,true,src);if(G.stat.kills!==kills+1||G.fx.length!==count)throw Error('Duplicate death '+key);
     result.push(key+lv+':'+f.sequence);
   }
   G.dinos=[];G.fx=[];spawnDino('velociraptor',0,false);let d=G.dinos[0];d.hp=.01;d.burnT=1;d.burnDps=10;d.burnSrc={key:'flamer',x:0,ulv:2};updateDinos(.01);if(G.fx.find(f=>f.kind==='weaponDeath')?.sequence!=='ash')throw Error('Burn credit');
   G.dinos=[];G.fx=[];G.clouds=[];spawnDino('velociraptor',0,false);d=G.dinos[0];d.dist=200;d.hp=10;const p=dinoPos(d),tower={key:'gas',x:0,ulv:1};G.clouds=[{...p,r:50,t:0,dur:2,dps:1,tower}];updateClouds(.01);if(!(d.poisonT>0))throw Error('Gas treatment');d.hp=.001;updateClouds(.01);if(G.fx.find(f=>f.kind==='weaponDeath')?.sequence!=='ghost')throw Error('Gas credit');G.clouds=[];
   G.dinos=[];G.fx=[];G.corpses=[];spawnDino('trex',0,true);d=G.dinos[0];d.hp=1;damage(d,100,true,{key:'tesla',x:0,ulv:2});if(G.corpses.length!==1||G.fx.some(f=>f.kind==='weaponDeath'))throw Error('Boss finale replaced');
   G.dinos=[];G.fx=[];G.bolts=[];G.zapQ=[];G.links=[];spawnDino('pteranodon',0,false);d=G.dinos[0];d.dist=260;d.hp=1000;const source={key:'tesla',x:10,y:100,ulv:0},strike=DinoFX.anchor(d,dinoPos(d));G.zapQ=[{delay:0,dino:d,tower:source,def:TOWERS.tesla,st:{dmg:1}}];runZapQ(.01);const bolt=G.bolts[0];if(Math.abs(bolt.x2-strike.x)+Math.abs(bolt.y2-strike.y)>.001)throw Error('Tesla misses animated skin');
   return result;
 });assert.equal(combat.length,27);pass('All 27 weapon configurations retain unique kill credit, burn/gas finishers and bespoke boss finales',combat);
 const purity=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=440;cv.height=340;const c=cv.getContext('2d');
   const d={...DINOS.velociraptor,key:'velociraptor',size:45,phase:.8,artHeading:.4,burnT:1,slowT:1,zapT:.2,charT:.8,poisonT:.5,sonicT:.3};const fx=[];
   for(const key of Object.keys(DinoFX.sequences))DinoFX.death(fx,d,{x:220,y:240},{key,ulv:2,x:0});
   const before=JSON.stringify({d,fx}),events=[];const sounds=['punt','whistleIn','thud','deflate','sizzle','shatter','koBoing','notePop','whoo'],original={};for(const key of sounds){original[key]=SFX[key];SFX[key]=()=>events.push(key);}
   try{for(let i=0;i<8;i++){DinoFX.status(c,d,220,240,1,.8,0,.7);for(const f of fx)WeaponFX.draw(c,f,.7);}if(JSON.stringify({d,fx})!==before||events.length)throw Error('Draw advanced effect or sound');
     for(const f of fx){WeaponFX.update(f,3,(key,sound)=>events.push(key+':'+sound));WeaponFX.update(f,1,(key,sound)=>events.push(key+':'+sound));}
     if(new Set(events).size!==events.length||!events.includes('mortar:whistleIn')||!events.includes('cryo:shatter')||events.length!==9)throw Error('Skipped or repeated beat '+events);
     G.fx=[];G.dinos=[];G.corpses=[];G.clouds=[];G.towers=[];G.state='playing';G.paused=false;G.waveActive=true;G.spawnQ=[];DinoFX.death(G.fx,d,{x:220,y:240},{key:'mortar',x:0});save.settings.mutedWeapons.mortar=true;const count=events.length;step(.1);save.settings.mutedWeapons.mortar=false;step(.1);if(events.length!==count)throw Error('Muted launch replayed');G.state='review';
   }finally{for(const key of sounds)SFX[key]=original[key];save.settings.mutedWeapons.mortar=false;}
   return {events,pure:true};
 });pass('Repeated draws are pure; crossed sound beats play once and muted beats stay consumed',purity);
 const anatomy=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=380;cv.height=320;const c=cv.getContext('2d');let poses=0,deaths=0;
   for(const key of Object.keys(DINOS)){
     const d={...DINOS[key],key,size:35,artHeading:0,phase:.2};if(!Creatures.model(key).joinedSkin)throw Error('Fallback skin '+key);
     for(const heading of [0,1.6,3.4,5.3])for(const phase of [.2,1.7]){d.artHeading=heading;d.phase=phase;const F=DinoFX.frame(d);if(F.sites.length>96||F.fire.length>14||F.sites.some(p=>!Number.isFinite(p.x+p.y+p.depth)))throw Error('Invalid skin anchors '+key);DinoFX.status(c,{...d,burnT:2,slowT:1,zapT:.3,poisonT:1},190,230,1,phase,0,.8);poses++;}
     const a=DinoFX.frame({...d,artHeading:.2,phase:.2}),b=DinoFX.frame({...d,artHeading:.2,phase:1.7});if(JSON.stringify(a.sites)===JSON.stringify(b.sites))throw Error('Frozen anchors '+key);
     for(const weapon of Object.keys(DinoFX.sequences)){const fx=[];DinoFX.death(fx,d,{x:190,y:230},{key:weapon,x:0,ulv:2});for(const t of [.1,.65,1.2,1.7]){fx[0].t=t;DinoFX.drawDeath(c,fx[0]);deaths++;}}
   }return {poses,deaths,cache:Creatures.cachedSprites,limit:Creatures.cacheLimit,textures:DinoFX.stats()};
 });assert.ok(anatomy.cache<=anatomy.limit);assert.ok(anatomy.textures.textureBytes<1e6);pass('All 33 exported skins animate finite surface anchors and all nine finishers at multiple beats',anatomy);
 const cache=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=320;cv.height=300;const c=cv.getContext('2d');const d={...DINOS.trex,key:'trex',size:42,phase:.4,artHeading:.3};
   function snap(prepared){if(prepared)Creatures.prepare([d]);c.clearRect(0,0,320,300);drawDino(c,d,160,220,1,d.phase,1,0);return cv.toDataURL();}
   const base=snap(true),treatments=[];for(const key of ['burnT','slowT','zapT','poisonT']){d[key]=1;const snapshot=snap(false),atlas=snap(true);if(snapshot===base||atlas===base)throw Error('Stale status '+key);treatments.push(key);d[key]=0;}
   if(snap(true)!==base)throw Error('Status did not clear');
   G.dinos=[];G.fx=[];G.towers=[];G.corpses=[];G.tourists=[];G.clever=null;spawnDino('indominus',0,true);const boss=G.dinos[0];boss.dist=350;boss.noHurt=false;const p=dinoPos(boss),arcs=[];const arc=ctx.arc,status=DinoFX.status;let statusCalls=0;ctx.arc=function(x,y,r,...args){if(Math.abs(x-p.x)<.01&&Math.abs(y-p.y)<.01)arcs.push(r);return arc.call(this,x,y,r,...args);};DinoFX.status=function(...args){statusCalls++;return status(...args);};
   try{render(0);if(arcs.some(r=>Math.abs(r-boss.size*1.1)<.01))throw Error('Boss ring still rendered');boss.noHurt=true;arcs.length=0;render(0);if(!arcs.some(r=>Math.abs(r-boss.size*1.42)<.01))throw Error('Invulnerability cue lost');boss.cloaked=true;boss.revealT=0;boss.burnT=2;statusCalls=0;render(0);if(statusCalls)throw Error('Cloaked status revealed boss');}finally{ctx.arc=arc;DinoFX.status=status;}
   return {treatments,bossRing:false,cloakHidden:true};
 });pass('Atlas and snapshots refresh skin treatments; boss ring is absent and cloak hides status effects',cache);
 const perf=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=1280;cv.height=800;const c=cv.getContext('2d'),actors=Array.from({length:24},(_,i)=>({...DINOS.velociraptor,key:'velociraptor',size:24,phase:.5,artHeading:.3,[['burnT','slowT','zapT'][i%3]]:1})),fx=[];
   for(let i=0;i<9;i++)DinoFX.death(fx,actors[i],{x:80+i*130,y:680},{key:Object.keys(DinoFX.sequences)[i],x:0,ulv:2});
   const times=[];for(let n=0;n<65;n++){const t=n/60;for(const d of actors)d.phase=.5+t;for(const f of fx)f.t=.2+t;const start=performance.now();Creatures.prepare(actors);c.clearRect(0,0,1280,800);actors.forEach((d,i)=>{const x=90+i%8*150,y=180+Math.floor(i/8)*160;drawDino(c,d,x,y,1,d.phase,1,0);DinoFX.status(c,d,x,y,1,d.phase,0,t);});for(const f of fx)DinoFX.drawDeath(c,f);if(n>15)times.push(performance.now()-start);}
   times.sort((a,b)=>a-b);return {median:times[Math.floor(times.length/2)],p95:times[Math.floor(times.length*.95)],cache:Creatures.cachedSprites,limit:Creatures.cacheLimit,...DinoFX.stats()};
 });assert.ok(perf.cache<=perf.limit&&perf.textures<=perf.textureLimit);assert.ok(perf.p95<100,'Crowded effects submission budget exceeded '+JSON.stringify(perf));pass('24 affected dinosaurs plus all nine finishers keep caches bounded; headless CPU submission timings',perf);
 // Capture representative actual game positions rather than only isolated sprites.
 await page.evaluate(()=>{G.dinos=[];G.fx=[];G.corpses=[];G.clouds=[];G.tourists=[];G.towers=[];G.state='review';G.time=2.3;G.wave=30;G.waveActive=true;G.texts=[];G.decals=[];G.banner=null;updateHUD();updateStartPrompt();['velociraptor','triceratops','trex','pteranodon','stegosaurus','dilophosaurus'].forEach((key,i)=>{spawnDino(key,0,false);const d=G.dinos.at(-1);d.dist=170+i*140;d.phase=.8;d.artHeading=.2;d[['burnT','slowT','zapT'][i%3]]=1;});render(0);});await page.screenshot({path:path.join(out,'dino-fx-game-desktop.png')});
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});await mobile.route('https://**/*',r=>r.abort());const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.evaluate(async()=>{await Creatures.ready();save.settings.mute=true;startLevel(0,'fresh',1);G.state='review';G.tourists=[];['velociraptor','triceratops','pteranodon'].forEach((key,i)=>{spawnDino(key,0,false);const d=G.dinos.at(-1);d.dist=180+i*210;d.phase=.8;d[['burnT','slowT','zapT'][i]]=1;});render(0);});await phone.screenshot({path:path.join(out,'dino-fx-game-phone.png')});assert.ok(await phone.evaluate(()=>Creatures.available&&DinoFX.stats().textures<=DinoFX.stats().textureLimit));await mobile.close();pass('Desktop and phone game captures use exported skins and the new effects');
 const fallback=await browser.newContext({serviceWorkers:'block'});await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});await fallback.route('https://**/*',r=>r.abort());const fp=await fallback.newPage();fp.on('pageerror',e=>errors.push(e.message));await fp.goto(base);assert.equal(await fp.evaluate(()=>{const cv=document.createElement('canvas'),c=cv.getContext('2d'),d={...DINOS.velociraptor,key:'velociraptor',size:24,phase:.7};for(const key of Object.keys(DinoFX.sequences)){const fx=[];DinoFX.death(fx,d,{x:100,y:100},{key,x:0});for(const t of [.1,.6,1.2]){fx[0].t=t;DinoFX.drawDeath(c,fx[0]);}DinoFX.status(c,{...d,burnT:2,slowT:2,zapT:.3},100,100,1,.7,0,1);}return Creatures.available;}),false);await fallback.close();pass('All finishers and statuses remain safe when WebGL is unavailable');
 const offline=await browser.newContext();await offline.route('https://**/*',r=>r.abort());const op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.reload();await op.waitForFunction(()=>navigator.serviceWorker.controller!==null);await offline.setOffline(true);await op.reload();assert.equal(await op.evaluate(async()=>{await Creatures.ready();const f=[];DinoFX.death(f,{...DINOS.velociraptor,key:'velociraptor',size:30},{x:100,y:150},{key:'cryo',x:0});DinoFX.drawDeath(ctx,f[0]);return typeof DinoFX==='object'&&Creatures.model('velociraptor').joinedSkin;}),true);await offline.close();pass('New effect module and exported dinosaur skins work after offline reload');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'dino-fx-verification.json'),JSON.stringify({testedAt:new Date().toISOString(),results,errors},null,2));console.log('All dinosaur effect checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
