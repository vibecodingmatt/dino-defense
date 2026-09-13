'use strict';
// Actual firing/impact routes, independent sound controls, finite original PCM,
// output mix, directional stereo, voice limits, bank failure and offline play.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review/audio1650');fs.mkdirSync(out,{recursive:true});
const raw=zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/audio/effects-v1.bank.gz'))),headerSize=raw.readUInt32LE(),header=JSON.parse(raw.subarray(4,4+headerSize)),pcm=raw.subarray(4+headerSize),hashes=new Set();
assert.equal(header.sampleRate,32000);assert.equal(header.entries.length,126);
for(const e of header.entries){const b=pcm.subarray(e.offset,e.offset+e.length*2);assert.equal(b.length,e.length*2);let peak=0,energy=0,sum=0;for(let i=0;i<e.length;i++){const v=b.readInt16LE(i*2)/32767;peak=Math.max(peak,Math.abs(v));energy+=v*v;sum+=v;}assert.ok(peak>.1&&peak<.9,e.name+' peak');assert.ok(Math.sqrt(energy/e.length)>.02,e.name+' silent');assert.ok(Math.abs(sum/e.length)<.005,e.name+' DC');hashes.add(crypto.createHash('sha256').update(b).digest('hex'));}
assert.equal(hashes.size,126);console.log('PASS: 42 original effects, three distinct performances each, finite PCM and transient headroom');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const errors=[];let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('https://**/*',r=>r.abort());const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
 assert.ok(await p.evaluate(async()=>{await GameAudioFX.prepare();SFX.shot();return AC===null&&GameAudioFX.bankStatus().ready;}));
 await p.evaluate(()=>{save.settings.music=false;save.settings.mute=false;});await p.mouse.click(15,15);
 await p.waitForFunction(()=>AC?.state==='running');assert.ok(await p.evaluate(()=>!!effectAudio()&&!musicTimer));console.log('PASS: no autoplay; real gesture unlocks effects with Music off');
 const prep=await p.evaluate(()=>{const t=performance.now();for(const key of GameAudioFX.names)for(let v=0;v<3;v++)soundFX.buffer(key,v);return {ms:performance.now()-t,...soundFX.stats()};});assert.ok(prep.ms<100&&prep.bytes<=prep.maxBytes&&prep.buffers<126);console.log('PASS: complete bank prepares without real-time synthesis; LRU memory cap holds',prep.ms.toFixed(1)+'ms');
 const routing=await p.evaluate(()=>{
   save.settings.mute=true;startLevel(0,'fresh',1);G.state='review';G.paused=false;
   const names=Object.keys(SFX),saved={...SFX},events=[],result=[];for(const name of names)SFX[name]=o=>events.push({name,...o});
   try{for(const [key,def]of Object.entries(TOWERS)){
     G.dinos=[];G.projs=[];G.fx=[];G.bolts=[];G.clouds=[];G.zapQ=[];G.links=[];G.wave=1;
     const t={key,x:240,y:201,ulv:2,cd:0,angle:0,mode:'first',invested:def.cost};G.towers=[t];
     for(let i=0;i<3;i++){spawnDino('velociraptor',0,false);const d=G.dinos.at(-1);d.dist=270+i*10;d.speed=0;d.hp=d.maxHp=50000;d.armor=0;}
     events.length=0;fireTower(t,.001);const launch=events[0]?.name;
     for(let i=0;i<180;i++){updateProjs(1/120);runZapQ(1/120);updateClouds(1/120);}
     if(!events.length||events.some(e=>e.weapon!==key||e.lv!==2||!Number.isFinite(e.x)))throw Error('Lost position/mute/upgrade identity '+key);
     const all=[...new Set(events.map(e=>e.name))];result.push({key,launch,events:all});
     if(key==='cryo'&&(!all.includes('frost')||all.includes('boom')))throw Error('Cryo still explodes');
     if(key==='mortar'&&!all.includes('shellImpact'))throw Error('Artillery impact missing');
     if(key==='tesla'&&!all.includes('arc'))throw Error('Chain hops silent');
     save.settings.mutedWeapons[key]=true;events.length=0;t.cd=0;fireTower(t,.001);if(events.length)throw Error('Muted weapon fired audio '+key);save.settings.mutedWeapons[key]=false;
   }}finally{Object.assign(SFX,saved);G.towers=[];G.dinos=[];G.projs=[];G.zapQ=[];G.clouds=[];save.settings.mute=false;}
   return result;
 });assert.equal(new Set(routing.map(r=>r.launch)).size,9);console.log('PASS: all nine real weapons have unique firing sounds, correct impact cues and per-weapon gates',routing);
 const deaths=await p.evaluate(()=>{
   const saved={...SFX},random=Math.random,events=[],vocal=new Set(['screech','snarl','bellow','bossDie','roar','trexRoar','pteraWail']);let count=0;
   for(const name of Object.keys(SFX))SFX[name]=()=>events.push(name);
   Math.random=()=>.2; // The previous optional death-cry branch must fire if restored.
   try{
     const bosses=['blue','trex','spinosaurus','indominus','indoraptor','giganotosaurus','drex','whiteptera','mosasaurus'];
     for(const [key,boss]of [...Object.keys(DINOS).map(k=>[k,false]),...bosses.map(k=>[k,true])]){
       G.dinos=[];G.fx=[];G.corpses=[];spawnDino(key,0,boss);const d=G.dinos.at(-1);d.noHurt=false;d.cloaked=false;d.hp=1;G.clever=null;events.length=0;voxTimes=[];
       damage(d,10,true,{key:'cryo',ulv:0,x:0});if(!d.dead||events.some(e=>vocal.has(e)))throw Error('Death vocal '+key+': '+events);count++;
       if(!boss){for(const f of G.fx)WeaponFX.update(f,3,(_,sound)=>SFX[sound]?.());if(!events.includes('shatter'))throw Error('Lost physical finisher '+key);}
     }
     G.fx=[];G.corpses=[];G.towers=[];G.zapQ=[];G.projs=[];G.clouds=[];G.snatch=null;G.waveActive=true;G.spawnQ=[];G.voxAmb=.001;voxTimes=[];events.length=0;step(.002);
     if(events.some(e=>vocal.has(e)))throw Error('Dead herd produces roaming vocals');
     return count;
   }finally{Object.assign(SFX,saved);Math.random=random;G.dinos=[];G.corpses=[];G.fx=[];G.clever=null;G.waveActive=false;}
 });assert.equal(deaths,42);console.log('PASS: all 33 species and nine boss deaths are non-vocal; physical finishers remain audible');
 const rex=await p.evaluate(()=>{const events=[],play=soundFX.play;soundFX.play=(name,o)=>{events.push(name);return true;};
   try{G.dinos=[];spawnDino('trex',0,true);const d=G.dinos[0];d.entranceT=0;for(let i=0;i<180;i++)updateDinos(1/60);const count=events.length;render(0);render(0);if(events.length!==count)throw Error('Rendering emits footsteps');return events;}finally{soundFX.play=play;G.dinos=[];}
 });assert.ok(rex.includes('trexRoar')&&rex.includes('thud'));console.log('PASS: actual T-Rex entrance chooses its signature roar; simulation owns the footfalls');
 const limits=await p.evaluate(()=>{
   G.state='review';soundFX.stop();const original=Math.random;Math.random=()=>{throw Error('Audio consumed gameplay randomness');};
   try{for(let i=0;i<300;i++)for(const name of ['shot','flame','cryo','zap','pulse','missile','gas','thoomp','snipe'])SFX[name]({weapon:name,x:500});SFX.trexRoar();}finally{Math.random=original;}
   const stats=soundFX.stats();toggleMute();const stopped=soundFX.stats().voices===0;const muted=SFX.zap()===false;toggleMute();
   G.state='playing';G.paused=false;SFX.flame({weapon:'flamer'});SFX.gas({weapon:'gas'});G.selected={key:'flamer',ulv:0,mode:'first',x:240,y:201,invested:TOWERS.flamer.cost,kills:0};document.querySelector('#tpMute').click();const remaining=soundFX.stats().voices;
   togglePause();const paused=soundFX.stats().voices===0&&SFX.shot()===false;G.paused=false;G.state='review';save.settings.mutedWeapons.flamer=false;
   return {stats,stopped,muted,remaining,paused};
 });assert.ok(limits.stats.peakVoices<=24&&limits.stats.dropped>100&&limits.stopped&&limits.muted&&limits.paused&&limits.remaining>0);console.log('PASS: bounded rapid-fire mix, isolated weapon mute, immediate global mute and pause',limits);
 const priority=await p.evaluate(async()=>{const ac=new OfflineAudioContext(2,96000,32000),fx=GameAudioFX.create(ac,ac.destination);for(const name of GameAudioFX.names)fx.play(name);const result=fx.stats();await ac.startRendering();return {...result,clean:fx.stats().voices===0};});assert.equal(priority.peakVoices,24);assert.ok(priority.stolen>0&&priority.clean);console.log('PASS: saturated voice cap reserves space for priority cues and retires every source',priority);
 const mix=await p.evaluate(async()=>{
   const rate=32000,ac=new OfflineAudioContext(2,rate*5,rate),master=ac.createGain();master.gain.value=.6;master.connect(ac.destination);const fx=GameAudioFX.create(ac,master);
   for(let i=0;i<12;i++)fx.play('shot',{at:i*.08,pan:-.72});fx.play('trexRoar',{at:1.25});fx.play('shellImpact',{at:2.2,pan:.50});fx.play('shatter',{at:3.5,pan:.65});
   const b=await ac.startRendering(),left=b.getChannelData(0),right=b.getChannelData(1);let peak=0,energy=0,l=0,r=0;
   const wav=new ArrayBuffer(44+b.length*4),v=new DataView(wav);const str=(s,o)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};str('RIFF',0);v.setUint32(4,wav.byteLength-8,true);str('WAVEfmt ',8);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str('data',36);v.setUint32(40,b.length*4,true);
   for(let i=0;i<b.length;i++){for(const x of [left[i],right[i]]){peak=Math.max(peak,Math.abs(x));energy+=x*x;}if(i<rate){l+=left[i]**2;r+=right[i]**2;}v.setInt16(44+i*4,Math.round(left[i]*32767),true);v.setInt16(46+i*4,Math.round(right[i]*32767),true);}
   let text='';const bytes=new Uint8Array(wav);for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return {peak,rms:Math.sqrt(energy/(b.length*2)),stereoRatio:l/r,stats:fx.stats(),wav:btoa(text)};
 });fs.writeFileSync(path.join(out,'battle-mix.wav'),Buffer.from(mix.wav,'base64'));delete mix.wav;assert.ok(mix.peak<.95&&mix.rms>.006&&mix.stereoRatio>4);assert.equal(mix.stats.voices,0);console.log('PASS: rendered battle has headroom, directional stereo and completed source cleanup',mix);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});await mobile.route('https://**/*',r=>r.abort());const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(base);await mp.evaluate(()=>{save.settings.mute=false;save.settings.music=false;});await mp.touchscreen.tap(15,15);await mp.waitForFunction(()=>AC?.state==='running');assert.equal(await mp.evaluate(()=>effectAudio().stats().maxVoices),18);console.log('PASS: touch gesture unlock and smaller phone voice budget');
 const failed=await browser.newContext({serviceWorkers:'block'});await failed.route('https://**/*',r=>r.abort());await failed.route('**/effects-v1.bank.gz',r=>r.abort());const fp=await failed.newPage();fp.on('pageerror',e=>errors.push(e.message));await fp.goto(base);assert.ok(await fp.evaluate(async()=>{const loaded=await GameAudioFX.prepare(),a=GameAudioFX.render('shot',0);return !loaded&&a.some(x=>Math.abs(x)>.1);}));console.log('PASS: bank request failure retains the original synthesis fallback');
 const offline=await browser.newContext();await offline.route('https://**/*',r=>r.abort());const op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.waitForFunction(()=>navigator.serviceWorker.controller);await offline.setOffline(true);await op.reload();assert.ok(await op.evaluate(async()=>await GameAudioFX.prepare()));console.log('PASS: installed game loads the complete effects bank offline');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({routing,prep,limits,mix,errors},null,2));console.log('All audio checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
