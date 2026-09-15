'use strict';
// Exercise the real Cloudflare service from the real Pages origin, using either
// local frontend files (default) or the published site (--live). Removes ONLY
// this disposable player's row in finally; no real player's score is touched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const fixture=require('../tests/leaderboard-fixture.cjs');
require('../js/leaderboard-rules.js');const Rules=globalThis.LeaderboardRules;
const root=path.resolve(__dirname,'..'),base='https://vibecodingmatt.github.io/dino-defense/';
const source=fs.readFileSync(path.join(root,'js/leaderboards.js'),'utf8'),api=source.match(/const API = '([^']+)'/)[1];
const out=process.env.LEADERBOARD_SERVICE_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/leaderboard/service');
const cli=process.env.WRANGLER_CLI;assert.ok(cli,'Set WRANGLER_CLI to Wrangler bin/wrangler.js for test-row cleanup.');
fs.mkdirSync(out,{recursive:true});let browser,player;
(async()=>{
  for(let map=0;map<7;map++){
    const response=await fetch(api+'/leaderboard?map='+map,{headers:{Origin:new URL(base).origin}});
    assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),new URL(base).origin);
    const data=await response.json();assert.equal(data.map,map);assert.ok(Array.isArray(data.entries));
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  if(!process.argv.includes('--live'))await context.route(base+'**',route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice('/dino-defense/'.length))||'index.html';
    const file=path.resolve(root,relative);if(path.relative(root,file).startsWith('..'))return route.abort();
    if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
    return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
  });
  await context.route('https://www.googletagmanager.com/**',r=>r.abort());
  const errors=[],p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  await p.locator('#btnLeaderboards').tap();await p.waitForFunction(()=>document.querySelector('#leaderboardStatus').textContent!=='Calling the scorekeeper…');
  assert.doesNotMatch(await p.locator('#leaderboardStatus').innerText(),/unavailable|Cannot|offline|not allowed/);
  const secret=await p.evaluate(()=>JSON.parse(localStorage.getItem('dino-defense-leaderboard-v1')).token);
  player=createHash('sha256').update(secret).digest('hex');
  await p.locator('#closeLeaderboards').tap();
  await fixture.installClock(p);
  const started=Date.now();
  await p.evaluate(()=>{save.settings.mute=true;startLevel(0,'fresh',1);G.paused=true;});
  await p.waitForFunction(()=>Leaderboards.saveProgress()?.registered);
  const runId=await p.evaluate(()=>G.leaderboardRunId);
  const forged={map:0,difficulty:1,health:100,wave:100,cleared:true,startWave:1,completedWaves:100,spawned:4074,kills:4074,leaks:0,
    activeMs:1200000,elapsedMs:120000,runId,version:'1.76.0',cheated:false,initials:'TST'};
  const blocked=await fetch(api+'/scores',{method:'POST',headers:{Origin:new URL(base).origin,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(forged)});
  assert.equal(blocked.status,425,'Live server must hold an instant forged result');
  console.log('PASS: live server rejects instant fabricated victory after a real run check-in.');
  // The ceremony normally auto-opens results after a few seconds. Freeze only
  // that animation in this disposable test page so it cannot qualify the
  // accelerated run before the real server clock has caught up.
  await p.evaluate(()=>{window.leaderboardTestVictoryUpdate=updateVictory;updateVictory=()=>{};});
  const completed=await fixture.advanceWaves(p);
  assert.equal(completed.progress.completedWaves,100);assert.equal(completed.progress.spawned,4074);
  // Keep the production clock honest: wait for the real server age to catch up
  // with test-accelerated gameplay. No production timestamps or rules change.
  const readyAt=started+Rules.minimumActiveMs(1,100)/10+2000;
  while(Date.now()<readyAt){
    console.log('Waiting for real run timing: '+Math.ceil((readyAt-Date.now())/1000)+' seconds remain.');
    await new Promise(r=>setTimeout(r,Math.min(30000,readyAt-Date.now())));
  }
  await p.evaluate(()=>{updateVictory=window.leaderboardTestVictoryUpdate;delete window.leaderboardTestVictoryUpdate;});
  await p.locator('#victorySkip').tap();await p.locator('#arcadeInitials').waitFor({state:'visible'});
  await p.locator('#arcadeInitials').fill('tst');await p.locator('#submitArcadeScore').tap();
  await p.waitForFunction(()=>document.querySelector('#leaderboardRows .your-score')?.textContent.includes('TST'));
  await p.screenshot({path:path.join(out,'real-service-phone.png')});
  // A second browser can see the published result without having its identity.
  const publicResponse=await fetch(api+'/leaderboard?map=0');const data=await publicResponse.json();
  assert.ok(data.entries.some(row=>row.initials==='TST'&&row.difficulty===1));
  assert.ok(data.entries.every(row=>row.you===false));assert.deepEqual(errors,[]);
  const victoryElapsedMs=Date.now()-started;
  await p.locator('#closeLeaderboards').tap();await p.locator('#vMenu').tap();
  await p.evaluate(()=>{startLevel(1,'fresh',1);G.paused=true;});
  await p.waitForFunction(()=>Leaderboards.saveProgress()?.registered);
  await fixture.advanceWaves(p,49);await fixture.loseNextWave(p);
  console.log('Checking a live wave-50 defeat; early verification should retry automatically.');
  await p.locator('#arcadeInitials').waitFor({state:'visible',timeout:90000});
  assert.match(await p.locator('#entrySummary').innerText(),/wave 50/);
  await p.locator('#arcadeInitials').fill('t50');await p.locator('#submitArcadeScore').tap();
  await p.waitForFunction(()=>document.querySelector('#leaderboardPersonal').textContent.includes('Wave 50'));
  const partial=await (await fetch(api+'/leaderboard?map=1')).json();
  assert.ok(partial.entries.some(row=>row.initials==='T50'&&row.wave===50&&!row.cleared));
  await p.screenshot({path:path.join(out,'real-service-wave-50-phone.png')});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),frontend:process.argv.includes('--live')?'published':'local at Pages origin',api,maps:7,touchSubmission:true,publicReadback:true,instantForgeryHeld:true,victoryElapsedMs,completedWaves:100,spawned:4074,wave50Defeat:true,automaticRetry:true,errors},null,2));
  console.log('PASS: live Cloudflare CORS, seven maps, phone victory/defeat submissions, automatic retry and independent public readback.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await browser?.close();
  if(player){
    assert.match(player,/^[a-f0-9]{64}$/);
    for(let attempt=1;attempt<=3;attempt++){
      try{
        execFileSync(process.execPath,[cli,'d1','execute','dino-defense-leaderboard','--remote','--command',`DELETE FROM scores WHERE player = '${player}'; DELETE FROM runs WHERE player = '${player}'`],{cwd:path.join(root,'leaderboard'),windowsHide:true,stdio:'pipe',timeout:45000});
        break;
      }catch(error){
        if(attempt===3)throw error;
        console.log('Retrying cleanup of this verification player after a Cloudflare API error.');
        await new Promise(r=>setTimeout(r,1000));
      }
    }
    console.log('Removed this verification player; the public board contains no test entry from this check.');
  }
});
