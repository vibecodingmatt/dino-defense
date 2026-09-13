'use strict';
// Actual fence/outhouse story beats, painter purity, bounded caches, phone framing
// and offline/Canvas fallback. SCENERY_REVIEW_URL runs against production.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=process.env.SCENERY_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/scenery1680');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;const errors=[],report={scenes:[],errors};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.SCENERY_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 async function page(options={}){
   const context=await browser.newContext({serviceWorkers:'block',...options});await context.route('https://www.googletagmanager.com/**',r=>r.abort());await context.route('https://**.google-analytics.com/**',r=>r.abort());
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.evaluate(()=>{save.settings.mute=true;G.state='review';});await p.evaluate(()=>Creatures.ready(['trex']));return {context,p};
 }
 for(const [name,width,height]of [['desktop',1440,1000],['phone',390,844],['small-phone',320,568]]){
   const {context,p}=await page({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
   await p.evaluate(()=>{
     window.stageHomeScene=scene=>{
       menuDinos=[];menuTourists=[];menuProps=[];menuPuffs=[];menuTimmy=null;menuLoo=null;menuLooWreck=0;menuAsh=null;menuSpawnT=1e9;menuScenePaused=false;menuT=0;menuFence={live:1,warn:0,surge:0};
       menuTouristFX.particles=[];menuTouristFX.decals=[];spawnMenuDino(innerWidth,innerHeight,'trex',scene);
       menuDinos[0].x=innerWidth*(scene==='timmy'?.12:.88);
     };
     window.stepToBeat=(scene,beat)=>{
       for(let i=0;i<2600;i++){
         menuScene(1/60);
         if(scene==='lawyer'&&(beat==='reveal'?menuLoo?.stage==='reveal':beat==='break'?menuLoo?.stage==='reveal'&&menuLoo.t>.15:beat==='bite'?menuLoo?.d.eat?.bit:beat==='ended'?!menuLoo&&menuLooWreck>0:false))return;
         if(scene==='timmy'&&(beat==='climb'?menuTimmy?.stage==='climb'&&menuTimmy.t>1.1:beat==='warn'?menuTimmy?.stage==='warn':beat==='fly'?menuTimmy?.stage==='fly'&&menuTimmy.t>.08:beat==='land'?!!menuAsh:false))return;
       }throw Error('Scene never reached '+scene+'/'+beat);
     };
   });
   await p.evaluate(()=>{stageHomeScene('lawyer');menuScene(1/60);});
   await p.screenshot({path:path.join(out,name+'-outhouse-intact.png')});
   await p.evaluate(()=>stepToBeat('lawyer','reveal'));
   const seat=await p.evaluate(()=>{const o=menuLooAt(innerWidth,innerHeight),t=menuLoo.tr;return {x:t.x,expectedX:o.x+o.w*LOO_SEAT_X,y:t.y,ground:o.y,seated:t.seated,hidden:t.hidden,kinds:menuProps.map(p=>p.kind)};});
   assert.equal(seat.x,seat.expectedX);assert.equal(seat.y,seat.ground);assert.ok(seat.seated&&!seat.hidden);assert.ok(seat.kinds.includes('door')&&seat.kinds.includes('roof'));
   await p.evaluate(()=>stepToBeat('lawyer','break'));await p.screenshot({path:path.join(out,name+'-outhouse-break.png')});
   const freeze=await p.evaluate(()=>{
     const before=JSON.stringify({props:menuProps,puffs:menuPuffs,fence:menuFence}),cv=document.getElementById('menuDinos'),c=cv.getContext('2d'),original=Math.random;
     Math.random=()=>{throw Error('Painter consumed random state');};
     try{for(let i=0;i<8;i++){drawMenuFence(c,menuFenceAt(innerWidth,innerHeight),{live:1,warn:.8,surge:1,arcX:220,arcY:180},2.2);drawMenuLoo(c,menuLooAt(innerWidth,innerHeight),false,.8,2.2);drawMenuLoo(c,menuLooAt(innerWidth,innerHeight),true,0,2.2);for(const p of menuProps)drawMenuProp(c,p);for(const p of menuPuffs)drawMenuPuff(c,p);}}
     finally{Math.random=original;}
     return before===JSON.stringify({props:menuProps,puffs:menuPuffs,fence:menuFence});
   });assert.ok(freeze);
   await p.evaluate(()=>stepToBeat('lawyer','bite'));await p.screenshot({path:path.join(out,name+'-outhouse-bite.png')});
   assert.equal(await p.evaluate(()=>menuLoo.tr.dead&&!!menuLoo.d.eat.bit),true);
   await p.evaluate(()=>{stepToBeat('lawyer','ended');for(let i=0;i<1000;i++)menuScene(1/60);});
   assert.equal(await p.evaluate(()=>menuProps.length),0);assert.equal(await p.evaluate(()=>menuLooWreck),0);
   await p.evaluate(()=>stageHomeScene('timmy'));
   await p.evaluate(()=>stepToBeat('timmy','climb'));await p.screenshot({path:path.join(out,name+'-tim-climb.png')});
   await p.evaluate(()=>stepToBeat('timmy','warn'));assert.ok(await p.evaluate(()=>menuFence.warn>0));
   await p.evaluate(()=>stepToBeat('timmy','fly'));
   const discharge=await p.evaluate(()=>({arcX:menuFence.arcX,contactX:menuTimmy.x0,arcY:menuFence.arcY,expectedY:menuTimmy.y0-menuTimmy.tr.look.size*.9,props:menuProps.length,sparks:menuPuffs.filter(p=>p.kind==='spark').length}));
   assert.equal(discharge.arcX,discharge.contactX);assert.equal(discharge.arcY,discharge.expectedY);assert.ok(discharge.sparks>0);
   await p.screenshot({path:path.join(out,name+'-tim-discharge.png')});
   const paused=await p.evaluate(()=>{
     menuScenePaused=true;
     const snapshot=()=>JSON.stringify({t:menuT,props:menuProps,puffs:menuPuffs,ash:menuAsh,fence:menuFence,timT:menuTimmy.t});
     const before=snapshot();for(let i=0;i<40;i++)menuScene(1/60);const after=snapshot();menuScenePaused=false;return before===after;
   });assert.ok(paused,'Paused discharge must not advance or emit smoke');
   await p.evaluate(()=>stepToBeat('timmy','land'));await p.screenshot({path:path.join(out,name+'-tim-landing.png')});
   const landing=await p.evaluate(()=>({x:menuAsh.x,y:menuAsh.y,ground:menuFenceAt(innerWidth,innerHeight).y,tim:!!menuTimmy,stats:HomeScenery.stats()}));
   assert.equal(landing.y,landing.ground);assert.equal(landing.tim,false);assert.ok(landing.x>0&&landing.x<width&&landing.y<height);assert.ok(landing.stats.tiles<=5&&landing.stats.pixels<1000000);
   // Whole painted structures fit the phone scene; the Play controls remain usable above them.
   const framing=await p.evaluate(()=>{const o=menuLooAt(innerWidth,innerHeight),f=menuFenceAt(innerWidth,innerHeight),cta=document.getElementById('btnQuickPlay').getBoundingClientRect(),hub=document.querySelector('.ranger-hub').getBoundingClientRect();return {looLeft:o.x-o.h*.49,looRight:o.x+o.h*.534,fenceLeft:f.x0-f.h*.16,fenceRight:f.x1+f.h*.2,ground:f.y,ctaBottom:cta.bottom,hubTop:hub.top};});
   if(width<500){assert.ok(framing.looLeft>=0&&framing.fenceRight<=width+1);assert.ok(framing.ground<framing.hubTop&&framing.ctaBottom<height);}
   await p.evaluate(()=>{for(let i=0;i<360;i++)menuScene(1/60);});assert.equal(await p.evaluate(()=>menuAsh),null);
   report.scenes.push({name,seat,discharge,landing,framing});await context.close();
   console.log('PASS:',name,'intact/break/reveal/bite/cleanup and climb/warn/discharge/landing; pure painters, pause and bounded caches.');
 }
 const {context,p}=await page();
 report.perf=await p.evaluate(()=>{const cv=document.createElement('canvas');cv.width=1440;cv.height=1000;const c=cv.getContext('2d'),o=menuLooAt(1440,1000),f=menuFenceAt(1440,1000),times=[];for(let i=0;i<180;i++){const start=performance.now();drawMenuFence(c,f,{live:1,warn:0,surge:i%40<10?1:0},i/60);drawMenuLoo(c,o,false,.5,i/60);times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {p95:times[Math.floor(times.length*.95)],cache:HomeScenery.stats()};});console.log('Scenery CPU submission:',report.perf);await context.close();
 const fallback=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});await fallback.route('https://www.googletagmanager.com/**',r=>r.abort());await fallback.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:native.call(this,type,...args);};});
 const fp=await fallback.newPage();fp.on('pageerror',e=>errors.push(e.message));await fp.goto(base);await fp.evaluate(()=>{G.state='review';save.settings.mute=true;menuScene(1/60);});assert.equal(await fp.evaluate(()=>Creatures.available),false);assert.ok(await fp.evaluate(()=>HomeScenery.stats().tiles>=2));
 await fp.evaluate(()=>navigator.serviceWorker.ready);await fp.waitForFunction(()=>!!navigator.serviceWorker.controller);await fallback.setOffline(true);await fp.reload();assert.ok(await fp.evaluate(()=>typeof HomeScenery.fence==='function'));await fp.screenshot({path:path.join(out,'phone-offline-canvas.png')});await fallback.close();
 assert.deepEqual(errors,[]);report.base=base;report.checkedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: scenery and Canvas creatures without WebGL, installed offline module, zero browser errors.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
