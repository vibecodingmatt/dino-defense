'use strict';
/* Sector 7: a layered, deterministic scene in the game's 1280 x 720 space.
   The terrain and architecture bake once. Only residents, weather and lights
   run each frame; no gameplay RNG, enemies, projectiles or timers are involved. */
const PerimeterScene = (() => {
  const TAU = Math.PI * 2;
  const terrain = new Image();
  const listeners = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let ready = false;
  terrain.onload = () => { ready = true; for (const fn of listeners) fn(); };
  terrain.src = 'assets/maps/sector7-facility.webp';

  const pen = [[380,139],[407,113],[609,113],[638,141],[638,290],[610,317],[408,317],[380,289]];
  const floor = [[395,153],[418,132],[599,132],[623,153],[623,280],[598,300],[420,300],[395,278]];
  const lamps = [[398,96],[620,96],[382,292],[636,292],[80,84],[1190,463],[126,491]];
  const reserves = [{x:374,y:79,w:270,h:261},{x:71,y:470,w:147,h:167},{x:1108,y:418,w:105,h:102}];

  function seeded(seed) {
    return () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  }
  function polygon(c, points, fill, stroke, width=1) {
    c.beginPath(); points.forEach((p,i) => i ? c.lineTo(p[0],p[1]) : c.moveTo(p[0],p[1])); c.closePath();
    if (fill) { c.fillStyle=fill; c.fill(); }
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=width; c.stroke(); }
  }
  function line(c,x1,y1,x2,y2,col,w=1) {
    c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  }
  function oval(c,x,y,rx,ry,col) {
    c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
  }
  function label(c,txt,x,y,size=10,col='#ced6cc',align='left') {
    c.fillStyle=col;c.font=`600 ${size}px "Segoe UI",sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(txt,x,y);
  }
  function glow(c,x,y,r,col,alpha=1) {
    c.save();c.globalAlpha*=alpha;
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
  }
  function metal(c,x,y,w,h,light='#667671',dark='#253330') {
    const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,light);g.addColorStop(.42,dark);g.addColorStop(1,'#111d1c');
    c.fillStyle=g;c.fillRect(x,y,w,h);c.strokeStyle='rgba(184,207,192,.38)';c.lineWidth=.8;c.strokeRect(x+.5,y+.5,w-1,h-1);
    for(const xx of [x+3,x+w-3])for(const yy of [y+3,y+h-3]){oval(c,xx,yy,1,1,'#a2afa1');}
  }
  function hazard(c,x,y,w,h) {
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.fillStyle='#b49346';c.fillRect(x,y,w,h);
    for(let i=-h;i<w+h;i+=15)polygon(c,[[x+i,y],[x+i+7,y],[x+i+7+h,y+h],[x+i+h,y+h]],'#202621');
    c.restore();
  }
  function sign(c,x,y,w,title,sub) {
    c.fillStyle='rgba(0,0,0,.45)';c.fillRect(x+3,y+4,w,31);
    metal(c,x,y,w,30,'#556258','#121d1a');
    c.fillStyle='#caa757';c.fillRect(x+1,y+1,4,28);
    label(c,title,x+w/2,y+11,11,'#f1dca5','center');
    label(c,sub,x+w/2,y+23,6,'#afb9aa','center');
  }
  function noise(c,x,y,w,h,rng,n=500) {
    for(let i=0;i<n;i++){
      c.fillStyle=i%3?'rgba(1,9,8,.19)':'rgba(198,204,165,.16)';
      c.fillRect(x+rng()*w,y+rng()*h,.5+rng()*1.8,.4+rng());
    }
  }
  function fern(c,x,y,s,seed=8) {
    const rng=seeded(seed);c.save();c.translate(x,y);
    oval(c,4,7,s,s*.4,'rgba(0,5,5,.30)');
    for(let f=0;f<9;f++){
      const a=f/9*TAU+.2,L=s*(.7+rng()*.5),dx=Math.cos(a),dy=Math.sin(a)*.6;
      line(c,0,0,dx*L,dy*L,'#435441',1);
      for(let j=1;j<10;j++){
        const t=j/10,b=Math.sin(t*Math.PI)*L*.19,px=dx*L*t,py=dy*L*t;
        for(const side of [-1,1])polygon(c,[[px-dx*2,py-dy*2],[px-dy*b*side-dx*4,py+dx*b*side*.6-dy*4],[px+dx*L*.12,py+dy*L*.12]],
          f%3===0?'#557058':f%2?'#304c3a':'#1e382c');
      }
    }
    c.restore();
  }
  function fence(c,x1,y1,x2,y2,height=34,spacing=37,damaged=false) {
    const n=Math.max(1,Math.round(Math.hypot(x2-x1,y2-y1)/spacing));
    // Wires are in elevation, anchored to the same ground plane as pylons.
    polygon(c,[[x1,y1],[x2,y2],[x2+10,y2+15],[x1+10,y1+15]],'rgba(0,4,4,.22)');
    for(let j=0;j<n;j++){
      const ax=x1+(x2-x1)*j/n,ay=y1+(y2-y1)*j/n,bx=x1+(x2-x1)*(j+1)/n,by=y1+(y2-y1)*(j+1)/n;
      for(let k=1;k<6;k++){
        const z=k*height/6;
        c.strokeStyle=k===5?'rgba(194,203,180,.55)':'rgba(130,153,141,.42)';c.lineWidth=k===5?1.25:.7;c.beginPath();c.moveTo(ax,ay-z);
        c.quadraticCurveTo((ax+bx)/2,(ay+by)/2-z+(damaged?12:2),bx,by-z);c.stroke();
      }
      // Angled tension stays break up the wire rectangle without dense mesh.
      line(c,ax,ay-3,bx,by-height+5,'rgba(97,123,112,.24)',.65);
    }
    for(let i=0;i<=n;i++){
      const x=x1+(x2-x1)*i/n,y=y1+(y2-y1)*i/n;
      polygon(c,[[x-6,y],[x+6,y],[x+10,y+5],[x-3,y+6]],'#323e37','#677167');
      metal(c,x-3,y-height,6,height,'#7a8778','#303d37');
      line(c,x-2,y-height,x-9,y-height-8,'#9aa593',2);
      line(c,x-9,y-height-8,x-9,y-height-11,'#b3ba9d',1);
      for(let k=1;k<6;k++){c.fillStyle='#c0bba0';c.fillRect(x-5,y-k*height/6-1,4,2);}
    }
  }
  function road(c,level,rng) {
    const pts=level.paths[0];
    const stroke=(w,col,dash=[])=>{c.save();c.lineJoin='round';c.lineCap='round';c.lineWidth=w;c.strokeStyle=col;c.setLineDash(dash);c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.restore();};
    stroke(74,'rgba(8,15,13,.25)');stroke(60,'#242d29');stroke(55,'#818377');stroke(51,'#242d2c');stroke(45,'#3e4844');
    // Wet aggregate follows the actual route; texture cannot obscure a bend.
    for(let j=0;j<pts.length-1;j++){
      const a=pts[j],b=pts[j+1],L=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/L,dy=(b.y-a.y)/L;
      c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));
      noise(c,0,-22,L,44,rng,Math.ceil(L*2));
      line(c,0,-13,L,-13,'rgba(9,16,16,.36)',3);line(c,0,13,L,13,'rgba(9,16,16,.36)',3);
      line(c,0,-21,L,-21,'#b8af82',1.4);line(c,0,21,L,21,'#b8af82',1.4);
      for(let x=40;x<L-30;x+=90){
        c.fillStyle='rgba(173,192,172,.12)';c.fillRect(x,-18,25,7);
        c.fillStyle='#bfb68d';c.fillRect(x+13,-1,22,2);
        for(const y of [-27,27]){metal(c,x,y-3,8,6);c.fillStyle='#b5ccb0';c.fillRect(x+2,y-1,4,1);}
      }
      for(let x=28;x<L-20;x+=181){
        c.strokeStyle='rgba(14,23,21,.8)';c.lineWidth=.8;c.beginPath();c.moveTo(x,-23);c.lineTo(x+6,-9);c.lineTo(x+2,4);c.lineTo(x+15,16);c.stroke();
      }
      c.restore();
    }
    for(const [x,y,a] of [[208,150,0],[300,349,Math.PI/2],[582,430,0],[700,256,-Math.PI/2],[880,180,0],[1000,459,Math.PI/2],[1140,560,0]]){
      c.save();c.translate(x,y);c.rotate(a);polygon(c,[[-9,-5],[2,-5],[2,-9],[13,0],[2,9],[2,5],[-9,5]],'rgba(230,225,188,.6)');c.restore();
    }
    hazard(c,87,126,13,48);hazard(c,1192,536,13,48);
  }
  function utility(c,x,y,w,h,title,rng) {
    // Roof, vertical face, concrete footing, exposed HVAC and conduits.
    c.fillStyle='rgba(0,0,0,.36)';c.fillRect(x+12,y+14,w+7,h+8);
    c.fillStyle='#6b7365';c.fillRect(x-6,y+h-4,w+12,19);
    metal(c,x,y,w,h,'#7c8270','#2b3b33');
    metal(c,x,y+h-19,w,24,'#49564a','#182823');
    noise(c,x,y,w,h,rng,400);
    for(let yy=y+5;yy<y+h-20;yy+=6)line(c,x+3,yy,x+w-3,yy,'rgba(13,23,19,.45)',1.5);
    for(let k=0;k<2;k++){
      metal(c,x+12+k*40,y+11,31,25,'#839081','#384941');
      oval(c,x+27+k*40,y+23,10,8,'#14251f');
      for(let a=0;a<8;a++){const angle=a*Math.PI/4;line(c,x+27+k*40,y+23,x+27+k*40+Math.cos(angle)*8,y+23+Math.sin(angle)*6,'#6c7c6c',1.5);}
    }
    metal(c,x+w-34,y+h-17,22,21,'#526551','#172a21');
    for(let k=0;k<3;k++){c.fillStyle='#a8cdaf';c.fillRect(x+10+k*23,y+h-12,17,4);}
    hazard(c,x,y+h+5,w,6);label(c,title,x+8,y+h-27,8,'#d8d8b8');
    line(c,x+w-6,y+4,x+w-6,y+h-22,'#c0ad79',2);
  }
  function paddockBase(c,rng) {
    polygon(c,pen.map(([x,y])=>[x+15,y+20]),'rgba(0,4,3,.5)');
    polygon(c,pen,'#60695a','#9ba18d',2);
    polygon(c,floor,'#132a22','#222f25',3);
    // The pit's far retaining wall: stained concrete disappearing into shadow.
    polygon(c,[[395,153],[418,132],[599,132],[623,153],[613,178],[600,160],[418,160],[405,178]],'#344237');
    noise(c,405,137,204,32,rng,600);
    const pit=c.createLinearGradient(0,158,0,302);pit.addColorStop(0,'#14291f');pit.addColorStop(.55,'#3b4b36');pit.addColorStop(1,'#1f3328');
    polygon(c,[[405,178],[418,160],[600,160],[613,178],[613,272],[594,287],[424,287],[405,272]],pit);
    c.save();polygon(c,floor);c.clip();noise(c,395,154,230,150,rng,1800);
    for(let i=0;i<20;i++)oval(c,414+rng()*189,177+rng()*99,4+rng()*13,2+rng()*4,i%2?'rgba(5,16,13,.22)':'rgba(131,145,92,.1)');
    oval(c,538,266,47,13,'#243a35');oval(c,536,263,40,9,'rgba(141,174,159,.19)');
    // Mud tracks around the pool, and three unmistakable claw marks in concrete.
    for(let i=0;i<13;i++){const a=i*.26;line(c,467+Math.cos(a)*56,230+Math.sin(a)*39,470+Math.cos(a)*56,233+Math.sin(a)*39,'rgba(1,12,6,.47)',2);}
    for(let i=0;i<3;i++)line(c,542+i*7,142,536+i*7,157,'#b2b49a',1.1);
    for(const [x,y,s] of [[412,191,24],[599,179,28],[428,277,24],[604,263,22],[487,175,19]])fern(c,x,y,s,x+y);
    c.restore();
    // Rear quarantine stall. Dark doorway is a real occlusion pocket.
    metal(c,437,143,69,41,'#455246','#14241c');c.fillStyle='#071610';c.fillRect(446,155,47,29);
    for(let x=448;x<491;x+=8)line(c,x,156,x,181,'#4b5c46',1);
    label(c,'HOLD 03',472,150,6,'#c8bd91','center');
    // Far and side fences are baked behind the residents.
    for(const i of [0,1,2,3,7]){const a=pen[i],b=pen[(i+1)%pen.length];fence(c,...a,...b,37,35);}
    hazard(c,425,108,167,5);
    // Observation rail, grated walkway and cantilevered feeding gantry.
    metal(c,381,302,258,24,'#66766a','#24352d');
    for(let x=386;x<637;x+=4)line(c,x,305,x,322,'#111f1a',1);
    sign(c,427,74,166,'RAPTOR PADDOCK','03 ANIMALS / RESTRICTED ACCESS');
    metal(c,624,160,17,97,'#76816d','#26392b');
    polygon(c,[[630,171],[630,145],[511,125],[507,140]],'#57644e','#acac84',1);
    for(let x=521;x<624;x+=18){line(c,x,128+(x-511)*.168,x+14,142+(x-511)*.126,'#1e3024',1.5);}
    line(c,631,156,547,130,'#b1b096',1);label(c,'FEED SYSTEM',574,139,5,'#ded3a7','center');
    // Separate amber work lamps read as lights, rather than neon fence wire.
    for(const [x,y] of lamps.slice(0,4)){metal(c,x-7,y-4,14,7);c.fillStyle='#eee3b3';c.fillRect(x-5,y-3,10,2);glow(c,x,y,35,'rgba(238,212,143,.19)');}
  }
  function paddockFront(c) {
    for(const i of [4,5,6]){const a=pen[i],b=pen[(i+1)%pen.length];fence(c,...a,...b,39,34);}
    // A gate with heavy cross braces and a latch, layered OVER the animals.
    metal(c,485,283,49,37,'#697463','#2b3a2b');
    for(let x=490;x<532;x+=7)line(c,x,287,x,315,'#14231b',2);
    line(c,488,286,531,316,'#a1a388',2);line(c,488,316,531,286,'#78876d',1.3);
    metal(c,528,299,9,6);hazard(c,485,319,49,5);
    sign(c,435,329,146,'DANGER · 10,000 V','STAND CLEAR OF THE FENCE');
  }
  function gate(c,x,y,exit=false) {
    for(const s of [-1,1]){
      const yy=y+s*46;
      polygon(c,[[x-15,yy-6],[x+15,yy-6],[x+24,yy+10],[x-6,yy+14]],'#697263','#9b9d85');
      metal(c,x-12,yy-45,24,51,'#8b907d','#344436');
      hazard(c,x-12,yy-8,24,9);
      metal(c,x-16,yy-49,32,9,'#a2a38a','#57624f');
      oval(c,x,yy-53,3,3,exit?'#b9d7c1':'#e2a46d');
    }
    if(exit){
      metal(c,x-11,y-65,22,94,'#485c4d','#152820');
      for(let yy=y-59;yy<y+26;yy+=7)line(c,x-8,yy,x+8,yy,'#84917a',1);
      sign(c,x-106,y-82,124,'SECTOR 7 / EVAC','KEEP THE ACCESS ROAD CLEAR');
    }else{
      // Torn fence wing leans into the earth beside the breach, not the lane.
      c.save();c.translate(x+12,y+58);c.rotate(.19);metal(c,0,-15,67,23);for(let xx=4;xx<65;xx+=8)line(c,xx,-12,xx,5,'#101d16',2);c.restore();
      sign(c,x-25,y-105,130,'PERIMETER BREACH','AUXILIARY POWER ONLY');
      line(c,x,y-91,x+3,y-70,'#665e42',2);
    }
  }
  function searchlight(c,x,y,angle,length,width,alpha) {
    c.save();c.translate(x,y);c.rotate(angle);
    const g=c.createLinearGradient(0,0,length,0);g.addColorStop(0,`rgba(225,232,198,${alpha})`);g.addColorStop(.45,`rgba(200,226,201,${alpha*.43})`);g.addColorStop(1,'rgba(191,217,197,0)');
    polygon(c,[[0,-2],[length,-width],[length,width],[0,2]],g);
    c.restore();
  }
  function bake(level,W,H) {
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.scale(W/1280,H/720);
    const rng=seeded(730197);c.fillStyle='#273d31';c.fillRect(0,0,1280,720);
    if(ready)c.drawImage(terrain,0,0,1280,720);
    else {
    noise(c,0,0,1280,720,rng,6000);for(let i=0;i<90;i++){const x=rng()*1280,y=i%2?rng()*60:655+rng()*65;fern(c,x,y,24+rng()*25,i);}
    c.fillStyle='rgba(9,27,22,.11)';c.fillRect(0,0,1280,720);
    road(c,level,rng);
    // Ground-level emergency deployment aprons frame each turn.
    for(const [x,y,w,h] of [[344,363,286,29],[742,235,205,106],[350,487,280,80],[746,474,185,116]]){
      c.save();c.globalAlpha=.48;metal(c,x,y,w,h,'#64705f','#344137');noise(c,x,y,w,h,rng,300);c.restore();
      for(let xx=x+10;xx<x+w;xx+=32)line(c,xx,y+h-3,Math.min(xx+12,x+w-3),y+h-3,'rgba(204,191,134,.42)',1);
    }
    label(c,'DEFENSE LINE  A',369,383,7,'#c3c4a6');label(c,'RESPONSE / 07',775,322,8,'#b9c1ab');
    // Heavy boundary fence runs into the jungle and leads to the breach.
    fence(c,18,75,343,75,32,43);fence(c,678,79,1267,79,32,48);
    fence(c,23,250,23,644,36,56);fence(c,248,677,1232,677,38,48);
    paddockBase(c,rng);
    utility(c,79,528,131,78,'AUXILIARY POWER',rng);
    utility(c,1115,434,90,68,'CONTROL 07',rng);
    // Transformer yard, ribbed ceramic insulators, cables and conduit trenches.
    metal(c,91,489,105,30,'#5b6857','#25362a');
    for(let x=103;x<185;x+=25){metal(c,x,490,14,20);for(let yy=487;yy>473;yy-=3)line(c,x+2,yy,x+12,yy,'#a29e7a',2);}
    c.strokeStyle='#141e16';c.lineWidth=4;c.beginPath();c.moveTo(96,519);c.lineTo(66,519);c.lineTo(66,407);c.lineTo(41,388);c.stroke();
    sign(c,82,617,123,'GENERATOR B','GRID OFFLINE / DIESEL ACTIVE');
    // An abandoned expedition vehicle, with twin headlamp pools on wet earth.
    c.save();c.translate(180,288);c.rotate(-.14);c.scale(1.55,1.55);bakeJeep(c,0,0);c.restore();
    searchlight(c,223,280,-.10,85,16,.17);searchlight(c,222,287,.04,83,14,.12);
    label(c,'TOUR 04',146,310,7,'#b9b19a');
    // Tire furrows, cargo and a storm-damaged cable near the observation hut.
    for(const dy of [-6,6])line(c,95,292+dy,155,288+dy,'rgba(5,16,12,.5)',3);
    for(const [x,y] of [[1081,370],[1099,375],[224,549]]){metal(c,x,y,16,20,'#787355','#3b402e');line(c,x+2,y+2,x+14,y+18,'#b4a36b',1);}
    gate(c,66,150);gate(c,1235,560,true);
    for(const [x,y,s] of [[351,64,29],[667,104,28],[264,530,31],[1104,620,28],[40,443,32],[1167,318,22]])fern(c,x,y,s,x+y);
    // Foreground fronds and long shadows give the camera a sheltered vantage.
    for(const [x,y,s] of [[20,705,69],[1240,716,75],[12,16,53],[1267,12,55]])fern(c,x,y,s,x+18);
    const grade=c.createLinearGradient(0,0,1280,720);grade.addColorStop(0,'rgba(10,26,23,.01)');grade.addColorStop(.6,'rgba(5,26,26,.05)');grade.addColorStop(1,'rgba(3,17,20,.22)');c.fillStyle=grade;c.fillRect(0,0,1280,720);
    }
    const front=document.createElement('canvas');front.width=1280;front.height=720;const fc=front.getContext('2d');
    if(ready){
      // Sprite crops from the same plate preserve the artwork's exact lighting
      // and depth. The lower barrier and leafy side pockets occlude residents.
      const crop=(x,y,w,h)=>fc.drawImage(terrain,x/1280*terrain.width,y/720*terrain.height,w/1280*terrain.width,h/720*terrain.height,x,y,w,h);
      crop(374,290,275,73);crop(395,186,26,102);crop(601,180,31,109);
      // Live electric cables close the front of the pit above its catwalk.
      for(let j=0;j<4;j++){
        const y=268+j*7;fc.strokeStyle='rgba(157,176,154,.54)';fc.lineWidth=.85;fc.beginPath();fc.moveTo(394,y);fc.quadraticCurveTo(510,y+3,625,y);fc.stroke();
      }
      for(const x of [433,480,531,580]){line(fc,x,265,x,302,'#34463a',2.2);line(fc,x-.5,265,x-.5,302,'rgba(173,179,147,.65)',.65);}
    }else paddockFront(fc);
    // Include the fence and a resident in the static thumbnail. The game uses
    // the clean base, with the front layer reapplied after its live residents.
    const thumb=document.createElement('canvas');thumb.width=W;thumb.height=H;const tc=thumb.getContext('2d');tc.drawImage(cv,0,0);tc.save();tc.scale(W/1280,H/720);inhabitants(tc,6,{front,painted:ready});tc.restore();
    return {cv,thumb,front,painted:ready,flames:[],exit:null,art:'perimeter'};
  }
  function animalStates(time) {
    return PaddockRaptors.states(time);
  }
  function inhabitants(c,time,scene,towers=[]) {
    c.save();polygon(c,floor);c.clip();
    for(const a of animalStates(time).sort((a,b)=>a.y-b.y))PaddockRaptors.draw(c,a);
    // Feed hook hangs from the gantry and sways slightly with the wind.
    const sway=Math.sin(time*.7)*2;line(c,545,145,545+sway,205,'#b5b89f',.9);
    c.strokeStyle='#d2c8a4';c.lineWidth=1.7;c.beginPath();c.arc(548+sway,205,3,0,Math.PI*1.4);c.stroke();
    // Foreground plants intermittently conceal the far animal.
    if(!scene.painted){c.save();c.translate(600,247);c.rotate(Math.sin(time*.6)*.025);fern(c,0,0,27,503);c.restore();}
    c.restore();c.drawImage(scene.front,0,0);
    // Old saved runs may already have a weapon inside the rebuilt facility.
    // Keep it in place, rendered on a steel mount, without moving or refunding it.
    for(const t of towers)if(blocked(t.x,t.y)){
      oval(c,t.x,t.y+4,22,11,'#17251d');metal(c,t.x-18,t.y-9,36,22,'#7d8975','#3c4b38');
    }
  }
  function weather(c,time,W,H) {
    const t=reducedMotion.matches?6:time;
    c.save();c.scale(W/1280,H/720);
    // Search beams are above the terrain but below the actors and aiming UI.
    searchlight(c,398,96,1.10+Math.sin(t*.16)*.45,226,43,.17);
    searchlight(c,620,96,1.95+Math.sin(t*.13+1)*.42,251,48,.16);
    searchlight(c,1190,423,2.83+Math.sin(t*.12)*.42,271,43,.13);
    c.restore();
  }
  function atmosphere(c,time,W,H) {
    const still=reducedMotion.matches,t=still?6:time;
    c.save();c.scale(W/1280,H/720);
    // Wet materials and low mist carry the storm atmosphere without streaks
    // or repeated splash rings floating over the battlefield.
    // Low mist crosses the clearings, with no full-screen blur or filter passes.
    for(let i=0;i<3;i++){
      const x=260+i*385+Math.sin(t*.075+i*2)*69,y=355+i*91;
      c.save();c.translate(x,y);c.scale(3.9,.47);glow(c,0,0,83,'rgba(168,204,183,.07)');c.restore();
    }
    for(const [x,y] of lamps){
      const pulse=.72+.15*Math.sin(t*1.4+x);glow(c,x,y,13,'rgba(245,198,113,.30)',pulse);oval(c,x,y,2,1.5,'#f1dba5');
    }
    // One brief localized electrical fault every 19s; never a screen flash.
    const fault=((t%19)+19)%19;
    if(!still&&fault>15&&fault<15.48){
      const a=Math.sin((fault-15)*Math.PI/.48);c.globalAlpha=a;
      c.strokeStyle='#c6e9d8';c.lineWidth=1.2;c.beginPath();c.moveTo(69,74);c.lineTo(60,83);c.lineTo(71,91);c.lineTo(61,101);c.stroke();glow(c,66,86,42,'rgba(128,212,194,.38)');c.globalAlpha=1;
    }
    // Status plate is attached to the paddock, not a new HUD over the battle.
    metal(c,550,306,71,13,'#253d31','#14271f');oval(c,556,312,1.8,1.8,'#c4af62');
    label(c,Math.sin(t*.18)>.63?'MOVEMENT':'03 / CONTAINED',562,312,5,'#ccd1ad');
    c.restore();
  }
  function blocked(x,y) {return reserves.some(r=>x>r.x-16&&x<r.x+r.w+16&&y>r.y-16&&y<r.y+r.h+16);}
  function draw(c,time,scene,towers=[]) {
    if(!scene)return;const t=reducedMotion.matches?6:time;inhabitants(c,t,scene,towers);
  }
  return {bake,draw,weather,atmosphere,blocked,animalStates,reserves,onReady:fn=>listeners.add(fn),get ready(){return ready;}};
})();
