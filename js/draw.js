'use strict';
/* =========================================================
   ISLA DEFENSE — procedural art
   All dinosaurs are drawn in code: side view, facing +x,
   origin at ground level under the hips. Caller translates,
   flips and scales. `ph` is a walk-cycle phase in radians.
   ========================================================= */

function shade(hex, f){ // lighten (f>0) / darken (f<0) a #rrggbb color
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0){ r += (255-r)*f; g += (255-g)*f; b += (255-b)*f; }
  else { r *= 1+f; g *= 1+f; b *= 1+f; }
  return `rgb(${r|0},${g|0},${b|0})`;
}

/* ---------- leg helper: two-joint walk cycle with foot lift ---------- */
function leg(ctx, hipX, hipY, len, ph, color, w){
  const swing = Math.sin(ph);                    // fore/aft sweep
  const lift  = Math.max(0, Math.cos(ph));       // lift while swinging forward, plant while sweeping back
  const a1 = swing * 0.55;                       // thigh angle from vertical
  const kx = hipX + Math.sin(a1) * len * 0.5;
  const ky = hipY + Math.cos(a1) * len * 0.5 - lift * len * 0.14;
  const a2 = a1 + 0.4 + lift * 1.05;             // shin folds as the foot lifts
  const fx = kx + Math.sin(a2) * len * 0.52;
  const fy = Math.min(0, ky + Math.cos(a2) * len * 0.52 - lift * len * 0.22);
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.lineWidth = w * 0.7;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  // foot with a toe that trails when lifted
  ctx.lineWidth = w * 0.5;
  ctx.beginPath(); ctx.moveTo(fx, fy);
  ctx.lineTo(fx + w * 1.1, fy - lift * len * 0.08);
  ctx.stroke();
}

/* ---------- THEROPOD (raptors, rexes, most carnivores) ---------- */
function drawTheropod(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const slim = f.slim ? 0.78 : 1;
  const big  = f.bigHead ? 1.25 : 1;
  const bob  = Math.abs(Math.sin(ph)) * 0.06;
  // entrance roar: jaws thrown wide, head raised
  const roar = (d.entranceT || 0) > 0 ? Math.min(1, (2.2 - d.entranceT) * 2.5) : 0;

  // hind legs (far leg darker, behind body)
  leg(ctx, -0.05, -0.62, 0.62, ph + Math.PI, shade(p.body, -0.35), 0.16*slim);

  ctx.save();
  ctx.translate(0, -bob);

  // tail — tapered curve with a traveling sway wave
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.85);
  ctx.quadraticCurveTo(-0.85, -0.80 + Math.sin(ph*0.9 + 1.1)*0.08, -1.45, -0.62 + Math.sin(ph*0.9)*0.13);
  ctx.quadraticCurveTo(-0.80, -0.62 + Math.sin(ph*0.9 + 0.6)*0.05, -0.15, -0.45);
  ctx.closePath(); ctx.fill();

  // body
  ctx.beginPath();
  ctx.ellipse(0, -0.66, 0.52*  (f.slim?0.9:1), 0.30, -0.12, 0, Math.PI*2);
  ctx.fill();
  // belly
  ctx.fillStyle = p.belly;
  ctx.beginPath();
  ctx.ellipse(0.02, -0.55, 0.42*(f.slim?0.9:1), 0.17, -0.10, 0, Math.PI*2);
  ctx.fill();

  // sail (Spinosaurus)
  if (f.sail){
    ctx.fillStyle = shade(p.accent, -0.05);
    ctx.beginPath(); ctx.moveTo(-0.55, -0.80);
    for (let i = 0; i <= 8; i++){
      const t = i/8, x = -0.55 + t*1.0;
      ctx.lineTo(x, -0.80 - Math.sin(t*Math.PI) * 0.55);
    }
    ctx.closePath(); ctx.fill();
  }
  // back ridge / feathers
  if (f.ridge || f.feathers){
    ctx.fillStyle = f.feathers ? shade(p.accent, 0.15) : shade(p.body, -0.25);
    ctx.beginPath(); ctx.moveTo(-0.5, -0.88);
    for (let i = 0; i < 6; i++){ const x = -0.5 + i*0.17; ctx.lineTo(x+0.08, -0.98); ctx.lineTo(x+0.17, -0.88); }
    ctx.closePath(); ctx.fill();
  }
  // spikes along back (Indominus / Stygimoloch)
  if (f.spikes){
    ctx.fillStyle = shade(p.body, -0.3);
    for (let i = 0; i < 5; i++){
      const x = -0.45 + i*0.2;
      ctx.beginPath(); ctx.moveTo(x, -0.9); ctx.lineTo(x+0.05, -1.02); ctx.lineTo(x+0.1, -0.9); ctx.fill();
    }
  }
  // stripes
  if (f.stripes){
    ctx.strokeStyle = p.accent; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++){
      const x = -0.3 + i*0.2;
      ctx.beginPath(); ctx.moveTo(x, -0.9); ctx.quadraticCurveTo(x+0.05, -0.7, x, -0.52); ctx.stroke();
    }
  }

  // neck + head (with a subtle bob counter to the stride)
  const hx = 0.55 + Math.sin(ph + 0.5)*0.02 - roar*0.06,
        hy = -0.98 - (big-1)*0.1 + Math.sin(ph*2 + 0.8)*0.035 - roar*0.16;
  ctx.fillStyle = p.body;
  ctx.beginPath();               // neck
  ctx.moveTo(0.28, -0.88); ctx.quadraticCurveTo(0.42, -1.0, hx, hy);
  ctx.lineTo(hx + 0.05, hy + 0.28); ctx.quadraticCurveTo(0.4, -0.65, 0.25, -0.55);
  ctx.closePath(); ctx.fill();

  const snout = f.longSnout ? 0.5 : 0.34;
  ctx.save();
  ctx.translate(hx, hy);
  if (roar) ctx.rotate(-roar * 0.38);
  const jawOpen = 0.06 + Math.max(0, Math.sin(ph*0.9)) * 0.05 + roar * 0.22;
  // skull
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.16*big);
  ctx.quadraticCurveTo(0.18*big, -0.2*big, snout*big, -0.04);
  ctx.lineTo(snout*big, 0.02); ctx.lineTo(-0.08, 0.1); ctx.closePath(); ctx.fill();
  // lower jaw
  ctx.fillStyle = shade(p.body, -0.15);
  ctx.beginPath();
  ctx.moveTo(-0.05, 0.06);
  ctx.lineTo(snout*big*0.9, 0.05 + jawOpen);
  ctx.lineTo(snout*big*0.9, 0.10 + jawOpen);
  ctx.lineTo(-0.05, 0.14); ctx.closePath(); ctx.fill();
  // savage pointy teeth — fangs hang from the upper jawline (following its
  // slope), smaller counter-teeth jut up from the lower jaw. Carnivores!
  ctx.fillStyle = '#f4f2e4';
  const sb = snout * big;
  const upperY = tx => 0.02 + 0.08 * (sb - tx) / (sb + 0.08);   // upper jaw bottom edge
  for (let i = 0; i < 5; i++){
    const t = i / 4, tx = 0.09 + (sb * 0.9 - 0.09) * t;
    const ty = upperY(tx);
    const tl = 0.045 + t * 0.035;                               // longest fangs at the snout
    ctx.beginPath();
    ctx.moveTo(tx - 0.024, ty);
    ctx.lineTo(tx + 0.024, ty);
    ctx.lineTo(tx + 0.004, ty + tl);
    ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 4; i++){                                  // lower jaw teeth, pointing up
    const t = i / 3, tx = 0.16 + (sb * 0.82 - 0.16) * t;
    const ty = 0.062 + (jawOpen - 0.012) * (tx + 0.05) / (sb * 0.9 + 0.05);
    ctx.beginPath();
    ctx.moveTo(tx - 0.018, ty);
    ctx.lineTo(tx + 0.018, ty);
    ctx.lineTo(tx - 0.002, ty - 0.035);
    ctx.closePath(); ctx.fill();
  }
  // eye
  if (f.glowEyes){ // hellish glow for the D-Rex
    const pulse = 0.7 + 0.3 * Math.sin(ph * 2.3);
    const eg = ctx.createRadialGradient(0.04, -0.08*big, 0.005, 0.04, -0.08*big, 0.11);
    eg.addColorStop(0, `rgba(255,60,40,${0.85 * pulse})`);
    eg.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(0.04, -0.08*big, 0.11, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0d0a0a';
    ctx.beginPath(); ctx.arc(0.04, -0.08*big, 0.038, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,80,50,${pulse})`;
    ctx.beginPath(); ctx.arc(0.045, -0.085*big, 0.02, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a0505'; // slit pupil
    ctx.fillRect(0.042, -0.085*big - 0.018, 0.007, 0.036);
  } else {
    ctx.fillStyle = '#1a1a12';
    ctx.beginPath(); ctx.arc(0.04, -0.08*big, 0.035, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = f.stripes && d.boss ? '#ffd24a' : '#e8e4c8';
    ctx.beginPath(); ctx.arc(0.045, -0.085*big, 0.015, 0, Math.PI*2); ctx.fill();
  }
  // horns above eyes (Carnotaurus / Allosaurus)
  if (f.horns){
    ctx.fillStyle = shade(p.accent, -0.1);
    ctx.beginPath(); ctx.moveTo(0.0, -0.16*big); ctx.lineTo(0.05, -0.3*big); ctx.lineTo(0.1, -0.16*big); ctx.fill();
  }
  // dome skull (Pachy / Stygimoloch)
  if (f.dome){
    ctx.fillStyle = shade(p.belly, -0.1);
    ctx.beginPath(); ctx.arc(0.02, -0.14, 0.14, Math.PI, 0); ctx.fill();
    if (f.spikes){
      ctx.fillStyle = shade(p.accent, -0.2);
      for (let i = 0; i < 3; i++){
        const a = Math.PI*1.15 + i*0.35;
        ctx.beginPath();
        ctx.moveTo(0.02 + Math.cos(a)*0.13, -0.14 + Math.sin(a)*0.13);
        ctx.lineTo(0.02 + Math.cos(a)*0.24, -0.14 + Math.sin(a)*0.24);
        ctx.lineTo(0.02 + Math.cos(a+0.2)*0.13, -0.14 + Math.sin(a+0.2)*0.13);
        ctx.fill();
      }
    }
  }
  // dilophosaurus frill (flares with jaw)
  if (f.frill){
    ctx.fillStyle = 'rgba(230,180,40,0.85)';
    ctx.beginPath(); ctx.ellipse(-0.05, -0.02, 0.16 + jawOpen*1.5, 0.22 + jawOpen*2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = shade(p.accent, -0.2);
    ctx.beginPath(); ctx.ellipse(-0.05, -0.02, 0.07, 0.1, 0, 0, Math.PI*2); ctx.fill();
    // twin crests
    ctx.strokeStyle = p.accent; ctx.lineWidth = 0.045;
    ctx.beginPath(); ctx.arc(0.05, -0.16, 0.09, Math.PI, 0); ctx.stroke();
  }
  ctx.restore();

  // tiny arms (or huge claws for Therizinosaurus) — tucked, swinging gently
  // counter to the stride so they read as alive at any size
  ctx.lineCap = 'round';
  const armSw = Math.sin(ph + Math.PI) * 0.075;      // fore/aft sway
  const armDrop = Math.abs(Math.sin(ph)) * 0.02;     // tiny settle on each step
  if (f.claws){
    ctx.strokeStyle = shade(p.body, -0.2); ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(0.3, -0.72); ctx.lineTo(0.52 + armSw, -0.5 + armDrop); ctx.stroke();
    ctx.strokeStyle = '#ddd8c0'; ctx.lineWidth = 0.035;
    for (let i = 0; i < 3; i++){
      ctx.beginPath(); ctx.moveTo(0.52 + armSw, -0.5 + armDrop);
      ctx.lineTo(0.62 + armSw + i*0.03, -0.32 + armDrop - i*0.04); ctx.stroke();
    }
  } else {
    const drawArm = (sw, color, wd) => { // shoulder → elbow → tucked hand/claw
      const ex = 0.345 + sw * 0.5, ey = -0.645 + armDrop;        // elbow
      const hx2 = 0.41 + sw * 1.3, hy2 = -0.585 + armDrop + Math.abs(sw) * 0.25; // hand
      ctx.strokeStyle = color; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.moveTo(0.29, -0.73); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineWidth = wd * 0.75;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx2, hy2); ctx.stroke();
      ctx.lineWidth = wd * 0.45;                                 // little two-finger claw
      ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.lineTo(hx2 + 0.045, hy2 + 0.035); ctx.stroke();
    };
    drawArm(-armSw, shade(p.body, -0.45), 0.06);   // far arm, darker, opposite phase
    drawArm(armSw, shade(p.body, -0.2), 0.07);     // near arm
  }
  ctx.restore();

  // near hind leg (in front of body)
  leg(ctx, 0.02, -0.62, 0.64, ph, shade(p.body, -0.12), 0.17*slim);
}

/* ---------- QUADRUPED (stego, trike, anky, para) ---------- */
function drawQuad(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const bob = Math.abs(Math.sin(ph)) * 0.04;

  // far legs
  leg(ctx, -0.42, -0.5, 0.5, ph + Math.PI, shade(p.body, -0.35), 0.15);
  leg(ctx,  0.38, -0.5, 0.5, ph + Math.PI*0.5, shade(p.body, -0.35), 0.15);

  ctx.save(); ctx.translate(0, -bob);

  // tail
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.5, -0.7);
  ctx.quadraticCurveTo(-1.1, -0.6 + Math.sin(ph*0.6)*0.05, -1.4, -0.42);
  ctx.quadraticCurveTo(-0.9, -0.42, -0.5, -0.4);
  ctx.closePath(); ctx.fill();
  // ankylosaurus tail club
  if (f.club){
    ctx.fillStyle = shade(p.accent, 0.1);
    ctx.beginPath(); ctx.arc(-1.42, -0.42, 0.14, 0, Math.PI*2); ctx.fill();
  }
  // stego tail spikes
  if (f.tailSpikes){
    ctx.strokeStyle = '#ddd4b0'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1.3, -0.48); ctx.lineTo(-1.45, -0.72); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1.2, -0.44); ctx.lineTo(-1.28, -0.7); ctx.stroke();
  }

  // body
  ctx.fillStyle = p.body;
  ctx.beginPath(); ctx.ellipse(0, -0.62, 0.62, 0.34, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = p.belly;
  ctx.beginPath(); ctx.ellipse(0, -0.48, 0.5, 0.16, 0, 0, Math.PI*2); ctx.fill();

  // stego back plates
  if (f.plates){
    ctx.fillStyle = shade(p.accent, 0.05);
    for (let i = 0; i < 5; i++){
      const x = -0.5 + i*0.25, h = 0.28 * Math.sin((i+0.5)/5*Math.PI) + 0.12;
      ctx.beginPath(); ctx.moveTo(x, -0.9); ctx.lineTo(x+0.11, -0.9 - h); ctx.lineTo(x+0.22, -0.9); ctx.closePath(); ctx.fill();
    }
  }
  // anky armor bumps
  if (f.armorBumps){
    ctx.fillStyle = shade(p.body, -0.28);
    for (let i = 0; i < 6; i++){
      const x = -0.45 + i*0.18, y = -0.82 - Math.sin((i+0.5)/6*Math.PI)*0.1;
      ctx.beginPath(); ctx.arc(x, y, 0.06, 0, Math.PI*2); ctx.fill();
    }
  }

  // head/neck
  if (f.trike){
    // frill
    ctx.fillStyle = shade(p.body, -0.15);
    ctx.beginPath(); ctx.ellipse(0.62, -0.78, 0.24, 0.3, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.ellipse(0.62, -0.78, 0.15, 0.2, -0.3, 0, Math.PI*2); ctx.fill();
    // head
    ctx.fillStyle = p.body;
    ctx.beginPath(); ctx.ellipse(0.85, -0.62, 0.24, 0.16, -0.15, 0, Math.PI*2); ctx.fill();
    // brow horns + nose horn
    ctx.strokeStyle = '#e8e0c4'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.78, -0.74); ctx.lineTo(1.0, -0.95); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.85, -0.7); ctx.lineTo(1.05, -0.88); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.02, -0.62); ctx.lineTo(1.12, -0.74); ctx.stroke();
    ctx.fillStyle = '#1a1a12'; ctx.beginPath(); ctx.arc(0.86, -0.66, 0.03, 0, Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle = p.body;
    ctx.beginPath();
    ctx.moveTo(0.45, -0.8); ctx.quadraticCurveTo(0.7, -0.9, 0.85, -0.75);
    ctx.lineTo(0.9, -0.55); ctx.quadraticCurveTo(0.6, -0.45, 0.45, -0.45);
    ctx.closePath(); ctx.fill();
    // head
    ctx.beginPath(); ctx.ellipse(0.9, -0.68, 0.18, 0.12, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1a12'; ctx.beginPath(); ctx.arc(0.92, -0.72, 0.028, 0, Math.PI*2); ctx.fill();
    // parasaurolophus crest sweeping back
    if (f.headCrest){
      ctx.strokeStyle = p.accent; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0.92, -0.76); ctx.quadraticCurveTo(0.7, -1.05, 0.45, -1.05); ctx.stroke();
    }
  }
  ctx.restore();

  // near legs
  leg(ctx, -0.38, -0.5, 0.52, ph, shade(p.body, -0.12), 0.16);
  leg(ctx,  0.42, -0.5, 0.52, ph + Math.PI*1.5, shade(p.body, -0.12), 0.16);
}

/* ---------- SAUROPOD (brachio, apato) ---------- */
function drawSauropod(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const tall = f.tall ? 1.25 : 1;
  const sway = Math.sin(ph*0.4) * 0.05;

  leg(ctx, -0.45, -0.55, 0.55, ph + Math.PI, shade(p.body, -0.35), 0.2);
  leg(ctx,  0.35, -0.55, 0.55, ph + Math.PI*0.5, shade(p.body, -0.35), 0.2);

  // tail
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.5, -0.85);
  ctx.quadraticCurveTo(-1.3, -0.7, -1.75, -0.35 + Math.sin(ph*0.5)*0.06);
  ctx.quadraticCurveTo(-1.1, -0.45, -0.5, -0.45);
  ctx.closePath(); ctx.fill();

  // body
  ctx.beginPath(); ctx.ellipse(0, -0.7, 0.66, 0.4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = p.belly;
  ctx.beginPath(); ctx.ellipse(0, -0.52, 0.52, 0.18, 0, 0, Math.PI*2); ctx.fill();

  // neck: long curve up-forward
  const nx = 0.95 + sway, ny = -1.9*tall;
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(0.4, -1.0);
  ctx.quadraticCurveTo(0.75, -1.4*tall, nx, ny);
  ctx.lineTo(nx + 0.14, ny + 0.05);
  ctx.quadraticCurveTo(0.95, -1.2*tall, 0.55, -0.6);
  ctx.closePath(); ctx.fill();
  // head
  ctx.beginPath(); ctx.ellipse(nx + 0.1, ny - 0.02, 0.15, 0.09, 0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a12';
  ctx.beginPath(); ctx.arc(nx + 0.12, ny - 0.05, 0.025, 0, Math.PI*2); ctx.fill();

  leg(ctx, -0.35, -0.55, 0.58, ph, shade(p.body, -0.12), 0.22);
  leg(ctx,  0.45, -0.55, 0.58, ph + Math.PI*1.5, shade(p.body, -0.12), 0.22);
}

/* ---------- FLYER (pteranodon, dimorphodon, quetzalcoatlus) ---------- */
function drawFlyer(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const flap = Math.sin(ph * 2.2);

  ctx.save();
  ctx.translate(0, -1.4 + Math.sin(ph * 1.1) * 0.09); // bobbing flight above the ground point

  // far wing
  ctx.fillStyle = shade(p.body, -0.3);
  ctx.beginPath();
  ctx.moveTo(-0.05, 0);
  ctx.quadraticCurveTo(-0.5, -0.25 - flap*0.5, -1.15, -0.15 - flap*0.85);
  ctx.quadraticCurveTo(-0.55, 0.18, -0.05, 0.12);
  ctx.closePath(); ctx.fill();

  // body
  ctx.fillStyle = p.body;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 0.16, -0.1, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = p.belly;
  ctx.beginPath(); ctx.ellipse(0.02, 0.06, 0.3, 0.08, -0.1, 0, Math.PI*2); ctx.fill();

  // head + beak
  ctx.fillStyle = p.body;
  ctx.beginPath(); ctx.ellipse(0.45, -0.12, 0.14, 0.1, 0.1, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); // beak
  ctx.moveTo(0.5, -0.18); ctx.lineTo(0.95, -0.02); ctx.lineTo(0.5, 0.0); ctx.closePath(); ctx.fill();
  if (f.crest){
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(0.42, -0.2); ctx.lineTo(0.1, -0.42); ctx.lineTo(0.48, -0.1); ctx.closePath(); ctx.fill();
  }
  if (f.glowEyes){ // burning red eye for the boss flyer
    const pulse = 0.7 + 0.3 * Math.sin(ph * 2.5);
    const eg = ctx.createRadialGradient(0.47, -0.14, 0.005, 0.47, -0.14, 0.1);
    eg.addColorStop(0, `rgba(255,60,40,${0.85 * pulse})`);
    eg.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(0.47, -0.14, 0.1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,90,60,${pulse})`;
    ctx.beginPath(); ctx.arc(0.47, -0.14, 0.035, 0, Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle = '#1a1a12';
    ctx.beginPath(); ctx.arc(0.47, -0.14, 0.03, 0, Math.PI*2); ctx.fill();
  }

  // near wing
  ctx.fillStyle = shade(p.body, 0.06);
  ctx.beginPath();
  ctx.moveTo(0.05, -0.05);
  ctx.quadraticCurveTo(-0.35, -0.4 - flap*0.6, -1.0, -0.35 - flap*1.0);
  ctx.quadraticCurveTo(-0.45, 0.12, 0.05, 0.1);
  ctx.closePath(); ctx.fill();

  // legs tucked
  ctx.strokeStyle = shade(p.body, -0.25); ctx.lineWidth = 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.25, 0.1); ctx.lineTo(-0.45, 0.22); ctx.stroke();
  ctx.restore();
}

