'use strict';
// Validate the actual exported surfaces, including regressions that the old
// whole-animal union fails. No browser/GPU is needed for these topology checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({Float32Array,Math});
vm.runInContext(['creature-meshes','creature-species','creature-anatomy'].map(n=>fs.readFileSync(path.join(root,'js',n+'.js'),'utf8')).join('\n')+';globalThis.meshes=CreatureMeshes;',ctx);
const oldDirectory=process.argv[2];let triangles=0,knuckleSamples=0,invalid=0;
// The rear ankle and toe bases must belong to the same exported skin surface.
// Position welding reconstructs topology from the GPU's triangle soup.
function checkRearFoot(v,m,l){
 const part=m.parts.indexOf(l.end[2]>0?'nearLeg':'farLeg'),points=[],parents=[],ids=new Map();
 const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
 for(let i=0;i<v.length;i+=51){if(v[i+13]!==1||v[i+14]!==part)continue;const tri=[];
  for(const j of [i,i+17,i+34]){const p=[v[j],v[j+1],v[j+2]],key=p.join(',');if(!ids.has(key)){ids.set(key,points.length);parents.push(points.length);points.push(p);}tri.push(ids.get(key));}
  for(const id of tri)parents[find(id)]=find(tri[0]);
 }
 const nearest=p=>{let best=-1,distance=Infinity;points.forEach((q,i)=>{const d=q.reduce((n,x,j)=>n+(x-p[j])**2,0);if(d<distance){distance=d;best=i;}});assert.ok(best>=0,'Missing rear-leg skin');return find(best);};
 const ankle=nearest(l.ankle),width=m.anatomy.hind.points[3][3];
 for(const digit of [-1,0,1])assert.equal(nearest([l.end[0]+.08,.06,l.end[2]+digit*width*.65]),ankle,'D-Rex rear toes detach from ankle');
}
for(const key of Object.keys(ctx.meshes.catalog)){
 const file=path.join(oldDirectory||path.join(root,'assets/creatures/skinned'),key+'.mesh.gz');if(oldDirectory&&!fs.existsSync(file))continue;
 const m=ctx.meshes.build(key),bytes=zlib.gunzipSync(fs.readFileSync(file)),v=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),owners=new Map();
 m.rig.legs.forEach((l,i)=>[l.upper,l.lower,l.toe].forEach(b=>owners.set(b,'leg'+i)));
 m.rig.arms.forEach((a,i)=>owners.set(a.id,'arm'+i));m.rig.wings.forEach((w,i)=>owners.set(w.id,'wing'+i));
 (m.rig.grips||[]).forEach((g,i)=>[g.id,...g.digits.map(d=>d.id)].forEach(b=>owners.set(b,'grip'+i)));
 let crossed=0,bodyDrag=0;
 for(let i=0;i<v.length;i+=51){const groups=new Set();for(const p of [i,i+17,i+34])for(const [bone,weight] of [[v[p+12],1-v[p+16]],[v[p+15],v[p+16]]])if(weight>1e-4&&owners.has(bone)){groups.add(owners.get(bone));if(v[p+14]===0)bodyDrag++;}if(groups.size>1)crossed++;triangles++;}
 invalid+=crossed+bodyDrag;
 if(oldDirectory){console.log(key,{trianglesAcrossLimbs:crossed,torsoVerticesDraggedByLimbs:bodyDrag});continue;}
 assert.equal(crossed,0,key+': triangles join unrelated limbs');assert.equal(bodyDrag,0,key+': unrelated limb weights drag the torso');
 if(key==='drex')for(const l of m.rig.legs.filter(l=>!l.fore))checkRearFoot(v,m,l);
 if(key==='drex')for(const l of m.rig.legs.filter(l=>l.fore)){
   const hand=[];for(let i=0;i<v.length;i+=17)if(v[i+12]===l.toe&&v[i+16]<.001&&Math.abs(v[i+2]-l.end[2])<.32&&v[i+1]<.25)hand.push([v[i],v[i+1],v[i+2],v[i+13]]);
   assert.ok(hand.length>100,'Missing curled front hand');
   const pads=hand.filter(p=>p[3]===4);assert.ok(pads.length>50,'Missing weight-bearing knuckle pads');
   const ground=Math.min(...pads.map(p=>p[1]));assert.ok(ground>=0&&ground<.035,'Knuckle pads miss ground');
   const claws=hand.filter(p=>p[3]===0);assert.ok(claws.length>10);assert.ok(Math.min(...claws.map(p=>p[1]))>.065,'Curled claws touch ground');
   assert.ok(Math.max(...hand.map(p=>p[0]))-l.end[0]<.17,'Front fingers still splay forward as toes');
   for(let f=0;f<48;f++){const phase=f/48*Math.PI*2,pose=ctx.meshes.pose(m,phase,0),a=l.toe*16;if(pose[a+13]===0){for(const p of pads){const y=p[0]*pose[a+1]+p[1]*pose[a+5]+p[2]*pose[a+9]+pose[a+13];assert.ok(Math.abs(y-p[1])<1e-6,'Planted knuckles lift or sink');knuckleSamples++;}}}
 }
}
if(oldDirectory){assert.ok(invalid>0,'Historical fixture should reproduce the skin welding defect');console.log('Reproduced historical skin defect:',invalid);}
else console.log('PASS:',{species:33,triangles,unrelatedLimbTriangles:invalid,plantedKnuckleSamples:knuckleSamples});
