'use strict';
// Transfer an actual exported save into a fresh mobile browser, then resume
// wave one with deployed weapons and insufficient cash for another purchase.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;const errors=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const desktop=await browser.newContext({serviceWorkers:'block'});await desktop.route('https://**/*',r=>r.abort());const first=await desktop.newPage();first.on('pageerror',e=>errors.push(e.message));await first.goto(base);
 const original=await first.evaluate(()=>{
  save.settings.mute=true;startLevel(0,'fresh',1);G.paused=true;placeTower('flamer',250,235);
  if(G.towers.length!==1)throw Error('Could not place source weapon');
  if(Object.keys(TOWERS).some(k=>towerUnlocked(k)&&towerCost(k)<=G.cash))throw Error('Source save must not afford another weapon');
  saveRun();return snapshot();
 });
 await first.locator('#btnMenu').click();await first.locator('#btnSettings').click();let code;
 first.once('dialog',async d=>{code=d.defaultValue();await d.dismiss();});await first.locator('#btnExport').click();assert.ok(code);
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});await mobile.route('https://**/*',r=>r.abort());const second=await mobile.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(base);assert.equal(await second.evaluate(()=>save.run),null);
 const dialogs=[];second.on('dialog',async d=>{dialogs.push(d.message());await d.accept(d.type()==='prompt'?code:undefined);});
 await second.locator('#btnSettings').tap();await second.locator('#btnImport').tap();await second.waitForFunction(()=>save.run&&save.run.towers.length===1);assert.ok(dialogs.includes('Save imported successfully!'));await second.locator('#setClose').tap();
 await second.evaluate(()=>{G.paused=true;});await second.locator('#levelCards .resume').tap();
 const restored=await second.evaluate(()=>({state:snapshot(),timer:G.autoTimer,prompt:document.querySelector('#startPrompt').textContent,disabled:document.querySelector('#btnWave').disabled,tourists:G.tourists.length}));
 assert.deepEqual(restored.state,original);assert.ok(restored.timer>0,'Restored weapon must restart the first-wave countdown');assert.ok(restored.tourists>0);assert.equal(restored.disabled,false);assert.ok(!/place a weapon|choose a weapon|pick one from/i.test(restored.prompt));
 await second.screenshot({path:path.join(out,'resume-phone-existing-weapon.png')});await second.evaluate(()=>{G.paused=false;});await second.waitForFunction(()=>G.wave===1&&G.waveActive,{},{timeout:8000});
 assert.equal(await second.evaluate(()=>G.towers.length),1);console.log('PASS: actual save export/import to a fresh mobile browser resumes wave one without another purchase', {cash:restored.state.cash,weapons:restored.state.towers.length});
 const scenarios=await second.evaluate(original=>{
  G.paused=true;let maps=0;
  for(let idx=0;idx<LEVELS.length;idx++){
   save.run={...original,levelIdx:idx,difficulty:1,dnaRun:0,towers:original.towers.map(t=>({...t}))};startLevel(idx,'resume');
   if(!(G.autoTimer>0)||G.towers.length!==1||G.cash!==original.cash)throw Error('Resume failed on map '+idx);maps++;
  }
  // A later run stays at its saved wave; a zero timer with weapons must never
  // tell the player to buy again, even if a caller deliberately clears it.
  save.run={...original,levelIdx:0,difficulty:1,wave:5,towers:original.towers.map(t=>({...t}))};startLevel(0,'resume');if(G.wave!==5||G.autoTimer!==-1)throw Error('Later-wave resume changed');
  save.run={...original,levelIdx:0,difficulty:1,cash:0,towers:[...original.towers.map(t=>({...t})),{key:'gatling',x:600,y:400,ulv:1,invested:360,mode:'strong'}]};startLevel(0,'resume');
  if(G.towers.length!==2||G.autoTimer<=0||G.cash!==0||G.towers[1].ulv!==1)throw Error('Multiple restored weapons failed');
  G.autoTimer=-1;updateHUD();if(/place a weapon|choose a weapon|pick one from/i.test(document.querySelector('#startPrompt').textContent))throw Error('Existing weapons still show placement prompt');
  startLevel(0,'fresh',1);placeTower('flamer',250,235);const started=G.autoTimer;updateHUD();updateHUD();if(G.autoTimer!==started)throw Error('HUD resets countdown');selectTower(G.towers[0]);sellSelected();
  if(G.autoTimer!==-1||G.towers.length)throw Error('Selling final weapon fails to cancel countdown');
  if(!/choose a weapon/i.test(document.querySelector('#startPrompt').textContent))throw Error('Empty perimeter lacks placement guidance');
  startLevel(1,'fresh',1);if(G.autoTimer!==-1||!/place a weapon/i.test(document.querySelector('#startPrompt').textContent))throw Error('Empty fresh map lost placement guidance');
  save.run={...original,levelIdx:0,difficulty:1,towers:original.towers.map(t=>({...t}))};startLevel(0,'resume');return {maps,cash:G.cash};
 },original);
 await second.locator('#btnWave').tap();assert.ok(await second.evaluate(()=>G.wave===1&&G.waveActive&&G.towers.length===1));
 console.log('PASS: all maps, multiple weapons, zero cash, manual start, later waves, fresh games and selling the last weapon',scenarios);
 assert.deepEqual(errors,[]);await desktop.close();await mobile.close();console.log('All resume checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
