'use strict';
/* Independent effect worlds for the homepage and the match. Emission and
   ballistics run only in update, with bounded particle/decal budgets. */
const TouristFX = (() => {
  const TAU=Math.PI*2,random=(a,b)=>a+Math.random()*(b-a);
  const create=()=>({particles:[],decals:[]});
  function stain(world,x,y,r,dir=1){
    world.decals.push({x,y,r,t:0,dur:random(14,20),seed:random(0,TAU),dir});
    if(world.decals.length>100)world.decals.splice(0,world.decals.length-100);
  }
  function burst(world,x,y,ground,u,dir=1,power=1){
    const s=u.size||14,scale=Math.max(.6,Math.min(2.5,s/17));
    if(power>.5)world.particles.push({x,y,ground,vx:dir*8,vy:-10,r:14*scale,t:0,dur:.27,mist:true,rot:0,spin:0});
    for(let i=0;i<Math.ceil(48*power);i++){
      const angle=random(-1.8,.35),speed=random(30,150)*scale*power,chunk=i%9===0&&power>.5;
      world.particles.push({x:x+random(-2,2)*scale,y:y+random(-2,2)*scale,ground:Math.max(ground,y+3),vx:Math.cos(angle)*speed*dir,vy:Math.sin(angle)*speed-random(15,45)*scale,
        r:random(chunk?1.9:.3,chunk?3.8:1.3)*scale,t:0,dur:4,rot:random(0,TAU),spin:random(-10,10),chunk,cloth:chunk&&i%18===0?u.shirt:null,skin:u.skin,seed:random(0,TAU),landed:false});
    }
    if(world.particles.length>240)world.particles.splice(0,world.particles.length-240);
  }
  function drip(world,x,y,ground,u,dir){burst(world,x,y,ground,u,dir,.12);}
  function update(world,dt){
    // Substeps make landing splashes consistent at 10x simulation speed.
    let remaining=Math.min(dt,2);while(remaining>0){const step=Math.min(remaining,1/60);remaining-=step;
      for(const p of world.particles){p.t+=step;if(p.landed)continue;p.vy+=260*step;p.x+=p.vx*step;p.y+=p.vy*step;p.rot+=p.spin*step;
        if(p.y>=p.ground&&!p.mist){p.y=p.ground;p.landed=true;stain(world,p.x,p.ground,p.r*(p.chunk?2.4:2.1),Math.sign(p.vx));
          if(p.chunk){p.dur=p.t+8;p.rot*=.2;}else p.dur=p.t;
        }
      }
      for(const d of world.decals)d.t+=step;
      world.particles=world.particles.filter(p=>p.t<p.dur);world.decals=world.decals.filter(d=>d.t<d.dur);
    }
  }
  function drawGround(c,world,band=()=>true){
    c.save();
    for(const d of world.decals){if(!band(d.y))continue;const grow=.5+Math.min(1,d.t*4)*.5,alpha=Math.min(1,(d.dur-d.t)/4);c.save();c.translate(d.x,d.y);c.scale(d.r*grow,d.r*grow*.48);c.globalAlpha*=alpha;
      c.fillStyle='#491019';c.beginPath();for(let j=0;j<18;j++){const a=j/18*TAU,r=1+Math.sin(j*7.13+d.seed)*.28;(j?c.lineTo.bind(c):c.moveTo.bind(c))(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();
      const g=c.createRadialGradient(-.2,-.2,.03,0,0,1.1);g.addColorStop(0,'#a6262d');g.addColorStop(.45,'#791521');g.addColorStop(1,'#4d101a');c.fillStyle=g;c.fill();
      c.fillStyle='#771420';for(let j=0;j<7;j++){const a=j*2.4+d.seed,r=1.3+(j%3)*.38;c.beginPath();c.ellipse(Math.cos(a)*r,Math.sin(a)*r,.11+(j%2)*.1,.10,a,0,TAU);c.fill();}
      c.globalAlpha*=.30;c.strokeStyle='#d5776b';c.lineWidth=.06;c.beginPath();c.ellipse(-.17,-.18,.42,.23,-.2,Math.PI,TAU);c.stroke();c.restore();
    }
    c.restore();
  }
  function drawAir(c,world,band=()=>true){
    c.save();
    for(const p of world.particles){if(!band(p.ground))continue;c.save();c.globalAlpha*=Math.min(1,(p.dur-p.t)/1.2);c.translate(p.x,p.y);
      if(p.mist){c.globalAlpha*=.3*(1-p.t/p.dur);const r=p.r*(1+p.t*3),g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'rgba(162,24,39,.6)');g.addColorStop(1,'rgba(105,8,22,0)');c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);}
      else if(p.chunk){
        c.rotate(p.rot);c.fillStyle='#390c15';c.beginPath();for(let j=0;j<9;j++){const a=j/9*TAU,r=p.r*(.7+Math.sin(j*5.7+p.seed)*.27);if(j)c.lineTo(Math.cos(a)*r,Math.sin(a)*r);else c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();
        c.fillStyle=p.cloth||'#993441';c.beginPath();c.moveTo(-p.r*.8,-p.r*.3);c.lineTo(-p.r*.17,-p.r*.6);c.lineTo(p.r*.45,-p.r*.47);c.lineTo(p.r*.32,0);c.lineTo(p.r*.65,p.r*.2);c.lineTo(-p.r*.5,p.r*.3);c.closePath();c.fill();
        c.strokeStyle=p.cloth?'#c1a08d':'#db9990';c.lineWidth=Math.max(.4,p.r*.13);c.beginPath();c.moveTo(-p.r*.2,-p.r*.3);c.bezierCurveTo(p.r*.2,-p.r*.2,0,p.r*.3,p.r*.36,p.r*.36);c.stroke();
        if(!p.cloth){c.fillStyle=p.seed>3.5?'#d2c0a0':p.skin||'#b68165';c.beginPath();c.moveTo(-p.r*.55,-p.r*.25);c.lineTo(-p.r*.07,-p.r*.15);c.lineTo(p.r*.2,p.r*.32);c.lineTo(-p.r*.33,p.r*.18);c.closePath();c.fill();}
      }
      else {
        c.rotate(Math.atan2(p.vy,p.vx));const tail=p.r*Math.min(8,1+Math.hypot(p.vx,p.vy)/65);
        c.fillStyle='#690d1b';c.beginPath();c.moveTo(-tail,0);c.quadraticCurveTo(-p.r,-p.r*.35,0,-p.r);c.bezierCurveTo(p.r*1.55,-p.r,p.r*1.55,p.r,0,p.r);c.quadraticCurveTo(-p.r,p.r*.35,-tail,0);c.fill();
        const g=c.createRadialGradient(p.r*.25,-p.r*.25,0,0,0,p.r*1.2);g.addColorStop(0,'#b43743');g.addColorStop(1,'#750d20');c.fillStyle=g;c.beginPath();c.ellipse(0,0,p.r,p.r*.8,0,0,TAU);c.fill();c.fillStyle='rgba(233,137,135,.5)';c.beginPath();c.ellipse(p.r*.16,-p.r*.32,p.r*.3,p.r*.14,-.2,0,TAU);c.fill();
      }
      c.restore();
    }
    c.restore();
  }
  return {create,burst,drip,update,drawGround,drawAir};
})();
