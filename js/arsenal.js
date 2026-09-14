'use strict';
/* Sector 7 armory. Solid, lit 3D hardware rendered into a bounded sprite cache.
   X points down the barrel, Y crosses the chassis, Z is height. The same
   projection supplies live muzzle anchors. No game state or random numbers
   are consumed by this renderer; lab pages can use it independently. */
const Arsenal = (() => {
  const TAU=Math.PI*2, GROUND=.72, HEIGHT=Math.sqrt(1-GROUND*GROUND);
  const SIZE=192, SCALE=2, AX=48, AY=63, DIRECTIONS=64, LIMIT=matchMedia('(pointer: coarse)').matches?192:384;
  const models=new Map(), sprites=new Map(), bases=new Map();
  let spriteBytes=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mod=(v,n)=>(v%n+n)%n;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  const M={steel:[104,121,127],edge:[174,190,192],dark:[32,43,48],black:[13,21,26],
    armor:[68,83,82],olive:[90,101,73],brass:[178,131,63],copper:[155,81,47],
    red:[131,42,34],white:[180,200,199],blue:[43,76,100],purple:[81,52,98],
    yellow:[207,156,57],rubber:[20,27,28],ice:[124,183,199],green:[65,102,49]};
  const catalog={
    gatling:{color:'#ffc266',rgb:[255,172,60],tiers:['Sentinel','Belt-fed Predator','Ironclad','Cerberus'],
      details:['Six-barrel rotary cannon','External drum & armored breech','Ballistic shield & reinforced barrel cage','Twin rotary banks & heavy feed system']},
    flamer:{color:'#ff8746',rgb:[255,109,33],tiers:['Firebreak','Hellhound','Inferno'],
      details:['Pressure-fed flame lance','Twin fuel tanks & burner shroud','Three-nozzle plasma burner & heat shields']},
    sniper:{color:'#7dcfff',rgb:[96,188,255],tiers:['Longwatch','Lancer','Tungsten'],
      details:['Stabilized precision rifle','Long barrel & capacitor rails','Open-rail accelerator & magnetic coils']},
    cryo:{color:'#a0efff',rgb:[119,222,255],tiers:['Coldfront','Permafrost','Absolute Zero'],
      details:['Cryogenic pressure cannon','Twin coolant reservoirs & vent fins','Containment rings & supercooled core']},
    tesla:{color:'#b19aff',rgb:[164,121,255],tiers:['Arc Tower','Storm Engine','Tempest'],
      details:['Copper induction stack','Twin induction stacks & capacitor bank','Three-coil lightning crown & reactor']},
    sonic:{color:'#dfacff',rgb:[206,140,255],tiers:['Resonator','Shock Array','Cataclysm'],
      details:['Armored acoustic projector','Twin resonance dishes','Three-dish pressure array & amplifiers']},
    missile:{color:'#ff8c74',rgb:[255,115,72],tiers:['Firehawk','Hydra','Apocalypse'],
      details:['Single homing launch rail','Twin armored launch pods','Triple salvo rack & blast baffles']},
    mortar:{color:'#efcf85',rgb:[255,183,68],tiers:['Earthshaker','Siegebreaker'],
      details:['Hydraulic siege mortar','Heavy-bore artillery & recoil outriggers']},
    extinction:{color:'#ffbf69',rgb:[255,177,72],tiers:['Prometheus','Sunbreaker','Extinction Engine'],
      details:['Contained-star launcher & four focusing jaws','Twin capacitor banks & six plasma lenses','Armored fusion reactor & eight containment petals']},
    gas:{color:'#b8ed7c',rgb:[152,223,78],tiers:['Venom','Miasma','Basilisk'],
      details:['Pressurized toxin disperser','Twin reservoirs & rotary atomizer','Triple reaction chambers & exhaust manifold']}
  };
  function info(key,lv=0){const d=catalog[key];lv=clamp(lv,0,d.tiers.length-1);return {name:d.tiers[lv],detail:d.details[lv],color:d.color};}
  function mesh(){
    const faces=[];
    function face(p,mat,lit=false){
      const n=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));
      for(let i=1;i<p.length-1;i++)faces.push({p:[p[0],p[i],p[i+1]],n,c:Array.isArray(mat)?mat:M[mat],lit});
    }
    // Chamfered armor plates: actual bevel faces, never a flat outlined box.
    function box(x,y,z,w,d,h,mat='armor',bevel=.65){
      const b=Math.min(bevel,w/3,d/3,h/3),a=w/2,c=d/2;
      const ring=(zz,shrink)=>[[-a+b,-c+shrink],[a-b,-c+shrink],[a-shrink,-c+b],[a-shrink,c-b],[a-b,c-shrink],[-a+b,c-shrink],[-a+shrink,c-b],[-a+shrink,-c+b]].map(p=>[p[0]+x,p[1]+y,zz]);
      const rings=[ring(z,b),ring(z+b,0),ring(z+h-b,0),ring(z+h,b)];
      face([...rings[0]].reverse(),mat);face(rings[3],mat);
      for(let j=0;j<3;j++)for(let i=0;i<8;i++){const k=(i+1)%8;face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],mat);}
    }
    function tube(a,b,r1,r2,mat='steel',sides=12,cap=true,lit=false){
      const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[2])>.9?[0,1,0]:[0,0,1])),v=cross(axis,u);
      const ring=(p,r)=>Array.from({length:sides},(_,i)=>p.map((q,k)=>q+r*(u[k]*Math.cos(i/sides*TAU)+v[k]*Math.sin(i/sides*TAU))));
      const p=ring(a,r1),q=ring(b,r2);
      for(let i=0;i<sides;i++){const j=(i+1)%sides;face([p[i],p[j],q[j],q[i]],mat,lit);}
      if(cap){face([...p].reverse(),mat,lit);face(q,mat,lit);}
    }
    function ring(x,y,z,r,thick,mat='copper',vertical=false){
      const n=20,m=6,pts=[];
      for(let i=0;i<n;i++)pts.push(Array.from({length:m},(_,j)=>{const a=i/n*TAU,b=j/m*TAU,R=r+Math.cos(b)*thick;return vertical?[x+Math.sin(b)*thick,y+Math.cos(a)*R,z+Math.sin(a)*R]:[x+Math.cos(a)*R,y+Math.sin(a)*R,z+Math.sin(b)*thick];}));
      for(let i=0;i<n;i++)for(let j=0;j<m;j++)face([pts[i][j],pts[(i+1)%n][j],pts[(i+1)%n][(j+1)%m],pts[i][(j+1)%m]],mat);
    }
    const glow=(a,b,r,color)=>tube(a,b,r,r,color,8,true,true);
    function bolt(x,y,z){tube([x,y,z],[x,y,z+.65],.8,.8,'edge',6);}
    function vents(x,y,z,n=4){for(let i=0;i<n;i++)box(x+i*1.7,y,z,.65,5,.25,'black',0);}
    function cable(pts,r=1,mat='rubber'){for(let i=1;i<pts.length;i++)tube(pts[i-1],pts[i],r,r,mat,7);}
    return {faces,face,box,tube,ring,glow,bolt,vents,cable};
  }
  function makeBase(key,lv){
    const m=mesh(),{box,tube,bolt,glow}=m,R=17+lv*1.3,col=catalog[key].rgb;
    tube([0,0,.2],[0,0,2.8],R+2,R+1,'dark',8);
    tube([0,0,2.8],[0,0,4],R+1,R-.2,'steel',8);
    tube([0,0,4],[0,0,4.7],R-1,R-1,'armor',8);
    for(const sx of [-1,1])for(const sy of [-1,1]){
      box(sx*(R-4),sy*(R-4),.1,7,7,2.4,'dark');bolt(sx*(R-4),sy*(R-4),2.6);
      if(lv>0){box(sx*(R-2),sy*(R-2),2.6,5,4,1.5,'steel');}
    }
    tube([0,0,4.8],[0,0,7],10+lv,10+lv,'black',24);
    tube([0,0,7],[0,0,8],9+lv,9+lv,'steel',24);
    for(let i=0;i<8;i++){const a=i/8*TAU;glow([Math.cos(a)*(R-3),Math.sin(a)*(R-3),4.9],[Math.cos(a+.14)*(R-3),Math.sin(a+.14)*(R-3),4.9],.45,col);}
    // Warning stripes, inset fasteners and a serial plate belong to the mount.
    for(const y of [-R+2,R-2])for(let i=-2;i<=2;i++)box(i*2.2,y,4.9,1.1,1.7,.12,i%2?'black':'yellow',0);
    if(key==='mortar')for(const y of [-1,1]){box(-7,y*20,1,20,5,3,'armor');tube([-4,y*9,9],[-10,y*20,3],1.4,1.4,'edge');}
    if(key==='extinction')for(const sx of [-1,1])for(const sy of [-1,1]){box(sx*17,sy*18,1,12,8,3,'dark');tube([sx*9,sy*8,10],[sx*20,sy*19,3],1.8,1.8,'steel');glow([sx*18,sy*19,4.2],[sx*22,sy*19,4.2],.55,col);}
    return m.faces;
  }
  function makeModel(key,lv,stage=0){
    const m=mesh(),{box,tube,ring,glow,bolt,vents,cable}=m,col=catalog[key].rgb;
    const full=lv===catalog[key].tiers.length-1,h=14+lv*.8;
    let muzzle=[26+lv*2,0,h],muzzles=[];
    const armor=full?'dark':'armor';
    tube([0,0,8],[0,0,12],7+lv,7+lv,'dark',16);
    box(-2,0,10,18+lv*2,15+lv*1.7,8,armor,1.2);
    box(-4,0,18,13,11,1.2,'steel');vents(-8,0,19.3,5);
    for(const y of [-1,1]){bolt(-7,y*5.4,19.4);glow([-1,y*7.8,13],[4,y*7.8,13],.55,col);}
    function barrel(x1,x2,y,z,r=2){tube([x1,y,z],[x2,y,z],r,r,'steel');tube([x2-.9,y,z],[x2+.4,y,z],r*1.18,r*1.18,'dark');tube([x2+.42,y,z],[x2+.5,y,z],r*.72,r*.72,'black');}
    function tank(x,y,z,r,len,mat){tube([x,y,z],[x,y,z+len],r,r,mat,16);tube([x,y,z+len],[x,y,z+len+1.5],r,r*.65,'edge',16);for(const zz of [z+1,z+len-1])tube([x,y,zz],[x,y,zz+.8],r+.3,r+.3,'dark',16);bolt(x,y,z+len+1.5);}
    if(key==='gatling'){
      const banks=lv===3?[-5,5]:[0],end=27+lv*2;
      box(-8,0,12,12,16+lv*2,10,armor);vents(-12,0,22.2,5);
      for(const yy of banks){
        tube([3,yy,h],[10,yy,h],4.8,4.8,'dark');
        for(let i=0;i<6;i++){const a=i/6*TAU;barrel(7,end,yy+Math.cos(a)*3,h+Math.sin(a)*3,.95);}
        for(const x of [12,end-4])tube([x,yy,h],[x+1.6,yy,h],4.5,4.5,'dark',12);
        tube([end-1,yy,h],[end+.1,yy,h],4.2,4.2,'steel',12);
        for(let i=0;i<6;i++){const a=i/6*TAU;tube([end+.12,yy+Math.cos(a)*2.6,h+Math.sin(a)*2.6],[end+.2,yy+Math.cos(a)*2.6,h+Math.sin(a)*2.6],.75,.75,'black',8);}
        muzzles.push([end+.3,yy,h]);
      }
      if(lv>=1){tube([-9,-12,h],[-1,-12,h],5,5,'brass',16);tube([-9,12,h],[-1,12,h],5,5,'dark',16);for(let i=0;i<6;i++)box(-5+i*1.2,-8,20,1,4,.8,'brass',.2);}
      if(lv>=2)for(const sy of [-1,1]){box(6,sy*(lv===3?11:7.5),10,4,5,16,armor);box(8.1,sy*(lv===3?11:7.5),20,1,5,2,'red');bolt(6,sy*(lv===3?11:7.5),26.1);}
      muzzle=muzzles[0];
    } else if(key==='sniper'){
      const end=32+lv*4;muzzle=[end+.5,0,h+1];
      box(0,0,12,24,9,8,'blue');barrel(8,end,0,h+1,lv===2?2:1.5);
      if(lv===0){box(29,0,h-1,7,5,5,'dark');tube([32.55,0,h+1],[32.65,0,h+1],1.2,1.2,'black');}
      if(lv>=1)for(const sy of [-1,1]){box(19,sy*3.2,h-1.5,24+lv*2,2,5,armor);glow([9,sy*3.25,h+3.6],[30+lv*3,sy*3.25,h+3.6],.55,col);}
      if(full){for(let i=0;i<4;i++)ring(12+i*6,0,h+1,4.5,.75,'copper',true);box(-10,0,11,9,19,11,'blue');for(const y of [-7,7])glow([-12,y,22.1],[-6,y,22.1],.7,col);}
      tube([-6,0,23],[8,0,23],2.2,2.2,'dark');glow([8.1,0,23],[8.3,0,23],1.45,col);box(-3,0,19,3,3,4,'steel');
    } else if(key==='flamer'){
      for(const y of (lv===0?[0]:[-8,8]))tank(-10,y,11,3.8,11,'red');
      const end=26+lv*2;muzzle=[end,0,h];
      tube([3,0,h],[end-3,0,h],3.7,4.8,'dark',12);
      for(let i=0;i<4;i++)ring(7+i*4,0,h,4.2,.55,'steel',true);
      tube([end-3,0,h],[end,0,h],5.5,4,'copper',12);tube([end+.05,0,h],[end+.15,0,h],3,3,'black');
      if(full){muzzles=[[-3,0],[2.4,-2.5],[2.4,2.5]].map(([y,dz])=>[end+1,y,h+dz]);for(const p of muzzles)glow(p,[p[0]+.1,p[1],p[2]],1.1,[125,213,255]);for(const y of [-1,1])box(6,y*7,11,19,2,10,'dark');}
      else glow([end+.2,0,h-2],[end+.3,0,h-2],.65,[255,164,48]);
      cable([[-10,-4,15],[-15,-8,9],[3,-7,10],[12,-4,h]],1.2);vents(-5,0,20,4);
    } else if(key==='cryo'){
      const end=25+lv*3;muzzle=[end,0,h+1];
      for(const y of (lv===0?[-8]:[-8,8])){tank(-9,y,9,3.5,13,'ice');glow([-9,y-3.55,13],[-9,y-3.55,19],.6,col);}
      tube([4,0,h+1],[end-2,0,h+1],4,5,'white',16);
      for(let i=0;i<3+lv;i++)ring(8+i*3.6,0,h+1,5+lv*.4,.6,'steel',true);
      tube([end-2,0,h+1],[end,0,h+1],5.8,5.1,'dark',16);glow([end+.1,0,h+1],[end+.2,0,h+1],3,col);
      if(full)for(const y of [-1,1]){box(10,y*7.5,10,25,2,12,'blue');for(let i=0;i<6;i++)box(1+i*3.3,y*8,22,1.1,3,3,'edge',.2);glow([0,y*8,16],[20,y*8,16],.6,col);}
    } else if(key==='tesla'){
      const towers=lv===0?[[0,0,31,7]]:lv===1?[[0,-8,33,5.8],[0,8,33,5.8]]:[[-5,-9,35,5.6],[-5,9,35,5.6],[7,0,42,7]];
      box(-2,0,11,22,23,7,'dark');
      for(const [x,y,z,r] of towers){
        tube([x,y,16],[x,y,z-3],2.2,2.2,'white',12);
        for(let zz=18;zz<z-4;zz+=2.3)ring(x,y,zz,3.3,.7,'copper');
        ring(x,y,z,r,1.6,'steel');tube([x,y,z-1],[x,y,z+1],r-1,r-1,'dark',20);
        ring(x,y,z+1,r-1,.5,'edge');glow([x,y,z],[x,y,z+2],1.8,col);
        for(const yy of [-1,1])cable([[x,y,17],[x-5,y+yy*3,12],[-10,yy*9,12]],.65,'copper');
      }
      for(const y of [-10,10]){tank(-10,y,10,2.5,8,'blue');glow([-10,y,19],[-10,y,20],1,col);}
      muzzle=[towers[towers.length-1][0],towers[towers.length-1][1],towers[towers.length-1][2]+2];muzzles=towers.map(([x,y,z])=>[x,y,z+2]);
    } else if(key==='missile'){
      const count=lv+1;box(-1,0,13,20,15+lv*5,5,armor);
      for(let i=0;i<count;i++){
        const y=(i-(count-1)/2)*9,z=h+3;
        box(3,y,z-4,29,8,9,armor,1);box(-10,y,z-3,3,9,9,'steel');
        for(const zz of [-2,2]){tube([17.55,y,z+zz],[17.65,y,z+zz],2,2,'black');tube([17.7,y,z+zz],[18.7,y,z+zz],1.1,.3,'white');}
        box(3,y,z+5.1,15,5,.6,'olive');box(11,y,z+5.8,2,5,.3,'red',0);
        for(const x of [-8,12])bolt(x,y,z+5.1);
        muzzles.push([19,y,z]);
      }
      if(full){box(-15,0,10,5,28,12,'dark');for(const y of [-11,11])glow([-17.6,y,17],[-17.6,y,19],.6,col);}
      muzzle=muzzles[0];
    } else if(key==='mortar'){
      const end=full?[19,0,32]:[14,0,27],start=[-5,0,12];muzzle=end;
      box(-5,0,9,22,23,6,'olive');tube(start,end,full?7:5.5,full?8:6,'dark',20);
      const tip=sub(end,start),last=end.map((v,i)=>v-tip[i]*.12);
      tube(last,end,full?9:7,full?9:7,'steel',20);tube(end,end.map((v,i)=>v+tip[i]*.005),full?6.3:4.9,full?6.3:4.9,'black',20);
      for(const y of [-1,1]){tube([-9,y*10,10],[7,y*8,23],1.6,1.6,'steel');tube([-9,y*10,10],[-1,y*9,17],2.5,2.5,'dark');box(-8,y*11,9,12,4,5,'armor');}
      if(full){for(let i=0;i<3;i++)tube([-14+i*4,-14,8],[-14+i*4,-14,17],1.6,1.6,'brass');box(-12,0,9,5,29,8,'armor');}
    } else if(key==='extinction'){
      const z=23+lv,end=35+lv*2,open=stage/4,petals=4+lv*2;
      muzzle=[end+1,0,z];
      box(-6,0,10,25,24+lv*2,11,'dark',1.5);box(-10,0,21,14,16,3,'steel');
      for(const side of [-1,1]){
        if(lv>0)tank(-12,side*(10+lv),13,3.4,12+lv*2,'blue');
        if(lv>0)glow([-15.5,side*(10+lv),16],[-15.5,side*(10+lv),24+lv*2],.75,[101,206,241]);
        box(-5,side*13,11,14,4,9,'dark');vents(-10,side*13,20.2,5);
        cable([[-12,side*(lv?11:4.5),22],[-3,side*12,21],[8,side*7,z]],1.15,'copper');
        tube([-5,side*10,12],[12,side*9,z-4],1.2,1.2,'edge');
      }
      if(!lv){tank(-14,0,13,5.2,14,'blue');for(const side of [-1,1])glow([-17,side*3.5,17],[-17,side*3.5,25],.65,[101,206,241]);}
      tube([0,0,z],[10,0,z],6.5,5.5,'steel',20);tube([9,0,z],[18,0,z],4.8,4.8,'black',20);
      for(let i=0;i<3+lv;i++){ring(4+i*4,0,z,6.5+lv*.3,.9,i%2?'copper':'steel',true);}
      for(let j=0;j<petals;j++){
        const a=j/petals*TAU+Math.PI/4,R=8+open*5+lv*.6,cs=Math.cos(a),sn=Math.sin(a),w=2.8;
        const point=(x,r,tan)=>[x,r*cs-tan*sn,z+r*sn+tan*cs];
        const p=[point(12,6,-w),point(end-2,R,-w),point(end,R+2,-w*.5),point(12,10,-w),point(12,6,w),point(end-2,R,w),point(end,R+2,w*.5),point(12,10,w)];
        for(const [ids,mat]of [[[0,1,2,3],'armor'],[[4,7,6,5],'steel'],[[0,4,5,1],'copper'],[[3,2,6,7],'steel'],[[1,5,6,2],'edge'],[[0,3,7,4],'dark']])m.face(ids.map(i=>p[i]),mat);
        glow(point(15,6.6,0),point(end-2,R-.2,0),.75,col);
        tube(point(9,7,0),point(19,R+1,0),.65,.65,'edge',8);
        if(lv>0){const a=point(10,12.4,0),b=point(16,12.4,0);tube(a,b,2,2,'dark',10);glow(a,b,.75,[111,201,232]);}
      }
      if(full){box(-16,0,10,7,31,17,'dark');for(const side of [-1,1]){box(-12,side*17,10,11,4,15,'armor');for(let i=0;i<4;i++)glow([-16+i*2,side*19.1,13],[-16+i*2,side*19.1,21],.4,col);}ring(-1,0,z,10,.8,'brass',true);}
    } else if(key==='gas'){
      const ys=lv===0?[0]:lv===1?[-6,6]:[-9,0,9];
      for(const y of ys){tank(-9,y,10,3.3,14,'green');glow([-9,y-3.4,14],[-9,y-3.4,20],.7,full?[194,130,255]:col);box(-9,y,24.5,3,3,1,'yellow');}
      const end=25+lv*2;muzzle=[end,0,h];tube([3,0,h],[end,0,h],3,5,'dark',12);
      for(let i=0;i<3+lv;i++)ring(6+i*4,0,h,3.6+i*.2,.65,'brass',true);
      tube([end+.1,0,h],[end+.2,0,h],3.4,3.4,'black');
      for(let i=0;i<5;i++){const a=i/5*TAU;glow([end+.25,Math.cos(a)*2.3,h+Math.sin(a)*2.3],[end+.3,Math.cos(a)*2.3,h+Math.sin(a)*2.3],.6,full?[194,130,255]:col);}
      if(full)for(const y of [-11,11]){tube([1,y,10],[1,y,25],2,2,'steel');tube([1,y,25],[4,y,25],2,2,'dark');}
      cable([[-9,-7,12],[-15,-11,9],[8,-7,11],[15,-3,h]],1.2);
    } else if(key==='sonic'){
      const count=lv+1;
      box(-3,0,12,20,20+lv*3,7,'purple');
      for(let i=0;i<count;i++){
        const y=(i-(count-1)/2)*10,z=23+(count===3&&i===1?7:0),r=count===1?9:6.5;
        tube([-4,y,17],[1,y,z],1.6,1.6,'steel');
        // Concave horns with recessed dark throats and real front/back faces.
        tube([0,y,z],[7,y,z],2,r,'steel',20,false);tube([.2,y,z],[7.1,y,z],1.5,r-.6,'dark',20,false);
        ring(7.15,y,z,r-.3,.7,'edge',true);glow([3,y,z],[4,y,z],1.6,col);
        muzzles.push([7.3,y,z]);
      }
      if(full)for(const y of [-13,13]){box(-7,y,10,10,4,15,'dark');for(let z=13;z<24;z+=3)glow([-10,y-2.1,z],[-5,y-2.1,z],.5,col);}
      muzzle=muzzles[Math.floor(count/2)];
    }
    return {faces:m.faces,muzzle,muzzles:muzzles.length?muzzles:[muzzle]};
  }
  function model(key,lv,stage=0){const id=key+lv+':'+stage;if(!models.has(id))models.set(id,makeModel(key,lv,stage));return models.get(id);}
  function heading(key,angle){return key==='tesla'?0:Math.atan2(Math.sin(angle)/GROUND,Math.cos(angle));}
  function project(p,a){const cs=Math.cos(a),sn=Math.sin(a),x=p[0]*cs-p[1]*sn,y=p[0]*sn+p[1]*cs;return [x,y*GROUND-p[2]*HEIGHT,y*HEIGHT+p[2]*GROUND];}
  function raster(faces,angle,SIZE=192){
    const SCALE=SIZE/96;
    const cv=document.createElement('canvas');cv.width=cv.height=SIZE;
    const c=cv.getContext('2d'),im=c.createImageData(SIZE,SIZE),pixels=im.data,depth=new Float32Array(SIZE*SIZE);depth.fill(-1e8);
    const cs=Math.cos(angle),sn=Math.sin(angle);
    for(const f of faces){
      const pts=f.p.map(p=>{const q=project(p,angle);return [(q[0]+AX)*SCALE,(q[1]+AY)*SCALE,q[2]];});
      const [a,b,d]=pts,den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(den)<.0001)continue;
      let nx=f.n[0]*cs-f.n[1]*sn,ny=f.n[0]*sn+f.n[1]*cs,nz=f.n[2];
      // Two-sided metal is deliberate for thin horn interiors. Depth is still
      // resolved per pixel, so no paper edges or intersecting belly-style flash.
      if(ny*HEIGHT+nz*GROUND<0){nx=-nx;ny=-ny;nz=-nz;}
      const diffuse=Math.max(0,-nx*.42-ny*.35+nz*.84),spec=Math.pow(Math.max(0,-nx*.24+ny*.20+nz*.95),18)*.55;
      const light=f.lit?1:.35+diffuse*.66;
      const rgb=f.c.map((v,i)=>clamp(v*light+spec*(i===0?145:163),0,255)|0);
      const minx=clamp(Math.floor(Math.min(a[0],b[0],d[0])),0,SIZE-1),maxx=clamp(Math.ceil(Math.max(a[0],b[0],d[0])),0,SIZE-1);
      const miny=clamp(Math.floor(Math.min(a[1],b[1],d[1])),0,SIZE-1),maxy=clamp(Math.ceil(Math.max(a[1],b[1],d[1])),0,SIZE-1);
      for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
        const u=((b[1]-d[1])*(x+.5-d[0])+(d[0]-b[0])*(y+.5-d[1]))/den;
        const v=((d[1]-a[1])*(x+.5-d[0])+(a[0]-d[0])*(y+.5-d[1]))/den,w=1-u-v;
        if(u<-.0001||v<-.0001||w<-.0001)continue;
        const z=u*a[2]+v*b[2]+w*d[2],idx=y*SIZE+x;if(z<=depth[idx])continue;depth[idx]=z;
        const off=idx*4;pixels[off]=rgb[0];pixels[off+1]=rgb[1];pixels[off+2]=rgb[2];pixels[off+3]=255;
      }
    }
    c.putImageData(im,0,0);return cv;
  }
  function sprite(key,lv,angle,stage=0){
    const dir=mod(Math.round(heading(key,angle)/TAU*DIRECTIONS),DIRECTIONS),id=key+lv+':'+dir+':'+stage;
    if(sprites.has(id)){const cv=sprites.get(id);sprites.delete(id);sprites.set(id,cv);return cv;}
    const cv=raster(model(key,lv,stage).faces,dir/DIRECTIONS*TAU,key==='extinction'?384:192);sprites.set(id,cv);
    spriteBytes+=cv.width*cv.height*4;
    while(sprites.size>LIMIT||spriteBytes>LIMIT*SIZE*SIZE*4){const first=sprites.keys().next().value,old=sprites.get(first);spriteBytes-=old.width*old.height*4;sprites.delete(first);}return cv;
  }
  function anchor(t,index=0,recoil=false){
    const m=model(t.key,t.ulv||0),a=heading(t.key,t.angle||0),p=m.muzzles[mod(index,m.muzzles.length)].slice();
    if(recoil)p[0]-=(t.recoil||0)*2.2;
    const q=project(p,a);return {x:t.x+q[0],y:t.y+q[1],angle:t.angle||0};
  }
  const glows=new Map();
  function haze(c,x,y,r,rgb,alpha){
    if(r<=0||alpha<=0)return;const key=rgb.join(',');let cv=glows.get(key);
    if(!cv){cv=document.createElement('canvas');cv.width=cv.height=64;const gc=cv.getContext('2d'),g=gc.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,`rgb(${key})`);g.addColorStop(.35,`rgba(${key},.55)`);g.addColorStop(1,`rgba(${key},0)`);gc.fillStyle=g;gc.fillRect(0,0,64,64);glows.set(key,cv);if(glows.size>64)glows.delete(glows.keys().next().value);}
    const a=c.globalAlpha;c.globalAlpha=a*clamp(alpha,0,1);c.drawImage(cv,x-r,y-r,r*2,r*2);c.globalAlpha=a;
  }
  function base(c,x,y,key,selected,lv=0){
    const id=key+lv;if(!bases.has(id))bases.set(id,raster(makeBase(key,lv),0,key==='extinction'?384:192));
    c.save();c.fillStyle='rgba(0,5,8,.46)';c.beginPath();c.ellipse(x+3,y+3,23+lv,17+lv,0,0,TAU);c.fill();
    c.drawImage(bases.get(id),x-AX,y-AY,SIZE/SCALE,SIZE/SCALE);
    if(selected){c.strokeStyle='#ffdb82';c.lineWidth=1.6;c.beginPath();c.ellipse(x,y,25+lv,19+lv,0,0,TAU);c.stroke();}
    const mastery=typeof masteryTier==='function'?masteryTier(key):0;
    if(mastery){const color=['','#bd8b57','#d7e2e9','#ffda78'][mastery];c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.ellipse(x,y,25+lv,19+lv,0,0,TAU);c.stroke();}
    // Upgrade stripes remain legible on a phone, without covering the model.
    for(let i=0;i<lv;i++){c.fillStyle='#f6cf76';c.fillRect(x-(lv*4-1)/2+i*4,y+17+lv,3,1.5);}
    c.restore();
  }
  function turret(c,t,flash,time=0){
    const lv=t.ulv||0,mt=model(t.key,lv),a=heading(t.key,t.angle||0),rec=(t.recoil||0)*2.2;
    const q=project([-rec,0,0],a),color=catalog[t.key].rgb,full=lv===catalog[t.key].tiers.length-1;
    c.save();
    const stage=t.key==='extinction'?Math.round(clamp(t.novaCharge||0,0,1)*4):0;
    c.drawImage(sprite(t.key,lv,t.angle||0,stage),t.x-AX+q[0],t.y-AY+q[1],SIZE/SCALE,SIZE/SCALE);
    if(t.key==='extinction')Extinction.turret(c,t,time);
    const p=anchor(t,0,true),charge=1-clamp((t.cd||0)/(t.cdMax||1),0,1);
    if(['tesla','cryo','sonic'].includes(t.key)){
      const power=.13+charge*.20+(flash>0?.28:0);
      for(const v of mt.muzzles){const pp=project([v[0]-rec,v[1],v[2]],a);haze(c,t.x+pp[0],t.y+pp[1],full?11:8,color,power);}
    }
    if(t.key==='tesla'){
      const ps=mt.muzzles.map(v=>{const pp=project(v,a);return [t.x+pp[0],t.y+pp[1]];});
      if(ps.length>1){c.strokeStyle=`rgba(185,175,255,${.25+charge*.4})`;c.lineWidth=.7;c.beginPath();for(let i=1;i<ps.length;i++){c.moveTo(...ps[i-1]);const [x,y]=ps[i],pr=ps[i-1];c.lineTo((x+pr[0])/2+Math.sin(time*19+i)*2,(y+pr[1])/2-3);c.lineTo(x,y);}c.stroke();}
    }
    if(t.key==='gatling'){
      // The moving hub is a volume-facing ellipse, projected from the barrel.
      for(const m of mt.muzzles)for(let i=0;i<3;i++){const sp=(t.spin||0)+i*TAU/3,v=[m[0]+.25,m[1]+Math.cos(sp)*2,m[2]+Math.sin(sp)*2],pp=project(v,a);c.fillStyle='#b2b9b1';c.fillRect(t.x+pp[0]+q[0]-.45,t.y+pp[1]+q[1]-.45,.9,.9);}
    }
    if(flash>0&&['gatling','sniper','mortar','missile'].includes(t.key)){
      for(let i=0;i<mt.muzzles.length;i++){
        const mp=anchor(t,i,true);c.save();c.translate(mp.x,mp.y);c.rotate(t.angle||0);
        haze(c,2,0,t.key==='mortar'?26:18,color,Math.min(.65,flash*6));
        c.globalCompositeOperation='lighter';c.fillStyle='#ffbf52';c.beginPath();c.moveTo(-1,-2);c.lineTo(6,-4);c.lineTo(4,-1.3);c.lineTo(15+lv*2,0);c.lineTo(5,1.6);c.lineTo(7,4);c.lineTo(-1,2);c.fill();
        c.fillStyle='#fff6d2';c.beginPath();c.moveTo(0,-1);c.lineTo(9+lv,0);c.lineTo(0,1);c.fill();c.restore();
      }
    }
    c.restore();
  }
  function preview(cv,key,lv=0,angle=-.45){const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);c.save();const scale=Math.min(cv.width/87,cv.height/64);c.translate(cv.width/2,cv.height*.74);c.scale(scale,scale);base(c,0,0,key,false,lv);turret(c,{key,ulv:lv,x:0,y:0,angle},0,0);c.restore();}
  return {catalog,info,base,turret,anchor,preview,haze,project,heading,model,
    get cacheBytes(){return spriteBytes+[...bases.values()].reduce((n,c)=>n+c.width*c.height*4,0);},get cachedSprites(){return sprites.size;},cacheLimit:LIMIT};
})();
