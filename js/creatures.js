'use strict';
/* One shared WebGL rig renderer. Live herds render into an atlas in one pass,
   copied once into the 2D scene; depth sorting, HUD and combat stay in Canvas.
   Small isolated previews/death pieces use a bounded cache. Local Blender skins
   load asynchronously; procedural meshes remain available as a fallback. */
const Creatures = (() => {
  const GROUND=.62,HEIGHT=Math.sqrt(1-GROUND*GROUND),TAU=Math.PI*2;
  const coarse=matchMedia('(pointer: coarse)').matches,CW=coarse?160:224,CH=coarse?160:224;
  const UNIT=CW/5.8,ORIGIN_X=2.8,ORIGIN_Y=4.35,COLS=8,MAX=192;
  const source=document.createElement('canvas'),atlas=document.createElement('canvas'),ac=atlas.getContext('2d');
  source.width=CW;source.height=CH;atlas.width=CW;atlas.height=CH;
  const gl=source.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true,depth:true});
  const maxEdge=gl?Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)):2048;
  const models=new Map(),cache=new Map(),slots=new WeakMap(),objectIds=new WeakMap(),fallback={};let generation=0,lost=false,error='',program,lastSignature='',nextId=0;
  const MAX_CACHE=coarse?48:96,ids=Object.keys(CreatureMeshes.catalog),byPainter={blue:'blue',trex:'trex',spino:'spinosaurus',indominus:'indominus',indoraptor:'indoraptor',giga:'giganotosaurus',mutant:'drex',whiteptera:'whiteptera',mosasaurus:'mosasaurus'};
  const VS=`precision highp float;
    attribute vec3 aPosition,aNormal,aRest,aColor;attribute float aBone,aMaterial,aPart;attribute vec2 aBlend;
    uniform mat4 uBones[48];uniform float uYaw,uMask[13];uniform vec2 uSize,uView;uniform float uScale;
    varying vec3 vNormal,vRest,vColor,vBindNormal;varying float vMaterial,vPart;
    void main(){mat4 b=uBones[int(aBone)]*(1.-aBlend.y)+uBones[int(aBlend.x)]*aBlend.y;vec3 p=(b*vec4(aPosition,1.)).xyz,n=normalize(mat3(b)*aNormal);float c=cos(uYaw),s=sin(uYaw);
      vec3 q=vec3(p.x*c-p.z*s,p.y,p.x*s+p.z*c);vNormal=vec3(n.x*c-n.z*s,n.y,n.x*s+n.z*c);vRest=aRest;vBindNormal=aNormal;vColor=aColor;vMaterial=aMaterial;vPart=aPart;
      vec2 screen=vec2(q.x+2.8,4.35-q.y*uView.y+q.z*uView.x)*uScale;
      gl_Position=vec4(screen.x/uSize.x*2.-1.,1.-screen.y/uSize.y*2.,-(q.y*uView.x+q.z*uView.y)*.14,1.);
      if(uMask[int(aPart)]>.5)gl_Position=vec4(2.,2.,2.,1.);
    }`;
  const FS=`precision highp float;
    varying vec3 vNormal,vRest,vColor,vBindNormal;varying float vMaterial,vPart;
    uniform vec3 uBody,uBelly,uMark;uniform vec4 uStripe,uSurface,uEffect,uTorso;uniform float uPattern,uStatus,uYaw,uTop;uniform vec2 uView;uniform sampler2D uDetail;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){vec3 n=normalize(vNormal);if(dot(n,vec3(0.,uView.x,uView.y))<0.)n=-n;vec3 color=vColor;float mat=vMaterial;
      float specular=.04;
      if(mat>.5&&mat<1.5 || mat>2.5&&mat<3.5 || mat>5.5&&mat<6.5){
        color=uBody*vColor.x+uBelly*vColor.y+uMark*vColor.z;
        vec3 an=abs(normalize(vBindNormal));vec2 uv=vRest.xy+vRest.z*.13;
        float broad=noise(uv*7.3+vec2(19.7,7.1)),fine=noise(uv*63.7+vec2(3.7,83.1));
        float stripe=pow(max(0.,sin(vRest.x*19.+vRest.y*9.+broad*2.)),5.);
        float dorsal=clamp(vColor.x,0.,1.);
        if(uPattern<1.5&&uPattern>.5)color=mix(color,uMark,stripe*.67*dorsal);
        if(uPattern>1.5&&uPattern<2.5){float y=mix(uStripe.x+max(0.,-vRest.x-.45)*.065,uStripe.z,smoothstep(uStripe.y,uStripe.w,vRest.x))-max(0.,vRest.x-uStripe.w)*.24;float band=1.-smoothstep(.032,.069,abs(vRest.y-y)+(broad-.5)*.009);color=mix(color,uMark,band*step(.025,abs(vRest.z)));}
        if(uPattern>2.5&&uPattern<3.5)color=mix(color,uMark,smoothstep(.47,.78,broad)*.35*dorsal);
        if(uPattern>3.5&&uPattern<4.5){
          // Warm 1993 hide: cream jaw/dewlap, charcoal saddle and broken
          // neck bars. Pigment stays in bind space through every animation.
          float head=step(.88,vRest.x),jaw=step(1.5,vPart)*(1.-step(2.5,vPart));
          float throat=(1.-smoothstep(1.16,1.47,vRest.y+(broad-.5)*.07))*smoothstep(.20,.80,vRest.x);
          float jawCream=jaw*(1.-smoothstep(1.34,1.54,vRest.y));
          float underside=max(clamp(-vBindNormal.y*.9,0.,.85),max(jawCream*.82,throat*.9));
          color=mix(uBody,uBelly,underside);
          float bands=smoothstep(.28,.82,sin(vRest.x*14.+vRest.y*4.2+broad*4.7+abs(vRest.z)*4.))*smoothstep(.18,.63,noise(uv*14.3));
          float saddle=smoothstep(1.10,1.69,vRest.y)*(1.-head*.8);
          float mottles=smoothstep(.43,.78,broad);
          color=mix(color,uMark,(bands*.32+mottles*.25)*max(saddle,.18)*(1.-underside*.66));
          color=mix(color,uMark,jaw*smoothstep(.54,.76,noise(uv*19.7))*.17);
          vec2 orbit=(vRest.xy-vec2(1.265,1.83))/vec2(.095,.073);
          vec2 cheek=(vRest.xy-vec2(1.55,1.66))/vec2(.20,.105);
          float recess=(exp(-dot(orbit,orbit)*1.2)*.64+exp(-dot(cheek,cheek)*1.4)*.24)*step(.14,abs(vRest.z));
          color=mix(color,uMark,recess*head*(1.-jaw));
          float folds=pow(.5+.5*sin(vRest.x*69.+vRest.y*7.+abs(vRest.z)*4.),12.)*exp(-pow((vRest.x-.74)/.24,2.));
          color*=1.-folds*.17;
        }
        if(uPattern>4.5&&uPattern<5.5){
          // Blue's silver/olive hide and broken cobalt flank stripe. The
          // pale edging follows the stripe in bind space, across the neck
          // and tail, while the arms, thighs and lower jaw stay unstriped.
          float jaw=step(1.5,vPart)*(1.-step(2.5,vPart));
          float flank=(1.-step(3.5,vPart))*(1.-jaw);
          float head=smoothstep(.75,.88,vRest.x);
          float underside=max(clamp(-vBindNormal.y*.85,0.,.8),jaw*.56);
          color=mix(uBody,uBelly,underside);
          float mottle=smoothstep(.35,.78,broad)*.37;
          float bars=pow(max(0.,sin(vRest.x*21.+vRest.y*9.+broad*4.)),4.);
          color=mix(color,uBody*.48,(mottle+bars*.29)*(1.-underside*.62));
          float center=1.225+max(0.,-vRest.x-.55)*.055;
          center=mix(center,1.925,smoothstep(.19,.87,vRest.x));
          center-=max(0.,vRest.x-1.025)*.36;
          float taper=mix(.075,.004,smoothstep(.72,2.83,-vRest.x));
          float halfWidth=mix(taper,.053,smoothstep(.16,.87,vRest.x));
          halfWidth*=1.-smoothstep(1.03,1.28,vRest.x);
          float edgeNoise=(noise(vRest.xy*52.+vRest.z*13.)-.5)*.019+(broad-.5)*.030;
          float distance=abs(vRest.y-center)+edgeNoise;
          float side=flank*smoothstep(.35,.77,an.z)*(1.-smoothstep(1.09,1.28,vRest.x));
          float border=(1.-smoothstep(halfWidth+.004,halfWidth+.014,distance))*side;
          float band=(1.-smoothstep(max(.001,halfWidth-.006),halfWidth+.003,distance))*side;
          color=mix(color,mix(uBelly,uBody,.24),border*(.54+fine*.22));
          float wear=smoothstep(.66,.85,noise(vRest.xy*39.+vRest.z*17.));
          color=mix(color,uMark*(.84+broad*.38),band*(.89-wear*.21));
          vec2 orbit=(vRest.xy-vec2(1.015,1.947))/vec2(.081,.065);
          vec2 hollow=(vRest.xy-vec2(1.25,1.835))/vec2(.18,.083);
          color=mix(color,uBody*.30,(exp(-dot(orbit,orbit))*.70+exp(-dot(hollow,hollow))*.36)*head*(1.-jaw));
          float folds=pow(.5+.5*sin(vRest.x*81.-vRest.y*19.+abs(vRest.z)*11.),10.)*exp(-pow((vRest.x-.48)/.25,2.));
          color*=1.-folds*.19;
        }
        if(uPattern>5.5&&uPattern<6.5){
          // Brachiosaurus: muted umber crown, warm lips/throat, and fine
          // branching folds around the soft orbit. All pigment follows skin.
          float head=smoothstep(3.68,3.91,vRest.y),jaw=step(1.5,vPart)*(1.-step(2.5,vPart));
          float lip=(1.-smoothstep(3.87,3.985,vRest.y))*smoothstep(1.28,1.61,vRest.x);
          float pale=max(jaw*.42*(1.-smoothstep(3.81,3.91,vRest.y)),lip*.38);
          color=mix(color,uBelly,pale);
          color=mix(color,uMark,smoothstep(.38,.77,broad)*head*.31*(1.-pale));
          vec2 orbit=(vRest.xy-vec2(1.365,4.115))/vec2(.079,.070);
          float distance=length(orbit),eye=exp(-dot(orbit,orbit)*.9);
          color=mix(color,uMark,eye*.56*head*(1.-jaw));
          float rings=pow(.5+.5*sin(distance*19.+broad*2.),10.)*exp(-pow((distance-1.1)/.75,2.));
          float cheek=exp(-pow((vRest.x-1.34)/.22,2.)-pow((vRest.y-3.98)/.19,2.));
          float folds=pow(.5+.5*sin(vRest.y*105.+sin(vRest.x*27.)*1.3+vRest.z*13.),14.);
          float neck=smoothstep(3.35,3.75,vRest.y)*(1.-smoothstep(3.89,4.05,vRest.y));
          float wrinkles=pow(.5+.5*sin(vRest.y*145.+noise(vRest.xy*37.)*5.+vRest.x*25.+vRest.z*17.),16.);
          color*=1.-rings*.07*head-folds*.18*cheek-wrinkles*.15*max(cheek,neck);
        }
        if(uPattern>6.5&&uPattern<7.5){
          float crest=step(.85,vColor.z),jaw=step(1.5,vPart)*(1.-step(2.5,vPart));
          float pale=max(clamp(-vBindNormal.y*.7,0.,.65),jaw*.36);
          color=mix(uBody,uBelly,pale);
          color=mix(color,uBody*.39,smoothstep(.37,.78,broad)*.48*(1.-pale));
          float beak=smoothstep(.96,1.62,vRest.x)*(1.-crest);
          color=mix(color,vec3(.45,.36,.25),beak*.7);
          vec2 orbit=(vRest.xy-vec2(.825,2.086))/vec2(.098,.078);
          color=mix(color,uBody*.30,exp(-dot(orbit,orbit))*step(.04,abs(vRest.z))*.60);
          float folds=pow(.5+.5*sin(vRest.y*97.+vRest.x*37.+broad*3.),14.);
          color*=1.-folds*.11*exp(-pow((vRest.x-.52)/.31,2.));
          color=mix(color,uMark*(.70+broad*.55)+uBelly*fine*.10,crest);
          float striae=pow(.5+.5*sin(vRest.x*92.+vRest.y*55.+broad*2.),12.);
          color*=1.-striae*(crest*.13+beak*.07);
        }
        // Fine scale cells with recessed seams and rough, mottled hide. This
        // is sampled from bind positions, independent of bones and heading.
        vec3 weights=pow(an,vec3(4.));weights/=max(.001,weights.x+weights.y+weights.z);
        float brachioHead=step(5.5,uPattern)*(1.-step(6.5,uPattern))*smoothstep(3.35,3.91,vRest.y);
        vec3 tex=vRest*mix(.57,1.18,brachioHead);float yz=texture2D(uDetail,tex.zy).r,xz=texture2D(uDetail,tex.xz).r,xy=texture2D(uDetail,tex.xy).r;
        float skin=yz*weights.x+xz*weights.y+xy*weights.z;
        vec2 e=vec2(.0018,0.);vec3 grad=vec3((texture2D(uDetail,tex.xz+e).r-xz)*weights.y+(texture2D(uDetail,tex.xy+e).r-xy)*weights.z,(texture2D(uDetail,tex.zy+e.yx).r-yz)*weights.x+(texture2D(uDetail,tex.xy+e.yx).r-xy)*weights.z,(texture2D(uDetail,tex.zy+e).r-yz)*weights.x+(texture2D(uDetail,tex.xz+e.yx).r-xz)*weights.y);
        vec3 bn=normalize(vBindNormal);grad-=bn*dot(bn,grad);float cy=cos(uYaw),sy=sin(uYaw);grad=vec3(grad.x*cy-grad.z*sy,grad.y,grad.x*sy+grad.z*cy);n=normalize(n-grad*mix(1.7,.85,brachioHead));
        color*=mix(.59+broad*.25+fine*.025+skin*.47,.70+broad*.17+fine*.02+skin*.33,brachioHead);
        color=mix(color,uMark,(1.-smoothstep(.48,.93,an.y))*smoothstep(.59,.81,broad)*.10);
        n=normalize(n+vec3((fine-.5)*.025,(skin-.5)*.035,0.));specular=.07;
        if(mat>2.5&&mat<3.5){color*=.92+sin(vRest.z*37.)*.045;specular=.035;}
        if(mat>2.5&&mat<3.5&&uPattern>6.5&&uPattern<7.5){
          // Thin russet flight skin: mottled transmitted light, radiating
          // tension fibres and fine branching veins follow the bind surface.
          float edge=clamp(vColor.x,0.,1.),web=smoothstep(.09,.235,1.-edge);
          vec2 wing=vRest.xz;float patches=noise(wing*8.5)+noise(wing*29.)*.25;
          float veins=pow(.5+.5*sin(vRest.z*53.+sin(vRest.x*18.)*2.1+noise(wing*17.)*5.),22.);
          float fibres=pow(.5+.5*sin(vRest.z*125.+vRest.x*49.),16.);
          vec3 leather=mix(vec3(.32,.22,.145),vec3(.55,.38,.22),smoothstep(.24,.95,patches));
          leather*=1.-veins*.12-fibres*.06;
          color=mix(uBody*(.57+skin*.42),leather,web*.90);specular=.045;
        }
      }
      if(mat>3.5&&mat<4.5)color*=.82+noise(vRest.xy*5.+vRest.z*7.)*.12+texture2D(uDetail,vRest.xy*.57).r*.21;
      if(mat>4.5&&mat<5.5){color*=.78+noise(vec2(vRest.x*71.,vRest.y*13.)+vRest.z*29.)*.34;specular=.02;}
      // Surface treatments use bind coordinates, so frost, scorch and holes
      // stay on the same scales through gait, heading and death transforms.
      float grain=noise(vRest.xy*29.+vRest.z*17.),patch=noise(vRest.xy*6.7+vRest.z*2.3);
      float heat=uSurface.x,frost=uSurface.y,charge=uSurface.z,toxin=uSurface.w;
      if(mat<1.5||mat>2.5){
        color=mix(color,color*vec3(.23,.20,.18),heat*(.32+patch*.52));
        color+=vec3(.30,.044,.004)*heat*pow(grain,7.);
        float rime=smoothstep(.29,.83,grain+max(0.,vBindNormal.y)*.25)*frost;
        color=mix(color,vec3(.63,.83,.88),rime*.84);specular+=frost*.22;
        color=mix(color,color*vec3(.66,.79,.42),toxin*.58);
      }
      if(uEffect.x>.5&&uEffect.x<1.5){color=vec3(.14,.135,.125)*(.66+grain*.75);color+=vec3(.59,.09,.008)*pow(grain,13.)*(1.-uEffect.y);specular=.018;}
      if(uEffect.x>1.5&&uEffect.x<2.5){color=mix(color,vec3(.46,.72,.80),.64)+vec3(.10,.15,.16)*grain;specular=.34;}
      if(uEffect.x>2.5&&uEffect.x<3.5){color=mat>1.5&&mat<2.5?vec3(.035,.045,.041):vec3(.73,.70,.59)*(.77+grain*.29);specular=.045;}
      if(uEffect.x>3.5&&uEffect.x<4.5){color=mix(color,vec3(.62,.88,.74),.83);specular=.12;}
      float plasma=max(uEffect.w,step(5.5,uEffect.x));
      float fracture=0.;
      if(plasma>0.){fracture=1.-smoothstep(.025,.085,abs(noise(vRest.xy*12.+vRest.z*8.)-.51));color=mix(color,color*.24,plasma*.68);color+=vec3(1.,.34,.035)*fracture*plasma;specular=.13;}
      if(uEffect.y>0.&&(uEffect.x<1.5||uEffect.x>4.5)){
        float edge=uEffect.x<1.5?vRest.y/max(.1,uTop):noise(vRest.xy*17.+vRest.z*13.);
        if(edge<uEffect.y*.99+grain*.085)discard;
      }
      if(uEffect.z>0.&&vPart<.5){vec2 p=(vRest.xy-uTorso.xy)/uTorso.zw;
        for(int i=0;i<6;i++){float f=float(i);if(f<uEffect.z*6.){vec2 h=vec2(sin(f*19.1)*.64,cos(f*13.7)*.46);float wound=length((p-h)*vec2(1.,1.35));if(wound<.052)discard;if(wound<.09)color=vec3(.20,.025,.023);}}
      }
      float diffuse=max(0.,dot(n,normalize(vec3(-.45,.82,.58))));float rim=pow(1.-abs(dot(n,normalize(vec3(0.,.62,.785)))),3.);
      float spec=pow(max(0.,dot(n,normalize(vec3(-.2,.91,.61)))),24.)*specular;
      vec3 lit=color*(.38+diffuse*.83)+vec3(.12,.17,.19)*rim*.28+vec3(spec);
      if(mat>1.5&&mat<2.5)lit=color*(.85+diffuse*.25);
      if(uStatus>0.)lit=mix(lit,uBody,uStatus);
      lit+=vec3(.18,.28,.43)*charge*(.3+rim*.7);
      if(uEffect.x>3.5&&uEffect.x<4.5)lit+=vec3(.14,.25,.20)*rim;
      lit+=vec3(.85,.36,.075)*fracture*plasma;
      gl_FragColor=vec4(clamp(lit,0.,1.),1.);
    }`;
  let loc;
  function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  if(gl)try{
    program=gl.createProgram();const vs=compile(gl.VERTEX_SHADER,VS),fs=compile(gl.FRAGMENT_SHADER,FS);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    loc={};for(const k of ['aPosition','aNormal','aRest','aColor','aBone','aMaterial','aPart','aBlend'])loc[k]=gl.getAttribLocation(program,k);
    for(const k of ['uBones','uYaw','uMask','uSize','uScale','uBody','uBelly','uMark','uStripe','uPattern','uStatus','uDetail','uView','uSurface','uEffect','uTorso','uTop'])loc[k]=gl.getUniformLocation(program,k);
    const detail=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,detail);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128,255]));gl.uniform1i(loc.uDetail,0);
    const hide=new Image();hide.onload=()=>{if(lost)return;const cv=document.createElement('canvas');cv.width=cv.height=1024;cv.getContext('2d').drawImage(hide,0,0,1024,1024);gl.bindTexture(gl.TEXTURE_2D,detail);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);cache.clear();lastSignature='';};hide.src='assets/creatures/hide-detail.webp';
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);
  }catch(e){error=e.message;}
  source.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;generation++;});
  source.addEventListener('webglcontextrestored',()=>{lost=true;}); // keep the native fallback until the next page load
  function available(){return !!gl&&!!program&&!lost&&!error;}
  function keyOf(d){
    if(d.key&&CreatureMeshes.catalog[d.key])return d.key;
    if(d.def){const key=ids.find(k=>DINOS[k]===d.def);if(key)return key;}
    if(byPainter[d.painter])return byPainter[d.painter];
    const exact=ids.find(k=>DINOS[k].pal===d.pal||DINOS[k].feat===d.feat);if(exact)return exact;
    const f=d.feat||{};
    if(d.painter==='theropod')return f.frill?'dilophosaurus':f.dome?f.spikes?'stygimoloch':'pachycephalosaurus':f.longSnout?'baryonyx':f.claws?'therizinosaurus':f.feathers?'pyroraptor':f.horns?'carnotaurus':f.slim?'gallimimus':'velociraptor';
    if(d.painter==='quad')return f.trike?'triceratops':f.plates?'stegosaurus':f.club?'ankylosaurus':'parasaurolophus';
    if(d.painter==='sauropod')return f.tall?'brachiosaurus':'apatosaurus';
    if(d.painter==='flyer')return f.crest?'pteranodon':'dimorphodon';
    if(d.painter==='aquatic')return f.longNeck?'plesiosaurus':f.bigJaw?'kronosaurus':'ichthyosaurus';
    return null;
  }
  function model(key){
    if(!models.has(key)){
      const m=CreatureMeshes.build(key);m.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bufferData(gl.ARRAY_BUFFER,m.vertices,gl.STATIC_DRAW);m.count=m.vertices.length/(m.vertexStride||15);models.set(key,m);
      if(typeof DecompressionStream!=='undefined')m.ready=(async()=>{
        const response=await fetch('assets/creatures/skinned/'+key+'.mesh.gz');if(!response.ok)throw Error('Skin HTTP '+response.status);
        const bytes=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(!bytes.byteLength||bytes.byteLength%68||bytes.byteLength>16000000)throw Error('Invalid skin stream');
        const vertices=new Float32Array(bytes);if(vertices.some(v=>!Number.isFinite(v)))throw Error('Non-finite skin');
        m.vertices=vertices;m.count=vertices.length/17;m.partBounds=null;m.effectSites=null;m.joinedSkin=true;
        gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);cache.clear();lastSignature='';return true;
      })().catch(e=>{m.skinError=e.message;return false;});
    }return models.get(key);
  }
  function roar(d){
    if(d.artRoar!==undefined)return d.artRoar;
    if(d.eat){const t=d.eat.t||0;return t<.8?.75:t<2.4?.95:.15+Math.max(0,Math.sin(t*12))*.5;}
    if(d.entranceT>0)return .3+Math.sin(Math.min(1,(2.5-d.entranceT)/2)*Math.PI)*.7;
    return .03;
  }
  const frill=d=>d.artFrill??d.frillOpen??roar(d);
  function status(d,key){
    const p=d.pal||DINOS[key].pal,base=DINOS[key].pal;
    return {body:CreatureMeshes.rgb(p.body||base.body),belly:CreatureMeshes.rgb(p.belly||base.belly),mark:CreatureMeshes.rgb(p.accent||base.accent),override:['#f2f6ff','#ffffff','#303334','#80b4c3'].includes(p.body)?.55:0};
  }
  const quant=v=>Math.round(Math.max(0,Math.min(1,v||0))*16)/16;
  function treatment(d){return [quant(d.fxHeat??Math.max(d.burnT>0?.8:0,(d.charT||0)*.7)),quant(d.fxFrost??(d.slowT>0?Math.min(1,d.slowT)*.85:0)),quant(d.zapT>0?Math.min(1,d.zapT*4):0),quant(d.poisonT),d.fxMaterial||0,quant(d.fxAmount),quant(d.fxHoles),quant((d.plasmaT||0)/2.4)];}
  function renderTile(d,key,phase,yaw,col,row,cellW=CW,cellH=CH){
    const m=model(key),p=status(d,key),hidden=d.deathMask||{},mask=m.parts.map(k=>hidden[k]||k==='lowerJaw'&&hidden.head&&hidden.lowerJaw!==0||k==='sail'&&d.hideSail?1:0);
    gl.useProgram(program);gl.viewport(col*cellW,source.height-(row+1)*cellH,cellW,cellH);gl.scissor(col*cellW,source.height-(row+1)*cellH,cellW,cellH);gl.enable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);let offset=0;for(const [name,size] of [['aPosition',3],['aNormal',3],['aRest',3],['aColor',3],['aBone',1],['aMaterial',1],['aPart',1]]){const l=loc[name];gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,(m.vertexStride||15)*4,offset*4);offset+=size;}
    if(m.vertexStride===17){gl.enableVertexAttribArray(loc.aBlend);gl.vertexAttribPointer(loc.aBlend,2,gl.FLOAT,false,68,60);}else{gl.disableVertexAttribArray(loc.aBlend);gl.vertexAttrib2f(loc.aBlend,0,0);}
    gl.uniformMatrix4fv(loc.uBones,false,CreatureMeshes.pose(m,d.entranceT>0?0:phase,roar(d),frill(d),d.artFlight));gl.uniform1f(loc.uYaw,yaw);gl.uniform1fv(loc.uMask,new Float32Array(mask));gl.uniform2f(loc.uSize,cellW,cellH);gl.uniform1f(loc.uScale,cellW/5.8);
    const view=d.artView===undefined?GROUND:Math.max(0,Math.min(.8,d.artView));gl.uniform2f(loc.uView,view,Math.sqrt(1-view*view));
    gl.uniform3fv(loc.uBody,p.body);gl.uniform3fv(loc.uBelly,p.belly);gl.uniform3fv(loc.uMark,p.mark);gl.uniform4fv(loc.uStripe,key==='blue'?[1.18,.31,1.71,.97]:[1.10,.35,1.54,1.00]);gl.uniform1f(loc.uPattern,m.cfg.pattern||0);gl.uniform1f(loc.uStatus,p.override);
    const fx=treatment(d),body=m.anatomy?.body||[[-.6,1,.3,.3],[.5,1,.3,.3]],wide=body.reduce((a,b)=>a[3]>b[3]?a:b);
    gl.uniform4fv(loc.uSurface,fx.slice(0,4));gl.uniform4f(loc.uEffect,fx[4],fx[5],fx[6],fx[7]);
    gl.uniform4f(loc.uTorso,(body[0][0]+body.at(-1)[0])/2,(wide[1]+wide[2])/2,Math.max(.2,(body.at(-1)[0]-body[0][0])*.5),Math.max(.15,(wide[1]-wide[2])*.5));gl.uniform1f(loc.uTop,Math.max(...(m.anatomy?.head||body).map(p=>p[1])));
    gl.drawArrays(gl.TRIANGLES,0,m.count);
  }
  function resize(w,h){if(source.width!==w||source.height!==h){source.width=w;source.height=h;}}
  function yawFor(d,turn){return Number.isFinite(d.artHeading)?d.artHeading:turn<0?Math.PI-.16:.16;}
  function prepare(items,detailed=false){
    if(!available())return;
    const cell=detailed&&items.length<=8?Math.min(maxEdge,coarse?320:640):CW;
    const maxCols=Math.max(1,Math.min(COLS,Math.floor(maxEdge/cell))),capacity=Math.min(MAX,maxCols*Math.floor(maxEdge/cell));
    const entries=items.filter(d=>!d.dead&&!d.leaked&&keyOf(d)).slice(0,capacity);if(!entries.length){lastSignature='';return;}
    const signature=cell+':'+entries.map(d=>{if(!objectIds.has(d))objectIds.set(d,++nextId);return [objectIds.get(d),d.phase||0,yawFor(d,d.turn===undefined?d.dir:d.turn),roar(d),frill(d),d.entranceT>0?1:0,JSON.stringify(d.pal),d.artView,JSON.stringify(d.artFlight),treatment(d).join(',')].join(',');}).join(';');
    if(signature===lastSignature)return;lastSignature=signature;generation++;
    const cols=Math.min(maxCols,entries.length),rows=Math.ceil(entries.length/cols);resize(cols*cell,rows*cell);
    gl.disable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    for(let i=0;i<entries.length;i++){const d=entries[i],key=keyOf(d),col=i%cols,row=Math.floor(i/cols);renderTile(d,key,d.phase||0,yawFor(d,d.turn===undefined?d.dir:d.turn),col,row,cell,cell);slots.set(d,{generation,x:col*cell,y:row*cell,cell,key,palette:JSON.stringify(d.pal),treatment:treatment(d).join(',')});}
    if(atlas.width!==source.width||atlas.height!==source.height){atlas.width=source.width;atlas.height=source.height;}
    ac.clearRect(0,0,atlas.width,atlas.height);ac.drawImage(source,0,0);
  }
  function sprite(d,phase,yaw){
    const key=keyOf(d);if(!key||!available())return null;
    const frame=((Math.round(phase/TAU*16)%16)+16)%16,angle=Math.round(yaw/TAU*32),mouth=Math.round(roar(d)*5),mask=d.deathMask||{},pal=status(d,key);
    const display=Math.round(frill(d)*12),id=[key,frame,angle,mouth,display,JSON.stringify(mask),d.hideSail?1:0,JSON.stringify(d.pal),d.artView,JSON.stringify(d.artFlight),treatment(d).join(',')].join(':');
    if(cache.has(id)){const hit=cache.get(id);cache.delete(id);cache.set(id,hit);return hit;}
    resize(CW,CH);renderTile({...d,artRoar:mouth/5,artFrill:display/12},key,frame/16*TAU,angle/32*TAU,0,0);
    const cv=document.createElement('canvas');cv.width=CW;cv.height=CH;cv.getContext('2d').drawImage(source,0,0);cache.set(id,cv);if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);return cv;
  }
  function unit(c,d,phase){
    if(!available())return false;const s=sprite(d,phase||0,Number.isFinite(d.artLocalHeading)?d.artLocalHeading:.16);if(!s)return false;c.drawImage(s,-ORIGIN_X,-ORIGIN_Y,5.8,CH/UNIT);return true;
  }
  function draw(c,d,x,y,turn,phase,alpha=1,pitch=0){
    const key=keyOf(d);if(!available()||!key)return false;
    const transform=c.getTransform(),px=transform.a*x+transform.c*y+transform.e,py=transform.b*x+transform.d*y+transform.f,pad=d.size*4*Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
    if(px+pad<0||py+pad<0||px-pad>c.canvas.width||py-pad>c.canvas.height)return true;
    const yaw=yawFor(d,turn),slot=slots.get(d),live=slot&&slot.generation===generation&&slot.key===key&&!d.deathMask&&slot.palette===JSON.stringify(d.pal)&&slot.treatment===treatment(d).join(',');
    const img=live?atlas:sprite(d,phase||0,yaw);if(!img)return false;const s=d.size;
    c.save();c.globalAlpha=alpha;
    const flying=DINOS[key].flying,water=DINOS[key].water;
    if(!d.fxNoShadow){c.fillStyle=water?'rgba(10,26,30,.2)':'rgba(0,8,7,.27)';c.beginPath();c.ellipse(x,y+2,s*(.45+.4*Math.abs(Math.cos(yaw))),s*.20,0,0,TAU);c.fill();}
    c.translate(x,y);
    // Path direction is represented by the 3D heading. The remaining pitch
    // is reserved for roars, pounces and the scripted menu interactions.
    const lean=Number.isFinite(d.artHeading)?(d.artPitch||0):pitch||0;
    if(lean){c.translate(0,-s*.6);c.rotate((turn<0?-1:1)*lean);c.translate(0,s*.6);}
    if(live)c.drawImage(img,slot.x,slot.y,slot.cell,slot.cell,-ORIGIN_X*s,-ORIGIN_Y*s,5.8*s,5.8*s);
    else c.drawImage(img,-ORIGIN_X*s,-ORIGIN_Y*s,5.8*s,CH/UNIT*s);
    c.restore();return true;
  }
  function mouth(d){
    const key=keyOf(d);if(!key||!available())return null;const m=model(key),r=m.rig,p=r.mouth||[1,1,0],bones=CreatureMeshes.pose(m,d.phase||0,roar(d),frill(d),d.artFlight);
    const point=id=>{const b=bones.subarray(id*16,id*16+16);return [b[0]*p[0]+b[4]*p[1]+b[8]*p[2]+b[12],b[1]*p[0]+b[5]*p[1]+b[9]*p[2]+b[13],b[2]*p[0]+b[6]*p[1]+b[10]*p[2]+b[14]];};
    const upper=point(r.headBone),lower=point(r.jawBone),q=upper.map((n,i)=>(n+lower[i])*.5),live=Number.isFinite(d.artHeading),yaw=live?d.artHeading:.16,dir=live?(d.dir||d.dirT||1):1;
    const view=d.artView===undefined?GROUND:Math.max(0,Math.min(.8,d.artView)),height=Math.sqrt(1-view*view);
    return {x:(q[0]*Math.cos(yaw)-q[2]*Math.sin(yaw))/dir,y:(q[0]*Math.sin(yaw)+q[2]*Math.cos(yaw))*view-q[1]*height+.6};
  }
  function inspect(c,d,x,y,size,phase,yaw,opening){
    const key=keyOf(d);if(!key||!available())return false;
    const resolution=Math.min(maxEdge,coarse?640:1024);resize(resolution,resolution);renderTile({...d,artRoar:opening},key,phase,yaw,0,0,resolution,resolution);
    c.drawImage(source,x-ORIGIN_X*size,y-ORIGIN_Y*size,5.8*size,5.8*size);return true;
  }
  // The wave-one visitor carrier shares the exported Pteranodon, with its
  // own flight controls and a foot socket projected from those exact bones.
  function snatchFrame(o){
    if(!available())return null;
    const m=model('pteranodon');if(!m.rig.grips?.length)return null;
    const actor={key:'pteranodon',artView:.46,artRoar:o.phase==='grab'?.65:o.phase==='dive'?.22:.30,
      artFlight:{spread:o.spread,reach:o.talon,grip:o.phase==='grab'||o.phase==='carry'?1:0}};
    const phase=o.ph,yaw=o.dir<0?Math.PI-.42:.42,size=o.size*.88,view=actor.artView,height=Math.sqrt(1-view*view);
    const bones=CreatureMeshes.pose(m,phase,actor.artRoar,0,actor.artFlight),bank=(o.bank??(o.phase==='dive'?(1-o.spread)*.18:o.phase==='carry'?-.12:0))*o.dir;
    const project=(p,id)=>{const k=id*16,q=[0,1,2].map(i=>bones[k+i]*p[0]+bones[k+4+i]*p[1]+bones[k+8+i]*p[2]+bones[k+12+i]);return {x:q[0]*Math.cos(yaw)-q[2]*Math.sin(yaw),y:(q[0]*Math.sin(yaw)+q[2]*Math.cos(yaw))*view-q[1]*height};};
    const center=project([-.1,1.50,0],0),feet=m.rig.grips.map(g=>project(g.socket,g.id));
    const local={x:(feet[0].x+feet[1].x)/2-center.x,y:(feet[0].y+feet[1].y)/2-center.y};
    const grip={x:o.x+(local.x*Math.cos(bank)-local.y*Math.sin(bank))*size,y:o.y+(local.x*Math.sin(bank)+local.y*Math.cos(bank))*size};
    return {actor,phase,yaw,size,bank,center,grip};
  }
  function drawSnatcher(c,o,frame=snatchFrame(o)){
    if(!frame||!available())return false;
    const {actor,phase,yaw,size,bank,center}=frame,tf=c.getTransform();
    const scale=Math.max(Math.hypot(tf.a,tf.b),Math.hypot(tf.c,tf.d));
    const resolution=Math.min(maxEdge,coarse?384:640,Math.max(224,Math.ceil(size*5.8*scale)));
    resize(resolution,resolution);renderTile(actor,'pteranodon',phase,yaw,0,0,resolution,resolution);
    c.save();c.translate(o.x,o.y);c.rotate(bank);
    c.drawImage(source,(-ORIGIN_X-center.x)*size,(-ORIGIN_Y-center.y)*size,5.8*size,5.8*size);c.restore();return true;
  }
  // A small set of real skin vertices feeds surface effects. Their positions
  // use exactly the same blended bones and projection as the rendered mesh.
  // No separate effects skeleton or hand-positioned species silhouettes.
  function effectFrame(d,phase=d.phase||0,turn=d.turn??d.dir??1){
    const key=keyOf(d);if(!available()||!key)return null;const m=model(key),v=m.vertices,stride=m.vertexStride||15;
    if(!m.effectSites){
      const cells=new Map(),tops=new Map(),extremes=new Map();
      for(let i=0;i<v.length;i+=stride*3){const part=v[i+14],p=[v[i],v[i+1],v[i+2]],cell=part+':'+p.map(x=>Math.floor(x*4)).join(',');if(!cells.has(cell))cells.set(cell,i);
        for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const k=part+':'+axis+':'+sign,old=extremes.get(k);if(old===undefined||v[old+axis]*sign<p[axis]*sign)extremes.set(k,i);}
        if((part===0||part===3||part===10||part===11)&&v[i+4]>.32){const k=Math.floor(p[0]*3)+':'+Math.round(p[2]*2),old=tops.get(k);if(old===undefined||v[old+1]<p[1])tops.set(k,i);}
      }
      const candidates=[...cells.values()],sites=[...new Set(extremes.values())];for(let n=0;sites.length<96&&n<Math.min(96,candidates.length);n++){const i=candidates[Math.floor(n*candidates.length/Math.min(96,candidates.length))];if(!sites.includes(i))sites.push(i);}
      const fire=[...tops.values()].sort((a,b)=>v[a]-v[b]);m.effectSites={sites:sites.slice(0,96),fire:Array.from({length:Math.min(14,fire.length)},(_,i)=>fire[Math.floor(i*fire.length/Math.min(14,fire.length))])};
    }
    const bones=CreatureMeshes.pose(m,d.entranceT>0?0:phase,roar(d),frill(d),d.artFlight),yaw=yawFor(d,turn),cy=Math.cos(yaw),sy=Math.sin(yaw),view=Math.max(0,Math.min(.8,d.artView??GROUND)),height=Math.sqrt(1-view*view);
    const bonePoint=(p,id)=>{const k=id*16;return [bones[k]*p[0]+bones[k+4]*p[1]+bones[k+8]*p[2]+bones[k+12],bones[k+1]*p[0]+bones[k+5]*p[1]+bones[k+9]*p[2]+bones[k+13],bones[k+2]*p[0]+bones[k+6]*p[1]+bones[k+10]*p[2]+bones[k+14]];};
    function project(p,a=0,b=0,blend=0){const q=bonePoint(p,a),r=blend?bonePoint(p,b):q,x=q[0]+(r[0]-q[0])*blend,y=q[1]+(r[1]-q[1])*blend,z=q[2]+(r[2]-q[2])*blend,X=x*cy-z*sy,Z=x*sy+z*cy;return {x:X,y:Z*view-y*height,depth:y*view+Z*height};}
    const point=i=>({...project([v[i],v[i+1],v[i+2]],v[i+12],stride===17?v[i+15]:0,stride===17?v[i+16]:0),part:m.parts[v[i+14]]});
    const sites=m.effectSites.sites.map(point),fire=m.effectSites.fire.map(point),body=m.anatomy?.body||[[-.4,1,.2,.3]],wide=body.reduce((a,b)=>a[3]>b[3]?a:b),center=project([wide[0],(wide[1]+wide[2])/2,0]);
    const bounds={left:Math.min(...sites.map(p=>p.x)),right:Math.max(...sites.map(p=>p.x)),top:Math.min(...sites.map(p=>p.y)),bottom:Math.max(...sites.map(p=>p.y))};
    return {sites,fire,center,bounds,project,rig:m.rig,anatomy:m.anatomy,parts:m.parts,head:project(m.rig.head,m.rig.headBone),eyes:m.anatomy?.eye?[-1,1].map(side=>project([m.anatomy.eye[0],m.anatomy.eye[1],side*m.anatomy.eye[2]],m.rig.headBone)):[]};
  }
  function part(c,d,kind,options={}){
    const key=keyOf(d);if(!key||!available())return false;
    const m=model(key),names={head:['head','lowerJaw'],jaw:['lowerJaw'],leg:[options.far?'farLeg':'nearLeg'],arm:[options.far?'farArm':'nearArm'],tail:['tail'],wing:[options.far?'wingFar':'wingNear'],flipper:['flipper'],sail:['sail'],scute:['ridge']}[kind];
    if(!names)return false;
    if(!m.partBounds)m.partBounds=new Map();let bounds=m.partBounds.get(names.join());
    if(!bounds){bounds=[Infinity,Infinity,-Infinity,-Infinity];const v=m.vertices,selected=names.map(n=>m.parts.indexOf(n));
      for(let i=0;i<v.length;i+=(m.vertexStride||15))if(selected.includes(v[i+14])){const x=v[i]*Math.cos(.16)-v[i+2]*Math.sin(.16),y=-v[i+1]*HEIGHT+(v[i]*Math.sin(.16)+v[i+2]*Math.cos(.16))*GROUND;bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
      m.partBounds.set(names.join(),bounds);
    }
    if(!Number.isFinite(bounds[0]))return false;
    const mask=Object.fromEntries(m.parts.map(n=>[n,names.includes(n)?0:1]));
    const img=sprite({...d,deathMask:mask,hideSail:false},d.phase||0,.16);if(!img)return false;
    c.drawImage(img,-ORIGIN_X-(bounds[0]+bounds[2])*.5,-ORIGIN_Y-(bounds[1]+bounds[3])*.5,5.8,CH/UNIT);return true;
  }
  // Direct painter calls are used by boss fragments and the existing labs.
  // They now share the exact rig, skin and anatomical part masks with play.
  for(const name of Object.keys(PAINTERS))if(name!=='omega'){
    fallback[name]=PAINTERS[name];PAINTERS[name]=(c,d,ph)=>{const actor=d.painter?d:{...d,painter:name};if(!unit(c,actor,ph))fallback[name](c,d,ph);};
  }
  for(const key of ids){const cfg=CreatureMeshes.catalog[key];DINOS[key].pal={body:cfg.body,belly:cfg.belly,accent:cfg.mark};}
  const ready=async(keys=ids)=>available()?Promise.all(keys.map(key=>model(key).ready||Promise.resolve(false))):keys.map(()=>false);
  return {draw,unit,prepare,inspect,part,keyOf,mouth,model,ready,roar,effectFrame,snatchFrame,drawSnatcher,GROUND,HEIGHT,
    get available(){return available();},get error(){return error;},get modelCount(){return models.size;},get cacheBytes(){return cache.size*CW*CH*4;},get atlasBytes(){return atlas.width*atlas.height*4;},get cacheLimit(){return MAX_CACHE;},get cachedSprites(){return cache.size;}};
})();
