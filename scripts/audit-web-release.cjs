'use strict';
// Check the worktree normally, or the exact pending commit with --staged.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),staged=process.argv.includes('--staged'),git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:32e6});
const read=file=>staged?git('show',':'+file).toString():fs.readFileSync(path.join(root,file),'utf8');
const ctx=vm.createContext({}),source=read('js/data.js');vm.runInContext(source+';globalThis.result={VERSION,CHANGELOG};',ctx);
const {VERSION,CHANGELOG}=ctx.result,sw=read('sw.js'),cache=sw.match(/const CACHE = '([^']+)'/)[1],shell=[...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]==='./'?'index.html':m[1]);
const html=read('index.html'),scripts=[...html.matchAll(/<script\s+src="([^":]+)"/g)].map(m=>m[1]),errors=[],review=[],seen=new Set(),files=[...new Set([...shell,'sw.js',...scripts])];
for(const file of files){try{if(staged)git('cat-file','-e',':'+file);else if(!fs.existsSync(path.join(root,file)))throw Error();}catch{errors.push('Missing '+(staged?'staged':'local')+' dependency: '+file);}}
for(const file of scripts)if(!shell.includes(file))errors.push('Script missing from offline shell: '+file);
const stop=new Set(['dinosaur','dinosaurs','weapon','weapons','screen','player','players','island','before','through','instead','without','better','around','little','across','banked','proper','properly','anything','everything']);
const words=s=>new Set((s.toLowerCase().match(/[a-z]{6,}/g)||[]).filter(w=>!stop.has(w)));
for(const entry of CHANGELOG){
 if(seen.has(entry.date))errors.push('Duplicate changelog day: '+entry.date);seen.add(entry.date);
 if(entry.items.length>8)review.push(entry.v+': review '+entry.items.length+' bullets for split enhancements');
 for(const item of entry.items)if(item.length>120)errors.push(entry.v+': long bullet: '+item);
 for(let a=0;a<entry.items.length;a++)for(let b=a+1;b<entry.items.length;b++){const wb=words(entry.items[b]),shared=[...words(entry.items[a])].filter(w=>wb.has(w));if(shared.length>=2)review.push(entry.v+': possible split ('+shared.join(', ')+')');}
}
if(CHANGELOG[0].v!==VERSION)review.push('Top changelog version differs from VERSION; only expected for an invisible release');
console.log(JSON.stringify({source:staged?'index':'worktree',version:VERSION,cache,assets:files.length,days:CHANGELOG.length,bullets:CHANGELOG.reduce((n,c)=>n+c.items.length,0),review,errors},null,2));
if(errors.length)process.exitCode=1;
