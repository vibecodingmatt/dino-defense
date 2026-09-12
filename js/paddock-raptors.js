'use strict';
/* Articulated, volumetric paddock residents. Meshes are lit and projected into
   a bounded, lazy sprite atlas: no WebGL context or per-frame triangle work.
   X is forward, Y is height, Z is across the body. The camera looks down at
   the same ground plane used by the patrol and its planted feet. */
const PaddockRaptors = (() => {
  const TAU=Math.PI*2, GROUND=.62, HEIGHT=Math.sqrt(1-GROUND*GROUND);
  const DIRECTIONS=32, FRAMES=16, CW=128, CH=96, SCALE=30, AX=64, AY=64;
  const FOOT_STRIDE=.65/.62; // stance travel divided by its fraction of a cycle
  const atlas=document.createElement('canvas');atlas.width=CW*DIRECTIONS;atlas.height=CH*(FRAMES+1);
  const ac=atlas.getContext('2d'), cached=new Set(), models=new Map();
  const mod=(x,n)=>(x%n+n)%n;
  const palette={skin:[104,111,84],back:[75,88,66],belly:[151,147,111],stripe:[52,78,70],
    edge:[111,144,126],claw:[45,44,33],mouth:[35,36,27],tooth:[204,199,158],eye:[219,155,53],pupil:[9,14,8]};

  // Distance is integrated from a short acceleration/deceleration ramp. A
  // complete circuit has an integer number of strides, so both feet settle
  // on the ground for the inspection pause without a phase jump.
  function patrol(time,cfg) {
    const {cx,cy,half,radius,size,speed,hold}=cfg;
    const stride=size*FOOT_STRIDE;
    const steps=Math.max(Math.ceil(TAU*radius/stride)+1,Math.round((half*4+TAU*radius)/stride));
    // Adjust the straight by a few pixels to fit whole, natural strides;
    // changing stride length independently would make planted feet skate.
    const length=steps*stride,straight=(length-TAU*radius)/2,runHalf=straight/2,ramp=.34;
    const moving=length/speed+ramp, t=mod(time,moving+hold);
    let distance,velocity;
    if(t<ramp){distance=speed*t*t/(2*ramp);velocity=speed*t/ramp;}
    else if(t<moving-ramp){distance=speed*(t-ramp/2);velocity=speed;}
    else if(t<moving){const left=moving-t;distance=length-speed*left*left/(2*ramp);velocity=speed*left/ramp;}
    else{distance=length;velocity=0;}
    let d=Math.min(distance,length),x,z,heading;
    if(d<straight){x=cx-runHalf+d;z=radius;heading=0;}
    else if((d-=straight)<Math.PI*radius){const angle=Math.PI/2-d/radius;x=cx+runHalf+radius*Math.cos(angle);z=radius*Math.sin(angle);heading=angle-Math.PI/2;}
    else if((d-=Math.PI*radius)<straight){x=cx+runHalf-d;z=-radius;heading=-Math.PI;}
    else{d-=straight;const angle=-Math.PI/2-d/radius;x=cx-runHalf+radius*Math.cos(angle);z=radius*Math.sin(angle);heading=angle-Math.PI/2;}
    return {x,y:cy+z*GROUND,size,heading,phase:distance/stride*TAU,speed:velocity,
      stride,walking:velocity>.3,alpha:1};
  }
  function states(time) {
    const near=patrol(time,{cx:512,cy:250,half:38,radius:25,size:31,speed:32,hold:1.5});
    const far=patrol(time+4.1,{cx:514,cy:211,half:26,radius:18,size:24,speed:26,hold:2.7});
    far.alpha=.82;
    const hidden=mod(time+4,43),local=hidden-26;
    const third=patrol(Math.max(0,local),{cx:473,cy:189,half:8,radius:10,size:21,speed:14,hold:2.2});
    third.alpha=local>0&&local<10?Math.min(1,local/1.1,(10-local)/1.1)*.75:0;
    return [near,far,third];
  }

  function footPose(phase,side) {
    const u=mod(phase/TAU+(side<0?.5:0),1),stance=.62;
    if(u<stance)return {x:.32-u/stance*.65,lift:0};
    const v=(u-stance)/(1-stance);
    return {x:-.33+.65*(v*v*(3-2*v)),lift:Math.sin(v*Math.PI)*.22};
  }

  function mesh(phase,idle) {
    const faces=[],bob=idle?0:Math.sin(phase*2)*.017;
    function tri(a,b,c,material,texture=0){faces.push({p:[a,b,c],material,texture});}
    function skinMaterial(x,y,z) {
      // Pigmentation belongs to the resting body, not its animated height.
      // Sampling the bobbed vertices made a row of bright flank scales turn
      // into dark stripes twice per stride, visibly flashing the abdomen.
      y-=bob;
      if(y<.51)return 'belly';
      if(Math.abs(z)>.14 && y>.64 && y<.735)return 'stripe';
      if(Math.abs(z)>.14 && y>.735 && y<.765)return 'edge';
      return y>.84?'back':'skin';
    }
    function ellipsoid(center,radii,material,segments=12,rings=8) {
      const rows=[];
      for(let j=0;j<=rings;j++){
        const lat=-Math.PI/2+j*Math.PI/rings,row=[];
        for(let i=0;i<segments;i++){
          const a=i/segments*TAU;
          row.push([center[0]+Math.cos(lat)*Math.cos(a)*radii[0],center[1]+Math.sin(lat)*radii[1],center[2]+Math.cos(lat)*Math.sin(a)*radii[2]]);
        }rows.push(row);
      }
      for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
        const n=(i+1)%segments,a=rows[j][i],b=rows[j][n],c=rows[j+1][n],d=rows[j+1][i];
        const mat=typeof material==='function'?material((a[0]+c[0])/2,(a[1]+c[1])/2,(a[2]+c[2])/2):material;
        tri(a,b,c,mat,(i*17+j*13)%9);tri(a,c,d,mat,(i*17+j*13)%9);
      }
    }
    function tube(a,b,r1,r2,material,sides=8) {
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz)||1,axis=[dx/L,dy/L,dz/L];
      let u=Math.abs(axis[1])<.9?[-axis[2],0,axis[0]]:[axis[1],-axis[0],0];
      const ul=Math.hypot(...u);u=u.map(v=>v/ul);
      const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]],rows=[[],[]];
      for(let i=0;i<sides;i++)for(let j=0;j<2;j++){
        const p=j?b:a,r=j?r2:r1,th=i/sides*TAU;
        rows[j].push(p.map((q,k)=>q+r*(Math.cos(th)*u[k]+Math.sin(th)*v[k])));
      }
      for(let i=0;i<sides;i++){
        const n=(i+1)%sides;tri(rows[0][i],rows[0][n],rows[1][n],material);tri(rows[0][i],rows[1][n],rows[1][i],material);
        tri(a,rows[0][n],rows[0][i],material);tri(b,rows[1][i],rows[1][n],material);
      }
    }
    function sweep(stations,material,sides=12) {
      const rows=stations.map(([x,y,z,ry,rz])=>Array.from({length:sides},(_,i)=>{
        const a=i/sides*TAU;return [x,y+Math.cos(a)*ry,z+Math.sin(a)*rz];
      }));
      for(let j=0;j<rows.length-1;j++)for(let i=0;i<sides;i++){
        const n=(i+1)%sides;tri(rows[j][i],rows[j][n],rows[j+1][n],material,(i+j)%5);tri(rows[j][i],rows[j+1][n],rows[j+1][i],material,(i+j)%5);
      }
      for(const j of [0,rows.length-1])for(let i=0;i<sides;i++)tri(stations[j].slice(0,3),rows[j][i],rows[j][(i+1)%sides],material);
    }
    ellipsoid([-.12,.70+bob,0],[.50,.245,.205],skinMaterial,16,10);
    ellipsoid([-.32,.61+bob,0],[.23,.245,.23],'skin',12,8);
    // The tail is a tapered volume with a small traveling lateral flex.
    sweep([[-.40,.74+bob,0,.15,.16],[-.74,.65+bob,.015,.105,.095],[-1.10,.62,.028+Math.sin(phase-.7)*.018,.067,.054],
      [-1.47,.65,.045+Math.sin(phase-1.2)*.035,.034,.025],[-1.88,.73,.08+Math.sin(phase-1.8)*.048,.004,.003]],'back');
    tube([.21,.76+bob,0],[.49,1.045+bob,0],.17,.12,'skin',12);
    ellipsoid([.44,.95+bob,0],[.16,.23,.135],'skin',12,8);
    const headY=(idle?.06:0)+bob;
    sweep([[.48,1.095+headY,0,.11,.11],[.65,1.16+headY,0,.14,.145],[.87,1.14+headY,0,.095,.115],[1.13,1.095+headY,0,.055,.09]],'skin');
    sweep([[.61,1.008+headY,0,.043,.105],[.9,1.015+headY,0,.031,.091],[1.115,1.035+headY,0,.017,.078]],'belly');
    for(const side of [-1,1]){
      tube([.73,1.06+headY,side*.114],[1.12,1.065+headY,side*.09],.008,.006,'mouth',5);
      ellipsoid([.69,1.205+headY,side*.133],[.066,.043,.017],'back',8,6);
      ellipsoid([.70,1.208+headY,side*.146],[.031,.024,.010],'eye',8,6);
      ellipsoid([.71,1.208+headY,side*.154],[.009,.021,.004],'pupil',6,4);
      ellipsoid([1.065,1.12+headY,side*.088],[.017,.009,.004],'mouth',6,4);
      for(let i=0;i<4;i++)tube([.84+i*.069,1.061+headY,side*.086],[.848+i*.069,1.041+headY,side*.084],.013,0,'tooth',4);
      // Foot moves backwards relative to the body during stance, at exactly
      // the root's forward speed. It lifts only for the forward recovery.
      const foot=footPose(phase,side),fx=foot.x,lift=foot.lift;
      const z=side*.205,hip=[-.25,.63+bob,z],knee=[.045,.35+lift*.45,z*1.13],hock=[fx-.12,.135+lift,z*1.25],toe=[fx,.03+lift,z*1.32];
      tube(hip,knee,.115,.067,'skin',10);ellipsoid(hip,[.145,.19,.115],'skin',10,7);
      tube(knee,hock,.052,.025,'back');tube(hock,toe,.028,.016,'belly',6);
      for(let i=-1;i<=1;i++){
        const end=[fx+.15-Math.abs(i)*.035,.02+lift,z*1.32+i*.043];
        tube(toe,end,.014,.007,'belly',5);tube(end,[end[0]+.047,end[1]-.006,end[2]],.009,.001,'claw',5);
      }
      const claw=[fx+.045,.14+lift,z*1.32-side*.055];
      tube(toe,claw,.023,.017,'claw',6);tube(claw,[fx+.11,.16+lift,claw[2]],.017,.007,'claw',6);tube([fx+.11,.16+lift,claw[2]],[fx+.13,.09+lift,claw[2]],.007,.001,'claw',5);
      const shoulder=[.23,.78+bob,side*.165],elbow=[.31,.50+bob,side*.24],wrist=[.51,.53+bob,side*.27];
      tube(shoulder,elbow,.047,.025,'skin');tube(elbow,wrist,.025,.015,'belly',6);
      for(let i=-1;i<=1;i++){const tip=[.62,.51+bob,side*.27+i*.031];tube(wrist,tip,.011,.007,'skin',5);tube(tip,[.64,.455+bob,tip[2]],.008,.001,'claw',5);}
    }
    return faces;
  }
  function drawPose(c,heading,phase,idle) {
    const frame=idle?FRAMES:mod(Math.round(phase/TAU*FRAMES),FRAMES);
    if(!models.has(frame))models.set(frame,mesh(frame/FRAMES*TAU,idle));
    const cs=Math.cos(heading),sn=Math.sin(heading);
    const rotate=p=>[p[0]*cs-p[2]*sn,p[1],p[0]*sn+p[2]*cs];
    const faces=models.get(frame).map(f=>{
      const p=f.p.map(rotate),depth=p.reduce((sum,v)=>sum+v[1]*GROUND+v[2]*HEIGHT,0)/3;
      return {p,depth,material:f.material,texture:f.texture};
    }).sort((a,b)=>a.depth-b.depth);
    for(const f of faces){
      const [a,b,d]=f.p,u=b.map((n,i)=>n-a[i]),v=d.map((n,i)=>n-a[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
      // Some joined surfaces have opposite winding. Orient their normals to
      // the visible side before lighting, then use consistent world-space sun.
      const faceSign=(n[1]*GROUND+n[2]*HEIGHT)<0?-1:1;
      const light=Math.max(0,(-n[0]*.42+n[1]*.77+n[2]*.48)*faceSign/len);
      const k=.57+light*.47+(f.texture-4)*.006,base=palette[f.material];
      const color=`rgb(${Math.min(255,base[0]*k)|0},${Math.min(255,base[1]*k)|0},${Math.min(255,base[2]*k)|0})`;
      c.fillStyle=color;c.strokeStyle=color;c.lineWidth=.35;c.lineJoin='round';c.beginPath();
      for(let i=0;i<3;i++){const p=f.p[i],x=AX+p[0]*SCALE,y=AY+(p[2]*GROUND-p[1]*HEIGHT)*SCALE;i?c.lineTo(x,y):c.moveTo(x,y);}
      c.closePath();c.fill();c.stroke();
    }
  }
  function cell(heading,phase,walking) {
    const dir=mod(Math.round(heading/TAU*DIRECTIONS),DIRECTIONS),frame=walking?mod(Math.round(phase/TAU*FRAMES),FRAMES):FRAMES;
    const key=dir*(FRAMES+1)+frame,x=dir*CW,y=frame*CH;
    if(!cached.has(key)){
      ac.save();ac.beginPath();ac.rect(x,y,CW,CH);ac.clip();ac.translate(x,y);
      drawPose(ac,dir/DIRECTIONS*TAU,frame/FRAMES*TAU,!walking);ac.restore();cached.add(key);
    }
    return {x,y};
  }
  function draw(c,a) {
    if(a.alpha<=.001)return;
    c.save();c.globalAlpha*=a.alpha;
    // Ground shadows rotate with the volume and retain width head-on.
    const cs=Math.cos(a.heading),sn=Math.sin(a.heading),shadowLength=Math.hypot(cs,sn*GROUND);
    c.save();c.translate(a.x-.22*cs*a.size,a.y-.22*sn*GROUND*a.size);c.rotate(Math.atan2(sn*GROUND,cs));
    c.fillStyle='rgba(0,5,2,.30)';c.beginPath();c.ellipse(0,1,a.size*.97*shadowLength,a.size*.19,0,0,TAU);c.fill();c.restore();
    const sprite=cell(a.heading,a.phase,a.walking),scale=a.size/SCALE;
    c.drawImage(atlas,sprite.x,sprite.y,CW,CH,a.x-AX*scale,a.y-AY*scale,CW*scale,CH*scale);
    c.restore();
  }
  return {draw,states,patrol,footPose,drawPose,GROUND,get cachedPoses(){return cached.size;},get atlasBytes(){return atlas.width*atlas.height*4;}};
})();
