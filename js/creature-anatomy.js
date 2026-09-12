'use strict';
/* Species-authored silhouettes and skeletons. Shared code below only builds
   surfaces and skins them: it does not decide skull or limb proportions.
   Body/head sections: [x, top, bottom, half-width]. Limb stations:
   [x, y, radius in the limb plane, radius across the limb]. */
const CreatureAnatomy=(()=>{
  const S={
    triceratops:{kind:'quadruped',stride:.78,lift:.075,duty:.76,
      body:[[-.80,1.11,.78,.17],[-.59,1.38,.59,.39],[-.16,1.44,.46,.49],[.29,1.29,.43,.45],[.65,1.10,.53,.30],[.80,.96,.62,.19]],
      neck:[[.50,1.10,.55,.28],[.76,1.06,.56,.28],[.96,1.07,.58,.25]],
      head:[[.68,1.12,.62,.24],[.91,1.23,.52,.29],[1.13,1.10,.47,.22],[1.40,.88,.44,.14],[1.60,.67,.40,.064],[1.66,.48,.37,.012]],
      jaw:[[.86,.62,.40,.20],[1.14,.56,.36,.18],[1.43,.47,.37,.095],[1.57,.44,.39,.027]],
      eye:[.99,1.055,.255,.018],mouth:[1.47,.46,0],jawPivot:[.85,.60,0],frill:{x:.69,y:.99,width:.47,height:.54,lean:-.30},
      horns:[[[.97,1.17,.21],[1.18,1.49,.25],[1.55,1.69,.25],.078],[[.97,1.17,-.21],[1.18,1.49,-.25],[1.55,1.69,-.25],.078],[[1.38,.83,0],[1.43,1.04,0],[1.50,1.10,0],.059]],
      hind:{z:.33,bend:1,points:[[-.52,1.17,.225,.205],[-.28,.67,.145,.135],[-.46,.20,.105,.105],[-.34,.075,.17,.13]]},
      fore:{z:.34,bend:-1,points:[[.43,.99,.195,.175],[.28,.51,.145,.125],[.50,.17,.095,.092],[.58,.065,.15,.125]]},
      tail:[[-.60,.96,0,.23,.24],[-1.01,.79,0,.15,.16],[-1.45,.64,0,.077,.086],[-1.85,.54,0,.028,.035],[-2.01,.53,0,.004,.005]],beak:true},
    apatosaurus:{kind:'sauropod',stride:.71,lift:.068,duty:.78,
      body:[[-.91,1.24,.99,.20],[-.67,1.67,.79,.41],[-.18,1.76,.72,.51],[.28,1.63,.69,.49],[.66,1.48,.76,.34],[.84,1.37,.86,.24]],
      neck:[[.58,1.54,.70,.32],[.91,1.55,.88,.29],[1.29,1.64,1.08,.25],[1.68,1.76,1.30,.19],[2.02,1.86,1.51,.14],[2.32,1.89,1.65,.094]],
      head:[[2.20,1.94,1.71,.076],[2.32,2.015,1.69,.108],[2.47,1.94,1.65,.11],[2.64,1.79,1.63,.09],[2.72,1.70,1.64,.025]],
      jaw:[[2.30,1.74,1.62,.08],[2.48,1.68,1.59,.087],[2.65,1.66,1.61,.075],[2.71,1.66,1.64,.022]],
      eye:[2.335,1.889,.091,.013],mouth:[2.60,1.675,0],jawPivot:[2.28,1.71,0],
      hind:{z:.40,bend:1,points:[[-.53,1.42,.25,.24],[-.40,.82,.205,.18],[-.58,.23,.16,.145],[-.50,.08,.195,.178]]},
      fore:{z:.38,bend:-1,points:[[.53,1.22,.21,.20],[.47,.66,.168,.158],[.54,.21,.14,.132],[.59,.065,.17,.16]]},
      tail:[[-.70,1.22,0,.31,.29],[-1.11,1.06,0,.225,.20],[-1.63,.88,0,.136,.11],[-2.16,.78,0,.06,.043],[-2.68,.77,0,.003,.004]],beak:true}
  };
  Object.assign(S,CreatureSpecies);
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((q,v,i)=>q+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1));
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],T=(x,y,z)=>{const m=I();m[12]=x;m[13]=y;m[14]=z;return m;};
  const MM=(a,b)=>{const m=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)m[j*4+i]+=a[k*4+i]*b[j*4+k];return m;};
  function R(a,p,axis='z'){const m=I(),c=Math.cos(a),s=Math.sin(a);if(axis==='x'){m[5]=m[10]=c;m[6]=s;m[9]=-s;}else if(axis==='y'){m[0]=m[10]=c;m[2]=-s;m[8]=s;}else{m[0]=m[5]=c;m[1]=s;m[4]=-s;}for(let i=0;i<3;i++)m[12+i]=p[i]-m[i]*p[0]-m[4+i]*p[1]-m[8+i]*p[2];return m;}
  function segment(a,b,aa,bb){const u=sub(b,a),v=sub(bb,aa),m=R(Math.atan2(v[1],v[0])-Math.atan2(u[1],u[0]),[0,0,0]);m[12]=aa[0]-m[0]*a[0]-m[4]*a[1];m[13]=aa[1]-m[1]*a[0]-m[5]*a[1];m[14]=aa[2]-a[2];return m;}
  function foot(phase,offset,span,duty=.75,lift=.08){const q=((phase/TAU+offset)%1+1)%1;if(q<duty)return {x:span*(.5-q/duty),y:0,planted:true};const t=(q-duty)/(1-duty);return {x:span*(-.5+t*t*(3-2*t)),y:Math.sin(t*Math.PI)**2*lift,planted:false};}
  function knee(a,b,l1,l2,bend){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.max(.0001,Math.min(l1+l2-.00001,Math.hypot(dx,dy))),u=dx/L,v=dy/L,at=(l1*l1-l2*l2+L*L)/(2*L),h=Math.sqrt(Math.max(0,l1*l1-at*at));return [a[0]+u*at-v*h*bend,a[1]+v*at+u*h*bend,a[2]];}
  function samples(points,steps=4){const result=[];for(let i=0;i<points.length-1;i++)for(let j=0;j<steps;j++){const t=j/steps,p=points[i],q=points[i+1],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+2)];result.push({p:p.map((v,k)=>{const n=.5*(2*v+(-a[k]+q[k])*t+(2*a[k]-5*v+4*q[k]-b[k])*t*t+(-a[k]+3*v-3*q[k]+b[k])*t*t*t);return k>=3?clamp(n,Math.min(v,q[k]),Math.max(v,q[k])):n;}),u:i+t});}result.push({p:points.at(-1),u:points.length-1});return result;}
  // A body/skull profile is a function of X. Uniform Catmull-Rom doubles
  // back when authored stations have unequal spacing, folding the skin.
  // Shape-preserving Hermite interpolation uses actual station distances.
  function profileSamples(points,steps=5){
    const result=[],slope=(i,k)=>(points[i+1][k]-points[i][k])/(points[i+1][0]-points[i][0]),tangent=(i,k)=>{if(i===0)return slope(0,k);if(i===points.length-1)return slope(i-1,k);const a=slope(i-1,k),b=slope(i,k);if(a*b<=0)return 0;const h0=points[i][0]-points[i-1][0],h1=points[i+1][0]-points[i][0],w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/a+w1/b);};
    for(let i=0;i<points.length-1;i++)for(let j=0;j<steps;j++){const t=j/steps,a=points[i],b=points[i+1],h=b[0]-a[0];result.push({u:i+t,p:a.map((v,k)=>k===0?mix(v,b[k],t):clamp((2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*h*tangent(i,k)+(-2*t*t*t+3*t*t)*b[k]+(t*t*t-t*t)*h*tangent(i+1,k),Math.min(v,b[k]),Math.max(v,b[k])))});}
    result.push({p:points.at(-1),u:points.length-1});return result;
  }
  function builder(){
    const data=[],parts=['torso','head','lowerJaw','tail','farLeg','nearLeg','farArm','nearArm','sail','ridge','wingFar','wingNear','flipper'];let id=0,part=0,mat=1,col=[1,0,0];
    const use=(b,p,material=1,color=[1,0,0])=>{id=b;part=parts.indexOf(p);mat=material;col=typeof color==='string'?rgb(color):color;};
    function vertex(p,n,b=[id,0,0],color=col){b=b||[id,0,0];data.push(...p,...n,...p,...color,b[0],mat,part,b[1],b[2]);}
    function tri(a,b,c,na,nb,nc,ba,bb,bc,ca,cb,cc){const area=cross(sub(b,a),sub(c,a));if(Math.hypot(...area)<1e-10)return;const n=norm(area);vertex(a,na||n,ba,ca);vertex(b,nb||n,bb,cb);vertex(c,nc||n,bc,cc);}
    function surface(rows,boneAt,pigment=true){
      const n=rows[0].length;
      for(let j=0;j<rows.length;j++)for(let i=0;i<n;i++){const v=rows[j][i],along=sub(rows[Math.min(rows.length-1,j+1)][i].p,rows[Math.max(0,j-1)][i].p),around=sub(rows[j][(i+1)%n].p,rows[j][(i+n-1)%n].p);let normal=norm(cross(around,along));if(dot(normal,v.n)<0)normal=mul(normal,-1);v.n=normal;const belly=pigment?clamp((-v.n[1]-.15)*.78,0,.65):.1;v.c=mat===1?[1-belly,belly,0]:(v.c||col);v.b=boneAt?boneAt(v.u):[id,0,0];}
      for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const a=rows[j][i],b=rows[j][(i+1)%n],c=rows[j+1][(i+1)%n],d=rows[j+1][i];tri(a.p,b.p,c.p,a.n,b.n,c.n,a.b,b.b,c.b,a.c,b.c,c.c);tri(a.p,c.p,d.p,a.n,c.n,d.n,a.b,c.b,d.b,a.c,c.c,d.c);}
      for(const j of [0,rows.length-1]){const row=rows[j],center=row.reduce((p,v)=>add(p,mul(v.p,1/n)),[0,0,0]);for(let i=0;i<n;i++)tri(center,row[i].p,row[(i+1)%n].p,null,null,null,row[i].b,row[i].b,row[i].b,row[i].c,row[i].c,row[i].c);}
    }
    function sweep(points,sides=18,boneAt,pigment=true,steps=4){let frame=[0,1,0];const pp=samples(points,steps),rows=pp.map(({p,u},j)=>{const ax=norm(sub(pp[Math.min(pp.length-1,j+1)].p.slice(0,3),pp[Math.max(0,j-1)].p.slice(0,3)));let ac=sub(frame,mul(ax,dot(frame,ax)));if(Math.hypot(...ac)<.01)ac=cross([0,0,1],ax);ac=norm(ac);frame=ac;const wide=cross(ax,ac);return Array.from({length:sides},(_,i)=>{const a=i/sides*TAU,n=add(mul(ac,Math.cos(a)),mul(wide,Math.sin(a)));return {p:add(p.slice(0,3),add(mul(ac,Math.cos(a)*p[3]),mul(wide,Math.sin(a)*p[4]))),n,u};});});surface(rows,boneAt,pigment);}
    function profile(sections,exponent=2.2,pigment=true){
      const pp=profileSamples(sections),rows=pp.map(({p,u})=>Array.from({length:22},(_,i)=>{const a=i/22*TAU,cy=Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**(2/exponent),cz=Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**(2/exponent);return {p:[p[0],(p[1]+p[2])*.5+cy*(p[1]-p[2])*.5,cz*p[3]],n:[0,cy,cz],u};}));surface(rows,null,pigment);
    }
    function ell(center,radii,segments=12,rings=8){for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const p=(a,b)=>{const t=a/segments*TAU,l=-Math.PI/2+b/rings*Math.PI,n=[Math.cos(l)*Math.cos(t),Math.sin(l),Math.cos(l)*Math.sin(t)];return {p:add(center,n.map((v,k)=>v*radii[k])),n:norm(n.map((v,k)=>v/radii[k]))};},a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);tri(a.p,b.p,c.p,a.n,b.n,c.n);tri(a.p,c.p,d.p,a.n,c.n,d.n);}}
    const horn=(points,r)=>sweep(points.map((p,i)=>[...p,Math.max(.001,r*(1-i/(points.length-1))),Math.max(.001,r*(1-i/(points.length-1)))]),8,null,false,2);
    // Anatomical lofts accept an authored cross-section, including the flat
    // alveolar edge of a jaw. A mouth cannot be made from two ellipsoids.
    function loft(sections,contour,boneAt,pigment=true,sculpt){
      const pp=profileSamples(sections,5),rows=pp.map(({p,u})=>(typeof contour==='function'?contour(p):contour).map(([z,y])=>{
        let v=[p[0],mix(p[2],p[1],y),p[3]*z];if(sculpt)v=sculpt(v,u,z,y);
        return {p:v,n:[0,y-.5,z],u};
      }));surface(rows,boneAt,pigment);
    }
    // A closed wing cross-section wraps the arm/finger and continues into the
    // membrane. Separate sweeps and a straight-edged fan diverge at the wrist
    // and leave exposed "ropes" above the cambered skin. Keep this authored
    // shell as membrane material: voxel remeshing would erase its thin edges.
    function wing(points,web){
      const side=Math.sign(points.at(-1)[2]),edge=profileSamples([...web.slice().reverse(),points.at(-1)].map((p,i)=>[i===0?points[0][2]*side:p[2]*side,p[0],p[1],0]),8).map(v=>v.p);
      const leading=samples(points.map((p,i)=>[...p,[.085,.060,.034,.0015][i],[.073,.047,.027,.0015][i]]),12);
      const chordSteps=[0,.015,.035,.06,.10,.16,.24,.34,.46,.60,.74,.86,.94,1];
      const rows=leading.map(({p,u})=>{
        const z=p[2]*side;let i=0;while(i<edge.length-2&&edge[i+1][0]<z)i++;
        const a=edge[i],b=edge[i+1],t=clamp((z-a[0])/(b[0]-a[0]),0,1),end=[mix(a[1],b[1],t),mix(a[2],b[2],t),p[2]],delta=sub(end,p.slice(0,3)),length=Math.max(.006,Math.hypot(...delta));
        const along=Math.hypot(...delta)<.006?[-1,0,0]:norm(delta),up=[along[1],-along[0],0],rw=Math.min(p[4],length*.22),ry=Math.min(p[3],length*.28),row=[];
        const push=(distance,height,n,blend)=>row.push({p:add(p.slice(0,3),add(mul(along,distance),mul(up,height))),n,u,c:[mix(.91,.74,blend),mix(.09,.16,blend),mix(0,.10,blend)]});
        // Rounded front of the skin-covered spar, then its upper and lower
        // surfaces taper smoothly into the same membrane vertices.
        for(let j=0;j<4;j++){const angle=Math.PI-j*Math.PI/8;push(Math.cos(angle)*rw,Math.sin(angle)*ry,add(mul(along,Math.cos(angle)),mul(up,Math.sin(angle))),0);}
        const tissue=(t,sign)=>{
          const d=t*length,spar=Math.exp(-((d/(rw*1.3))**2)),camber=-.045*Math.sin(u/3*Math.PI)*Math.sin(t*Math.PI),thickness=.0035*Math.sin(t*Math.PI)+ry*spar;
          push(d,camber+sign*thickness,mul(up,sign),1-spar);
        };
        for(const t of chordSteps)tissue(t,1);
        for(const t of chordSteps.slice(0,-1).reverse())tissue(t,-1);
        for(let j=1;j<4;j++){const angle=Math.PI*1.5-j*Math.PI/8;push(Math.cos(angle)*rw,Math.sin(angle)*ry,add(mul(along,Math.cos(angle)),mul(up,Math.sin(angle))),0);}
        return row;
      });
      surface(rows,null,false);
    }
    return {data,parts,use,tri,sweep,profile,loft,ell,horn,wing};
  }
  function build(key,cfg){
    const s=S[key];if(!s)return null;const m=builder(),{use,profile,loft,sweep,ell,horn,tri,wing}=m,bones=[{kind:'body'},{kind:'head'},{kind:'jaw'}];const bone=kind=>{bones.push({kind});return bones.length-1;};
    const rig={headBone:1,jawBone:2,head:s.head[0].slice(0,1).concat([(s.head[0][1]+s.head[0][2])/2,0]),jaw:s.jawPivot,mouth:s.mouth,legs:[],tails:[],arms:[],wings:[],stride:s.stride,cfg};
    // Tail, trunk, neck and cranium form one continuous skinned surface. This
    // avoids flat caps poking through a neighbouring body part while it turns.
    const ti=s.tail.map((_,i)=>{const id=bone('tail');rig.tails.push({id,i});return id;});
    const at=(sections,x)=>{let i=0;while(i<sections.length-2&&sections[i+1][0]<x)i++;const a=sections[i],b=sections[i+1],t=clamp((x-a[0])/(b[0]-a[0]),0,1);return a.map((v,k)=>mix(v,b[k],t));};
    // Retain the overlapping pelvis AND tail root. The old concatenation
    // threw away the tail root and narrowed the body before widening again.
    function join(a,b){const start=b[0][0],end=a.at(-1)[0];if(start>=end)return [...a,...b];const xs=[...new Set([...a,...b].map(p=>p[0]))].sort((x,y)=>x-y);return xs.map(x=>{if(x<start)return at(a,x);if(x>end)return at(b,x);const p=at(a,x),q=at(b,x),t=(x-start)/(end-start),w=t*t*(3-2*t);return [x,mix(p[1],q[1],w),mix(p[2],q[2],w),mix(p[3],q[3],w)];});}
    const tailRows=s.tail.slice().reverse().map(p=>[p[0],p[1]+p[3],p[1]-p[3],p[4]]);
    const cranium=s.head;
    const skullContour=[[0,1],[.35,.985],[.64,.91],[.84,.78],[.96,.59],[1,.37],[.95,.16],[.86,0],[.65,.025],[.30,.08],[0,.10],[-.30,.08],[-.65,.025],[-.86,0],[-.95,.16],[-1,.37],[-.96,.59],[-.84,.78],[-.64,.91],[-.35,.985]];
    function facial(v){const ex=s.eye[0],ey=s.eye[1],dx=(v[0]-ex)/(s.socket?.[0]||.16),dy=(v[1]-ey)/(s.socket?.[1]||.10),dent=Math.exp(-(dx*dx+dy*dy)*1.8),fenestra=Math.exp(-(((v[0]-ex-.20)/.17)**2+((v[1]-ey+.085)/.10)**2)*1.4),cheek=Math.exp(-(((v[0]-ex+.12)/.13)**2+((v[1]-ey+.12)/.12)**2));v[2]*=1-dent*.11-fenestra*.085+cheek*.09;return v;}
    let trunk=join(tailRows,s.body);
    if(!s.neckSweep)trunk=join(trunk,s.neck);
    use(0,'torso');
    if(s.neckSweep)profile(trunk,1.85);
    else loft(join(trunk,cranium),p=>{const t=clamp((p[0]-s.head[0][0]+.15)/.30,0,1);return skullContour.map(([z,y],i)=>{const a=i/20*TAU;return [mix(Math.sin(a),z,t),mix(.5+.5*Math.cos(a),y,t)];});},null,true,v=>v[0]>s.head[0][0]?facial(v):v);
    for(let j=0;j<m.data.length;j+=17){const x=m.data[j];if(x>=s.head[0][0])m.data[j+14]=1;else if(x<s.body[1][0])m.data[j+14]=3;
      const headMix=clamp((x-(s.head[0][0]-.18))/.35,0,1);if(headMix>0){m.data[j+15]=1;m.data[j+16]=headMix;}
      else if(x<s.tail[0][0]){let i=0;while(i<s.tail.length-2&&x<s.tail[i+1][0])i++;const a=s.tail[i],b=s.tail[i+1],t=clamp((x-a[0])/(b[0]-a[0]),0,1);m.data[j+12]=ti[i];m.data[j+15]=ti[i+1];m.data[j+16]=t;}
    }
    // Mask whole triangles. Moving only one corner off-screen would stretch
    // boundary faces across the image when a boss loses its head or tail.
    for(let j=0;j<m.data.length;j+=51){const x=(m.data[j]+m.data[j+17]+m.data[j+34])/3,part=x>=s.head[0][0]?1:x<s.body[1][0]?3:0;for(const o of [0,17,34])m.data[j+o+14]=part;}
    if(s.neckSweep){use(0,'torso');sweep(s.neckSweep,24,u=>[0,1,clamp((u-(s.neckSweep.length-2))/1.3,0,1)]);}
    // Skull sections have temporal breadth, a cheek wall, a real lip edge,
    // and a recessed palate. Their transverse shape is not a body section.
    const jawContour=[[0,1],[.35,1],[.68,1],[.88,.98],[1,.78],[.99,.46],[.83,.14],[.45,.025],[0,0],[-.45,.025],[-.83,.14],[-.99,.46],[-1,.78],[-.88,.98],[-.68,1],[-.35,1]];
    if(s.neckSweep){use(1,'head');loft(cranium,skullContour,null,true,facial);}
    // Closed lower lips follow the upper tooth line exactly; teeth sit
    // medial to both lips and are occluded by the opposing jaw at rest.
    const mandible=s.jaw.map(p=>{const h=at(s.head,p[0]),depth=p[1]-p[2];return [p[0],h[2]-.006,h[2]-.006-depth,Math.max(p[3],h[3]*.94)];});
    rig.jaw=[s.jawPivot[0],at(s.head,s.jawPivot[0])[2],0];rig.mouth=[s.mouth[0],at(s.head,s.mouth[0])[2]-.008,0];
    use(2,'lowerJaw');loft(mandible,jawContour);
    // Palate and tongue are inside the jaws, visible only when they open.
    use(1,'head',0,'#382729');loft(s.head.filter(p=>p[0]>=s.jaw[0][0]).map(p=>[p[0],p[2]+.011,p[2]+.006,p[3]*.66]),[[0,1],[1,0],[0,0],[-1,0]],null,false);
    use(2,'lowerJaw',0,'#604044');loft(mandible.map(p=>[p[0],p[1]+.006,p[1]+.002,p[3]*.68]),[[0,1],[1,0],[0,0],[-1,0]],null,false);
    if(s.beak){use(1,'head',0,'#514b3c');const h=s.head.at(-1),p=s.head.at(-2);profile([[p[0]-.01,p[1]-.04,p[2]+.012,p[3]*.92],h],2.4);}
    const headSamples=profileSamples(s.head,5).map(v=>v.p);
    function faceWidth(x,y){const h=at(headSamples,x),t=clamp((y-h[2])/(h[1]-h[2]),0,1),c=skullContour.slice(0,8).slice().reverse();let i=0;while(i<c.length-2&&c[i+1][1]<t)i++;return h[3]*mix(c[i][0],c[i+1][0],clamp((t-c[i][1])/(c[i+1][1]-c[i][1]),0,1));}
    function feather(p,d,n,length,width,color){
      const axis=norm(d),ac=norm(cross(axis,n)),mid=add(add(p,mul(axis,length*.26)),mul(n,width*.8)),tip=add(add(p,mul(axis,length)),mul(n,width*.5)),left=add(mid,mul(ac,width)),right=sub(mid,mul(ac,width)),ridge=add(mid,mul(n,width*.15)),rootL=add(p,mul(ac,width*.15)),rootR=sub(p,mul(ac,width*.15));
      // Convex vanes have thickness and a central ridge, so turns never show
      // the single flat paper triangles of the previous feather fans.
      tri(rootL,left,ridge,null,null,null,null,null,null,color,color,color.map(v=>v*1.12));tri(left,tip,ridge,null,null,null,null,null,null,color,color,color.map(v=>v*1.12));tri(tip,right,ridge,null,null,null,null,null,null,color,color,color.map(v=>v*1.12));tri(right,rootR,ridge,null,null,null,null,null,null,color,color,color.map(v=>v*1.12));tri(rootR,rootL,ridge,null,null,null,null,null,null,color,color,color);tri(rootL,tip,left,null,null,null,null,null,null,color,color,color);tri(rootL,rootR,tip,null,null,null,null,null,null,color,color,color);tri(rootR,right,tip,null,null,null,null,null,null,color,color,color);
    }
    if(s.feathers){
      const theri=key==='therizinosaurus';use(0,'torso',5);
      for(let row=0;row<44;row++)for(let j=0;j<31;j++){const x=mix(theri?-1.91:-1.65,s.body.at(-1)[0]+.015,row/43),a=(j+.41*(row%2))/31*TAU,p=at(trunk,x),n=norm([-.12,Math.cos(a),Math.sin(a)]),point=[x,(p[1]+p[2])*.5+Math.cos(a)*(p[1]-p[2])*.5,p[3]*Math.sin(a)],r=Math.sin(row*13+j*5)**2,red=clamp((Math.cos(a)-.20)*.8,0,.6)*r,col=theri?[mix(.25,.38,red),mix(.26,.16,red),mix(.25,.13,red)]:[.34+r*.1,.12,.09];use(x<s.tail[0][0]?ti[Math.min(ti.length-1,Math.floor((-x-.5)*1.5))]:0,x<s.tail[0][0]?'tail':'torso',5);feather(add(point,mul(n,.012)),[-.9,-.28-r*.21,Math.sin(a)*.15],n,(theri?.22:.17)+r*.11,theri?.018:.016,col.map(v=>v*(.74+r*.25)));}
      if(s.neckSweep){const pts=samples(s.neckSweep,9);for(let i=2;i<pts.length-1;i++)for(let j=0;j<25;j++){const p=pts[i].p,a=(j+i*.41)/25*TAU,axis=norm(sub(pts[Math.min(i+1,pts.length-1)].p.slice(0,3),pts[i-1].p.slice(0,3))),ac=norm(cross([0,0,1],axis)),n=add(mul(ac,Math.cos(a)),[0,0,Math.sin(a)]),point=add(p.slice(0,3),add(mul(ac,Math.cos(a)*p[3]),[0,0,Math.sin(a)*p[4]])),pale=i/pts.length,red=Math.max(0,-Math.cos(a))*.20,col=[.24+pale*.14+red,.25+pale*.15,.24+pale*.14],r=Math.sin(i*7+j*3)**2;use(i>pts.length-5?1:0,i>pts.length-5?'head':'torso',5);feather(add(point,mul(n,.01)),mul(axis,-1),n,.15+r*.08,.012,col.map(v=>v*(.8+r*.2)));}}
      use(1,'head',5);for(let i=0;i<12;i++)for(let j=0;j<20;j++){const x=mix(s.head[0][0],s.eye[0]+.055,i/11),p=at(headSamples,x),[z,y]=skullContour[j];if(y<.30)continue;const point=facial([x,mix(p[2],p[1],y),p[3]*z]),n=norm([-.15,y-.5,z]);feather(add(point,mul(n,.009)),[-1,-.12,z*.1],n,.065,.009,theri?[.42,.44,.415]:[.40,.14,.105]);}
    }
    const [ex,ey,,er]=s.eye,ez=facial([ex,ey,faceWidth(ex,ey)])[2]+(key==='drex'?.040:.006);
    for(const side of [-1,1]){
      use(1,'head',0,'#272b25');ell([ex,ey,side*ez],[er*1.7,er*1.3,.014]);
      use(1,'head',2,key==='therizinosaurus'?'#aaa99b':'#c49d44');ell([ex+.004,ey,side*(ez+.010)],[er,er*.88,.009]);
      use(1,'head',0,'#0f1613');ell([ex+.005,ey,side*(ez+.018)],[er*.39,er*.81,.003]);
      use(1,'head');for(const sign of [-1,1]){const pts=[];for(let i=0;i<7;i++){const t=i/6*Math.PI,x=ex-Math.cos(t)*er*1.75,y=ey+Math.sin(t)*er*1.24*sign,z=side*(faceWidth(x,y)*(1-Math.exp(-(((x-ex)/.16)**2+((y-ey)/.1)**2)*1.8)*.11)+.010);pts.push([x,y,z,er*.23,er*.28]);}sweep(pts,8,null,false,2);}
      // A nostril follows the nasal wall near the tip, above the closed lip.
      const nx=mix(ex,s.head.at(-1)[0],.81),nr=at(s.head,nx),ny=mix(nr[2],nr[1],.68),nz=faceWidth(nx,ny)+.004;
      use(1,'head',0,'#31372c');ell([nx,ny,side*nz],[er*1.05,er*.52,.008],12,8);
      // Keratin lip margins cover the tooth roots along the whole arcade.
      for(const lower of [false,true]){const rows=lower?mandible:s.head,pts=[];for(let i=0;i<22;i++){const x=mix(s.jaw[0][0]+.02,s.head.at(-1)[0]-.018,i/21),p=at(rows,x);pts.push([x,lower?p[1]-.003:p[2]+.003,side*p[3]*(lower?.91:.86),.006,.007]);}use(lower?2:1,lower?'lowerJaw':'head',0,'#625d4c');sweep(pts,8,null,false,2);}
    }
    if(s.frill){const f=s.frill;use(1,'head',4,cfg.body);const rows=[];for(let j=0;j<=8;j++){const r=j/8;rows.push(Array.from({length:40},(_,i)=>{const a=i/40*TAU,yy=Math.cos(a)*f.height*r,zz=Math.sin(a)*f.width*r;return [f.x+f.lean*r*r,f.y+yy,zz];}));}for(let j=0;j<8;j++)for(let i=0;i<40;i++){const a=rows[j][i],b=rows[j][(i+1)%40],c=rows[j+1][(i+1)%40],d=rows[j+1][i];tri(a,b,c);tri(a,c,d);}use(1,'head',0,'#aaa085');for(let i=0;i<18;i++){const a=i/18*TAU,p=rows[8][Math.round(i/18*40)%40];horn([p,add(p,[-.025,Math.cos(a)*.038,Math.sin(a)*.038])],.025);}}
    for(const h of s.horns||[]){use(1,'head',0,'#c8ba98');horn(h.slice(0,-1),h.at(-1));}
    if(s.teeth){const [start,end,count,len]=s.teeth;for(const side of [-1,1])for(let i=0;i<count;i++){const x=mix(start,end,i/(count-1)),h=at(s.head,x),j=at(mandible,x),z=side*h[3]*.71,l=Math.min(len*(.72+.28*Math.sin(i*2.1)**2),(j[1]-j[2])*.69);use(1,'head',0,'#c4b997');horn([[x,h[2]+.014,z],[x-.009,h[2]-l*.60,z*.98],[x-.021,h[2]-l,z*.94]],l*.19);const lx=x+.013,lh=at(s.head,lx),lj=at(mandible,lx);use(2,'lowerJaw',0,'#bdb298');horn([[lx,lj[1]-.014,side*lh[3]*.64],[lx-.009,lj[1]+l*.53,side*lh[3]*.63],[lx-.015,lj[1]+l*.70,side*lh[3]*.61]],l*.15);}}
    if(s.crest){use(1,'head');sweep(s.crest,16);}
    if(s.dome){use(1,'head');ell(s.dome.slice(0,3),s.dome.slice(3),32,20);}
    if(s.crestBlade){const [a,b,t]=s.crestBlade,tip=[...t,0],aa=[...a,.045],bb=[...b,.032],ab=[...a,-.045],ba=[...b,-.032];use(1,'head',4,key==='quetzalcoatlus'?'#80634e':cfg.body);tri(aa,bb,tip);tri(ab,tip,ba);tri(aa,tip,ab);tri(bb,ba,tip);tri(aa,ab,ba);tri(aa,ba,bb);}
    if(s.stygi)for(const side of [-1,1])for(let i=0;i<3;i++){use(1,'head',0,'#9c8b6e');horn([[.67-i*.052,1.84-i*.09,side*(.10+i*.005)],[.51-i*.064,1.91-i*.11,side*(.21+i*.028)],[.41-i*.048,1.95-i*.12,side*(.23+i*.03)]],.041-i*.005);}
    if(s.brows)for(const side of [-1,1]){use(1,'head');sweep([[ex-.10,ey+.046,side*ez*.85,.025,.036],[ex,ey+.053,side*ez*.95,.028,.035],[ex+.13,ey+.024,side*ez*.85,.007,.008]],12);}
    if(s.dilo){
      for(const side of [-1,1]){use(1,'head');const start=m.data.length;profile([[.73,.01],[.84,.22],[1.02,.26],[1.23,.12],[1.42,.01]].map(([x,h])=>{const p=at(s.head,x);return [x,p[1]+h,p[1]-.025,.018];}),1.8);for(let j=start;j<m.data.length;j+=17){m.data[j+2]+=side*.092;m.data[j+8]+=side*.092;}}
      rig.frills=[];const center=[.64,1.58,0];
      for(const side of [-1,1]){const id=bone('frill');rig.frills.push({id,side,pivot:center});use(id,'head',4);
        const point=(a,r)=>{const edge=1+.025*Math.cos(a*40),radius=.15+r*.69*edge;return [.65-.22*r*r+.029*Math.cos(a*40)*r,1.58+Math.cos(a)*radius*.92,side*Math.sin(a)*radius];};
        const pigment=(a,r)=>{const vein=Math.pow(Math.max(0,Math.cos(a*40)),8),patch=Math.sin(a*19+r*11)*Math.sin(a*7-r*14);let c=r>.92?[.13,.18,.14]:patch>.05?[.76,.51,.10]:[.52,.13,.075];return c.map(v=>v*(1-vein*.43)*( .83+.17*Math.sin(a*87+r*73)**2));};
        for(let i=0;i<64;i++)for(let j=0;j<9;j++){const a=.06+i/64*(Math.PI-.12),b=.06+(i+1)/64*(Math.PI-.12),r=j/9,t=(j+1)/9,aa=point(a,r),bb=point(b,r),cc=point(b,t),dd=point(a,t);tri(aa,bb,cc,null,null,null,null,null,null,pigment(a,r),pigment(b,r),pigment(b,t));tri(aa,cc,dd,null,null,null,null,null,null,pigment(a,r),pigment(b,t),pigment(a,t));}
      }
    }
    for(const [fore,spec] of [[false,s.hind],[true,s.fore]])if(spec)for(const side of [-1,1]){
      const part=side>0?(fore?'nearArm':'nearLeg'):(fore?'farArm':'farLeg'),upper=bone('upper'),lower=bone('lower'),toe=bone('foot'),pp=spec.points.map(p=>[p[0],p[1],side*spec.z,p[2],p[3]]),a=pp[0].slice(0,3),k=pp[1].slice(0,3),ankle=pp[2].slice(0,3),end=pp[3].slice(0,3),offset=fore?(side>0?.75:.25):(side>0?0:.5);
      rig.legs.push({base:a,knee:k,ankle,end,l1:Math.hypot(...sub(k,a)),l2:Math.hypot(...sub(ankle,k)),upper,lower,toe,offset,span:s.stride*s.duty,duty:s.duty,lift:s.lift,bend:spec.bend,fore});
      // A continuous skin crosses the knee and ankle; no sphere is attached
      // over either joint. Blending follows the skeleton on both sides.
      const skinPoints=pp.map(p=>p.slice());skinPoints[0][1]-=.16;skinPoints[0][2]*=.65;skinPoints[0][3]*=.72;skinPoints[0][4]*=.86;
      // Clawed rear feet need the metatarsal skin to reach the toe bases.
      // D-Rex bears its front weight on hands but retains these rear feet.
      if(s.kind==='biped'||s.handFeet&&!fore)skinPoints[3]=[end[0]-.08,.065,end[2],.065,spec.points[3][3]*.60];else skinPoints[3]=[ankle[0],.11,ankle[2],pp[2][3]*.95,pp[2][4]*.95];
      if(s.handFeet&&fore)skinPoints[3]=[end[0]-.08,.23,end[2],.095,.14];
      skinPoints.unshift([pp[0][0]-.03,pp[0][1]-.18,0,pp[0][3]*.48,pp[0][4]*.45]);
      use(upper,part);sweep(skinPoints,20,u=>{u-=1;return u<.75?[upper,lower,clamp((u-.55)/.9,0,.4)]:u<1.4?[upper,lower,clamp((u-.55)/.9,0,1)]:u<2.3?[lower,toe,clamp((u-1.55)/.9,0,1)]:[toe,0,0];},false);
      if(s.feathers){const samplesSkin=samples(skinPoints,12);use(upper,part,5);for(let i=10;i<23;i++)for(let j=0;j<23;j++){const p=samplesSkin[i].p,axis=norm(sub(samplesSkin[i+1].p.slice(0,3),samplesSkin[i-1].p.slice(0,3))),ac=norm(cross([0,0,1],axis)),wide=cross(axis,ac),a=(j+i*.43)/23*TAU,n=add(mul(ac,Math.cos(a)),mul(wide,Math.sin(a))),point=add(p.slice(0,3),add(mul(ac,Math.cos(a)*p[3]),mul(wide,Math.sin(a)*p[4])));feather(add(point,mul(n,.015)),[.05,-1,0],n,.17,.014,key==='therizinosaurus'?[.27,.28,.265]:[.37,.14,.09]);}}
      use(toe,part);const fx=end[0]-.04,fw=spec.points[3][3],fl=spec.points[3][2];
      if(s.kind==='biped'||s.handFeet){
        if(s.handFeet&&fore){
          // Upright metacarpals and curled fingers carry weight on the backs
          // of the middle phalanges. Claws fold inward, clear of the ground.
          use(toe,part);sweep([[end[0]-.13,.30,end[2],.10,.14],[end[0]-.04,.24,end[2],.105,.19],[end[0]+.045,.15,end[2],.075,.19]],18,null,false);
          for(let digit=0;digit<4;digit++){
            const z=end[2]+(digit-1.5)*.105,x=end[0]+.075-Math.abs(digit-1.5)*.01;
            use(toe,part);sweep([[x-.04,.205,z,.050,.049],[x+.025,.11,z,.052,.047],[x,.055,z,.042,.042],[x-.095,.105,z,.034,.033],[x-.11,.165,z,.020,.023]],14,null,false);
            use(toe,part,4,'#5d503a');ell([x+.014,.042,z],[.047,.022,.044],12,8);
            use(toe,part,0,'#514731');horn([[x-.10,.159,z],[x-.075,.207,z],[x-.035,.213,z]],.023);
          }
          use(toe,part);sweep([[end[0]-.10,.25,end[2]-side*.12,.063,.049],[end[0]-.14,.16,end[2]-side*.24,.044,.035],[end[0]-.065,.11,end[2]-side*.22,.030,.028]],12,null,false);
          use(toe,part,0,'#514731');horn([[end[0]-.07,.12,end[2]-side*.22],[end[0]-.01,.17,end[2]-side*.19]],.025);continue;
        }
        for(let digit=-1;digit<=1;digit++){
          const z=end[2]+digit*fw*.65,x=end[0],len=fl*(digit===0?1:.82);use(toe,part);
          sweep([[x-.09,.083,end[2],.058,.057],[x+.025,.058,z,.048,.041],[x+len*.72,.042,z+digit*.025,.028,.027],[x+len,.033,z+digit*.034,.012,.017]],12,null,false);
          use(toe,part,0,'#514c3d');horn([[x+len*.73,.058,z+digit*.025],[x+len+.055,.063,z+digit*.034],[x+len+.079,.017,z+digit*.035]],.028);
        }
        if(s.sickle){const z=end[2]-side*fw*.68;use(toe,part,0,'#514839');horn([[end[0]-.02,.09,z],[end[0]+.055,.205,z-side*.016],[end[0]+.15,.18,z-side*.018],[end[0]+.16,.075,z]],.035);}
        continue;
      }
      // Flat load-bearing pads meet the lower leg. Keratin nails are sunk
      // into the toes, rather than separate pale balls in front of the foot.
      const footSections=[[fx-fl,.07,.025,.015],[fx-fl*.5,.17,.009,fw*.85],[fx+fl*.4,.135,.008,fw],[fx+fl,.07,.019,fw*.7],[fx+fl*1.08,.045,.03,.015]];
      const footBefore=m.data.length;profile(footSections,2.6,false);for(let j=footBefore;j<m.data.length;j+=17){m.data[j+2]+=end[2];m.data[j+8]+=end[2];}
      use(toe,part,0,'#8c8270');for(let i=-1;i<=1;i++)ell([fx+fl*.91,.039,end[2]+i*fw*.51],[.035,.023,.027],10,6);
    }
    if(s.arms)for(const side of [-1,1]){
      const a=s.arms,part=side>0?'nearArm':'farArm',id=bone('arm'),pts=a.points.map(p=>[p[0],p[1],side*a.z,p[2],p[3]]);rig.arms.push({id,pivot:pts[0].slice(0,3),side});pts[0][1]-=.11;pts[0][2]*=.80;
      const root=pts[0];use(id,part);sweep([[root[0]-.03,root[1]-.07,0,root[3]*.45,root[4]*.45],...pts],18,null,false);const p=pts.at(-1);
      for(let i=0;i<a.fingers;i++){const theri=key==='therizinosaurus',z=p[2]+(i-(a.fingers-1)/2)*(theri?.095:.047),l=a.claw*(1-Math.abs(i-(a.fingers-1)/2)*.1);use(id,part);sweep([[p[0]-.025,p[1],z,.033,.028],[p[0]+.12,p[1]-.025,z+.012*side,.026,.022],[p[0]+.16,p[1]-.07,z+.019*side,.016,.013]],10,null,false);use(id,part,0,theri?'#403e35':'#67614e');horn(theri?[[p[0]+.14,p[1]-.06,z],[p[0]+.22,p[1]-.07-l*.28,z],[p[0]+.20,p[1]-.07-l*.68,z],[p[0]+.10,p[1]-.07-l,z]]:[[p[0]+.14,p[1]-.06,z],[p[0]+.19+l*.20,p[1]-.07-l*.33,z],[p[0]+.16+l*.24,p[1]-.07-l,z]],theri?.048:.026);}
      if(s.feathers){const sp=samples(pts,16);use(id,part,5);for(let i=1;i<sp.length-3;i++)for(let j=0;j<18;j++){const p=sp[i].p,axis=norm(sub(sp[i+1].p.slice(0,3),sp[i-1].p.slice(0,3))),ac=norm(cross([0,0,1],axis)),wide=cross(axis,ac),angle=(j+i*.4)/18*TAU,n=add(mul(ac,Math.cos(angle)),mul(wide,Math.sin(angle))),point=add(p.slice(0,3),add(mul(ac,Math.cos(angle)*p[3]),mul(wide,Math.sin(angle)*p[4])));feather(add(point,mul(n,.012)),add(axis,[-.13,-.25,0]),n,.13+.05*Math.sin(i+j)**2,.013,key==='pyroraptor'?[.38,.12,.09]:[.30,.31,.285]);}}
    }
    if(s.club){use(ti.at(-1),'tail',0,'#82765d');ell([-2.17,.43,0],[.245,.145,.26],20,12);}
    if(s.tailSpikes)for(const side of [-1,1])for(let i=0;i<2;i++){use(ti[3],'tail',0,'#a5a087');const p=[-1.88-i*.27,.74,side*.043];horn([p,add(p,[-.14,.12,side*.25]),add(p,[-.23,.21,side*.47])],.055);}
    if(s.plates){const pp=profileSamples(trunk).map(v=>v.p);for(let i=0;i<s.plates.length;i++){const [x,,h]=s.plates[i],side=i%2?1:-1,z=side*.095,y=at(pp,x)[1]-.04,w=.10+h*.20;use(x<s.tail[0][0]?ti[1]:0,'ridge',4,'#786e55');sweep([[x,y,z,w*.55,.036],[x+.025,y+h*.25,z+side*.025,w,.045],[x-.025,y+h*.66,z+side*.050,w*.85,.029],[x-.060,y+h,z+side*.068,.006,.004]],14,null,false);}}
    if(s.sail){const pp=profileSamples(trunk).map(v=>v.p);for(let i=0;i<s.sail.length-1;i++){const a=s.sail[i],b=s.sail[i+1],ay=at(pp,a[0])[1]-.045,by=at(pp,b[0])[1]-.045;use(0,'sail',4,i%2?'#784c3b':'#8f5b43');for(const side of [-1,1]){const z=side*.025;tri([a[0],ay,z],[b[0],by,z],[b[0],b[2],z]);tri([a[0],ay,z],[b[0],b[2],z],[a[0],a[2],z]);}use(0,'sail',4,'#665947');sweep([[a[0],ay,0,.017,.03],[a[0],a[2],0,.008,.012]],8,null,false);}}
    if(s.armor){const pp=profileSamples(trunk).map(v=>v.p);use(0,'ridge',4,'#665e4b');for(let row=-3;row<=3;row++)for(let i=0;i<9;i++){const x=-.76+i*.155+(Math.abs(row)%2)*.05,p=at(pp,x),angle=row*.35,z=Math.sin(angle)*p[3],y=(p[1]+p[2])/2+(p[1]-p[2])/2*Math.cos(angle);ell([x,y-.012,z],[.112,.045,.10],10,5);}for(const side of [-1,1])for(let i=0;i<8;i++){const x=-.70+i*.18,p=at(pp,x),y=(p[1]+p[2])*.5;horn([[x,y+.16,side*p[3]*.88],[x-.03,y+.22,side*(p[3]+.14)],[x-.10,y+.20,side*(p[3]+.22)]],.076);}}
    if(s.ridge||s.quills){use(0,key==='drex'?'torso':'ridge',0,'#707566');for(let i=0;i<18;i++){const x=-.68+i*.064,p=at(s.body,x),h=(s.quills?.12:.08)*( .72+.28*Math.sin(i*2.7)**2);horn([[x,p[1]-.025,0],[x-.050,p[1]+h*.65,0],[x-.10,p[1]+h,0]],.021);}}
    // Pterosaur wings have a fleshy arm, elongated fourth finger and a bowed
    // membrane. Their attachment, elbow and wrist are authored per species.
    if(s.wing)for(const side of [-1,1]){
      const id=bone('wing'),part=side>0?'wingNear':'wingFar',points=s.wing.map(p=>[p[0],p[1],p[2]*side]);rig.wings.push({id,pivot:points[0].slice(),side});points[0][2]*=.18;points[0][1]-=.09;
      use(id,part,3);wing(points,s.web.map(p=>[p[0],p[1],p[2]*side]));
      use(0,side>0?'nearLeg':'farLeg');sweep([[-.44,1.34,side*.13,.056,.048],[-.58,1.15,side*.31,.032,.029],[-.87,1.26,side*.41,.019,.02]],12,null,false);
      for(let i=0;i<3;i++){use(0,side>0?'nearLeg':'farLeg',0,'#514b40');horn([[-.86,1.26,side*(.38+i*.032)],[-.97,1.25,side*(.38+i*.038)]],.013);}
    }
    if(s.fins)for(const [index,f] of s.fins.entries())for(const side of [-1,1]){
      const id=bone('flipper'),pivot=[f.x,f.y,side*f.z];rig.wings.push({id,pivot,side,index});use(id,'flipper');
      sweep([[f.x,f.y,side*f.z,.13,f.chord*.47],[f.x-.16,f.y-.07,side*(f.z+f.span*.40),.068,f.chord*.60],[f.x-.43,f.y-.08,side*(f.z+f.span*.82),.039,f.chord*.35],[f.x-.62,f.y-.065,side*(f.z+f.span),.003,.009]],16,null,true);
    }
    if(s.dorsal){const [x,y,h]=s.dorsal;use(0,'ridge');sweep([[x+.18,y-.05,0,.24,.055],[x-.025,y+h*.56,0,.12,.03],[x-.23,y+h,0,.005,.006]],14);}
    if(s.fluke){const [x,y,up,down]=s.fluke;use(ti.at(-1),'tail');for(const [h,sign] of [[up,1],[down,-1]])sweep([[x,y,0,.17,.055],[x-.06,y+sign*h*.43,0,.15,.035],[x-.31,y+sign*h,0,.004,.004]],14);}
    if(s.tailVane){use(ti.at(-1),'tail',3,[.7,.1,.2]);tri([-1.44,1.33,0],[-1.66,1.53,0],[-1.91,1.33,0]);tri([-1.44,1.33,0],[-1.66,1.14,0],[-1.91,1.33,0]);}
    return {vertices:new Float32Array(m.data),vertexStride:17,bones,parts:m.parts,rig,cfg,key,anatomy:s};
  }
  function pose(m,phase,roar=0,frill=roar){
    const s=m.anatomy,r=m.rig,bob=Math.sin(phase*2)*.008,ms=Array.from({length:48},I);ms[0]=T(0,bob,0);ms[1]=MM(ms[0],R(Math.sin(phase)*.009-roar*.04,r.head));ms[2]=MM(ms[1],R(-roar*(s.gape||(s.teeth?.48:.17)),r.jaw));
    for(const l of r.legs){const f=foot(phase,l.offset,l.span,l.duty,l.lift),aa=add(l.base,[0,bob,0]),bb=add(l.ankle,[f.x,f.y,0]),kk=knee(aa,bb,l.l1,l.l2,l.bend);ms[l.upper]=segment(l.base,l.knee,aa,kk);ms[l.lower]=segment(l.knee,l.ankle,kk,bb);ms[l.toe]=T(f.x,f.y,0);}
    for(const a of r.arms)ms[a.id]=MM(ms[0],R(Math.sin(phase+a.side)*.045,a.pivot));
    for(const w of r.wings)ms[w.id]=MM(ms[0],R(Math.sin(phase+(w.index||0)*.75)*(s.wingAmplitude||.23)*w.side,w.pivot,'x'));
    for(const f of r.frills||[]){const fold=I();fold[5]=.44+.56*frill;fold[10]=.045+.955*frill;fold[12]=-.055*(1-frill);fold[13]=f.pivot[1]*(1-fold[5]);ms[f.id]=MM(ms[1],fold);}
    for(const t of r.tails){const f=t.i/(r.tails.length-1);ms[t.id]=T(0,bob*(1-f),Math.sin(phase-f*2)*.06*f);}
    return new Float32Array(ms.flat());
  }
  for(const [k,s] of Object.entries(S))CreatureMeshes.catalog[k].stride=s.stride;
  return {has:key=>!!S[key],build,pose,foot,profileSamples,species:S};
})();
