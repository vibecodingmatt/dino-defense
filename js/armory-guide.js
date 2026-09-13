'use strict';
/* A no-cost firing range: all previews use the live meshes and effect painters,
   but have their own clock and particles. Opening it pauses the active match. */
(() => {
  if (typeof ART_PREVIEW_ENABLED === 'undefined' || !ART_PREVIEW_ENABLED) return;
  const dialog=document.createElement('dialog');dialog.id='armoryGuide';dialog.setAttribute('aria-labelledby','agTitle');
  dialog.innerHTML=`<div class="ag-top"><div><span class="ag-eyebrow">SECTOR 7 / WEAPONS DIVISION</span><h2 id="agTitle">The arsenal</h2></div><button class="ag-close" aria-label="Close weapon guide">✕</button></div>
    <div class="ag-body"><nav class="ag-weapons" aria-label="Choose weapon"></nav><section class="ag-main">
    <div class="ag-stage"><canvas width="1120" height="620" aria-label="Animated weapon firing demonstration"></canvas><span class="ag-status">LIVE FIRE / FIELD TEST</span></div>
    <div class="ag-spec"><div><span class="ag-level"></span><h3 class="ag-name"></h3><p class="ag-detail"></p></div><button class="ag-fire">Pause demo</button></div>
    <div class="ag-tiers" role="group" aria-label="Choose upgrade"></div>
    <div class="ag-footer"><label>View angle <input class="ag-angle" aria-label="Weapon view angle" type="range" min="-180" max="180" value="-12"></label><span>Preview any upgrade. Your match is paused.</span></div>
    </section></div>`;
  document.body.appendChild(dialog);
  const $=s=>dialog.querySelector(s),cv=$('canvas'),c=cv.getContext('2d');
  let key='gatling',lv=0,angle=-.21,running=true,time=0,last=0,raf=0,wasPaused=false,shotAt=-10,previousFocus=null;
  let particles=[],projs=[],bolts=[],clouds=[],victim=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const buttons=new Map();
  for(const [k,def] of Object.entries(TOWERS)){
    const b=document.createElement('button');b.type='button';b.dataset.key=k;b.innerHTML=`<canvas width="140" height="92" aria-hidden="true"></canvas><span>${def.name}</span>`;Arsenal.preview(b.querySelector('canvas'),k,def.maxUp);b.onclick=()=>choose(k,0);$('.ag-weapons').appendChild(b);buttons.set(k,b);
  }
  function choose(k,level){
    key=k;lv=level;time=0;shotAt=-10;particles=[];projs=[];bolts=[];clouds=[];victim=null;
    const data=Arsenal.info(key,lv);dialog.style.setProperty('--weapon-color',data.color);
    for(const [id,b] of buttons){b.classList.toggle('active',id===key);b.setAttribute('aria-pressed',id===key?'true':'false');}
    $('.ag-name').textContent=data.name;$('.ag-detail').textContent=data.detail;$('.ag-level').textContent=TOWERS[key].name.toUpperCase()+' / LEVEL '+(lv+1);
    $('.ag-tiers').replaceChildren();
    Arsenal.catalog[key].tiers.forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.className=i===lv?'active':'';b.setAttribute('aria-pressed',i===lv?'true':'false');b.innerHTML=`<span>0${i+1}</span> ${name}`;b.onclick=()=>choose(key,i);$('.ag-tiers').appendChild(b);});
    paint(0);
  }
  function pose(){return {key,ulv:lv,x:94,y:117,angle,spin:time*26,recoil:Math.max(0,1-(time-shotAt)*6),cd:Math.max(0,1.2-(time-shotAt)),cdMax:1.2};}
  function target(t){const p=Arsenal.anchor(t);return {x:p.x+Math.cos(angle)*63,y:p.y+Math.sin(angle)*63+10};}
  function shoot(){
    shotAt=time;const t=pose(),p=Arsenal.anchor(t),end=target(t);victim=null;
    WeaponFX.fire(particles,t,80);
    const impactKind=key==='cryo'?'frost':key==='missile'||key==='mortar'?'boom':key==='sonic'?'sonic':'spark';
    if(['gatling','cryo','missile','mortar'].includes(key)){
      const count=key==='missile'?lv+1:1;
      for(let i=0;i<count;i++){const a=Arsenal.anchor(t,i);projs.push({kind:TOWERS[key].proj,tower:t,x:a.x,y:a.y,x0:a.x,y0:a.y,tx:end.x,ty:end.y-10,t:0,dur:key==='mortar'?.68:.3,trail:[],arc:0,vx:Math.cos(angle),vy:Math.sin(angle),impactKind});}
    }else{
      if(key==='tesla'||key==='sniper')bolts.push({x1:p.x,y1:p.y,x2:end.x,y2:end.y-10,t:.22,dur:.22,jag:key==='tesla',lv,w:2,color:key==='tesla'?'#bda7ff':'#bfeeff',glow:'rgba(132,153,255,.22)'});
      if(key==='flamer')WeaponFX.emit(particles,'flame',p.x,p.y,{dur:.24,r:78,weapon:key,lv,ang:angle});
      if(key==='gas'){WeaponFX.emit(particles,'gaspuff',p.x,p.y,{dur:.55,r:16,weapon:key,lv,ang:angle});clouds=[{x:end.x,y:end.y,r:38,t:0,dur:1.6,tower:t,seed:4}];}
      if(key==='sonic')WeaponFX.emit(particles,'sonic',t.x,t.y,{dur:.55,r:85,weapon:key,lv});
      kill(t,end);
    }
  }
  function kill(t,p){
    if(victim)return;victim={t:time,dur:DinoFX.durations[key]};const d={...DINOS.velociraptor,key:'velociraptor',size:15,phase:.7};WeaponFX.death(particles,d,p,t);
  }
  function paint(dt){
    const width=280,height=155;
    if(running){
      time+=dt;
      const interval=key==='gatling'?.21:key==='flamer'?.18:DinoFX.durations[key]+.5;
      const burst=time%2.4<.65;
      if((!['gatling','flamer'].includes(key)||burst)&&time-shotAt>interval)shoot();
      for(const f of particles)f.t+=dt;particles=particles.filter(f=>f.t<f.dur);
      for(const b of bolts)b.t-=dt;bolts=bolts.filter(b=>b.t>0);
      for(const f of clouds)f.t+=dt;clouds=clouds.filter(f=>f.t<f.dur);
      for(const pr of projs){WeaponFX.trail(pr,dt);pr.t+=dt;const q=Math.min(1,pr.t/pr.dur);pr.x=pr.x0+(pr.tx-pr.x0)*q;pr.y=pr.y0+(pr.ty-pr.y0)*q;pr.arc=pr.kind==='mortar'?Math.sin(q*Math.PI)*35:0;
        if(q>=1){WeaponFX.emit(particles,pr.impactKind,pr.tx,pr.ty,{r:pr.kind==='bullet'?7:35,dur:.7,weapon:key,lv});kill(pr.tower,{x:pr.tx,y:pr.ty+10});}}
      projs=projs.filter(p=>p.t<p.dur);
    }
    c.setTransform(4,0,0,4,0,0);c.fillStyle='#101b22';c.fillRect(0,0,width,height);
    const g=c.createRadialGradient(110,90,5,130,85,170);g.addColorStop(0,'#2c3a40');g.addColorStop(1,'#0d171e');c.fillStyle=g;c.fillRect(0,0,width,height);
    c.strokeStyle='#a3c5cf0e';c.lineWidth=.4;for(let x=-100;x<380;x+=16){c.beginPath();c.moveTo(x,35);c.lineTo(x+95,155);c.stroke();}for(let y=40;y<160;y+=12){c.beginPath();c.moveTo(0,y);c.lineTo(280,y);c.stroke();}
    // Keep every orientation in frame; the center of weapon + target stays put.
    const t=pose(),p=target(t),centerX=(t.x+p.x)/2;c.save();c.translate(140-centerX,-5);
    for(const f of clouds)WeaponFX.cloud(c,f);
    if(!victim||time-victim.t>victim.dur)drawDino(c,{...DINOS.velociraptor,key:'velociraptor',size:15},p.x,p.y,Math.cos(angle)>0?-1:1,.7,1,0);
    Arsenal.base(c,t.x,t.y,key,false,lv);Arsenal.turret(c,t,time-shotAt<.045?.12:0,time);
    for(const pr of projs)WeaponFX.projectile(c,pr,time);for(const b of bolts)WeaponFX.bolt(c,b,time);for(const f of particles)WeaponFX.draw(c,f,time);c.restore();
    c.setTransform(1,0,0,1,0,0);
  }
  function tick(now){if(!dialog.open)return;const dt=last?Math.min(.04,(now-last)/1000):0;last=now;paint(dt);raf=requestAnimationFrame(tick);}
  function setRunning(v){running=v;$('.ag-fire').textContent=running?'Pause demo':'Play demo';$('.ag-status').textContent=running?'LIVE FIRE / FIELD TEST':'WEAPON INSPECTION';}
  document.getElementById('btnArsenal').onclick=()=>{
    previousFocus=document.activeElement;wasPaused=G.paused;G.paused=true;updateHUD();
    setRunning(!reduced.matches);choose(G.selected?G.selected.key:G.placing||'gatling',G.selected?G.selected.ulv:0);
    dialog.showModal();last=0;raf=requestAnimationFrame(tick);
  };
  document.getElementById('btnArsenal').classList.remove('hidden');
  $('.ag-close').onclick=()=>dialog.close();$('.ag-fire').onclick=()=>setRunning(!running);
  $('.ag-angle').oninput=e=>{angle=+e.target.value*Math.PI/180;particles=[];projs=[];bolts=[];clouds=[];victim=null;shotAt=time;paint(0);};
  dialog.addEventListener('close',()=>{cancelAnimationFrame(raf);G.paused=wasPaused;updateHUD();if(previousFocus)previousFocus.focus();});
  // Avoid game hotkeys changing build selection or speed behind the dialog.
  dialog.addEventListener('keydown',e=>e.stopPropagation());
})();