/* ---------- MUTANT REX (the D-Rex finale boss) ----------
   A hulking, hunched, deformed tyrannosaur mutation: a high humped back
   caked in tumorous lumps, a low-slung heavy skull, and FOUR clawed arms
   (a large upper pair and a smaller lower pair on each side). Original
   procedural art, evoking the misshapen four-armed hybrid vibe. */
function mutantArm(ctx, sx, sy, reach, drop, w, color, claw, ph, off){
  const sw = Math.sin((ph || 0) + (off || 0)) * 0.05;   // subtle idle swing
  const ex = sx + reach * 0.55, ey = sy + drop * 0.45 + sw;   // elbow
  const hx = sx + reach + sw * 0.5, hy = sy + drop + sw;      // hand
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();      // upper arm
  ctx.lineWidth = w * 0.8;
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();      // forearm
  ctx.strokeStyle = claw; ctx.lineWidth = w * 0.4;                            // three long hooked claws
  for (let i = 0; i < 3; i++){
    const a = 0.15 + i * 0.36;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 0.22, hy + Math.sin(a) * 0.22); ctx.stroke();
  }
}
function drawMutantRex(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const bob   = Math.abs(Math.sin(ph)) * 0.05;
  const sway  = Math.sin(ph * 0.9);
  const roar  = (d.entranceT || 0) > 0 ? Math.min(1, (3.4 - d.entranceT) * 2.0) : 0;
  const skin   = p.body;
  const dark   = shade(p.body, -0.32);
  const darker = shade(p.body, -0.5);
  const litSkin = shade(p.body, 0.14);

  // far hind leg (behind everything)
  leg(ctx, -0.08, -0.66, 0.7, ph + Math.PI, darker, 0.24);
  // far-side arms (behind the torso, mid-tone so they still read) — reach out
  // below the belly line so the second pair is clearly visible
  mutantArm(ctx, 0.12, -0.86, 0.50, 0.60, 0.10,  dark, shade(p.body,-0.15), ph, 0.3);
  mutantArm(ctx, 0.18, -0.66, 0.44, 0.52, 0.08,  dark, shade(p.body,-0.15), ph, 0.9);

  ctx.save();
  ctx.translate(0, -bob);

  // heavy tail, low and dragging with a slow sway
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-0.12, -0.9);
  ctx.quadraticCurveTo(-0.9, -0.86 + sway*0.06, -1.55, -0.5 + sway*0.10);
  ctx.quadraticCurveTo(-1.64, -0.33, -1.5, -0.22 + sway*0.08);
  ctx.quadraticCurveTo(-0.85, -0.44, -0.12, -0.44);
  ctx.closePath(); ctx.fill();

  // hulking, arched, misshapen torso
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-0.5, -0.6);
  ctx.quadraticCurveTo(-0.56, -1.03, -0.1, -1.13);   // high humped back
  ctx.quadraticCurveTo(0.36, -1.17, 0.52, -0.92);    // shoulders
  ctx.quadraticCurveTo(0.68, -0.72, 0.5, -0.5);      // chest
  ctx.quadraticCurveTo(0.2, -0.3, -0.15, -0.34);     // belly
  ctx.quadraticCurveTo(-0.42, -0.38, -0.5, -0.6);    // hip
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = p.belly;
  ctx.beginPath(); ctx.ellipse(0.04, -0.46, 0.4, 0.16, -0.06, 0, Math.PI*2); ctx.fill();

  // tumorous lumps caking the back & flank (asymmetric)
  ctx.fillStyle = shade(p.body, -0.18);
  for (const [lx, ly, lr] of [[-0.28,-0.99,0.12],[-0.05,-1.07,0.10],[0.20,-0.99,0.13],[-0.42,-0.70,0.10],[0.34,-0.74,0.08],[-0.16,-0.62,0.09],[0.06,-0.7,0.07]]){
    ctx.beginPath(); ctx.ellipse(lx, ly, lr, lr*0.8, 0.3, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = litSkin; // glistening highlights on the lumps
  for (const [lx, ly, lr] of [[-0.3,-1.02,0.05],[0.18,-1.01,0.05],[-0.07,-1.09,0.045]]){
    ctx.beginPath(); ctx.ellipse(lx, ly, lr, lr*0.7, 0.3, 0, Math.PI*2); ctx.fill();
  }
  // gnarled, uneven spines along the ridge
  ctx.fillStyle = darker;
  for (const [sx0, sy0, h] of [[-0.4,-0.86,0.12],[-0.22,-1.03,0.17],[-0.02,-1.11,0.18],[0.18,-1.05,0.14],[0.34,-0.9,0.1]]){
    ctx.beginPath(); ctx.moveTo(sx0-0.05, sy0); ctx.lineTo(sx0, sy0-h); ctx.lineTo(sx0+0.06, sy0); ctx.closePath(); ctx.fill();
  }

  // thick neck sweeping forward-down to a low, heavy head
  const hx = 0.72 - roar*0.04, hy = -0.7 - roar*0.12 + Math.sin(ph*2)*0.02;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.34, -0.98);
  ctx.quadraticCurveTo(0.6, -0.98, hx, hy - 0.14);
  ctx.lineTo(hx + 0.02, hy + 0.2);
  ctx.quadraticCurveTo(0.52, -0.62, 0.36, -0.66);
  ctx.closePath(); ctx.fill();

  ctx.save();
  ctx.translate(hx, hy);
  if (roar) ctx.rotate(-roar * 0.22);
  const jaw = 0.05 + Math.max(0, Math.sin(ph*0.9))*0.03 + roar*0.3;
  // heavy skull
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-0.14, -0.2);
  ctx.quadraticCurveTo(0.16, -0.28, 0.44, -0.12);
  ctx.lineTo(0.46, 0.0); ctx.lineTo(-0.1, 0.06); ctx.closePath(); ctx.fill();
  // brooding brow ridge
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-0.14, -0.2); ctx.quadraticCurveTo(0.05, -0.31, 0.22, -0.22);
  ctx.quadraticCurveTo(0.06, -0.15, -0.12, -0.14); ctx.closePath(); ctx.fill();
  // upper teeth
  ctx.fillStyle = '#efe8d2';
  for (let i = 0; i < 6; i++){ const tx = 0.02 + i*0.07; ctx.beginPath(); ctx.moveTo(tx,0.03); ctx.lineTo(tx+0.02,0.03); ctx.lineTo(tx+0.01,0.10); ctx.closePath(); ctx.fill(); }
  // lower jaw drops with the roar
  ctx.save(); ctx.translate(0, jaw);
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-0.1, 0.08); ctx.lineTo(0.42, 0.06); ctx.lineTo(0.4, 0.17); ctx.lineTo(-0.08, 0.18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#efe8d2';
  for (let i = 0; i < 6; i++){ const tx = 0.03 + i*0.065; ctx.beginPath(); ctx.moveTo(tx,0.08); ctx.lineTo(tx+0.02,0.08); ctx.lineTo(tx+0.01,0.02); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (jaw > 0.12){ // dark maw when it gapes
    ctx.fillStyle = 'rgba(40,8,10,0.85)';
    ctx.beginPath(); ctx.moveTo(-0.02,0.06); ctx.lineTo(0.36,0.05); ctx.lineTo(0.34,0.06+jaw*0.7); ctx.lineTo(-0.02,0.09+jaw*0.7); ctx.closePath(); ctx.fill();
  }
  // hellish glowing eye
  const pulse = 0.7 + 0.3*Math.sin(ph*2.3);
  const eg = ctx.createRadialGradient(0.02, -0.16, 0.004, 0.02, -0.16, 0.14);
  eg.addColorStop(0, `rgba(255,60,40,${0.9*pulse})`); eg.addColorStop(1, 'rgba(255,60,40,0)');
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0.02, -0.16, 0.14, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(255,95,60,${pulse})`;
  ctx.beginPath(); ctx.arc(0.03, -0.16, 0.032, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a0505'; ctx.fillRect(0.028, -0.18, 0.008, 0.04); // slit pupil
  ctx.restore();

  // near-side arms (in front of the chest): big upper reaching forward, and a
  // smaller lower one clawing down — well separated so all four arms read
  mutantArm(ctx, 0.22, -0.86, 0.52, 0.30, 0.13, litSkin, '#e6dfc8', ph, 0.0);
  mutantArm(ctx, 0.28, -0.62, 0.44, 0.52, 0.10, skin,    '#e6dfc8', ph, 0.6);

  ctx.restore();

  // near hind leg (in front of the body)
  leg(ctx, 0.04, -0.66, 0.72, ph, shade(p.body, -0.1), 0.26);
}

/* ---------- AQUATIC (mosasaurus, plesiosaurus & friends) ----------
   A marine reptile cutting along the surface: low half-submerged body with
   a bow wake and ripples, sweeping tail fluke, stroking paddle-flippers.
   feat.longNeck = plesiosaur swan-neck; feat.bigJaw = mosasaur-style maw;
   feat.ridge = spine ridge fins. */
function drawAquatic(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const sw = Math.sin(ph);                    // swimming undulation
  const roar = (d.entranceT || 0) > 0 ? Math.min(1, (2.2 - d.entranceT) * 2.5) : 0;

  // underwater shadow of the bulk below the surface
  ctx.fillStyle = 'rgba(8,22,28,0.3)';
  ctx.beginPath(); ctx.ellipse(-0.05, 0.07, 0.62, 0.13, 0, 0, Math.PI*2); ctx.fill();
  // wake: ripple arcs peeling off the bow and trailing behind
  ctx.strokeStyle = 'rgba(235,248,252,0.55)'; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.62, 0.0);
  ctx.quadraticCurveTo(0.1, 0.13 + sw * 0.02, -0.75, 0.05); ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(0.7, -0.05);
  ctx.quadraticCurveTo(0.15, 0.09, -0.95, 0.02 + sw * 0.03); ctx.stroke();
  ctx.globalAlpha = 1;

  // sweeping tail + fluke
  ctx.fillStyle = shade(p.body, -0.12);
  ctx.beginPath();
  ctx.moveTo(-0.32, -0.2);
  ctx.quadraticCurveTo(-0.78, -0.18 + sw * 0.08, -1.02, -0.08 + sw * 0.15);
  ctx.quadraticCurveTo(-1.18, -0.02 + sw * 0.18, -1.08, 0.08 + sw * 0.12);  // fluke tip
  ctx.quadraticCurveTo(-0.72, 0.04 + sw * 0.05, -0.32, 0.02);
  ctx.closePath(); ctx.fill();

  // low body hump breaking the surface
  ctx.fillStyle = p.body;
  ctx.beginPath(); ctx.ellipse(0, -0.12, 0.52, 0.21, -0.05, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = p.belly;                    // wet sheen along the waterline
  ctx.beginPath(); ctx.ellipse(0.05, -0.02, 0.4, 0.06, -0.04, 0, Math.PI*2); ctx.fill();
  if (f.ridge){                               // spine ridge fins
    ctx.fillStyle = shade(p.body, -0.3);
    for (let i = 0; i < 4; i++){
      const x = -0.3 + i * 0.17;
      ctx.beginPath(); ctx.moveTo(x, -0.28); ctx.lineTo(x + 0.05, -0.4); ctx.lineTo(x + 0.11, -0.27); ctx.closePath(); ctx.fill();
    }
  }
  // paddle flipper stroking the water
  ctx.save();
  ctx.translate(0.14, -0.06); ctx.rotate(0.65 + sw * 0.45);
  ctx.fillStyle = shade(p.body, -0.28);
  ctx.beginPath(); ctx.ellipse(0.12, 0.05, 0.17, 0.07, 0.35, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  if (f.longNeck){
    // plesiosaur: graceful swan neck up out of the water, small head
    ctx.strokeStyle = p.body; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.32, -0.16);
    ctx.quadraticCurveTo(0.52, -0.42 + sw * 0.02, 0.58, -0.66 + sw * 0.03); ctx.stroke();
    ctx.fillStyle = p.body;
    ctx.beginPath(); ctx.ellipse(0.62, -0.72 + sw * 0.03, 0.12, 0.075, 0.25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1a12';
    ctx.beginPath(); ctx.arc(0.66, -0.74 + sw * 0.03, 0.022, 0, Math.PI*2); ctx.fill();
  } else {
    // mosasaur-style head: wedge skull riding the surface, toothy maw
    const big = f.bigJaw ? 1.2 : 1;
    const jawOpen = 0.04 + Math.max(0, Math.sin(ph * 0.9)) * 0.045 + roar * 0.2;
    const hy = -0.16 - roar * 0.14;           // rears up out of the water to roar
    ctx.save();
    ctx.translate(0.42, hy);
    if (roar) ctx.rotate(-roar * 0.3);
    ctx.fillStyle = p.body;                    // skull
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.16 * big);
    ctx.quadraticCurveTo(0.2 * big, -0.19 * big, 0.42 * big, -0.05);
    ctx.lineTo(0.42 * big, 0.01); ctx.lineTo(-0.05, 0.06); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(p.body, -0.18);      // lower jaw
    ctx.beginPath();
    ctx.moveTo(-0.02, 0.04);
    ctx.lineTo(0.38 * big, 0.03 + jawOpen); ctx.lineTo(0.38 * big, 0.08 + jawOpen);
    ctx.lineTo(-0.02, 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f2e4';                 // interlocking fangs
    for (let i = 0; i < 4; i++){
      const tx = 0.08 + i * 0.085 * big;
      ctx.beginPath(); ctx.moveTo(tx - 0.017, 0.015); ctx.lineTo(tx + 0.017, 0.015); ctx.lineTo(tx + 0.002, 0.055); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx + 0.028, 0.035 + jawOpen); ctx.lineTo(tx + 0.058, 0.035 + jawOpen); ctx.lineTo(tx + 0.045, 0.008 + jawOpen); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#1a1a12';                 // eye
    ctx.beginPath(); ctx.arc(0.05, -0.08 * big, 0.028, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // spray flecks off the bow
  ctx.fillStyle = 'rgba(240,250,252,0.7)';
  for (let i = 0; i < 2; i++){
    const k = (ph * 0.5 + i * 0.5) % 1;
    ctx.beginPath(); ctx.arc(0.6 + k * 0.2, -0.05 - k * 0.12, 0.022 * (1 - k), 0, Math.PI*2); ctx.fill();
  }
}

/* ---------- OMEGA REX (the deployable robot T-Rex) ----------
   A hard-edged war machine: angular armour plates with visible seams and
   rivets, hydraulic piston legs, a boxy servo skull with a burning optic,
   and a pointy comms antenna on top with a blinking beacon. */
function roboLeg(ctx, hipX, hipY, len, ph, color, jointColor, w){
  // same walk kinematics as leg(), drawn as hard metal segments
  const swing = Math.sin(ph);
  const lift  = Math.max(0, Math.cos(ph));
  const a1 = swing * 0.55;
  const kx = hipX + Math.sin(a1) * len * 0.5;
  const ky = hipY + Math.cos(a1) * len * 0.5 - lift * len * 0.14;
  const a2 = a1 + 0.4 + lift * 1.05;
  const fx = kx + Math.sin(a2) * len * 0.52;
  const fy = Math.min(0, ky + Math.cos(a2) * len * 0.52 - lift * len * 0.22);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = color; ctx.lineWidth = w;                       // thigh housing
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.strokeStyle = jointColor; ctx.lineWidth = w * 0.32;           // hydraulic piston line
  ctx.beginPath(); ctx.moveTo(hipX + 0.06, hipY + 0.02); ctx.lineTo(kx + 0.04, ky - 0.03); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w * 0.7;                 // shin strut
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.fillStyle = jointColor;                                       // knee servo bolt
  ctx.beginPath(); ctx.arc(kx, ky, w * 0.44, 0, Math.PI*2); ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = w * 0.48;                // two clawed metal toes
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + w * 1.25, fy - lift * len * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + w * 0.75, fy + 0.012); ctx.stroke();
}
function drawOmegaRex(ctx, d, ph){
  const p = d.pal;
  const steel  = p.body;
  const panel  = shade(p.body, 0.2);
  const dark   = shade(p.body, -0.32);
  const darker = shade(p.body, -0.55);
  const glow   = p.accent || '#3fb0ff';
  const bob = Math.abs(Math.sin(ph)) * 0.045;
  const sway = Math.sin(ph * 0.8) * 0.04;

  roboLeg(ctx, -0.05, -0.62, 0.62, ph + Math.PI, dark, darker, 0.17); // far leg

  ctx.save();
  ctx.translate(0, -bob);

  // segmented tail — three tapering armour sections with seam gaps
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-0.1, -0.92); ctx.lineTo(-0.55, -0.84 + sway); ctx.lineTo(-0.55, -0.55 + sway); ctx.lineTo(-0.1, -0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = darker;
  ctx.beginPath(); ctx.moveTo(-0.58, -0.82 + sway); ctx.lineTo(-0.98, -0.74 + sway*2); ctx.lineTo(-0.98, -0.55 + sway*2); ctx.lineTo(-0.58, -0.57 + sway); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-1.01, -0.72 + sway*2); ctx.lineTo(-1.38, -0.64 + sway*3); ctx.lineTo(-1.38, -0.56 + sway*3); ctx.lineTo(-1.01, -0.57 + sway*2); ctx.closePath(); ctx.fill();

  // angular armoured hull
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.moveTo(-0.52, -0.6); ctx.lineTo(-0.44, -0.96); ctx.lineTo(0.02, -1.06); ctx.lineTo(0.42, -0.98);
  ctx.lineTo(0.58, -0.72); ctx.lineTo(0.44, -0.44); ctx.lineTo(-0.08, -0.36); ctx.lineTo(-0.46, -0.44);
  ctx.closePath(); ctx.fill();
  // lighter belly plate
  ctx.fillStyle = panel;
  ctx.beginPath(); ctx.moveTo(-0.34, -0.44); ctx.lineTo(0.34, -0.44); ctx.lineTo(0.4, -0.62); ctx.lineTo(-0.4, -0.62); ctx.closePath(); ctx.fill();
  // panel seams + rivets
  ctx.strokeStyle = darker; ctx.lineWidth = 0.018;
  ctx.beginPath(); ctx.moveTo(-0.44, -0.78); ctx.lineTo(0.5, -0.78); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.1, -1.05); ctx.lineTo(-0.06, -0.44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, -1.0); ctx.lineTo(0.28, -0.5); ctx.stroke();
  ctx.fillStyle = darker;
  for (const [rx, ry] of [[-0.36,-0.86],[0.06,-0.94],[0.4,-0.84],[-0.3,-0.52],[0.34,-0.56]]){
    ctx.beginPath(); ctx.arc(rx, ry, 0.016, 0, Math.PI*2); ctx.fill();
  }
  // dorsal heat-vent fins
  ctx.fillStyle = dark;
  for (let i = 0; i < 4; i++){
    const x = -0.34 + i * 0.2;
    ctx.beginPath(); ctx.moveTo(x, -1.0 - i*0.01); ctx.lineTo(x + 0.06, -1.12 - i*0.01); ctx.lineTo(x + 0.12, -1.0 - i*0.01); ctx.closePath(); ctx.fill();
  }

  // twin robot arms — pistons with two-claw grippers
  ctx.lineCap = 'butt';
  const armSw = Math.sin(ph + Math.PI) * 0.06;
  for (const [side, col] of [[-0.05, darker], [0.05, dark]]){
    const sx = 0.32, sy = -0.76 + side;
    const ex = 0.42 + armSw, ey = -0.62 + side;
    ctx.strokeStyle = col; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 0.045;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 0.1, ey + 0.05); ctx.stroke();
    ctx.lineWidth = 0.028;                        // gripper claws
    ctx.beginPath(); ctx.moveTo(ex + 0.1, ey + 0.05); ctx.lineTo(ex + 0.16, ey + 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + 0.1, ey + 0.05); ctx.lineTo(ex + 0.15, ey + 0.1); ctx.stroke();
  }

  // armoured neck
  ctx.fillStyle = steel;
  ctx.beginPath(); ctx.moveTo(0.3, -0.92); ctx.lineTo(0.52, -1.14); ctx.lineTo(0.62, -1.02); ctx.lineTo(0.44, -0.7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = darker; ctx.lineWidth = 0.016;
  ctx.beginPath(); ctx.moveTo(0.38, -0.86); ctx.lineTo(0.54, -1.02); ctx.stroke();

  // boxy servo skull with heavy brow
  const jawOpen = 0.04 + Math.max(0, Math.sin(ph * 0.9)) * 0.05;
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.moveTo(0.48, -1.3); ctx.lineTo(0.98, -1.26); ctx.lineTo(1.02, -1.14); ctx.lineTo(0.96, -1.08); ctx.lineTo(0.5, -1.06); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark;   // brow plate
  ctx.beginPath(); ctx.moveTo(0.5, -1.3); ctx.lineTo(0.78, -1.29); ctx.lineTo(0.74, -1.22); ctx.lineTo(0.5, -1.22); ctx.closePath(); ctx.fill();
  // lower jaw — hard hinged plate
  ctx.fillStyle = darker;
  ctx.beginPath();
  ctx.moveTo(0.52, -1.05); ctx.lineTo(0.94, -1.04 + jawOpen); ctx.lineTo(0.92, -0.98 + jawOpen); ctx.lineTo(0.52, -0.99); ctx.closePath(); ctx.fill();
  // interlocking metal teeth
  ctx.fillStyle = '#dfe6ee';
  for (let i = 0; i < 5; i++){
    const x = 0.58 + i * 0.075;
    ctx.beginPath(); ctx.moveTo(x, -1.08); ctx.lineTo(x + 0.028, -1.03); ctx.lineTo(x + 0.056, -1.08); ctx.closePath(); ctx.fill();
  }
  // burning optic
  const pulse = 0.7 + 0.3 * Math.sin(ph * 2.2);
  const eg = ctx.createRadialGradient(0.62, -1.19, 0.005, 0.62, -1.19, 0.12);
  eg.addColorStop(0, `rgba(255,60,40,${0.9 * pulse})`);
  eg.addColorStop(1, 'rgba(255,60,40,0)');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(0.62, -1.19, 0.12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#12080a';
  ctx.beginPath(); ctx.arc(0.62, -1.19, 0.045, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(255,90,50,${pulse})`;
  ctx.beginPath(); ctx.arc(0.62, -1.19, 0.026, 0, Math.PI*2); ctx.fill();

  // pointy comms antenna with a blinking beacon
  ctx.strokeStyle = dark; ctx.lineWidth = 0.028; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.6, -1.3); ctx.lineTo(0.68, -1.56); ctx.stroke();
  ctx.strokeStyle = darker; ctx.lineWidth = 0.016;   // little cross-bar
  ctx.beginPath(); ctx.moveTo(0.6, -1.44); ctx.lineTo(0.69, -1.47); ctx.stroke();
  const blink = Math.sin(ph * 3.2) > 0.2;
  if (blink){
    const bg = ctx.createRadialGradient(0.68, -1.58, 0.004, 0.68, -1.58, 0.1);
    bg.addColorStop(0, 'rgba(255,70,60,0.95)');
    bg.addColorStop(1, 'rgba(255,70,60,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0.68, -1.58, 0.1, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = blink ? '#ff5044' : '#701818';
  ctx.beginPath(); ctx.arc(0.68, -1.58, 0.035, 0, Math.PI*2); ctx.fill();

  // glowing power conduit along the spine
  ctx.strokeStyle = glow; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(ph * 2.6);
  ctx.lineWidth = 0.022;
  ctx.beginPath(); ctx.moveTo(-0.4, -0.94); ctx.quadraticCurveTo(0.02, -1.02, 0.4, -0.96); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();

  roboLeg(ctx, 0.02, -0.62, 0.64, ph, steel, darker, 0.18); // near leg
}

const PAINTERS = {theropod:drawTheropod, quad:drawQuad, sauropod:drawSauropod, flyer:drawFlyer, mutant:drawMutantRex, omega:drawOmegaRex, aquatic:drawAquatic};

/* Draws a full dinosaur at world position.
   turn: -1..1 facing (mid-values render the turn itself as a squash-flip)
   pitch: body tilt in radians for walking up/down vertical path legs */
function drawDino(ctx, d, x, y, turn, ph, alpha, pitch){
  const s = d.size;
  // shadow (on the ground even for flyers)
  ctx.save();
  ctx.globalAlpha = 0.28 * alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  // shadow tracks the body's on-screen orientation
  const shRot = (turn === undefined || turn >= 0) ? (pitch || 0) : -(pitch || 0);
  ctx.ellipse(x, y + 2, s * (d.flying ? 0.5 : 0.85), s * 0.22, shRot, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const tx = (turn === undefined ? 1 : turn);
  ctx.scale(Math.sign(tx || 1) * Math.max(0.08, Math.abs(tx)), 1);
  if (pitch){ // tilt around hip height, not the feet
    ctx.translate(0, -s * 0.6);
    ctx.rotate(pitch);
    ctx.translate(0, s * 0.6);
  }
  ctx.scale(s, s);
  PAINTERS[d.painter](ctx, d, ph);
  ctx.restore();
}

/* ---------- TOWERS ----------
   lv (0-3 upgrades bought) grows the pad and adds gold trim. */
function drawTowerBase(ctx, x, y, key, selected, lv){
  const def = TOWERS[key];
  lv = lv || 0;
  const maxed = lv > 0 && lv >= (def.maxUp || 2);
  const R = 17 + lv * 2.2; // pad grows with each upgrade
  ctx.save();
  ctx.translate(x, y);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, R + 2, R * 0.82, 0, 0, Math.PI*2); ctx.fill();
  // octagonal concrete pad — maxed units sit on dark armored plate
  ctx.beginPath();
  for (let i = 0; i < 8; i++){
    const a = i/8*Math.PI*2 + Math.PI/8;
    const px = Math.cos(a)*R, py = Math.sin(a)*R;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, maxed ? '#3b4038' : lv >= 2 ? '#5a6152' : '#4c5246');
  g.addColorStop(1, maxed ? '#1c1f1a' : '#2a2e27');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = selected ? '#ffd24a' : '#181c15';
  ctx.lineWidth = selected ? 2.5 : 1.5; ctx.stroke();
  // colored hazard ring — dashed while training, a solid power ring at max
  ctx.save();
  ctx.strokeStyle = def.color; ctx.globalAlpha = maxed ? 0.95 : 0.85; ctx.lineWidth = maxed ? 3 : 2.5;
  if (!maxed) ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(0, 0, R - 4, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // veteran trim: gold band from Lv2, corner studs from Lv3
  if (lv >= 1){
    ctx.strokeStyle = `rgba(232,185,58,${0.3 + lv * 0.2})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, R - 1.5, 0, Math.PI*2); ctx.stroke();
  }
  if (lv >= 2){
    ctx.fillStyle = '#e8b93a';
    for (let i = 0; i < 8; i++){
      const a = i/8*Math.PI*2 + Math.PI/8;
      ctx.beginPath(); ctx.arc(Math.cos(a)*(R-4.5), Math.sin(a)*(R-4.5), 1.5, 0, Math.PI*2); ctx.fill();
    }
  }
  // bolts
  ctx.fillStyle = '#141811';
  for (let i = 0; i < 4; i++){
    const a = i/4*Math.PI*2 + Math.PI/4;
    ctx.beginPath(); ctx.arc(Math.cos(a)*(R-2.5), Math.sin(a)*(R-2.5), 1.6, 0, Math.PI*2); ctx.fill();
  }
  // per-weapon set dressing
  switch (key){
    case 'gatling': // sandbag emplacement
      ctx.fillStyle = '#8a7a55';
      for (const [bx, by, ba] of [[-19,8,-0.3],[-13,15,-0.15],[13,15,0.15],[19,8,0.3],[-19,-8,0.3],[19,-8,-0.3]]){
        ctx.beginPath(); ctx.ellipse(bx, by, 6, 3.6, ba, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#6e6144';
      for (const [bx, by] of [[-17,12],[17,12],[0,17]]){
        ctx.beginPath(); ctx.ellipse(bx, by, 6, 3.6, 0, 0, Math.PI*2); ctx.fill();
      }
      break;
    case 'sniper': // wooden watchtower platform
      ctx.strokeStyle = '#54401f'; ctx.lineWidth = 3;
      for (const [lx, ly] of [[-11,-11],[11,-11],[-11,11],[11,11]]){
        ctx.beginPath(); ctx.moveTo(lx*0.55, ly*0.55); ctx.lineTo(lx, ly+4); ctx.stroke();
      }
      ctx.fillStyle = '#7a6238'; ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeStyle = '#4e3d22'; ctx.lineWidth = 1.5; ctx.strokeRect(-10, -10, 20, 20);
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
      break;
    case 'flamer': // fuel drums
      ctx.fillStyle = '#8a3020'; ctx.beginPath(); ctx.arc(-15, 10, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#a5462a'; ctx.beginPath(); ctx.arc(-9, 15, 4.2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-15, 10, 2.6, 0, Math.PI*2); ctx.stroke();
      break;
    case 'tesla': { // grounding ring on scorched, statically-charged earth
      ctx.fillStyle = 'rgba(18,14,8,0.35)';              // scorched dirt
      ctx.beginPath(); ctx.ellipse(0, 2, 21, 15, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(110,231,255,0.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,200,120,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++){                      // grass standing on end
        const a = i / 10 * Math.PI * 2 + 0.3;
        const gx = Math.cos(a) * 19, gy = Math.sin(a) * 14 + 2;
        ctx.beginPath(); ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.sin(i * 5.2) * 1.5, gy - 3.5 - (i % 3));
        ctx.stroke();
      }
      break;
    }
    case 'cryo': // frost halo on the ground
      ctx.fillStyle = 'rgba(190,232,255,0.20)';
      ctx.beginPath(); ctx.ellipse(0, 2, 20, 14, 0, 0, Math.PI*2); ctx.fill();
      break;
    case 'sonic': // cabling
      ctx.strokeStyle = 'rgba(214,163,255,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      break;
    case 'tranq': // supply crate
      ctx.fillStyle = '#6e5a36'; ctx.fillRect(10, 8, 9, 7);
      ctx.strokeStyle = '#463822'; ctx.lineWidth = 1; ctx.strokeRect(10, 8, 9, 7);
      break;
    case 'missile': // ammo crates
      ctx.fillStyle = '#5e5044'; ctx.fillRect(-21, 6, 9, 7); ctx.fillRect(-18, -14, 8, 6);
      ctx.strokeStyle = '#38302a'; ctx.lineWidth = 1; ctx.strokeRect(-21, 6, 9, 7);
      break;
    case 'mortar': // shell crate + spare rounds
      ctx.fillStyle = '#5a4f3e'; ctx.fillRect(-22, -16, 11, 9);
      ctx.strokeStyle = '#362f24'; ctx.lineWidth = 1; ctx.strokeRect(-22, -16, 11, 9);
      ctx.fillStyle = '#3a3630';
      for (const [sx, sy] of [[-18, 12], [-13, 15], [-8, 12]]){
        ctx.beginPath(); ctx.ellipse(sx, sy, 2.2, 3.4, 0.4, 0, Math.PI*2); ctx.fill();
      }
      break;
    case 'gas': // toxic hazard drums with a green seep
      for (const [bx, by] of [[-17, 11], [-11, 15]]){
        ctx.fillStyle = '#4a5a24'; ctx.beginPath(); ctx.ellipse(bx, by, 5, 5.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#a6e04a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(150,210,70,0.18)';
      ctx.beginPath(); ctx.ellipse(-13, 15, 14, 7, 0, 0, Math.PI*2); ctx.fill();
      break;
  }
  ctx.restore();
}

function drawTowerTurret(ctx, t, flash, time){
  time = time || 0;
  const rec = (t.recoil || 0) * 4;   // barrel kickback in px
  const lv = t.ulv || 0;
  const def = TOWERS[t.key] || {};
  const maxed = lv > 0 && lv >= (def.maxUp || 2);
  ctx.save();
  ctx.translate(t.x, t.y);
  // fully-upgraded weapons hum with a pulsing aura in their own colour
  if (maxed){
    const pl = (Math.sin(time * 3 + t.x) + 1) / 2;
    ctx.save();
    ctx.strokeStyle = def.color || '#ffd24a'; ctx.globalAlpha = 0.28 + 0.3 * pl;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, 25 + pl * 3, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  ctx.scale(1 + lv * 0.16, 1 + lv * 0.16); // hardware grows with each upgrade
  ctx.rotate((t.key === 'sonic' || t.key === 'tesla') ? 0 : t.angle);
  ctx.lineCap = 'round';
  switch (t.key){
    case 'tranq': { // tripod dart rifle with scope
      ctx.translate(-rec, 0);
      ctx.fillStyle = '#3c4634'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#20261c'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#5a6b4a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(18, 0); ctx.stroke();
      ctx.strokeStyle = '#8fd14f'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(18, 0); ctx.stroke();
      ctx.fillStyle = '#20261c'; ctx.fillRect(1, -5.5, 7, 3.5);      // scope
      ctx.fillStyle = '#b8e88a'; ctx.beginPath(); ctx.arc(7.2, -3.8, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8fd14f'; ctx.beginPath(); ctx.arc(-1, 0, 3.2, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'gatling': { // six-barrel minigun → veteran units run murdered-out black & red
      ctx.translate(-rec * 0.6, 0);
      const bl = 19 + lv * 2.2;                         // barrels lengthen each level
      if (lv >= 2){                                     // frontal gun-shield
        ctx.fillStyle = maxed ? '#26262a' : '#454a42';
        ctx.beginPath(); ctx.moveTo(8, -12.5); ctx.lineTo(11, -12.5); ctx.lineTo(11, 12.5); ctx.lineTo(8, 12.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = maxed ? '#e04a3a' : '#6a7060'; ctx.lineWidth = 0.8;
        ctx.strokeRect(8, -12.5, 3, 25);
      }
      if (lv >= 1){                                     // ammo drum slung underneath
        ctx.fillStyle = maxed ? '#38313a' : '#4a4436';
        ctx.beginPath(); ctx.ellipse(-3, 8.5, 5.5, 4, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = maxed ? '#ff5a4a' : '#8a7a55'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-3, 8.5, 2.2, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = maxed ? '#2e2e30' : '#565b52';
      ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(6, -10); ctx.lineTo(6, 10); ctx.lineTo(2, 10); ctx.closePath(); ctx.fill();
      const sp = t.spin || 0;
      for (let i = 0; i < 6; i++){
        const a = sp + i/6*Math.PI*2, off = Math.sin(a)*3.6;
        ctx.strokeStyle = Math.cos(a) > 0 ? (maxed ? '#d0574a' : '#a2a89e') : (maxed ? '#5e2c26' : '#61675c');
        ctx.lineWidth = 2 + lv * 0.2;
        ctx.beginPath(); ctx.moveTo(6, off); ctx.lineTo(bl, off); ctx.stroke();
      }
      ctx.fillStyle = maxed ? '#1c1c1e' : '#3a3e36'; ctx.beginPath(); ctx.arc(bl, 0, 3.4, 0, Math.PI*2); ctx.fill();
      if (maxed){                                       // white-hot muzzle collar
        const hot = 0.5 + 0.5 * Math.sin(time * 9 + t.x);
        ctx.strokeStyle = `rgba(255,120,80,${0.5 + 0.4*hot})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(bl, 0, 4.8, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = maxed ? '#332e34' : '#4a4f46'; ctx.beginPath(); ctx.arc(-1, 0, 7.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = maxed ? '#ff5a4a' : '#c9c9c9'; ctx.beginPath(); ctx.arc(-1, 0, 3.2, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'sniper': { // long rifle → maxed becomes a glowing railgun
      ctx.translate(-rec * 1.2, 0);
      const bl = 26 + lv * 4;                           // barrel reaches farther each level
      ctx.fillStyle = maxed ? '#20293a' : '#33475e';
      ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(5, -5); ctx.lineTo(7, 0); ctx.lineTo(5, 5); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill();
      if (lv >= 1){                                     // folding bipod
        ctx.strokeStyle = maxed ? '#31435e' : '#4a5a70'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(19, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(19, -8); ctx.stroke();
      }
      if (maxed){                                       // railgun: dark rails + charged cyan core + coils
        ctx.strokeStyle = '#1a2836'; ctx.lineWidth = 4.6;
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(bl, 0); ctx.stroke();
        const chg = 0.5 + 0.5 * Math.sin(time * 5 + t.x);
        ctx.strokeStyle = `rgba(110,231,255,${0.55 + 0.45*chg})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(bl - 1, 0); ctx.stroke();
        ctx.strokeStyle = '#3d6b8a'; ctx.lineWidth = 1.2;
        for (let x = 10; x < bl - 3; x += 5){           // accelerator coils
          ctx.beginPath(); ctx.ellipse(x, 0, 1.6, 3.4, 0, 0, Math.PI*2); ctx.stroke();
        }
        ctx.fillStyle = `rgba(160,240,255,${0.5 + 0.5*chg})`;
        ctx.beginPath(); ctx.arc(bl + 1, 0, 2.2 + chg, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.strokeStyle = '#4a6b9a'; ctx.lineWidth = 3.4 + lv * 0.5;
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(bl, 0); ctx.stroke();
        ctx.fillStyle = '#22303f'; ctx.fillRect(bl - 2, -2.6, 5, 5.2);   // muzzle brake
      }
      ctx.fillStyle = maxed ? '#141d29' : '#1b2531';                      // scope grows with level
      ctx.fillRect(-5 - lv, -8 - lv, 11 + lv * 2.5, 4 + lv * 0.6);
      const gl = (Math.sin(time*1.8 + t.x) + 1) / 2;
      ctx.fillStyle = maxed ? `rgba(110,231,255,${0.5 + 0.5*gl})` : `rgba(160,215,255,${0.4 + 0.6*gl})`;
      ctx.beginPath(); ctx.arc(6.5 + lv * 1.4, -6 - lv * 0.7, 1.5 + lv * 0.3, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'flamer': { // fuel tank + nozzle → maxed burns superheated BLUE
      ctx.translate(-rec * 0.5, 0);
      if (lv >= 1){                                     // second reserve tank
        ctx.fillStyle = maxed ? '#1c2c38' : '#6e2618';
        ctx.beginPath(); ctx.ellipse(-11, -4, 5, 4.4, -0.3, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = maxed ? '#20303c' : '#8a3020';
      ctx.beginPath(); ctx.ellipse(-5, 0, 7.5 + lv, 6.5 + lv * 0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = maxed ? '#5ac8ff' : '#c9553a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(-5, 0, 4.4, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = maxed ? '#3a4650' : '#5e5044'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(13, 0); ctx.stroke();
      ctx.fillStyle = maxed ? '#141b20' : '#3c342c';    // nozzle flares wider each level
      ctx.beginPath(); ctx.moveTo(12, -4 - lv); ctx.lineTo(17 + lv * 1.6, -6 - lv * 1.6); ctx.lineTo(17 + lv * 1.6, 6 + lv * 1.6); ctx.lineTo(12, 4 + lv); ctx.closePath(); ctx.fill();
      const pf = 0.6 + 0.4*Math.sin(time*13 + t.x);     // pilot light — a roaring orange at max
      ctx.fillStyle = maxed ? `rgba(255,150,40,${0.75*pf})` : `rgba(255,180,60,${0.55*pf})`;
      ctx.beginPath(); ctx.arc(19 + lv * 1.6, 0, 2.2 + pf*(1.6 + lv), 0, Math.PI*2); ctx.fill();
      if (maxed){
        ctx.fillStyle = `rgba(255,235,170,${0.75*pf})`;
        ctx.beginPath(); ctx.arc(19 + lv * 1.6, 0, 1.2 + pf*0.9, 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'gas': { // toxin canister → maxed turns virulent purple with a skull stencil
      ctx.translate(-rec * 0.5, 0);
      if (lv >= 1){                                     // spare canister
        ctx.fillStyle = maxed ? '#32224a' : '#39461c';
        ctx.beginPath(); ctx.ellipse(-11, -4, 4.6, 4, -0.3, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = maxed ? '#3c2a4e' : '#43521f';
      ctx.beginPath(); ctx.ellipse(-5, 0, 7.5 + lv, 6.5 + lv * 0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = maxed ? '#c86aff' : '#a6e04a'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(-5, 0, 4.3, 0, Math.PI*2); ctx.stroke();
      if (maxed){                                       // hazard skull stencil
        ctx.fillStyle = '#e0c8ff';
        ctx.beginPath(); ctx.arc(-5, -1, 1.7, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(-6.2, 0.4, 2.4, 1.1);
        ctx.fillStyle = maxed ? '#3c2a4e' : '#43521f';
        ctx.beginPath(); ctx.arc(-5.7, -1.2, 0.45, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-4.3, -1.2, 0.45, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = '#c8e88a'; ctx.beginPath(); ctx.arc(-7, -2, 1.4, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = maxed ? '#463a56' : '#525a44'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.fillStyle = maxed ? '#241832' : '#2e3a1c';    // flared nozzle
      ctx.beginPath(); ctx.moveTo(11, -3.5 - lv*0.6); ctx.lineTo(18 + lv, -6 - lv); ctx.lineTo(18 + lv, 6 + lv); ctx.lineTo(11, 3.5 + lv*0.6); ctx.closePath(); ctx.fill();
      const pv = 0.5 + 0.5*Math.sin(time*6 + t.x);      // venting vapor — stays toxic GREEN at max
      ctx.fillStyle = maxed ? `rgba(140,240,70,${0.5*pv})` : `rgba(168,224,74,${0.35*pv})`;
      ctx.beginPath(); ctx.arc(20 + lv + pv*2, 0, 3 + lv + pv*2.4, 0, Math.PI*2); ctx.fill();
      if (maxed){
        ctx.fillStyle = `rgba(220,255,170,${0.5*pv})`;
        ctx.beginPath(); ctx.arc(20 + lv + pv*2, 0, 1.4 + pv*1.2, 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'tesla': { // coil tower → grows taller, maxed goes twin-coil VIOLET
                    // and levitates its orb
      const coilH = 12 + lv * 4;                        // mast height per level
      const orbR = 4.6 + lv * 0.9;
      const main = maxed ? '#c98aff' : '#6ee7ff';
      // 0 just fired → 1 next shot ready (paces the charge-pulse visual)
      const chargeF = t.cdMax ? Math.max(0, Math.min(1, 1 - t.cd / t.cdMax)) : 1;
      // maxed: the orb tears free of the mast and floats, bobbing
      const orbY = -(coilH + 4) - (maxed ? 5 + Math.sin(time * 2.3 + t.y) * 1.6 : 0);
      ctx.fillStyle = maxed ? '#33254e' : '#22485a';
      ctx.beginPath(); ctx.arc(0, 2, 8 + lv, 0, Math.PI*2); ctx.fill();
      // stray sparks skitter around the grounding ring
      for (let i = 0; i < 2; i++){
        const sa = time * (1.8 + i * 0.7) * (i ? -1 : 1) + t.x * 0.3 + i * 2.6;
        const gx = Math.cos(sa) * 16, gy = Math.sin(sa) * 16 * 0.8 + 2;
        ctx.fillStyle = maxed ? 'rgba(210,160,255,0.85)' : 'rgba(150,240,255,0.8)';
        ctx.beginPath(); ctx.arc(gx, gy, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = maxed ? 'rgba(210,160,255,0.5)' : 'rgba(150,240,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.sin(time * 31 + i * 4) * 3, gy - 2 - Math.cos(time * 27 + i) * 1.5);
        ctx.stroke();
      }
      if (maxed){                                       // flanking secondary coils
        for (const sx of [-8.5, 8.5]){
          ctx.strokeStyle = '#5a4a7a'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(sx, 3); ctx.lineTo(sx, -7); ctx.stroke();
          ctx.fillStyle = '#b06aff';
          ctx.beginPath(); ctx.arc(sx, -9, 2.4, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.strokeStyle = maxed ? '#6a4e9a' : '#3d7a8a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -coilH); ctx.stroke();
      ctx.strokeStyle = maxed ? '#a98ad0' : '#7ab6c8'; ctx.lineWidth = 1.6;
      const nw = 3 + lv;
      for (let i = 0; i < nw; i++){                     // more windings per level
        ctx.beginPath(); ctx.ellipse(0, -3 - i*4, 6.5 - i*1.1, 2.2, 0, 0, Math.PI*2); ctx.stroke();
      }
      // a bright charge pulse races UP the windings, faster and hotter as the
      // next shot readies — you can read the cooldown off the coil itself
      const pk = (time * (1.5 + 4.5 * chargeF) + t.x * 0.1) % 1;
      ctx.strokeStyle = `rgba(${maxed ? '225,180,255' : '160,240,255'},${0.3 + 0.6 * chargeF})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -3 - pk * (nw - 1) * 4, 6.5 - pk * (nw - 1) * 1.1, 2.2, 0, 0, Math.PI*2);
      ctx.stroke();
      if (maxed){                                       // tether: the orb stays leashed to the mast
        ctx.strokeStyle = 'rgba(200,140,255,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -coilH);
        ctx.lineTo(Math.sin(time * 33) * 2.5, (-coilH + orbY + orbR) / 2);
        ctx.lineTo(0, orbY + orbR); ctx.stroke();
      }
      const chg = 0.5 + 0.5 * Math.sin(time * 6 + t.y); // orb breathes with charge
      ctx.fillStyle = `rgba(${maxed ? '200,140,255' : '110,231,255'},${0.25 + 0.3*chg})`;
      ctx.beginPath(); ctx.arc(0, orbY, orbR + 3 + chg*2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = main; ctx.beginPath(); ctx.arc(0, orbY, orbR, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = maxed ? '#f0e2ff' : '#d8f8ff';
      ctx.beginPath(); ctx.arc(-1.2, orbY - 1.2, orbR * 0.38, 0, Math.PI*2); ctx.fill();
      if (Math.sin(time*7 + t.y) > 0.15 - lv * 0.2){    // crackles more, and harder, per level
        ctx.strokeStyle = maxed ? 'rgba(225,180,255,0.9)' : 'rgba(160,240,255,0.8)';
        ctx.lineWidth = 1.2 + lv * 0.3;
        for (let i = 0; i < 3 + lv; i++){
          const a = time*3 + i*2.1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*orbR, orbY + Math.sin(a)*orbR);
          ctx.lineTo(Math.cos(a)*(orbR + 5 + lv*2) + Math.sin(time*31+i)*2.5, orbY + Math.sin(a)*(orbR + 5 + lv*2) + Math.cos(time*37+i)*2.5);
          ctx.stroke();
        }
        if (maxed){                                     // arcs leap between the three coils
          ctx.strokeStyle = 'rgba(200,140,255,0.7)'; ctx.lineWidth = 1;
          for (const sx of [-8.5, 8.5]){
            ctx.beginPath(); ctx.moveTo(sx, -9);
            ctx.lineTo(sx * 0.5 + Math.sin(time*29 + sx)*3, (orbY - 9)/2);
            ctx.lineTo(0, orbY); ctx.stroke();
          }
        }
      }
      break;
    }
    case 'missile': { // launcher pods — a pod PAIR per salvo rocket, maxed goes crimson-black
      ctx.translate(-rec * 0.8, 0);
      const cols = 1 + lv;                              // 2 → 4 → 6 launch tubes
      const bw = 9 + cols * 5.5;
      ctx.fillStyle = maxed ? '#33231e' : '#4e4238'; ctx.fillRect(-9, -9 - lv, bw, 18 + lv*2);
      ctx.strokeStyle = maxed ? '#c93a2b' : '#2c261f'; ctx.lineWidth = 1.5; ctx.strokeRect(-9, -9 - lv, bw, 18 + lv*2);
      if (maxed){                                       // hazard chevrons on the armor
        ctx.strokeStyle = '#e0b64f'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++){
          ctx.beginPath(); ctx.moveTo(-8 + i*3, 9 + lv - 0.5); ctx.lineTo(-6 + i*3, 6 + lv - 0.5); ctx.stroke();
        }
      }
      const loaded = t.cd <= 0;
      for (let c = 0; c < cols; c++){
        for (const oy of [-4.5, 4.5]){
          const ox = 3 + c * 5.5;
          ctx.fillStyle = '#221d18'; ctx.beginPath(); ctx.arc(ox, oy, 3.2, 0, Math.PI*2); ctx.fill();
          if (loaded){
            const gl = maxed ? 0.75 + 0.25 * Math.sin(time * 8 + ox) : 1;
            ctx.fillStyle = maxed ? `rgba(255,60,40,${gl})` : '#ff6b6b';
            ctx.beginPath(); ctx.arc(ox, oy, 1.8, 0, Math.PI*2); ctx.fill();
            if (maxed){ ctx.fillStyle = `rgba(255,200,180,${gl})`; ctx.beginPath(); ctx.arc(ox, oy, 0.8, 0, Math.PI*2); ctx.fill(); }
          }
        }
      }
      ctx.fillStyle = maxed ? '#4a2e26' : '#5e5044'; ctx.fillRect(-13, -4, 4, 8);
      break;
    }
    case 'cryo': { // insulated tank → maxed is a deep-freeze unit sheathed in ice
      ctx.translate(-rec * 0.5, 0);
      if (lv >= 1){                                     // coolant sphere on top
        ctx.fillStyle = maxed ? '#8ad4f0' : '#2e5c7a';
        ctx.beginPath(); ctx.arc(-8, -6, 3.4, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = maxed ? '#1e4258' : '#3a6c8a';
      ctx.beginPath(); ctx.ellipse(-4, 0, 8 + lv, 6.5 + lv*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = maxed ? '#e8f8ff' : '#bfe8ff';
      ctx.beginPath(); ctx.ellipse(-6.5, -2, 2.8, 1.8, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = maxed ? '#9adcff' : '#7ab6d8'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14 + lv*2, 0); ctx.stroke();
      if (maxed){                                       // glowing cryo rings + icicles under the barrel
        const cgl = 0.5 + 0.5 * Math.sin(time * 4 + t.x);
        ctx.strokeStyle = `rgba(200,240,255,${0.5 + 0.5*cgl})`; ctx.lineWidth = 1.2;
        for (let x = 3; x <= 12 + lv*2; x += 4.5){
          ctx.beginPath(); ctx.ellipse(x, 0, 1.4, 3.6, 0, 0, Math.PI*2); ctx.stroke();
        }
        ctx.fillStyle = '#d8f2ff';
        for (const [ix, ilen] of [[4, 3.4], [9, 4.6], [14, 3]]){
          ctx.beginPath(); ctx.moveTo(ix - 1, 3); ctx.lineTo(ix, 3 + ilen); ctx.lineTo(ix + 1, 3); ctx.closePath(); ctx.fill();
        }
      }
      ctx.fillStyle = maxed ? '#163244' : '#2c4c62'; ctx.fillRect(12 + lv*2, -3.5 - lv*0.5, 5, 7 + lv);
      const v = (time*0.7 + t.x*0.013) % 1;             // vapor wisps, heavier per level
      ctx.fillStyle = `rgba(200,240,255,${(0.4 + lv*0.15)*(1-v)})`;
      ctx.beginPath(); ctx.arc(17 + lv*2 + v*8, -3 - v*8, 2 + lv + v*3, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'mortar': { // high-angle tube → maxed is a massive black siege piece
      ctx.translate(-rec * 1.4, 0);
      ctx.fillStyle = maxed ? '#332f28' : '#4a453a';
      ctx.beginPath(); ctx.ellipse(0, 0, 9 + lv*2, 7 + lv*1.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = maxed ? '#e0b64f' : '#2c2820'; ctx.lineWidth = 1.5; ctx.stroke();
      if (maxed){                                       // side blast shields
        ctx.fillStyle = '#26231d';
        ctx.beginPath(); ctx.moveTo(-2, -9); ctx.lineTo(6, -12); ctx.lineTo(8, -8); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2, 9); ctx.lineTo(6, 12); ctx.lineTo(8, 8); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = maxed ? '#4a4438' : '#6a6354'; ctx.lineWidth = 2.5;  // bipod
      ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(10 + lv*2, -9 - lv); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 5); ctx.lineTo(10 + lv*2, 9 + lv); ctx.stroke();
      const tl = 11 + lv * 3;                           // the tube itself, far fatter when maxed
      ctx.strokeStyle = maxed ? '#1c1a14' : '#5e5844'; ctx.lineWidth = 9 + lv*3;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(tl, 0); ctx.stroke();
      ctx.strokeStyle = maxed ? '#3c382c' : '#7d7660'; ctx.lineWidth = 5.5 + lv*2;
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(tl, 0); ctx.stroke();
      if (maxed){                                       // twin gold reinforcement bands
        ctx.strokeStyle = '#e0b64f'; ctx.lineWidth = 1.4;
        for (const bx of [2, 7]){
          ctx.beginPath(); ctx.moveTo(bx, -6.4); ctx.lineTo(bx, 6.4); ctx.stroke();
        }
      }
      ctx.fillStyle = '#17150f';                        // gaping muzzle
      ctx.beginPath(); ctx.ellipse(tl + 1, 0, 3 + lv, 4.6 + lv*1.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#e0b64f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(tl + 1, 0, 3 + lv, 4.6 + lv*1.4, 0, 0, Math.PI*2); ctx.stroke();
      if (maxed && t.cd <= 0){                          // a shell glows deep in the loaded tube
        const sgl = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(255,140,50,${0.4 + 0.4*sgl})`;
        ctx.beginPath(); ctx.ellipse(tl + 1, 0, 1.6, 2.6, 0, 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'sonic': { // dish array → stacks more dishes, maxed rings with magenta power
      const main = maxed ? '#ff9af0' : '#d6a3ff';
      ctx.fillStyle = maxed ? '#4a2647' : '#3a2e4a'; ctx.beginPath(); ctx.arc(0, 0, 8 + lv, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = maxed ? '#b05aa8' : '#8a6fae'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10 - lv*2); ctx.stroke();
      const dishes = 1 + lv;                            // extra dish per level, stacked up the mast
      for (let i = 0; i < dishes; i++){
        const dy = -13 - i * 7, ds = 1 - i * 0.22;
        ctx.fillStyle = main; ctx.beginPath(); ctx.ellipse(0, dy, 8*ds, 4.6*ds, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = maxed ? '#5e2c58' : '#4a3a5e'; ctx.beginPath(); ctx.ellipse(0, dy, 5.2*ds, 2.8*ds, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = maxed ? '#ffe8fc' : '#efe0ff'; ctx.beginPath(); ctx.arc(0, dy, 1.4*ds, 0, Math.PI*2); ctx.fill();
      }
      const gl = (Math.sin(time*4) + 1) / 2;            // resonance rings pulse outward
      for (let i = 0; i < (maxed ? 2 : 1); i++){
        ctx.strokeStyle = `rgba(${maxed ? '255,154,240' : '214,163,255'},${(0.25 + 0.3*gl) / (i + 1)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, -13 - lv*3, 10 + gl*3 + i*6 + lv*2, 0, Math.PI*2); ctx.stroke();
      }
      break;
    }
  }
  if (flash > 0 && ['tranq','gatling','sniper','missile'].includes(t.key)){
    const fx = t.key === 'sniper' ? 27 + lv*4 : t.key === 'missile' ? 12 + lv*3 : 19 + lv*2;
    ctx.fillStyle = `rgba(255,220,120,${flash*3})`;
    ctx.beginPath(); ctx.arc(fx, 0, 4 + flash*(22 + lv*4), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,220,${flash*3})`;
    ctx.beginPath(); ctx.arc(fx, 0, 2 + flash*9, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- BAKED PROPS (drawn once into the background) ---------- */
function bakeTree(c, x, y, r, th, rng){
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(x+4, y+5, r*1.1, r*0.5, 0, 0, Math.PI*2); c.fill();
  // canopy cluster
  for (const [ox, oy, or] of [[0,0,1],[-r*0.55,r*0.2,0.72],[r*0.5,r*0.25,0.66],[-r*0.1,-r*0.45,0.7]]){
    c.fillStyle = shade(th.tree, -0.1 + rng()*0.12);
    c.beginPath(); c.arc(x+ox, y+oy, r*or, 0, Math.PI*2); c.fill();
  }
  c.fillStyle = shade(th.tree, 0.3);
  c.beginPath(); c.arc(x - r*0.32, y - r*0.35, r*0.5, 0, Math.PI*2); c.fill();
  c.fillStyle = shade(th.tree, 0.5); c.globalAlpha = 0.5;
  c.beginPath(); c.arc(x - r*0.4, y - r*0.45, r*0.26, 0, Math.PI*2); c.fill();
  c.globalAlpha = 1;
}
function bakePalm(c, x, y, s, th){
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(x+3, y+4, s*1.3, s*0.4, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = shade(th.tree, 0.35); c.lineCap = 'round';
  for (let i = 0; i < 6; i++){
    const a = i/6*Math.PI*2 + 0.4;
    c.lineWidth = s*0.28;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a)*s*0.8, y + Math.sin(a)*s*0.5 - s*0.3,
                       x + Math.cos(a)*s*1.5, y + Math.sin(a)*s*0.9);
    c.stroke();
  }
  c.fillStyle = shade(th.tree, 0.15);
  c.beginPath(); c.arc(x, y, s*0.32, 0, Math.PI*2); c.fill();
}
function bakeRocks(c, x, y, s, rng){
  for (let i = 0; i < 3; i++){
    const rx = x + (rng()-0.5)*s*2, ry = y + (rng()-0.5)*s, rr = s*(0.35 + rng()*0.5);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(rx+2, ry+3, rr, rr*0.5, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = `rgb(${110+rng()*30|0},${112+rng()*28|0},${104+rng()*26|0})`;
    c.beginPath();
    c.moveTo(rx-rr, ry);
    c.lineTo(rx-rr*0.4, ry-rr*0.85); c.lineTo(rx+rr*0.5, ry-rr*0.7); c.lineTo(rx+rr, ry);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.beginPath(); c.moveTo(rx-rr*0.4, ry-rr*0.85); c.lineTo(rx+rr*0.5, ry-rr*0.7); c.lineTo(rx, ry-rr*0.2); c.closePath(); c.fill();
  }
}
function bakeFern(c, x, y, s, th, rng){
  c.strokeStyle = shade(th.grass2, 0.45); c.lineCap = 'round'; c.lineWidth = 1.4;
  for (let i = 0; i < 5; i++){
    const a = -Math.PI/2 + (i - 2)*0.45 + (rng()-0.5)*0.2;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a)*s*0.6, y + Math.sin(a)*s*0.8, x + Math.cos(a)*s*1.2, y + Math.sin(a)*s*0.9);
    c.stroke();
  }
}
function bakeBones(c, x, y, s, rng){
  /* a full theropod kill-site skeleton: arched vertebral column with neural
     spines, a curling tail, a proper ribcage, a loose femur, and a big
     hollow-eyed skull with a toothy snout — half-sunk in a dark stain */
  rng = rng || Math.random;
  const bone = '#ded5b8', boneDk = '#a89f82', socket = '#3c372a';
  const dir = rng() < 0.5 ? 1 : -1;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  // old dark stain under the site
  c.fillStyle = 'rgba(24,20,12,0.28)';
  c.beginPath(); c.ellipse(s*0.2, s*0.18, s*1.9, s*0.6, 0, 0, Math.PI*2); c.fill();
  // vertebral column — arched, tapering into a curled tail
  c.strokeStyle = bone; c.lineCap = 'round';
  c.lineWidth = s*0.13;
  c.beginPath(); c.moveTo(-s*1.05, -s*0.02);
  c.quadraticCurveTo(-s*0.1, -s*0.5, s*0.75, -s*0.2); c.stroke();
  c.lineWidth = s*0.08;                                        // tail curls away
  c.beginPath(); c.moveTo(-s*1.05, -s*0.02);
  c.quadraticCurveTo(-s*1.6, s*0.2, -s*1.95, s*0.02); c.stroke();
  // neural spines jutting up from each vertebra
  c.lineWidth = s*0.06;
  for (let i = 0; i <= 5; i++){
    const t = i/5, omt = 1 - t;
    const bx = omt*omt*(-s*1.05) + 2*omt*t*(-s*0.1) + t*t*(s*0.75);
    const by = omt*omt*(-s*0.02) + 2*omt*t*(-s*0.5) + t*t*(-s*0.2);
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - s*0.04, by - s*0.2); c.stroke();
  }
  // ribcage — paired curving ribs, one snapped short
  for (let i = 0; i < 4; i++){
    const t = 0.22 + i*0.16, omt = 1 - t;
    const bx = omt*omt*(-s*1.05) + 2*omt*t*(-s*0.1) + t*t*(s*0.75);
    const by = omt*omt*(-s*0.02) + 2*omt*t*(-s*0.5) + t*t*(-s*0.2);
    const broken = i === 2;                       // one shattered rib
    c.lineWidth = s*0.065;
    c.beginPath(); c.moveTo(bx, by);
    c.quadraticCurveTo(bx - s*0.22, by + s*(broken ? 0.22 : 0.42), bx - s*(broken ? 0.16 : 0.1), by + s*(broken ? 0.3 : 0.62));
    c.stroke();
  }
  // a loose femur flung to the side, knobs on both ends
  c.save(); c.translate(-s*0.35, s*0.62); c.rotate(0.5);
  c.strokeStyle = boneDk; c.lineWidth = s*0.09;
  c.beginPath(); c.moveTo(-s*0.3, 0); c.lineTo(s*0.3, 0); c.stroke();
  c.fillStyle = boneDk;
  c.beginPath(); c.arc(-s*0.33, 0, s*0.08, 0, Math.PI*2); c.fill();
  c.beginPath(); c.arc(s*0.33, -s*0.03, s*0.08, 0, Math.PI*2); c.fill();
  c.beginPath(); c.arc(s*0.33, s*0.04, s*0.07, 0, Math.PI*2); c.fill();
  c.restore();
  // the skull: heavy cranium, long toothed snout, hollow orbit
  c.fillStyle = bone;
  c.beginPath();
  c.moveTo(s*0.62, -s*0.42);                                   // crown
  c.quadraticCurveTo(s*1.1, -s*0.58, s*1.32, -s*0.34);
  c.lineTo(s*2.0, -s*0.14);                                    // snout ridge
  c.quadraticCurveTo(s*2.08, -s*0.04, s*1.98, s*0.04);         // snout tip
  c.lineTo(s*1.05, s*0.13);                                    // jawline
  c.quadraticCurveTo(s*0.6, s*0.1, s*0.62, -s*0.42);
  c.closePath(); c.fill();
  c.strokeStyle = boneDk; c.lineWidth = s*0.035;
  c.beginPath(); c.moveTo(s*0.68, s*0.1); c.lineTo(s*1.9, s*0.0); c.stroke();
  // hollow eye socket + nasal fenestra — the "it's watching you" part
  c.fillStyle = socket;
  c.beginPath(); c.ellipse(s*1.08, -s*0.24, s*0.15, s*0.19, 0.25, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(s*1.62, -s*0.09, s*0.1, s*0.07, 0.15, 0, Math.PI*2); c.fill();
  // savage teeth along the snout
  c.fillStyle = '#efe8d0';
  for (let i = 0; i < 6; i++){
    const tx = s*(1.12 + i*0.145);
    c.beginPath(); c.moveTo(tx, s*0.1 - i*s*0.012);
    c.lineTo(tx + s*0.05, s*(0.3 - i*0.02));
    c.lineTo(tx + s*0.1, s*0.09 - i*s*0.012);
    c.closePath(); c.fill();
  }
  c.restore();
}
function bakeSign(c, x, y){ // electric-fence warning sign on a post
  c.strokeStyle = '#5a5245'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 20); c.stroke();
  c.save(); c.translate(x, y - 26); c.rotate(Math.PI/4);
  c.fillStyle = '#e8b93a'; c.fillRect(-8, -8, 16, 16);
  c.strokeStyle = '#141410'; c.lineWidth = 1.5; c.strokeRect(-8, -8, 16, 16);
  c.restore();
  c.fillStyle = '#141410'; c.font = 'bold 11px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('⚡', x, y - 25);
}
function bakeJeep(c, x, y){ // abandoned STAFF JEEP 29 — wrangler silhouette, side view
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(x, y + 8, 30, 6.5, 0, 0, Math.PI*2); c.fill();
  // muddy tire ruts trailing off behind it
  c.strokeStyle = 'rgba(40,34,22,0.35)'; c.lineWidth = 3;
  for (const oy of [3, 8]){
    c.beginPath(); c.moveTo(x - 28, y + oy); c.quadraticCurveTo(x - 48, y + oy + 2, x - 62, y + oy - 1); c.stroke();
  }
  // sand-beige tub with fender bulges
  const g = c.createLinearGradient(x, y - 16, x, y + 4);
  g.addColorStop(0, '#cbb98a'); g.addColorStop(1, '#9d8c60');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - 26, y + 4);
  c.lineTo(x - 26, y - 5); c.quadraticCurveTo(x - 25, y - 8, x - 21, y - 8);   // rear deck
  c.lineTo(x - 8, y - 8);
  c.lineTo(x - 5, y - 8); c.lineTo(x + 13, y - 8);                             // belt line
  c.quadraticCurveTo(x + 19, y - 8, x + 21, y - 6);                            // hood slope
  c.lineTo(x + 27, y - 5); c.lineTo(x + 27, y + 4);
  c.closePath(); c.fill();
  // fender arches (darker)
  c.fillStyle = '#7d6f4a';
  for (const wx of [-15, 16]){
    c.beginPath(); c.arc(x + wx, y + 3, 8.6, Math.PI, 0); c.fill();
  }
  // the iconic red side-stripe swoosh
  c.strokeStyle = '#a5291c'; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 25, y - 2); c.quadraticCurveTo(x - 2, y - 4.5, x + 25, y - 2); c.stroke();
  c.strokeStyle = '#6f7a80'; c.lineWidth = 1.2;                                // grey pinstripe under it
  c.beginPath(); c.moveTo(x - 25, y + 0.5); c.quadraticCurveTo(x - 2, y - 1.5, x + 25, y + 0.5); c.stroke();
  // roll bar + windshield frame (windshield cracked)
  c.strokeStyle = '#3a3d34'; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(x - 6, y - 8); c.quadraticCurveTo(x - 6, y - 17, x - 1, y - 17); c.stroke(); // roll bar
  c.beginPath(); c.moveTo(x + 12, y - 8); c.lineTo(x + 9, y - 16); c.stroke();                          // windshield post
  c.fillStyle = 'rgba(150,180,190,0.4)';                                       // glass
  c.beginPath(); c.moveTo(x + 11.5, y - 8.5); c.lineTo(x + 9.5, y - 15); c.lineTo(x - 0.5, y - 15.5); c.lineTo(x - 1, y - 8.5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(235,245,248,0.75)'; c.lineWidth = 0.8;                 // spider crack
  for (let i = 0; i < 4; i++){
    const a = 0.6 + i * 1.5;
    c.beginPath(); c.moveTo(x + 5, y - 12);
    c.lineTo(x + 5 + Math.cos(a) * 4.5, y - 12 + Math.sin(a) * 3.5); c.stroke();
  }
  // spare tire on the tailgate + wheels with deep-lug tires
  c.fillStyle = '#1d1e18';
  c.beginPath(); c.arc(x - 26, y - 1, 5.4, 0, Math.PI*2); c.fill();
  c.fillStyle = '#3c3e32'; c.beginPath(); c.arc(x - 26, y - 1, 2.2, 0, Math.PI*2); c.fill();
  for (const wx of [-15, 16]){
    c.fillStyle = '#1d1e18'; c.beginPath(); c.arc(x + wx, y + 4, 6.6, 0, Math.PI*2); c.fill();
    c.strokeStyle = '#0e0f0b'; c.lineWidth = 1.4;                              // lug tread
    for (let i = 0; i < 6; i++){
      const a = i / 6 * Math.PI * 2;
      c.beginPath(); c.moveTo(x + wx + Math.cos(a)*4.4, y + 4 + Math.sin(a)*4.4);
      c.lineTo(x + wx + Math.cos(a)*6.4, y + 4 + Math.sin(a)*6.4); c.stroke();
    }
    c.fillStyle = '#5c5e50'; c.beginPath(); c.arc(x + wx, y + 4, 2.4, 0, Math.PI*2); c.fill();
    c.fillStyle = '#2a2c24'; c.beginPath(); c.arc(x + wx, y + 4, 1, 0, Math.PI*2); c.fill();
  }
  // headlight + brush guard on the nose
  c.fillStyle = '#e8e2c0'; c.beginPath(); c.arc(x + 25.4, y - 3, 1.6, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#3a3d34'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(x + 27.5, y - 6); c.lineTo(x + 27.5, y + 4); c.stroke();
  // white "29" unit roundel on the door
  c.fillStyle = '#e9e4d2'; c.beginPath(); c.arc(x + 2, y - 3.4, 3.4, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#a5291c'; c.lineWidth = 0.9; c.beginPath(); c.arc(x + 2, y - 3.4, 3.4, 0, Math.PI*2); c.stroke();
  c.fillStyle = '#2c2c24'; c.font = 'bold 4.5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('29', x + 2, y - 3.1);
  // mud spatter along the sills + vines reclaiming the rear
  c.fillStyle = 'rgba(60,48,28,0.5)';
  for (let i = 0; i < 8; i++){
    c.beginPath(); c.arc(x - 22 + i * 6.4, y + 2.4 + (i % 3) * 0.8, 1 + (i % 2) * 0.8, 0, Math.PI*2); c.fill();
  }
  c.strokeStyle = 'rgba(70,110,50,0.85)'; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(x - 27, y + 3); c.quadraticCurveTo(x - 24, y - 12, x - 12, y - 9); c.stroke();
  c.beginPath(); c.moveTo(x - 27, y - 2); c.quadraticCurveTo(x - 20, y - 6, x - 16, y - 8.4); c.stroke();
}
function bakeGyro(c, x, y, s){ // wrecked gyrosphere: shattered glass, blood at the breach
  // shadow + the furrow it plowed when it stopped rolling
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(x, y + s*0.72, s*1.15, s*0.32, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = 'rgba(45,38,24,0.4)'; c.lineWidth = s*0.3;
  c.beginPath(); c.moveTo(x - s*2.4, y + s*0.75); c.quadraticCurveTo(x - s*1.2, y + s*0.9, x - s*0.4, y + s*0.72); c.stroke();
  c.save(); c.translate(x, y); c.rotate(-0.18);
  // glass sphere — faint fill, bright rim, big arc highlight
  c.fillStyle = 'rgba(205,232,240,0.14)';
  c.beginPath(); c.arc(0, 0, s, 0, Math.PI*2); c.fill();
  c.strokeStyle = 'rgba(225,242,248,0.6)'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(0, 0, s, 0, Math.PI*2); c.stroke();
  c.strokeStyle = 'rgba(240,250,255,0.5)'; c.lineWidth = 2.2;
  c.beginPath(); c.arc(0, 0, s*0.82, Math.PI*1.15, Math.PI*1.6); c.stroke();
  // white structural ring + hub (the gyro frame)
  c.strokeStyle = '#dde3e6'; c.lineWidth = s*0.11;
  c.beginPath(); c.ellipse(0, 0, s*0.34, s*0.94, 0, 0, Math.PI*2); c.stroke();
  c.fillStyle = '#c7ced2';
  c.beginPath(); c.arc(0, 0, s*0.14, 0, Math.PI*2); c.fill();
  // twin seats inside, empty and askew
  c.fillStyle = 'rgba(35,40,46,0.6)';
  c.beginPath(); c.ellipse(-s*0.28, s*0.22, s*0.2, s*0.3, 0.25, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(s*0.12, s*0.26, s*0.2, s*0.3, 0.15, 0, Math.PI*2); c.fill();
  // the breach: a jagged hole punched through the upper-right glass
  const hx = s*0.42, hy = -s*0.4;
  c.fillStyle = 'rgba(12,14,10,0.55)';
  c.beginPath();
  for (let i = 0; i < 9; i++){
    const a = i/9*Math.PI*2;
    const rr = s*(0.26 + ((i*31) % 7)/7*0.16);
    const px2 = hx + Math.cos(a)*rr, py2 = hy + Math.sin(a)*rr*0.85;
    i ? c.lineTo(px2, py2) : c.moveTo(px2, py2);
  }
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(240,250,255,0.85)'; c.lineWidth = 1;   // glinting broken rim
  c.stroke();
  // cracks radiating from the breach across the sphere
  c.strokeStyle = 'rgba(230,244,250,0.55)'; c.lineWidth = 0.9;
  for (let i = 0; i < 5; i++){
    const a = 0.5 + i*1.15;
    const ex = hx + Math.cos(a)*s*0.75, ey = hy + Math.sin(a)*s*0.7;
    c.beginPath(); c.moveTo(hx + Math.cos(a)*s*0.3, hy + Math.sin(a)*s*0.27);
    c.quadraticCurveTo(hx + Math.cos(a + 0.2)*s*0.5, hy + Math.sin(a + 0.2)*s*0.48, ex, ey);
    c.stroke();
  }
  // blood — smeared around the breach, dripping down the inside of the glass
  c.strokeStyle = 'rgba(122,22,16,0.72)'; c.lineWidth = s*0.07; c.lineCap = 'round';
  c.beginPath(); c.arc(hx, hy, s*0.3, 0.5, 1.9); c.stroke();
  c.beginPath(); c.arc(hx - s*0.05, hy + s*0.06, s*0.36, 0.9, 1.7); c.stroke();
  c.fillStyle = 'rgba(122,22,16,0.66)';
  for (const [dxx, dlen] of [[-0.12, 0.5], [0.02, 0.72], [0.14, 0.4]]){       // long drips
    c.beginPath();
    c.moveTo(hx + s*dxx - s*0.03, hy + s*0.2);
    c.lineTo(hx + s*dxx, hy + s*0.2 + s*dlen);
    c.lineTo(hx + s*dxx + s*0.03, hy + s*0.2);
    c.closePath(); c.fill();
    c.beginPath(); c.arc(hx + s*dxx, hy + s*0.2 + s*dlen, s*0.035, 0, Math.PI*2); c.fill();
  }
  for (let i = 0; i < 7; i++){                                                 // spatter flecks
    const a = i*0.9, rr = s*(0.36 + (i%3)*0.1);
    c.beginPath(); c.arc(hx + Math.cos(a)*rr, hy + Math.sin(a)*rr*0.8, s*0.025 + (i%2)*s*0.015, 0, Math.PI*2); c.fill();
  }
  c.restore();
  // dried pool soaked into the ground beneath the breach side
  c.fillStyle = 'rgba(96,16,12,0.4)';
  c.beginPath(); c.ellipse(x + s*0.5, y + s*0.78, s*0.5, s*0.16, 0.1, 0, Math.PI*2); c.fill();
}
function bakeBarbasol(c, x, y){ // a certain shaving-cream can, half-buried in the mud
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(x + 1, y + 4, 7, 2.6, 0, 0, Math.PI*2); c.fill();
  c.fillStyle = 'rgba(58,46,28,0.7)';                          // mud mound swallowing it
  c.beginPath(); c.ellipse(x, y + 3, 8, 3.4, 0, 0, Math.PI*2); c.fill();
  c.save(); c.translate(x, y); c.rotate(-0.5);
  c.fillStyle = '#e8e6df'; c.fillRect(-3.2, -8, 6.4, 11);      // white can
  c.fillStyle = '#b03028';                                     // red diagonal stripes
  for (let i = 0; i < 3; i++){
    c.beginPath();
    c.moveTo(-3.2, -6 + i*3.6); c.lineTo(3.2, -7.6 + i*3.6);
    c.lineTo(3.2, -6.4 + i*3.6); c.lineTo(-3.2, -4.8 + i*3.6);
    c.closePath(); c.fill();
  }
  c.fillStyle = '#8a8f94'; c.fillRect(-3.2, -10, 6.4, 2.4);    // cap
  c.restore();
}
function bakeFlare(c, x, y){ // a spent signal flare with a red scorch
  c.fillStyle = 'rgba(180,40,20,0.16)';                        // faded scorch bloom
  c.beginPath(); c.ellipse(x, y, 9, 5, 0, 0, Math.PI*2); c.fill();
  c.save(); c.translate(x, y); c.rotate(0.4);
  c.strokeStyle = '#a5291c'; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-6, 0); c.lineTo(4, 0); c.stroke();  // stick
  c.fillStyle = '#2a221c';                                     // charred tip
  c.beginPath(); c.arc(5, 0, 1.8, 0, Math.PI*2); c.fill();
  c.fillStyle = '#e8d8c8';                                     // ash flecks
  c.beginPath(); c.arc(6.5, -1, 0.7, 0, Math.PI*2); c.fill();
  c.restore();
}
function bakeLog(c, x, y, s, th, rng){ // fallen mossy trunk
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(x, y + s*0.3, s*1.6, s*0.4, 0, 0, Math.PI*2); c.fill();
  c.save(); c.translate(x, y); c.rotate((rng() - 0.5) * 0.5);
  c.fillStyle = '#4e4028';
  c.beginPath();
  c.moveTo(-s*1.5, -s*0.28); c.lineTo(s*1.5, -s*0.34);
  c.quadraticCurveTo(s*1.7, -s*0.05, s*1.5, s*0.26);
  c.lineTo(-s*1.5, s*0.3); c.closePath(); c.fill();
  c.fillStyle = '#6b593a';                                     // exposed end rings
  c.beginPath(); c.ellipse(s*1.52, -s*0.04, s*0.18, s*0.3, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#4e4028'; c.lineWidth = 1;
  c.beginPath(); c.ellipse(s*1.52, -s*0.04, s*0.09, s*0.16, 0, 0, Math.PI*2); c.stroke();
  c.strokeStyle = 'rgba(30,24,14,0.5)';                        // bark grain
  for (let i = 0; i < 3; i++){
    c.beginPath(); c.moveTo(-s*1.4, -s*0.16 + i*s*0.18);
    c.quadraticCurveTo(0, -s*0.2 + i*s*0.18, s*1.4, -s*0.18 + i*s*0.18); c.stroke();
  }
  c.fillStyle = shade(th.tree, 0.25);                          // moss cushions on top
  for (const [mx, mr] of [[-s*0.9, s*0.3], [-s*0.1, s*0.38], [s*0.7, s*0.26]]){
    c.beginPath(); c.ellipse(mx, -s*0.3, mr, mr*0.5, 0, 0, Math.PI*2); c.fill();
  }
  c.restore();
}

/* The iconic park gate: two stone pillars + arch + torch bowls.
   Returns the torch flame anchor points for runtime animation. */
function bakeGate(c, x, y, ang){
  const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
  const flames = [];
  const tops = [];
  for (const s of [-1, 1]){
    const gx = x + px*s*36, gy = y + py*s*36;
    c.save(); c.translate(gx, gy);
    c.fillStyle = 'rgba(0,0,0,0.32)';
    c.beginPath(); c.ellipse(3, 4, 15, 7, 0, 0, Math.PI*2); c.fill();
    const g = c.createLinearGradient(-11, 0, 11, 0);
    g.addColorStop(0, '#6e5f45'); g.addColorStop(0.45, '#9a8862'); g.addColorStop(1, '#5c4e38');
    c.fillStyle = g; c.fillRect(-11, -54, 22, 58);
    c.strokeStyle = '#463a26'; c.lineWidth = 1.5; c.strokeRect(-11, -54, 22, 58);
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1;
    for (let yy = -46; yy < 0; yy += 9){
      c.beginPath(); c.moveTo(-11, yy); c.lineTo(11, yy); c.stroke();
      c.beginPath(); c.moveTo((yy/9 % 2) ? -2 : 4, yy); c.lineTo((yy/9 % 2) ? -2 : 4, yy + 9); c.stroke();
    }
    // moss
    c.fillStyle = 'rgba(80,110,55,0.5)';
    c.beginPath(); c.ellipse(-6, -14, 4, 9, 0.3, 0, Math.PI*2); c.fill();
    // cap + torch bowl
    c.fillStyle = '#55482f'; c.fillRect(-14, -60, 28, 7);
    c.fillStyle = '#2e2a20';
    c.beginPath(); c.ellipse(0, -62, 8, 3.6, 0, 0, Math.PI*2); c.fill();
    c.restore();
    flames.push({x: gx, y: gy - 64});
    tops.push({x: gx, y: gy - 54});
  }
  // wooden arch between pillar tops with hanging sign
  const mx = (tops[0].x + tops[1].x)/2, my = (tops[0].y + tops[1].y)/2;
  c.strokeStyle = '#5c4a2e'; c.lineWidth = 9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(tops[0].x, tops[0].y - 2);
  c.quadraticCurveTo(mx, my - 16, tops[1].x, tops[1].y - 2); c.stroke();
  c.strokeStyle = '#7a6540'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(tops[0].x, tops[0].y - 4);
  c.quadraticCurveTo(mx, my - 18, tops[1].x, tops[1].y - 4); c.stroke();
  // hazard medallion hanging at the center of the arch
  c.fillStyle = '#4e3f27';
  c.beginPath(); c.arc(mx, my - 6, 10, 0, Math.PI*2); c.fill();
  c.fillStyle = '#e8b93a';
  c.beginPath(); c.arc(mx, my - 6, 8, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#141410'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(mx, my - 6, 8, 0, Math.PI*2); c.stroke();
  c.fillStyle = '#141410'; c.font = 'bold 10px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('⚠', mx, my - 5.5);
  return flames;
}

/* Fortified containment checkpoint at the path exit.
   Returns beacon + spotlight anchors for runtime animation. */
function bakeExit(c, x, y, W, H){
  const bx = Math.min(x, W - 30), by = y;
  // electric fence wings above & below the road
  for (const s of [-1, 1]){
    for (let i = 1; i <= 3; i++){
      const fy = by + s*(30 + i*24);
      if (fy < 8 || fy > H - 8) break;
      c.strokeStyle = '#7d8790'; c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(bx - 4, fy); c.lineTo(bx - 4, fy - 20); c.stroke();
      c.fillStyle = '#a8b2ba'; c.fillRect(bx - 7, fy - 22, 6, 3);
      // wires with a faint charge glow
      if (i < 3){
        for (const wy of [4, 10, 16]){
          c.strokeStyle = 'rgba(150,220,255,0.55)'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(bx - 4, fy - wy); c.lineTo(bx - 4, fy + s*24 - wy > fy - wy ? fy + 24 - wy : fy - 24 - wy);
          c.moveTo(bx - 4, fy - wy); c.lineTo(bx - 4, fy + s*24 - wy);
          c.stroke();
        }
      }
    }
  }
  // concrete guard towers flanking the road
  for (const s of [-1, 1]){
    const ty = by + s*32;
    c.save(); c.translate(bx, ty);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(2, 4, 15, 7, 0, 0, Math.PI*2); c.fill();
    const g = c.createLinearGradient(-12, 0, 12, 0);
    g.addColorStop(0, '#5d6357'); g.addColorStop(0.5, '#7c8375'); g.addColorStop(1, '#4b5045');
    c.fillStyle = g; c.fillRect(-12, -40, 24, 44);
    c.strokeStyle = '#31352c'; c.lineWidth = 1.5; c.strokeRect(-12, -40, 24, 44);
    // slit window
    c.fillStyle = '#1c201a'; c.fillRect(-7, -30, 14, 5);
    c.fillStyle = 'rgba(255,230,150,0.7)'; c.fillRect(-5, -29, 4, 3);
    // roof
    c.fillStyle = '#3c4136'; c.fillRect(-14, -44, 28, 6);
    c.restore();
  }
  // striped barrier arms angled open across the road
  for (const s of [-1, 1]){
    c.save(); c.translate(bx - 14, by + s*24); c.rotate(s * -0.9);
    for (let i = 0; i < 4; i++){
      c.fillStyle = i % 2 ? '#d8d5c8' : '#c23b2a';
      c.fillRect(i*8, -2.5, 8, 5);
    }
    c.restore();
  }
  // sandbags in front
  c.fillStyle = '#8a7a55';
  for (const [sx, sy] of [[-34, -14], [-38, 0], [-34, 14]]){
    c.beginPath(); c.ellipse(bx + sx, by + sy, 7, 4, 0, 0, Math.PI*2); c.fill();
  }
  c.fillStyle = '#6e6144';
  c.beginPath(); c.ellipse(bx - 37, by - 7, 7, 4, 0, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(bx - 37, by + 7, 7, 4, 0, 0, Math.PI*2); c.fill();
  return {x: bx, y: by, beacon: {x: bx, y: by - 76}};
}

/* ---------- F-22 (top-down, facing +x) for the air strike ---------- */
function drawF22(ctx, x, y, scale, time){
  // ground shadow far below the airframe
  ctx.save();
  ctx.translate(x + 26, y + 44);
  ctx.scale(scale * 0.9, scale * 0.9);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(22, 0); ctx.lineTo(2, -5); ctx.lineTo(-2, -11); ctx.lineTo(-9, -11);
  ctx.lineTo(-16, -4); ctx.lineTo(-16, 4); ctx.lineTo(-9, 11); ctx.lineTo(-2, 11); ctx.lineTo(2, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // afterburners
  const ab = 0.7 + 0.3 * Math.sin(time * 42 + x);
  for (const oy of [-3.4, 3.4]){
    ctx.fillStyle = `rgba(120,190,255,${0.5 * ab})`;
    ctx.beginPath(); ctx.ellipse(-19 - ab * 6, oy, 6 + ab * 4, 2.1, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,215,130,${0.85 * ab})`;
    ctx.beginPath(); ctx.ellipse(-17.5 - ab * 3, oy, 3.5 + ab * 2, 1.3, 0, 0, Math.PI*2); ctx.fill();
  }
  // raptor planform
  ctx.fillStyle = '#5a636e';
  ctx.beginPath();
  ctx.moveTo(24, 0);          // nose
  ctx.lineTo(13, -3.2);
  ctx.lineTo(2, -4.8);        // leading-edge root extension
  ctx.lineTo(-2, -12);        // out to the wingtip
  ctx.lineTo(-9, -12);        // wingtip chord
  ctx.lineTo(-8, -5);         // trailing edge back in
  ctx.lineTo(-14, -8.5);      // horizontal stabilizer tip
  ctx.lineTo(-17, -3.4);      // exhaust
  ctx.lineTo(-17, 3.4);
  ctx.lineTo(-14, 8.5);
  ctx.lineTo(-8, 5);
  ctx.lineTo(-9, 12);
  ctx.lineTo(-2, 12);
  ctx.lineTo(2, 4.8);
  ctx.lineTo(13, 3.2);
  ctx.closePath(); ctx.fill();
  // spine + panel highlight
  ctx.fillStyle = '#6f7a87';
  ctx.beginPath();
  ctx.moveTo(24, 0); ctx.lineTo(13, -3.2); ctx.lineTo(-6, -2.2); ctx.lineTo(-6, 2.2); ctx.lineTo(13, 3.2);
  ctx.closePath(); ctx.fill();
  // canted twin tails
  ctx.fillStyle = '#454e58';
  for (const s of [-1, 1]){
    ctx.beginPath();
    ctx.moveTo(-7, s * 3.6); ctx.lineTo(-14, s * 7.2); ctx.lineTo(-16.5, s * 6.4); ctx.lineTo(-11, s * 3);
    ctx.closePath(); ctx.fill();
  }
  // wing edge accents
  ctx.strokeStyle = 'rgba(20,26,32,0.5)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(2, -4.8); ctx.lineTo(-2, -12); ctx.moveTo(2, 4.8); ctx.lineTo(-2, 12); ctx.stroke();
  // canopy
  ctx.fillStyle = '#161f27';
  ctx.beginPath(); ctx.ellipse(12.5, 0, 4.6, 2.2, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(150,205,255,0.55)';
  ctx.beginPath(); ctx.ellipse(13.5, -0.5, 2.4, 1, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ---------- RUNTIME ANIMATED SET PIECES ---------- */
function drawTorchFlame(ctx, x, y, t){
  const f = Math.sin(t*11) * 0.5 + Math.sin(t*23 + 1) * 0.3;
  ctx.save();
  ctx.translate(x, y);
  // warm glow
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, -4, 1, 0, -4, 16 + f*4);
  g.addColorStop(0, 'rgba(255,200,90,0.4)'); g.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -4, 16 + f*4, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // layered flame body
  for (const [col, s] of [['#ff8c1e', 1], ['#ffc63a', 0.62], ['#fff3c0', 0.3]]){
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-4.5*s, 0);
    ctx.quadraticCurveTo(-5.5*s, -7*s, f*3*s, -13*s - f*2);
    ctx.quadraticCurveTo(5.5*s, -7*s, 4.5*s, 0);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawExitBeacon(ctx, exit, t, night){
  const b = exit.beacon;
  const blink = (Math.sin(t*5) + 1) / 2;
  // pole + lamp
  ctx.strokeStyle = '#31352c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(b.x, b.y + 8); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.fillStyle = `rgba(255,60,40,${0.35 + 0.65*blink})`;
  ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, Math.PI*2); ctx.fill();
  if (blink > 0.5){
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 26);
    g.addColorStop(0, `rgba(255,70,40,${0.3*blink})`); g.addColorStop(1, 'rgba(255,70,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (night){ // sweeping searchlight from the checkpoint
    const a = Math.PI + Math.sin(t*0.5) * 0.5;
    ctx.save();
    ctx.translate(exit.x, exit.y - 40); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, 190, 0);
    g.addColorStop(0, 'rgba(255,240,190,0.20)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(190, -34); ctx.lineTo(190, 34); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* ---------- LEVEL BACKGROUND (pre-rendered once per level) ----------
   Returns {cv, flames, exit} — flames/exit are runtime animation anchors. */
function renderBackground(level, W, H){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const th = level.theme;

  // seeded rng so each map looks the same every session
  let seed = 1234 + LEVELS.indexOf(level) * 999;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const nearPath = (x, y, dist) => level.paths.some(pts => {
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i+1];
      const dx = b.x-a.x, dy = b.y-a.y, L2 = dx*dx + dy*dy;
      const t = Math.max(0, Math.min(1, ((x-a.x)*dx + (y-a.y)*dy) / L2));
      if (Math.hypot(x - (a.x+dx*t), y - (a.y+dy*t)) < dist) return true;
    }
    return false;
  });

  /* --- terrain --- */
  const base = c.createLinearGradient(0, 0, W*0.3, H);
  base.addColorStop(0, shade(th.grass, 0.08)); base.addColorStop(0.55, th.grass); base.addColorStop(1, shade(th.grass, -0.1));
  c.fillStyle = base; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++){ // mottled undergrowth
    c.fillStyle = rng() < 0.5 ? th.grass2 : shade(th.grass, rng() < 0.5 ? -0.14 : 0.1);
    c.globalAlpha = 0.3;
    const x = rng()*W, y = rng()*H, r = 12 + rng()*50;
    c.beginPath(); c.ellipse(x, y, r, r*0.55, rng()*3, 0, Math.PI*2); c.fill();
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 700; i++){ // grass speckle
    c.fillStyle = rng() < 0.5 ? shade(th.grass2, 0.25) : shade(th.grass, -0.2);
    c.globalAlpha = 0.25;
    c.fillRect(rng()*W, rng()*H, 2, 2);
  }
  c.globalAlpha = 1;

  /* --- ponds --- */
  if (th.water){
    let placed = 0;
    for (let tries = 0; tries < 60 && placed < 2; tries++){
      const x = 80 + rng()*(W-160), y = 80 + rng()*(H-160), r = 42 + rng()*30;
      if (nearPath(x, y, r + 46)) continue;
      placed++;
      c.fillStyle = shade(th.water, -0.25);
      c.beginPath(); c.ellipse(x, y, r*1.06, r*0.66, 0, 0, Math.PI*2); c.fill();
      const wg = c.createRadialGradient(x - r*0.3, y - r*0.2, 4, x, y, r);
      wg.addColorStop(0, shade(th.water, 0.35)); wg.addColorStop(1, th.water);
      c.fillStyle = wg;
      c.beginPath(); c.ellipse(x, y, r, r*0.6, 0, 0, Math.PI*2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.2;
      for (let k = 1; k <= 2; k++){
        c.beginPath(); c.ellipse(x, y, r*0.55*k, r*0.32*k, 0, 0.4, 2.4); c.stroke();
      }
      for (let k = 0; k < 4; k++){ // lily pads
        c.fillStyle = shade(th.grass2, 0.3);
        const lx = x + (rng()-0.5)*r*1.1, ly = y + (rng()-0.5)*r*0.5;
        c.beginPath(); c.ellipse(lx, ly, 5, 3, rng()*3, 0.3, Math.PI*2); c.fill();
      }
      for (let k = 0; k < 6; k++) bakeFern(c, x + Math.cos(k)*r*1.15, y + Math.sin(k)*r*0.72, 9, th, rng);
    }
  }

  /* --- the road (or river, or open field) --- */
  const drawPath = (pts, w, col) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    c.stroke();
  };
  const isWaterPath = i => (level.waterPaths || []).includes(i);
  if (level.maze){
    // no road at all — an open stampede ground. Trampled aprons at the mouth
    // and the breakout point, and faint worn streaks hinting at the flow.
    for (const [ax, ay] of [[30, H/2], [W - 30, H/2]]){
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.beginPath(); c.ellipse(ax, ay + 4, 90, 120, 0, 0, Math.PI*2); c.fill();
      c.fillStyle = shade(th.path, -0.08); c.globalAlpha = 0.5;
      c.beginPath(); c.ellipse(ax, ay, 84, 112, 0, 0, Math.PI*2); c.fill();
      c.globalAlpha = 1;
    }
    c.strokeStyle = shade(th.path, -0.1); c.globalAlpha = 0.22; c.lineCap = 'round';
    for (let i = 0; i < 9; i++){
      const y = H/2 + (rng() - 0.5) * 300;
      c.lineWidth = 5 + rng() * 8;
      c.beginPath(); c.moveTo(60 + rng() * 120, y);
      c.quadraticCurveTo(W/2, y + (rng() - 0.5) * 120, W - 60 - rng() * 120, H/2 + (rng() - 0.5) * 220);
      c.stroke();
    }
    c.globalAlpha = 1;
  } else {
    level.paths.forEach((pts, pi) => {
      if (isWaterPath(pi)){
        // a living river channel: dark banks, deep water, sunlit centreline
        drawPath(pts, 58, 'rgba(0,0,0,0.3)');
        drawPath(pts, 54, shade(th.water, -0.35));
        drawPath(pts, 46, th.water);
        drawPath(pts, 26, shade(th.water, 0.18));
        // sparkle + drifting foam flecks baked along the channel
        c.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < pts.length - 1; i++){
          const a = pts[i], b = pts[i+1], n = Math.floor(Math.hypot(b.x-a.x, b.y-a.y) / 26);
          for (let j = 0; j < n; j++){
            const t = j / n;
            c.globalAlpha = 0.14 + rng() * 0.25;
            c.beginPath();
            c.ellipse(a.x + (b.x-a.x)*t + (rng()-0.5)*30, a.y + (b.y-a.y)*t + (rng()-0.5)*30,
                      2 + rng()*4, 0.8 + rng()*1.4, 0, 0, Math.PI*2);
            c.fill();
          }
        }
        c.globalAlpha = 1;
        // reeds crowding the banks
        for (let i = 0; i < pts.length - 1; i++){
          const a = pts[i], b = pts[i+1];
          const ang = Math.atan2(b.y-a.y, b.x-a.x), n = Math.floor(Math.hypot(b.x-a.x, b.y-a.y) / 90);
          for (let j = 0; j <= n; j++){
            const t = j / Math.max(1, n), s2 = rng() < 0.5 ? 1 : -1;
            const rx = a.x + (b.x-a.x)*t + Math.cos(ang + Math.PI/2) * s2 * 34;
            const ry = a.y + (b.y-a.y)*t + Math.sin(ang + Math.PI/2) * s2 * 34;
            if (rx > 14 && rx < W - 14 && ry > 14 && ry < H - 14) bakeFern(c, rx, ry, 7 + rng()*5, th, rng);
          }
        }
      } else {
        drawPath(pts, 50, 'rgba(0,0,0,0.25)');       // soft edge shadow
        drawPath(pts, 46, th.pathEdge);
        drawPath(pts, 38, th.path);
        drawPath(pts, 20, shade(th.path, 0.09));     // worn center
      }
    });
  }
  for (const [pi0, pts] of level.paths.entries()){ // jeep tire tracks
    if (level.maze || isWaterPath(pi0)) continue;
    c.save();
    c.strokeStyle = shade(th.path, -0.28); c.lineWidth = 3; c.setLineDash([12, 15]);
    for (const off of [-7.5, 7.5]){
      c.beginPath();
      for (let i = 0; i < pts.length - 1; i++){
        const a = pts[i], b = pts[i+1];
        const ang = Math.atan2(b.y-a.y, b.x-a.x);
        const ox = Math.cos(ang + Math.PI/2)*off, oy = Math.sin(ang + Math.PI/2)*off;
        if (i === 0) c.moveTo(a.x+ox, a.y+oy);
        c.lineTo(b.x+ox, b.y+oy);
      }
      c.stroke();
    }
    c.restore();
    // scattered stones on the road
    c.fillStyle = shade(th.path, -0.22); c.globalAlpha = 0.6;
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i+1];
      const len = Math.hypot(b.x-a.x, b.y-a.y), n = Math.floor(len/24);
      for (let j = 0; j < n; j++){
        const t = j/n, x = a.x + (b.x-a.x)*t + (rng()-0.5)*24, y = a.y + (b.y-a.y)*t + (rng()-0.5)*24;
        c.beginPath(); c.arc(x, y, 1.2 + rng()*2, 0, Math.PI*2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  /* --- props --- */
  for (let i = 0; i < 26; i++){ // ferns everywhere
    const x = rng()*W, y = rng()*H;
    if (nearPath(x, y, 34)) continue;
    bakeFern(c, x, y, 8 + rng()*7, th, rng);
  }
  for (let i = 0; i < 34; i++){ // tiny flowers
    const x = rng()*W, y = rng()*H;
    if (nearPath(x, y, 30)) continue;
    c.fillStyle = ['#d8c95a','#c96a8a','#d8d8d8'][i % 3]; c.globalAlpha = 0.7;
    c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI*2); c.fill();
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 9; i++){
    const x = rng()*W, y = rng()*H;
    if (nearPath(x, y, 46)) continue;
    bakeRocks(c, x, y, 8 + rng()*8, rng);
  }
  for (let b = 0; b < 3; b++){ // old kill sites — big, toothy, half-buried skeletons
    for (let tries = 0; tries < 30; tries++){
      const x = 70 + rng()*(W-140), y = 70 + rng()*(H-140);
      if (nearPath(x, y, 58)) continue;
      bakeBones(c, x, y, 14 + rng()*9, rng); break;
    }
  }
  for (let l = 0; l < 2; l++){ // fallen mossy trunks
    for (let tries = 0; tries < 30; tries++){
      const x = 60 + rng()*(W-120), y = 60 + rng()*(H-120);
      if (nearPath(x, y, 50)) continue;
      bakeLog(c, x, y, 11 + rng()*6, th, rng); break;
    }
  }
  { // one abandoned STAFF JEEP 29 per map
    for (let tries = 0; tries < 40; tries++){
      const x = 100 + rng()*(W-200), y = 90 + rng()*(H-180);
      if (nearPath(x, y, 64)) continue;
      bakeJeep(c, x, y); break;
    }
  }
  { // one wrecked gyrosphere per map — shattered, bloodied, story told
    for (let tries = 0; tries < 40; tries++){
      const x = 110 + rng()*(W-220), y = 110 + rng()*(H-200);
      if (nearPath(x, y, 72)) continue;
      bakeGyro(c, x, y, 24); break;
    }
  }
  { // easter egg: the shaving-cream can that started it all, lost in the mud
    for (let tries = 0; tries < 30; tries++){
      const x = 50 + rng()*(W-100), y = 50 + rng()*(H-100);
      if (nearPath(x, y, 40)) continue;
      bakeBarbasol(c, x, y); break;
    }
  }
  { // a couple of spent signal flares dropped near the road
    let placed = 0;
    for (let tries = 0; tries < 40 && placed < 2; tries++){
      const x = 40 + rng()*(W-80), y = 46 + rng()*(H-80);
      if (nearPath(x, y, 26) || !nearPath(x, y, 44)) continue;  // in the verge just off the tarmac
      bakeFlare(c, x, y); placed++;
    }
  }
  // warning signs beside the road
  for (const pts of level.paths){
    for (let k = 1; k < pts.length - 1; k += 2){
      const a = pts[k], b = pts[k+1];
      const ang = Math.atan2(b.y-a.y, b.x-a.x);
      const mx = (a.x+b.x)/2 + Math.cos(ang + Math.PI/2)*34;
      const my = (a.y+b.y)/2 + Math.sin(ang + Math.PI/2)*34;
      if (mx > 20 && mx < W-20 && my > 40 && my < H-14) bakeSign(c, mx, my);
    }
  }
  // trees last (canopy overlaps props)
  for (let i = 0; i < 38; i++){
    const x = rng()*W, y = rng()*H;
    if (nearPath(x, y, 62)) continue;
    if (rng() < 0.3) bakePalm(c, x, y, 10 + rng()*8, th);
    else bakeTree(c, x, y, 11 + rng()*15, th, rng);
  }

  /* --- gates & checkpoint --- */
  const flames = [];
  for (const [gpi, pts] of level.paths.entries()){
    if ((level.waterPaths || []).includes(gpi)) continue;  // no torch gate standing in a river
    const a = pts[0], b = pts[1];
    const ang = Math.atan2(b.y-a.y, b.x-a.x);
    // pull the gate onto the visible map along the travel direction
    let gx = Math.max(14, Math.min(W-14, a.x)), gy = Math.max(14, Math.min(H-14, a.y));
    gx += Math.cos(ang)*16; gy += Math.sin(ang)*16;
    if (gy < 78) gy = 78; // keep torch tops on screen
    flames.push(...bakeGate(c, gx, gy, ang));
  }
  const endPts = level.paths[0];
  const e = endPts[endPts.length-1];
  const exit = bakeExit(c, e.x, e.y, W, H);

  /* --- grading --- */
  if (level.dusk){
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,140,60,0.10)'); g.addColorStop(1, 'rgba(40,20,60,0.16)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const vg = c.createRadialGradient(W/2, H/2, H*0.45, W/2, H/2, H*0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);

  return {cv, flames, exit};
}
