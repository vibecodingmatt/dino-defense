'use strict';
// Local inspection tools, public-host behavior and removal of legacy gulp art.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review');fs.mkdirSync(out,{recursive:true});
const data=fs.readFileSync(path.join(root,'js/data.js'),'utf8'),hosts=[
 ['http://localhost:4176/',true],['http://preview.localhost/',true],['http://localhost.:4176/',true],['http://127.0.0.1/',true],['http://127.0.0.2/',true],['http://[::1]:4176/',true],['file:///C:/game/index.html',true],
 ['https://vibecodingmatt.github.io/dino-defense/',false],['https://vibecodingmatt.github.io/dino-defense/?test=1',false],['https://localhost.example.com/',false],['https://127.0.0.1.example.com/',false],['https://example.com/?dev=1&artPreview=1',false]
];
for(const [url,expected] of hosts)assert.equal(vm.runInNewContext(data+';ART_PREVIEW_ENABLED',{location:new URL(url)}),expected,url);
assert.equal(vm.runInNewContext(data+';ART_PREVIEW_ENABLED'),false);console.log('PASS: local-host allowlist; query flags cannot enable public inspection panels');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
function asset(url,prefix=''){const name=new URL(url).pathname.slice(prefix.length).replace(/\/$/,'/index.html');const file=path.resolve(root,'.'+name);if(path.relative(root,file).startsWith('..'))return null;return fs.existsSync(file)?file:null;}
const server=http.createServer((req,res)=>{const file=asset('http://localhost'+req.url);if(!file)return res.writeHead(404).end();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
let browser;const errors=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const local=await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});await local.route('https://**/*',r=>r.abort());const p=await local.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.evaluate(()=>{G.state='review';save.settings.mute=true;});
 await p.locator('#btnCreatures').click();assert.ok(await p.locator('#creatureGuide').evaluate(d=>d.open));await p.keyboard.press('Escape');await p.waitForFunction(()=>!G.paused&&!G.creatureInspection);
 await p.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';G.paused=false;});
 for(const [button,dialog] of [['btnArsenal','armoryGuide'],['btnFieldCreatures','creatureGuide']]){await p.locator('#'+button).click();assert.ok(await p.locator('#'+dialog).evaluate(d=>d.open));assert.ok(await p.evaluate(()=>G.paused));await p.keyboard.press('Escape');await p.waitForFunction(()=>!G.paused&&!G.creatureInspection);}
 console.log('PASS: both local inspection panels open, close and restore match state');
 await p.evaluate(()=>Creatures.ready(MENU_BOSSES));
 const gulps=await p.evaluate(()=>{
  const cv=document.createElement('canvas');cv.width=800;cv.height=600;const c=cv.getContext('2d');let checks=0;
  for(const key of MENU_BOSSES)for(const t of [2.46,2.7,2.94]){
   const d={...DINOS[key],key,size:100,x:400,y:480,dir:1,phase:1.2,alpha:1,artView:.28,eat:{t,bit:true}};
   c.clearRect(0,0,800,600);drawDino(c,d,d.x,d.y,d.dir,d.phase,d.alpha,0);const animal=cv.toDataURL();
   c.clearRect(0,0,800,600);drawMenuDino(c,d);if(animal!==cv.toDataURL())throw Error('Extra swallowing overlay: '+key+' at '+t);checks++;
  }return checks;
 });assert.equal(gulps,24);console.log('PASS: all eight homepage species have no extra gulp overlay across the final feeding beat');
 // Simulate the production origin while fulfilling every request from these
 // local files. This neither contacts nor modifies the live website.
 const production=await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});
 await production.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='https://vibecodingmatt.github.io'||!u.pathname.startsWith('/dino-defense/'))return r.abort();const file=asset(u.href,'/dino-defense');return file?r.fulfill({path:file,contentType:types[path.extname(file)]||'application/octet-stream'}):r.fulfill({status:404,body:''});});
 const publicPage=await production.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
 for(const query of ['', '?test=1','?dev=1&artPreview=1']){
  await publicPage.goto('https://vibecodingmatt.github.io/dino-defense/'+query);await publicPage.evaluate(()=>{G.state='review';save.settings.mute=true;});
  assert.equal(await publicPage.locator('#armoryGuide,#creatureGuide').count(),0);
  assert.ok(await publicPage.evaluate(()=>['btnArsenal','btnFieldCreatures','btnCreatures'].every(id=>{const el=document.getElementById(id);return getComputedStyle(el).display==='none'&&el.onclick===null;})));
  if(!query){await publicPage.screenshot({path:path.join(out,'presentation-production-home.png')});await publicPage.evaluate(()=>{startLevel(0,'fresh',1);G.state='review';render(0);});await publicPage.screenshot({path:path.join(out,'presentation-production-game.png')});}
  assert.ok(await publicPage.evaluate(()=>{G.paused=false;for(const id of ['btnArsenal','btnFieldCreatures','btnCreatures'])document.getElementById(id).click();return !G.paused&&!G.creatureInspection&&Creatures.available&&Object.keys(TOWERS).length===9;}));
 }
 console.log('PASS: public origin hides every entry point, creates no inspection dialogs and ignores preview query flags; game art remains available');
 const fallback=await browser.newContext({serviceWorkers:'block'});await fallback.route('https://**/*',r=>r.abort());await fallback.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl/.test(kind)?null:native.call(this,kind,...args);};});const f=await fallback.newPage();f.on('pageerror',e=>errors.push(e.message));await f.goto(base);await f.evaluate(()=>{G.state='review';save.settings.mute=true;});
 assert.ok(await f.evaluate(()=>{
  const cv=document.createElement('canvas');cv.width=800;cv.height=600;const c=cv.getContext('2d'),d={...DINOS.drex,key:'drex',size:150,x:400,y:480,dir:1,phase:1.2,alpha:1,eat:{t:2.46,bit:true}};
  function snap(){c.clearRect(0,0,800,600);drawMenuDino(c,d);return cv.toDataURL();}const first=snap();d.eat.t=2.9;return first===snap();
 }));console.log('PASS: Canvas D-Rex body stays stable throughout the old gulp interval');
 await local.close();await production.close();await fallback.close();assert.deepEqual(errors,[]);console.log('All presentation checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
