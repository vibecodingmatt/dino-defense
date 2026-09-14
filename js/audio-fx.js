'use strict';
/* Original, deterministic sound design. Short PCM performances combine air,
   resonant metal, pressure, combustion and irregular transients. One cached
   buffer/voice keeps a large battle cheaper than dozens of live oscillators.
   Music keeps its own instruments and hall in game.js. No imported samples. */
const GameAudioFX=(()=>{
  const SR=32000,TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const specs={
    shot:[.27,.26,.028,0],dart:[.24,.18,.055,0],snipe:[1.05,.57,.10,1],
    flame:[.48,.25,.16,0],missile:[.67,.35,.09,1],thoomp:[.72,.48,.09,1],
    novaCharge:[.85,.28,.40,1],novaLaunch:[1.05,.57,.10,2],novaImpact:[2.15,.65,.16,2],
    zap:[.46,.29,.085,1],arc:[.19,.10,.065,0],cryo:[.65,.30,.10,1],
    frost:[.58,.25,.10,1],pulse:[.90,.44,.12,1],gas:[.56,.22,.16,0],
    boom:[1.25,.56,.085,2],shellImpact:[1.65,.66,.12,2],impact:[.18,.10,.07,0],
    deflate:[.86,.18,.18,1],sizzle:[1.05,.22,.18,1],koBoing:[.62,.22,.14,1],
    shatter:[1.08,.37,.13,2],notePop:[.90,.23,.18,1],whoo:[1.15,.20,.30,1],
    punt:[.67,.28,.18,1],whistleIn:[.70,.19,.18,1],thud:[.92,.46,.14,2],
    roar:[2.45,.68,.80,3],trexRoar:[2.65,.73,.90,3],bossDie:[2.45,.56,.75,3],
    screech:[.54,.22,.16,1],snarl:[.72,.27,.24,1],bellow:[1.3,.34,.40,1],pteraWail:[1.4,.34,.45,2],
    build:[.58,.29,.05,2],upgrade:[.92,.28,.09,2],coin:[.40,.12,.12,1],
    fanfare:[1.25,.27,.30,3],error:[.26,.15,.12,2],leak:[.95,.36,.30,3],
    alert:[.84,.25,.20,3],jet:[2.75,.49,1.0,3],heartbeat:[1.4,.39,.65,3],
    firework:[1.10,.32,.12,2],victoryTune:[2.10,.35,.75,3]
  };
  let bank=null,bankPromise=null,bankError='';
  function prepare(){
    if(bankPromise)return bankPromise;
    bankPromise=fetch('assets/audio/effects-v1.bank.gz').then(async response=>{
      if(!response.ok)throw Error('Sound bank HTTP '+response.status);
      const bytes=await response.arrayBuffer(),raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const view=new DataView(raw),size=view.getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,4,size)));
      if(header.version!==1||header.sampleRate!==SR||header.entries?.length!==Object.keys(specs).length*3)throw Error('Sound bank format');
      const seen=new Set();for(const e of header.entries){const key=e.name+':'+e.variant;
        if(!specs[e.name]||!Number.isInteger(e.variant)||e.variant<0||e.variant>2||seen.has(key)||!Number.isInteger(e.offset)||e.offset<0||e.offset%2||!Number.isInteger(e.length)||e.length<1||e.length>SR*4||4+size+e.offset+e.length*2>raw.byteLength)throw Error('Sound bank entry');seen.add(key);}
      bank={view,start:4+size,entries:new Map(header.entries.map(e=>[e.name+':'+e.variant,e]))};return true;
    }).catch(e=>{bankError=e.message;return false;});return bankPromise;
  }
  function performance(name,variant){
    const e=bank?.entries.get(name+':'+variant);if(!e)return render(name,variant);
    const pcm=new Float32Array(e.length),start=bank.start+e.offset;for(let i=0;i<e.length;i++)pcm[i]=bank.view.getInt16(start+i*2,true)/32767;return pcm;
  }
  function random(seed){return ()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};}
  function seedOf(name){let h=2166136261;for(let i=0;i<name.length;i++)h=Math.imul(h^name.charCodeAt(i),16777619);return h>>>0;}
  function render(name,variant=0){
    if(!specs[name])throw Error('Unknown sound '+name);
    const dur=specs[name][0],pcm=new Float32Array(Math.ceil(dur*SR)),rand=random(seedOf(name)^Math.imul(variant+1,0x9e3779b9));
    // RBJ band/low/high-pass noise and integrated, jittered pitch curves.
    // Each layer has a finite attack and release, including delayed foley.
    function layer(o){
      const start=Math.floor((o.t||0)*SR),length=Math.ceil(o.d*SR),a=Math.max(.00025,o.a||.001),release=o.r||.015;
      let phase=rand()*TAU,x1=0,x2=0,y1=0,y2=0,b0=1,b1=0,b2=0,a1=0,a2=0,drift=0;
      for(let j=0;j<length&&start+j<pcm.length;j++){
        const t=j/SR,q=j/length,f=(o.f||100)*Math.pow((o.end||o.f||100)/(o.f||100),q),white=rand()*2-1;
        drift=drift*.994+white*.006;
        let v;
        if(o.noise){
          if(j%64===0){const w=TAU*clamp(f,25,14500)/SR,c=Math.cos(w),alpha=Math.sin(w)/(2*(o.q||.707)),den=1+alpha;
            a1=-2*c/den;a2=(1-alpha)/den;
            if(o.noise==='high'){b0=(1+c)*.5/den;b1=-(1+c)/den;b2=b0;}
            else if(o.noise==='band'){b0=alpha/den;b1=0;b2=-b0;}
            else {b0=(1-c)*.5/den;b1=(1-c)/den;b2=b0;}}
          v=b0*white+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=white;y2=y1;y1=v;
        }else{
          phase+=TAU*f*(1+drift*(o.rough||0)+.003*Math.sin(t*43))/SR;
          v=Math.sin(phase+(o.fm||0)*Math.sin(phase*(o.ratio||2.71)));
          if(o.harm)v=(v+o.harm*Math.sin(phase*2+.3)+o.harm*.4*Math.sin(phase*3))/(1+o.harm*.7);
        }
        const env=Math.min(1,t/a)*Math.exp(-q*(o.decay===undefined?6:o.decay))*Math.min(1,(o.d-t)/release);
        const flutter=o.flutter?1-o.flutter*.5+o.flutter*.5*Math.sin(TAU*(o.rate||21)*t+Math.sin(t*31)):1;
        pcm[start+j]+=v*env*flutter*o.g;
      }
    }
    const air=(t,d,g,f,end,extra={})=>layer({t,d,g,f,end,noise:'band',...extra});
    const bass=(t,d,g,f=110,end=38,extra={})=>layer({t,d,g,f,end,...extra});
    const metal=(t,f,g,d=.11)=>{[1,2.71,4.09].forEach((r,i)=>layer({t,d:d/(1+i*.45),g:g/(1+i*1.5),f:f*r,decay:7,fm:i?.2:.5,ratio:1.414}));};
    const chips=(t,n,g,span=.36,base=1700)=>{for(let i=0;i<n;i++){const at=t+rand()*span,f=base*(.6+rand()*1.4);air(at,.018+rand()*.07,g*(.35+rand()*.65),f,f*.45,{noise:'high'});if(i%2===0)metal(at,f,g*.22,.035+rand()*.13);}};
    const blast=(heavy=false)=>{air(0,.045,.72,2700,1100,{noise:'high'});bass(.005,heavy?1.2:.82,1.0,heavy?98:160,32,{harm:.25,decay:7});air(.009,heavy?1.4:.88,1.9,heavy?670:1250,65,{noise:'low',decay:5});air(.025,.64,.45,2400,360,{a:.022});chips(.12,heavy?20:13,.22,heavy?.90:.6,1000);};
    function voice(f,length,kind=0){
      // Irregular glottal pulses through moving chest/throat/nasal formants;
      // subharmonics and unvoiced breath avoid the old sawtooth robot growl.
      const offset=.025,weights=new Float32Array(23);let ph=0,jitter=1,cycle=0,low=0;
      for(let j=0;j<length*SR&&j<pcm.length;j++){
        const t=j/SR,q=t/length,en=Math.min(1,t/.10)*Math.min(1,(length-t)/.20)*(.68+.32*Math.sin(q*Math.PI))*(1-.30*Math.exp(-(((q-.63)/.08)**2)));
        const hz=f*(1+.64*Math.sin(Math.min(1,q*1.65)*Math.PI))*(1-q*.52)*jitter;
        ph+=hz/SR;if(ph>=1){ph-=1;jitter=.90+rand()*.20;cycle++;}
        const pulse=(Math.exp(-ph*8)-.125),breath=rand()*2-1;low=low*.94+breath*.06;
        let value=0;
        for(let k=1;k<=22;k++){
          if(j%128===0){const freq=hz*k,form1=kind===1?480:kind===2?280:380,form2=kind===1?1470:kind===2?660:1020;
            weights[k]=(.8*Math.exp(-(((freq-form1*(1+.2*Math.sin(q*6)))/180)**2))+.48*Math.exp(-(((freq-form2)/370)**2))+.23*Math.exp(-(((freq-2350)/650)**2)))/Math.sqrt(k);}
          value+=Math.sin(TAU*ph*k+low*2)*weights[k];
        }
        pcm[j]+=en*(value*.34+pulse*.22+(cycle%2?1:-1)*pulse*.13+low*.25)*(1+.10*Math.sin(t*31+q*17));
      }
      air(offset,length,.35,kind===1?1650:520,kind===1?700:210,{q:.8,a:.085,decay:1.8,flutter:.65,rate:13});
    }
    switch(name){
      case 'shot':
        air(0,.018,.95,3200,1500,{noise:'high'});air(.002,.09,.72,1500,430,{q:.6});bass(0,.09,.62,195,62,{harm:.23});
        metal(.024,780,.12,.06);metal(.11+rand()*.05,2300,.09,.055);air(.045,.16,.13,2400,650);break;
      case 'dart':air(0,.13,.7,1800,600,{a:.003});metal(.005,1100,.17,.045);bass(0,.10,.25,220,100);break;
      case 'snipe':air(0,.027,1.2,2600,1400,{noise:'high'});bass(0,.29,.9,170,43,{harm:.35});air(.005,.22,1.1,1850,230,{noise:'low'});air(.08,.70,.27,1500,180);metal(.29,430,.22,.065);metal(.36,970,.18,.05);chips(.1,7,.12,.55);break;
      case 'flame':metal(0,710,.12,.045);air(.014,.12,1.2,580,180,{noise:'low',a:.012});air(.035,.42,1.15,1250,460,{a:.025,decay:1.8,flutter:.6,rate:17});bass(.02,.37,.28,74,53,{a:.028,decay:3,harm:.38});chips(.10,10,.16,.29,2900);break;
      case 'missile':metal(0,640,.28,.07);air(.01,.09,.85,900,250,{noise:'low'});air(.045,.57,1.15,480,2800,{a:.025,decay:2.7,flutter:.3});bass(.02,.43,.46,85,150,{a:.025,decay:4,harm:.3});break;
      case 'thoomp':metal(0,310,.22,.065);bass(.006,.42,1.0,125,39,{harm:.3});air(.006,.22,1.4,600,130,{noise:'low'});air(.07,.50,.28,900,350);metal(.24,370,.11,.12);break;
      case 'novaCharge':metal(0,420,.20,.12);bass(.03,.80,.45,58,175,{a:.25,decay:.2,harm:.4,flutter:.25,rate:29});layer({t:.04,d:.79,g:.36,f:220,end:1450,a:.35,decay:.1,fm:1.4,ratio:1.618});air(.12,.71,.65,600,3100,{a:.32,decay:.3});break;
      case 'novaLaunch':air(0,.032,.80,4600,1000,{noise:'high'});bass(.005,.76,1.1,145,29,{harm:.45,decay:5});layer({t:.015,d:.63,g:.38,f:960,end:95,fm:2.3,ratio:1.618});air(.01,.48,1.15,1800,180,{noise:'low'});metal(.14,370,.24,.5);air(.26,.69,.25,2200,500);break;
      case 'novaImpact':air(0,.10,.8,900,2800,{a:.035,decay:.6});bass(.11,1.65,1.1,91,25,{harm:.35,decay:5});air(.10,.05,1.0,4600,1500,{noise:'high'});air(.12,1.65,1.6,840,65,{noise:'low',decay:5});[220,349,523].forEach((f,i)=>metal(.14+i*.055,f,.23,1.15));chips(.30,25,.19,1.25,2400);air(.55,1.5,.25,1500,250,{a:.16,decay:3});break;
      case 'zap':
        air(0,.022,.7,3300,1700,{noise:'high'});for(let i=0;i<6;i++){const t=.025+i*.027+rand()*.012;air(t,.012+rand()*.02,.58-i*.055,2400+rand()*2800,1600,{noise:'high'});}
        bass(.004,.25,.32,98,54,{harm:.5,flutter:.8,rate:62});layer({t:.015,d:.20,g:.25,f:740,end:170,fm:3.1,ratio:1.414,decay:4});layer({t:.18,d:.23,g:.08,f:2450,end:650,decay:5});break;
      case 'arc':air(0,.028,.9,4100,1700,{noise:'high'});layer({d:.12,g:.30,f:1050,end:290,fm:4,ratio:1.618});break;
      case 'cryo':metal(0,1450,.18,.06);air(.014,.44,1.0,700,3400,{a:.015,decay:3});bass(.008,.14,.3,190,76);[1870,2630,3540].forEach((f,i)=>metal(.07+i*.022,f,.075,.43));air(.17,.42,.24,4200,1600,{noise:'high',a:.04});break;
      case 'frost':air(0,.14,.8,3800,1800,{noise:'high'});bass(0,.12,.27,270,95);[930,1471,2333].forEach((f,i)=>metal(i*.035,f,.15,.35));chips(.06,11,.2,.32,3400);break;
      case 'pulse':bass(0,.69,.95,127,41,{a:.009,decay:4,flutter:.25,rate:15});layer({t:.02,d:.65,g:.32,f:255,end:89,fm:.9,ratio:1.5,decay:4});air(.006,.25,.5,480,85,{noise:'low'});[440,659,880].forEach((f,i)=>metal(.045+i*.019,f,.09,.55));break;
      case 'gas':metal(0,540,.15,.04);bass(.018,.27,.66,123,58,{harm:.6,flutter:.80,rate:27,rough:.5,a:.008});air(.015,.43,.45,750,170,{a:.015,decay:3.4,flutter:.6,rate:19});[.15,.24,.31].forEach(t=>bass(t,.065,.09,300+rand()*220,80,{fm:1.7}));break;
      case 'boom':blast();break;
      case 'shellImpact':blast(true);metal(.06,132,.24,.3);air(.24,1.25,.3,750,80,{noise:'low',a:.08,decay:3});break;
      case 'impact':air(0,.08,.85,960,240);bass(0,.075,.4,210,85);break;
      case 'shatter':air(0,.022,.95,4800,1800,{noise:'high'});bass(0,.19,.4,210,64);[660,1073,1801,2907].forEach((f,i)=>metal(i*.012,f,.2,.43));chips(.025,29,.37,.8,2800);break;
      case 'sizzle':air(0,.30,.80,1300,450,{noise:'low'});air(.06,.85,.45,4500,2100,{noise:'high',decay:3});chips(.03,33,.30,.81,3700);break;
      case 'deflate':air(0,.70,.85,2100,360,{q:1.3,flutter:.95,rate:24,decay:3});bass(.05,.65,.3,180,47,{harm:.22,flutter:.95,rate:19,rough:.5});break;
      case 'koBoing':bass(0,.30,.75,170,59,{fm:1.1,ratio:2.35});metal(.035,340,.25,.36);air(.05,.32,.28,1900,360);break;
      case 'notePop':[660,990,1320,1980].forEach((f,i)=>metal(i*.09,f,.5-i*.08,.51));air(0,.18,.18,2800,900);break;
      case 'whoo':air(.04,.95,.42,560,1450,{q:2.5,a:.14,decay:2.6});layer({t:.03,d:.97,g:.4,f:420,end:830,a:.14,decay:2.4,flutter:.45,rate:5.5});layer({t:.14,d:.90,g:.16,f:630,end:1230,a:.16,decay:2.6});break;
      case 'punt':bass(0,.17,.65,145,55);air(.01,.59,.68,360,2800,{a:.035,decay:2.7});layer({t:.07,d:.51,g:.12,f:410,end:1450,decay:2.2});break;
      case 'whistleIn':air(0,.62,.55,3400,550,{q:3,a:.03,decay:1.8});layer({d:.62,g:.4,f:1800,end:370,a:.025,flutter:.3,rate:19,decay:2.2});break;
      case 'thud':bass(0,.64,1.0,83,29,{harm:.35});air(0,.31,1.5,480,68,{noise:'low'});chips(.035,17,.27,.58,750);break;
      case 'trexRoar':voice(87,2.40,0);bass(.03,2.50,.38,58,27,{a:.12,decay:1.9,rough:.7,flutter:.45,rate:8});air(.24,1.18,.27,1600,520,{a:.12,decay:1.8});break;
      case 'roar':voice(65,2.25,2);bass(0,2.35,.4,51,29,{a:.14,decay:2,rough:.7});break;
      case 'bossDie':voice(54,2.25,2);air(.3,1.9,.43,390,90,{a:.12,decay:2.8});break;
      case 'screech':voice(370,.48,1);break;
      case 'pteraWail':voice(245,1.30,1);break;
      case 'snarl':voice(108,.66,2);break;
      case 'bellow':voice(46,1.20,2);bass(.03,1.18,.45,74,43,{a:.09,decay:2.5});break;
      case 'build':bass(0,.17,.63,165,56);air(0,.11,.66,750,220);metal(.035,470,.3,.14);for(let i=0;i<5;i++)metal(.17+i*.036,950+i*80,.13,.04);metal(.40,610,.22,.12);break;
      case 'upgrade':for(let i=0;i<7;i++)metal(i*.037,550+i*90,.18,.05);air(.03,.25,.3,800,1800,{a:.015,decay:2});[660,880,1320].forEach((f,i)=>metal(.30+i*.08,f,.36,.35));bass(.49,.24,.23,120,65);break;
      case 'coin':metal(0,1850,.55,.16);metal(.07,2780,.32,.23);break;
      case 'fanfare':[523,659,784,1047].forEach((f,i)=>{metal(i*.11,f,.37,.5);layer({t:i*.11,d:.57,g:.18,f,harm:.15,decay:4});});bass(.33,.65,.20,130,98);break;
      case 'victoryTune':[523,659,784,1047,784,1047].forEach((f,i)=>{metal(i*.20,f,.4,.6);layer({t:i*.20,d:.7,g:.18,f,harm:.2,decay:4});});chips(1,14,.12,.8);break;
      case 'error':metal(0,215,.5,.06);metal(.105,170,.35,.07);air(0,.04,.25,800,400);break;
      case 'leak':[0,.35].forEach(t=>{layer({t,d:.40,g:.65,f:420,end:270,fm:1.1,ratio:1.5,a:.018,decay:2.8});air(t,.08,.17,1500,650);});break;
      case 'alert':air(0,.05,.4,1900,1600);[0,.15,.34].forEach((t,i)=>{layer({t:t+.04,d:.10,g:.55,f:i===2?1470:1090,harm:.25,a:.004,decay:2});});air(.60,.13,.27,2600,700);metal(.71,720,.13,.06);break;
      case 'jet':air(0,2.65,1.4,270,1850,{a:.78,decay:1.3,flutter:.2,rate:26});air(.4,2.2,.85,1250,180,{noise:'low',a:.48,decay:1.2});bass(0,2.65,.28,160,47,{a:.76,decay:1.6,harm:.45,rough:.5});break;
      case 'heartbeat':[0,.75].forEach(t=>{bass(t,.18,.8,70,42,{a:.006});bass(t+.17,.14,.54,61,39,{a:.005});air(t,.1,.2,170,65,{noise:'low'});});break;
      case 'firework':bass(0,.29,.67,125,36);air(.012,.17,.55,2100,700);chips(.07,35,.30,.85,3500);break;
    }
    // Remove DC, keep headroom and use a gentle shoulder only on transients.
    let last=0,dc=0,peak=0;
    for(let i=0;i<pcm.length;i++){const v=pcm[i];dc=v-last+.993*dc;last=v;pcm[i]=dc;peak=Math.max(peak,Math.abs(dc));}
    const scale=.89/Math.max(.6,peak);for(let i=0;i<pcm.length;i++)pcm[i]=Math.tanh(pcm[i]*scale*1.12)/1.12;
    return pcm;
  }
  function create(ac,output,{maxVoices=24,onAccent}={}){
    const voices=new Set(),cache=new Map(),last=new Map(),variants=new Map(),counts={played:0,dropped:0,stolen:0,peakVoices:0};
    let bytes=0;const maxBytes=12*1024*1024;
    const bus=ac.createGain(),high=ac.createBiquadFilter(),low=ac.createBiquadFilter(),comp=ac.createDynamicsCompressor();
    bus.gain.value=.82;high.type='highpass';high.frequency.value=32;low.type='lowpass';low.frequency.value=13800;
    comp.threshold.value=-11;comp.knee.value=10;comp.ratio.value=3;comp.attack.value=.004;comp.release.value=.17;
    bus.connect(high);high.connect(low);low.connect(comp);comp.connect(output);
    // Two quiet, filtered outdoor reflections; no cavernous wash on gunfire.
    const room=ac.createGain();room.gain.value=.17;
    for(const [time,gain,freq]of [[.073,.55,2600],[.157,.28,1500]]){const delay=ac.createDelay(.3),filter=ac.createBiquadFilter(),g=ac.createGain();delay.delayTime.value=time;filter.type='lowpass';filter.frequency.value=freq;g.gain.value=gain;room.connect(delay);delay.connect(filter);filter.connect(g);g.connect(bus);}
    function buffer(name,variant){
      const key=name+':'+variant;if(cache.has(key)){const b=cache.get(key);cache.delete(key);cache.set(key,b);return b;}
      const pcm=performance(name,variant),b=ac.createBuffer(1,pcm.length,SR);b.copyToChannel(pcm,0);
      while(bytes+pcm.byteLength>maxBytes&&cache.size){const [k,v]=cache.entries().next().value;cache.delete(k);bytes-=v.length*4;}
      cache.set(key,b);bytes+=pcm.byteLength;return b;
    }
    function retire(v,fade=.012){
      if(!voices.has(v))return;voices.delete(v);const now=ac.currentTime;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(v.gain.gain.value,now);v.gain.gain.linearRampToValueAtTime(0,now+fade);try{v.source.stop(now+fade+.002);}catch(e){}
    }
    function play(name,o={}){
      if(!specs[name])return false;const now=ac.currentTime,s=specs[name],priority=s[3],at=Math.max(now,o.at||now);
      if(!Number.isFinite(at)||at-now>5)return false;
      if(at-(last.get(name)??-100)<s[2]){counts.dropped++;return false;}
      const ceiling=priority<2?maxVoices-4:maxVoices;
      if(voices.size>=ceiling){const candidates=[...voices].filter(v=>v.priority<priority||(v.priority===priority&&priority<3)).sort((a,b)=>a.priority-b.priority||a.at-b.at);if(!candidates.length){counts.dropped++;return false;}retire(candidates[0]);counts.stolen++;}
      const variant=variants.get(name)||0;variants.set(name,(variant+1)%3);last.set(name,at);
      const source=ac.createBufferSource(),gain=ac.createGain(),pan=ac.createStereoPanner();source.buffer=buffer(name,variant);
      const lv=clamp(o.lv||0,0,2),rate=clamp((o.rate||1)*(1-lv*.024)*(1+(variant-1)*.009),.65,1.4);
      source.playbackRate.value=rate;gain.gain.value=s[1]*clamp(o.gain??1,0,1.5)*(1+lv*.055);pan.pan.value=clamp(o.pan||0,-.85,.85);
      if(name==='jet'){pan.pan.setValueAtTime(-.80,at);pan.pan.linearRampToValueAtTime(.80,at+2.6/rate);}
      source.connect(gain);gain.connect(pan);pan.connect(bus);if(priority>0)pan.connect(room);
      const voice={source,gain,pan,at,priority,weapon:o.weapon,name};voices.add(voice);counts.played++;counts.peakVoices=Math.max(counts.peakVoices,voices.size);
      source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();pan.disconnect();};source.start(at);
      if(onAccent&&(name==='trexRoar'||name==='roar'||name==='shellImpact'))onAccent(name==='shellImpact'?.18:.38,name==='shellImpact'?.55:2.2);
      return true;
    }
    function stop(weapon){for(const v of [...voices])if(!weapon||v.weapon===weapon)retire(v);if(!weapon)last.clear();}
    function warm(){const names=['shot','flame','cryo','zap','gas','snipe','missile','thoomp','pulse','impact','trexRoar','roar','shellImpact','bossDie'];let i=0;const next=()=>{if(ac.state==='closed'||i>=names.length)return;buffer(names[i++],0);if(typeof requestIdleCallback==='function')requestIdleCallback(next,{timeout:900});else setTimeout(next,35);};setTimeout(next,50);}
    return {play,stop,warm,buffer,stats:()=>({...counts,voices:voices.size,buffers:cache.size,bytes,maxBytes,maxVoices})};
  }
  return {create,render,prepare,names:Object.keys(specs),sampleRate:SR,bankStatus:()=>({ready:!!bank,error:bankError})};
})();
