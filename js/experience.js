'use strict';
/* Field command: player guidance, encounter pacing and run evidence.
   Combat owns damage and simulation; these hooks never grant rewards. */
const FieldCommand = (() => {
  const roles = {
    gatling:'Rapid fire · Anti-air', flamer:'Crowd damage · Ground', gas:'Area poison · Ground',
    sniper:'Armor piercing · Anti-air', cryo:'Slow groups · Anti-air', tesla:'Chain damage · Anti-air',
    sonic:'Reveal camouflage', missile:'Splash damage · Anti-air', mortar:'Siege · Ground only',
    extinction:'Armor piercing · Ground'
  };
  const branches = {
    gatling:[
      {id:'skywatch',name:'Skywatch',detail:'+45% damage to flyers; −20% to ground targets. Prioritizes flyers.'},
      {id:'suppressor',name:'Suppressor',detail:'+25% damage to ground targets; −20% to flyers.'}
    ],
    cryo:[
      {id:'deepfreeze',name:'Deep Freeze',detail:'68% slow in a 30% smaller blast. Hold a tight choke point.'},
      {id:'blizzard',name:'Blizzard',detail:'40% wider blast with a gentler 35% slow. Control a whole herd.'}
    ]
  };
  const opening = [
    ['compy'], ['compy'], ['gallimimus','compy'], ['dilophosaurus','compy'],
    ['velociraptor','compy'], ['pteranodon','compy','compy'], ['velociraptor','gallimimus'],
    ['parasaurolophus','compy'], ['dimorphodon','velociraptor'], ['velociraptor','compy'],
    ['gallimimus','dilophosaurus'], ['pachycephalosaurus','velociraptor'],
    ['parasaurolophus','dilophosaurus'], ['pteranodon','dimorphodon'],
    ['stegosaurus','compy'], ['velociraptor','gallimimus'],
    ['baryonyx','pteranodon'], ['triceratops','compy'],
    ['stegosaurus','dimorphodon','velociraptor'], ['carnotaurus','velociraptor']
  ];
  const chapters = ['First response','Hold the line','Heavy resistance','Broken skies','Hidden threats',
    'Apex territory','Nightmare patrol','Combined assault','Last perimeter','Extinction protocol'];
  const patterns = ['Regroup','Fast pack','Dense herd','Air patrol','Armored push','Fast pack','Zone pressure','Mixed assault','Boss approach','Boss encounter'];
  const portrait = () => matchMedia('(max-width: 920px) and (orientation: portrait)').matches;
  const landscape = () => matchMedia('(orientation: landscape) and (max-height: 560px), (orientation: landscape) and (pointer: coarse)').matches;
  const docked = () => portrait() || landscape();
  let undoBuild = null, suggestion = null, layoutPortrait = null, lastPanel = '', lastIntel = '', overviewCam = null;
  const el = id => document.getElementById(id);
  const text = (id, value) => {const node=el(id);if(node && node.textContent!==value)node.textContent=value;};
  const finite = value => Number.isFinite(value) && value > 0 ? value : 0;
  const validBranch = (key,id) => branches[key]?.some(b=>b.id===id) ? id : null;
  function stats(t,s){
    if(t.key==='cryo') {
      s.slow = t.spec==='deepfreeze' ? .32 : t.spec==='blizzard' ? .65 : TOWERS.cryo.slow.f;
      if(t.spec==='deepfreeze')s.splash*=.7;
      if(t.spec==='blizzard')s.splash*=1.4;
    }
    return s;
  }
  function hitMultiplier(t,d){
    if(t.key!=='gatling')return 1;
    return t.spec==='skywatch' ? (d.flying?1.45:.8) : t.spec==='suppressor' ? (d.flying?.8:1.25) : 1;
  }
  function choose(id){
    const t=G.selected;
    if(!t || t.ulv<1 || t.spec || !validBranch(t.key,id) || G.over)return;
    t.spec=id;if(id==='skywatch')t.mode='air';
    undoBuild=null;saveRun();renderTowerPanel();updateHUD();
    announce(`${branches[t.key].find(b=>b.id===id).name} specialization fitted.`);
  }
  function weaponPanel(t){
    const s=towerStats(t), next=towerStats({...t,ulv:t.ulv+1});
    text('tpRole',roles[t.key]);
    const delta=t.ulv<TOWERS[t.key].maxUp ? `Next: ${Math.round(s.dmg)} → ${Math.round(next.dmg)} damage · ${s.rof.toFixed(1)} → ${next.rof.toFixed(1)} shots/s` : 'All hardware upgrades fitted.';
    text('tpUpgradePreview',delta);
    text('tpContribution',`${fmt(t.damageDealt||0)} damage · ${fmt(t.runKills||0)} kills this run`);
    const stamp=[t.key,t.ulv,t.spec].join(':');
    if(stamp===lastPanel)return;
    lastPanel=stamp;const box=el('tpBranches');box.replaceChildren();
    if(!branches[t.key])return;
    const label=document.createElement('p');
    label.textContent=t.spec?'SPECIALIZATION FITTED':t.ulv<1?'Specializations unlock after the first upgrade.':'Choose a specialization · free · lasts for this tower';
    box.append(label);
    if(t.ulv<1)return;
    for(const b of branches[t.key]) {
      if(t.spec && t.spec!==b.id)continue;
      const button=document.createElement('button');button.type='button';button.className='branch-choice';
      const title=document.createElement('strong'),detail=document.createElement('span');
      title.textContent=b.name;detail.textContent=b.detail;button.append(title,detail);
      button.disabled=!!t.spec;button.onclick=()=>choose(b.id);box.append(button);
    }
  }
  function theme(wave){return patterns[(wave-1)%10];}
  function waveSpecies(wave,pool){
    let species;
    if(wave<=20)species=opening[wave-1].slice();
    else {
      const category=theme(wave);
      const preferred=pool.filter(p=>{
        const d=DINOS[p.key];
        return category==='Fast pack'?d.speed>=90&&!d.flying&&!d.water:
          category==='Dense herd'?d.size>=20&&!d.flying&&!d.water:
          category==='Air patrol'?d.flying:
          category==='Armored push'?d.armor>=3:
          category==='Zone pressure'?G.level.waterPaths?.length?d.water:G.level.flyerBias>=2?d.flying:d.speed>=90:true;
      });
      const source=preferred.length?preferred:pool;
      species=Array.from({length:3},(_,i)=>pickWeighted(i===2?pool:source));
    }
    // The map's identity enters the authored encounters without bringing a
    // species in before its existing unlock wave or onto an illegal route.
    if(wave>=4 && G.level.waterPaths?.length && [4,7,0].includes(wave%10))
      species[0]=wave>=26?'kronosaurus':wave>=10?'plesiosaurus':'ichthyosaurus';
    if(wave>=6 && G.level.flyerBias>=2 && wave%10!==5)species[0]=wave>=50?'quetzalcoatlus':'pteranodon';
    return species.filter(k=>DINOS[k]&&DINOS[k].minWave<=wave&&(!DINOS[k].water||G.level.waterPaths?.length));
  }
  function queueIndex(i,count,n,wave){
    return theme(wave)==='Dense herd'||theme(wave)==='Armored push' ? Math.min(n-1,Math.floor(i/count*n)) : i%n;
  }
  function newEvidence(saved){
    const result={weapons:{},leaks:{},paths:{},completed:0};
    if(!saved)return result;
    result.completed=Math.min(100,finite(saved.completed));
    for(const [key,row] of Object.entries(saved.weapons||{}))if(TOWERS[key])result.weapons[key]={damage:finite(row.damage),kills:finite(row.kills)};
    for(const [key,row] of Object.entries(saved.leaks||{}))if(DINOS[key])result.leaks[key]={count:finite(row.count),health:finite(row.health)};
    for(const [key,n] of Object.entries(saved.paths||{}))if(Number.isInteger(+key)&&+key>=0&&+key<G.paths.length)result.paths[key]=finite(n);
    return result;
  }
  function begin(mode,saved){
    G.fieldEvidence=newEvidence(mode==='resume'?saved?.fieldEvidence:null);
    G.guide=mode!=='resume' && save.settings.fieldGuide!==false && !save.settings.fieldGuideDone && !save.kills && !save.bestDiff;
    G.prepReason='';G.lastBreach=null;G.overview=false;undoBuild=null;suggestion=null;lastPanel='';lastIntel='';overviewCam=null;
    el('stage').classList.remove('map-overview');el('shop').classList.remove('expanded');
    el('btnArmory').setAttribute('aria-expanded','false');el('btnOverview').setAttribute('aria-pressed','false');text('btnOverview','Overview');
    G.fieldEvidence.completed=Math.max(G.fieldEvidence.completed,G.wave);
  }
  function damage(t,d,amount,killed){
    if(!t || !TOWERS[t.key] || !G.fieldEvidence)return;
    const row=G.fieldEvidence.weapons[t.key] ||= {damage:0,kills:0};
    row.damage+=amount;t.damageDealt=(t.damageDealt||0)+amount;
    if(killed){row.kills++;t.runKills=(t.runKills||0)+1;}
  }
  function leak(d){
    if(!G.fieldEvidence)return;
    const row=G.fieldEvidence.leaks[d.key] ||= {count:0,health:0};
    row.count++;row.health+=save.settings.invincible?0:Math.min(Math.max(0,G.lives),d.dmgToBase);
    G.fieldEvidence.paths[d.pathI]=(G.fieldEvidence.paths[d.pathI]||0)+1;
    const advice=d.cloaked?'Add a Sonic Emitter to reveal camouflage.':d.flying?'Cover this route with anti-air weapons.':d.armor>=3?'Use armor-piercing Snipers on this route.':'Add overlapping fire or Cryo slowing on this route.';
    G.lastBreach={key:d.key,path:d.pathI,advice,until:performance.now()+7000};
    announce(`${DINOS[d.key].name} escaped on route ${d.pathI+1}. ${advice}`);
  }
  function waveEnded(){
    if(G.fieldEvidence)G.fieldEvidence.completed=G.wave;
    if(G.guide && G.wave>=3){save.settings.fieldGuideDone=true;G.guide=false;}
    G.prepReason=G.guide&&G.wave===1?'upgrade':
      save.settings.chapterBreaks!==false && G.wave%10===9?'boss':
      save.settings.chapterBreaks!==false && G.wave%10===0?'chapter':'';
    if(G.prepReason)G.autoTimer=-1;
  }
  function waveStarted(){undoBuild=null;G.prepReason='';announce(`Wave ${G.wave}. ${theme(G.wave)}.`);}
  function announce(message){text('fieldAnnouncement',message);}
  function coverage(x,y,key){
    const st=towerStats({key,ulv:0}),segments=[];
    if(G.level.maze)return {segments,covered:true};
    const min=TOWERS[key].minRange||0;
    for(const path of G.paths)for(const s of path.segs){
      const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,steps=Math.max(1,Math.ceil(s.len/10));
      for(let i=0;i<steps;i++) {
        const a={x:s.a.x+dx*i/steps,y:s.a.y+dy*i/steps},b={x:s.a.x+dx*(i+1)/steps,y:s.a.y+dy*(i+1)/steps};
        const dist=hyp(x,y,(a.x+b.x)/2,(a.y+b.y)/2);
        if(dist<=st.range&&dist>=min)segments.push([a,b]);
      }
    }
    return {segments,covered:segments.length>0};
  }
  function suggested(){
    if(suggestion)return suggestion;
    const key=G.placing||'gatling';let best=null,bestValue=-Infinity,firstDistance=null;
    if(G.level.maze)return suggestion={x:288,y:352};
    // Search once for a legal start that covers an early part of a ground route.
    const path=G.paths.find((_,i)=>!G.level.waterPaths?.includes(i))||G.paths[0];
    for(let d=100;d<Math.min(path.len*.7,2200);d+=45) {
      // Compare nearby early positions; distant corners must not delay the first encounter.
      if(firstDistance!==null&&d>firstDistance+240)break;
      const p=samplePath(path,d);
      for(const side of [-1,1]) {
        const x=p.x+Math.cos(p.ang+Math.PI/2)*48*side,y=p.y+Math.sin(p.ang+Math.PI/2)*48*side;
        if(x<180 || x>W-180 || y<120 || y>H-90)continue;
        if(!canPlace(x,y))continue;
        const covered=coverage(x,y,key).segments.length;if(!covered)continue;
        if(firstDistance===null)firstDistance=d;
        const value=covered-d/200;
        if(value>bestValue){bestValue=value;best={x,y};}
      }
    }
    return suggestion=best;
  }
  function drawPlacement(c,x,y,key,legal){
    const cov=coverage(x,y,key);
    c.save();c.lineWidth=8;c.lineCap='round';c.strokeStyle=legal?'rgba(112,233,177,.85)':'rgba(235,143,104,.65)';
    c.beginPath();for(const [a,b]of cov.segments){c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);}c.stroke();c.restore();
    return cov.covered;
  }
  function drawGuide(c){
    if(!G.guide||G.wave!==0||G.towers.length)return;
    const p=suggested();if(!p)return;
    c.save();c.strokeStyle='#f5c66f';c.fillStyle='#f5c66f22';c.lineWidth=3;c.setLineDash([6,5]);
    c.beginPath();c.arc(p.x,p.y,24,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);
    c.fillStyle='#fff2d2';c.font='bold 14px Arial';c.textAlign='center';c.fillText('GOOD FIRST POSITION',Math.max(115,Math.min(W-115,p.x)),p.y-34);c.restore();
  }
  function placed(t){undoBuild={tower:t,cost:t.invested,until:performance.now()+8000,wave:G.wave,outOfRange:!coverage(t.x,t.y,t.key).covered};suggestion=null;announce(`${TOWERS[t.key].name} deployed. Undo is available until it fires, for eight seconds.`);}
  function canUndo(){return undoBuild && performance.now()<undoBuild.until && G.wave===undoBuild.wave && !G.over && G.towers.includes(undoBuild.tower) && !undoBuild.tower.hasFired && undoBuild.tower.ulv===0;}
  function undo(){
    if(!canUndo())return;
    const t=undoBuild.tower;G.cash+=undoBuild.cost;G.towers=G.towers.filter(other=>other!==t);undoBuild=null;
    if(G.level.maze)G.flow=mazeRebuild();
    if(!G.towers.length&&G.wave===0)G.autoTimer=-1;
    selectTower(null);saveRun();updateHUD();announce('Placement undone. Cash refunded.');
  }
  function intel(){
    const q=G.pendingWave||[], types=[...new Set(q.map(s=>s.key))],fly=q.some(s=>DINOS[s.key].flying),armor=q.some(s=>DINOS[s.key].armor>=3),cloak=q.some(s=>DINOS[s.key].camo);
    const boss=q.filter(s=>s.boss).map(s=>DINOS[s.key].name).join(' + ');
    let advice=boss?`Prepare for ${boss}.`:fly?'Flyers incoming. Keep anti-air on the route.':armor?'Armored herd. Snipers pierce their hides.':'Overlap weapon ranges along the route.';
    if(types.includes('indominus'))advice='Camouflaged boss: place a Sonic Emitter near your heavy weapons.';
    if(fly&&!G.towers.some(t=>TOWERS[t.key].air))advice='Flyers incoming — build anti-air before starting.';
    if(G.level.maze&&!fly&&!boss)advice='Extend the route with a maze; keep a path to the exit.';
    if(q.some(s=>DINOS[s.key].water)&&!boss)advice='Water route active. Cover both land and water.';
    return {advice,boss,fly,armor,cloak,types};
  }
  function hud(){
    layout();
    const active=G.state==='playing'&&!G.over;
    el('missionRail').classList.toggle('hidden',!active);
    el('buildUndo').classList.toggle('hidden',!active||!canUndo());
    if(!active){el('fieldBrief').classList.add('hidden');return;}
    const next=Math.min(100,G.wave+1),chapter=Math.min(9,Math.floor((Math.max(1,G.waveActive?G.wave:next)-1)/10));
    text('chapterTitle',`${chapter+1}/10 · ${chapters[chapter]}`);
    text('chapterGoal',`Boss at wave ${(chapter+1)*10}`);
    const info=intel(),stamp=JSON.stringify([G.wave,G.waveActive,G.prepReason,info.advice,save.settings.wavePreview,landscape()]);
    if(stamp!==lastIntel){
      lastIntel=stamp;
      text('fieldThreat',`${G.waveActive?'Next':'Wave '+next}: ${landscape()?'':theme(next)+' · '}${info.advice}`);
      el('fieldThreat').classList.toggle('hidden',save.settings.wavePreview===false);
    }
    let brief='';
    if(G.placing&&G.mouse.on&&!canPlace(G.mouse.x,G.mouse.y))brief='Cannot build here. Keep roads, facilities, and other weapons clear.';
    else if(G.placing&&G.mouse.on&&!G.level.maze&&!coverage(G.mouse.x,G.mouse.y,G.placing).covered)brief='No route in range. Move closer to the road before building.';
    else if(canUndo()&&undoBuild.outOfRange)brief='This weapon cannot reach the road. Undo and move it closer.';
    else if(G.guide&&G.wave===0)brief=G.towers.length?'Defense ready. Add more if you like, then press Start Wave.':'Choose the Gatling and cover the gold marker. Drag the map to look around.';
    else if(G.prepReason==='upgrade')brief='First wave held! Select your weapon to compare its next upgrade, then start wave 2.';
    else if(G.prepReason==='boss')brief=`Boss preparation · ${info.advice} Start when ready.`;
    else if(G.prepReason==='chapter')brief=`Chapter secured. Your run is saved. ${chapters[chapter]} is next — start when ready.`;
    else if(G.lastBreach&&performance.now()<G.lastBreach.until)brief=`${DINOS[G.lastBreach.key].name} escaped · Route ${G.lastBreach.path+1}. ${G.lastBreach.advice}`;
    text('fieldBriefText',brief);el('fieldBrief').classList.toggle('hidden',!brief);
    el('skipGuide').classList.toggle('hidden',!G.guide);
    el('main').classList.toggle('has-tower',!!G.selected);
    text('btnArmory',el('shop').classList.contains('expanded')?'Close armory':landscape()?'Armory ▸':'All weapons & support');
    if(G.selected)weaponPanel(G.selected);
  }
  function layout(){
    const mobile=docked();
    if(layoutPortrait!==mobile){
      layoutPortrait=mobile;
      (mobile?el('towerDock'):el('stage')).append(el('towerPop'));
      if(typeof G!=='undefined'&&G.selected)positionTowerPop(G.selected);
    }
  }
  function frameSelected(){
    const t=G.selected;if(!t)return;
    const cr=cv.getBoundingClientRect(),sr=el('stage').getBoundingClientRect(),scale=cr.width/W*G.cam.zoom;
    if(!scale)return;
    const inset=Math.min(56,sr.width/4,sr.height/4);
    const x=cr.left+(t.x-G.cam.x)*scale,y=cr.top+(t.y-G.cam.y)*scale;
    G.cam.x+=(x-Math.max(sr.left+inset,Math.min(sr.right-inset,x)))/scale;
    G.cam.y+=(y-Math.max(sr.top+inset,Math.min(sr.bottom-inset,y)))/scale;
    clampCam();
  }
  function debrief(){
    const evidence=G.fieldEvidence||newEvidence(), box=el('defeatDebrief');box.replaceChildren();
    const leaks=Object.entries(evidence.leaks).sort((a,b)=>b[1].health-a[1].health);
    const top=Object.entries(evidence.weapons).sort((a,b)=>b[1].damage-a[1].damage)[0];
    const title=document.createElement('h3');title.textContent='Your next attempt';box.append(title);
    const advice=leaks[0]?DINOS[leaks[0][0]].flying?'Build anti-air coverage on every flying route with Gatlings or Snipers.':leaks[0][0]==='indominus'?'Keep a Sonic Emitter covering your main damage zone.':DINOS[leaks[0][0]].armor>=3?'Add a Sniper to pierce the armored herd.':'Use Cryo slowing where several weapons overlap.':'Overlap your weapon ranges and upgrade your busiest defense.';
    const p=document.createElement('p');p.textContent=advice;box.append(p);
    if(leaks.length){
      const list=document.createElement('ul');
      for(const [key,row]of leaks.slice(0,3)){const li=document.createElement('li');li.textContent=`${DINOS[key].name}: ${row.count} escaped · ${row.health} health lost`;list.append(li);}box.append(list);
      const busiest=Object.entries(evidence.paths).sort((a,b)=>b[1]-a[1])[0];
      if(busiest){const route=document.createElement('p');route.textContent=`Most breaches: route ${+busiest[0]+1} (${busiest[1]} escapes).`;box.append(route);}
    }
    if(top){const p=document.createElement('p');p.textContent=`Strongest contribution: ${TOWERS[top[0]].name} · ${fmt(top[1].damage)} damage · ${fmt(top[1].kills)} kills.`;box.append(p);}
    const affordable=researchChoices().filter(c=>c.cost<=save.dna).sort((a,b)=>a.cost-b.cost);
    text('goLab',affordable.length?`Research ${affordable[0].name} · ${fmt(affordable[0].cost)} DNA`:'View research goals');
  }
  function researchChoices(){
    return [...META.map(m=>({name:m.name,cost:metaCost(m,mlvl(m.key)),key:m.key})),
      ...Object.entries(TOWERS).map(([key,d])=>({name:d.name,cost:wlvCost(d,wlv(key)),key}))];
  }
  function organizeLab(){
    const list=el('labList'),rows=[...list.children];
    const near=document.createElement('section'),goals=document.createElement('details');
    const heading=document.createElement('h3');heading.textContent='Build your next advantage';near.append(heading);
    const summary=document.createElement('summary');summary.textContent='Long-term research · range & sell value';goals.append(summary);
    rows.sort((a,b)=>Number(!!a.querySelector('button:disabled'))-Number(!!b.querySelector('button:disabled')) || Number(a.dataset.researchCost||Infinity)-Number(b.dataset.researchCost||Infinity));
    for(const row of rows) {
      const isGoal=!!row.querySelector('.labBuy.owned')||/— Range|Double Sell Value/.test(row.textContent);
      (isGoal?goals:near).append(row);
    }
    const options=researchChoices().sort((a,b)=>a.cost-b.cost),choice=options.find(c=>c.cost<=save.dna)||options[0];
    const goal=el('researchGoal');goal.replaceChildren();
    const p=document.createElement('p');p.textContent=choice.cost<=save.dna?`Ready now: ${choice.name} for ${fmt(choice.cost)} DNA.`:`Next affordable upgrade: ${choice.name}. ${fmt(choice.cost-save.dna)} more DNA to go.`;
    const meter=document.createElement('progress');meter.max=choice.cost;meter.value=Math.min(save.dna,choice.cost);meter.setAttribute('aria-label',`DNA toward ${choice.name}`);goal.append(p,meter);
    const target=rows.find(row=>row.dataset.researchName===choice.name);
    if(target){
      target.classList.add('recommended');
      const jump=document.createElement('button');jump.type='button';jump.textContent='View this upgrade';
      jump.onclick=()=>{target.scrollIntoView({block:'nearest',behavior:'instant'});target.querySelector('button').focus({preventScroll:true});};goal.append(jump);
    }
    list.replaceChildren(near,goals);
  }
  function essentialLabels(){return save.settings.combatLabels!=='full';}
  function init(){
    el('btnArmory').onclick=()=>{const open=el('shop').classList.toggle('expanded');el('btnArmory').setAttribute('aria-expanded',String(open));updateHUD();};
    el('btnOverview').onclick=()=>{
      G.overview=!G.overview;el('stage').classList.toggle('map-overview',G.overview);
      el('btnOverview').setAttribute('aria-pressed',String(G.overview));text('btnOverview',G.overview?'Close view':'Overview');
      if(G.overview){overviewCam={...G.cam};G.cam={x:0,y:0,zoom:1};}
      else G.cam=overviewCam||{x:0,y:0,zoom:1};
      clampCam();
    };
    el('undoPlacement').onclick=undo;
    el('skipGuide').onclick=()=>{G.guide=false;save.settings.fieldGuideDone=true;if(G.prepReason==='upgrade'){G.prepReason='';if(save.settings.auto)G.autoTimer=3;}persist();beginFirstWaveCountdown();updateHUD();};
    el('optChapterBreaks').onchange=e=>{save.settings.chapterBreaks=e.target.checked;persist();};
    el('optFieldGuide').onchange=e=>{save.settings.fieldGuide=e.target.checked;if(e.target.checked)save.settings.fieldGuideDone=false;persist();};
    el('optCombatLabels').onchange=e=>{save.settings.combatLabels=e.target.value;persist();};
    window.addEventListener('resize',()=>{layout();if(G.state==='playing'){clampCam();updateHUD();}});
    new ResizeObserver(()=>{if(G.state==='playing'&&docked()){clampCam();frameSelected();}}).observe(el('stage'));
    layout();
  }
  function syncSettings(){el('optChapterBreaks').checked=save.settings.chapterBreaks!==false;el('optFieldGuide').checked=save.settings.fieldGuide!==false;el('optCombatLabels').value=save.settings.combatLabels||'essential';}
  return {roles,branches,validBranch,stats,hitMultiplier,choose,weaponPanel,waveSpecies,queueIndex,theme,begin,damage,leak,
    waveEnded,waveStarted,coverage,drawPlacement,drawGuide,suggested,placed,undo,canUndo,hud,layout,debrief,organizeLab,init,syncSettings,portrait,landscape,docked,essentialLabels};
})();
