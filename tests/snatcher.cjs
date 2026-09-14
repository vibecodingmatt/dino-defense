'use strict';
// Wave-one Pteranodon: actual exported feet, complete pickup, shared guest
// attachment, pause/resume, rendering purity, mobile and graphics/offline fallbacks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),out=process.env.SNATCH_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/ptera-film/local');fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[root,path.resolve(root,'../war-survival')]}));
const source=vm.createContext({Math,Float32Array});vm.runInContext(['creature-meshes','creature-species','creature-anatomy'].map(n=>fs.readFileSync(path.join(root,'js',n+'.js'),'utf8')).join('\n')+';globalThis.meshes=CreatureMeshes;',source);
const m=source.meshes.build('pteranodon'),bytes=zlib.gunzipSync(fs.readFileSync(process.env.SNATCH_SKIN||path.join(root,'assets/creatures/skinned/pteranodon.mesh.gz'))),exported=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
let footSamples=0;
for(const [label,v]of [['exported',exported],['procedural',m.vertices]])for(const g of m.rig.grips){
 const edges=new Map(),copies=new Map();
 for(let i=0;i<v.length;i+=51){if(v[i+12]!==g.id||v[i+13]!==6)continue;const face=[];
  for(const j of [i,i+17,i+34]){const key=[v[j],v[j+1],v[j+2]].join(',');face.push(key);if(!copies.has(key))copies.set(key,[]);copies.get(key).push(j);}
  for(let j=0;j<3;j++){const key=[face[j],face[(j+1)%3]].sort().join('/');edges.set(key,(edges.get(key)||0)+1);}
 }
 assert.ok(copies.size>300,label+': missing retained leg skin');assert.equal([...edges.values()].filter(n=>n!==2).length,0,label+': perforated leg skin');
 for(let n=0;n<24;n++){
  const pose=source.meshes.pose(m,n/24*Math.PI*2,.4,0,{spread:n/23,reach:n/23,grip:n/23});
  for(const list of copies.values()){let first;for(const j of list){const p=[0,0,0];for(const [bone,w]of [[v[j+12],1-v[j+16]],[v[j+15],v[j+16]]])for(let k=0;k<3;k++)p[k]+=w*(pose[bone*16+k]*v[j]+pose[bone*16+4+k]*v[j+1]+pose[bone*16+8+k]*v[j+2]+pose[bone*16+12+k]);assert.ok(p.every(Number.isFinite));if(first)assert.ok(Math.hypot(...p.map((x,k)=>x-first[k]))<1e-6,'Leg opens during reach');else first=p;footSamples++;}}
 }
}
console.log('PASS: closed exported/fallback leg skin stays welded through reach and grasp',{footSamples});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(b);});});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.SNATCH_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const errors=[],reports=[];
 for(const [name,width,height,mobile]of [['desktop',1440,1000,false],['phone',390,844,true],['small-phone',320,568,true],['landscape',844,390,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});await context.route('https://www.googletagmanager.com/**',r=>r.abort());
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  const report=await p.evaluate(async name=>{
   save.settings.mute=true;save.settings.music=false;G.state='review';await Creatures.ready(['pteranodon']);if(!Creatures.model('pteranodon').joinedSkin)throw Error('Cameo skin not loaded');
   const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1320;const c=sheet.getContext('2d'),scratch=document.createElement('canvas');scratch.width=1280;scratch.height=720;const sc=scratch.getContext('2d');c.fillStyle='#263638';c.fillRect(0,0,sheet.width,sheet.height);let captures=0,attachments=0;
   const maps=[],native=drawTourist;
   for(let map=0;map<(name==='desktop'?LEVELS.length:1);map++){
    startLevel(map,'fresh',1);callWave();G.state='review';G.paused=false;
    const before={lives:G.lives,cash:G.cash,kills:G.stat.kills},phases=[],recorded=new Set();let seen=false,adult=false,finished=false;
    for(let i=0;i<2200;i++){
     updateTourists(1/60);updateSnatch(1/60);const s=G.snatch;
     if(s){seen=true;adult=!s.u.kid;if(phases.at(-1)!==s.phase)phases.push(s.phase);
      if((s.phase==='grab'||s.phase==='carry')&&i%6===0){
       const frame=Creatures.snatchFrame(s),shoulder=Tourists.shoulder(s.u,s.u.phase,s.dir);let draw;
       drawTourist=(ctx,u,x,y,dir,phase,alpha,pitch,air)=>{draw={x,y,air};native(ctx,u,x,y,dir,phase,alpha,pitch,air);};
       try{const beforeDraw=JSON.stringify(s);drawSnatch(sc);if(JSON.stringify(s)!==beforeDraw)throw Error('Drawing changes the scene');}finally{drawTourist=native;}
       if(!draw?.air||Math.hypot(draw.x+shoulder.x*s.u.size-frame.grip.x,draw.y+shoulder.y*s.u.size-frame.grip.y)>1e-6)throw Error('Guest detaches from the feet');attachments++;
      }
      const beat=s.phase==='dive'?(s.t>.8?'brake':s.t>.45?'dive':null):s.phase==='grab'?'grab':s.phase==='carry'?(s.t>.8?'climb':s.t>.35?'carry':null):null;
      if(map===0&&beat&&!recorded.has(beat)){
       recorded.add(beat);const x=400+(captures%2)*800,y=225+Math.floor(captures/2)*440;c.save();c.beginPath();c.rect(x-380,y-210,760,420);c.clip();c.fillStyle='#263638';c.fillRect(x-380,y-210,760,420);c.translate(x,y);c.scale(2.1,2.1);c.translate(-s.x,-s.y);drawSnatch(c);c.restore();c.fillStyle='#d4ddcf';c.font='18px sans-serif';c.fillText(beat,x-340,y-180);captures++;
       if(beat==='carry'){render(0);window.snatchSceneCapture=document.querySelector('#game').toDataURL();}
      }
     }else if(seen){finished=true;break;}
    }
    if(!finished||!adult||phases.join()!=='omen,dive,grab,carry')throw Error('Incomplete adult abduction on map '+map+': '+phases);
    if(G.lives!==before.lives||G.cash!==before.cash||G.stat.kills!==before.kills)throw Error('Cameo changed match accounting');maps.push(map);
   }
   // Exercise both headings, extreme flap phases and shared rendered bounds.
   let directions=0;const u={...G.tourists[0],...randomTouristLook(14,true),tall:1,phase:1,arms:'flail',kid:false};
   for(const dir of [-1,1])for(let i=0;i<24;i++){
    const s={phase:'carry',t:.5,u,dir,size:46,x:640,y:350,gy:450,ph:i/24*Math.PI*2,spread:1,talon:1};G.snatch=s;const a=JSON.stringify(s);drawSnatch(sc);drawSnatch(sc);if(a!==JSON.stringify(s))throw Error('Repeated draw advances flight');directions++;
   }
   window.snatchSheet=sheet.toDataURL();
   startLevel(0,'fresh',1);callWave();G.snatch=null;for(const tourist of G.tourists)tourist.snatchAt=-1;const victim=G.tourists.find(t=>!t.kid);victim.dist=450;updateTourists(.001);beginSnatch(victim);for(let i=0;i<171;i++){updateTourists(1/60);updateSnatch(1/60);}G.paused=true;updateHUD();
   return {maps,attachments,directions,vertices:Creatures.model('pteranodon').count};
  },name);
  fs.writeFileSync(path.join(out,name+'-sequence.png'),Buffer.from((await p.evaluate(()=>snatchSheet)).split(',')[1],'base64'));
  fs.writeFileSync(path.join(out,name+'-scene.png'),Buffer.from((await p.evaluate(()=>snatchSceneCapture)).split(',')[1],'base64'));
  const frozen=await p.evaluate(()=>JSON.stringify(G.snatch));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>JSON.stringify(G.snatch)),frozen);
  await p.screenshot({path:path.join(out,name+'-paused.png'),fullPage:true});
  await p.locator('#btnResume')[mobile?'tap':'click']();await p.waitForFunction(()=>!G.snatch,null,{timeout:10000});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await p.locator('#errbox').isVisible(),false);
  reports.push({name,...report});console.log('PASS:',name,'complete cameo, exact passenger attachment, headings, pure drawing, pause/resume',report);await context.close();
 }
 for(const mode of ['missing-skin','canvas','offline']){
  const context=await browser.newContext({serviceWorkers:mode==='offline'?'allow':'block'});await context.route('https://www.googletagmanager.com/**',r=>r.abort());
  if(mode==='missing-skin')await context.route('**/pteranodon.mesh.gz',r=>r.abort());
  if(mode==='canvas')await context.addInitScript(()=>{const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...a){return /^webgl/.test(k)?null:orig.call(this,k,...a);};});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  if(mode==='offline'){await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();}
  const state=await p.evaluate(async()=>{save.settings.mute=true;G.state='review';const loaded=await Creatures.ready(['pteranodon']);startLevel(0,'fresh',1);callWave();G.state='review';const u=G.tourists.find(t=>!t.kid);G.snatch={phase:'carry',t:.5,u,dir:1,size:46,x:640,y:350,gy:450,ph:1.2,spread:1,talon:1};render(0);return {available:Creatures.available,loaded:loaded[0],frame:!!Creatures.snatchFrame(G.snatch)};});
  assert.equal(state.available,mode!=='canvas');assert.equal(state.frame,mode!=='canvas');assert.equal(!!state.loaded,mode==='offline');await p.screenshot({path:path.join(out,mode+'.png')});console.log('PASS:',mode,state);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({base,reports,errors,footSamples},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
