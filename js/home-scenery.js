'use strict';
/* Painted scenery for the homepage. Static surfaces are cached at authoring
   resolution; moving light/electricity is deterministic from the scene clock.
   These painters never advance actors, consume gameplay randomness or emit FX. */
const HomeScenery = (() => {
  const cache = new Map();
  const TAU = Math.PI * 2;
  const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function poly(c, points, fill, stroke, width = .002) {
    c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function line(c, points, color, width) {
    c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function ellipse(c,x,y,rx,ry,color) {
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
  }
  function gradient(c,x0,y0,x1,y1,colors) {
    const g=c.createLinearGradient(x0,y0,x1,y1);colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));return g;
  }
  function tile(key,w,h,ox,oy,scale,paint) {
    if(!cache.has(key)) { const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');c.translate(ox,oy);c.scale(scale,scale);paint(c);cache.set(key,cv); }
    return cache.get(key);
  }
  function bolt(c,x,y,r=.004) {
    ellipse(c,x,y,r,r,'#29373a');ellipse(c,x-r*.2,y-r*.2,r*.6,r*.6,'#a4ada4');
  }
  function glow(c,x,y,r,color,strength=1) {
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${.48*strength})`);g.addColorStop(.25,`rgba(${color},${.15*strength})`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  function wood(c,x,y,w,h,seed,dark=false) {
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    c.fillStyle=gradient(c,x,y,x+w,y,dark?['#302d24','#534c38','#292a23']:['#4d4937','#837451','#5d543e']);c.fillRect(x,y,w,h);
    for(let i=0;i<20;i++) {
      const gx=x+w*noise(seed+i),gy=y+h*noise(seed+i+79),len=h*(.06+noise(seed+i+53)*.65);
      c.strokeStyle=i%3?'#191e1a50':'#c0a27550';c.lineWidth=.0012;
      c.beginPath();c.moveTo(gx,gy);c.bezierCurveTo(gx+.005,gy+len*.2,gx-.008,gy+len*.7,gx+.002,gy+len);c.stroke();
    }
    const kx=x+w*.56,ky=y+h*(.25+noise(seed+4)*.5);
    c.strokeStyle='#241d1555';c.lineWidth=.002;c.beginPath();c.ellipse(kx,ky,w*.16,w*.42,-.1,0,TAU);c.stroke();
    c.fillStyle='#bca77c35';c.fillRect(x+.001,y,.002,h);c.fillStyle='#111b19bb';c.fillRect(x+w-.004,y,.004,h);
    c.restore();
  }
  function pylonTile() {
    return tile('pylon',144,480,64,440,400,c=>{
      // Cast footing, a deep side face, diagonal steel brace and inset channels.
      poly(c,[[-.12,-.05],[.1,-.05],[.18,.015],[-.11,.03]],'#56645d','#1a2928');
      poly(c,[[.035,-.73],[.061,-.75],[.167,-.045],[.139,-.045]],gradient(c,.03,0,.16,0,['#75817a','#384849']));
      poly(c,[[-.077,-1],[.061,-1],[.098,-.04],[-.099,-.04]],gradient(c,-.1,0,.1,0,['#707b6d','#586353','#263b3b']),'#9a9f8155');
      poly(c,[[.061,-1],[.087,-.975],[.128,-.022],[.098,-.04]],'#233437');
      c.save();poly(c,[[-.077,-1],[.061,-1],[.098,-.04],[-.099,-.04]],null);c.clip();
      for(let i=0;i<300;i++){const x=-.1+noise(i)*.22,y=-1+noise(i+400)*.97;c.fillStyle=i%3?'#13272824':'#d6d1a421';c.fillRect(x,y,.002+noise(i+9)*.006,.002+noise(i+12)*.008);}
      for(let i=0;i<12;i++)line(c,[[-.053+i*.009,-.99],[-.05+i*.009,-.6-noise(i)*.25]],'#24362d38',.0015);
      c.restore();
      c.fillStyle='#233638';c.fillRect(-.04,-.92,.042,.8);c.fillStyle='#93a29455';c.fillRect(-.041,-.92,.004,.8);
      poly(c,[[-.103,-1.026],[.076,-1.026],[.105,-1.004],[-.078,-1.004]],'#9aa28c');
      poly(c,[[-.103,-1.026],[-.078,-1.004],[-.078,-.981],[-.103,-.994]],'#4d605a');
      c.fillStyle='#253b3b';c.fillRect(-.078,-1.004,.183,.023);
      // Cable clamps and ribbed porcelain insulators.
      for(let i=0;i<8;i++) {
        const y=-.88+.78*i/7;
        c.fillStyle='#a6ac91';c.fillRect(-.082,y-.006,.17,.013);
        for(let j=0;j<3;j++)ellipse(c,.028+j*.01,y,.007,.014,j===1?'#b8c6b7':'#718e84');
        bolt(c,-.06,y,.004);bolt(c,.075,y,.004);
      }
      // Junction box and conduit at the foot of the near face.
      c.fillStyle=gradient(c,-.074,0,.058,0,['#485b52','#253d3d']);c.fillRect(-.074,-.36,.132,.18);
      c.strokeStyle='#a8b29566';c.lineWidth=.002;c.strokeRect(-.074,-.36,.132,.18);
      for(let i=0;i<4;i++){c.fillStyle='#11292aaa';c.fillRect(-.056,-.213+i*.006,.069,.0025);}
      line(c,[[.058,-.25],[.085,-.25],[.085,-.06]],'#172c2c',.009);
      poly(c,[[-.062,-.35],[.047,-.35],[.047,-.27],[-.062,-.27]],'#cbb06a','#1d2927',.003);
      c.fillStyle='#25302b';c.font='bold .022px sans-serif';c.textAlign='center';c.fillText('DANGER',-.007,-.326);
      c.font='bold .016px sans-serif';c.fillText('10,000 V',-.007,-.301);
      bolt(c,-.065,-.348,.003);bolt(c,.048,-.19,.003);
      // Restrained hazard paint and stencilled bay number.
      for(let i=0;i<4;i++)poly(c,[[-.087+i*.04,-.1],[-.061+i*.04,-.1],[-.085+i*.04,-.055],[-.109+i*.04,-.055]],i%2?'#273532':'#c0a45b');
      c.fillStyle='#d3d0ad99';c.font='bold .032px monospace';c.textAlign='center';c.fillText('07',-.013,-.4);
      bolt(c,-.08,-.026,.006);bolt(c,.098,-.026,.006);
      // Lamp cage remains static; its live lens is drawn on top below.
      c.fillStyle='#283b3a';c.fillRect(-.026,-1.063,.053,.044);
      line(c,[[-.025,-1.025],[-.025,-1.061],[.025,-1.061],[.025,-1.025]],'#a4a68b',.004);
      line(c,[[0,-1.062],[0,-1.023]],'#698273',.003);
    });
  }
  function arc(c,x0,y0,x1,y1,seed,power,width=1) {
    const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy)||1,points=[[x0,y0]];
    for(let i=1;i<9;i++){const k=i/9,j=(noise(seed+i)-.5)*len*.16*Math.sin(k*Math.PI);points.push([x0+dx*k-dy/len*j,y0+dy*k+dx/len*j]);}points.push([x1,y1]);
    for(const [color,w] of [[`rgba(65,174,222,${power*.17})`,width*7],[`rgba(139,218,241,${power*.56})`,width*2.4],[`rgba(241,251,244,${power})`,width*.65]])line(c,points,color,w);
  }
  function fence(c,f,p,time) {
    const {x0,x1,y,h}=f,bay=x1-x0,live=Math.max(0,Math.min(1,p.live)),surge=Math.min(1,p.surge),post=pylonTile();
    c.save();c.globalAlpha*=.9;
    ellipse(c,(x0+x1)/2,y+h*.025,bay*.9,h*.035,'#07131555');
    for(const [a,b] of [[x0,x1],[x1,x1+bay]])for(let i=0;i<8;i++) {
      const ry=y-h*.88+h*.78*i/7,sag=h*.014;
      c.lineWidth=Math.max(1,h*.009);c.strokeStyle='#112528';c.beginPath();c.moveTo(a,ry);c.quadraticCurveTo((a+b)/2,ry+sag,b,ry);c.stroke();
      c.lineWidth=Math.max(.65,h*.0035);c.strokeStyle=live>.1?'#8aa7a3':'#556b69';c.beginPath();c.moveTo(a,ry-h*.002);c.quadraticCurveTo((a+b)/2,ry+sag-h*.002,b,ry-h*.002);c.stroke();
      // Small cable twists and tension hardware, not a continuous neon tube.
      for(let j=1;j<7;j++){const k=j/7,x=a+(b-a)*k,cy=ry+2*sag*k*(1-k);line(c,[[x-h*.006,cy-h*.004],[x+h*.006,cy+h*.004]],'#b8c8ba77',h*.002);}
      if(live>.5){const k=(time*.18+i*.19)%1,x=a+(b-a)*k,cy=ry+2*sag*k*(1-k);ellipse(c,x,cy,h*.006,h*.0025,`rgba(173,222,226,${.35*live})`);}
    }
    for(const px of [x0,x1,x1+bay]) {
      c.drawImage(post,px-h*.16,y-h*1.1,h*.36,h*1.2);
      const warning=p.warn>0,intensity=warning?.55+.45*Math.sin(time*9)**2:live,color=warning?'239,177,70':'127,190,148';
      glow(c,px,y-h*1.047,h*.105,color,intensity*.8);
      c.fillStyle=`rgba(${color},${.2+intensity*.75})`;c.fillRect(px-h*.017,y-h*1.057,h*.034,h*.02);
      line(c,[[px-h*.018,y-h*1.06],[px+h*.018,y-h*1.06]],'#f3f1d488',h*.003);
      if(surge>0){glow(c,px,y-h*.4,h*.27,'95,197,238',surge*.4);}
    }
    if(surge>0) {
      const contactX=p.arcX??f.climbX,contactY=p.arcY??(y-h*.55),seed=Math.floor(time*18);
      glow(c,contactX,contactY,h*.28,'103,197,236',surge*.75);
      for(let i=0;i<5;i++){
        const row=2+i,ry=y-h*.88+h*.78*row/7;
        arc(c,contactX,contactY,contactX+(i%2?1:-1)*bay*(.11+noise(i)*.22),ry,seed+i*12,surge,Math.max(.8,h*.004));
      }
    }
    c.restore();
  }
  function roof(c) {
    poly(c,[[-.43,-.91],[-.035,-1.1],[.49,-.99],[.37,-.86]],'#354b43','#b4ad8355');
    poly(c,[[-.43,-.91],[-.035,-1.1],[.05,-1.07],[-.32,-.886]],'#63745b');
    for(let i=0;i<11;i++)line(c,[[-.025+i*.039,-1.092+i*.008],[.355+i*.009,-.867-i*.012]],i%2?'#87907955':'#142e2b77',.004);
    for(let j=0;j<3;j++)line(c,[[-.36+j*.1,-.93-j*.05],[.395+j*.025,-.87-j*.038]],'#142823bb',.003);
    line(c,[[-.44,-.906],[-.03,-1.1],[.5,-.989]],'#bec4a788',.008);
    poly(c,[[-.44,-.91],[-.32,-.882],[.38,-.852],[.38,-.82],[-.32,-.851],[-.44,-.88]],'#3b4030','#a6a17a66');
  }
  function door(c) {
    for(let i=0;i<5;i++)wood(c,-.24+i*.087,-.79,.087,.756,30+i*9);
    c.strokeStyle='#262c21';c.lineWidth=.009;c.strokeRect(-.245,-.795,.444,.766);
    line(c,[[-.233,-.777],[.186,-.777]],'#bca67c77',.004);
    c.save();c.beginPath();c.arc(-.025,-.62,.055,0,TAU);c.clip();ellipse(c,-.025,-.62,.055,.055,'#091515');ellipse(c,-.002,-.637,.046,.046,'#786b4c');c.restore();
    for(const y of [-.69,-.24]){c.fillStyle='#1c2f2c';c.fillRect(-.252,y,.095,.015);bolt(c,-.22,y+.006);bolt(c,-.17,y+.006);}
    c.fillStyle='#252c22';c.fillRect(.138,-.406,.027,.068);ellipse(c,.15,-.366,.009,.016,'#c5b27c');
    line(c,[[.136,-.382],[.166,-.382]],'#ddd2aa',.004);
    c.fillStyle='#243a32';c.fillRect(-.115,-.486,.172,.049);c.strokeStyle='#bba775';c.lineWidth=.002;c.strokeRect(-.115,-.486,.172,.049);
    c.fillStyle='#e1cda0';c.font='bold .022px sans-serif';c.textAlign='center';c.fillText('OCCUPIED',-.029,-.452);
  }
  function looTile(wrecked,seat,seatX) {
    return tile('loo-'+wrecked+'-'+seat+'-'+seatX,512,640,245,565,500,c=>{
      ellipse(c,.02,.025,.49,.051,'#05121577');
      poly(c,[[-.405,-.015],[.34,-.015],[.49,.06],[-.34,.07]],gradient(c,0,-.02,0,.08,['#637366','#233e3b']),'#abb19a33');
      poly(c,[[-.34,.07],[.49,.06],[.49,.09],[-.34,.099]],'#213430');
      // Back planks and side wall survive the breach, with a jagged top edge.
      for(let i=0;i<7;i++){
        const x=-.315+i*.093,top=wrecked?-.61-noise(i+18)*.19:-.91;
        wood(c,x,top,.093,-top,90+i*7,true);
        if(wrecked)poly(c,[[x,top+.014],[x+.012,top-.026],[x+.022,top+.014],[x+.039,top-.034],[x+.05,top+.01]],'#6f6a4b');
      }
      poly(c,[[.335,-.885],[.46,-.82],[.46,.036],[.335,0]],gradient(c,.33,0,.46,0,['#344637','#24372f']),'#90957744');
      for(let i=0;i<12;i++)line(c,[[.338,-.79+i*.064],[.456,-.744+i*.064]],'#11282177',.004);
      if(wrecked){
        const tx=.72*seatX,sy=-seat;
        // Porcelain silhouette: tank, bowl, pedestal, raised lid, and a dark seat opening.
        c.fillStyle=gradient(c,tx-.15,0,tx-.02,0,['#728f88','#d3dbcb','#a5b9ad']);c.fillRect(tx-.15,sy-.19,.106,.2);
        c.fillStyle='#dde0c9';c.fillRect(tx-.157,sy-.196,.119,.016);
        bolt(c,tx-.127,sy-.16,.007);
        poly(c,[[tx-.064,sy+.035],[tx+.06,sy+.035],[tx+.041,-.04],[tx+.082,-.015],[tx+.067,0],[tx-.077,0],[tx-.086,-.018],[tx-.046,-.05]],gradient(c,tx-.08,0,tx+.08,0,['#7b9792','#dae3d1','#91aca2']));
        c.fillStyle=gradient(c,0,sy,0,sy+.12,['#eef0db','#98b3a7','#6e8d89']);c.beginPath();c.moveTo(tx-.102,sy);c.bezierCurveTo(tx-.104,sy+.12,tx+.078,sy+.13,tx+.11,sy);c.closePath();c.fill();
        ellipse(c,tx-.075,sy-.073,.026,.072,'#d2ddc9');ellipse(c,tx-.075,sy-.073,.017,.06,'#95b2a6');
        ellipse(c,tx,sy,.115,.037,'#eff1de');ellipse(c,tx+.006,sy,.08,.019,'#354f4c');ellipse(c,tx+.006,sy+.009,.069,.008,'#86a49a');
        line(c,[[tx+.102,sy+.01],[tx+.084,sy+.056]],'#edf3dfaa',.007);
        // Splintered door jambs leave the actor's sight line completely open.
        wood(c,-.356,-.47,.038,.47,234);wood(c,.31,-.58,.035,.58,247);
        for(let i=0;i<11;i++)poly(c,[[-.32+i*.06,.016],[-.305+i*.06,-.012-noise(i+5)*.016],[-.265+i*.06,.033]],i%2?'#88704a':'#433e2b');
      } else {
        for(let i=0;i<7;i++)wood(c,-.36+i*.101,-.9,.101,.9,8+i*3);
        wood(c,-.36,-.91,.041,.91,151);wood(c,.305,-.91,.041,.91,157);
        door(c);roof(c);
        // Side vent, hinges, frame nails and a small warm utility lantern.
        for(let i=0;i<4;i++)line(c,[[.36,-.68+i*.028],[.436,-.65+i*.028]],'#071b19',.011);
        for(const x of [-.335,.32])for(const y of [-.86,-.56,-.055])bolt(c,x,y,.003);
        c.fillStyle='#1a2e2a';c.fillRect(.269,-.78,.052,.095);
        c.fillStyle='#d3aa61';c.fillRect(.28,-.763,.029,.046);
        line(c,[[.264,-.782],[.327,-.782]],'#a49a74',.008);
        line(c,[[.264,-.7],[.327,-.7]],'#5b6850',.005);
        line(c,[[.294,-.771],[.294,-.709]],'#34463a',.004);
      }
      // Moss and grass integrate the footing with the jungle rather than a flat base.
      for(let i=0;i<40;i++) {
        const x=-.38+noise(i+30)*.87,y=.027+noise(i+4)*.025;
        if(Math.abs(x)<.17)continue;
        line(c,[[x,y],[x+(noise(i+17)-.5)*.033,y-.015-noise(i+5)*.035]],i%3?'#3c5540':'#718263',.002);
      }
    });
  }
  function loo(c,o,wrecked,rock,time,seat,seatX) {
    const {x,y,h}=o,art=looTile(wrecked,seat,seatX);
    c.save();c.globalAlpha*=.94;
    c.translate(x,y);if(rock>0)c.rotate(Math.sin(time*21)*.027*rock);
    c.drawImage(art,-h*.49,-h*1.13,h*1.024,h*1.28);
    if(!wrecked){glow(c,h*.294,-h*.74,h*.22,'243,189,101',.5);}
    c.restore();
  }
  function fragment(c,p) {
    c.save();c.scale(p.s,p.s);
    if(p.kind==='door') {
      const art=tile('door',256,512,128,256,500,t=>{t.translate(.02,.4);door(t);});
      c.drawImage(art,-.256,-.512,.512,1.024);
    } else if(p.kind==='roof') {
      const art=tile('roof',512,180,256,90,500,t=>{t.translate(-.02,.97);roof(t);});
      c.drawImage(art,-.512,-.18,1.024,.36);
    }
    else {
      poly(c,[[-.54,-.06],[-.44,-.1],[.5,-.08],[.44,-.01],[.54,.04],[.43,.09],[-.5,.075],[-.43,.02]],gradient(c,0,-.1,0,.1,['#b09b70','#756744','#423b2b']),'#24332a',.01);
      line(c,[[-.43,-.05],[.38,-.027]],'#d8bd8055',.013);line(c,[[-.36,.039],[.42,.058]],'#2b3021',.015);
      bolt(c,-.32,0,.023);
    }
    c.restore();
  }
  function puff(c,p) {
    const k=p.t/p.dur,opacity=Math.max(0,(1-k)*.55),r=p.r*(1+k*.85),color=p.c||'150,138,112';
    if(p.kind==='spark') {
      c.save();c.globalCompositeOperation='screen';line(c,[[p.x-p.vx*.025,p.y-p.vy*.025],[p.x,p.y]],`rgba(${color},${1-k})`,Math.max(.7,r*.55));ellipse(c,p.x,p.y,r*.45,r*.45,`rgba(255,244,199,${1-k})`);c.restore();return;
    }
    const g=c.createRadialGradient(p.x-r*.2,p.y-r*.2,0,p.x,p.y,r);g.addColorStop(0,`rgba(${color},${opacity})`);g.addColorStop(.55,`rgba(${color},${opacity*.65})`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(p.x-r,p.y-r,r*2,r*2);
  }
  function contact(c,tr,time,power) {
    const h=tr.look.size,x=tr.x,y=tr.y-h*.75;
    c.save();glow(c,x,y,h*1.3,'156,214,230',power*.5);
    for(let i=0;i<3;i++)arc(c,x-h*.5,y-h*.7+i*h*.55,x+h*.5,y-h*.4+i*h*.45,Math.floor(time*18)+i*42,power,Math.max(.7,h*.035));c.restore();
  }
  return {fence,loo,fragment,puff,contact,stats:()=>({tiles:cache.size,pixels:[...cache.values()].reduce((n,cv)=>n+cv.width*cv.height,0)})};
})();
