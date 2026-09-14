'use strict';
// Reconstruct the delivered jaw surface; the old flat rear cap fails this
// check even though its geometry and bone indices were otherwise valid.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),context=vm.createContext({Float32Array,Math});
vm.runInContext(['creature-meshes','creature-species','creature-anatomy'].map(n=>fs.readFileSync(path.join(root,'js',n+'.js'),'utf8')).join('\n')+';globalThis.meshes=CreatureMeshes;',context);
const directory=process.argv[2]||path.join(root,'assets/creatures/skinned');let surfaces=0,posedVertices=0;
const transform=(p,id,pose)=>{const k=id*16;return [0,1,2].map(a=>pose[k+a]*p[0]+pose[k+4+a]*p[1]+pose[k+8+a]*p[2]+pose[k+12+a]);};
for(const key of Object.keys(context.meshes.catalog)){
 const m=context.meshes.build(key),buffer=zlib.gunzipSync(fs.readFileSync(path.join(directory,key+'.mesh.gz'))),exported=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.length/4);
 for(const [label,v]of [['exported',exported],['fallback',m.vertices]]){
  const points=[],parents=[],ids=new Map(),edges=new Map();let rearCap=0;
  const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
  const row=m.anatomy.jaw[0],depth=row[1]-row[2];
  for(let i=0;i<v.length;i+=51){if(v[i+13]!==1||v[i+14]!==2)continue;const tri=[];
   for(const j of [i,i+17,i+34]){const p=Array.from(v.slice(j,j+3)),id=p.map(x=>Math.round(x*1e6)).join(',');if(!ids.has(id)){ids.set(id,points.length);parents.push(points.length);points.push({p,a:v[j+12],b:v[j+15],w:v[j+16]});}const n=ids.get(id),q=points[n];assert.equal(q.a,v[j+12],key+' duplicate seam bone');assert.equal(q.b,v[j+15],key+' duplicate seam bone');assert.ok(Math.abs(q.w-v[j+16])<1e-5,key+' duplicate seam weight');tri.push(n);}
   for(const id of tri)parents[find(id)]=find(tri[0]);
   for(let j=0;j<3;j++){const e=[tri[j],tri[(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(e,(edges.get(e)||0)+1);}
   const [a,b,c]=tri.map(n=>points[n].p);
   if(Math.max(a[0],b[0],c[0])-Math.min(a[0],b[0],c[0])<1e-6&&a[0]<=row[0]+1e-5)rearCap+=Math.abs((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]))*.5;
  }
  assert.ok(rearCap<depth*row[3]*.025,key+' '+label+': broad exposed vertical rear cap');
  assert.equal(new Set(points.map((_,i)=>find(i))).size,1,key+' '+label+': detached jaw pieces');
  assert.ok([...edges.values()].every(n=>n===2),key+' '+label+': open jaw surface');
  const anchored=points.filter(p=>p.a===1&&p.w<1e-6),free=points.filter(p=>p.b===2&&p.w>.999999),bend=points.filter(p=>p.w>.01&&p.w<.99);
  assert.ok(anchored.length>8&&free.length>60&&bend.length>24,key+' '+label+': missing attached hinge or rigid free jaw');
  const mouth=points.filter(p=>p.p[0]>=m.rig.mouth[0]);assert.ok(mouth.every(p=>p.b===2&&p.w>.999999),key+' '+label+': bite tip bends independently of teeth');
  if(key==='brachiosaurus'){
   // A rigid jaw can still have the wrong shape: the first film pass curled
   // its front edge upward by half the rear jaw depth. Measure the actual
   // loft's top edge, including the delivered mesh, independently of pose.
   const top=new Map();for(const {p}of mouth){const x=Math.round(p[0]*1e6);top.set(x,Math.max(top.get(x)??-Infinity,p[1]));}
   const tip=top.get(Math.max(...top.keys())),lowest=Math.min(...top.values());
   assert.ok(tip-lowest<depth*.12,key+' '+label+': upturned lower-jaw tip');
  }
  for(let frame=0;frame<=16;frame++){
   const pose=context.meshes.pose(m,frame/16*Math.PI*2,frame/16);
   for(const q of [...anchored,...bend,...free.filter((_,i)=>i%17===0)]){
    const a=transform(q.p,q.a,pose),b=transform(q.p,q.b,pose),p=a.map((x,i)=>x+(b[i]-x)*q.w);assert.ok(p.every(Number.isFinite));
    if(q.w<1e-6)assert.ok(Math.hypot(...p.map((x,i)=>x-transform(q.p,1,pose)[i]))<1e-6,key+' hinge separates from head');
    if(q.w>.999999)assert.ok(Math.hypot(...p.map((x,i)=>x-transform(q.p,2,pose)[i]))<1e-6,key+' free jaw diverges from teeth');posedVertices++;
   }
  }
  surfaces++;
 }
}
console.log('PASS: rounded closed jaw surfaces, attached hinges and rigid bite tips',{species:33,surfaces,posedVertices});
