'use strict';
/* Browser creature catalogue. Every mesh and skeleton is explicitly authored
   in creature-species.js / creature-anatomy.js. No generic anatomy fallback. */
const CreatureMeshes = (() => {
  const C={
    compy:{family:'raptor',body:'#60714a',belly:'#adac7c',mark:'#344538',pattern:1,stride:1.45},
    gallimimus:{family:'raptor',body:'#a99069',belly:'#cec3a0',mark:'#62513a',pattern:3,stride:2},
    velociraptor:{family:'raptor',body:'#837354',belly:'#bcb18d',mark:'#493f30',pattern:1},
    dilophosaurus:{family:'raptor',body:'#586954',belly:'#a9ad80',mark:'#283e35',pattern:3},
    atrociraptor:{family:'raptor',body:'#976e4c',belly:'#c9b08a',mark:'#3d3028',pattern:1},
    pyroraptor:{family:'raptor',body:'#793d30',belly:'#b58a65',mark:'#302d2b',pattern:1},
    dimorphodon:{family:'flyer',body:'#675647',belly:'#c3a483',mark:'#2a3434',pattern:3},
    pteranodon:{family:'flyer',body:'#837562',belly:'#b8ac92',mark:'#4d4a3d',pattern:3},
    quetzalcoatlus:{family:'flyer',body:'#b4aa88',belly:'#dad0ad',mark:'#695144',pattern:3},
    ichthyosaurus:{family:'marine',body:'#436470',belly:'#bdc9c7',mark:'#233d46',pattern:3,stride:2},
    plesiosaurus:{family:'marine',body:'#4a6b64',belly:'#bac7b1',mark:'#293f38',stride:2.3},
    kronosaurus:{family:'marine',body:'#4a5e67',belly:'#a6b8b5',mark:'#293b40',stride:2.1},
    parasaurolophus:{family:'quad',body:'#918765',belly:'#c7b994',mark:'#594f38',pattern:1,stride:1.45},
    pachycephalosaurus:{family:'raptor',body:'#8e7960',belly:'#c2b195',mark:'#4e4436',pattern:3},
    stygimoloch:{family:'raptor',body:'#a4774d',belly:'#c9af86',mark:'#67452d',pattern:1},
    baryonyx:{family:'predator',body:'#5d6968',belly:'#a8b0a0',mark:'#303d3e',pattern:3},
    carnotaurus:{family:'predator',body:'#845242',belly:'#ad9173',mark:'#422f2b',pattern:3},
    allosaurus:{family:'predator',body:'#787362',belly:'#bcb191',mark:'#46473d',pattern:1},
    stegosaurus:{family:'quad',body:'#727561',belly:'#adae8e',mark:'#404a3c',stride:1.25},
    triceratops:{family:'quad',body:'#827d6d',belly:'#b7af95',mark:'#4b4a40',stride:1.25},
    ankylosaurus:{family:'quad',body:'#726752',belly:'#a29777',mark:'#3e3c32',stride:1.1},
    therizinosaurus:{family:'raptor',body:'#414641',belly:'#7a7f74',mark:'#713b32',stride:1.5},
    apatosaurus:{family:'sauropod',body:'#787d75',belly:'#afafa0',mark:'#474c45',stride:1.25},
    brachiosaurus:{family:'sauropod',body:'#817a66',belly:'#b4a991',mark:'#514b3d',stride:1.3},
    blue:{family:'raptor',body:'#858b83',belly:'#c4c2ac',mark:'#294e67',pattern:5},
    trex:{family:'predator',body:'#92795f',belly:'#cbbda0',mark:'#433b32',pattern:4,stride:1.55},
    spinosaurus:{family:'predator',body:'#7b8273',belly:'#b5b49c',mark:'#844a37',pattern:1,stride:1.55},
    indominus:{family:'predator',body:'#b3b8ad',belly:'#d8d8c8',mark:'#7a8379',pattern:3,stride:1.6},
    indoraptor:{family:'raptor',body:'#303739',belly:'#656963',mark:'#b6964f',pattern:2,stride:1.75},
    giganotosaurus:{family:'predator',body:'#626e65',belly:'#a7ac94',mark:'#354137',pattern:1,stride:1.65},
    drex:{family:'mutant',body:'#916d48',belly:'#b09a75',mark:'#5a6346',pattern:3,stride:1.6},
    whiteptera:{family:'flyer',body:'#c4c8bc',belly:'#e2e3d7',mark:'#8a9b98',pattern:3},
    mosasaurus:{family:'marine',body:'#416572',belly:'#adbdb6',mark:'#243d47',stride:2.4}
  };
  function rgb(value){
    const color=String(value).trim();
    if(/^#[0-9a-f]{6}$/i.test(color))return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
    if(/^#[0-9a-f]{3}$/i.test(color))return [1,2,3].map(i=>parseInt(color[i]+color[i],16)/255);
    // The homepage's mist palette is produced by shade(), which returns RGB.
    // Parsing it as hex sent NaNs to WebGL and turned most roamers black/blue.
    const match=color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    return match?match.slice(1,4).map(n=>Math.max(0,Math.min(255,+n))/255):[.5,.5,.5];
  }
  function build(key){
    if(!C[key]||!CreatureAnatomy.has(key))throw Error('Missing authored anatomy: '+key);
    return CreatureAnatomy.build(key,C[key]);
  }
  const pose=(model,phase,roar=0,frill=roar)=>CreatureAnatomy.pose(model,phase,roar,frill);
  return {catalog:C,build,pose,rgb};
})();
