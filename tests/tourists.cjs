'use strict';
// Visitor models, every introductory cast, cameo poses, gore clock ownership,
// cache budgets, WebGL loss and the offline dependency chain.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;const errors=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1500,height:1000},serviceWorkers:'block'});await context.route('https://**/*',r=>r.abort());const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.evaluate(()=>{G.state='review';save.settings.mute=true;});
 assert.ok(await p.evaluate(()=>Tourists.available));
 const casts=await p.evaluate(()=>{
   const records=[];
   for(let i=0;i<LEVELS.length;i++){
     startLevel(i,'fresh',1);G.state='review';G.paused=true;spawnTourists();const before=JSON.stringify(G.tourists),cv=document.createElement('canvas');cv.width=1500;cv.height=1100;const c=cv.getContext('2d');
     c.fillStyle='#18272b';c.fillRect(0,0,1500,1100);
     for(let n=0;n<G.tourists.length;n++){const u=G.tourists[n];drawTourist(c,{...u,size:130},100+n*180,340,1,1.2,1,0);drawTourist(c,{...u,size:130},100+n*180,680,-1,3.4,1,0);drawTourist(c,{...u,size:130,lookT:.3},100+n*180,1020,1,5.4,1,0);}
     if(before!==JSON.stringify(G.tourists))throw Error('Drawing mutated the cast');
     records.push({map:i,count:G.tourists.length,adults:G.tourists.filter(u=>!u.kid).length,validPath:G.tourists.every(u=>!G.level.waterPaths?.includes(u.pathI))});
     if(i===0)window.touristCastCapture=cv.toDataURL();
   }return records;
 });
 assert.equal(casts.length,7);for(const c of casts){assert.equal(c.count,8);assert.equal(c.adults,7);assert.ok(c.validPath);}fs.writeFileSync(path.join(out,'tourists-evacuation-cast.png'),Buffer.from((await p.evaluate(()=>touristCastCapture)).split(',')[1],'base64'));
 console.log('PASS: all eight visitors on all seven maps; forward, reverse, glance and gait poses do not mutate live actors');
 const poses=await p.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=1700;cv.height=1600;const c=cv.getContext('2d');c.fillStyle='#18272b';c.fillRect(0,0,1700,1600);
   const cast=[nedryLook(155),hammondLook(155),muldoonLook(155),timmyLook(155),gennaroLook(155)];let checks=0;
   for(let i=0;i<5;i++){const u=cast[i],x=175+i*335;c.fillStyle='#d9e3d7';c.font='22px sans-serif';c.fillText(u.hero,x-55,38);
     for(let row=0;row<4;row++){const y=360+row*395;drawTourist(c,{...u,artHeading:[-.75,.75,2.2,-2.2][row]},x,y,row%2?-1:1,1.2+row*1.7,1,0);checks++;}
   }return {image:cv.toDataURL(),checks};
 });assert.equal(poses.checks,20);fs.writeFileSync(path.join(out,'tourists-guest-headings.png'),Buffer.from(poses.image.split(',')[1],'base64'));
 const physics=await p.evaluate(()=>{
   const world=TouristFX.create(),u=nedryLook(25);TouristFX.burst(world,150,100,240,u,1);const start=world.particles.length;
   const cv=document.createElement('canvas');cv.width=1000;cv.height=450;const c=cv.getContext('2d');c.fillStyle='#27322e';c.fillRect(0,0,1000,450);
   TouristFX.update(world,.17);c.save();c.scale(2,2);TouristFX.drawAir(c,world);c.restore();const before=JSON.stringify(world);for(let i=0;i<8;i++){TouristFX.drawGround(c,world);TouristFX.drawAir(c,world);}if(before!==JSON.stringify(world))throw Error('Effect drawing mutated physics');
   for(let i=0;i<180;i++)TouristFX.update(world,1/60);const landed=world.decals.length,chunks=world.particles.filter(p=>p.chunk&&p.landed).length;
   for(let i=0;i<60;i++)TouristFX.burst(world,150,100,240,u,1);TouristFX.update(world,2);const bounded=world.particles.length<=240&&world.decals.length<=100;
   for(let i=0;i<25;i++)TouristFX.update(world,1);return {start,landed,chunks,bounded,cleared:world.particles.length===0&&world.decals.length===0};
 });assert.ok(physics.start>=36&&physics.landed>0&&physics.chunks>0&&physics.bounded&&physics.cleared);console.log('PASS: directional blood lands as decals and debris; rendering is pure; effect budgets and expiry hold');
 // Run the actual homepage bite, then render the same moment repeatedly.
 await p.evaluate(async()=>{
   await Creatures.ready(['trex']);toMenu();G.state='review';menuDinos=[];menuTourists=[];menuProps=[];menuPuffs=[];menuSpawnT=1e9;menuTimmy=null;menuLoo=null;
   const look=hammondLook(39),d={...DINOS.trex,key:'trex',x:1000,y:420,size:145,dir:1,vx:0,stride:0,phase:1.2,alpha:1,artView:.28},tr={x:1165,y:420,size:67,look,shirt:look.shirt,dir:1,phase:1,alpha:1,prey:d,caught:true,fate:'doomed',doomed:true};
   d.eat={t:.46,tr};menuDinos.push(d);menuTourists.push(tr);menuScene(.04);if(!d.eat.bit||!menuTouristFX.particles.length)throw Error('Actual homepage bite did not emit');
   for(let i=0;i<15;i++)menuScene(1/60);
   const before=JSON.stringify(menuTouristFX),cv=document.createElement('canvas');cv.width=1500;cv.height=1000;const c=cv.getContext('2d');for(let i=0;i<10;i++)drawMenuDino(c,d);if(before!==JSON.stringify(menuTouristFX))throw Error('Dinosaur drawing emits gore');
 });await p.screenshot({path:path.join(out,'tourists-home-bite-desktop.png')});
 const game=await p.evaluate(()=>{
   startLevel(0,'fresh',1);G.state='review';G.wave=10;spawnDino('blue',0,true);const d=G.dinos.find(d=>d.key==='blue'||d.def===DINOS.blue);if(!G.clever)throw Error('Missing warden scene');G.cinT=0;G.banner=null;d.entranceT=0;let bite=false;
   for(let i=0;i<1600&&G.clever;i++){updateDinos(1/60);updateCleverGirl(1/60);TouristFX.update(G.touristFX,1/60);if(G.clever?.bit){bite=true;break;}}
   const particles=G.touristFX.particles.length;startLevel(0,'fresh',1);G.state='review';return {bite,particles,reset:G.touristFX.particles.length===0};
 });assert.ok(game.bite&&game.particles>0&&game.reset);console.log('PASS: actual homepage and warden bites use the shared effects; starting a map resets match gore');
 const perf=await p.evaluate(()=>{const c=document.createElement('canvas').getContext('2d'),cast=Array.from({length:8},()=>randomTouristLook(14,true));const start=performance.now();for(let f=0;f<36;f++)for(const u of cast)drawTourist(c,u,100,100,1,f/36*Math.PI*2,1,0);return {ms:performance.now()-start,...Tourists.stats()};});
 assert.ok(perf.models<=24&&perf.sprites<=192&&perf.spritePixels<=4194304);console.log('PASS: bounded model and sprite caches', {frames:36,actors:8,milliseconds:Math.round(perf.ms),spritePixels:perf.spritePixels});
 await p.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';G.paused=true;spawnTourists();for(let i=0;i<180;i++)updateTourists(1/60);render(0);});await p.screenshot({path:path.join(out,'tourists-wave1-desktop.png')});
 const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});await phone.route('https://**/*',r=>r.abort());const mp=await phone.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(base);await mp.evaluate(()=>{save.settings.mute=true;G.state='review';menuSpawnT=1e9;menuDinos=[];menuTourists=[];const u=nedryLook(23);menuTourists.push({x:330,y:330,dir:1,phase:1.2,alpha:1,look:u,hero:'nedry',fate:'safe',vx:0});menuScene(0);});await mp.screenshot({path:path.join(out,'tourists-home-phone.png')});await mp.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';G.paused=true;spawnTourists();for(let i=0;i<160;i++)updateTourists(1/60);render(0);});await mp.screenshot({path:path.join(out,'tourists-wave1-phone.png')});assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // A context lost during play must immediately hand each pose back to Canvas.
 const loss=await p.evaluate(()=>{const ext=Tourists.context().getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});assert.ok(loss);await p.waitForFunction(()=>!Tourists.available);
 const fallback=await browser.newContext({serviceWorkers:'block'});await fallback.route('https://**/*',r=>r.abort());await fallback.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:native.call(this,type,...args);};});const f=await fallback.newPage();f.on('pageerror',e=>errors.push(e.message));await f.goto(base);assert.ok(await f.evaluate(()=>{G.state='review';save.settings.mute=true;const cv=document.createElement('canvas');cv.width=900;cv.height=600;const c=cv.getContext('2d'),u=muldoonLook(65);drawTourist(c,u,100,200,1,1,1,0);drawTouristSitting(c,u,200,200,1,1,1);drawTouristKneelAim(c,u,300,200,1,1,1);drawTouristClimb(c,u,400,200,1,1,1);drawTouristSeated(c,u,500,200,1,1,1);drawTouristZapped(c,timmyLook(65),600,200,1,0,.5,1);drawMenuVictim(c,{look:u,shirt:u.shirt},{x:400,y:400},1);return !Tourists.available&&c.getImageData(0,0,900,600).data.some((v,i)=>i%4===3&&v>0);}));console.log('PASS: all Canvas poses without WebGL, runtime context loss and phone layout');
 const offline=await browser.newContext();await offline.route('https://**/*',r=>r.abort());const op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.waitForFunction(()=>navigator.serviceWorker.controller);assert.ok(await op.evaluate(async()=>{const cache=await caches.open('dino-defense-v57');return !!await cache.match('js/tourists.js')&&!!await cache.match('js/tourist-fx.js');}));await offline.setOffline(true);await op.reload();assert.ok(await op.evaluate(()=>Tourists.available&&typeof TouristFX.burst==='function'));console.log('PASS: installed service worker loads new visitor models and gore offline');
 assert.deepEqual(errors,[]);console.log('All tourist checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
