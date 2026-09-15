'use strict';
// Node 22+, Miniflare (Wrangler dependency), and the existing Playwright install.
// The database is disposable. Browser API calls are routed here, including live-site reviews.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const http = require('node:http'), {randomBytes, randomUUID} = require('node:crypto');
const {Miniflare} = require(process.env.MINIFLARE_MODULE || 'miniflare');
const fixture = require('./leaderboard-fixture.cjs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || require.resolve('playwright-core', {paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root = path.resolve(__dirname,'..'), out = process.env.LEADERBOARD_REVIEW_DIR || path.resolve(root,'../../dino-perimeter-review/leaderboard/local');
fs.mkdirSync(out,{recursive:true});
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if (path.relative(root,file).startsWith('..')) return res.writeHead(403).end();
  try {res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
  catch (_) {res.writeHead(404).end();}
});
let mf, browser; const errors = [], report = {checks:[]};
const pass = message => {report.checks.push(message); console.log('PASS: '+message);};
const identity = () => randomBytes(32).toString('hex');
const result = (changes = {}) => ({map:0,difficulty:10,health:80,wave:100,runId:randomUUID(),version:'1.75.1',cheated:false,initials:'ABC',
  completedWaves:100,spawned:4074,kills:4073,leaks:1,activeMs:1200000,elapsedMs:120000,...changes});
