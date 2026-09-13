'use strict';
/* Six painted environments in the existing 1280 x 720 world. Static plates
   bake once; deterministic, bounded set pieces use the unaccelerated scenery
   clock. Nothing here emits audio, consumes gameplay RNG or owns game state. */
const SanctuaryScene = (() => {
  const TAU = Math.PI * 2;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const keys = ['visitor','aviary','delta','lockwood','proving','lagoon'];
  const plates = new Map(), listeners = new Set(), mounts = new Map();
  // Image-space registration: project painted paving onto existing saved-world
  // coordinates. The source images remain intact; no route or save is moved.
  const registration = {
    aviary: {x:[[0,0],[214,210],[514,520],[817,820],[1097,1100],[1280,1280]],y:[[0,0],[113,120],[194,200],[353,360],[442,450],[586,600],[720,720]]},
    delta: {x:[[0,0],[217,220],[1075,1080],[1280,1280]],y:[[0,0],[86,90],[293,300],[518,530],[720,720]]},
    lockwood: {x:[[0,0],[194,200],[304,300],[649,640],[980,980],[1280,1280]],y:[[0,0],[152,160],[199,200],[333,340],[435,430],[500,500],[720,720]]},
    lagoon: {y:[[0,0],[112,150],[144,160],[292,320],[419,440],[472,480],[543,560],[555,570],[720,720]]},
  };
  const ready = key => !!plates.get(key)?.ready;
  for (const key of keys) {
    const im = new Image(), state = {im,ready:false,failed:false}; plates.set(key,state);
    im.onload = () => {state.ready=true; for(const fn of listeners)fn(key);};
    im.onerror = () => {state.failed=true;};
    im.src = `assets/maps/${key}-sanctuary.webp`;
  }
  function mapAxis(value, points) {
    if(!points)return value;
    for(let i=1;i<points.length;i++)if(value<=points[i][0]) {
      const a=points[i-1],b=points[i];return a[1]+(value-a[0])/(b[0]-a[0])*(b[1]-a[1]);
    }
    return value;
  }
  function anchor(key,x,y) {const r=registration[key]||{};return [mapAxis(x,r.x),mapAxis(y,r.y)];}
  function registeredPlate(c,im,key) {
    const r=registration[key]||{},xs=r.x||[[0,0],[1280,1280]],ys=r.y||[[0,0],[720,720]];
    for(let xi=1;xi<xs.length;xi++)for(let yi=1;yi<ys.length;yi++) {
      const [sx,dx]=xs[xi-1],[ex,tx]=xs[xi],[sy,dy]=ys[yi-1],[ey,ty]=ys[yi];
      c.drawImage(im,sx/1280*im.width,sy/720*im.height,(ex-sx)/1280*im.width,(ey-sy)/720*im.height,dx,dy,tx-dx,ty-dy);
    }
  }
  function oval(c,x,y,rx,ry,color) {c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
  function line(c,x,y,ex,ey,color,width=1) {c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();}
  function poly(c,pts,color,edge) {c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=.8;c.stroke();}}
  function glow(c,x,y,r,color,alpha=1) {
    c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();
  }
  function rings(c,x,y,rx,ry,t,color,n=4) {
    c.save();c.strokeStyle=color;c.lineWidth=.8;
    for(let i=0;i<n;i++){const q=(t*.22+i/n)%1;c.globalAlpha=(1-q)*.48;c.beginPath();c.ellipse(x,y,rx*(.15+.85*q),ry*(.15+.85*q),0,0,TAU);c.stroke();}c.restore();
  }
  function fountain(c,x,y,t,s=1) {
    c.save();c.translate(x,y);c.scale(s,s);rings(c,0,5,48,26,t,'#c8faff');
    for(let i=0;i<7;i++){
      const a=i/7*TAU,ex=Math.cos(a)*31,ey=Math.sin(a)*16+5;
      c.strokeStyle='rgba(205,249,246,.30)';c.lineWidth=1.1;c.beginPath();c.moveTo(0,-13);c.quadraticCurveTo(ex*.55,-47,ex,ey);c.stroke();
      for(let j=0;j<3;j++){const q=(t*.65+j/3+i*.13)%1,px=ex*q,py=(1-q)*(1-q)*-13+2*(1-q)*q*-47+q*q*ey;oval(c,px,py,.65,1.3,'rgba(240,255,251,.65)');}
    }
    c.restore();
  }
  function waterfall(c,x,y,w,h,t) {
    c.save();c.beginPath();c.moveTo(x-w*.3,y);c.lineTo(x+w*.3,y);c.lineTo(x+w*.6,y+h);c.lineTo(x-w*.55,y+h);c.closePath();c.clip();
    for(let i=0;i<22;i++){
      const px=x+Math.sin(i*12.9898)*w*.5,py=y+((i*.173+t*(.45+i%3*.07))%1)*h;
      line(c,px,py,px+Math.sin(t+i)*1.5,py+9+i%7,'rgba(224,255,252,.19)',.5+i%3*.4);
    }
    c.restore();
    for(let i=0;i<4;i++){const q=(t*.13+i*.25)%1;glow(c,x+Math.sin(i*2+t*.25)*w*.4,y+h-2-q*12,w*.45+q*18,'rgba(216,252,246,.14)',1-q);}
  }
  function water(c,x,y,rx,ry,t,bright=false) {
    c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.clip();
    c.strokeStyle=bright?'rgba(109,248,237,.22)':'rgba(215,240,211,.16)';c.lineWidth=.65;
    for(let i=0;i<20;i++){
      const px=x+Math.sin(i*4.79)*rx,py=y+Math.cos(i*9.31)*ry+Math.sin(t*.6+i)*3;
      c.beginPath();c.moveTo(px-5,py);c.quadraticCurveTo(px,py-2,px+6+Math.sin(t+i)*3,py);c.stroke();
    }
    c.restore();
  }
  function butterflies(c,t,x,y,count=6) {
    for(let i=0;i<count;i++){
      const a=t*.15+i*2.4,px=x+Math.sin(a)*48,py=y+Math.cos(a*.71)*29,s=.5+Math.abs(Math.sin(t*7+i))*.9;
      c.save();c.translate(px,py);c.rotate(Math.sin(a)*.6);oval(c,-s,0,s,1.6,i%2?'#eaa965':'#8de0ca');oval(c,s,0,s,1.6,i%2?'#eaa965':'#8de0ca');c.restore();
    }
  }
  // Small optical silhouettes stay on the scenery layer, behind combat actors.
  function flyers(c,t,x,y,r,count=3,bats=false) {
    for(let i=0;i<count;i++){
      const a=t*.09+i*2.1,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.30;
      c.save();c.translate(px,py);c.rotate(Math.atan2(Math.cos(a)*.3,-Math.sin(a)));const f=Math.sin(t*(bats?8:2.6)+i),s=bats?3:5;
      poly(c,[[-s,0],[-s*.3,-s*(.5+f*.18)],[0,-1],[s*.3,-s*(.5+f*.18)],[s,0],[1,1],[0,3],[-1,1]],bats?'rgba(6,12,23,.65)':'rgba(16,44,48,.55)');c.restore();
    }
  }
  function visitor(c,t) {
    fountain(c,744,262,t);water(c,100,359,62,33,t);water(c,1084,177,53,30,t);
    butterflies(c,t,218,306);butterflies(c,t+8,987,281,4);
    glow(c,741,149,55,'rgba(255,202,98,.10)',.8+.2*Math.sin(t*.6));
  }
  function aviary(c,t) {
    // Set-piece coordinates belong to the source plate and share its projection.
    const at=(x,y)=>anchor('aviary',x,y);
    waterfall(c,...at(674,149),47,149,t);waterfall(c,...at(340,194),23,47,t+3);waterfall(c,...at(986,280),20,69,t+7);
    water(c,...at(670,384),63,39,t,true);water(c,...at(345,331),42,70,t+2,true);water(c,...at(956,418),40,50,t+4,true);
    flyers(c,t,...at(670,378),108);flyers(c,t+19,...at(956,365),72,2);
    // Sunlit suspended pollen follows slow independent currents inside the dome.
    for(let i=0;i<14;i++){const x=590+Math.sin(i*9.2+t*.04)*118,y=175+(i*31+t*3)%310;oval(c,x,y,.65,.65,'rgba(244,246,218,.36)');}
  }
  function helicopterState(time) {
    const q=time%64;
    if(q<7||q>53)return null;
    const approach=Math.min(1,(q-7)/13),depart=Math.max(0,(q-38)/15),ease=v=>v*v*(3-2*v);
    const x=q<20?1360+(918-1360)*ease(approach):918+460*ease(depart);
    const y=q<20?320+(410-320)*ease(approach):410-180*ease(depart);
    const altitude=q<20?32*(1-approach)+8:q<27?8*(1-(q-20)/7):q<34?0:Math.min(40,(q-34)*3);
    const [px,py]=anchor('delta',x,y),down=Math.min(4,Math.max(0,q-27)),up=Math.min(3,Math.max(0,q-34));
    const rotor=q<27?1:q<31?1-down/4:q<34?0:Math.min(1,(q-34)/3);
    const phase=(Math.min(q,27)+down-down*down/8+up*up/6+Math.max(0,q-37))*28;
    return {x:px,y:py,altitude,rotor,phase,heading:q<38?-.16:-.16-depart*.6};
  }
  function helicopter(c,t) {
    const p=helicopterState(t);if(!p)return;
    oval(c,p.x+12+p.altitude*.35,p.y+9,30,12,'rgba(3,18,16,.22)');
    if(p.altitude>1&&p.altitude<24)rings(c,p.x,p.y,54,22,t*3,'#ced1a5',3);
    c.save();c.translate(p.x,p.y-p.altitude);c.rotate(p.heading);c.scale(.85,.85);
    // Skids, tail boom, paneled hull and glazed cockpit in overhead projection.
    line(c,-22,-12,21,-12,'#263532',3);line(c,-22,12,21,12,'#263532',3);
    for(const x of [-12,12])line(c,x,-12,x,12,'#879386',1.8);
    poly(c,[[-15,-5],[-62,-2],[-64,2],[-15,6]],'#556555','#c2c2a2');
    poly(c,[[-51,-1],[-58,-12],[-62,-12],[-59,3],[-51,7]],'#8b936f','#ccd0ab');
    const g=c.createLinearGradient(0,-11,0,11);g.addColorStop(0,'#d1d0a5');g.addColorStop(.4,'#839382');g.addColorStop(1,'#293f38');
    oval(c,0,0,26,11,g);poly(c,[[12,-9],[24,-5],[26,1],[12,1]],'#244d56','#a6c7c2');poly(c,[[12,2],[25,2],[20,8],[12,9]],'#183c45','#84a49e');
    line(c,-8,-9,-8,9,'#40514a',1);line(c,8,-9,8,9,'#40514a',1);line(c,-20,0,8,0,'#c6a15d',2);
    for(const y of [-6,6])oval(c,-7,y,6,2,'#263b35');oval(c,-5,0,4,4,'#5f6c61');
    c.save();c.translate(-5,0);c.rotate(p.phase);
    if(p.rotor>.3)oval(c,0,0,41,31,'rgba(177,194,175,.075)');
    for(let i=0;i<4;i++){c.rotate(TAU/4);poly(c,[[2,-1],[40,-2],[42,1],[4,2]],`rgba(36,50,45,${.7-p.rotor*.42})`);line(c,36,-1,41,-1,'rgba(226,199,125,.65)',1.5);}c.restore();
    line(c,-60,-7*Math.cos(p.phase*1.32),-60,7*Math.cos(p.phase*1.32),'#253d38',1.5);
    glow(c,-14,-10,4,'rgba(240,75,38,.65)',.3+.7*Math.pow(Math.max(0,Math.sin(t*3)),8));c.restore();
  }
  function delta(c,t) {
    const at=(x,y)=>anchor('delta',x,y);
    water(c,...at(710,183),85,45,t);water(c,...at(401,425),68,30,t+4);water(c,...at(869,620),156,39,t+9);water(c,...at(84,437),46,92,t+6);
    helicopter(c,t);
    // A rusted field antenna turns slowly above the abandoned laboratories.
    c.save();c.translate(...at(319,217));c.scale(1,.58);c.rotate(t*.17);oval(c,0,0,8,5,'#708078');line(c,0,0,9,0,'#dad8b6',1);c.restore();
  }
  function lockwood(c,t) {
    const [fx,fy]=anchor('lockwood',445,418);fountain(c,fx,fy,t,.72);water(c,129,548,73,60,t);
    for(const [x,y,r] of [[445,125,26],[344,97,15],[550,94,15],[824,287,51],[1088,546,39]]){
      const p=anchor('lockwood',x,y);glow(c,...p,r,'rgba(255,174,74,.09)',.8+.2*Math.sin(t*.9+x));
    }
    // A quiet keeper's lantern passes behind the exhibition glass.
    const x=820+Math.sin(t*.13)*51,y=315+Math.cos(t*.13)*6;glow(c,x,y,12,'rgba(255,192,91,.23)');
    flyers(c,t,1030,85,75,4,true);
  }
  function proving(c,t) {
    for(const x of [350,640,930])for(const y of [25,681]){
      const energy=.5+.5*Math.sin(t*1.1+x*.02);glow(c,x,y,24,'rgba(46,242,232,.22)',.5+energy*.5);
      c.save();c.strokeStyle='rgba(144,255,242,.35)';c.lineWidth=1.3;c.beginPath();c.ellipse(x,y,6+energy*4,15,Math.sin(t*.2),0,TAU);c.stroke();c.restore();
    }
    // Rail-mounted service carriage cycles along the rear wall, outside the maze.
    const x=170+(Math.sin(t*.065)*.5+.5)*930;
    c.fillStyle='#253d3d';c.fillRect(x-13,34,26,12);c.strokeStyle='#ad9871';c.lineWidth=1;c.strokeRect(x-13,34,26,12);
    for(let i=0;i<4;i++)line(c,x-9+i*6,36,x-9+i*6,44,'#697e70',2);
    glow(c,x+10,40,8,'rgba(101,252,226,.34)');
    const q=(t*.045)%1;c.save();c.strokeStyle=`rgba(82,236,223,${Math.sin(q*Math.PI)*.12})`;c.lineWidth=1.5;c.beginPath();c.ellipse(640,360,50+q*300,32+q*197,0,0,TAU);c.stroke();c.restore();
  }
  function lagoon(c,t) {
    for(const [x,y,rx,ry] of [[244,298,32,71],[876,333,82,34],[718,631,129,46],[466,661,54,28],[1164,226,44,83]]){
      const p=anchor('lagoon',x,y);water(c,...p,rx,ry,t+x*.01,true);
    }
    for(const [x,y] of [[676,581],[818,627],[1013,651],[436,670],[1233,589]]){
      const p=anchor('lagoon',x,y);glow(c,...p,25,'rgba(66,131,255,.16)',.55+.45*Math.sin(t*.5+x));
    }
    // Tiny schools weave over the reef, separate from the enemy swim channel.
    for(let i=0;i<18;i++){
      const x=731+Math.sin(t*.13+i*.21)*67,y=633+Math.cos(t*.19+i*.21)*22;
      oval(c,x,y,2.1,.7,'rgba(91,210,213,.28)');
    }
    const [cx,cy]=anchor('lagoon',714,368),drop=13+(Math.sin(t*.23)*.5+.5)*27,sway=Math.sin(t*.65)*2;
    line(c,cx,cy,cx+sway,cy+drop,'#7e9d9c',.9);c.strokeStyle='#d5cfad';c.lineWidth=1.5;c.beginPath();c.arc(cx+sway+2,cy+drop,2.5,0,Math.PI*1.5);c.stroke();
  }
  const painters={visitor,aviary,delta,lockwood,proving,lagoon};
  function mount(key) {
    if(mounts.has(key))return mounts.get(key);
    const cv=document.createElement('canvas');cv.width=64;cv.height=54;const c=cv.getContext('2d');c.translate(32,25);
    const stone=key==='visitor'||key==='lockwood'||key==='lagoon';
    oval(c,2,11,25,12,'rgba(0,10,13,.32)');
    poly(c,[[-21,-9],[15,-9],[23,-1],[23,12],[-16,12],[-23,4]],stone?'#5b6058':'#344b49','#263b37');
    poly(c,[[-21,-13],[15,-13],[23,-5],[23,8],[-16,8],[-23,0]],stone?'#b0ad91':'#718982',stone?'#e0d8b6':'#adc4b6');
    c.strokeStyle='rgba(21,40,37,.45)';c.lineWidth=1;c.strokeRect(-14,-9,28,14);
    for(const x of [-17,17])for(const y of [-8,5])oval(c,x,y,1.2,1.2,stone?'#645c45':'#d0bd78');
    mounts.set(key,cv);return cv;
  }
  function foundations(c,key,towers) {const im=mount(key);for(const tw of towers)c.drawImage(im,tw.x-32,tw.y-25);}
  function bake(level,W,H) {
    if(!ready(level.art))return null;
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.save();c.scale(W/1280,H/720);c.imageSmoothingQuality='high';registeredPlate(c,plates.get(level.art).im,level.art);c.restore();
    return {cv,art:level.art,painted:true,flames:[],exit:null};
  }
  function draw(c,key,time,towers=[]) {
    c.save();painters[key]?.(c,motion.matches?0:Math.max(0,time||0));foundations(c,key,towers);c.restore();
  }
  function atmosphere(c,key,time) {
    const t=motion.matches?0:Math.max(0,time||0);c.save();
    // Stable analytic motion: rendering twice, pausing or inspecting never
    // advances particles; reduced-motion also suppresses the lightning cue.
    if(key==='lockwood'&&!motion.matches){const q=t%31,flash=q>23&&q<23.6?Math.pow(Math.max(0,Math.sin((q-23)*Math.PI/.6)),6)*.065:0;if(flash){c.fillStyle=`rgba(188,215,255,${flash})`;c.fillRect(0,0,1280,720);}}
    const colors={visitor:'rgba(254,220,163,.24)',aviary:'rgba(218,246,241,.23)',delta:'rgba(226,233,189,.20)',lockwood:'rgba(171,199,231,.16)',proving:'rgba(230,193,127,.22)',lagoon:'rgba(141,253,234,.18)'};
    c.fillStyle=colors[key];
    for(let i=0;i<18;i++){
      const x=((i*173.13+t*(key==='proving'?4:-2))%1320+1320)%1320-20,y=((i*79.37+t*(key==='aviary'?3:-1))%760+760)%760-20;
      if(key==='lockwood')line(c,x,y,x-2,y+7,colors[key],.7);else oval(c,x,y,.6+i%2*.3,.6+i%2*.3,colors[key]);
    }
    c.restore();
  }
  return {keys,ready,bake,draw,atmosphere,anchor,helicopterState,owns:key=>plates.has(key),onReady:fn=>listeners.add(fn),status:()=>keys.map(key=>({key,ready:ready(key),failed:plates.get(key).failed})),get reducedMotion(){return motion.matches;}};
})();
