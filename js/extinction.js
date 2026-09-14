'use strict';
/* A contained star, from mechanical ignition to plasma fracture.
   Combat owns ages and damage. All light, debris and distortion are seeded
   drawings of bounded descriptors; pause and redraw cannot fire the weapon. */
const Extinction=(()=>{
  const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
  const noise=(s,i)=>{const n=Math.sin(s*19.13+i*73.37)*43758.5453;return n-Math.floor(n);};
  const gold=[255,159,43],hot=[255,233,176],blue=[97,185,238];
  const chargeTime=st=>TOWERS.extinction.charge*Math.sqrt(TOWERS.extinction.rof/st.rof);
  function sound(name,t,x=t.x,y=t.y){if(!weaponMuted('extinction'))SFX[name]({x,y,weapon:'extinction',lv:t.ulv});}
  function fire(t,dt,st){
    t.novaTime=(t.novaTime||0)+dt;
    const target=pickTarget(t,st);
    if(target){const p=dinoPos(target);t.angle=Math.atan2(p.y-t.y,p.x-t.x);}
    if(t.cd>0)return;
    if(!target){t.novaCharge=0;return;}
    if(!(t.novaCharge>0))sound('novaCharge',t);
    t.novaCharge=clamp((t.novaCharge||0)+dt/chargeTime(st));
    if(t.novaCharge<1)return;
    t.novaCharge=0;t.cd=1/st.rof;t.cdMax=t.cd;t.flash=.24;t.recoil=1;
    const p=dinoPos(target),m=Arsenal.anchor(t,0,true),dur=clamp(Math.hypot(p.x-m.x,p.y-m.y)/330,.28,.55);
    // Lock the ground location at release. Slowing a herd improves placement;
    // the bolt never homes onto a replacement after its target dies.
    const lead=G.level.maze?p:samplePath(G.paths[target.pathI],target.dist+target.speed*(target.slowT>0?target.slowF:1)*dur*.72);
    G.projs.push({kind:'nova',tower:t,lv:t.ulv||0,x:m.x,y:m.y,x0:m.x,y0:m.y,tx:lead.x,ty:lead.y,t:0,dur,dmg:st.dmg,splash:st.splash,trail:[]});
    WeaponFX.emit(G.fx,'novaLaunch',m.x,m.y,{dur:.65,r:32,lv:t.ulv||0,ang:t.angle,weapon:'extinction'});
    sound('novaLaunch',t);
  }
  function advance(pr,dt){
    pr.t+=dt;const k=clamp(pr.t/pr.dur),arc=Math.sin(k*Math.PI)*20;
    pr.x=mix(pr.x0,pr.tx,k);pr.y=mix(pr.y0,pr.ty,k)-arc;
    if(k<1)return;
    pr.hit=true;sound('novaImpact',pr.tower,pr.tx,pr.ty);
    WeaponFX.emit(G.fx,'novaBlast',pr.tx,pr.ty,{dur:2.65,r:pr.splash,lv:pr.lv,weapon:'extinction'});
    for(const d of G.dinos){
      if(!targetable(d,TOWERS.extinction))continue;
      const p=dinoPos(d),dist=Math.max(0,Math.hypot(p.x-pr.tx,p.y-pr.ty)-d.size*.4);
      if(dist>pr.splash)continue;
      const falloff=1-.65*clamp((dist/pr.splash-.22)/.78);
      damage(d,pr.dmg*falloff,true,pr.tower);
      if(!d.dead){d.plasmaT=TOWERS.extinction.fracture;d.plasmaPhase=0;}
    }
  }
  function line(c,pts,color,w){if(pts.length<2)return;c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)c.lineTo(...pts[i]);c.stroke();}
  function ellipse(c,x,y,rx,ry,color,width=1,angle=0,start=0,end=TAU){if(rx<=0||ry<=0)return;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,angle,start,end);c.stroke();}
  function star(c,x,y,r,t,lv=0,alpha=1){
    if(r<.1||alpha<=0)return;c.save();c.translate(x,y);c.globalAlpha*=alpha;c.globalCompositeOperation='lighter';
    Arsenal.haze(c,0,0,r*4,gold,.40);Arsenal.haze(c,0,0,r*2.0,hot,.65);
    // Flowing plasma ribbons wrap the core; their three-dimensional projection
    // makes the containment field read as volume at phone scale.
    for(let i=0;i<3;i++){
      const a=t*(i%2?-2.2:1.8)+i*1.37,pts=[];
      for(let j=0;j<=46;j++){const q=j/46*TAU,rr=r*(1.18+.16*Math.sin(q*3+t*5+i));pts.push([Math.cos(q)*rr,Math.sin(q)*rr*Math.sin(a)]);}
      c.save();c.rotate(a*.35);line(c,pts,i%2?'rgba(140,213,255,.65)':'rgba(255,190,79,.72)',Math.max(.5,r*.075));c.restore();
    }
    const g=c.createRadialGradient(-r*.22,-r*.24,0,0,0,r);g.addColorStop(0,'#fffef3');g.addColorStop(.4,'#fff4c7');g.addColorStop(.76,'#ffd176');g.addColorStop(1,'#e77a24');c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
    for(let i=0;i<5;i++){const a=t*.8+i*TAU/5,rr=r*(1.45+.18*Math.sin(t*7+i));ellipse(c,Math.cos(a)*r*.5,Math.sin(a)*r*.4,rr,r*.4,'rgba(255,232,177,.6)',Math.max(.5,r*.07),a,0,Math.PI);}
    c.restore();
  }
  function turret(c,t,time){
    time=t.novaTime??time;
    const lv=t.ulv||0,q=clamp(t.novaCharge||0),m=Arsenal.anchor(t,0,true),angle=Arsenal.heading(t.key,t.angle||0),rec=(t.recoil||0)*2.2;
    const at=p=>{const v=Arsenal.project([p[0]-rec,p[1],p[2]],angle);return [t.x+v[0],t.y+v[1]];};
    c.save();c.lineCap='round';
    const core=at([17+lv*2,0,23+lv]);star(c,...core,2.4+lv*.55+q*4,time,lv,.55+q*.45);
    if(q>0){
      for(let i=0;i<12+lv*4;i++){
        const k=(time*(.9+noise(3,i)*.4)+i*.17)%1,a=i*2.399+time*.35,d=(1-k)*(28+lv*3),x=core[0]+Math.cos(a)*d,y=core[1]+Math.sin(a)*d*.7;
        line(c,[[x,y],[mix(x,core[0],.16),mix(y,core[1],.16)]],`rgba(255,200,111,${k*q*.85})`,.7);
      }
      for(let i=0;i<3;i++){const rr=(7+i*5)*(1-q*.35),pts=[];for(let j=0;j<=30;j++){const a=j/30*TAU+time*2;pts.push(at([25+lv*2+i*3,Math.cos(a)*rr,23+lv+Math.sin(a)*rr]));}line(c,pts,`rgba(124,209,255,${q*.35})`,.65);}
      Arsenal.haze(c,m.x,m.y,10+q*14,hot,q*.30);
    }
    if(t.flash>0){const f=clamp(t.flash/.24);star(c,m.x,m.y,5+lv+f*5,time*2,lv,f);}
    // Heat shimmers out of the rear cooling banks during recovery.
    const heat=clamp((t.cd||0)/(t.cdMax||1));if(heat>.5)for(const side of [-1,1]){const p=at([-13,side*12,20]);DinoFX.smoke(c,p[0],p[1]-4,7+lv,time,side+3,(heat-.5)*.20,true);}
    c.restore();
  }
  function projectile(c,p){
    const lv=p.lv??p.tower.ulv??0,age=p.visualAge||p.t||0;c.save();c.lineCap='round';
    const path=p.trail||[];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],fade=clamp(1-b.age/.46);line(c,[[a.x,a.y],[b.x,b.y]],`rgba(255,138,33,${fade*.35})`,(5+lv*2)*fade);line(c,[[a.x,a.y],[b.x,b.y]],`rgba(255,236,168,${fade*.7})`,Math.max(.4,fade*1.6));}
    star(c,p.x,p.y,6.5+lv*2,age*3,lv);c.restore();return true;
  }
  function draw(c,f){
    if(f.kind!=='novaLaunch'&&f.kind!=='novaBlast')return false;
    const t=f.t,lv=f.lv||0,r=f.r,seed=f.seed||1;c.save();c.lineCap='round';
    if(f.kind==='novaLaunch'){
      c.translate(f.x,f.y);c.rotate(f.ang||0);const q=clamp(t/.65);for(const side of [-1,1]){const pts=[];for(let j=0;j<18;j++){const k=j/17;pts.push([-q*28-k*12,side*(4+q*16)*Math.sin(k*Math.PI)]);}line(c,pts,`rgba(131,209,255,${(1-q)*.5})`,1.2);}
      Arsenal.haze(c,0,0,20+q*24,hot,(1-q)*.6);c.restore();return true;
    }
    const fade=clamp((f.dur-t)/.9),burst=clamp((t-.10)/.48),groundR=r*(.40+.62*burst);
    // Obsidian impact glass and radial seams remain after the light clears.
    if(t>.20){c.save();c.globalAlpha*=fade;c.fillStyle='rgba(12,17,22,.52)';c.beginPath();for(let i=0;i<=54;i++){const a=i/54*TAU,rr=groundR*(.85+noise(seed,i%54)*.15),x=f.x+Math.cos(a)*rr,y=f.y+Math.sin(a)*rr*.42;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fill();
      for(let i=0;i<15;i++){const a=i*2.399,pts=[[f.x,f.y]];for(let j=1;j<6;j++){const k=j/5,aa=a+(noise(seed,i*8+j)-.5)*.24;pts.push([f.x+Math.cos(aa)*groundR*k,f.y+Math.sin(aa)*groundR*k*.42]);}line(c,pts,`rgba(255,133,48,${clamp(1-t/2.5)*.6})`,.7);}c.restore();}
    if(t<.16){const q=t/.16;star(c,f.x,f.y-9,Math.max(2,(16+lv*3)*(1-q*.7)),t*4,lv);for(let i=0;i<14;i++){const a=i*2.399,rr=r*(1-q)*.55;line(c,[[f.x+Math.cos(a)*rr,f.y-9+Math.sin(a)*rr*.6],[f.x+Math.cos(a)*rr*.7,f.y-9+Math.sin(a)*rr*.42]],`rgba(255,222,146,${q})`,1);}}
    if(t>=.10&&t<1.20){
      const q=clamp((t-.10)/1.10),light=Math.pow(1-q,2),rr=r*(.10+Math.pow(q,.38)*.73),cy=f.y-rr*.40;
      Arsenal.haze(c,f.x,cy,rr*1.38,gold,light*.55);Arsenal.haze(c,f.x,cy,rr*.72,hot,light*.9);
      for(let i=0;i<9+lv*3;i++){const a=i*2.399+noise(seed,i)*.3,d=rr*(.35+noise(seed,i+13)*.27),x=f.x+Math.cos(a)*d,y=cy+Math.sin(a)*d*.65-q*r*.20;DinoFX.flame(c,x,y,rr*(.82+noise(seed,i+25)*.45),t,seed+i,false,light*.70);}
      if(q<.52)star(c,f.x,cy,rr*(.78-q*.70),t*2,lv,clamp(1-q/.52));
      c.save();c.globalCompositeOperation='lighter';
      // A broad equatorial shock sheet, with broken arcs instead of a screen flash.
      for(let i=0;i<3;i++){const z=clamp(q-i*.09),rad=r*(.13+Math.pow(z,.6)*1.08);ellipse(c,f.x,f.y,rad,rad*.43,`rgba(${i===1?'129,210,251':'255,215,140'},${light*(i===0?.8:.3)})`,i===0?2.4:1.0);}
      for(let i=0;i<12;i++){const a=i*TAU/12+noise(seed,i)*.3,inner=rr*.55,outer=rr*(1.05+noise(seed,i+30)*.48);line(c,[[f.x+Math.cos(a)*inner,cy+Math.sin(a)*inner*.6],[f.x+Math.cos(a)*outer,cy+Math.sin(a)*outer*.6]],`rgba(255,220,153,${light*.5})`,.9);}
      c.restore();
    }
    if(t>.18){const age=t-.18;
      for(let i=0;i<36+lv*10;i++){const a=i*2.399,vel=r*(.45+noise(seed,i)*.85),q=Math.min(age,.85+noise(seed,i+6)*.3),x=f.x+Math.cos(a)*vel*q,y=f.y+Math.sin(a)*vel*q*.50-(45+noise(seed,i+40)*80)*q+110*q*q,alpha=fade*clamp(1-age/2.2);c.fillStyle=i%3?'#f7b65a':'#d6eeed';c.globalAlpha=alpha;c.fillRect(x,y,1+noise(seed,i+70)*1.6,1.8);}
      c.globalAlpha=1;for(let i=0;i<6;i++)DinoFX.smoke(c,f.x+(i-2.5)*r*.18,f.y-r*(.2+age*.19),r*(.25+age*.10),age,seed+i,fade*.14);
    }
    c.restore();return true;
  }
  return {chargeTime,fire,advance,star,turret,projectile,draw};
})();
