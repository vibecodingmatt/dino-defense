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

/* ---------- leg helper: thigh+shin as tapered strokes ---------- */
function leg(ctx, hipX, hipY, len, ph, color, w){
  const a1 = Math.sin(ph) * 0.55;               // thigh swing
  const kx = hipX + Math.sin(a1) * len * 0.55;
  const ky = hipY + Math.cos(a1) * len * 0.55;
  const a2 = a1 + 0.35 + Math.max(0, Math.sin(ph + 1.2)) * 0.5; // knee bend
  const fx = kx + Math.sin(a2) * len * 0.5;
  const fy = Math.min(0, ky + Math.cos(a2) * len * 0.5) ; // foot not below ground
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.lineWidth = w * 0.7; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  // foot
  ctx.lineWidth = w * 0.55; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + w*0.9, fy); ctx.stroke();
}

/* ---------- THEROPOD (raptors, rexes, most carnivores) ---------- */
function drawTheropod(ctx, d, ph){
  const p = d.pal, f = d.feat || {};
  const slim = f.slim ? 0.78 : 1;
  const big  = f.bigHead ? 1.25 : 1;
  const bob  = Math.abs(Math.sin(ph)) * 0.06;

  // hind legs (far leg darker, behind body)
  leg(ctx, -0.05, -0.62, 0.62, ph + Math.PI, shade(p.body, -0.35), 0.16*slim);

  ctx.save();
  ctx.translate(0, -bob);

  // tail — tapered curve behind hips
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.85);
  ctx.quadraticCurveTo(-0.85, -0.80 + Math.sin(ph*0.7)*0.05, -1.45, -0.62 + Math.sin(ph*0.5)*0.08);
  ctx.quadraticCurveTo(-0.80, -0.62, -0.15, -0.45);
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

  // neck + head
  const hx = 0.55, hy = -0.98 - (big-1)*0.1;
  ctx.fillStyle = p.body;
  ctx.beginPath();               // neck
  ctx.moveTo(0.28, -0.88); ctx.quadraticCurveTo(0.42, -1.0, hx, hy);
  ctx.lineTo(hx + 0.05, hy + 0.28); ctx.quadraticCurveTo(0.4, -0.65, 0.25, -0.55);
  ctx.closePath(); ctx.fill();

  const snout = f.longSnout ? 0.5 : 0.34;
  ctx.save();
  ctx.translate(hx, hy);
  const jawOpen = 0.06 + Math.max(0, Math.sin(ph*0.9)) * 0.05;
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
  // teeth glint
  ctx.fillStyle = '#f4f2e4';
  ctx.fillRect(0.08, 0.02, snout*big*0.72, 0.025);
  // eye
  ctx.fillStyle = '#1a1a12';
  ctx.beginPath(); ctx.arc(0.04, -0.08*big, 0.035, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = f.stripes && d.boss ? '#ffd24a' : '#e8e4c8';
  ctx.beginPath(); ctx.arc(0.045, -0.085*big, 0.015, 0, Math.PI*2); ctx.fill();
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

  // tiny arms (or huge claws for Therizinosaurus)
  ctx.strokeStyle = shade(p.body, -0.2); ctx.lineWidth = 0.07; ctx.lineCap = 'round';
  if (f.claws){
    ctx.beginPath(); ctx.moveTo(0.3, -0.72); ctx.lineTo(0.52, -0.5); ctx.stroke();
    ctx.strokeStyle = '#ddd8c0'; ctx.lineWidth = 0.035;
    for (let i = 0; i < 3; i++){
      ctx.beginPath(); ctx.moveTo(0.52, -0.5); ctx.lineTo(0.62 + i*0.03, -0.32 - i*0.04); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(0.3, -0.72); ctx.lineTo(0.4, -0.6); ctx.stroke();
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
  ctx.translate(0, -1.4); // flies above the ground point

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
  ctx.fillStyle = '#1a1a12';
  ctx.beginPath(); ctx.arc(0.47, -0.14, 0.03, 0, Math.PI*2); ctx.fill();

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

const PAINTERS = {theropod:drawTheropod, quad:drawQuad, sauropod:drawSauropod, flyer:drawFlyer};

/* Draws a full dinosaur at world position with flip/shadow/health handled by caller */
function drawDino(ctx, d, x, y, dir, ph, alpha){
  const s = d.size;
  // shadow (on the ground even for flyers)
  ctx.save();
  ctx.globalAlpha = 0.28 * alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, s * (d.flying ? 0.5 : 0.85), s * 0.22, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.scale(s, s);
  PAINTERS[d.painter](ctx, d, ph);
  ctx.restore();
}

/* ---------- TOWERS ---------- */
function drawTowerBase(ctx, x, y, color, selected){
  ctx.save();
  ctx.translate(x, y);
  // pad
  ctx.fillStyle = '#2b2f26';
  ctx.strokeStyle = selected ? '#ffd24a' : '#464b3e';
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // hazard ring
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawTowerTurret(ctx, t, flash){
  const def = TOWERS[t.key];
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  const c = def.color;
  ctx.lineCap = 'round';
  switch (t.key){
    case 'tranq':
      ctx.strokeStyle = '#5a6b4a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
      break;
    case 'gatling':
      ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(17, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(17, 3); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
      break;
    case 'sniper':
      ctx.strokeStyle = '#4a6b9a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(24, 0); ctx.stroke();
      ctx.fillStyle = '#33475e'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = c; ctx.fillRect(6, -2, 6, 4);
      break;
    case 'flamer':
      ctx.strokeStyle = '#a55a20'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
      ctx.fillStyle = '#c23b12'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI*2); ctx.fill();
      break;
    case 'tesla':
      ctx.strokeStyle = '#3d7a8a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -14); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -15, 5.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#22485a'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI*2); ctx.fill();
      break;
    case 'missile':
      ctx.fillStyle = '#5e4444'; ctx.fillRect(-6, -8, 18, 16);
      ctx.fillStyle = c;
      ctx.fillRect(2, -6, 12, 4.5); ctx.fillRect(2, 1.5, 12, 4.5);
      break;
    case 'cryo':
      ctx.strokeStyle = '#7ab6d8'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.fillStyle = '#3a6c8a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
      break;
    case 'sonic':
      ctx.fillStyle = '#4a3a5e'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 5, -1.1, 1.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 9, -0.9, 0.9); ctx.stroke();
      break;
  }
  if (flash > 0 && t.key !== 'sonic' && t.key !== 'tesla'){
    ctx.fillStyle = `rgba(255,220,120,${flash*3})`;
    ctx.beginPath(); ctx.arc(t.key === 'sniper' ? 24 : 16, 0, 5 + flash*20, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- LEVEL BACKGROUND (pre-rendered once per level) ---------- */
function renderBackground(level, W, H, pathPts){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const th = level.theme;

  // seeded-ish rng so the map looks the same every session
  let seed = 1234 + LEVELS.indexOf(level) * 999;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // grass base + mottling
  c.fillStyle = th.grass; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++){
    c.fillStyle = rng() < 0.5 ? th.grass2 : shade(th.grass, -0.12);
    c.globalAlpha = 0.35;
    const x = rng()*W, y = rng()*H, r = 12 + rng()*46;
    c.beginPath(); c.ellipse(x, y, r, r*0.6, rng()*3, 0, Math.PI*2); c.fill();
  }
  c.globalAlpha = 1;

  // water strip if themed
  if (th.water){
    c.fillStyle = th.water; c.globalAlpha = 0.85;
    c.beginPath(); c.ellipse(W*0.5, H + 40, W*0.42, 90, 0, 0, Math.PI*2); c.fill();
    c.globalAlpha = 1;
  }

  // dirt path (wide underlay + core)
  const drawPath = (pts, w, col) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    c.stroke();
  };
  for (const pts of level.paths){
    drawPath(pts, 46, th.pathEdge);
    drawPath(pts, 38, th.path);
  }
  // path speckle
  for (const pts of level.paths){
    c.fillStyle = shade(th.path, -0.2); c.globalAlpha = 0.5;
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i+1];
      const len = Math.hypot(b.x-a.x, b.y-a.y), n = Math.floor(len/26);
      for (let j = 0; j < n; j++){
        const t = j/n, x = a.x + (b.x-a.x)*t + (rng()-0.5)*22, y = a.y + (b.y-a.y)*t + (rng()-0.5)*22;
        c.beginPath(); c.arc(x, y, 1.5 + rng()*2, 0, Math.PI*2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  // trees (kept off the path)
  const nearPath = (x, y, dist) => level.paths.some(pts => {
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i+1];
      const dx = b.x-a.x, dy = b.y-a.y, L2 = dx*dx + dy*dy;
      const t = Math.max(0, Math.min(1, ((x-a.x)*dx + (y-a.y)*dy) / L2));
      if (Math.hypot(x - (a.x+dx*t), y - (a.y+dy*t)) < dist) return true;
    }
    return false;
  });
  for (let i = 0; i < 46; i++){
    const x = rng()*W, y = rng()*H;
    if (nearPath(x, y, 58)) continue;
    const r = 10 + rng()*16;
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(x+3, y+4, r, r*0.5, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = th.tree;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill();
    c.fillStyle = shade(th.tree, 0.25);
    c.beginPath(); c.arc(x - r*0.3, y - r*0.3, r*0.55, 0, Math.PI*2); c.fill();
  }

  // spawn gates + exit bunker
  for (const pts of level.paths){
    const s = pts[0];
    c.save();
    c.translate(Math.max(6, Math.min(W-6, s.x)), Math.max(6, Math.min(H-6, s.y)));
    c.fillStyle = '#3a3f35'; c.fillRect(-8, -30, 16, 60);
    c.fillStyle = '#e8b93a';
    for (let i = -24; i < 26; i += 12) c.fillRect(-8, i, 16, 6);
    c.restore();
  }
  const endPts = level.paths[0], e = endPts[endPts.length-1];
  const ex = Math.min(W - 34, e.x), ey = e.y;
  c.save(); c.translate(ex, ey);
  c.fillStyle = '#454c40'; c.fillRect(-26, -30, 56, 60);
  c.fillStyle = '#2c322a'; c.fillRect(-18, -20, 40, 40);
  c.fillStyle = '#e8b93a'; c.font = 'bold 21px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('⚠', 2, 1);
  c.restore();

  // dusk / night grading baked in lightly (runtime adds overlay too)
  if (level.dusk){
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,140,60,0.10)'); g.addColorStop(1, 'rgba(40,20,60,0.16)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  return cv;
}
