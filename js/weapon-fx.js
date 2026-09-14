'use strict';
/* Bounded combat spectacle. Effect ages advance in the simulation; renderers
   are pure, so pause, screenshots and frame rate never spawn extra particles. */
const WeaponFX = (() => {
  const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const noise=(seed,i)=>{const v=Math.sin(seed*17.13+i*127.1)*43758.5453;return v-Math.floor(v);};
  const rgb=(key,lv)=>key==='gas'&&lv>=2?[188,118,240]:key==='flamer'&&lv>=2?[86,180,255]:Arsenal.catalog[key].rgb;
  function disk(c,x,y,r,color){if(r<=0)return;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
  function line(c,pts,color,w){c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)c.lineTo(...pts[i]);c.stroke();}
  function sparks(c,x,y,k,r,seed,col,n=12,fall=10){
    c.save();c.globalCompositeOperation='lighter';
    for(let i=0;i<n;i++){const a=noise(seed,i)*TAU,s=.25+noise(seed,i+30)*.75,d=r*s*k,xx=x+Math.cos(a)*d,yy=y+Math.sin(a)*d*.7+fall*k*k;
      line(c,[[xx,yy],[xx-Math.cos(a)*(2+(1-k)*7),yy-Math.sin(a)*(2+(1-k)*7)]],`rgba(${col},${(1-k)*.9})`,i%3===0?1.4:.7);
    }c.restore();
  }
  function emit(list,kind,x,y,options={}){
    if(list.length>=300)return;
    list.push({kind,x,y,t:0,dur:.5,seed:(x*.13+y*.31+list.length*.71)%11,...options});
  }
  function fire(list,t,range){
    const p=Arsenal.anchor(t),lv=t.ulv||0,key=t.key;
    if(key==='gatling'||key==='sniper')emit(list,'casing',t.x,t.y,{dur:.65,ang:t.angle,lv});
    if(key==='missile'||key==='mortar')emit(list,'launchsmoke',p.x,p.y,{dur:.7,ang:t.angle,lv,r:18+lv*3});
    if(key==='cryo')emit(list,'vent',t.x,t.y-6,{dur:.7,lv,r:15});
  }
  function mark(f,t){if(f){f.weapon=t.key;f.lv=t.ulv||0;}return f;}
  function trail(pr,dt){
    pr.visualAge=(pr.visualAge||0)+dt;
    const list=pr.trail||(pr.trail=[]);pr.trailClock=(pr.trailClock||0)+dt;
    // Sample in update, not draw. Positions include the ballistic height.
    for(const p of list)p.age+=dt;
    while(list.length&&list[0].age>.46)list.shift();
    if(pr.trailClock>=.022){pr.trailClock=0;list.push({x:pr.x,y:pr.y-(pr.arc||0),age:0});if(list.length>20)list.shift();}
  }
  function projectile(c,pr,time){
    if(pr.kind==='nova')return Extinction.projectile(c,pr);
    if(!['bullet','missile','mortar','cryo'].includes(pr.kind))return false;
    const lv=pr.tower.ulv||0,col=rgb(pr.tower.key,lv),path=pr.trail||[];
    let a=Math.atan2(pr.vy||0,pr.vx||1),x=pr.x,y=pr.y-(pr.arc||0);
    if(pr.kind==='mortar')a=Math.atan2(pr.ty-pr.y0-Math.cos(clamp(pr.t/pr.dur)*Math.PI)*Math.PI*(60+Math.hypot(pr.tx-pr.x0,pr.ty-pr.y0)*.22),pr.tx-pr.x0);
    if(pr.kind==='bullet'||pr.kind==='cryo'){const last=path.length>1?path[path.length-2]:Arsenal.anchor(pr.tower);a=Math.atan2(y-last.y,x-last.x);}
    c.save();
    if(pr.kind==='missile'||pr.kind==='mortar'){
      for(let i=0;i<path.length;i+=2){const p=path[i],fade=1-p.age/.46;Arsenal.haze(c,p.x,p.y-p.age*8,2.5+p.age*12,[123,129,127],fade*.20);}
      if(pr.kind==='mortar'){c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(pr.x,pr.y,5,2,0,0,TAU);c.fill();}
    }else if(pr.kind==='cryo'){
      for(let i=0;i<path.length;i+=2){const p=path[i];Arsenal.haze(c,p.x,p.y,3+p.age*10,col,(1-p.age/.46)*.24);}
    }
    c.translate(x,y);c.rotate(a);
    if(pr.kind==='bullet'){
      c.globalCompositeOperation='lighter';line(c,[[-15-lv*2,0],[1,0]],'rgba(255,165,54,.3)',3);line(c,[[-12-lv,0],[1,0]],'#ffe7a0',1.1);disk(c,0,0,1.3,'#fffbea');
    }else if(pr.kind==='missile'){
      const plume=14+Math.sin((pr.visualAge||0)*63+x)*3;
      Arsenal.haze(c,-8,0,14,col,.35);c.fillStyle='#ff8c37';c.beginPath();c.moveTo(-5,-2);c.lineTo(-plume,0);c.lineTo(-5,2);c.fill();
      c.fillStyle='#fff1b3';c.beginPath();c.moveTo(-5,-1);c.lineTo(-11,0);c.lineTo(-5,1);c.fill();
      c.fillStyle='#59676d';c.beginPath();c.moveTo(-4,-1);c.lineTo(-7,-4);c.lineTo(-2,-2);c.lineTo(3,0);c.lineTo(-2,2);c.lineTo(-7,4);c.lineTo(-4,1);c.fill();
      const g=c.createLinearGradient(0,-2,0,2);g.addColorStop(0,'#eff0d8');g.addColorStop(.4,'#abb7b8');g.addColorStop(1,'#414d54');c.fillStyle=g;c.fillRect(-5,-1.8,10,3.6);
      c.fillStyle='#a84431';c.beginPath();c.moveTo(3,-1.8);c.lineTo(7,0);c.lineTo(3,1.8);c.fill();c.fillStyle='#e8bd64';c.fillRect(-3,-1.8,1,3.6);
    }else if(pr.kind==='mortar'){
      c.fillStyle='#373e35';c.beginPath();c.ellipse(0,0,6,3,0,0,TAU);c.fill();c.fillStyle='#dfbc70';c.fillRect(-2,-3,1.5,6);line(c,[[-5,-1],[2,-1]],'#9ea495',.8);
    }else{
      Arsenal.haze(c,0,0,12,col,.5);c.globalCompositeOperation='lighter';c.fillStyle='#d7faff';c.beginPath();c.moveTo(6,0);c.lineTo(-2,-3);c.lineTo(-6,0);c.lineTo(-2,3);c.fill();line(c,[[-12,0],[0,0]],'#79ddff',1.3);
    }
    c.restore();return true;
  }
  function bolt(c,b,time){
    const age=b.dur?clamp(1-b.t/b.dur):clamp(1-b.t/.16),fade=Math.pow(1-age,.5);
    const pts=[[b.x1,b.y1]],dx=b.x2-b.x1,dy=b.y2-b.y1,len=Math.hypot(dx,dy)||1,seed=b.x1*.1+b.y2*.04;
    if(b.jag){const n=Math.max(4,Math.min(18,Math.ceil(len/9))),phase=Math.floor(age*12);for(let i=1;i<n;i++){const k=i/n,j=(noise(seed+phase,i)-.5)*Math.min(16,len*.14);pts.push([b.x1+dx*k-dy/len*j,b.y1+dy*k+dx/len*j]);}}
    pts.push([b.x2,b.y2]);c.save();c.globalAlpha=fade;c.globalCompositeOperation='lighter';c.lineCap='round';
    line(c,pts,b.glow||'rgba(103,120,255,.15)',b.jag?9:7);line(c,pts,b.color||'#bcaaff',b.jag?2.1:1.6);line(c,pts,'#edfcff',b.jag?.65:.65);
    if(b.jag){for(let i=2;i<pts.length-1;i+=3){const p=pts[i];line(c,[p,[p[0]+Math.sin(seed+i)*11,p[1]-9],[p[0]+Math.sin(seed+i)*18,p[1]-14]],'rgba(191,173,255,.58)',.7);}Arsenal.haze(c,b.x2,b.y2,19,[140,167,255],.5);}
    else if((b.lv||0)>0){
      const a=Math.atan2(dy,dx);c.save();c.translate(b.x1,b.y1);c.rotate(a);for(let i=15;i<len;i+=20){c.strokeStyle=`rgba(126,209,255,${.45*fade})`;c.lineWidth=.7;c.beginPath();c.ellipse(i,0,1.5+age*3,3+age*8,0,0,TAU);c.stroke();}c.restore();
    }
    c.restore();return true;
  }
  function cloud(c,f){
    const k=clamp(f.t/f.dur),fade=clamp(Math.min(f.t/.35,(f.dur-f.t)/.7)),col=rgb('gas',f.tower.ulv||0);
    c.save();
    // Slow layered eddies, grounded and translucent so targets stay readable.
    for(let i=0;i<9;i++){const a=noise(f.seed,i)*TAU+f.t*(i%2?.2:-.13),rr=f.r*(.2+noise(f.seed,i+12)*.35),d=f.r*(.18+noise(f.seed,i+24)*.35);
      Arsenal.haze(c,f.x+Math.cos(a)*d,f.y+Math.sin(a)*d*.65-k*5,rr,col,fade*.14);}
    c.strokeStyle=`rgba(${col},${fade*.16})`;c.lineWidth=.7;c.beginPath();c.ellipse(f.x,f.y,f.r*.72,f.r*.5,0,0,TAU);c.stroke();
    for(let i=0;i<8;i++){const x=f.x+(noise(f.seed,i+80)-.5)*f.r*1.2,y=f.y+(noise(f.seed,i+90)-.5)*f.r*.7-(f.t*9+i*7)%23;disk(c,x,y,.7,`rgba(${col},${fade*.5})`);}
    c.restore();
  }
  function death(list,d,p,src){return DinoFX.death(list,d,p,src);}
  function update(f,dt,play){return DinoFX.update(f,dt,play);}
  function draw(c,f,time=0){
    if(Extinction.draw(c,f))return true;
    const k=clamp(f.t/f.dur),fade=1-k,r=f.r||12,seed=f.seed||1,lv=f.lv||0;
    switch(f.kind){
      case 'weaponDeath':return DinoFX.drawDeath(c,f);
      case 'boom':{
        const rr=r*(.18+Math.pow(k,.55)*.68);c.save();
        c.fillStyle=`rgba(14,17,18,${fade*.26})`;c.beginPath();c.ellipse(f.x,f.y+4,rr*.82,rr*.38,0,0,TAU);c.fill();
        // Fire erupts first; separate smoke lobes overtake it as they rise.
        for(let i=0;i<8;i++){const a=noise(seed,i)*TAU,d=rr*(.25+noise(seed,i+19)*.35),x=f.x+Math.cos(a)*d,y=f.y+Math.sin(a)*d*.55-k*r*.24;
          Arsenal.haze(c,x,y,rr*(.26+noise(seed,i+30)*.2),k<.34?[255,123-i*7,26]:[80+i*3,77+i*2,70+i*2],fade*(k<.34?.68:.38));}
        if(k<.4){c.globalCompositeOperation='lighter';Arsenal.haze(c,f.x,f.y-2,rr*.65,[255,186,70],(1-k/.4)*.75);Arsenal.haze(c,f.x,f.y-2,rr*.25,[255,247,201],(1-k/.4)*.95);c.globalCompositeOperation='source-over';}
        c.strokeStyle=`rgba(211,183,132,${fade*fade*.35})`;c.lineWidth=1+fade*2;c.beginPath();c.ellipse(f.x,f.y+3,r*(.25+k*.83),r*(.12+k*.42),0,0,TAU);c.stroke();
        sparks(c,f.x,f.y,k,r*1.25,seed,[255,188,89],18,r*.28);c.restore();return true;
      }
      case 'frost':{
        const rr=r*(.15+k*.6);
        for(let i=0;i<10;i++){const a=noise(seed,i)*TAU,d=rr*(.3+noise(seed,i+12)*.7),x=f.x+Math.cos(a)*d,y=f.y+Math.sin(a)*d*.55;
          DinoFX.crystal(c,x,y,(1.2+noise(seed,i+20)*2.2)*fade,a,fade*.85);}
        for(let i=0;i<4;i++)DinoFX.smoke(c,f.x+(i-1.5)*rr*.38,f.y-k*9,rr*(.32+i*.06),k,seed+i,fade*.27,true);
        return true;
      }
      case 'zap':{
        for(let i=0;i<4;i++){const a=noise(seed,i)*TAU,d=(5+k*15);DinoFX.arc(c,{x:f.x,y:f.y},{x:f.x+Math.cos(a)*d,y:f.y+Math.sin(a)*d},time,seed+i,fade);}
        return true;
      }
      case 'sonic':{
        c.save();const col=rgb('sonic',lv);
        for(let i=0;i<3+lv;i++){const q=clamp(k-i*.075),rr=r*Math.pow(q,.75);if(rr<1)continue;
          c.strokeStyle=`rgba(${col},${fade*(i===0?.55:.22)})`;c.lineWidth=i===0?2.4:1;c.beginPath();c.arc(f.x,f.y,rr,0,TAU);c.stroke();
          if(i===0){c.strokeStyle=`rgba(245,224,255,${fade*.7})`;c.lineWidth=.8;c.beginPath();c.arc(f.x,f.y,rr,-.45,.6);c.arc(f.x,f.y,rr,2.5,3.6);c.stroke();}}
        Arsenal.haze(c,f.x,f.y-12,18,col,fade*.22);c.restore();return true;
      }
      case 'flame':{
        const length=r*(.65+k*.35);c.save();c.translate(f.x,f.y);c.rotate(f.ang+Math.PI*.5);
        for(let i=0;i<9;i++){const q=i/8,w=(5+q*16)*(1-k*.3),x=Math.sin(q*12+seed-k*9)*q*3;
          DinoFX.flame(c,x,-q*length,w*1.6,time+q*.12,seed+i,lv>=2,fade*(.7-q*.2));}
        c.restore();return true;
      }
      case 'gaspuff':{
        const col=rgb('gas',lv);for(let i=0;i<4;i++){const d=k*(22+i*4),x=f.x+Math.cos(f.ang)*d,y=f.y+Math.sin(f.ang)*d-k*5;Arsenal.haze(c,x,y,(5+k*r)*(1+i*.12),col,fade*.22);}return true;
      }
      case 'spark':sparks(c,f.x,f.y,k,15+lv*3,seed,[255,212,133],7,6);return true;
      case 'casing':{
        c.save();const a=(f.ang||0)+Math.PI*.5,x=f.x+Math.cos(a)*k*23,y=f.y+Math.sin(a)*k*15-Math.sin(Math.min(1,k*1.5)*Math.PI)*13;
        c.translate(x,y);c.rotate(k*13+seed);c.globalAlpha=clamp(fade*3);c.fillStyle='#ba8a44';c.fillRect(-1.8,-.7,3.6,1.4);c.fillStyle='#f7d889';c.fillRect(-1.8,-.7,3.6,.45);c.restore();return true;
      }
      case 'launchsmoke':case 'vent':{
        const cool=f.kind==='vent',col=cool?[177,219,230]:[140,141,133];for(let i=0;i<4;i++){const a=(f.ang||0)+Math.PI+(i-1.5)*.4,x=f.x+Math.cos(a)*k*r,y=f.y+Math.sin(a)*k*r*.65-k*9;Arsenal.haze(c,x,y,3+k*r*.5,col,fade*.15);}return true;
      }
      case 'rearm':{
        c.save();const col=rgb(f.weapon,lv);c.strokeStyle=`rgba(${col},${fade*.55})`;c.lineWidth=1.5;c.beginPath();c.ellipse(f.x,f.y,22+k*14,(22+k*14)*.72,0,0,TAU);c.stroke();
        for(let i=0;i<8;i++){const a=i/8*TAU;line(c,[[f.x+Math.cos(a)*23,f.y+Math.sin(a)*17-k*12],[f.x+Math.cos(a)*23,f.y+Math.sin(a)*17-k*12-4]],`rgba(${col},${fade*.65})`,1);}c.restore();return true;
      }
    }return false;
  }
  return {fire,mark,trail,projectile,bolt,cloud,death,update,draw,emit};
})();
