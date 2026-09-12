'use strict';
/* Shared visitor models. Authored cross-section surfaces, articulated limbs and
   material lighting are rendered into bounded sprite caches. World positions,
   story beats and animation clocks belong to game.js; drawing is read-only.
   Coordinates: +X forward, +Y up, +Z left, 1.75 units per standing adult. */
const Tourists = (() => {
  const TAU=Math.PI*2, source=document.createElement('canvas');
  const gl=source.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
  const models=new Map(),sprites=new Map(),MAX_MODELS=24,MAX_SPRITES=192,MAX_PIXELS=4194304;
  let program,loc={},lost=false,error='',draws=0,spritePixels=0;
  const fields=['hero','kid','tall','build','skin','shirt','underC','vestC','neckwear','longSleeve','bottom','bottomType','hairStyle','hairC','hat','hatC','hatBand','hatLost','shoeC','glasses','mustache','beard','belly','floral','pack','packC','camera','holdItem','cane','tie','balloon','balloonC','arms','shock'];
  const rgb=h=>{h=(h||'#b7ab94').replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
  const mul=(a,k)=>a.map(v=>Math.min(1,v*k));
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const VS=`precision highp float;
    attribute vec3 aPosition,aNormal,aColor;attribute float aBone,aMaterial;
    uniform mat4 uBones[16];uniform float uYaw;varying vec3 vNormal,vColor,vRest;varying float vMaterial,vBone;
    void main(){mat4 b=uBones[int(aBone)];vec3 p=(b*vec4(aPosition,1.)).xyz,n=normalize(mat3(b)*aNormal);
      float c=cos(uYaw),s=sin(uYaw);vec3 q=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);
      vNormal=vec3(n.x*c+n.z*s,n.y,-n.x*s+n.z*c);vColor=aColor;vRest=aPosition;vMaterial=aMaterial;vBone=aBone;
      gl_Position=vec4(q.x/1.35,(q.y*.974-q.z*.225-1.07)/1.35,-(q.y*.225+q.z*.974)*.3,1.);}`;
  const FS=`precision highp float;varying vec3 vNormal,vColor,vRest;varying float vMaterial,vBone;uniform float uWound,uBurn;
    float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    void main(){vec3 n=normalize(vNormal),color=vColor;float mat=vMaterial;
      float grain=hash(floor(vRest*790.)),broad=sin(vRest.y*57.+sin(vRest.z*43.)*.4);
      // Costume fabrics retain their patterns as the articulated surface moves.
      if(mat>7.5&&mat<8.5){float stripe=fract(vRest.y*28.);if(stripe<.13)color=vec3(.39,.24,.19);else if(stripe<.20)color=vec3(.25,.32,.30);else if(stripe>.87)color=vec3(.52,.43,.26);mat=2.;}
      if(mat>8.5&&mat<9.5){float stripe=.5+.5*cos(vRest.z*410.);color=mix(color,vec3(.40,.47,.49),pow(stripe,8.)*.23);mat=2.;}
      if(mat>9.5&&mat<10.5){vec2 tile=fract(vec2(vRest.y*61.,vRest.z*77.));float diamond=abs(tile.x-.5)+abs(tile.y-.5);color=mix(color,vec3(.72,.61,.39),1.-smoothstep(.18,.26,diamond));mat=2.;}
      if(mat>10.5&&mat<11.5){float dirt=sin(vRest.y*37.+sin(vRest.z*53.))*sin(vRest.x*31.+vRest.z*29.);color=mix(color,vec3(.31,.27,.21),smoothstep(-.2,.65,dirt)*.68);mat=2.;}
      float spec=.055,rough=30.;
      if(mat<1.5){color*=.965+grain*.07;color+=vec3(.022,-.006,-.008)*(1.-abs(n.z));spec=.1;rough=34.;}
      else if(mat<3.5){float weave=sin(vRest.y*1100.)*sin((vRest.x+vRest.z)*1200.);color*=.94+weave*.023+grain*.04+broad*.024;spec=mat>2.5?.28:.025;rough=mat>2.5?58.:12.;}
      else if(mat<4.5){color*=.94+grain*.04+sin(vRest.y*380.+vRest.z*150.)*.025;spec=.1;rough=48.;}
      else if(mat<5.5){color*=.91+grain*.1;spec=.17;rough=38.;}
      else if(mat<6.5){spec=.62;rough=70.;}
      else {spec=.75;rough=100.;}
      if(uWound>0.&&vBone<.5&&mat>1.5&&mat<3.5&&vRest.x>.03){
        float edge=length(vec2((vRest.y-.17)*7.,vRest.z*5.6))+sin(vRest.y*143.+vRest.z*86.)*.09;
        if(edge<1.12){color*=.48;if(edge<1.){float tissue=.5+.5*sin(vRest.y*221.+sin(vRest.z*154.)*2.);color=mix(vec3(.21,.008,.02),vec3(.56,.065,.094),tissue*.68);color+=vec3(.13,.066,.052)*pow(tissue,9.);}spec=.38;}
      }
      float diffuse=max(0.,dot(n,normalize(vec3(-.35,.85,.7))));
      float rim=pow(1.-abs(dot(n,vec3(0.,.225,.974))),3.);
      vec3 light=color*(.37+diffuse*.79)+vec3(.11,.15,.17)*rim*.26;
      light+=pow(max(0.,dot(n,normalize(vec3(-.16,.7,.83)))),rough)*spec;
      if(mat<1.5)light+=vec3(.085,.021,.013)*max(0.,dot(-n,normalize(vec3(-.35,.85,.7))));
      if(uBurn>0.)light=mix(light,vec3(.15,.12,.1),uBurn*.88)+vec3(1.,.58,.19)*max(0.,1.-uBurn*2.);
      gl_FragColor=vec4(clamp(light,0.,1.),1.);}`;
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  if(gl)try{program=gl.createProgram();const v=shader(gl.VERTEX_SHADER,VS),f=shader(gl.FRAGMENT_SHADER,FS);gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(v);gl.deleteShader(f);
    for(const n of ['aPosition','aNormal','aColor','aBone','aMaterial'])loc[n]=gl.getAttribLocation(program,n);
    for(const n of ['uBones','uYaw','uWound','uBurn'])loc[n]=gl.getUniformLocation(program,n);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  }catch(e){error=e.message;}
  source.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;sprites.clear();spritePixels=0;});
  // A lost context uses the complete Canvas poses until the next page load.
  const available=()=>!!gl&&!!program&&!lost&&!error;

  function build(u,seated){
    const vertices=[],skin=rgb(u.skin),shirt=rgb(u.shirt),pants=rgb(u.bottom),hair=rgb(u.hairC),shoe=rgb(u.shoeC||'#333038');
    const bw=u.build||1,coat=u.hero==='nedry',safari=u.hero==='muldoon',linen=u.hero==='hammond',tim=u.hero==='timmy',lawyer=u.hero==='gennaro',cloth=coat?3:lawyer?9:tim?11:2;
    function tri(a,b,c,na,nb,nc,col,mat,bone){for(const [p,n] of [[a,na],[b,nb],[c,nc]])vertices.push(...p,...n,...col,bone,mat);}
    // A ring is [height, fore/aft radius, width, forward offset]. Small
    // continuous folds sit in the surface itself; no floating wrinkle tubes.
    function loft(rings,col,mat,bone,segments=20,fold=0,opening=0,shape=null){
      const rows=rings.map((r,j)=>Array.from({length:segments},(_,i)=>{const a=i/segments*TAU,w=1+fold*Math.sin(a*7+j*1.7)*Math.sin(Math.PI*j/(rings.length-1)),p=[(r[3]||0)+Math.cos(a)*r[1]*w,r[0],Math.sin(a)*r[2]*w];return shape?shape(p,a,j):p;}));
      const normals=rows.map((row,j)=>row.map((p,i)=>{const a=sub(row[(i+1)%segments],row[(i+segments-1)%segments]),b=sub(rows[Math.min(rows.length-1,j+1)][i],rows[Math.max(0,j-1)][i]);return norm(cross(b,a));}));
      for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){if(opening&&Math.cos((i+.5)/segments*TAU)>Math.cos(opening))continue;const k=(i+1)%segments;tri(rows[j][i],rows[j+1][i],rows[j][k],normals[j][i],normals[j+1][i],normals[j][k],col,mat,bone);tri(rows[j][k],rows[j+1][i],rows[j+1][k],normals[j][k],normals[j+1][i],normals[j+1][k],col,mat,bone);}
      if(!opening)for(const j of [0,rows.length-1]){const n=[0,j?1:-1,0],p=[rings[j][3]||0,rings[j][0],0];for(let i=0;i<segments;i++)tri(p,rows[j][i],rows[j][(i+1)%segments],n,n,n,col,mat,bone);}
    }
    function ell(p,r,col,mat,bone,seg=16,steps=10){
      const point=(a,b)=>[p[0]+r[0]*Math.sin(b)*Math.cos(a),p[1]+r[1]*Math.cos(b),p[2]+r[2]*Math.sin(b)*Math.sin(a)];
      const normal=v=>norm(v.map((x,i)=>(x-p[i])/(r[i]*r[i])));
      for(let j=0;j<steps;j++)for(let i=0;i<seg;i++){const a=i/seg*TAU,b=(i+1)/seg*TAU,y=j/steps*Math.PI,z=(j+1)/steps*Math.PI;const q=[point(a,y),point(a,z),point(b,z),point(b,y)],n=q.map(normal);tri(q[0],q[1],q[2],n[0],n[1],n[2],col,mat,bone);tri(q[0],q[2],q[3],n[0],n[2],n[3],col,mat,bone);}
    }
    function tube(a,b,r1,r2,col,mat,bone,seg=10){const axis=norm(sub(b,a)),right=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),up=cross(axis,right);
      const radial=i=>right.map((v,k)=>v*Math.cos(i/seg*TAU)+up[k]*Math.sin(i/seg*TAU));
      for(let i=0;i<seg;i++){const n=radial(i),m=radial(i+1),p=a.map((v,k)=>v+n[k]*r1),q=b.map((v,k)=>v+n[k]*r2),r=b.map((v,k)=>v+m[k]*r2),s=a.map((v,k)=>v+m[k]*r1);tri(p,q,r,n,n,m,col,mat,bone);tri(p,r,s,n,m,m,col,mat,bone);tri(a,s,p,axis.map(v=>-v),axis.map(v=>-v),axis.map(v=>-v),col,mat,bone);tri(b,q,r,axis,axis,axis,col,mat,bone);}}
    function box(p,r,col,mat,bone){const ps=[];for(let i=0;i<8;i++)ps.push(p.map((v,k)=>v+r[k]*((i>>k&1)?1:-1)));for(const face of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]]){const q=face.map(i=>ps[i]),n=norm(cross(sub(q[1],q[0]),sub(q[2],q[0])));tri(q[0],q[1],q[2],n,n,n,col,mat,bone);tri(q[0],q[2],q[3],n,n,n,col,mat,bone);}}
    // Torso, shoulder yoke, hips and tailored waist. The upper body is local
    // to the pelvis so every costume follows the crouch and seated animation.
    const torso=[[-.06,.115*bw,.175*bw],[0,.135*bw,.179*bw],[.09,.143*bw,.178*bw],[.21,(u.belly?.18:.135)*bw,.185*bw,.015],[.34,.143*bw,.201*bw],[.44,.13*bw,.211*bw],[.51,.105*bw,.183*bw],[.535,.066,.09]];
    loft(torso,coat?rgb('#23323c'):tim?rgb(u.underC):shirt,tim?8:coat?2:cloth,0,40,.018);
    const layer=(color,material,inflate,opening,top=.535)=>loft(torso.filter(r=>r[0]<=top).map(r=>[r[0],r[1]+inflate,r[2]+inflate,r[3]||0]),color,material,0,40,.025,opening);
    if(coat){layer(rgb(u.underC),2,.006,.34);layer(shirt,3,.018,.63);}
    if(tim)layer(shirt,11,.013,.63);
    if(safari)layer(rgb(u.vestC),2,.017,.63,.51);
    loft([[-.12,.112*bw,.16*bw],[-.02,.127*bw,.18*bw],[.025,.126*bw,.175*bw]],seated?rgb('#d9d7cb'):pants,2,0,24,.018);
    const neck=coat?1.37:linen?1.16:1;loft([[.52,.055*neck,.057*neck],[.57,.057*neck,.06*neck],[.62,.063*neck,.063*neck]],skin,1,0,24);
    const belt=rgb(safari?'#52452d':'#423c32');
    if(!coat&&!linen){loft([[-.013,.132*bw,.185*bw],[.014,.132*bw,.185*bw]],belt,5,0,24);box([.137*bw,0,.015],[.007,.02,.026],rgb('#b5aa7e'),6,0);}
    // Curved sewn panels follow the same torso cross-sections as the garment.
    function front(y,z,extra=.009){let k=1;while(k<torso.length-1&&torso[k][0]<y)k++;const a=torso[k-1],b=torso[k],f=(y-a[0])/(b[0]-a[0]),rx=a[1]+(b[1]-a[1])*f,rz=a[2]+(b[2]-a[2])*f,off=(a[3]||0)+((b[3]||0)-(a[3]||0))*f;return [off+Math.sqrt(Math.max(0,1-z*z/(rz*rz)))*rx+extra,y,z];}
    function patch(y,z,h,w,col,mat=cloth,extra=.012){for(let j=0;j<4;j++)for(let i=0;i<4;i++){const y0=y-h/2+j*h/4,y1=y0+h/4,z0=z-w/2+i*w/4,z1=z0+w/4,q=[front(y0,z0,extra),front(y1,z0,extra),front(y1,z1,extra),front(y0,z1,extra)],n=q.map(p=>norm([1,0,p[2]*3]));tri(q[0],q[1],q[2],n[0],n[1],n[2],col,mat,0);tri(q[0],q[2],q[3],n[0],n[2],n[3],col,mat,0);}}
    // Collar leaves, placket, stitched hems, buttons and patch pockets.
    for(const side of [-1,1]){
      const col=coat?rgb(u.underC):shirt,a=[.059,.553,side*.061],b=front(.465,side*.079),c=front(.5,side*.123),n=[1,.3,0];tri(a,b,c,n,n,n,mul(col,1.08),coat?2:cloth,0);
      if(safari||linen||lawyer){const z=side*.119*bw,pc=safari?rgb(u.vestC):shirt;patch(.337,z,.101,.087*bw,mul(pc,.96),2,safari?.026:.012);patch(.383,z,.018,.091*bw,mul(pc,.89),2,safari?.03:.015);}
      if(linen){patch(.071,side*.12*bw,.11,.10*bw,mul(shirt,.96));for(let j=0;j<4;j++){const z=side*(.065+j*.009);tube(front(.025,z,.016),front(.45,z,.016),.0018,.0018,mul(shirt,.82),2,0,6);}}
      if(coat||tim||safari){const ec=safari?rgb(u.vestC):shirt,extra=safari?.021:coat?.022:.016;for(let j=0;j<torso.length-2;j++){const a=torso[j],b=torso[j+1];tube(front(a[0],side*a[2]*.59,extra),front(b[0],side*b[2]*.59,extra),.005,.005,mul(ec,.81),cloth,0,8);}}
    }
    if(!coat&&!tim){for(let j=0;j<6;j++)ell(front(.035+j*.073,0,.014),[.004,.005,.005],rgb('#c1b9a0'),5,0,8,5);}
    if(coat){ // rain hood folded at the nape, storm flap and wet seams
      ell([-.12,.498,0],[.093,.071,.171],mul(shirt,.83),3,0);
      for(const z of [-1,1]){tube([-.09,.515,z*.156],[.112,.466,z*.139],.031,.018,mul(shirt,1.07),3,0);patch(.054,z*.173,.047,.103,mul(shirt,.84),3,.032);for(let j=0;j<4;j++)ell(front(.08+j*.092,z*.132,.027),[.004,.005,.005],rgb('#34342b'),6,0,8,5);}
      // Small red/yellow park patch, separate from the open blue under-shirt.
      ell(front(.372,.178,.028),[.006,.038,.042],rgb('#403322'),2,0,16,8);ell(front(.372,.178,.035),[.004,.029,.034],rgb('#c14c29'),2,0,16,8);tube(front(.361,.155,.04),front(.38,.196,.04),.006,.004,rgb('#25271e'),2,0,8);
    }
    if(safari){for(const z of [-1,1]){box([.008,.516,z*.172],[.078,.009,.025],mul(shirt,.86),2,0);patch(.074,z*.128,.145,.12,rgb(u.vestC),2,.036);patch(.149,z*.128,.034,.127,mul(rgb(u.vestC),.84),2,.039);for(let j=0;j<4;j++)tube(front(.225,z*(.085+j*.023),.034),front(.283,z*(.085+j*.023),.034),.008,.008,rgb('#806645'),5,0,8);}patch(.377,.045,.054,.035,rgb('#d8d5c2'),2,.014);patch(.383,.045,.012,.028,rgb('#a94331'),2,.016);}
    if(u.neckwear){loft([[.525,.069,.073],[.556,.061,.068]],rgb(u.neckwear),2,0,24,.04);ell([.076,.526,0],[.03,.021,.026],rgb(u.neckwear),2,0);tube([.084,.522,0],[.148,.429,.027],.017,.003,rgb(u.neckwear),2,0);tube([.084,.522,0],[.141,.453,-.035],.014,.003,mul(rgb(u.neckwear),1.1),2,0);}
    if(u.tie){ell([.13,.481,0],[.016,.025,.021],rgb(u.tie),10,0);const a=front(.456,-.017,.017),b=front(.456,.017,.017),c=front(.13,.025,.021),d=front(.09,0,.021),e=front(.13,-.025,.021),n=[1,0,0];tri(a,c,b,n,n,n,rgb(u.tie),10,0);tri(a,e,c,n,n,n,rgb(u.tie),10,0);tri(e,d,c,n,n,n,rgb(u.tie),10,0);}
    if(u.floral)for(let j=0;j<18;j++){const y=.075+(j%6)*.067,z=Math.sin(j*2.4)*.15,a=Math.asin(z/(.205*bw)),x=Math.cos(a)*.149*bw;for(let k=0;k<5;k++)ell([x+.004,y+Math.cos(k*TAU/5)*.009,z+Math.sin(k*TAU/5)*.009],[.003,.008,.006],rgb(j%2?'#e9dabb':'#8e3342'),2,0,6,4);}
    if(u.bottomType==='skirt')loft([[-.31,.175*bw,.257*bw],[-.23,.16*bw,.234*bw],[-.1,.133*bw,.195*bw],[0,.127*bw,.18*bw]],pants,2,0,28,.06);

    // The head uses a jaw/chin/cheek/temple profile rather than a sphere.
    // Head bone height and proportions vary separately for children.
    const hr=1,wide=coat?1.19:linen?1.09:lawyer?.93:tim?.97:1;
    const face=coat?[[-.141,.061,.072,.032],[-.112,.09,.098,.022],[-.063,.111,.116,.011],[0,.119,.12],[.068,.116,.119,-.007],[.125,.101,.108,-.011],[.16,.07,.074,-.012],[.177,.011,.011,-.012]]:[[-.135,.055,.058*wide,.036],[-.105,.078,.077*wide,.024],[-.058,.105,.088*wide,.014],[.0,.113,.101*wide],[.068,.116,.1*wide,-.007],[.125,.101,.091*wide,-.011],[.16,.07,.062*wide,-.012],[.177,.011,.011,-.012]];
    loft(face.map(r=>r.map((v,i)=>i<3?v*hr:v)),skin,1,1,36);
    for(const z of [-1,1]){
      ell([-.021,-.023,z*.105*wide],[.028,.045,.017],mul(skin,.96),1,1);ell([-.004,-.024,z*.118*wide],[.012,.025,.004],mul(skin,.72),1,1,12,8);
      // inset sockets, ivory sclera, iris, pupil, eyelid and raised brow
      ell([.089,.036,z*.063],[.018,.018,.026],mul(skin,.85),1,1);
      ell([.101,.037,z*.063],[.006,u.shock?.015:.009,.02],rgb('#d8d3c7'),7,1);
      ell([.107,.037,z*.062],[.002,.007,.007],rgb(safari?'#718788':'#574e35'),7,1,12,8);
      ell([.11,.037,z*.062],[.001,.004,.004],rgb('#161717'),7,1,10,6);
      tube([.103,.047,z*.044],[.098,.048,z*.082],.003,.003,mul(skin,.76),1,1);
      tube([.096,.074,z*.036],[.091,.082,z*.092],.009,.005,hair,4,1);
      // smile lines and nasolabial folds in the older cameo faces
      if(linen||safari||lawyer){for(let j=0;j<2;j++)tube([.08,.023+j*.007,z*.087],[.064,.027+j*.008,z*.104],.0018,.001,mul(skin,.7),1,1,6);tube([.118,-.028,z*.033],[.099,-.076,z*.049],.0018,.001,mul(skin,.73),1,1,6);}
    }
    if(linen||safari||lawyer)for(let j=0;j<3;j++)tube([.091,.098+j*.013,-.059],[.094,.1+j*.013,.059],.001,.001,mul(skin,.81),1,1,6);
    ell([.117,.01,0],[lawyer?.028:.022,lawyer?.051:.043,.018],skin,1,1);ell([lawyer?.148:coat?.139:.132,-.022,0],[coat?.02:.017,.014,coat?.026:.019],mul(skin,1.04),1,1);
    for(const z of [-1,1])ell([lawyer?.151:.14,-.03,z*.015],[.006,.003,.005],mul(skin,.54),1,1,10,6);
    ell([.108,-.073,0],[.006,u.shock?.026:.012,.027],rgb('#54282a'),1,1);tube([.111,-.062,-.025],[.111,-.062,.025],.003,.003,mul(skin,.81),1,1);
    tube([.111,-.084,-.023],[.111,-.084,.023],.004,.004,mul(skin,.91),1,1);
    if(!u.beard)box([.123,-.064,0],[.002,.003,.021],rgb('#d9d2bc'),1,1);
    // Scalp with a forehead hairline and individual swept locks.
    if(u.hairStyle!=='bald'){
      // A continuous scalp covers the skull. Tapered swept strands sit within
      // that surface; hair stays attached at every heading and head size.
      const scalp=[];
      const receding=u.hairStyle==='receding',wavy=u.hairStyle==='wavy',top=wavy?.207:.19;
      const profile=wavy?[[-.02,.122,.111],[.068,.129,.115],[.125,.127,.115],[.16,.107,.097],[.185,.073,.07],[.201,.037,.036],[top,.001,.001]]:[[-.02,.122,.111],[.068,.126,.113],[.125,.115,.103],[.16,.083,.077],[top,.001,.001]];
      for(let j=0;j<=10;j++)scalp.push(Array.from({length:40},(_,i)=>{const a=i/40*TAU,low=receding?.034+Math.pow(Math.max(0,Math.cos(a)),.45)*.137:.096-Math.max(0,-Math.cos(a))*.103,y=low+(top-low)*j/10;let k=1;while(k<profile.length-1&&profile[k][0]<y)k++;const lo=profile[k-1],hi=profile[k],r=mix(lo,hi,(y-lo[0])/(hi[0]-lo[0])),wave=wavy?Math.sin(a*7+y*75)*.025:0;return [-.012+Math.cos(a)*r[1]*wide*(1+wave),y,Math.sin(a)*r[2]*wide*(1+wave)];}));
      for(let j=0;j<10;j++)for(let i=0;i<40;i++){const k=(i+1)%40,a=scalp[j][i],b=scalp[j+1][i],c=scalp[j][k],d=scalp[j+1][k],n=p=>norm([p[0]+.012,(p[1]-.065)*.8,p[2]]);tri(a,b,c,n(a),n(b),n(c),hair,4,1);tri(c,b,d,n(c),n(b),n(d),hair,4,1);}
      if(!receding)for(let j=0;j<32;j++){const a=j/32*TAU,x=Math.cos(a),z=Math.sin(a),low=.106-Math.max(0,-x)*.089;tube([x*.119*wide-.013,low,z*.104*wide],[x*.091*wide-.018,.158,z*.079*wide],.002,.0025,mul(hair,1.23),4,1,6);}
      if(wavy)for(let j=0;j<9;j++){const z=(j-4)*.019,p=[.102-Math.abs(z)*.18,.124,z],q=[.063-Math.abs(z)*.16,.176,z-.012],r=[-.014,.204-Math.abs(z)*.32,z-.02];tube(p,q,.004,.004,mul(hair,1.1),4,1,8);tube(q,r,.004,.0015,mul(hair,1.07),4,1,8);}
      if(receding)for(const side of [-1,1])for(let j=0;j<9;j++){const y=.033+j*.01;tube([-.018,y,side*.105*wide],[-.079,y+.026,side*.083*wide],.003,.001,mul(hair,j%3?1.12:1.35),4,1,6);}
    }else for(const z of [-1,1])ell([-.063,.02,z*.079],[.042,.061,.02],hair,4,1);
    if(['bob','long','pony','pig','bun','curls'].includes(u.hairStyle)){
      const hs=u.hairStyle;
      if(hs==='bun')ell([-.15,.093,0],[.066,.063,.063],hair,4,1);
      else if(hs==='curls'){for(let j=0;j<28;j++){const a=j*2.4;ell([Math.cos(a)*.11,.085+(j%3)*.035,Math.sin(a)*.09],[.03,.032,.03],mul(hair,.87+(j%3)*.08),4,1,10,6);}}
      else for(let j=0;j<9;j++){const z=(j-4)*.021,x=-.10+Math.abs(z)*.2,end=hs==='bob'?-.11:hs==='long'?-.31:-.19;tube([x,.07,z],[x-.045,end*.45,z*1.13],.023,.02,hair,4,1);tube([x-.045,end*.45,z*1.13],[x-.10,end,z*.8],.02,.005,mul(hair,1.09),4,1);}
    }
    if(u.beard){loft([[-.154,.033,.042,.046],[-.139,.068,.074,.032],[-.106,.088,.091,.022],[-.084,.104,.098,.009]],hair,4,1,36,.025);loft([[-.084,.104,.098,.009],[-.041,.104,.099,.003]],hair,4,1,36,.015,.7);for(let j=0;j<32;j++){const a=(j/31-.5)*2.9,x=Math.cos(a)*.109,z=Math.sin(a)*.099;tube([x,-.067,z],[x*.8,-.131+Math.abs(Math.sin(a))*.027,z*.89],.0015,.001,mul(hair,j%2?1.04:.88),4,1,6);}}
    if(u.mustache||u.beard)for(const z of [-1,1])tube([.127,-.047,z*.006],[.112,-.052,z*.04],.006,.007,hair,4,1);
    if(u.glasses){const frame=rgb(coat?'#47382c':linen?'#c2a977':'#897e67'),ry=linen?.03:.023,rz=linen?.031:.035;for(const z of [-1,1]){for(let j=0;j<24;j++){const a=j/24*TAU,b=(j+1)/24*TAU;tube([.138,.035+Math.cos(a)*ry,z*.066+Math.sin(a)*rz],[.138,.035+Math.cos(b)*ry,z*.066+Math.sin(b)*rz],coat?.0045:.0025,coat?.0045:.0025,frame,6,1,6);}tube([.135,.044,z*.1],[-.04,.034,z*.12*wide],.0025,.0025,frame,6,1);tube([.141,.055,z*.052],[.141,.043,z*.065],.001,.001,rgb('#aecbce'),7,1,6);}tube([.139,.043,-.031],[.139,.043,.031],.0025,.0025,frame,6,1);}
    if(u.hat&&!u.hatLost){const hc=rgb(u.hatC),cap=u.hat==='cap',visor=u.hat==='visor',shaped=linen||safari;
      if(!visor){loft(shaped?[[.098,.126,.111],[.14,.128,.113],[.224,.114,.104],[.26,.09,.082],[.27,.043,.055]]:[[.1,.123,.109],[.14,.124,.11],[.195,.10,.093],[.217,.063,.07]],hc,2,1,40,.009,0,shaped?(p,a,j)=>[p[0]-(j>1?Math.max(0,Math.cos(a))*.014:0),p[1]-(j>2?Math.pow(Math.abs(Math.cos(a)),2)*.02:0),p[2]*(j>1&&Math.cos(a)>.45?.84:1)]:null);loft([[.111,.13,.115],[shaped?.156:.133,.129,.114]],u.hatBand?rgb(u.hatBand):mul(hc,.51),2,1,40);}
      if(cap||visor)ell([.12,.111,0],[.17,.009,.111],hc,2,1,24,8);
      else if(shaped){for(let ring=0;ring<5;ring++)for(let j=0;j<48;j++){const point=(r,a)=>{const k=r/5;return [Math.cos(a)*(.123+k*.097),.103+(safari?.068:.025)*Math.pow(Math.abs(Math.sin(a)),3)*k*k-Math.max(0,Math.cos(a))*.018*k,Math.sin(a)*(.109+k*.071)];},a=j/48*TAU,b=(j+1)/48*TAU,q=[point(ring,a),point(ring+1,a),point(ring+1,b),point(ring,b)],n=[0,1,0];tri(q[0],q[1],q[2],n,n,n,hc,2,1);tri(q[0],q[2],q[3],n,n,n,hc,2,1);if(ring===4)tube(q[1],q[2],.002,.002,mul(hc,.78),2,1,6);}}
      else ell([0,.109,0],[u.hat==='panama'?.209:.195,.012,.168],hc,2,1,32,8);
      if(safari)for(const z of [-1,1]){for(const x of [-.025,.02])ell([x,.183,z*.105],[.006,.006,.002],mul(hc,.38),5,1,10,6);ell([-.025,.142,z*.148],[.008,.005,.008],rgb('#85704d'),6,1,10,6);}
    }
    // Paired upper/lower limbs are lofted muscle and cloth volumes. Segment
    // bones stretch along their Y axis; all accessory details share that bone.
    for(let side=0;side<2;side++){
      const arm=2+side*3,leg=8+side*3;
      ell([0,.035,0],[.061*bw,.12,.066*bw],shirt,cloth,arm,20,10);
      loft([[0,.058*bw,.063*bw],[.16,.066*bw,.07*bw],[.35,.062*bw,.065*bw],[.53,.055*bw,.059*bw],[.57,.054*bw,.058*bw]],shirt,cloth,arm,18,.022);
      const long=!!u.longSleeve;
      loft([[.53,.047*bw,.05*bw],[.72,.046*bw,.051*bw],[.93,.034*bw,.039*bw],[1,.035*bw,.04*bw]],long?shirt:skin,long?cloth:1,arm,18,.012);
      loft([[0,.036*bw,.04*bw],[.22,.05*bw,.046*bw],[.54,.04*bw,.038*bw],[.84,.028*bw,.031*bw],[1,.026*bw,.028*bw]],long?shirt:skin,long?cloth:1,arm+1,18,.019);
      ell([0,.025,0],[.037*bw,.14,.039*bw],long?shirt:skin,long?cloth:1,arm+1);
      if(safari)loft([[.43,.064*bw,.067*bw],[.55,.064*bw,.067*bw]],mul(shirt,1.12),2,arm,18);
      if(lawyer)loft([[.84,.032*bw,.035*bw],[.99,.032*bw,.035*bw]],mul(shirt,1.07),9,arm+1,20);
      if(linen&&side===1){loft([[.89,.03*bw,.034*bw],[.98,.03*bw,.034*bw]],rgb('#bc9a54'),6,arm+1,20);ell([.035,.935,0],[.009,.047,.02],rgb('#dbd7c4'),6,arm+1,16,8);}
      ell([0,.045,0],[.029,.052,.034],skin,1,arm+2);
      for(let f=0;f<4;f++){const z=(f-1.5)*.017,grip=u.holdItem||u.cane,len=grip?.026:f===0||f===3?.048:.06;tube([.004,.073,z],[.01,.073+len,z],.008,.006,skin,1,arm+2,8);tube([.01,.073+len,z],[grip?.037:.026,grip?.075:.074+len,z],.006,.004,skin,1,arm+2,8);}
      tube([.013,.035,-.031],[.034,.068,-.042],.011,.007,skin,1,arm+2,10);
      const thigh=seated||u.bottomType==='skirt'?skin:pants,thMat=seated||u.bottomType==='skirt'?1:2;
      loft([[0,.081*bw,.088*bw],[.15,.083*bw,.085*bw],[.42,.074*bw,.077*bw],[.64,.068*bw,.07*bw],[.69,.065*bw,.067*bw]],thigh,thMat,leg,20,.024);
      loft([[.67,.056*bw,.059*bw],[.86,.052*bw,.055*bw],[1,.047*bw,.05*bw]],u.bottomType==='pants'&&!seated?pants:skin,u.bottomType==='pants'&&!seated?2:1,leg,18,.012);
      const trouser=u.bottomType==='pants'&&!seated;
      loft([[0,.048*bw,.052*bw],[.23,.056*bw,.059*bw],[.46,.05*bw,.053*bw],[.72,.032*bw,.038*bw],[1,.028*bw,.033*bw]],trouser?pants:skin,trouser?2:1,leg+1,20,.024);
      ell([0,.025,0],[.049*bw,.14,.051*bw],trouser?pants:skin,trouser?2:1,leg+1);
      if(safari)loft([[.13,.06*bw,.063*bw],[.2,.061*bw,.064*bw],[.28,.059*bw,.063*bw],[.5,.052*bw,.058*bw],[.8,.04*bw,.046*bw]],rgb('#85816a'),2,leg+1,24,.015);
      else if(!trouser)loft(tim?[[.58,.041,.045],[.64,.044,.046],[.69,.038,.041],[.75,.042,.044],[.84,.033,.038],[.96,.031,.036]]:[[.75,.033*bw,.038*bw],[.96,.031*bw,.036*bw]],rgb(tim?'#a39b85':'#dad7c8'),2,leg+1,18,.025);
      ell([.045,.033,0],[.111,.041,.052],shoe,5,leg+2,20,10);
      ell([.048,.006,0],[.112,.012,.054],tim?rgb('#c8bea5'):mul(shoe,.53),5,leg+2,20,8);
      for(let j=0;j<4;j++)tube([.012+j*.017,.07-j*.006,-.026],[.012+j*.017,.07-j*.006,.026],.003,.003,rgb(safari?'#a89876':'#d1c8b1'),2,leg+2,6);
      if(safari||tim){loft([[.67,.037*bw,.04*bw],[.74,.038*bw,.04*bw],[.98,.031*bw,.036*bw]],shoe,5,leg+1,20,.015);ell([-.019,.073,0],[.044,.063,.045],shoe,5,leg+2);}
      if(safari){for(const z of [-1,1]){box([.02,.49,z*.076*bw],[.038,.125,.009],mul(pants,.94),2,leg);for(const y of [.72,.84]){tube([.035,y,z*.033],[.022,y,z*.041],.007,.007,mul(shoe,1.3),5,leg+1);box([.03,y,z*.042],[.01,.017,.002],rgb('#92866c'),6,leg+1);}}}
      if(tim)for(const z of [-1,1])tube([.065,.05,z*.045],[.055,.52,z*.06],.002,.002,mul(pants,.7),2,leg,6);
      if(seated)loft([[.6,.063,.064],[.67,.069,.069],[.73,.064,.064],[.85,.061,.062]],pants,2,leg+1,20,.08);
    }
    if(u.pack==='backpack'){const pc=rgb(u.packC);ell([-.197,.255,0],[.106,.206,.145],pc,2,0);box([-.288,.21,0],[.013,.103,.105],mul(pc,.85),2,0);for(const z of [-1,1])tube([-.118,.47,z*.125],[.105,.26,z*.162],.017,.015,mul(pc,.5),5,0);}
    if(u.pack==='fanny')ell([.154,.015,0],[.065,.072,.131],rgb(u.packC),2,0);
    // Props get their own rigid frame shared by the gripping hands.
    if(u.holdItem==='barbasol'){const white=rgb('#e4e1d5');tube([0,-.06,0],[0,.074,0],.034,.034,white,6,14,20);tube([0,-.025,0],[0,.026,0],.035,.035,rgb('#b52f2c'),3,14,20);tube([0,-.05,0],[0,-.039,0],.035,.035,rgb('#2a4f90'),3,14,20);tube([0,.074,0],[0,.09,0],.036,.036,rgb('#b83125'),3,14,20);tube([0,.09,0],[0,.111,0],.009,.009,white,6,14,12);}
    if(u.holdItem==='rifle'){
      // Muldoon's SPAS-12 silhouette: perforated heat shield, ribbed pump,
      // pistol grip and folded metal stock. The gameplay prop key stays stable.
      const metal=rgb('#343a39'),black=rgb('#222725'),edge=rgb('#59605b');
      box([-.02,.027,0],[.105,.033,.026],metal,6,14);tube([-.072,.015,0],[-.108,-.086,0],.024,.02,black,5,14);
      tube([.069,.046,0],[.59,.046,0],.017,.013,metal,6,14,16);tube([.079,.01,0],[.48,.01,0],.015,.013,metal,6,14,16);
      box([.236,.058,0],[.151,.022,.027],metal,6,14);box([.209,-.013,0],[.092,.024,.031],black,5,14);
      for(let j=0;j<9;j++){const x=.13+j*.026;for(const side of [-1,1])ell([x,.064,side*.028],[.008,.009,.002],rgb('#111817'),5,14,8,6);if(j<7)box([.127+j*.026,-.013,0],[.003,.027,.034],edge,5,14);}
      for(const side of [-1,1]){tube([-.115,.055,side*.032],[.185,.107,side*.032],.009,.009,metal,6,14);tube([.185,.107,side*.032],[.249,.073,side*.032],.009,.009,metal,6,14);}
      tube([.249,.073,-.041],[.249,.073,.041],.011,.011,black,5,14);box([.514,.07,0],[.009,.018,.009],metal,6,14);
      tube([-.024,-.004,.028],[.015,-.042,.028],.004,.004,edge,6,14);tube([.015,-.042,.028],[.05,-.007,.028],.004,.004,edge,6,14);
      tube([-.111,-.025,-.039],[.138,-.135,-.041],.009,.009,black,5,14);tube([.138,-.135,-.041],[.44,.005,-.039],.009,.009,black,5,14);
    }
    if(u.cane){const ivory=rgb('#c9bda0');tube([.013,0,0],[.04,-.58,0],.014,.009,ivory,5,14,16);for(let j=0;j<8;j++){const y=-.04-j*.066,x=.013-y*.047;ell([x,y,0],[.016,.009,.015],mul(ivory,j%2?.9:1.04),5,14,12,8);}ell([.04,-.58,0],[.01,.01,.01],rgb('#5b5445'),5,14);ell([0,.025,0],[.04,.043,.038],rgb('#c88c28'),6,14);ell([.016,.038,.026],[.007,.013,.006],rgb('#ffe5a3'),7,14);tube([-.013,.014,.03],[.012,.011,.03],.002,.002,rgb('#473524'),5,14,6);}
    if(u.camera||u.arms==='camera'){box([0,0,0],[.046,.045,.074],rgb('#303734'),5,15);tube([.043,0,0],[.093,0,0],.029,.027,rgb('#525d57'),6,15,18);tube([.094,0,0],[.095,0,0],.022,.022,rgb('#83afbd'),7,15,18);box([-.01,.052,.04],[.018,.009,.02],rgb('#616a5f'),6,15);}
    const data=new Float32Array(vertices),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    return {buffer,count:data.length/11,triangles:data.length/33};
  }

  // Matrices place each surface region. Limbs share exact joint endpoints;
  // footwear and fingers keep their proportions while segment lengths vary.
  function matrices(u,ph,pose){
    const out=new Float32Array(16*16),t=u.tall||1,bw=u.build||1;
    function frame(i,p,x=[1,0,0],y=[0,1,0],z=[0,0,1]){out.set([...x,0,...y,0,...z,0,...p,1],i*16);}
    function segment(i,a,b){const y=sub(b,a),yn=norm(y),x=norm(cross(yn,[0,0,1])),z=norm(cross(x,yn));frame(i,a,x,y,z);}
    let hip=[0,.79*t,0],lean=pose==='run'?(u.hero==='hammond'?.07:(u.lean||.12)):0;
    if(pose==='sit')hip=[-.16,.18*t,0];if(pose==='kneel')hip=[-.13,.47*t,0];if(pose==='seated')hip=[-.03,.57*t,0];if(pose==='climb')hip=[0,.7*t,0];
    const bounce=pose==='run'?Math.abs(Math.sin(ph))*.027:0;hip[1]+=bounce;
    const torsoX=[Math.cos(lean),-Math.sin(lean),0],torsoY=[Math.sin(lean),Math.cos(lean),0];
    frame(0,hip,torsoX,torsoY,[0,0,1]);
    const head=[hip[0]+Math.sin(lean)*.76,hip[1]+.76,0],look=u.lookT>0?-1:1;
    const hs=u.hero==='timmy'?1.04:u.kid?1.12:1;frame(1,head,[look*hs,0,0],[0,hs*(u.hero==='gennaro'?1.08:1),0],[0,0,look*hs]);
    const hands=[];
    for(let side=0;side<2;side++){
      const z=(side?1:-1)*.153*bw,p=ph+side*Math.PI,sw=Math.sin(p),lift=Math.max(0,Math.cos(p));
      let h=[hip[0],hip[1]-.015,z*.64],k,f;
      if(pose==='sit'){k=[hip[0]+.30,.25+side*.07,z];f=[hip[0]+.53,.04,z];}
      else if(pose==='seated'){k=[.31,.54*t,z];f=[.34,.04,z];}
      else if(pose==='kneel'){k=side?[.29,.40,z]:[-.31,.06,z];f=side?[.30,.04,z]:[-.58,.04,z];}
      else if(pose==='climb'){k=[.19,.43+sw*.10,z];f=[.24,.07+Math.max(0,sw)*.22,z];}
      else {const a=sw*(u.hero==='hammond'?.33:.72),flex=.2+lift*1.28*(1-Math.max(0,sw)*.45),len=.385*t;k=[h[0]+Math.sin(a)*len,h[1]-Math.cos(a)*len,z];f=[k[0]+Math.sin(a-flex)*len,Math.max(.04,k[1]-Math.cos(a-flex)*len),z];}
      if(pose==='zap'){k=[hip[0]+(side?.23:-.23),.37,z];f=[hip[0]+(side?.4:-.4),.04,z];}
      const leg=8+side*3;segment(leg,h,k);segment(leg+1,k,f);frame(leg+2,f);
      const sh=[hip[0]+Math.sin(lean)*.48,hip[1]+.46,z*1.3];let e,hand;
      const mode=u.arms||'pump';
      if(pose==='kneel'){e=side?[.02,hip[1]+.22,z*1.4]:[.32,hip[1]+.30,z];hand=side?[.13,hip[1]+.45,.025]:[.42,hip[1]+.46,-.015];}
      else if(pose==='climb'){e=[.20,hip[1]+.5+sw*.1,z];hand=[.31,hip[1]+.86+sw*.13,z];}
      else if(pose==='sit'||pose==='seated'||pose==='zap'||mode==='flail'||pose==='caught'){e=[sh[0]+(side?.15:-.21),sh[1]+.19+Math.sin(p*1.3)*.06,z*1.45];hand=[e[0]+(side?.1:-.08),e[1]+.25+Math.sin(p*1.7)*.06,z*1.4];}
      else if(mode==='clutch'||mode==='hathold'&&side){e=[sh[0]+.10,sh[1]+.15,z*1.8];hand=[head[0]+.03,head[1]+.16,z*.45];}
      else if(mode==='rifle'){e=[sh[0]+.06,sh[1]-.20,z*1.4];hand=side?[.23,hip[1]+.19,.026]:[.49,hip[1]+.28,-.017];}
      else if(mode==='camera'){e=[sh[0]+.1,sh[1]-.23,z*1.25];hand=[sh[0]+.33,sh[1]-.08,z*.3];}
      else if(mode==='canhold'&&side){e=[sh[0]+.12,sh[1]-.22,z*1.5];hand=[sh[0]+.28,sh[1]-.12,z*.4];}
      else if(mode==='cane'&&side){e=[sh[0]+.13,sh[1]-.26,z*1.2];hand=[sh[0]+.30,.61,z*.4];}
      else {const a=1.4+sw*.75;e=[sh[0]+Math.cos(a)*.26,sh[1]-Math.sin(a)*.26,z*1.3];hand=[e[0]+Math.cos(a-2.1)*.24,e[1]-Math.sin(a-2.1)*.24,z*1.2];}
      const arm=2+side*3;segment(arm,sh,e);segment(arm+1,e,hand);
      const axis=norm(sub(hand,e)),right=norm(cross(axis,[0,0,1]));frame(arm+2,hand,right,axis,[0,0,1]);hands.push(hand);
    }
    const angle=pose==='kneel'?0:.26,c=Math.cos(angle),s=Math.sin(angle);
    frame(14,hands[1],[c,s,0],[-s,c,0],[0,0,1]);
    frame(15,u.arms==='camera'?mix(hands[0],hands[1],.5):[hip[0]+.24,hip[1]+.23,0]);
    return out;
  }
  function signature(u,pose){return fields.map(k=>u[k]??'').join('|')+'|'+(pose==='seated');}
  function sprite(u,phase,pose,detail){
    const id=signature(u,pose);let model=models.get(id);
    if(!model){model=build(u,pose==='seated');models.set(id,model);if(models.size>MAX_MODELS){const key=models.keys().next().value;gl.deleteBuffer(models.get(key).buffer);models.delete(key);}}
    else {models.delete(id);models.set(id,model);}
    const frame=((Math.round(phase/TAU*24)%24)+24)%24,yaw=Number.isFinite(u.artHeading)?u.artHeading:-.56;
    const burn=pose==='zap'?Math.max(.001,Math.round((u.burn||0)*12)/12):0;
    const key=[id,pose,frame,u.arms,u.lookT>0?1:0,u.lean,detail,yaw,burn].join(':');
    if(sprites.has(key)){const cv=sprites.get(key);sprites.delete(key);sprites.set(key,cv);return cv;}
    if(source.width!==detail){source.width=source.height=detail;}
    gl.useProgram(program);gl.viewport(0,0,detail,detail);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,model.buffer);
    let offset=0;for(const [name,n] of [['aPosition',3],['aNormal',3],['aColor',3],['aBone',1],['aMaterial',1]]){gl.enableVertexAttribArray(loc[name]);gl.vertexAttribPointer(loc[name],n,gl.FLOAT,false,44,offset*4);offset+=n;}
    gl.uniformMatrix4fv(loc.uBones,false,matrices(u,frame/24*TAU,pose));gl.uniform1f(loc.uYaw,yaw);gl.uniform1f(loc.uWound,pose==='caught'?1:0);gl.uniform1f(loc.uBurn,burn);gl.drawArrays(gl.TRIANGLES,0,model.count);draws++;
    const cv=document.createElement('canvas');cv.width=cv.height=detail;cv.getContext('2d').drawImage(source,0,0);sprites.set(key,cv);spritePixels+=detail*detail;
    while(sprites.size>MAX_SPRITES||spritePixels>MAX_PIXELS){const oldest=sprites.keys().next().value,entry=sprites.get(oldest);spritePixels-=entry.width*entry.height;sprites.delete(oldest);}return cv;
  }
  function draw(c,u,x,y,dir=1,phase=0,alpha=1,pitch=0,pose='run',airborne=false){
    if(!available())return false;if(alpha<=0)return true;
    const s=u.size||14,tf=c.getTransform(),screenSize=s*Math.max(Math.hypot(tf.a,tf.b),Math.hypot(tf.c,tf.d)),detail=screenSize>85?512:screenSize>35?256:128;
    const cv=sprite(u,phase,pose,detail);
    c.save();c.globalAlpha*=alpha;c.translate(x,y);
    if(!airborne&&pose!=='climb'&&pose!=='seated'&&pose!=='zap'){const g=c.createRadialGradient(0,1,0,0,1,s*.55);g.addColorStop(0,'rgba(0,0,0,.3)');g.addColorStop(1,'rgba(0,0,0,0)');c.save();c.scale(1,.24);c.fillStyle=g;c.fillRect(-s*.6,-s*.6,s*1.2,s*1.2);c.restore();}
    c.scale(Math.sign(dir||1)*Math.max(.08,Math.abs(dir)),1);if(pitch){c.translate(0,-s*.5);c.rotate(pitch);c.translate(0,s*.5);}c.drawImage(cv,-1.35*s,-2.42*s,2.7*s,2.7*s);
    if(u.balloon&&pose==='run'){const bx=-s*.48,by=-s*2.03+Math.sin(phase)*s*.04;c.strokeStyle='rgba(217,225,209,.6)';c.lineWidth=Math.max(.5,s*.009);c.beginPath();c.moveTo(-s*.09,-s*1.25);c.quadraticCurveTo(-s*.43,-s*1.5,bx,by);c.stroke();const g=c.createRadialGradient(bx-s*.035,by-s*.05,s*.005,bx,by,s*.17);g.addColorStop(0,'#ffb2a5');g.addColorStop(.3,u.balloonC||'#d93732');g.addColorStop(1,'#6d1a21');c.fillStyle=g;c.beginPath();c.ellipse(bx,by,s*.14,s*.18,-.1,0,TAU);c.fill();}
    c.restore();return true;
  }
  function caught(c,u,m,dir,time){
    if(!available())return false;
    const s=u.size||14;c.save();c.translate(m.x,m.y);c.scale(dir,1);c.rotate(2.70+Math.sin(time*16)*.1);c.translate(0,s*.99);draw(c,u,0,0,1,time*19,1,0,'caught',true);c.restore();return true;
  }
  return {draw,caught,get available(){return available();},stats:()=>({available:available(),error,models:models.size,sprites:sprites.size,spritePixels,draws,triangles:[...models.values()].map(m=>m.triangles)}),context:()=>gl};
})();
