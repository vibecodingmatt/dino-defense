'use strict';
// Reproducible original effects. No browser, sound library or film recordings.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..'),fx=vm.runInNewContext(fs.readFileSync(path.join(root,'js/audio-fx.js'),'utf8')+';GameAudioFX;');
const entries=[],chunks=[];let offset=0;
for(const name of fx.names)for(let variant=0;variant<3;variant++){
  const pcm=fx.render(name,variant),bytes=Buffer.alloc(pcm.length*2);let peak=0;
  for(let i=0;i<pcm.length;i++){if(!Number.isFinite(pcm[i]))throw Error(name+': invalid sample');peak=Math.max(peak,Math.abs(pcm[i]));bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),i*2);}
  if(peak<.05||peak>.9)throw Error(name+': invalid headroom '+peak);
  entries.push({name,variant,offset,length:pcm.length});offset+=bytes.length;chunks.push(bytes);
}
const header=Buffer.from(JSON.stringify({version:1,sampleRate:fx.sampleRate,entries})),size=Buffer.alloc(4);size.writeUInt32LE(header.length);
const packed=zlib.gzipSync(Buffer.concat([size,header,...chunks]),{level:9}),out=path.join(root,'assets/audio');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'effects-v1.bank.gz'),packed);
console.log(JSON.stringify({sounds:fx.names.length,variants:entries.length,pcmBytes:offset,compressedBytes:packed.length}));
