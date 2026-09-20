'use strict';
// Landscape space, real gestures, placement, side panels, rotation and offline use.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.LANDSCAPE_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/landscape1771/local');fs.mkdirSync(out,{recursive:true});
const {chromium}=require(require.resolve('playwright-core',{paths:[root,path.resolve(root,'../war-survival')]}));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(e?'':b);});});
let browser;const errors=[],report={layouts:[],errors};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.LANDSCAPE_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 async function setup(width,height,touch=true,offline=false){
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,serviceWorkers:offline?'allow':'block'});await context.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.evaluate(()=>{save.settings.mute=true;});await p.locator('#btnQuickPlay').click();return{context,p};
 }
 for(const [width,height]of [[568,320],[667,375],[844,390],[932,430],[1024,768],[1366,1024]]){
  const {context,p}=await setup(width,height),cdp=await context.newCDPSession(p),name=width+'x'+height;
  const event=(type,touchPoints=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const layout=await p.evaluate(()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};return{stage:r('stage'),canvas:r('game'),shop:r('shop'),hud:r('hud'),overflow:document.documentElement.scrollWidth>innerWidth,controls:['btnWave','speedCycle','btnPause','btnMute','btnMenu','btnArmory'].map(r)};});
  assert.equal(layout.overflow,false);assert.equal(layout.shop.width,96);
  assert.ok(layout.stage.width*layout.stage.height/(width*height)>.64,'Map should fill most of the screen');
  assert.ok(layout.canvas.width>=layout.stage.width-.5&&layout.canvas.height>=layout.stage.height-.5,'Map has wasted letterbox space');
  assert.ok(Math.abs(layout.canvas.width/layout.canvas.height-16/9)<.002,'Map distorted');
  assert.ok(layout.controls.every(r=>r.height>=40&&r.x>=0&&r.right<=width+.5),'Control too small or clipped');
  await p.screenshot({path:path.join(out,name+'-opening.png')});
  // Real vertical swipe scrolls the narrow weapon rail without arming a weapon.
  const card=await p.locator('.shopCard[data-key="flamer"]').boundingBox(),start={x:card.x+card.width/2,y:card.y+card.height/2,id:1};
  await event('touchStart',[start]);for(let i=1;i<=5;i++){await event('touchMove',[{...start,y:start.y-i*18}]);await p.waitForTimeout(20);}await event('touchEnd');
  assert.ok(await p.locator('#shop').evaluate(e=>e.scrollHeight<=e.clientHeight||e.scrollTop>0),'Scrollable rail did not scroll');assert.equal(await p.evaluate(()=>G.placing),null);
  await p.locator('#btnArmory').scrollIntoViewIfNeeded();await p.locator('#btnArmory').tap();
  const drawer=await p.locator('#shop').boundingBox();assert.ok(drawer.width>=250&&drawer.x>=0&&drawer.x+drawer.width<=width+.5,'Expanded armory clipped');
  await p.locator('#airCard').scrollIntoViewIfNeeded();const support=await p.locator('#airCard').boundingBox();assert.ok(support.height>=44&&support.y>=72&&support.y+support.height<=height+.5,'Support unreachable');
  await p.screenshot({path:path.join(out,name+'-support.png')});await p.locator('#btnArmory').tap();
  // Panning works on whichever axis the enlarged map crops.
  const s=layout.stage,a={x:s.x+s.width*.55,y:s.y+s.height*.5,id:1},before=await p.evaluate(()=>({...G.cam}));
  await event('touchStart',[a]);for(let i=1;i<=5;i++)await event('touchMove',[{...a,x:a.x-i*10,y:a.y-i*10}]);await event('touchEnd');
  const after=await p.evaluate(()=>({...G.cam}));assert.ok(Math.abs(after.x-before.x)+Math.abs(after.y-before.y)>1,'Map drag did not pan');
  const a1={x:a.x-32,y:a.y,id:1},a2={x:a.x+32,y:a.y,id:2};await event('touchStart',[a1,a2]);for(let i=1;i<=4;i++)await event('touchMove',[{...a1,x:a1.x-i*9},{...a2,x:a2.x+i*9}]);await event('touchEnd');assert.ok(await p.evaluate(()=>G.cam.zoom)>1.2,'Pinch did not zoom');
  // Overview fits the entire route, and closing it restores the previous view.
  const zoomed=await p.evaluate(()=>({...G.cam}));await p.locator('#btnOverview').tap();
  const overview=await p.evaluate(()=>{const s=document.getElementById('stage').getBoundingClientRect(),c=cv.getBoundingClientRect();return{fits:c.width<=s.width+.5&&c.height<=s.height+.5,cam:G.cam};});assert.ok(overview.fits);assert.deepEqual(overview.cam,{x:0,y:0,zoom:1});await p.screenshot({path:path.join(out,name+'-overview.png')});
  await p.locator('#btnOverview').tap();assert.equal(await p.evaluate(()=>G.cam.zoom),zoomed.zoom);await p.evaluate(()=>resetCam());
  // Place and select through touch coordinates after the canvas cropping transform.
  await p.locator('.shopCard[data-key="gatling"]').tap();const pos=await p.evaluate(()=>{const pt=FieldCommand.suggested(),r=cv.getBoundingClientRect();return{x:r.left+(pt.x-G.cam.x)*G.cam.zoom*r.width/W,y:r.top+(pt.y-G.cam.y)*G.cam.zoom*r.height/H+PLACE_LIFT_PX};});
  await p.touchscreen.tap(pos.x,pos.y);assert.equal(await p.evaluate(()=>G.towers.length),1);
  await p.locator('#undoPlacement').tap();assert.equal(await p.evaluate(()=>G.cash),300);
  await p.locator('.shopCard[data-key="gatling"]').tap();await p.touchscreen.tap(pos.x,pos.y);
  const tower=await p.evaluate(()=>{G.cash=2000;updateHUD();const t=G.towers[0],r=cv.getBoundingClientRect();return{x:t.x,y:t.y,cx:r.left+(t.x-G.cam.x)*G.cam.zoom*r.width/W,cy:r.top+(t.y-G.cam.y)*G.cam.zoom*r.height/H};});
  await p.locator('#undoPlacement').tap(); // Clear the temporary undo overlay before selecting at its location.
  await p.evaluate(t=>{placeTower('gatling',t.x,t.y);G.towers[0].hasFired=true;updateHUD();},tower);
  await p.touchscreen.tap(tower.cx,tower.cy);assert.equal(await p.evaluate(()=>G.selected?.key),'gatling');
  await p.locator('#up_main').tap();await p.locator('.branch-choice').filter({hasText:'Skywatch'}).tap();assert.equal(await p.evaluate(()=>G.selected.spec),'skywatch');
  const dock=await p.locator('#towerDock').boundingBox(),stage=await p.locator('#stage').boundingBox();assert.ok(dock.x>=stage.x+stage.width-.5,'Upgrade panel covers map');assert.ok(dock.x+dock.width<=width+.5&&dock.y+dock.height<=height+.5);
  await p.screenshot({path:path.join(out,name+'-upgrade.png')});
  // Rotate with the selected tower; the same panel/tower must survive both layouts.
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>document.getElementById('towerPop').parentElement.id),'towerDock');assert.equal(await p.evaluate(()=>G.selected.spec),'skywatch');
  await p.setViewportSize({width,height});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>G.selected.spec),'skywatch');
  assert.ok(await p.evaluate(()=>{const t=G.selected,c=cv.getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect(),x=c.left+(t.x-G.cam.x)*G.cam.zoom*c.width/W,y=c.top+(t.y-G.cam.y)*G.cam.zoom*c.height/H;return x>=s.left&&x<=s.right&&y>=s.top&&y<=s.bottom;}),'Rotation hid the selected weapon');
  await p.locator('#tpClose').tap();await p.locator('#btnOverview').tap();await p.setViewportSize({width:390,height:844});await p.setViewportSize({width,height});await p.locator('#btnOverview').tap();assert.equal(await p.evaluate(()=>G.overview),false);
  await p.locator('#btnMenu').tap();assert.equal(await p.locator('#btnOverview').isVisible(),false);assert.equal(await p.locator('#towerDock').isVisible(),false);
  report.layouts.push({width,height,...layout});await context.close();console.log('PASS:',name,'map area, rail swipe, support, pan/pinch, overview, touch placement, upgrades and rotation');
 }
 const desktop=await setup(1440,900,false);assert.equal(await desktop.p.evaluate(()=>FieldCommand.landscape()),false);assert.equal(await desktop.p.locator('#btnArmory').isVisible(),false);await desktop.context.close();
 const offline=await setup(844,390,true,true);await offline.p.evaluate(()=>navigator.serviceWorker.ready);await offline.p.reload();await offline.p.waitForFunction(()=>navigator.serviceWorker.controller);await offline.context.setOffline(true);await offline.p.reload();await offline.p.locator('#btnQuickPlay').tap();assert.equal(await offline.p.locator('#btnArmory').isVisible(),true);await offline.p.locator('#btnArmory').tap();assert.equal(await offline.p.locator('#airCard').isVisible(),true);await offline.p.screenshot({path:path.join(out,'offline.png')});await offline.context.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: desktop unchanged, offline landscape and zero browser errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
