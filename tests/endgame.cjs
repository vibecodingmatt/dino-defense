'use strict';
// End-to-end final kill -> complete death -> ceremony -> exactly one reward -> results.
// ENDGAME_REVIEW_URL selects production; evidence stays outside runtime assets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=process.env.ENDGAME_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/endgame1700/local');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;const report={cases:[],errors:[]};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.ENDGAME_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 for(const [name,width,height,calm,fallback]of [['desktop',1440,1000,false,false],['phone',390,844,false,false],['small-phone',320,568,false,false],['landscape',844,390,false,false],['reduced',390,844,true,false],['canvas',1000,800,false,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,reducedMotion:calm?'reduce':'no-preference',serviceWorkers:'block'});
  await context.route('https://www.googletagmanager.com/**',r=>r.abort());await context.route('https://**.google-analytics.com/**',r=>r.abort());
  if(fallback)await context.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:native.call(this,type,...args);};});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base);
  await p.evaluate(async()=>{await Creatures.ready();save.settings.mute=true;save.settings.music=false;startLevel(0,'fresh',1);G.state='review';G.paused=false;G.autoTimer=-1;G.tourists=[];});
  const walking=await p.evaluate(()=>{
   const results=[];for(const key of Object.keys(BOSS_DEATHS)){
    G.dinos=[];G.fx=[];G.clever=null;G.shake=0;spawnDino(key,pathForKey(key),true);const d=G.dinos.at(-1);d.noHurt=false;d.dist=200;
    const initial=d.dist;let max=G.shake;for(let i=0;i<360;i++){updateDinos(1/60);max=Math.max(max,G.shake);}
    if(max!==0||d.dist<=initial)throw Error('Boss still shakes the camera or cannot walk: '+key+' '+max);results.push(key);
   }return results;
  });assert.equal(walking.length,9);
  const start=await p.evaluate(()=>{
   startLevel(0,'fresh',1);G.state='review';G.paused=false;G.autoTimer=-1;G.towers=[];G.tourists=[];G.dinos=[];G.spawnQ=[];G.fx=[];G.corpses=[];G.clever=null;G.wave=WAVES_PER_LEVEL;G.waveActive=true;G.speed=10;G.runCheated=false;
   G.stat.kills=1543;G.stat.dnaWaves=320;G.stat.dnaKills=430;G.dnaRun=750;
   spawnDino('drex',0,true);const d=G.dinos.at(-1);d.dist=G.paths[0].len*.45;d.phase=.7;d.hp=1;d.entranceT=0;
   damage(d,10,true,{key:'missile',ulv:2,x:0});G.corpses[0].seed=41.73;G.banner=null;G.cinT=0;G.texts=[];
   step(.01);step(.01);if(!G.victoryPending||G.over||G.speed!==1)throw Error('Final death fails to hold victory at real time');
   window.deathEvents=[];window.originalEndgameSFX={...SFX};for(const key of Object.keys(SFX))SFX[key]=()=>deathEvents.push(key);
   return {held:G.victoryPending,speed:G.speed,duration:G.corpses[0].dur};
  });
  const death=await p.evaluate(()=>{
   const source=G.corpses[0],cv=document.createElement('canvas');cv.width=1500;cv.height=800;const gc=cv.getContext('2d'),times=[.4,1.9,2.8,3.05,3.6,6.8],cost=[];
   const before=JSON.stringify(source),random=Math.random,events=deathEvents.length;Math.random=()=>{throw Error('Death draw consumes simulation randomness');};
   try{for(const [i,t]of times.entries()){
    gc.save();gc.translate(i%3*500,Math.floor(i/3)*400);gc.beginPath();gc.rect(0,0,500,400);gc.clip();gc.fillStyle='#14201f';gc.fillRect(0,0,500,400);
    const f={...source,size:82,x:250,y:295,dir:1,artLocalHeading:.16,t},copy=JSON.stringify(f),begin=performance.now();drawBossDeath(gc,f);cost.push(performance.now()-begin);
    if(JSON.stringify(f)!==copy)throw Error('Death draw mutated its corpse');gc.fillStyle='#eee';gc.font='16px sans-serif';gc.fillText(t+' seconds',16,28);gc.restore();
   }}finally{Math.random=random;}
   if(JSON.stringify(source)!==before||deathEvents.length!==events)throw Error('Death rendering advances state or emits sound');
   return {png:cv.toDataURL().split(',')[1],cost};
  });fs.writeFileSync(path.join(out,name+'-drex-beats.png'),Buffer.from(death.png,'base64'));delete death.png;
  await p.evaluate(()=>{const t=G.corpses[0].t;G.corpses[0].t=3.6;render(0);G.corpses[0].t=t;});await p.screenshot({path:path.join(out,name+'-drex-burst.png')});
  const transition=await p.evaluate(()=>{
   while(G.corpses.length&&G.corpses[0].t<G.corpses[0].dur-.09)step(.05);
   if(!G.victoryPending||G.over||G.celebration||!document.querySelector('#victoryShow').classList.contains('hidden'))throw Error('Victory covers the unfinished D-Rex death');
   for(let i=0;i<5&&!G.over;i++)step(.05);
   if(!G.over||G.victoryPending||G.corpses.length||!G.celebration)throw Error('Victory never starts');
   const banked=save.dna,show=G.celebration;victory();if(save.dna!==banked||G.celebration!==show)throw Error('Victory awards twice');
   const events=[...deathEvents];if(events.filter(e=>e==='shellImpact').length!==1||events.filter(e=>e==='boom').length!==2||events.some(e=>['roar','bossDie','snarl'].includes(e)))throw Error('Bad death audio beats '+events);
   return {banked,events,summary:G.celebration.summary};
  });
  await p.evaluate(()=>{updateVictory(3.5);renderVictory();});await p.screenshot({path:path.join(out,name+'-victory.png')});
  if(name==='desktop'){
   const begin=await p.evaluate(()=>{G.state='playing';G.speed=10;return G.celebration.t;});
   await p.waitForTimeout(350);
   const advanced=await p.evaluate(()=>{G.state='review';return G.celebration.t;})-begin;
   assert.ok(advanced>.1&&advanced<.9,'Ceremony must advance in the real frame loop independently of 10x combat');
  }
  const ceremony=await p.evaluate(()=>{
   const before=JSON.stringify(G.celebration),sounds=deathEvents.length,random=Math.random;Math.random=()=>{throw Error('Celebration draw consumes random state');};
   try{for(let i=0;i<12;i++)renderVictory();}finally{Math.random=random;}
   if(before!==JSON.stringify(G.celebration)||sounds!==deathEvents.length)throw Error('Celebration renderer owns clock or sound');
   Object.defineProperty(document,'hidden',{configurable:true,value:true});updateVictory(.5);delete document.hidden;
   if(before!==JSON.stringify(G.celebration))throw Error('Hidden tab advances the ceremony');
   const button=document.querySelector('#victorySkip').getBoundingClientRect(),title=document.querySelector('#victoryShow h2').getBoundingClientRect(),cv=document.querySelector('#victorySky');
   if(button.top<0||button.bottom>innerHeight||title.left<0||title.right>innerWidth)throw Error('Victory does not fit the viewport');
   if(document.querySelector('#victoryShow').scrollWidth>innerWidth)throw Error('Ceremony overflows horizontally');
   if(cv.width*cv.height>2560000)throw Error('Unbounded victory canvas');
   return {title:title.width,buttonBottom:button.bottom,canvasPixels:cv.width*cv.height,reduced:G.celebration.reduced,stats:EndgameFX.stats()};
  });
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'victorySkip');
  if(name==='desktop'){
   await p.evaluate(()=>{updateVictory(4.0);renderVictory();});await p.screenshot({path:path.join(out,name+'-victory-finale.png')});
   await p.evaluate(()=>{updateVictory(5);});
  }else if(name==='phone'){await p.locator('#victorySkip').tap();}
  else await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>!G.celebration&&document.querySelector('#victoryShow').classList.contains('hidden')&&!document.querySelector('#victory').classList.contains('hidden')),true);
  assert.equal(await p.evaluate(()=>document.querySelector('#victory').contains(document.activeElement)),true);
  const end=await p.evaluate(()=>{const dna=save.dna;finishVictory();updateVictory(100);if(save.dna!==dna)throw Error('Dismissal changes reward');Object.assign(SFX,originalEndgameSFX);toMenu();if(!document.querySelector('#victoryShow').classList.contains('hidden'))throw Error('Celebration leaks into homepage');startLevel(0,'fresh',1);G.state='review';return {over:G.over,show:!!G.celebration};});assert.deepEqual(end,{over:false,show:false});
  report.cases.push({name,walking,start,death,transition,ceremony});console.log('PASS:',name,'boss camera, D-Rex beats, victory hold, single rewards, pure renders, full-screen ceremony and dismissal');await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('https://www.googletagmanager.com/**',r=>r.abort());const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();
 assert.equal(await p.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';save.settings.mute=true;G.wave=100;victory();updateVictory(3.4);renderVictory();return typeof EndgameFX.drawDrex==='function'&&!document.querySelector('#victoryShow').classList.contains('hidden');}),true);await p.screenshot({path:path.join(out,'offline-victory.png')});await context.close();
 assert.deepEqual(report.errors,[]);report.base=base;report.testedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: offline finale module and ceremony; zero browser errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.closeAllConnections();server.close();});
