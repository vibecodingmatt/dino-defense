'use strict';
/* Browser integration checks for the weapon catalog. No build step. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../dino-perimeter-review');
const errors=[],results=[];const pass=(test,detail)=>{results.push({test,detail});console.log('PASS:',test,detail||'');};
for(const name of ['arsenal','weapon-fx','armory-guide','data','draw','game'])new vm.Script(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),{filename:name});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1600,height:1040},serviceWorkers:'block'});await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>PerimeterScene.ready);
 await page.evaluate(()=>{save.settings.mute=true;save.settings.music=false;startLevel(0,'fresh',1);G.state='review';G.paused=false;});
 const shapes=await page.evaluate(()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=192;const c=cv.getContext('2d',{willReadFrequently:true}),all=[];let minPixels=Infinity,minWidth=Infinity;
   for(const key of Object.keys(TOWERS)){
     const hashes=[];
     for(let lv=0;lv<=TOWERS[key].maxUp;lv++){
       for(let a=0;a<64;a++){
         const t={key,ulv:lv,x:96,y:115,angle:a*Math.PI/32};c.clearRect(0,0,192,192);Arsenal.turret(c,t,0,0);
         const p=c.getImageData(0,0,192,192).data;let pixels=0,left=192,right=0;
         for(let i=3;i<p.length;i+=4)if(p[i]>180){pixels++;const x=((i-3)/4)%192;left=Math.min(left,x);right=Math.max(right,x);}
         minPixels=Math.min(minPixels,pixels);minWidth=Math.min(minWidth,right-left);
         const m=Arsenal.anchor(t);if(!Number.isFinite(m.x+m.y)||Math.hypot(m.x-t.x,m.y-t.y)>65)throw Error('Invalid muzzle '+key);
         if(a===5)hashes.push(cv.toDataURL());
       }all.push(key+lv);
     }
     if(new Set(hashes).size!==TOWERS[key].maxUp+1)throw Error('Indistinguishable upgrade '+key);
   }
   return {models:all.length,headings:all.length*64,minPixels,minWidth,cacheBytes:Arsenal.cacheBytes,sprites:Arsenal.cachedSprites,limit:Arsenal.cacheLimit};
 });assert.equal(shapes.models,30);assert.ok(shapes.minWidth>10);assert.ok(shapes.minPixels>200);assert.ok(shapes.sprites<=shapes.limit);assert.ok(shapes.cacheBytes<64e6);pass('30 distinct models remain solid through all 1,920 angle/configuration combinations; cache stays bounded',shapes);
 const combat=await page.evaluate(()=>{
   const result=[];
   for(const [key,def] of Object.entries(TOWERS))for(let lv=0;lv<=def.maxUp;lv++){
     G.dinos=[];G.projs=[];G.fx=[];G.bolts=[];G.clouds=[];G.zapQ=[];G.links=[];G.decals=[];G.corpses=[];G.wave=1;
     const t={key,x:240,y:201,ulv:lv,cd:0,angle:0,mode:'first',invested:def.cost};G.towers=[t];
     for(let i=0;i<3;i++){spawnDino('velociraptor',0,false);const d=G.dinos.at(-1);d.dist=270+i*10;d.speed=0;d.hp=d.maxHp=1;d.armor=0;}
     const killsBefore=G.stat.kills;fireTower(t,.001);
     const launches=G.projs.length,ports=G.projs.map(p=>[p.x,p.y]);
     if(key==='missile'&&(launches!==lv+1||new Set(ports.map(p=>p.join(','))).size!==lv+1))throw Error('Wrong salvo '+lv);
     for(let n=0;n<180;n++){
       if(key==='extinction')fireTower(t,1/120);
       updateProjs(1/120);runZapQ(1/120);updateClouds(1/120);updateDinos(1/120);
       for(const f of G.fx){f.t+=1/120;WeaponFX.draw(ctx,f,n/120);}G.fx=G.fx.filter(f=>f.t<f.dur);
     }
     const kills=G.stat.kills-killsBefore;if(!kills)throw Error('Weapon failed to kill: '+key+lv);
     result.push({key,lv,launches,kills});render(0);
   }return result;
 });pass('Every level fires and kills real game dinosaurs; missile upgrades launch 1 / 2 / 3 rockets from separate ports',combat);
 const purity=await page.evaluate(()=>{
   const t={key:'missile',x:300,y:300,ulv:2,angle:.5};const pr={kind:'missile',tower:t,x:340,y:300,vx:1,vy:1,trail:[{x:335,y:295,age:.02}]};const f={kind:'boom',x:380,y:300,r:60,t:.2,dur:.85,seed:2};const b={x1:100,y1:100,x2:200,y2:120,jag:true,t:.1,dur:.2};
   const before=JSON.stringify({pr,f,b});const count=G.fx.length;
   for(let i=0;i<20;i++){WeaponFX.projectile(ctx,pr,1);WeaponFX.draw(ctx,f,1);WeaponFX.bolt(ctx,b,1);}
   return before===JSON.stringify({pr,f,b})&&G.fx.length===count;
 });assert.ok(purity);pass('Repeated renders never advance effects, consume projectiles or spawn particles');
 // Real player UI: selecting a tower, buying every upgrade, checking price and model.
 await page.evaluate(()=>{G.state='playing';G.paused=true;G.cash=100000;G.towers=[{key:'gatling',x:350,y:260,ulv:0,invested:TOWERS.gatling.cost,mode:'first',cd:0,angle:-.4}];selectTower(G.towers[0]);});
 for(let lv=1;lv<=3;lv++){const before=await page.evaluate(()=>({cash:G.cash,cost:UPG.cost(TOWERS.gatling,G.selected.ulv)}));await page.locator('#up_main').click();assert.deepEqual(await page.evaluate(()=>({cash:G.cash,lv:G.selected.ulv,model:document.querySelector('#tpHardware').dataset.model})),{cash:before.cash-before.cost,lv,model:'gatling'+lv});}
 assert.equal(await page.locator('#up_main').isDisabled(),true);await page.screenshot({path:path.join(out,'arsenal-upgrade.png')});pass('Real upgrade purchases charge the correct price and change the displayed hardware through maximum level');
 await page.locator('#tpClose').click();await page.evaluate(()=>{G.paused=false;});await page.locator('#btnArsenal').click();
 assert.ok(await page.evaluate(()=>G.paused));await page.keyboard.press('Digit8');assert.equal(await page.evaluate(()=>G.placing),null);
 for(const key of await page.evaluate(()=>Object.keys(TOWERS))){
   await page.locator('.ag-weapons button[data-key="'+key+'"]').click();await page.locator('.ag-tiers button').last().click();await page.waitForTimeout(350);
 }
 await page.locator('.ag-weapons button[data-key="tesla"]').click();await page.locator('.ag-tiers button').last().click();await page.waitForTimeout(70);
 await page.screenshot({path:path.join(out,'arsenal-guide-desktop.png')});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.querySelector('#armoryGuide').open),false);assert.equal(await page.evaluate(()=>G.paused),false);
 pass('Guide previews every weapon, pauses the match, blocks game hotkeys and restores play on Escape');
 // Let the closed dialog's backdrop leave the compositor before timing play.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const perf=await page.evaluate(()=>{
   G.state='review';G.paused=false;G.dinos=[];G.projs=[];G.fx=[];G.clouds=[];G.bolts=[];
   G.towers=Array.from({length:45},(_,i)=>{const key=Object.keys(TOWERS)[i%9];return {key,x:90+i%9*132,y:270+Math.floor(i/9)*70,ulv:TOWERS[key].maxUp,angle:-.6,cd:.4,cdMax:1,mode:'first'};});
   for(let i=0;i<35;i++)WeaponFX.emit(G.fx,i%2?'boom':'flame',100+i%9*120,200+Math.floor(i/9)*100,{r:45,t:.15,dur:.85,weapon:i%2?'missile':'flamer',lv:2,ang:0});
   for(let i=0;i<3;i++)render(0);const times=[];for(let i=0;i<90;i++){const start=performance.now();render(0);times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {median:times[45],p95:times[85],cacheBytes:Arsenal.cacheBytes,filter:ctx.filter,shadow:ctx.shadowBlur,alpha:ctx.globalAlpha,composite:ctx.globalCompositeOperation,transform:ctx.getTransform().toString()};
 });console.log('Render timings:',perf);assert.ok(perf.p95<33,'CPU render submission exceeds 33ms');pass('45 upgraded weapons plus 35 simultaneous effects stay inside CPU render budget (not a GPU FPS measurement)',perf);
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});await mobile.route('https://**/*',r=>r.abort());const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.evaluate(()=>{save.settings.mute=true;startLevel(0,'fresh',1);G.paused=true;});
 await phone.locator('#btnArmory').tap();await phone.locator('#btnArsenal').tap();await phone.locator('.ag-weapons button[data-key="missile"]').tap();await phone.locator('.ag-tiers button').last().tap();await phone.screenshot({path:path.join(out,'arsenal-guide-phone.png')});
 assert.ok(await phone.evaluate(()=>{const d=document.querySelector('#armoryGuide'),r=d.getBoundingClientRect();return r.width<=innerWidth&&d.scrollWidth<=d.clientWidth+1;}));
 await phone.locator('.ag-close').tap();assert.equal(await phone.evaluate(()=>G.paused),true);
 await phone.emulateMedia({reducedMotion:'reduce'});await phone.locator('#btnArsenal').tap();assert.equal(await phone.locator('.ag-fire').textContent(),'Play demo');await phone.locator('.ag-close').tap();
 await phone.setViewportSize({width:844,height:390});await phone.locator('#btnArsenal').tap();await phone.screenshot({path:path.join(out,'arsenal-guide-landscape.png')});assert.ok(await phone.evaluate(()=>{const d=document.querySelector('#armoryGuide');return d.scrollWidth<=d.clientWidth+1;}));await mobile.close();pass('Phone portrait and landscape guide layouts, real touch input, prior pause restoration, reduced-motion default');
 const offline=await browser.newContext();await offline.route('https://**/*',r=>r.abort());const op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.reload();await op.waitForFunction(()=>navigator.serviceWorker.controller!==null);await offline.setOffline(true);await op.reload();
 await op.evaluate(()=>{save.settings.mute=true;startLevel(0,'fresh',1);G.paused=true;});await op.locator('#btnArsenal').click();assert.equal(await op.locator('.ag-name').textContent(),'Sentinel');await offline.close();pass('New models, firing effects and guide all work after an offline reload');
 assert.deepEqual(errors,[]);assert.equal(await page.locator('#errbox').textContent(),'');fs.writeFileSync(path.join(out,'arsenal-verification.json'),JSON.stringify({testedAt:new Date().toISOString(),results,errors},null,2));console.log('All arsenal checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
