'use strict';
/* Skin-bound combat treatments and the nine original weapon kill sequences.
   Mesh samples follow the renderer's blended bones. All variation is seeded;
   drawing never advances ages, emits particles or plays sound. */
const DinoFX=(()=>{
  const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const rand=(s,i)=>{const n=Math.sin(s*17.13+i*127.1)*43758.5453;return n-Math.floor(n);};
  const smooth=t=>t*t*(3-2*t),textures=new Map(),MAX_TEXTURES=40;
  const durations={gatling:1.65,flamer:2.25,sniper:2.2,cryo:2.2,tesla:1.9,sonic:1.7,missile:2.8,mortar:2.75,gas:2.65,extinction:2.5};
  const sequences={gatling:'deflate',flamer:'ash',sniper:'ko',cryo:'iceblock',tesla:'bones',sonic:'notes',missile:'gibs',mortar:'punt',gas:'ghost',extinction:'sunfall'};
  const beats={gatling:[[0,'deflate']],flamer:[[0,'sizzle']],sniper:[[0,'koBoing']],cryo:[[.95,'shatter']],tesla:[],sonic:[[.30,'notePop']],missile:[],mortar:[[0,'punt'],[1.24,'whistleIn'],[1.56,'thud']],gas:[[.45,'whoo']]};
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),a=smooth(x-ix),b=smooth(y-iy),h=(x,y)=>rand(x*3.17,y*7.13);return mix(mix(h(ix,iy),h(ix+1,iy),a),mix(h(ix,iy+1),h(ix+1,iy+1),a),b);}
  function fbm(x,y){return noise(x,y)*.57+noise(x*2.07+4,y*2.07+8)*.28+noise(x*4.17,y*4.17)*.15;}
  // Small procedural density sprites provide soft turbulent edges rather
  // than outlined flame tongues or circles. Forty cached tiles use 1 MiB.
  function texture(kind,frame=0,blue=false){
    const key=kind+':'+frame+':'+blue;if(textures.has(key))return textures.get(key);
    const cv=document.createElement('canvas');cv.width=64;cv.height=kind==='fire'?112:64;const c=cv.getContext('2d'),im=c.createImageData(cv.width,cv.height),t=frame/16*TAU;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
      const u=x/(cv.width-1)*2-1,v=y/(cv.height-1),i=(y*cv.width+x)*4;
      if(kind==='fire'){
        const rise=1-v,n=fbm(u*4+Math.sin(t)*.9,v*7+Math.cos(t)*1.4),bend=Math.sin(rise*9-t)*rise*.27+(n-.5)*.53,width=.14+v*.79;
        const density=clamp((1-Math.abs(u-bend)/width)*.92-rise*.47+(n-.42)*1.65),alpha=smooth(clamp(density*1.6))*smooth(clamp(v*8))*smooth(clamp((1-v)*14));
        const hot=clamp(density*(1-rise*.62));im.data[i]=blue?mix(41,204,hot):255;im.data[i+1]=blue?mix(112,244,hot):mix(46,236,hot*hot);im.data[i+2]=blue?255:mix(3,133,Math.pow(hot,4));im.data[i+3]=alpha*225;
      }else{const n=fbm(u*3+frame,v*6-frame),edge=clamp(1-Math.hypot(u,(v-.5)*2)),a=Math.pow(edge,1.45)*(.35+n*.65);im.data[i]=im.data[i+1]=im.data[i+2]=kind==='smoke'?mix(53,116,n):mix(175,241,n);im.data[i+3]=a*145;}
    }c.putImageData(im,0,0);textures.set(key,cv);if(textures.size>MAX_TEXTURES)textures.delete(textures.keys().next().value);return cv;
  }
  function path(c,points,color,width){if(points.length<2)return;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.stroke();}
  function haze(c,x,y,r,col,a){if(r>0&&a>0)Arsenal.haze(c,x,y,r,col,a);}
  function smoke(c,x,y,r,t,seed=0,alpha=.3,cold=false){
    const tex=texture(cold?'vapor':'smoke',Math.floor(seed)%4);c.save();c.globalAlpha*=alpha;c.translate(x+Math.sin(t*1.8+seed)*r*.3,y);c.rotate(Math.sin(seed+t)*.2);c.drawImage(tex,-r,-r*1.7,r*2,r*2);c.restore();
  }
  function flame(c,x,y,s,t,seed=0,blue=false,alpha=1){
    const frame=((Math.floor(t*15+seed*7)%16)+16)%16,tex=texture('fire',frame,blue),h=s*(.76+rand(seed,3)*.42),w=h*.90;
    c.save();c.globalAlpha*=alpha;c.drawImage(tex,x-w*.5,y-h,w,h);c.globalCompositeOperation='lighter';haze(c,x,y-h*.10,w*.32,blue?[103,190,255]:[255,137,32],.15);c.restore();
  }
  function fallbackFrame(d,turn){const dir=turn<0?-1:1,h=d.flying?1.5:.7,sites=Array.from({length:18},(_,i)=>({x:Math.cos(i/18*TAU)*.7*dir,y:-h+Math.sin(i/18*TAU)*.37,depth:0,part:'torso'}));return {sites,fire:sites.filter(p=>p.y<-h),center:{x:0,y:-h},head:{x:.68*dir,y:-h-.14},eyes:[],bounds:{left:-1,right:1,top:-h-.5,bottom:0},parts:['torso','head','tail','nearLeg','farLeg']};}
  function frame(d,phase=d.phase||0,turn=d.turn??d.dir??1){return Creatures.effectFrame(d,phase,turn)||fallbackFrame(d,turn);}
  function world(p,d,x,y,turn,pitch=0){const s=d.size,lean=Number.isFinite(d.artHeading)?(d.artPitch||0)*(turn<0?-1:1):pitch*(turn<0?-1:1),a=p.x*s,b=(p.y+.6)*s;return {x:x+a*Math.cos(lean)-b*Math.sin(lean),y:y-s*.6+a*Math.sin(lean)+b*Math.cos(lean)};}
  function anchor(d,p){return world(frame(d).center,d,p.x,p.y,d.turn??1,d.pitch||0);}
  function crystal(c,x,y,r,angle=0,alpha=1){
    c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.fillStyle='rgba(82,153,177,.72)';c.beginPath();c.moveTo(0,-r*1.8);c.lineTo(-r*.48,-r*.2);c.lineTo(-r*.32,r*.36);c.lineTo(0,r*.52);c.closePath();c.fill();c.fillStyle='rgba(177,231,240,.78)';c.beginPath();c.moveTo(0,-r*1.8);c.lineTo(r*.48,-r*.24);c.lineTo(r*.27,r*.35);c.lineTo(0,r*.52);c.closePath();c.fill();path(c,[{x:0,y:-r*1.7},{x:0,y:r*.38}],'rgba(234,255,255,.9)',Math.max(.5,r*.1));c.restore();
  }
  function arc(c,a,b,t,seed,alpha=1){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,points=[a],count=Math.max(3,Math.min(10,Math.ceil(len/6))),tick=Math.floor(t*24);
    for(let j=1;j<count;j++){const q=j/count,w=(rand(seed+tick,j)-.5)*Math.min(5,len*.14);points.push({x:a.x+dx*q-dy/len*w,y:a.y+dy*q+dx/len*w});}points.push(b);
    c.save();c.globalAlpha*=alpha;c.globalCompositeOperation='lighter';path(c,points,'rgba(89,150,237,.18)',4);path(c,points,'rgba(130,189,255,.7)',1.2);path(c,points,'#e6f7ff',.45);c.restore();
  }
  function status(c,d,x,y,turn,phase,pitch,time){
    if(!(d.burnT>0||d.slowT>0||d.zapT>0||d.charT>0||d.poisonT>0||d.sonicT>0||d.plasmaT>0))return;
    const s=d.size,F=frame(d,phase,turn),seed=(d.seedE||0)+s*.13,at=p=>world(p,d,x,y,turn,pitch),body=at(F.center);
    c.save();
    if(d.burnT>0){
      const blue=(d.burnSrc?.ulv||0)>=2,sites=F.fire.length?F.fire:F.sites.slice(0,8),fade=clamp(d.burnT*3);
      for(let i=0;i<Math.min(7,sites.length);i++){const site=sites[Math.floor(i*sites.length/Math.min(7,sites.length))],p=at(site),r=s*(.70+rand(seed,i)*.48)*(site.part==='tail'?.62:1);flame(c,p.x,p.y+s*.12,r,time,seed+i,blue,fade*.76);if(i%2===0){const q=(time*.58+i*.31)%1;smoke(c,p.x+s*.20*q,p.y-s*(.3+q*.8),s*(.36+q*.35),time,seed+i,fade*(1-q)*.48);}}
      c.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const q=(time*(.65+rand(seed,i)*.3)+i*.17)%1,p=at(sites[i%sites.length]),xx=p.x+Math.sin(time+i)*s*.12,yy=p.y-q*s*.9;c.fillStyle=`rgba(${blue?'136,218,255':'255,178,61'},${(1-q)*fade*.8})`;c.fillRect(xx,yy,Math.max(.6,s*.012),Math.max(1,s*.035));}c.globalCompositeOperation='source-over';
    }
    if(d.slowT>0){const fade=clamp(d.slowT*2),sites=F.sites.filter(p=>p.depth>=F.center.depth-.05);for(let i=0;i<Math.min(12,sites.length);i++){const p=at(sites[Math.floor(i*sites.length/12)]||sites[i]);crystal(c,p.x,p.y,s*(.035+rand(seed,i)*.035),Math.sin(i*2.4)*.8,fade*.8);}for(let i=0;i<3;i++){const q=(time*.33+i*.33)%1;smoke(c,body.x+(i-1)*s*.4,y+3-s*q*.13,s*(.28+q*.24),time,i,fade*(1-q)*.25,true);}}
    if(d.zapT>0){const sites=F.sites.filter(p=>p.depth>=F.center.depth-.08),fade=clamp(d.zapT*5);for(let i=0;i<4&&sites.length>2;i++){const j=(i*7+Math.floor(time*14))%sites.length,a=at(sites[j]),b=at(sites[(j+5)%sites.length]);arc(c,a,b,time,seed+i,fade);}haze(c,body.x,body.y,s*.65,[109,171,255],fade*.12);}
    if(d.charT>0&&!(d.burnT>0)){for(let i=0;i<3;i++){const q=(time*.5+i*.3)%1;smoke(c,body.x+(i-1)*s*.24,body.y-s*(.15+q*.5),s*(.19+q*.16),time,seed+i,clamp(d.charT)*(1-q)*.2);}}
    if(d.poisonT>0){for(let i=0;i<3;i++){const q=(time*.4+i*.31)%1;haze(c,body.x+Math.sin(i*3+time*.6)*s*.45,body.y-s*q*.5,s*(.15+q*.1),[133,164,88],clamp(d.poisonT)*(1-q)*.09);}}
    if(d.plasmaT>0){const fade=clamp(d.plasmaT/1.2),sites=F.sites.filter(p=>p.depth>=F.center.depth);for(let i=0;i<Math.min(10,sites.length);i++){const p=at(sites[i*7%sites.length]),q=((d.plasmaPhase||0)*.6+i*.17)%1;haze(c,p.x,p.y,s*.085,[255,183,74],fade*.5);path(c,[{x:p.x+Math.sin(i)*s*q*.18,y:p.y-s*q*.42},{x:p.x+Math.sin(i)*s*q*.18,y:p.y-s*q*.42-2}],`rgba(255,211,128,${fade*(1-q)*.65})`,.65);}if(!Creatures.available)haze(c,body.x,body.y,s*.65,[255,158,54],fade*.3);}
    if(d.sonicT>0){const fade=clamp(d.sonicT*2);for(const side of [-1,1]){c.save();c.globalCompositeOperation='screen';drawDino(c,{...d,fxNoShadow:true,fxMaterial:4,sonicT:0},x+side*Math.sin(time*35)*s*.045,y,turn,phase,fade*.12,pitch);c.restore();}}
    c.restore();
  }
  function death(list,d,p,src){
    if(list.length>=280)return false;const key=src.key;if(!durations[key])return false;
    const actor={key:d.key,painter:d.painter,feat:d.feat,pal:{...d.pal},size:d.size,flying:d.flying,water:d.water,artHeading:d.artHeading,artView:d.artView,artFrill:d.frillOpen??d.artFrill,phase:d.phase||0,fxNoShadow:true};
    list.push({kind:'weaponDeath',weapon:key,sequence:sequences[key],lv:src.ulv||0,x:p.x,y:p.y,r:d.size,t:0,dur:durations[key],seed:rand(p.x*.13+p.y*.7,list.length)*29,dir:p.x>=src.x?1:-1,d:actor,phase:d.phase||0,audioMask:0});return true;
  }
  function update(f,dt,play){if(f.kind!=='weaponDeath')return false;f.t+=dt;const events=beats[f.weapon]||[];for(let i=0;i<events.length;i++)if(f.t>=events[i][0]&&!(f.audioMask&(1<<i))){f.audioMask|=1<<i;play?.(f.weapon,events[i][1]);}return true;}
  function drawBody(c,f,F,opts={}){
    const s=f.r,x=opts.x??f.x+F.center.x*s,y=opts.y??f.y+F.center.y*s,alpha=opts.alpha??1;if(alpha<=0)return;
    c.save();c.translate(x,y);c.rotate(opts.rot||0);c.scale(opts.sx??1,opts.sy??1);
    const actor={...f.d,...opts.skin,fxNoShadow:true};
    if(!Creatures.available){const colors={1:['#46423b','#767064'],2:['#80b4c3','#d3f0f1'],3:['#c9c3aa','#e3dcc7'],4:['#b8d8c6','#d6ebdc']},p=colors[actor.fxMaterial];if(p)actor.pal={body:p[0],belly:p[1],accent:p[0]};else if(actor.poisonT)actor.pal={...actor.pal,body:'#64735b',belly:'#92a378'};if(actor.fxMaterial===1&&actor.fxAmount>0){c.beginPath();c.rect(-s*4,-s*4,s*8,s*(4.6-actor.fxAmount*1.8));c.clip();}}
    drawDino(c,actor,-F.center.x*s,-F.center.y*s,Number.isFinite(f.d.artHeading)?1:f.dir,opts.phase??f.phase,alpha,0);c.restore();
  }
  function transformed(p,F,f,o){const x=(p.x-F.center.x)*f.r*(o.sx??1),y=(p.y-F.center.y)*f.r*(o.sy??1),a=o.rot||0;return {x:o.x+x*Math.cos(a)-y*Math.sin(a),y:o.y+x*Math.sin(a)+y*Math.cos(a)};}
  function dust(c,x,y,s,t,seed,alpha=1){for(let i=0;i<5;i++){const q=clamp(t/.7),r=s*(.16+q*.27);smoke(c,x+(i-2)*s*q*.45,y-q*s*.15,r,t,seed+i,(1-q)*alpha*.35);}}
  function ground(c,x,y,s,alpha=.3,col=[39,33,26]){c.save();c.scale(1,.32);haze(c,x,y/.32,s,col,alpha);c.restore();}
  function debris(c,f,age,kind='ash',count=24){
    const s=f.r,fade=clamp((f.dur-f.t)*2),gy=f.y+2;
    for(let i=0;i<count;i++){const q=Math.max(0,age-rand(f.seed,i)*.12),vx=(rand(f.seed,i+20)-.5)*s*(kind==='ice'?5:2.5),vy=-s*(1+rand(f.seed,i+40)*2),initial=f.y-s*(.2+rand(f.seed,i+60)*1.1),g=330;
      const hit=(-vy+Math.sqrt(vy*vy+2*g*Math.max(0,gy-initial)))/g,t=Math.min(q,hit),x=f.x+vx*t+vx*.12*Math.max(0,q-hit),y=initial+vy*t+g*t*t*.5,spin=rand(f.seed,i+80)*TAU+t*(rand(f.seed,i+90)-.5)*9,r=s*(.022+rand(f.seed,i+100)*.038);
      if(kind==='ice'){crystal(c,x,y,r*1.5,spin,fade*clamp(1-Math.max(0,q-hit)*.6));continue;}
      if(kind==='bone'){c.save();c.translate(x,y);c.rotate(spin);boneLine(c,[{x:-r*1.8,y:-r*.18},{x:r*1.7,y:r*.14}],s*1.15,fade);c.globalAlpha*=fade;c.fillStyle='#d6ceba';for(const side of [-1,1]){c.beginPath();c.ellipse(side*r*1.7,side*r*.16,r*.54,r*.66,0,0,TAU);c.fill();}c.restore();continue;}
      c.save();c.globalAlpha*=fade;c.translate(x,y);c.rotate(spin);const color=kind==='bone'?'#c9c3aa':kind==='flesh'?(i%3?'#732324':'#c8bba0'):'#69665e';c.fillStyle=color;c.beginPath();c.moveTo(-r,-r*.4);c.lineTo(r*.7,-r*.65);c.lineTo(r,r*.3);c.lineTo(-r*.5,r*.65);c.closePath();c.fill();path(c,[{x:-r*.6,y:-r*.35},{x:r*.55,y:-r*.52}],kind==='bone'?'#ece5cd':kind==='flesh'?'#bc5650':'#969187',Math.max(.45,r*.2));c.restore();
    }
  }
  function blood(c,f,F,age){
    const s=f.r,fade=clamp((f.dur-f.t)/.65),gy=f.y+4,cx=f.x+F.center.x*s,cy=f.y+F.center.y*s;
    if(fade<=0)return;
    c.save();c.globalAlpha*=fade;c.lineCap='round';
    // Irregular pools remain under the scattered parts until the finisher fades.
    const pool=clamp((age-.12)*2.8);
    if(pool>0)for(let i=0;i<9;i++){
      const x=cx+(rand(f.seed,i+300)-.5)*s*1.65,y=gy+(rand(f.seed,i+310)-.5)*s*.25,r=s*(.15+rand(f.seed,i+320)*.24)*pool;
      c.fillStyle=i%3?'#75121e':'#480e18';c.beginPath();c.ellipse(x,y,r,r*.27,0,0,TAU);c.fill();
      c.fillStyle='#a3222b';c.beginPath();c.ellipse(x-r*.12,y-r*.045,r*.64,r*.12,0,0,TAU);c.fill();
    }
    // Ballistic droplets stop at their own impact points; redraws never emit or age them.
    for(let i=0;i<72;i++){
      const ageI=age-rand(f.seed,i+60)*.055;if(ageI<=0)continue;
      const a=rand(f.seed,i)*TAU,v=s*(2.6+rand(f.seed,i+80)*3.2),vx=Math.cos(a)*v,vy=Math.sin(a)*v-s*.7;
      const y0=Math.min(gy-1,cy+(rand(f.seed,i+160)-.5)*s*.24),g=440;
      const hit=(-vy+Math.sqrt(vy*vy+2*g*(gy-y0)))/g,t=Math.min(ageI,hit),x=cx+vx*t,y=y0+vy*t+g*t*t*.5,r=Math.max(.9,s*(.022+rand(f.seed,i+240)*.037));
      c.fillStyle=i%4?'#a51e2d':'#64111e';
      if(ageI<hit){
        const prev=Math.max(0,t-.035);c.strokeStyle=c.fillStyle;c.lineWidth=r*1.4;
        c.beginPath();c.moveTo(cx+vx*prev,y0+vy*prev+g*prev*prev*.5);c.lineTo(x,y);c.stroke();
        c.beginPath();c.ellipse(x,y,r*1.1,r*.78,Math.atan2(vy+g*t,vx),0,TAU);c.fill();
      }else{
        const spread=1+clamp((ageI-hit)*12)*1.6;
        c.beginPath();c.ellipse(x,gy,r*spread,r*.48,0,0,TAU);c.fill();
        for(let j=0;j<2;j++){
          const dx=(j?1:-1)*r*(2.5+rand(f.seed,i+j+400)*2.5),dy=(rand(f.seed,i+j+500)-.5)*r*2;
          c.beginPath();c.ellipse(x+dx,gy+dy,r*.48,r*.24,0,0,TAU);c.fill();
        }
      }
    }
    const mist=clamp(1-age/.38);
    for(let i=0;i<3&&mist>0;i++)haze(c,cx+(i-1)*s*age*2,cy-s*age*.6,s*(.4+age*1.6),[145,23,34],mist*.23);
    c.restore();
  }
  function fragment(c,f,F,name,x,y,rot,alpha=1,material=0){
    const sites=F.sites.filter(p=>p.part===name);if(!sites.length)return;const center={x:sites.reduce((n,p)=>n+p.x,0)/sites.length,y:sites.reduce((n,p)=>n+p.y,0)/sites.length},mask=Object.fromEntries(F.parts.map(p=>[p,p===name?0:1]));
    c.save();c.translate(x,y);c.rotate(rot);drawDino(c,{...f.d,deathMask:mask,fxMaterial:material,fxNoShadow:true},-center.x*f.r,-center.y*f.r,Number.isFinite(f.d.artHeading)?1:f.dir,f.phase,alpha,0);c.restore();
  }
  function boneLine(c,points,s,alpha=1){c.save();c.globalAlpha*=alpha;c.lineCap='round';path(c,points,'#655f51',s*.034);path(c,points,'#c6bfaa',s*.026);path(c,points.map(p=>({x:p.x-.2,y:p.y-.35})),'#e3dcc7',s*.011);c.restore();}
  function skeleton(c,f,F,alpha=1){
    if(!F.project||!F.anatomy){drawBody(c,f,F,{alpha,skin:{fxMaterial:3}});return;}
    const a=F.anatomy,s=f.r,at=(p,id=0)=>{const q=F.project(p,id);return {x:f.x+q.x*s,y:f.y+q.y*s};};
    const rows=a.body,body=Array.from({length:10},(_,i)=>{const t=(i+1)/11*(rows.length-1),j=Math.floor(t);return rows[j].map((v,k)=>mix(v,rows[Math.min(j+1,rows.length-1)][k],t-j));}),spine=body.map(p=>at([p[0],p[1]-(p[1]-p[2])*.22,0]));boneLine(c,spine,s,alpha);
    for(const p of body){const cy=(p[1]+p[2])/2,ry=(p[1]-p[2])*.44;for(const side of [-1,1]){const rib=[];for(let j=0;j<=8;j++){const ang=j/8*Math.PI*.91;rib.push(at([p[0]-.06*Math.sin(ang),cy+Math.cos(ang)*ry,side*Math.sin(ang)*p[3]*.87]));}boneLine(c,rib,s*.67,alpha);}}
    if(a.neck)boneLine(c,a.neck.map(p=>at([p[0],(p[1]+p[2])/2,0],p[0]>(a.head[0][0]-.2)?F.rig.headBone:0)),s*.8,alpha);
    if(a.neckSweep)boneLine(c,a.neckSweep.map(p=>at(p.slice(0,3))),s*.8,alpha);
    if(a.tail)boneLine(c,a.tail.map((p,i)=>at(p.slice(0,3),F.rig.tails[Math.min(i,F.rig.tails.length-1)]?.id||0)),s*.64,alpha);
    for(const leg of F.rig.legs||[]){boneLine(c,[at(leg.base,leg.upper),at(leg.knee,leg.upper),at(leg.ankle,leg.lower),at(leg.end,leg.toe)],s,alpha);}
    if(a.arms)for(const arm of F.rig.arms||[])boneLine(c,a.arms.points.map(p=>at([p[0],p[1],arm.side*a.arms.z],arm.id)),s*.7,alpha);
    for(const wing of F.rig.wings||[]){const pts=F.sites.filter(p=>p.part===(wing.side>0?'wingNear':'wingFar')).sort((a,b)=>a.x-b.x);if(pts.length>2)boneLine(c,[pts[0],pts[Math.floor(pts.length/2)],pts.at(-1)].map(p=>({x:f.x+p.x*s,y:f.y+p.y*s})),s*.72,alpha);}
    const mask=Object.fromEntries(F.parts.map(p=>[p,p==='head'||p==='lowerJaw'?0:1]));drawBody(c,f,F,{alpha,skin:{fxMaterial:3,deathMask:mask}});
  }
  function iceShell(c,f,F,alpha,cracks){
    const s=f.r,b=F.bounds,l=b.left*s-3,r=b.right*s+3,top=b.top*s-4,bot=Math.min(3,b.bottom*s+4),cut=Math.min((r-l)*.12,(bot-top)*.13);
    c.save();c.globalAlpha*=alpha;c.translate(f.x,f.y);const g=c.createLinearGradient(l,top,r,bot);g.addColorStop(0,'rgba(209,248,255,.25)');g.addColorStop(.43,'rgba(118,190,215,.07)');g.addColorStop(.55,'rgba(232,255,255,.31)');g.addColorStop(1,'rgba(72,138,166,.24)');c.fillStyle=g;c.strokeStyle='rgba(209,248,255,.58)';c.lineWidth=Math.max(.7,s*.014);c.beginPath();c.moveTo(l+cut,top);c.lineTo(r-cut,top);c.lineTo(r,top+cut);c.lineTo(r,bot-cut);c.lineTo(r-cut,bot);c.lineTo(l+cut,bot);c.lineTo(l,bot-cut);c.lineTo(l,top+cut);c.closePath();c.fill();c.stroke();
    path(c,[{x:l+cut,y:top+cut},{x:r-cut,y:top+cut},{x:r-cut,y:bot-cut}],'rgba(224,252,255,.38)',.6);
    if(cracks>0)for(let i=0;i<6;i++){const x=mix(l,r,.18+rand(f.seed,i)*.65),y=mix(top,bot,.2+rand(f.seed,i+10)*.5);path(c,[{x,y},{x:x+s*.12,y:y+s*.12*cracks},{x:x-s*.11,y:y+s*.27*cracks},{x:x+s*.03,y:y+s*.37*cracks}],`rgba(233,254,255,${cracks*.75})`,.7);}c.restore();
  }
  function drawDeath(c,f){
    const F=frame(f.d,f.phase,f.dir),s=f.r,t=f.t,k=clamp(t/f.dur),fade=clamp((f.dur-t)*3),gy=f.y+2,cx=f.x+F.center.x*s,cy=f.y+F.center.y*s,dir=f.dir,seed=f.seed;
    c.save();c.lineJoin='round';
    switch(f.weapon){
      case 'extinction':{
        const dissolve=clamp((t-.30)/1.15),rise=clamp((t-.30)/1.8);
        ground(c,f.x,gy,s*.85,fade*.42,[26,25,24]);
        if(dissolve<1)drawBody(c,f,F,{y:cy-rise*s*.45,alpha:Creatures.available?fade:fade*(1-dissolve),skin:{fxMaterial:6,fxAmount:dissolve,plasmaT:2.4}});
        c.save();c.globalCompositeOperation='lighter';
        for(let i=0;i<Math.min(64,F.sites.length);i++){
          const p=F.sites[i],q=clamp((t-.28-rand(seed,i)*.45)/1.25);if(!q)continue;
          const x=f.x+p.x*s+Math.sin(q*5+i)*s*q*.5,y=f.y+p.y*s-q*s*(1.3+rand(seed,i+80)),alpha=fade*(1-q);
          haze(c,x,y,s*.075,[255,185,74],alpha*.45);path(c,[{x,y},{x:x+Math.sin(i)*s*.025,y:y-s*(.025+q*.05)}],`rgba(255,225,160,${alpha})`,Math.max(.7,s*.016));
        }
        c.restore();if(t>.55)for(let i=0;i<3;i++)smoke(c,cx+(i-1)*s*.25,cy-t*s*.30,s*(.30+t*.10),t,seed+i,fade*.17);break;
      }
      case 'gatling':{
        if(t<.28)drawBody(c,f,F,{x:cx+Math.sin(t*65)*s*.025,y:cy,skin:{fxHoles:clamp(t/.25)}});
        else if(t<1.05){const q=(t-.28)/.77,x=cx+Math.sin(q*9+seed)*s*(.8+q*.8),y=cy-q*s*1.6+Math.sin(q*13+seed*2)*s*.5;drawBody(c,f,F,{x,y,rot:q*14*dir,sx:1-q*.72,sy:(1-q*.72)*(1-q*.64),skin:{fxHoles:1}});for(let i=0;i<3;i++){const b=q-.04-i*.04;if(b>0)smoke(c,cx+Math.sin(b*9+seed)*s*(.8+b*.8),cy-b*s*1.6+Math.sin(b*13+seed*2)*s*.5,s*.1,t,seed+i,(1-q)*.24,true);}}
        else{const q=clamp((t-1.05)/.6),x=cx+Math.sin(9+seed)*s*1.6+Math.sin(q*6)*s*.3,y=mix(cy-s*1.6,gy,q);drawBody(c,f,F,{x,y,rot:Math.sin(q*6)*.3,sx:.32,sy:.055,alpha:fade,skin:{fxHoles:1}});}break;
      }
      case 'flamer':{
        const crumble=clamp((t-.60)/1.0);ground(c,f.x,gy,s*.68,crumble*fade*.45,[48,43,37]);
        if(crumble<1)drawBody(c,f,F,{skin:{fxMaterial:1,fxAmount:crumble,fxHeat:1},alpha:fade});
        if(t<.60)for(const p of F.eyes.filter(p=>p.depth>=F.head.depth)){const blink=t>.18&&t<.25||t>.38&&t<.45;c.fillStyle='#d8d1b4';c.beginPath();c.ellipse(f.x+p.x*s,f.y+p.y*s,s*.027,blink?s*.004:s*.021,0,0,TAU);c.fill();}
        if(t<.65)for(let i=0;i<5;i++){const p=F.fire[i*2%Math.max(1,F.fire.length)]||F.center;flame(c,f.x+p.x*s,f.y+p.y*s,s*.35,t,seed+i,f.lv>=2,(1-t/.8)*.8);}
        if(crumble>0)debris(c,f,t-.6,'ash',30);
        for(let i=0;i<4;i++)smoke(c,cx+(i-1.5)*s*.3,cy-t*s*.22,s*(.25+t*.13),t,seed+i,fade*.24);break;
      }
      case 'cryo':{
        if(t<.95){const rot=t>.55?Math.sin((t-.55)*42)*(t-.55)*.24:0,drop=f.d.flying?clamp(t/.36)*s*.72:0;c.save();c.translate(f.x,f.y+drop);c.rotate(rot);c.translate(-f.x,-f.y);drawBody(c,f,F,{skin:{fxMaterial:2,fxFrost:1}});iceShell(c,f,F,1,clamp((t-.4)*1.7));c.restore();for(let i=0;i<3;i++)smoke(c,cx+(i-1)*s*.55,gy,s*.5,t,seed+i,.2,true);}
        else{const age=t-.95;ground(c,f.x,gy,s*(.7+age*.15),fade*.26,[113,165,181]);debris(c,f,age,'ice',32);for(let i=0;i<4;i++)smoke(c,cx+(i-1.5)*s*.25,cy-age*s*.3,s*(.36+age*.4),age,seed+i,fade*.25,true);}break;
      }
      case 'tesla':{
        if(t<.42){drawBody(c,f,F,{alpha:clamp(1-t/.34)*.5,skin:{fxMaterial:4}});skeleton(c,f,F,1);const pts=F.sites;for(let i=0;i<5;i++){const a=pts[(i*7)%pts.length],b=pts[(i*7+4)%pts.length];arc(c,{x:f.x+a.x*s,y:f.y+a.y*s},{x:f.x+b.x*s,y:f.y+b.y*s},t,seed+i,1-t/.5);}}
        else{const age=t-.42;debris(c,f,age,'bone',26);const head=F.head,hit=.44,q=Math.min(age,hit),x=f.x+head.x*s+dir*q*s*.22,y=Math.min(gy,f.y+head.y*s+340*q*q);fragment(c,f,F,'head',x,y,q*2.4,fade,3);ground(c,f.x,gy,s*.55,fade*.26);for(let i=0;i<3;i++)smoke(c,cx+(i-1)*s*.2,gy-s*(.25+age*.45),s*(.24+age*.1),age,seed+i,fade*.22);if(age<.7)arc(c,{x:cx-s*.2,y:gy-4},{x:cx+s*.1,y:gy-s*.55-age*s},t,seed,.6*(1-age/.7));}break;
      }
      case 'missile':{
        const age=Math.max(0,t-.08);if(t<.10)drawBody(c,f,F,{alpha:1-t/.10});blood(c,f,F,age);debris(c,f,age,'flesh',24);
        const parts=F.parts.filter(p=>F.sites.some(s=>s.part===p)&&!['ridge','sail','lowerJaw','flipper'].includes(p)).slice(0,8);
        parts.forEach((name,i)=>{const sites=F.sites.filter(p=>p.part===name),p=sites[Math.floor(sites.length/2)],vx=(rand(seed,i)-.5)*s*5,vy=-s*(1.7+rand(seed,i+12)*2),y0=f.y+p.y*s,g=430,hit=(-vy+Math.sqrt(vy*vy+2*g*Math.max(0,gy-y0)))/g,q=Math.min(age,hit),x=f.x+p.x*s+vx*q+vx*.10*Math.max(0,age-hit),y=Math.min(gy,y0+vy*q+g*q*q*.5);fragment(c,f,F,name,x,y,(rand(seed,i+24)-.5)*q*12,fade);});dust(c,f.x,gy,s*1.5,age,seed);break;
      }
      case 'mortar':{
        if(t<.55){const q=t/.55;drawBody(c,f,F,{x:cx+Math.sin(t*9+seed)*s*.12,y:cy-Math.pow(q,.8)*820,rot:t*12*dir,sx:1-q*.25,sy:1-q*.25});dust(c,f.x,gy,s,t,seed);}
        else if(t<1.56){const q=clamp((t-1.24)/.32);ground(c,f.x,gy,s*.7*q,q*.36);if(q>.76)drawBody(c,f,F,{x:cx,y:mix(gy-230,gy-s*.15,(q-.76)/.24),rot:Math.PI,alpha:.65});}
        else{const age=t-1.56;ground(c,f.x,gy,s*.85,fade*.65);dust(c,f.x,gy,s*1.6,age,seed,fade);c.save();c.beginPath();c.rect(f.x-s*4,gy-s*4,s*8,s*4+2);c.clip();drawBody(c,f,F,{x:f.x,y:gy+s*.25,rot:Math.PI+Math.sin(age*14)*.055*clamp(1-age),phase:f.phase+age*6,alpha:fade});c.restore();ground(c,f.x,gy+4,s*.57,fade*.64,[57,43,28]);}break;
      }
      case 'sniper':{
        if(t<.5){const q=t/.5;drawBody(c,f,F,{x:cx+dir*q*s*1.5,y:mix(cy,gy-s*.28,q)-Math.sin(q*Math.PI)*s*1.4,rot:-dir*q*Math.PI*4});}
        else{const age=t-.5,o={x:cx+dir*s*1.5,y:gy-s*.22,rot:Math.PI+Math.sin(age*25)*.04*clamp(1-age*2),alpha:fade};drawBody(c,f,F,o);dust(c,o.x,gy,s,age,seed,fade);const head=transformed(F.head,F,f,o);for(const eye of F.eyes){const p=transformed(eye,F,f,o),r=s*.035;path(c,[{x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y+r}],'#292820',Math.max(.7,s*.012));path(c,[{x:p.x+r,y:p.y-r},{x:p.x-r,y:p.y+r}],'#292820',Math.max(.7,s*.012));}for(let i=0;i<4;i++){const a=age*3+i*TAU/4,x=head.x+Math.cos(a)*s*.47,y=head.y-s*.35+Math.sin(a)*s*.14,r=s*.045;c.save();c.globalAlpha*=fade;c.globalCompositeOperation='lighter';haze(c,x,y,r*3,[255,213,106],.2);path(c,[{x:x-r,y},{x:x+r,y}],'#ffe9a8',1);path(c,[{x,y:y-r},{x,y:y+r}],'#ffe9a8',1);c.restore();}}break;
      }
      case 'sonic':{
        if(t<.40){const q=clamp(t/.3);for(const side of [-1,1])drawBody(c,f,F,{x:cx+side*s*(.05+q*.18)*Math.sin(t*90),alpha:(1-q)*.25,skin:{fxMaterial:4}});drawBody(c,f,F,{skin:{fxMaterial:5,fxAmount:clamp((t-.25)/.15)}});}
        if(t>=.30){const age=t-.3;for(let i=0;i<7;i++){const q=age-i*.04;if(q<0)continue;const a=clamp(1-q/1.3),x=cx+(rand(seed,i)-.5)*s*1.2+Math.sin(q*4+i)*s*.3,y=cy-q*(s+18)-rand(seed,i+10)*s*.25;c.save();c.globalAlpha*=a;c.translate(x,y);c.rotate(Math.sin(q*5+i)*.2);haze(c,0,0,s*.18,[193,141,241],.15);c.font=`${Math.max(9,s*.36)}px Georgia`;c.textAlign='center';c.fillStyle=i%2?'#f0dfff':'#ba89da';c.fillText(i%3?'♪':'♫',0,0);c.restore();}}break;
      }
      case 'gas':{
        const flop=clamp(t/.4),corpse=clamp((1.6-t)*2);drawBody(c,f,F,{x:cx+dir*flop*s*.2,y:mix(cy,gy-s*.17,flop),rot:dir*flop*.1,sy:1-flop*.62,alpha:corpse,skin:{poisonT:1}});haze(c,cx,gy-s*.1,s*.6,[106,137,70],corpse*.12);
        if(t>.45){const q=(t-.45)/(f.dur-.45),x=cx+Math.sin(t*2.6+seed)*s*.3,y=cy-q*s*2.1;c.save();c.globalCompositeOperation='screen';drawBody(c,f,F,{x,y,rot:Math.sin(t*2.6+seed)*.09,sx:.55,sy:.55,alpha:fade*.54,skin:{fxMaterial:4,poisonT:0}});for(let i=0;i<3;i++)smoke(c,x+(i-1)*s*.1,y+s*(.25+i*.08),s*.2,t,seed+i,fade*.16,true);c.restore();}
        break;
      }
    }c.restore();return true;
  }
  return {status,death,update,drawDeath,frame,anchor,flame,crystal,arc,smoke,skeleton,sequences,durations,stats:()=>({textures:textures.size,textureLimit:MAX_TEXTURES,textureBytes:[...textures.values()].reduce((n,c)=>n+c.width*c.height*4,0)})};
})();
