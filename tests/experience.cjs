'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.EXPERIENCE_REVIEW_DIR||'C:/Users/burns/dev/dino-perimeter-review/experience1770';fs.mkdirSync(out,{recursive:true});
const {chromium}=require(require.resolve('playwright-core',{paths:[root,path.resolve(root,'../war-survival')]}));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(e?'':b);});});
let browser;const errors=[],report={layouts:[],errors};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.EXPERIENCE_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 async function setup(width,height,touch=false,offline=false){
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,serviceWorkers:offline?'allow':'block'});await context.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForFunction(()=>typeof FieldCommand!=='undefined'&&typeof G!=='undefined');await p.evaluate(()=>{save.settings.mute=true;});return{context,p};
 }
 for(const [name,width,height,touch]of [['desktop',1440,1000,false],['phone',390,844,true],['small-phone',320,568,true],['landscape',844,390,true],['tablet',768,1024,true]]){
  const {context,p}=await setup(width,height,touch);await p.locator('#btnQuickPlay').click();
  const layout=await p.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {stage:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:document.documentElement.scrollWidth>innerWidth,guide:G.guide,cash:G.cash,timer:G.autoTimer,suggested:FieldCommand.suggested(),error:document.getElementById('errbox').textContent};});
  assert.equal(layout.error,'');assert.equal(layout.overflow,false);assert.equal(layout.guide,true);assert.equal(layout.timer,-1);assert.ok(layout.suggested);
  if(width<=390&&height>700)assert.ok(layout.stage.height>400,JSON.stringify(layout));
  await p.screenshot({path:path.join(out,name+'-opening.png')});
  if(touch&&width<height){
   const cdp=await context.newCDPSession(p),card=await p.locator('.shopCard[data-key="gas"]').boundingBox();
   const start={x:Math.min(width-12,card.x+card.width/2),y:card.y+card.height/2,id:1};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
   for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x-i*32}]});await p.waitForTimeout(25);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.ok(await p.locator('#shopCards').evaluate(e=>e.scrollLeft)>0,'Compact tray must scroll horizontally');
   assert.equal(await p.evaluate(()=>G.placing),null,'Tray swipe selected a weapon');
   await p.locator('.shopCard[data-key="gatling"]').scrollIntoViewIfNeeded();
  }
  await p.locator('.shopCard[data-key="gatling"]').click();
  const pos=await p.evaluate(touch=>{const pt=FieldCommand.suggested(),r=cv.getBoundingClientRect();return{x:r.left+(pt.x-G.cam.x)*G.cam.zoom*r.width/W,y:r.top+(pt.y-G.cam.y)*G.cam.zoom*r.height/H+(touch?PLACE_LIFT_PX:0)};},touch);
  if(touch)await p.touchscreen.tap(pos.x,pos.y);else await p.mouse.click(pos.x,pos.y);
  assert.equal(await p.evaluate(()=>G.towers.length),1,name+' placement');assert.equal(await p.evaluate(()=>G.autoTimer),-1,'Guided first wave waits');
  await p.locator('#undoPlacement').click();assert.equal(await p.evaluate(()=>G.towers.length),0);assert.equal(await p.evaluate(()=>G.cash),300);
  // Rebuild and start through actual controls.
  await p.locator('.shopCard[data-key="gatling"]').click();
  if(touch)await p.touchscreen.tap(pos.x,pos.y);else await p.mouse.click(pos.x,pos.y);
  await p.locator('#btnWave').click();assert.equal(await p.evaluate(()=>G.wave),1);
  const firstContact=await p.evaluate(()=>{G.paused=true;let n=0;for(;n<160&&!G.stat.kills;n++)step(.05);return{seconds:n*.05,kills:G.stat.kills,towers:G.towers.map(t=>({x:t.x,y:t.y})),enemies:G.dinos.map(d=>({key:d.key,dist:d.dist,hp:d.hp}))};});
  assert.ok(firstContact.kills>0,'Guided placement must engage within eight seconds: '+JSON.stringify(firstContact));
  await p.evaluate(()=>{G.paused=true;G.cash=2000;selectTower(G.towers[0]);});
  await p.locator('#up_main').click();await p.locator('.branch-choice').filter({hasText:'Skywatch'}).click();
  assert.equal(await p.evaluate(()=>G.towers[0].spec),'skywatch');assert.equal(await p.evaluate(()=>G.towers[0].mode),'air');
  const dock=await p.locator('#towerPop').boundingBox();assert.ok(dock.x>=0&&dock.x+dock.width<=width+1);assert.ok(dock.y>=0&&dock.y<height);
  if(touch)assert.equal(await p.evaluate(()=>document.querySelector('#towerPop').parentElement.id),'towerDock');
  await p.screenshot({path:path.join(out,name+'-specialization.png')});
  await p.locator('#tpClose').click();
  if(touch){await p.locator('#btnArmory').click();assert.equal(await p.locator('#airCard').isVisible(),true);await p.locator('#btnArmory').click();await p.locator('#btnOverview').click();assert.equal(await p.evaluate(()=>G.overview),true);await p.screenshot({path:path.join(out,name+'-overview.png')});await p.locator('#btnOverview').click();}
  await p.evaluate(()=>{G.wave=9;G.waveActive=true;G.spawnQ=[];G.dinos=[];G.pendingWave=buildWave(10);G.nextPreview=waveSummary(G.pendingWave);endWave();G.paused=false;updateHUD();});
  assert.ok(await p.evaluate(()=>G.autoTimer>0&&G.autoTimer<=3),'Boss approach must keep its automatic countdown');
  assert.match(await p.locator('#fieldThreat').innerText(),/Blue/);
  await p.screenshot({path:path.join(out,name+'-boss-countdown.png')});
  await p.locator('#btnPause').click();const countdown=await p.evaluate(()=>G.autoTimer);await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>G.autoTimer),countdown,'Manual pause did not stop the countdown');
  await p.locator('#btnResume').click();await p.waitForFunction(()=>G.wave===10&&G.waveActive,null,{timeout:6000});
  await p.locator('#btnMenu').click();assert.equal(await p.locator('#btnOverview').isVisible(),false);assert.equal(await p.locator('#fieldBrief').isVisible(),false);await p.locator('#btnLab').click();
  assert.equal(await p.locator('#researchGoal progress').count(),1);assert.equal(await p.locator('#labList details').getAttribute('open'),null);
  await p.screenshot({path:path.join(out,name+'-research.png')});
  await p.keyboard.press('Escape');
  report.layouts.push({name,...layout});await context.close();console.log('PASS:',name,'guided placement, full-refund undo, manual first wave, specialization, autoplay, manual pause, research');
 }
 const {context,p}=await setup(1440,1000);
 const rules=await p.evaluate(()=>{
  save.settings.mute=true;startLevel(0,'fresh',1);G.paused=true;
  function check(c,m){if(!c)throw Error(m);}
  let waves=0;
  for(let map=0;map<LEVELS.length;map++){
   startLevel(map,'fresh',1);G.paused=true;
   const suggestion=FieldCommand.suggested();check(suggestion&&canPlace(suggestion.x,suggestion.y),'Missing legal guidance on '+G.level.name);
   check(FieldCommand.coverage(suggestion.x,suggestion.y,'gatling').covered,'Suggested weapon has no coverage');
   for(let w=1;w<=100;w++){
    const q=buildWave(w);check(q.length>0,'Empty wave');
    for(const s of q){const d=DINOS[s.key];check(s.boss||d.minWave<=w,'Early species');check(!!d.water===!!G.level.waterPaths?.includes(s.pathI),'Wrong route');}
    const expected=(G.level.bosses&&G.level.bosses[w])||BOSS_WAVES[w]||[];
    check(JSON.stringify(q.filter(s=>s.boss).map(s=>s.key))===JSON.stringify(expected),'Boss schedule changed');waves++;
   }
  }
  startLevel(0,'fresh',1);G.paused=true;G.cash=5000;
  placeTower('gatling',250,235);const tower=G.towers[0];tower.ulv=1;selectTower(tower);FieldCommand.choose('skywatch');
  const air={key:'pteranodon',hp:1000,armor:0,flying:true,size:10,dist:0,pathI:0,def:DINOS.pteranodon};
  applyHit(air,tower,{dmg:100},TOWERS.gatling);check(air.hp===855,'Anti-air damage');
  const ground={...air,key:'compy',hp:1000,flying:false,def:DINOS.compy,slowT:0,slowF:1};applyHit(ground,tower,{dmg:100},TOWERS.gatling);check(ground.hp===920,'Ground tradeoff');
  check(tower.damageDealt===225,'Damage contribution wrong');
  FieldCommand.choose('suppressor');check(tower.spec==='skywatch','Branch changed after choice');
  const cryo={key:'cryo',ulv:1,spec:'deepfreeze'},blizzard={...cryo,spec:'blizzard'};
  check(towerStats(cryo).splash<towerStats(blizzard).splash,'Blast tradeoff');
  applyHit(ground,cryo,{dmg:1},TOWERS.cryo);check(ground.slowF===.32,'Deep Freeze not applied');
  applyHit(ground,blizzard,{dmg:1},TOWERS.cryo);check(ground.slowF===.32,'Weaker slow erased stronger slow');
  tower.hasFired=true;check(!FieldCommand.canUndo(),'Fired weapon refundable');
  saveRun();const old=JSON.parse(JSON.stringify(save.run));startLevel(0,'resume');check(G.towers[0].spec==='skywatch','Specialization lost');check(G.towers[0].damageDealt===225,'Contribution lost');
  check(G.fieldEvidence.weapons.gatling.damage===225,'Run evidence lost');
  delete old.fieldEvidence;delete old.towers[0].spec;delete old.towers[0].damageDealt;save.run=old;startLevel(0,'resume');check(!G.towers[0].spec,'Old save got branch');check(G.autoTimer>0,'Old wave-zero save did not start');
  // Old saved preferences must not resurrect the removed preparation pauses.
  save.settings.chapterBreaks=true;save.settings.auto=true;
  for(const cleared of [1,2,9,10,19,20,99]){
   startLevel(0,'fresh',1);G.paused=true;G.guide=true;G.wave=cleared;G.waveActive=true;G.spawnQ=[];G.dinos=[];G.pendingWave=buildWave(cleared+1);
   endWave();check(G.autoTimer===3,'Autoplay stopped after wave '+cleared);
   for(let i=0;i<62&&!G.waveActive;i++)step(.05);
   check(G.wave===cleared+1&&G.waveActive,'Next wave did not actually begin after '+cleared);
  }
  save.settings.auto=false;G.wave=21;G.waveActive=true;G.autoTimer=-1;endWave();check(G.autoTimer===-1,'Auto off ignored');
  startLevel(0,'fresh',1);G.paused=true;G.wave=8;G.lives=1;spawnDino('pteranodon',0,false);const leak=G.dinos.at(-1);leak.dist=G.paths[0].len-1;updateDinos(.1);
  check(G.over,'Actual breach did not defeat');check(G.fieldEvidence.leaks.pteranodon.count===1,'Breach evidence missing');
  check(document.getElementById('defeatDebrief').textContent.includes('anti-air'),'Debrief missed cause');
  check(document.getElementById('defeatText').textContent.includes('0 waves cleared'),'Claimed uncleared waves');
  return{waves,damage:225,specializations:true,legacy:true,actualDefeat:true};
 });report.rules=rules;await p.screenshot({path:path.join(out,'defeat-report.png')});
 await p.locator('#goLab').click();await p.screenshot({path:path.join(out,'defeat-to-research.png')});
 const purchase=await p.evaluate(()=>({dna:save.dna,cost:+document.querySelector('.labRow.recommended').dataset.researchCost}));
 await p.locator('#researchGoal button').click();await p.locator('.labRow.recommended button').click();assert.equal(await p.evaluate(()=>save.dna),purchase.dna-purchase.cost);
 await context.close();console.log('PASS: seven legal guided starts, 700 legal waves, boss schedule, specialization damage/slow, real breach report, research purchase, save migration and settings');
 const offline=await setup(390,844,true,true);await offline.p.evaluate(()=>navigator.serviceWorker.ready);await offline.p.reload();await offline.p.waitForFunction(()=>navigator.serviceWorker.controller);await offline.context.setOffline(true);await offline.p.reload();await offline.p.locator('#btnQuickPlay').click();assert.equal(await offline.p.evaluate(()=>G.guide),true);assert.equal(await offline.p.locator('#missionRail').isVisible(),true);await offline.p.screenshot({path:path.join(out,'offline-phone.png')});await offline.context.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: offline experience and zero browser errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
