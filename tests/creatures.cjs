'use strict';
/* Complete browser roster: anatomy, gait, art integration, interaction, offline
   and graphics fallback. Runs with Chrome and playwright-core, no build step. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review');fs.mkdirSync(out,{recursive:true});
const results=[],errors=[],pass=(test,detail)=>{results.push({test,detail});console.log('PASS:',test,detail||'');};
for(const file of ['creature-meshes','creature-species','creature-anatomy','creatures','creature-guide','game','data','draw'])new vm.Script(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),{filename:file});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});await context.route('https://**/*',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.evaluate(()=>{G.state='review';save.settings.mute=true;});
 assert.ok(await page.evaluate(()=>Creatures.available),await page.evaluate(()=>Creatures.error));
 const skins=await page.evaluate(async()=>{const loaded=await Creatures.ready();return {loaded:loaded.filter(Boolean).length,errors:Object.keys(DINOS).filter(k=>!Creatures.model(k).joinedSkin).map(k=>[k,Creatures.model(k).skinError])};});
 assert.equal(skins.loaded,33,JSON.stringify(skins.errors));pass('All 33 Blender skin assets decompress and replace the fallback geometry',skins);
 const profiles=await page.evaluate(()=>{let samples=0;for(const key of Object.keys(DINOS))for(const section of ['body','head','neck','jaw']){const rows=Creatures.model(key).anatomy[section],points=CreatureAnatomy.profileSamples(rows,12);for(let i=1;i<points.length;i++){if(points[i].p[0]<=points[i-1].p[0])throw Error('Folded profile '+key+' '+section);samples++;}}return samples;});
 pass('Unequally spaced anatomical sections never fold back through the skin',profiles);
 const anatomy=await page.evaluate(()=>{
   let planted=0,maxVertices=0,maxBones=0,maxFootError=0,maxLoopError=0;
   const keys=Object.keys(DINOS);if(keys.join()!==Object.keys(CreatureMeshes.catalog).join())throw Error('Roster mismatch');
   for(const key of keys){
     const m=Creatures.model(key),v=m.vertices,stride=m.vertexStride;if(!m.anatomy||stride!==17)throw Error('Unrevised species '+key);maxVertices=Math.max(maxVertices,v.length/stride);maxBones=Math.max(maxBones,m.bones.length);
     if([...v].some(x=>!Number.isFinite(x)))throw Error('Nonfinite geometry '+key);
     for(let i=0;i<v.length;i+=stride)if(v[i+12]>=48||v[i+15]>=48||v[i+16]<0||v[i+16]>1||v[i+14]<0||v[i+14]>=13||Math.hypot(v[i+3],v[i+4],v[i+5])<.5)throw Error('Invalid mesh channels '+key+' at '+i);
     for(let frame=0;frame<32;frame++){
       const ph=frame/32*Math.PI*2,p=CreatureMeshes.pose(m,ph,.4),repeat=CreatureMeshes.pose(m,ph+Math.PI*2,.4);
       for(let j=0;j<p.length;j++){if(!Number.isFinite(p[j]))throw Error('Invalid bone '+key);maxLoopError=Math.max(maxLoopError,Math.abs(p[j]-repeat[j]));}
       for(const leg of m.rig.legs){const f=CreatureAnatomy.foot(ph,leg.offset,leg.span,leg.duty,leg.lift);if(f.planted){planted++;maxFootError=Math.max(maxFootError,Math.abs(p[leg.toe*16+13]));}}
     }
     // A stance foot travels backwards relative to the body by exactly the
     // forward distance travelled by the animal, on horizontal and vertical roads.
     for(const yaw of [0,Math.PI/2,Math.PI])for(const leg of m.rig.legs){
       const ph=(.2-leg.offset)*Math.PI*2,dp=.015,one=CreatureAnatomy.foot(ph,leg.offset,leg.span,leg.duty,leg.lift),two=CreatureAnatomy.foot(ph+dp,leg.offset,leg.span,leg.duty,leg.lift),advance=(m.rig.stride)*dp/(Math.PI*2);
       maxFootError=Math.max(maxFootError,Math.abs((two.x-one.x+advance)*Math.cos(yaw)),Math.abs((two.x-one.x+advance)*Math.sin(yaw)*Creatures.GROUND));
     }
   }return {species:keys.length,plantedSamples:planted,maxVertices,maxBones,maxFootError,maxLoopError};
 });assert.equal(anatomy.species,33);assert.ok(anatomy.maxBones<=48);assert.ok(anatomy.maxLoopError<1e-5);assert.ok(anatomy.maxFootError<1e-5);pass('All 33 rigs stay finite, loop seamlessly and plant their feet without reverse motion or sliding',anatomy);
 const visuals=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d',{willReadFrequently:true});let minPixels=Infinity,minWidth=Infinity;const hashes=[];
   for(const key of Object.keys(DINOS))for(let angle=0;angle<12;angle++){
     const d={...DINOS[key],key,size:39,artHeading:angle*Math.PI/6};c.clearRect(0,0,256,256);drawDino(c,d,128,188,1,.6,1,0);const pixels=c.getImageData(0,0,256,256).data;let count=0,left=256,right=0;
     for(let i=3;i<pixels.length;i+=4)if(pixels[i]>200){count++;const x=((i-3)/4)%256;left=Math.min(left,x);right=Math.max(right,x);}
     minPixels=Math.min(minPixels,count);minWidth=Math.min(minWidth,right-left);if(angle===0)hashes.push(cv.toDataURL());
   }
   return {headings:396,minPixels,minWidth,distinct:new Set(hashes).size,cache:Creatures.cacheBytes,limit:Creatures.cacheLimit,sprites:Creatures.cachedSprites};
 });assert.ok(visuals.minPixels>70);assert.ok(visuals.minWidth>7);assert.equal(visuals.distinct,33);assert.ok(visuals.sprites<=visuals.limit);pass('All species remain solid through 396 heading checks, including head-on views',visuals);
 const colors=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d',{willReadFrequently:true});const d={...DINOS.velociraptor,key:'velociraptor',size:42,phase:.4,artHeading:.3};
   function snap(){c.clearRect(0,0,256,256);drawDino(c,d,128,180,1,.4,1,0);return Array.from(c.getImageData(0,0,256,256).data);}
   Creatures.prepare([d]);const original=snap();d.pal={body:'#a623a0',belly:'#ecb8e8',accent:'#331055'};const pink=snap();d.pal={body:'#239356',belly:'#c1efb9',accent:'#113322'};const green=snap();d.pal=DINOS.velociraptor.pal;const restored=snap();
   // Inspection reuses the WebGL surface; it must never overwrite the copied
   // live atlas or invalidate a paused creature's prepared pose.
   Creatures.inspect(c,{...DINOS.trex,key:'trex'},128,180,30,2,2,.8);const afterInspect=snap();
   const start=JSON.stringify(d);for(let i=0;i<5;i++)snap();
   const difference=(a,b)=>a.reduce((total,v,i)=>total+Math.abs(v-b[i]),0)/a.length;
   return {distinct:new Set([original.join(),pink.join(),green.join()]).size,restored:difference(original,restored)<.1,atlasStable:difference(afterInspect,original)<.1,pure:start===JSON.stringify(d),delta:[difference(original,restored),difference(afterInspect,original)]};
 });console.log('Palette verification:',colors);assert.equal(colors.distinct,3);assert.ok(colors.restored&&colors.atlasStable&&colors.pure);pass('Custom paint variants remain distinct; status/inspection renders cannot corrupt live skins or advance animation',colors);
 const displays=await page.evaluate(()=>{
   startLevel(0,'fresh',1);G.state='review';G.paused=false;G.dinos=[];G.towers=[];G.fx=[];G.texts=[];G.spawnQ=[];G.tourists=[];
   for(let i=0;i<8;i++){spawnDino('dilophosaurus',0,false);const d=G.dinos.at(-1);d.speed=6;d.dist=100;d.entranceT=0;}
   const actors=G.dinos.slice(),periods=actors.map(d=>d.frillPeriod),cycles=actors.map(()=>0),closed=actors.map(()=>0);let staggered=0,movingDisplays=0;
   for(let frame=0;frame<960;frame++){
     const previous=actors.map(d=>({open:d.frillOpen,phase:d.phase,dist:d.dist}));updateDinos(1/30);
     actors.forEach((d,i)=>{if(d.frillOpen<0||d.frillOpen>1)throw Error('Invalid frill opening');if(d.frillOpen>.98&&previous[i].open<=.98)cycles[i]++;if(d.frillOpen===0)closed[i]++;if(d.frillOpen>.8&&d.phase>previous[i].phase&&d.dist>previous[i].dist)movingDisplays++;});
     if(Math.max(...actors.map(d=>d.frillOpen))-Math.min(...actors.map(d=>d.frillOpen))>.8)staggered++;
   }
   const d=actors[0],cv=document.createElement('canvas');cv.width=cv.height=300;const c=cv.getContext('2d');d.phase=.4;d.artHeading=.7;d.size=55;d.artRoar=0;
   function snap(open,prepared){d.frillOpen=open;if(prepared)Creatures.prepare([d]);c.clearRect(0,0,300,300);drawDino(c,d,150,215,1,d.phase,1,0);return cv.toDataURL();}
   // Same gait and closed jaw: both uncached and prepared rendering must notice
   // the frill alone. Otherwise a stopped animal's display freezes in the atlas.
   const cachedChanges=snap(0,false)!==snap(1,false),preparedChanges=snap(0,true)!==snap(1,true),before=JSON.stringify(d);
   for(let i=0;i<20;i++){Creatures.prepare([d]);drawDino(c,d,150,215,1,d.phase,1,0);}const pure=before===JSON.stringify(d);
   const m=Creatures.model('dilophosaurus'),shut=CreatureMeshes.pose(m,.4,0,0),open=CreatureMeshes.pose(m,.4,0,1),jaw=m.rig.jawBone*16;
   if(shut.slice(jaw,jaw+16).some((n,i)=>n!==open[jaw+i]))throw Error('Frill display opens jaw');
   G.paused=true;G.state='playing';return {cycles,closed,periods,staggered,movingDisplays,cachedChanges,preparedChanges,pure,clock:d.frillClock};
 });
 assert.ok(displays.cycles.every(n=>n>=3));assert.ok(displays.closed.every(n=>n>500));assert.ok(displays.periods.every(n=>n>=7&&n<=11));assert.ok(displays.staggered>300&&displays.movingDisplays>500);assert.ok(displays.cachedChanges&&displays.preparedChanges&&displays.pure);
 await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>G.dinos[0].frillClock),displays.clock);await page.evaluate(()=>{G.state='review';G.paused=false;});
 pass('Walking Dilos open and fold staggered frills repeatedly, independently of jaws; rendering and pause preserve their clocks',displays);
 const homeColors=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=2;const c=cv.getContext('2d',{willReadFrequently:true});const checked=[];
   for(const key of MENU_BOSSES){menuDinos=[];menuTourists=[];menuTimmy=null;menuLoo=null;spawnMenuDino(1600,1000,key);const d=menuDinos[0];
     for(const value of Object.values(d.pal)){c.fillStyle=value;c.fillRect(0,0,2,2);const expected=c.getImageData(0,0,1,1).data,actual=CreatureMeshes.rgb(value);if(actual.some((n,i)=>!Number.isFinite(n)||Math.abs(n*255-expected[i])>1))throw Error('Homepage palette corruption '+key+' '+value);}
     Creatures.prepare([d],true);if(Creatures.atlasBytes>2e6)throw Error('Oversized single-roamer atlas');checked.push(key);
   }menuDinos=[];menuTourists=[];menuTimmy=null;menuLoo=null;return checked;
 });assert.equal(homeColors.length,8);assert.ok(homeColors.includes('therizinosaurus'));pass('All eight actual homepage palettes match Canvas colors, including shaded RGB colors, in the detailed atlas',homeColors);
 const homeTheri=await page.evaluate(()=>{
   toMenu();G.state='review';const random=Math.random,card=menuCard;menuDinos=[];menuTourists=[];menuTimmy=null;menuLoo=null;
   try{
     // Select the ordinary scene and the final roamer slot through the real
     // random path, without passing a forced species or replacing its picker.
     menuCard=[];Math.random=()=>1-1e-6;spawnMenuDino(1600,1040);
   }finally{Math.random=random;menuCard=card;}
   const d=menuDinos[0];if(d.key!=='therizinosaurus')throw Error('Therizinosaurus absent from random homepage pool');
   d.x=400;d.y=800;menuSpawnT=999;const start={x:d.x,phase:d.phase};
   for(let i=0;i<40;i++)menuScene(1/30);
   const result={key:d.key,moved:(d.x-start.x)*d.dir,phase:d.phase-start.phase,feeding:!!d.eat,tourists:menuTourists.length,atlas:Creatures.atlasBytes};
   menuDinos=[];menuTourists=[];return result;
 });assert.ok(homeTheri.moved>0&&homeTheri.phase>0&&!homeTheri.feeding);assert.equal(homeTheri.tourists,0);pass('Therizinosaurus can be selected randomly and walks through the actual homepage scene',homeTheri);
 const masks=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=320;const c=cv.getContext('2d',{willReadFrequently:true});
   function snap(key,mask){const d={...DINOS[key],key,size:50,deathMask:mask};c.clearRect(0,0,320,320);drawDino(c,d,160,230,1,.4,1,0);let n=0;for(const a of c.getImageData(0,0,320,320).data.filter((_,i)=>i%4===3))if(a>200)n++;return n;}
   if(snap('drex',DREX_BLAST_MASK)!==0)throw Error('D-Rex blast leaves duplicate anatomy in detached pieces');
   return Object.keys(DINOS).filter(k=>DINOS[k].boss).map(key=>{const all=snap(key,null),masked=snap(key,{head:1,lowerJaw:1,tail:1,nearLeg:1,wingNear:1});if(!(masked>0&&masked<all))throw Error('Death mask ineffective '+key);if(snap(key,{head:1})!==snap(key,{head:1,lowerJaw:1}))throw Error('Floating jaw after decapitation '+key);return key;});
 });assert.equal(masks.length,9);pass('All nine boss finales can detach anatomy from the actual model',masks);
 await page.evaluate(()=>{toMenu();G.paused=false;});await page.locator('#btnCreatures').click();assert.ok(await page.evaluate(()=>G.paused&&G.creatureInspection));await page.keyboard.press('Digit9');assert.equal(await page.evaluate(()=>G.placing),null);
 for(const key of ['blue','drex','pteranodon','spinosaurus','mosasaurus','trex']){await page.locator('.cg-roster button[data-key="'+key+'"]').click();await page.waitForTimeout(70);}
 await page.locator('.cg-roar').click();await page.waitForTimeout(650);await page.screenshot({path:path.join(out,'creatures-desktop.png')});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>G.paused||G.creatureInspection),false);assert.ok(await page.locator('#btnCreatures').evaluate(el=>el===document.activeElement));pass('Collection selection, jaw motion, keyboard isolation, Escape, focus and match state restoration');
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const combat=await page.evaluate(async()=>{
   startLevel(0,'fresh',1);G.state='review';G.paused=false;G.wave=50;G.dinos=[];G.towers=[];G.fx=[];G.texts=[];G.spawnQ=[];G.tourists=[];
   const keys=['velociraptor','triceratops','pyroraptor','trex','baryonyx','stegosaurus'];
   for(let i=0;i<60;i++){spawnDino(keys[i%keys.length],0,false);const d=G.dinos.at(-1);d.dist=50+i*30;d.entranceT=0;}
   const costs=[],frames=[];let previous;
   for(let n=0;n<85;n++){await new Promise(r=>requestAnimationFrame(r));const t=performance.now();if(previous)frames.push(t-previous);previous=t;updateDinos(1/60);render(1/60);costs.push(performance.now()-t);}
   costs.splice(0,15);frames.splice(0,15);costs.sort((a,b)=>a-b);frames.sort((a,b)=>a-b);
   return {alive:G.dinos.length,cpuMedian:costs[35],cpu95:costs[66],frameMedian:frames[34],frame95:frames[65],atlas:Creatures.atlasBytes,cache:Creatures.cacheBytes,error:document.querySelector('#errbox').textContent};
 });assert.equal(combat.error,'');assert.ok(combat.alive>40);assert.ok(combat.cpuMedian<33);assert.ok(combat.atlas<40e6);pass('60-animal moving herd in the real map, with bounded atlas memory (software WebGL timings)',combat);
 const finales=await page.evaluate(()=>{
   const completed=[];G.state='review';G.wave=50;
   for(const key of Object.keys(DINOS).filter(k=>DINOS[k].boss)){
     G.dinos=[];G.corpses=[];G.fx=[];G.texts=[];G.clever=null;spawnDino(key,0,true);const d=G.dinos.at(-1);d.entranceT=0;d.noHurt=false;d.hp=1;d.armor=0;d.cloaked=false;d.dist=500;d.artHeading=Math.PI/2;
     damage(d,1e6,true,{key:'sniper',ulv:2,x:300,y:200});G.state='review';const corpse=G.corpses.at(-1);if(!corpse)throw Error('Missing boss death '+key);
     for(const q of [0,.15,.35,.6,.9]){corpse.t=corpse.dur*q;drawBossDeath(ctx,corpse);}
     completed.push(key);
   }
   return completed;
 });assert.equal(finales.length,9);pass('Real damage triggers and renders all nine boss finales from a vertical travel heading',finales);
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});await phoneContext.route('https://**/*',r=>r.abort());const phone=await phoneContext.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.emulateMedia({reducedMotion:'reduce'});await phone.locator('#btnCreatures').tap();assert.equal(await phone.locator('.cg-motion').textContent(),'Play motion');await phone.locator('#cgSpecies').selectOption('indominus');await phone.screenshot({path:path.join(out,'creatures-phone.png')});
 assert.ok(await phone.evaluate(()=>{const d=document.querySelector('#creatureGuide');return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().width<=innerWidth;}));
 await phone.setViewportSize({width:844,height:390});await phone.screenshot({path:path.join(out,'creatures-landscape.png')});assert.ok(await phone.evaluate(()=>{const d=document.querySelector('#creatureGuide');return d.scrollWidth<=d.clientWidth+1;}));await phoneContext.close();pass('Touch collection fits portrait and landscape, with still models by default under reduced motion');
 const fallback=await browser.newContext({serviceWorkers:'block'});await fallback.route('https://**/*',r=>r.abort());await fallback.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:native.call(this,type,...args);};});const fp=await fallback.newPage();fp.on('pageerror',e=>errors.push(e.message));await fp.goto(base);assert.equal(await fp.evaluate(()=>Creatures.available),false);await fp.locator('#btnCreatures').click();await fp.waitForTimeout(80);await fp.locator('.cg-close').click();await fp.evaluate(()=>{save.settings.mute=true;startLevel(0,'fresh',1);G.state='review';spawnDino('blue',0,true);G.dinos.at(-1).entranceT=0;updateDinos(.016);render(.016);});assert.equal(await fp.locator('#errbox').textContent(),'');
 assert.ok(await fp.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=300;const c=cv.getContext('2d'),d={...DINOS.dilophosaurus,key:'dilophosaurus',size:60,phase:.4,frillOpen:0};
   function snap(){c.clearRect(0,0,300,300);drawDino(c,d,150,215,1,.4,1,0);return cv.toDataURL();}
   const folded=snap();d.frillOpen=1;return folded!==snap();
 }));await fallback.close();pass('WebGL unavailable: collection, combat and independent walking frill displays work in native Canvas');
 const offline=await browser.newContext();await offline.route('https://**/*',r=>r.abort());const op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.reload();await op.waitForFunction(()=>navigator.serviceWorker.controller!==null);await offline.setOffline(true);await op.reload();await op.locator('#btnCreatures').click();assert.equal(await op.locator('.cg-roster button').count(),33);assert.ok(await op.evaluate(()=>Creatures.available));assert.equal(await op.evaluate(async()=>(await Creatures.ready()).filter(Boolean).length),33);await offline.close();pass('All models, animation code and the collection load offline from the updated service worker');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'creatures-verification.json'),JSON.stringify({testedAt:new Date().toISOString(),results,errors},null,2));console.log('All creature checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
