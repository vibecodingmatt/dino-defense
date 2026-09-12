'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),destination=path.resolve(process.argv[2]||path.join(__dirname,'build/input'));
const ctx=vm.createContext({Float32Array,Math});
vm.runInContext(['creature-meshes','creature-species','creature-anatomy'].map(n=>fs.readFileSync(path.join(root,'js',n+'.js'),'utf8')).join('\n')+';globalThis.build=CreatureMeshes.build;globalThis.keys=Object.keys(CreatureMeshes.catalog);',ctx);
fs.mkdirSync(destination,{recursive:true});
for(const key of process.argv.slice(3).length?process.argv.slice(3):ctx.keys){
  const m=ctx.build(key);if(!m)throw Error('Unknown creature '+key);
  fs.writeFileSync(path.join(destination,key+'.bin'),Buffer.from(m.vertices.buffer));
  fs.writeFileSync(path.join(destination,key+'.json'),JSON.stringify({key,anatomy:m.anatomy,rig:m.rig}));
  console.log(key,m.vertices.length/17);
}
