'use strict';
// Test the delivered mesh, not just the generator: detached support tubes and
// the membrane used to be separate components even though they shared a bone.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({Float32Array,Math});
vm.runInContext(['creature-meshes','creature-species','creature-anatomy'].map(n=>fs.readFileSync(path.join(root,'js',n+'.js'),'utf8')).join('\n')+';globalThis.meshes=CreatureMeshes;',ctx);
const directory=process.argv[2]||path.join(root,'assets/creatures/skinned');let checkedWings=0,motionSamples=0;
function check(v,m,label){
 for(const wing of m.rig.wings){
  const part=m.parts.indexOf(wing.side>0?'wingNear':'wingFar'),points=[],parents=[],ids=new Map(),edges=new Map(),copies=new Map();
  const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
  for(let i=0;i<v.length;i+=51){if(v[i+14]!==part)continue;const face=[];
   for(const j of [i,i+17,i+34]){
    const key=[v[j],v[j+1],v[j+2]].join(',');
    if(!ids.has(key)){ids.set(key,points.length);parents.push(points.length);points.push([v[j],v[j+1],v[j+2]]);copies.set(key,[]);}face.push(ids.get(key));copies.get(key).push(j);
   }
   for(let k=0;k<3;k++){parents[find(face[k])]=find(face[0]);const edge=[face[k],face[(k+1)%3]].sort((a,b)=>a-b).join(',');edges.set(edge,(edges.get(edge)||0)+1);}
  }
  assert.ok(points.length>100,label+': missing wing surface');
  assert.equal(new Set(points.map((_,i)=>find(i))).size,1,label+': wing supports detach from the membrane');
  assert.equal([...edges.values()].filter(n=>n!==2).length,0,label+': wing skin has open or non-manifold seams');
  // Skin must actually enclose the authored wrist/finger, not merely omit the
  // supports. Inspect a cross-section through the wrist in the exported mesh.
  const wrist=m.anatomy.wing[2],section=points.filter(p=>Math.abs(Math.abs(p[2])-wrist[2])<.008&&Math.abs(p[0]-wrist[0])<.04);
  assert.ok(section.some(p=>p[1]>wrist[1]+.018)&&section.some(p=>p[1]<wrist[1]-.018),label+': wrist lacks a skin-covered solid cross-section');
  // Shared positions must remain welded after skinning, including opposite
  // surfaces at the leading/trailing edges, through a complete flap cycle.
  for(let frame=0;frame<32;frame++){
   const pose=ctx.meshes.pose(m,frame/32*Math.PI*2,0);
   for(const list of copies.values()){
    let first;
    for(const j of list){const p=[0,0,0];for(const [bone,weight] of [[v[j+12],1-v[j+16]],[v[j+15],v[j+16]]])for(let k=0;k<3;k++)p[k]+=weight*(pose[bone*16+k]*v[j]+pose[bone*16+4+k]*v[j+1]+pose[bone*16+8+k]*v[j+2]+pose[bone*16+12+k]);
     if(first)assert.ok(Math.hypot(...p.map((x,k)=>x-first[k]))<1e-6,label+': wing seam separates during flap');else first=p;motionSamples++;
    }
   }
  }
  checkedWings++;
 }
}
for(const key of ['whiteptera','pteranodon','dimorphodon','quetzalcoatlus']){
 const m=ctx.meshes.build(key),bytes=zlib.gunzipSync(fs.readFileSync(path.join(directory,key+'.mesh.gz')));
 check(new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),m,key+' exported');
 if(!process.argv[2])check(m.vertices,m,key+' procedural fallback');
}
console.log('PASS: connected, closed wing skin encloses its supports throughout the flap cycle',{checkedWings,motionSamples});
