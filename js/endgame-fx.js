'use strict';
/* The final two acts: a biological rupture, then a night-sky victory ceremony.
   Draws are deterministic. The game owns clocks, cues, rewards and dismissal. */
const EndgameFX = (() => {
  const TAU=Math.PI*2, clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
  const rand=(seed,i)=>{const n=Math.sin(seed*17.13+i*127.1)*43758.5453;return n-Math.floor(n);};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deathSpec={dur:9.6,impact:2.85};
  const deathBeats=[
    [.45,'thud',.6,.75],[1.05,'thud',.7,.66],[1.65,'heartbeat',.6,.8],
    [2.30,'sizzle',.7,.65],[2.85,'shellImpact',1,.65],[3.08,'shatter',.85,.72],
    [3.48,'boom',.7,.7],[4.0,'boom',.55,.8],[4.7,'thud',.65,.7],[5.35,'thud',.4,.85]
  ];
  function updateDrex(c,play){
    while((c.finaleBeat||0)<deathBeats.length&&c.t>=deathBeats[c.finaleBeat||0][0]){
      const [at,name,gain,rate]=deathBeats[c.finaleBeat||0];c.finaleBeat=(c.finaleBeat||0)+1;
      play(name,{x:c.x,y:c.y,gain,rate});
    }
    c.thudded=c.t>=c.impact;
  }
  function ellipse(c,x,y,rx,ry,color,alpha=1,rot=0){
    if(rx<=0||ry<=0||alpha<=0)return;c.save();c.globalAlpha*=alpha;c.fillStyle=color;
    c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);c.fill();c.restore();
  }
  function line(c,points,color,width,alpha=1){
    c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';
    c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();c.restore();
  }
  function glow(c,x,y,r,color,alpha){if(r>0&&alpha>0)Arsenal.haze(c,x,y,r,color,alpha);}
  function flight(age,x,y,vx,vy,g,ground){
    const hit=(-vy+Math.sqrt(vy*vy+2*g*Math.max(0,ground-y)))/g,t=Math.min(age,hit);
    return {x:x+vx*t,y:Math.min(ground,y+vy*t+g*t*t*.5),hit,t,landed:age>=hit};
  }
  function gore(c,f,age){
    if(age<=0)return;const s=f.size,fade=clamp((f.dur-f.t)/1.1),count=reduced()?72:148;
    c.save();c.globalAlpha*=fade;
    for(let i=0;i<18;i++){
      const q=ease(age/(.5+rand(f.seed,i))),x=f.x+(rand(f.seed,i+10)-.5)*s*4.8,y=f.y+(rand(f.seed,i+20)-.5)*s*.65;
      const r=s*(.12+rand(f.seed,i+30)*.32)*q;
      ellipse(c,x,y,r,r*.30,i%3?'#730d20':'#400916',.85);
      ellipse(c,x-r*.1,y-r*.03,r*.72,r*.14,'#ae2334',.65);
    }
    for(let i=0;i<count;i++){
      const a=rand(f.seed,i+80)*TAU,v=s*(1.5+rand(f.seed,i+250)*3.9),delay=rand(f.seed,i+430)*.18,u=age-delay;
      if(u<=0)continue;
      const y=f.y-s*(.65+rand(f.seed,i+590)*.4),ground=f.y+(rand(f.seed,i+760)-.5)*s*.55;
      const vx=Math.cos(a)*v,vy=Math.sin(a)*v-s*1.2,g=s*7.2,p=flight(u,f.x,y,vx,vy,g,ground),r=s*(.012+rand(f.seed,i+930)*.036);
      if(p.landed){
        const spread=1+ease((u-p.hit)*8)*2;
        ellipse(c,p.x,ground,r*spread,r*.6,'#9d1930',.85);
        ellipse(c,p.x+r*4,ground-r,r*.6,r*.3,'#ba293b',.8);
      }else{
        const prev=flight(Math.max(0,p.t-.045),f.x,y,vx,vy,g,ground);
        line(c,[[prev.x,prev.y],[p.x,p.y]],i%4?'#a4162d':'#ec5360',Math.max(.8,r*1.45),.85);
        ellipse(c,p.x,p.y,r*1.35,r*.78,'#bd263a',1,Math.atan2(vy+g*p.t,vx));
      }
    }
    // Torn hide, wet tissue and exposed bone tumble with a single soft bounce.
    for(let i=0;i<28;i++){
      const r=rand(f.seed,i+1110),vx=(r-.5)*s*7,vy=-s*(2+rand(f.seed,i+1150)*3.5),g=s*8;
      const ground=f.y+(rand(f.seed,i+1190)-.5)*s*.5,p=flight(age,f.x,f.y-s*.8,vx,vy,g,ground),q=Math.min(Math.max(0,age-p.hit),.25);
      const x=p.x+vx*q*.16,y=p.y-Math.sin(q/.25*Math.PI)*s*.12,rot=(i%2?1:-1)*(p.t+q)*4,sz=s*(.055+rand(f.seed,i+1220)*.095);
      c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=i%3===0?f.pal.body:'#751020';
      c.beginPath();c.moveTo(-sz,-sz*.35);c.bezierCurveTo(-sz*.45,-sz,sz*.85,-sz*.7,sz,0);c.lineTo(sz*.35,sz*.65);c.lineTo(-sz*.6,sz*.4);c.closePath();c.fill();
      line(c,[[-sz*.7,0],[0,sz*.2],[sz*.55,-sz*.18]],i%4?'#cf4653':'#ead2b5',Math.max(1,sz*.20));
      c.restore();
    }
    c.restore();
  }
  function ribs(c,f,u,fade){
    const s=f.size,q=ease(u/.85),x=f.x-f.dir*s*.2*q,y=f.y-s*.12,rot=-.15+q*.35;
    c.save();c.translate(x,y);c.rotate(rot);c.globalAlpha*=fade;
    line(c,[[-s*.6,0],[s*.5,-s*.025]],'#651c24',s*.12);
    for(let i=0;i<7;i++){
      const xx=(i-3)*s*.14,rr=s*(.26+Math.sin((i+1)/8*Math.PI)*.18);
      for(const side of [-1,1]){
        c.beginPath();c.moveTo(xx,0);c.bezierCurveTo(xx-s*.16,side*rr*.8,xx+s*.04,side*rr,xx+s*.10,side*rr*.44);
        c.strokeStyle='#69202a';c.lineWidth=s*.055;c.stroke();c.strokeStyle='#d7b79d';c.lineWidth=s*.022;c.stroke();
      }
    }
    c.restore();
  }
  function drawDrex(gc,c){
    const t=c.t,s=c.size,u=t-c.impact,fade=clamp((c.dur-t)/1.1),calm=reduced();
    if(fade<=0)return;
    gc.save();gc.globalAlpha*=fade;
    if(u<0){
      const buckle=ease((t-.35)/.85),swelling=ease((t-1.15)/(c.impact-1.15));
      const pulse=calm?0:Math.sin(t*11)*.035*swelling,rot=.28*buckle-.16*swelling;
      const sx=1+swelling*.35+pulse,sy=1+swelling*.57-pulse;
      const ox=c.x-c.dir*s*.16*buckle,oy=c.y+s*.15*buckle+s*.15*swelling;
      ellipse(gc,c.x,c.y+5,s*(1.0+swelling*.65),s*.19,'#080807',.48);
      glow(gc,c.x,c.y-s*.9,s*(.35+swelling*1.25),[156,22,33],swelling*.38);
      bossDeathPaint(gc,{...c,entranceT:0},{x:ox,y:oy,rot,sx,sy,alpha:fade});
      // Project the cracks from actual front-facing torso samples into the same body transform.
      const heading=Math.round(.16/TAU*32)/32*TAU,phase=Math.round(c.phase/TAU*16)/16*TAU;
      const F=DinoFX.frame({...c,entranceT:0,artHeading:heading},phase,1),sites=F.sites.filter(p=>p.part==='torso'&&p.depth>=F.center.depth);
      const open=ease((t-1.30)/(c.impact-1.30));
      gc.save();gc.translate(ox,oy);gc.scale(c.dir,1);gc.rotate(rot);gc.scale(sx,sy);
      for(let i=0;i<Math.min(11,sites.length)&&open>0;i++){
        const p=sites[Math.floor(i*sites.length/Math.min(11,sites.length))],x=(p.x*.75+F.center.x*.25)*s,y=(p.y*.75+F.center.y*.25)*s,r=s*(.045+rand(c.seed,i)*.07)*open;
        const pts=[[x-r*.6,y-r*.4],[x-r*.12,y],[x+r*.3,y+r*.17],[x+r*.45,y+r*.72]];
        line(gc,pts,'#460714',s*.047*open,.9);line(gc,pts,'#bd283d',s*.023*open,.95);
        line(gc,pts,'#ffd3a0',s*.008*open,open*(calm?.35:.7));
      }
      gc.restore();
      for(let i=0;i<6&&swelling>.2;i++){
        const a=i/6*TAU+t*.18,r=s*(1.5-swelling*.85);
        glow(gc,c.x+Math.cos(a)*r,c.y-s*.8+Math.sin(a)*r*.48,s*.07,[226,102,70],swelling*.5);
      }
      gc.restore();return true;
    }
    // A broad pressure front and rolling red vapor leave a visible, bloody crater.
    const spread=ease(u/.7);
    ellipse(gc,c.x,c.y+7,s*(.65+spread*1.6),s*(.16+spread*.3),'#120b0d',.85);
    bossDeathCracks(gc,c,spread*2.1,.7*fade);
    gore(gc,c,u);
    for(let j=0;j<3;j++){
      const age=u-j*.48;if(age<=0||age>1.5)continue;
      const q=age/1.5,r=s*(.35+Math.pow(q,.65)*(3.9+j*.5));
      gc.save();gc.globalAlpha*=(1-q)*.65;gc.strokeStyle=j?'#e89568':'#ffd4a3';gc.lineWidth=s*(.12*(1-q)+.01);
      gc.beginPath();gc.ellipse(c.x,c.y-s*.13,r,r*.28,0,0,TAU);gc.stroke();gc.restore();
    }
    if(u<.5)glow(gc,c.x,c.y-s*.9,s*(1.25+u*2),[255,132,82],(1-u/.5)*(calm?.18:.68));
    for(let i=0;i<(calm?8:16);i++){
      const r=rand(c.seed,i+1500),age=Math.max(0,u-r*.35),q=clamp(age/4.5),x=c.x+(r-.5)*s*(1.5+q*3.5),y=c.y-s*(.25+q*(1.1+r));
      DinoFX.smoke(gc,x,y,s*(.4+q*.85),calm?0:age,c.seed+i,(1-q)*fade*.52);
      if(age<1.2)glow(gc,x,y,s*(.35+q),[126,15,32],(1-age/1.2)*.28);
    }
    ribs(gc,c,u,fade);
    drexBlastAnatomy(gc,c,c.impact);
    // A crown of short sparks gives way to drifting ash instead of a full-screen flash.
    for(let i=0;i<36;i++){
      const r=rand(c.seed,i+1600),age=Math.max(0,u-r*.4),q=clamp(age/(2.5+r*2));
      const x=c.x+(r-.5)*s*3.7+Math.sin(age+i)*s*.12,y=c.y-s*(.2+q*(1.4+r));
      ellipse(gc,x,y,s*.015*(1-q),s*.024*(1-q),q<.45?'#ffc381':'#bd7e73',(1-q)*.9);
    }
    gc.restore();return true;
  }

  const palette=[[255,199,105],[93,225,219],[255,120,153],[178,168,255],[243,228,181]];
  const showPlan=[
    [.15,.18,.26,0,0],[.45,.82,.22,1,0],[1.05,.35,.18,2,1],[1.35,.68,.32,0,1],
    [2.0,.12,.43,1,2],[2.18,.87,.40,2,2],[2.7,.50,.13,0,1],
    [3.45,.22,.22,3,1],[3.68,.77,.18,1,1],[4.35,.08,.36,0,2],[4.48,.92,.32,0,2],
    [5.15,.3,.20,2,0],[5.35,.69,.16,3,0],[6.0,.14,.25,0,1],[6.12,.85,.22,0,1],
    [6.40,.36,.13,1,2],[6.55,.65,.18,2,2],[6.80,.50,.08,0,1],
    [7.05,.22,.32,0,2],[7.15,.80,.30,0,2],[7.35,.50,.18,4,1]
  ];
  function createVictory(summary){return {t:0,dur:reduced()?5:10.8,nextBeat:0,reduced:reduced(),summary,seed:37.17};}
  function updateVictory(show,dt,play){
    if(dt<=0)return;show.t=Math.min(show.dur,show.t+dt);
    while(show.nextBeat<showPlan.length&&show.t>=showPlan[show.nextBeat][0]+.72){
      const [at,x,,color]=showPlan[show.nextBeat++];
      if(!show.reduced)play('firework',{pan:(x-.5)*1.35,gain:color===0?.75:.55,rate:.8+color*.07});
    }
  }
  function fireworks(gc,show,w,h){
    const t=show.t,unit=Math.min(w,h),count=w<600?44:72;
    gc.save();gc.globalCompositeOperation='lighter';
    for(let idx=0;idx<showPlan.length;idx++){
      const [at,xx,yy,col,kind]=showPlan[idx],age=t-at;if(age<0||age>3.7)continue;
      const color=palette[col],rgb=color.join(','),x=xx*w,y=yy*h,radius=unit*(kind===1?.26:.19),launch=.72;
      if(age<launch){
        const q=age/launch,py=h*.93+(y-h*.93)*(1-Math.pow(1-q,2));
        const px=x+(xx-.5)*unit*.1*(1-q);line(gc,[[px,py+unit*.07],[px,py]],`rgba(${rgb},.7)`,1.5);
        glow(gc,px,py,9,color,.48);ellipse(gc,px,py,1.7,2.5,'#fff4d5');continue;
      }
      const u=age-launch,life=kind===2?2.9:2.5,k=clamp(u/life),fade=Math.pow(1-k,1.1);
      if(k>=1)continue;
      glow(gc,x,y,radius*(.22+u*.35),color,Math.max(0,.18-u*.28));
      for(let i=0;i<count;i++){
        const a=i/count*TAU+rand(idx,4)*.3,rr=radius*(kind===1?(i%3===0?.55:1):(.6+rand(idx,i)*.4));
        const gravity=unit*(kind===2?.10:.07),tip=ageI=>[x+Math.cos(a)*rr*(1-Math.exp(-ageI*2.3)),y+Math.sin(a)*rr*(1-Math.exp(-ageI*2.3))*.82+gravity*ageI*ageI];
        const p=tip(u),tail=tip(Math.max(0,u-(kind===2?.20:.085)));
        line(gc,[tail,p],`rgb(${rgb})`,4.5,fade*.16);
        line(gc,[tail,p],`rgb(${rgb})`,kind===2?1.35:1.8,fade);
        ellipse(gc,p[0],p[1],1.4,1.4,'#fff3d3',fade);
        if(kind===1&&u>.42&&i%3===0){
          const a2=a+u*2,off=Math.sin((u-.42)*2)*unit*.017;
          line(gc,[[p[0]-off*Math.cos(a2),p[1]-off*Math.sin(a2)],[p[0]+off*Math.cos(a2),p[1]+off*Math.sin(a2)]],`rgb(${rgb})`,.9,fade*.55);
        }
      }
    }
    gc.restore();
  }
  function drawVictory(gc,show,w,h){
    const t=show.reduced?3.2:show.t,unit=Math.min(w,h);
    gc.clearRect(0,0,w,h);
    const sky=gc.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#050e1b');sky.addColorStop(.55,'#10282d');sky.addColorStop(1,'#06130f');gc.fillStyle=sky;gc.fillRect(0,0,w,h);
    glow(gc,w*.5,h*.57,unit*.7,[85,139,115],.17);
    for(let i=0;i<90;i++){
      const x=rand(8,i)*w,y=rand(9,i)*h*.8,a=.15+rand(10,i)*.40;
      ellipse(gc,x,y,i%11===0?1.2:.65,i%11===0?1.2:.65,'#d8e8e6',a*(.8+.2*Math.sin(t*.5+i)));
    }
    // Crossing searchlights and a silhouetted jungle frame the player's award.
    for(const side of [-1,1]){
      const x=w*(side<0?.06:.94),sweep=Math.sin(t*.21+side)*w*.08,target=w*.5+side*w*.18+sweep;
      const light=gc.createLinearGradient(x,h,target,h*.1);light.addColorStop(0,'#e6c67900');light.addColorStop(.2,'#e6c6790c');light.addColorStop(1,'#a9dbd200');gc.fillStyle=light;
      gc.beginPath();gc.moveTo(x,h);gc.lineTo(target-unit*.06,0);gc.lineTo(target+unit*.06,0);gc.closePath();gc.fill();
    }
    if(!show.reduced)fireworks(gc,show,w,h);
    for(let layer=0;layer<2;layer++){
      gc.fillStyle=layer?'#040d0b':'#0b1c19';gc.beginPath();gc.moveTo(0,h);
      for(let i=0;i<=36;i++){const x=i/36*w,y=h*(.88+layer*.06)-rand(layer+11,i)*h*.06;gc.quadraticCurveTo(x-w/72,y-h*.045,x,y);}
      gc.lineTo(w,h);gc.closePath();gc.fill();
    }
    for(const [xx,hh,side]of [[.04,.23,1],[.95,.20,-1],[.11,.13,1]]){
      const x=w*xx,y=h*(1-hh),len=unit*.13;
      gc.strokeStyle='#040e0c';gc.lineWidth=unit*.012;gc.beginPath();gc.moveTo(x-side*len*.3,h);gc.quadraticCurveTo(x-side*len*.3,y+len*.7,x,y);gc.stroke();
      for(let i=0;i<7;i++){
        const a=-Math.PI+i*Math.PI/6,dx=Math.cos(a)*len,dy=Math.sin(a)*len*.38;
        gc.fillStyle='#040e0c';gc.beginPath();gc.moveTo(x,y);gc.quadraticCurveTo(x+dx*.45,y+dy-len*.26,x+dx,y+dy+len*.24);gc.quadraticCurveTo(x+dx*.6,y+dy-len*.04,x,y);gc.fill();
      }
    }
    if(t>2.3&&!show.reduced){
      const fade=clamp((t-2.3)*.8)*clamp((show.dur-show.t)/1.2);
      for(let i=0;i<(w<600?55:90);i++){
        const q=(Math.max(0,t-2.3)*( .06+rand(40,i)*.065)+rand(41,i))%1;
        const x=rand(42,i)*w+Math.sin(t*.8+i)*unit*.045,y=q*h,sz=unit*(.002+rand(43,i)*.004);
        gc.save();gc.translate(x,y);gc.rotate(t*(i%2?1:-1)+i);gc.globalAlpha=fade*.5;gc.fillStyle=i%3?'#e1be6b':'#b2e4dc';gc.fillRect(-sz,-sz*.4,sz*2,sz*Math.cos(t*2+i));gc.restore();
      }
    }
  }
  return {deathSpec,updateDrex,drawDrex,createVictory,updateVictory,drawVictory,reduced,
    stats:()=>({fireworkShells:showPlan.length,maxSparks:showPlan.length*72,maxBloodDrops:148})};
})();