(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const local = 'http://127.0.0.1:'+server.address().port, base = process.env.LEADERBOARD_REVIEW_URL || local;
  mf = new Miniflare({cf:false,modules:true,scriptPath:path.join(root,'leaderboard/worker.mjs'),compatibilityDate:JSON.parse(fs.readFileSync(path.join(root,'leaderboard/wrangler.jsonc'),'utf8')).compatibility_date,
    d1Databases:{DB:'leaderboard-test'},bindings:{ALLOWED_ORIGINS:`${local},https://vibecodingmatt.github.io`},
    ratelimits:{WRITE_LIMITER:{simple:{limit:20,period:60}}}});
  const db = await mf.getD1Database('DB');
  for (const file of fs.readdirSync(path.join(root,'leaderboard/migrations')).filter(f=>f.endsWith('.sql')).sort())
    for (const sql of fs.readFileSync(path.join(root,'leaderboard/migrations',file),'utf8').split(';').filter(s=>s.trim())) await db.prepare(sql).run();
  async function api(endpoint, score, player = identity(), extra = {}) {
    const response = await mf.dispatchFetch('https://rank.test'+endpoint,{method:score?'POST':'GET',headers:{Origin:local,
      Authorization:'Bearer '+player,'Content-Type':'application/json','CF-Connecting-IP':identity(),...extra},...(score?{body:JSON.stringify(score)}:{})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  async function eligible(endpoint, score, player = identity(), extra = {}) {
    assert.equal((await api('/runs',score,player)).status,200);
    await db.prepare('UPDATE runs SET started = ?1 WHERE run_id = ?2').bind(Date.now()-3600000,score.runId).run();
    return api(endpoint,score,player,extra);
  }
  assert.equal((await api('/leaderboard?map=0')).data.entries.length,0);
  assert.equal((await api('/leaderboard?map=7')).status,400);
  assert.equal((await api('/leaderboard?map=0',null,identity(),{Origin:'https://other.example'})).status,403);
  for (const initials of ['AB','ABCD','A B','aBc','<X>','É12','😀A',123,['ABC']]) assert.equal((await api('/scores',result({initials}))).status,400);
  for (const changes of [{wave:99},{cheated:true},{difficulty:1001},{difficulty:1.5},{health:-1},{health:101},{map:7},{runId:'bad'},
    {completedWaves:99},{spawned:4075},{kills:4074},{leaks:-1},{activeMs:1000000},{activeMs:1201001},{elapsedMs:1},{elapsedMs:null}]) assert.equal((await api('/scores',result(changes))).status,400);
  assert.equal((await api('/scores',result(),'bad')).status,401);
  const tooBig = await mf.dispatchFetch('https://rank.test/scores',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity()},body:'x'.repeat(2049)});
  assert.equal(tooBig.status,413);
  const preflight=await mf.dispatchFetch('https://rank.test/scores',{method:'OPTIONS',headers:{Origin:local}});
  assert.equal(preflight.status,204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),local);
  pass('API validation, strict 3-character initials, origin policy, preflight, identity and request-size limits');
  const who=identity(), run=result();
  assert.equal((await api('/qualify',run,who)).status,422,'Unregistered result');
  assert.equal((await api('/runs',run,who)).status,200);
  assert.equal((await api('/scores',run,who)).status,400,'Server clock rejects instant forged victory');
  assert.equal((await api('/runs',{...run,difficulty:11},who)).status,422);
  assert.equal((await api('/scores',run,identity())).status,422,'Another identity cannot reuse the run');
  assert.equal((await eligible('/qualify',run,who)).data.rank,1);
  assert.equal((await api('/scores',{...run,map:1},who)).status,422);
  assert.equal((await api('/scores',{...run,difficulty:11},who)).status,422);
  assert.equal((await api('/scores',{...run,elapsedMs:4000000},who)).status,400,'Forged wall clock');
  const expired=result(), expiredPlayer=identity(); await eligible('/qualify',expired,expiredPlayer);
  await db.prepare('UPDATE runs SET started = ?1 WHERE run_id = ?2').bind(Date.now()-91*86400000,expired.runId).run();
  assert.equal((await api('/scores',expired,expiredPlayer)).status,422);
  const beforeRetry=await db.prepare('SELECT started FROM runs WHERE run_id = ?1').bind(run.runId).first();
  await api('/runs',run,who);
  assert.deepEqual(await db.prepare('SELECT started FROM runs WHERE run_id = ?1').bind(run.runId).first(),beforeRetry);
  pass('Server-owned start time, identity/map/difficulty binding, expired runs and impossible telemetry');
  let posted=await api('/scores',run,who); assert.equal(posted.data.personal.rank,1);
  assert.equal((await api('/scores',run,who)).data.submitted,true);
  assert.equal((await api('/scores',{...run,health:100},who)).status,422,'Accepted run cannot improve itself');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM scores').first()).n,1);
  assert.equal((await eligible('/scores',result({difficulty:9}),who)).status,409);
  await eligible('/scores',result({initials:'A09',health:90}),who);
  assert.equal((await api('/leaderboard?map=0',null,who)).data.personal.health,90);
  assert.equal(JSON.stringify(posted.data).includes(who),false);
  assert.equal(JSON.stringify(posted.data).includes('run_id'),false);
  assert.equal((await api('/leaderboard?map=1')).data.entries.length,0);
  pass('Personal best, health tiebreaker, map isolation, private identity and idempotent retries');
  await db.prepare('DELETE FROM scores').run();
  const seed = async n => {
    for (let i=0;i<n;i++) await db.prepare('INSERT INTO scores VALUES (?1,0,?2,10,80,?3,?4,?5)')
      .bind(identity(),('A'+i.toString(36).toUpperCase().padStart(2,'0')),1000+i,randomUUID(),'1.75.0').run();
  };
  await seed(49);
  const arrivals=await Promise.all(Array.from({length:8},()=>eligible('/scores',result())));
  assert.equal(arrivals.filter(r=>r.data.submitted).length,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM scores').first()).n,50);
  assert.equal((await eligible('/qualify',result())).data.qualifies,false);
  posted=await eligible('/scores',result({difficulty:11,health:1}),who);
  assert.equal(posted.data.personal.rank,1); assert.equal(posted.data.entries.length,50);
  assert.equal((await eligible('/scores',result({difficulty:10,health:81}))).data.submitted,true);
  const race=result({map:6}), racePlayer=identity(); await eligible('/qualify',race,racePlayer);
  const versions=await Promise.all([api('/scores',race,racePlayer),api('/scores',{...race,health:99},racePlayer)]);
  assert.equal(versions.filter(r=>r.data.submitted).length,1);
  assert.equal((await api('/scores',race,racePlayer)).status,versions[0].data.submitted?200:422);
  pass('Top-50 cutoff, earlier exact ties, difficulty before health and concurrent qualification races');
  for (let i=0;i<20;i++) assert.equal((await api('/qualify',run,who,{'CF-Connecting-IP':'rate-test'})).status,200);
  assert.equal((await api('/qualify',result(),who,{'CF-Connecting-IP':'rate-test'})).status,429);
  pass('Submission rate limiting');
  await db.prepare('DELETE FROM scores').run();
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  let failNetwork=false, holdQualify=false, releaseQualify, submissions=0;
  const routeApi = async route => {
    const req=route.request(), url=new URL(req.url());
    if (url.hostname.endsWith('.workers.dev')) {
      if (failNetwork) return route.abort();
      if (holdQualify && url.pathname==='/qualify') await new Promise(r=>releaseQualify=r);
      if (url.pathname==='/scores') submissions++;
      const response=await mf.dispatchFetch('https://rank.test'+url.pathname+url.search,{method:req.method(),headers:{...req.headers(),origin:new URL(base).origin,'cf-connecting-ip':identity()},...(req.postData()?{body:req.postData()}:{})});
      if (url.pathname==='/runs' && response.ok) await db.prepare('UPDATE runs SET started = ?1 WHERE run_id = ?2').bind(Date.now()-3600000,JSON.parse(req.postData()).runId).run();
      return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    }
    if (/google/.test(url.hostname)) return route.abort();
    return route.continue();
  };
  await context.route('https://**/*',routeApi);
  const p=await context.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  await p.goto(base);
  await p.evaluate(()=>{save.settings.mute=true;});
  await p.locator('#btnLeaderboards').click();
  await p.waitForFunction(()=>document.querySelector('#leaderboardStatus').textContent !== 'Calling the scorekeeper…');
  assert.match(await p.locator('#leaderboardStatus').innerText(),/wide open/);
  assert.equal(await p.locator('#leaderboardMap option').count(),7);
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'btnLeaderboards');
  async function win(changes={}) {
    await fixture.installClock(p);
    await p.evaluate(changes=>{startLevel(changes.map||0,'fresh',1);G.paused=true;},changes);
    await p.waitForFunction(()=>Leaderboards.saveProgress()?.registered);
    if(changes.resumeAt){
      await fixture.advanceWaves(p,changes.resumeAt);
      await p.evaluate(()=>{saveRun();toMenu();startLevel(0,'resume');G.paused=true;});
    }
    if(changes.offlineAfterStart)failNetwork=true;
    if(changes.cheated)await p.evaluate(()=>G.runCheated=true);
    const actual=await fixture.advanceWaves(p);
    assert.equal(actual.progress.spawned,4074);assert.equal(actual.progress.completedWaves,100);
    assert.equal(await p.locator('#leaderboardEntry').isVisible(),false,'No prompt over the victory show');
    await p.locator('#victorySkip').click();
  }
  await p.evaluate(()=>{startLevel(0,'fresh',1);G.paused=true;G.wave=100;victory();finishVictory();});
  assert.equal(await p.locator('#leaderboardEntry').isVisible(),false);
  assert.match(await p.locator('#victoryRankStatus').innerText(),/not eligible/);
  await p.evaluate(()=>toMenu());
  await fixture.installClock(p);
  await p.evaluate(()=>{startLevel(0,'fresh',1);G.paused=true;});
  await p.waitForFunction(()=>Leaderboards.saveProgress()?.registered);
  await fixture.advanceWaves(p,2);
  const checkpoint=await p.evaluate(()=>{saveRun();return save.run.leaderboardProgress;});
  await p.evaluate(()=>{startWave();G.speed=10;leaderboardTestClock+=5;step(.05);saveRun();toMenu();startLevel(0,'resume');G.paused=true;});
  assert.deepEqual(await p.evaluate(()=>{const s=Leaderboards.saveProgress();return [s.runId,s.completedWaves,s.spawned,s.kills,s.invalid,s.registered];}),
    [checkpoint.runId,2,checkpoint.spawned,checkpoint.kills,false,true]);
  await p.evaluate(()=>{G.speed=20;step(.01);G.speed=1;saveRun();toMenu();startLevel(0,'resume');G.paused=true;});
  assert.equal(await p.evaluate(()=>Leaderboards.saveProgress().invalid),true);
  await p.evaluate(()=>toMenu());
  await p.evaluate(()=>{
    startLevel(0,'fresh',1);G.paused=true;
    for(const speed of [1,2,4,10]){G.speed=speed;step(.01);}
    if(Leaderboards.saveProgress().invalid)throw Error('Legal speeds rejected');
    G.lives-=1;step(.01);G.lives+=1;step(.01);saveRun();
  });
  assert.equal(await p.evaluate(()=>Leaderboards.saveProgress().invalid),true,'Injected health restoration rejected');
  await p.evaluate(()=>toMenu());
  pass('Injected instant victories rejected; real wave checkpoints survive mid-wave resume and excessive speed stays disqualified');
  await win({resumeAt:37});await p.locator('#arcadeInitials').waitFor({state:'visible'});
  await p.locator('#arcadeInitials').fill('a!2');assert.equal(await p.locator('#arcadeInitials').inputValue(),'A2');
  assert.equal(await p.locator('#submitArcadeScore').isDisabled(),true);
  await p.locator('#arcadeInitials').fill('a2z');assert.equal(await p.locator('#arcadeInitials').inputValue(),'A2Z');
  await p.screenshot({path:path.join(out,'arcade-entry-desktop.png')});
  await p.locator('#arcadeInitials').press('Enter');
  await p.waitForFunction(()=>document.querySelector('#leaderboardRows .your-score')?.textContent.includes('A2Z'));
  assert.equal(submissions,1); await p.locator('#closeLeaderboards').click();
  assert.equal(await p.locator('#victory').isVisible(),true);
  await p.locator('#vMenu').click();await p.locator('#btnLeaderboards').click();await p.waitForFunction(()=>document.querySelector('#leaderboardPersonal').textContent.includes('A2Z'));
  await p.reload();await p.locator('#btnLeaderboards').click();await p.waitForFunction(()=>document.querySelector('#leaderboardPersonal').textContent.includes('A2Z'));
  await p.keyboard.press('Escape');
  pass('Homepage entry, seven maps, post-ceremony prompt, initials filtering, Enter submission, personal highlight and reload identity');
  await win({cheated:true});await p.waitForTimeout(250);assert.equal(await p.locator('#leaderboardEntry').isVisible(),false);
  assert.equal(await p.locator('#victoryLeaderboard').isVisible(),false);await p.locator('#vMenu').click();
  await p.evaluate(()=>{startLevel(0,'fresh',1);G.runCheated=true;saveRun();toMenu();startLevel(0,'resume');});
  assert.equal(await p.evaluate(()=>G.runCheated),true);await p.evaluate(()=>toMenu());
  await win();await p.waitForFunction(()=>document.querySelector('#victoryRankStatus').textContent.includes('personal best'));
  assert.equal(await p.locator('#leaderboardEntry').isVisible(),false);await p.locator('#vMenu').click();
  await win({map:1,offlineAfterStart:true});await p.waitForFunction(()=>document.querySelector('#victoryRankStatus').textContent.includes('saved for later'));
  await p.locator('#vMenu').click();await p.reload();failNetwork=false;
  await p.locator('#btnLeaderboards').click();await p.locator('#leaderboardMap').selectOption('1');await p.locator('#postPendingScore').click();
  await p.locator('#arcadeInitials').waitFor({state:'visible'});await p.locator('#skipArcadeEntry').click();await p.locator('#closeLeaderboards').click();
  pass('Cheated and resumed-cheat exclusion, non-qualifiers, failed connection, saved result recovery and optional dismissal');
  holdQualify=true;await win({map:2});await p.waitForTimeout(100);await p.locator('#vMenu').click();
  holdQualify=false;releaseQualify();await p.waitForTimeout(200);assert.equal(await p.locator('#leaderboardEntry').isVisible(),false);
  pass('Late eligibility response cannot open a prompt over the homepage');
  await seed(49);
  await p.locator('#btnLeaderboards').click();await p.waitForFunction(()=>document.querySelectorAll('#leaderboardRows tr').length===50);
  for(const [width,height] of [[1440,1000],[390,844],[320,568],[844,390]]) {
    await p.setViewportSize({width,height});
    assert.equal(await p.locator('#leaderboards .modalBox').evaluate(e=>e.scrollWidth>e.clientWidth),false);
    for(let i=0;i<12;i++)await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(()=>document.querySelector('#leaderboards').contains(document.activeElement)),true);
    await p.screenshot({path:path.join(out,`board-${width}x${height}.png`)});
  }
  await p.keyboard.press('Escape');
  await p.setViewportSize({width:320,height:568});await win({map:3});await p.locator('#arcadeInitials').waitFor({state:'visible'});
  await p.locator('#arcadeInitials').fill('9xy');await p.screenshot({path:path.join(out,'arcade-entry-phone.png')});
  assert.equal(await p.locator('#leaderboardEntry .modalBox').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await p.locator('#submitArcadeScore').click();await p.waitForFunction(()=>document.querySelector('#leaderboardPersonal').textContent.includes('9XY'));
  pass('Desktop, 390/320px phones, short landscape, scrollable scores, keyboard focus and narrow-screen submission');
  await context.close();
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await touch.route('https://**/*',routeApi);
  const tp=await touch.newPage();tp.on('pageerror',e=>errors.push(e.message));await tp.goto(base);
  await tp.locator('#btnLeaderboards').tap();await tp.locator('#leaderboardMap').selectOption('4');
  await tp.locator('#closeLeaderboards').tap();
  await fixture.installClock(tp);
  await tp.evaluate(()=>{save.settings.mute=true;startLevel(4,'fresh',1);G.paused=true;});
  await tp.waitForFunction(()=>Leaderboards.saveProgress()?.registered);
  await fixture.advanceWaves(tp);
  await tp.locator('#victorySkip').tap();await tp.locator('#arcadeInitials').waitFor({state:'visible'});
  await tp.locator('#arcadeInitials').tap();await tp.locator('#arcadeInitials').fill('t01');
  await tp.locator('#submitArcadeScore').tap();await tp.waitForFunction(()=>document.querySelector('#leaderboardPersonal').textContent.includes('T01'));
  await touch.close();pass('Actual mobile touch opens the board and posts a qualifying score');
  const offline=await browser.newContext({serviceWorkers:'allow'}), op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));
  await op.goto(base);await op.evaluate(()=>navigator.serviceWorker.ready);await op.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await offline.setOffline(true);await op.reload();await op.locator('#btnLeaderboards').click();
  await op.waitForFunction(()=>document.querySelector('#leaderboardStatus').textContent.includes('offline'));
  await op.keyboard.press('Escape');await op.locator('#btnQuickPlay').click();assert.equal(await op.evaluate(()=>G.state),'playing');
  await offline.close();pass('Real offline reload retains leaderboard UI, explains unavailability and allows gameplay');
  assert.deepEqual(errors,[]);report.errors=errors;report.base=base;report.checkedAt=new Date().toISOString();
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await mf?.dispose();server.close();});
