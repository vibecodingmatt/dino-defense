'use strict';
/* The collection uses the same rig and skin as the field, at inspection
   resolution. Its own clock never advances the player's match. */
(() => {
  if (typeof ART_PREVIEW_ENABLED === 'undefined' || !ART_PREVIEW_ENABLED) return;
  const notes={
    compy:'Small, restless scavengers. A narrow skull, long balancing tail, and a quick, darting stride.',
    gallimimus:'Built for flight on foot: long shins, a light beaked head, and a sweeping, elastic stride.',
    velociraptor:'Amber eyes beneath heavy brows. Striped hide, grasping hands, and raised sickle claws.',
    dilophosaurus:'Twin cranial crests frame a dark, patterned face. The brilliant throat frill makes its threat unmistakable.',
    atrociraptor:'A blunt, muscular skull and rust-colored stripes give this pursuit hunter a heavier profile.',
    pyroraptor:'A slender skull, red hide, and layered arm feathers distinguish this agile, sickle-clawed hunter.',
    dimorphodon:'An angular, tooth-lined skull on a compact aerial hunter. Long wing fingers support the bowed membranes.',
    pteranodon:'A sweeping rear crest balances the long beak. Finger bones support broad, ribbed wing membranes.',
    quetzalcoatlus:'An immense wingspan, long neck, and spear-shaped beak give this giant its unmistakable silhouette.',
    ichthyosaurus:'A streamlined marine hunter with a narrow rostrum, countershaded skin, and a vertical tail fin.',
    plesiosaurus:'The small head leads an elongated neck while four flippers drive the deep, rounded body.',
    kronosaurus:'Broad jaws and a massive head lead a powerful marine body, with paired flippers and mottled blue hide.',
    parasaurolophus:'The backward-swept crest rises above a duck-billed muzzle. Heavy hindquarters power a rolling gait.',
    pachycephalosaurus:'A thick cranial dome crowns a stocky biped, with short arms and mottled, earth-toned skin.',
    stygimoloch:'A warm amber hide, compact dome, and a crown of rear-facing horns.',
    baryonyx:'Crocodilian jaws, pebbled gray hide, and strong forearms with hooked fishing claws.',
    carnotaurus:'Paired brow horns and a deep, short skull. Tiny arms emphasize the powerful chest and hind limbs.',
    allosaurus:'Paired brow ridges, a long predatory skull, and striped olive hide over a muscular frame.',
    stegosaurus:'Staggered dorsal plates rise above the arched back. Four spikes defend the long, swinging tail.',
    triceratops:'A broad bony frill, three forward horns, and a deep chest make this animal a moving barricade.',
    ankylosaurus:'Overlapping armor, shoulder spikes, and a heavy terminal tail club protect a low, broad body.',
    therizinosaurus:'A deep belly, upright neck, and small beaked head. Long feathered arms carry enormous curved claws.',
    apatosaurus:'Columnar legs carry a barrel chest beneath a long, muscular neck and a whip-like tail.',
    brachiosaurus:'A towering neck and raised shoulders lift the tiny head above the herd. A slow, weighty four-beat walk.',
    blue:'The cobalt flank stripe follows the contours of her slate-colored hide, from the eye toward the tail.',
    trex:'Massive jaw muscles, a deep skull, small forearms, and powerful thighs. The weight of the original park legend.',
    spinosaurus:'A rust-red sail rises above the spine. The long crocodilian snout bristles with conical teeth.',
    indominus:'Pale, scarred-looking hide, irregular dorsal spines, and long grasping arms on a colossal predator.',
    indoraptor:'Coal-black skin and a gold lateral stripe. A narrow, sinister head leads long, grasping forelimbs.',
    giganotosaurus:'A heavy, elongated skull, armored brow, and a jagged ridge above dark, banded hide.',
    drex:'A swollen cranial dome and humped shoulders loom above oversized forelimbs, a second set of arms, and powerful rear legs.',
    whiteptera:'A pale aerial giant with long wing fingers, a swept crest, and cold ivory membranes.',
    mosasaurus:'A cavernous tooth-lined mouth, pebbled blue hide, and a powerful tail drive this immense lagoon predator.'
  };
  const dialog=document.createElement('dialog');dialog.id='creatureGuide';dialog.setAttribute('aria-labelledby','cgTitle');
  dialog.innerHTML=`<header class="cg-top"><div><span class="cg-eyebrow">SECTOR 7 / LIVING COLLECTION</span><h2 id="cgTitle">Beyond the fence</h2></div><button class="cg-close" aria-label="Close creature collection">&#10005;</button></header>
    <div class="cg-body"><aside class="cg-roster"><label for="cgSpecies">33 animals. Every angle.</label><select id="cgSpecies" aria-label="Choose dinosaur"></select><nav aria-label="Creature roster"></nav></aside>
    <section class="cg-main"><div class="cg-stage"><canvas width="1280" height="720" aria-label="Animated dinosaur model; drag to rotate"></canvas><span class="cg-habitat"></span><span class="cg-drag">DRAG TO ROTATE / 360°</span></div>
    <div class="cg-copy"><span class="cg-index"></span><h3></h3><p></p></div>
    <div class="cg-controls"><button class="cg-motion" aria-pressed="true">Pause motion</button><button class="cg-roar">Open jaws</button><label>View angle <input class="cg-angle" aria-label="Dinosaur view angle" type="range" min="-180" max="180" value="-22"></label></div>
    <footer class="cg-footer"><span class="cg-hint">Your match is paused while you explore.</span><span>01 / 33</span></footer></section></div>`;
  document.body.appendChild(dialog);
  const $=s=>dialog.querySelector(s),cv=$('canvas'),c=cv.getContext('2d'),keys=Object.keys(CreatureMeshes.catalog),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let key='trex',actor,phase=.3,angle=-.38,running=true,jaw=0,elapsed=0,last=0,raf=0,wasPaused=false,focus,dirty=true,drag=null;
  const buttons=new Map();
  keys.forEach((k,i)=>{
    const option=document.createElement('option');option.value=k;option.textContent=DINOS[k].name;$('#cgSpecies').appendChild(option);
    const b=document.createElement('button');b.type='button';b.dataset.key=k;b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${DINOS[k].name}${DINOS[k].boss?'<i>◆</i>':''}`;b.onclick=()=>choose(k);$('.cg-roster nav').appendChild(b);buttons.set(k,b);
  });
  function choose(k){
    key=k;actor={...DINOS[k],key:k,artView:.28};phase=.3;jaw=0;elapsed=0;dirty=true;
    Creatures.ready([k]).then(()=>{if(key===k)dirty=true;});
    const i=keys.indexOf(k)+1,def=DINOS[k];
    $('.cg-copy h3').textContent=def.name;$('.cg-copy p').textContent=notes[k];$('.cg-index').textContent=(def.boss?'APEX ENCOUNTER':'FIELD SPECIMEN')+' / '+String(i).padStart(2,'0');
    $('.cg-habitat').textContent=def.flying?'AERIAL / WINGBEAT':def.water?'MARINE / SWIM CYCLE':'TERRESTRIAL / WALK CYCLE';
    $('.cg-roar').textContent=k==='dilophosaurus'?'Display frill':'Open jaws';
    $('.cg-footer span:last-child').textContent=String(i).padStart(2,'0')+' / 33';$('#cgSpecies').value=k;
    for(const [id,b] of buttons){b.classList.toggle('active',id===k);b.setAttribute('aria-pressed',String(id===k));}
    const nav=$('.cg-roster nav');if(nav.clientHeight)nav.scrollTop+=buttons.get(k).getBoundingClientRect().top-nav.getBoundingClientRect().top-nav.clientHeight*.45;
  }
  function paint(dt){
    elapsed+=dt;
    if(running){phase+=dt*(actor.flying?3.8:actor.water?2.8:key==='compy'?5.4:2.2);dirty=true;}
    if(jaw>0){jaw=Math.max(0,jaw-dt);dirty=true;}
    if(!dirty)return;dirty=false;
    c.setTransform(1,0,0,1,0,0);
    const bg=c.createRadialGradient(690,310,30,640,430,780);bg.addColorStop(0,actor.water?'#254a51':'#344039');bg.addColorStop(.58,'#172724');bg.addColorStop(1,'#091614');c.fillStyle=bg;c.fillRect(0,0,1280,720);
    const floor=actor.water?500:570;
    c.strokeStyle='#9fbfb71b';c.lineWidth=1;
    for(let z=0;z<7;z++){const y=floor+z*z*4;c.beginPath();c.moveTo(0,y);c.lineTo(1280,y);c.stroke();}
    for(let x=-1500;x<2700;x+=180){c.beginPath();c.moveTo(640+(x-640)*.3,500);c.lineTo(x,720);c.stroke();}
    c.save();c.translate(640,floor+16);c.scale(1,.22);const sh=c.createRadialGradient(0,0,8,0,0,300);sh.addColorStop(0,'#010806aa');sh.addColorStop(1,'#01080600');c.fillStyle=sh;c.fillRect(-320,-320,640,640);c.restore();
    const size=key==='brachiosaurus'?145:key==='therizinosaurus'?195:key==='apatosaurus'?205:actor.flying?185:actor.water?205:232;
    const opening=jaw>0?Math.sin(Math.PI*Math.min(1,jaw/2.3))*.96:.035;
    if(!Creatures.inspect(c,actor,640,floor,size,phase,angle,opening))drawDino(c,{...actor,size},640,floor,Math.cos(angle)<0?-1:1,phase,1,0);
    c.fillStyle='#90b0a78a';c.font='13px monospace';c.fillText('SECTOR 7  —  OBSERVATION BAY',37,685);
  }
  function tick(now){if(!dialog.open)return;const dt=last?Math.min(.045,(now-last)/1000):0;last=now;paint(dt);raf=requestAnimationFrame(tick);}
  function setRunning(v){running=v;$('.cg-motion').textContent=v?'Pause motion':'Play motion';$('.cg-motion').setAttribute('aria-pressed',String(v));}
  function setAngle(v){angle=((v+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;$('.cg-angle').value=Math.round(angle*180/Math.PI);dirty=true;}
  function open(){
    focus=document.activeElement;wasPaused=G.paused;G.paused=true;G.creatureInspection=true;updateHUD();setRunning(!reduced.matches);dialog.showModal();choose(key);last=0;raf=requestAnimationFrame(tick);
  }
  $('#cgSpecies').onchange=e=>choose(e.target.value);$('.cg-angle').oninput=e=>setAngle(+e.target.value*Math.PI/180);
  $('.cg-motion').onclick=()=>setRunning(!running);$('.cg-roar').onclick=()=>{jaw=2.3;dirty=true;};$('.cg-close').onclick=()=>dialog.close();
  cv.onpointerdown=e=>{drag={x:e.clientX,angle};cv.setPointerCapture(e.pointerId);};cv.onpointermove=e=>{if(drag)setAngle(drag.angle+(e.clientX-drag.x)/cv.clientWidth*Math.PI*2);};cv.onpointerup=cv.onpointercancel=()=>{drag=null;};
  dialog.addEventListener('close',()=>{cancelAnimationFrame(raf);G.paused=wasPaused;G.creatureInspection=false;updateHUD();if(focus)focus.focus();});
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  for(const id of ['btnCreatures','btnFieldCreatures']){
    const button=document.getElementById(id);button.onclick=open;button.classList.remove('hidden');
  }
})();
