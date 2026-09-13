'use strict';
// Real missile/splash kills, visible blood through the finisher, pure redraws and cleanup.
// FX_REVIEW_URL also exercises the deployed game in disposable browser storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright-core',{paths:[process.cwd(),path.resolve(__dirname,'../../war-survival')]}));
const root=path.resolve(__dirname,'..'),out=process.env.FX_REVIEW_DIR||path.resolve(root,'../../dino-perimeter-review/missile1690/local-fx');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
let browser;const errors=[],report={cases:[],errors};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=process.env.FX_REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  for(const [name,width,height,fallback]of [['desktop',1440,1000,false],['phone',390,844,false],['canvas',390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,serviceWorkers:'block'});
    await context.route('https://www.googletagmanager.com/**',r=>r.abort());await context.route('https://**.google-analytics.com/**',r=>r.abort());
    if(fallback)await context.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:native.call(this,type,...args);};});
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
    const combat=await p.evaluate(async()=>{
      await Creatures.ready(['velociraptor','trex','pteranodon']);save.settings.mute=true;save.settings.music=false;
      startLevel(0,'fresh',1);G.state='review';G.paused=false;G.wave=1;
      G.dinos=[];G.projs=[];G.fx=[];G.tourists=[];G.corpses=[];
      const tower={key:'missile',x:240,y:201,ulv:0,cd:0,angle:0,mode:'first',invested:TOWERS.missile.cost};G.towers=[tower];
      for(let i=0;i<3;i++){spawnDino('velociraptor',0,false);const d=G.dinos.at(-1);d.dist=270+i*10;d.speed=0;d.hp=d.maxHp=i===2?10000:1;d.armor=0;}
      const kills=G.stat.kills;fireTower(tower,.001);
      if(!G.projs.some(p=>p.kind==='missile'))throw Error('No actual missile fired');
      for(let n=0;n<360&&G.projs.length;n++)updateProjs(1/120);
      const deaths=G.fx.filter(f=>f.kind==='weaponDeath');
      if(deaths.length!==2||deaths.some(f=>f.weapon!=='missile')||G.stat.kills-kills!==2||G.dinos[2].dead)throw Error('Missile splash kill credit or survivor regression');
      window.reviewMissile=deaths[0];
      for(const f of G.fx)f.t=.36;G.waveActive=true;G.banner=null;updateHUD();updateStartPrompt();render(0);
      return {kills:G.stat.kills-kills,finishers:deaths.length,survivorHP:G.dinos[2].hp};
    });
    await p.screenshot({path:path.join(out,name+'-missile-combat.png')});
    const visual=await p.evaluate(()=>{
      const cv=document.createElement('canvas');cv.width=420;cv.height=300;const c=cv.getContext('2d',{willReadFrequently:true}),sheet=document.createElement('canvas');sheet.width=1260;sheet.height=600;const sc=sheet.getContext('2d'),rows=[];
      for(const [row,key]of ['velociraptor','pteranodon'].entries()){
        const f={...reviewMissile,x:210,y:200,r:32,seed:4,d:{...DINOS[key],key,size:32,phase:.8,fxNoShadow:true}},beats=[];
        for(const [col,t]of [.30,.9,2.0].entries()){
          f.t=t;c.clearRect(0,0,cv.width,cv.height);const before=JSON.stringify(f),random=Math.random;Math.random=()=>{throw Error('Missile draw consumes randomness');};
          try{WeaponFX.draw(c,f,t);}finally{Math.random=random;}
          if(JSON.stringify(f)!==before)throw Error('Missile redraw advanced its state');
          const pixels=c.getImageData(0,0,cv.width,cv.height).data;let red=0,ground=0,air=0;
          for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>60&&pixels[i]>65&&pixels[i]>pixels[i+1]*1.7&&pixels[i]>pixels[i+2]*1.3){red++;if(Math.floor(i/4/cv.width)>=196)ground++;else air++;}
          beats.push({t,red,ground,air});sc.fillStyle='#18211e';sc.fillRect(col*420,row*300,420,300);sc.drawImage(cv,col*420,row*300);sc.fillStyle='#eee9dc';sc.font='16px sans-serif';sc.fillText(key+' / '+t+'s',col*420+16,row*300+25);
        }
        if(beats[0].air<200||beats[1].ground<200||beats[2].ground<200)throw Error('Missile blood is too faint or disappears before debris: '+JSON.stringify({key,beats}));
        f.t=f.dur;c.clearRect(0,0,cv.width,cv.height);WeaponFX.draw(c,f,f.t);
        if(c.getImageData(0,0,cv.width,cv.height).data.some((v,i)=>i%4===3&&v>0))throw Error('Missile leaves visible debris beyond its lifetime');
        rows.push({key,beats});
      }
      const before=G.fx.length;for(const f of G.fx)WeaponFX.update(f,4);G.fx=G.fx.filter(f=>f.t<f.dur);if(G.fx.some(f=>f.kind==='weaponDeath'))throw Error('Missile finisher never retires');
      return {rows,effectsBefore:before,png:sheet.toDataURL().split(',')[1]};
    });
    fs.writeFileSync(path.join(out,name+'-missile-beats.png'),Buffer.from(visual.png,'base64'));delete visual.png;
    report.cases.push({name,combat,visual});console.log('PASS:',name,JSON.stringify({combat,visual}));await context.close();
  }
  assert.deepEqual(errors,[]);report.base=base;report.checkedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
