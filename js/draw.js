'use strict';
/* =========================================================
   DINO DEFENSE — procedural art
   All dinosaurs are drawn in code: side view, facing +x,
   origin at ground level under the hips. Caller translates,
   flips and scales. `ph` is a walk-cycle phase in radians.
   ========================================================= */

const shadeCache = new Map();
const BOSS_TOOTH_UPPER=[.78,1.18,.66,1.36,.88,1.12,.70,1.28,.82];
const BOSS_TOOTH_LOWER=[1.10,.72,1.28,.84,1.18,.68,1.34,.90];
const DREX_TOOTH_LOWER=[.082,.118,.071,.132,.092,.108];
const DREX_TOOTH_UPPER=[.096,.137,.078,.124,.105,.083];
const MOSA_TOOTH_UPPER=[.052,.078,.061,.088,.057,.073,.049];
const MOSA_TOOTH_LOWER=[.056,.081,.063,.074,.052,.086];
function shade(hex, f){ // lighten (f>0) / darken (f<0) a #rrggbb color
  const key = hex + ':' + f;
  if (shadeCache.has(key)) return shadeCache.get(key);
  // Menu dinosaurs already receive a muted rgb(...) palette. Accept both that
  // and the hex colors from DINOS so shading a color twice never collapses to
  // black because parseInt was handed the letters in "rgb".
  let r,g,b;
  if (/^#[0-9a-f]{6}$/i.test(hex)){
    const n=parseInt(hex.slice(1),16);r=(n>>16)&255;g=(n>>8)&255;b=n&255;
  } else {
    const m=String(hex).match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if(!m)return hex;
    r=+m[1];g=+m[2];b=+m[3];
  }
  if (f >= 0){ r += (255-r)*f; g += (255-g)*f; b += (255-b)*f; }
  else { r *= 1+f; g *= 1+f; b *= 1+f; }
  const out = `rgb(${r|0},${g|0},${b|0})`;
  shadeCache.set(key, out);
  return out;
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

/* ---------- back-contour helper ----------
   Point + outward normal on a rotated ellipse at parameter t (t≈π is the
   tail end of the back, t≈2π the head end). Back ornaments — spikes,
   plates, ridges, sails — are seated on this contour so they hug the
   body's curve and fan outward with it, instead of floating on a flat
   line above the back. */
function backEdge(cx, cy, rx, ry, rot, t){
  const ct = Math.cos(t), st = Math.sin(t), cr = Math.cos(rot), sr = Math.sin(rot);
  const x = cx + rx * ct * cr - ry * st * sr;
  const y = cy + rx * ct * sr + ry * st * cr;
  const nxu = ct / rx, nyu = st / ry;
  const nx = nxu * cr - nyu * sr, ny = nxu * sr + nyu * cr;
  const nl = Math.hypot(nx, ny) || 1;
  return {x, y, nx: nx / nl, ny: ny / nl};
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

  // body (contour shared by the back ornaments below)
  const brx = 0.52 * (f.slim ? 0.9 : 1);
  const bEdge = t => backEdge(0, -0.66, brx, 0.30, -0.12, t);
  ctx.beginPath();
  ctx.ellipse(0, -0.66, brx, 0.30, -0.12, 0, Math.PI*2);
  ctx.fill();
  // belly
  ctx.fillStyle = p.belly;
  ctx.beginPath();
  ctx.ellipse(0.02, -0.55, 0.42*(f.slim?0.9:1), 0.17, -0.10, 0, Math.PI*2);
  ctx.fill();

  // sail (Spinosaurus) — a low fin whose base rides the back's curve;
  // the crest rises mostly upward (a pure normal fan reads as a balloon)
  if (f.sail){
    ctx.fillStyle = shade(p.accent, -0.05);
    ctx.beginPath();
    const N = 9;
    for (let i = 0; i <= N; i++){
      const e = bEdge(Math.PI * (1.1 + (i / N) * 0.68));
      const h = Math.sin((i / N) * Math.PI) * 0.36;
      if (i === 0) ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.nx * h * 0.15, e.y - h);
    }
    for (let i = N; i >= 0; i--){ // seat the base just inside the body
      const e = bEdge(Math.PI * (1.1 + (i / N) * 0.68));
      ctx.lineTo(e.x - e.nx * 0.05, e.y - e.ny * 0.05);
    }
    ctx.closePath(); ctx.fill();
  }
  // back ridge / feathers — a row of small fins seated on the contour
  if (f.ridge || f.feathers){
    ctx.fillStyle = f.feathers ? shade(p.accent, 0.15) : shade(p.body, -0.25);
    for (let i = 0; i < 6; i++){
      const e = bEdge(Math.PI * (1.14 + i * 0.115));
      const w = 0.08, h = f.feathers ? 0.13 : 0.1;
      const tx = -e.ny, ty = e.nx;
      ctx.beginPath();
      ctx.moveTo(e.x - tx * w - e.nx * 0.03, e.y - ty * w - e.ny * 0.03);
      ctx.lineTo(e.x + e.nx * h - tx * w * 0.2, e.y + e.ny * h - ty * w * 0.2); // fins sweep back a touch
      ctx.lineTo(e.x + tx * w - e.nx * 0.03, e.y + ty * w - e.ny * 0.03);
      ctx.closePath(); ctx.fill();
    }
  }
  // spikes along back (Indominus / Stygimoloch) — same treatment, sharper
  if (f.spikes){
    ctx.fillStyle = shade(p.body, -0.3);
    for (let i = 0; i < 5; i++){
      const e = bEdge(Math.PI * (1.16 + i * 0.13));
      const w = 0.055, h = 0.13;
      const tx = -e.ny, ty = e.nx;
      ctx.beginPath();
      ctx.moveTo(e.x - tx * w - e.nx * 0.03, e.y - ty * w - e.ny * 0.03);
      ctx.lineTo(e.x + e.nx * h, e.y + e.ny * h);
      ctx.lineTo(e.x + tx * w - e.nx * 0.03, e.y + ty * w - e.ny * 0.03);
      ctx.closePath(); ctx.fill();
    }
  }
  // stripes — clipped to the body so they end exactly at the outline
  if (f.stripes){
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, -0.66, brx, 0.30, -0.12, 0, Math.PI*2); ctx.clip();
    ctx.strokeStyle = p.accent; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++){
      const x = -0.3 + i*0.2;
      ctx.beginPath(); ctx.moveTo(x, -1.0); ctx.quadraticCurveTo(x+0.05, -0.72, x, -0.5); ctx.stroke();
    }
    ctx.restore();
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

/* ---------- TYRANNOSAURUS REX ----------
   A dedicated, heavyweight silhouette: deep boxy skull, powerful S-neck,
   barrel ribs, massive thighs and a long counterbalancing tail. The shapes
   stay bold enough to read at game scale while giving the island's star
   predator a distinctly cinematic presence. */
function drawTrex(ctx, d, ph){
  const p = d.pal;
  const step = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
  const bob = Math.abs(step) * 0.045;
  const roar = (d.entranceT || 0) > 0 ? Math.min(1, Math.max(0, (2.2 - d.entranceT) * 2.5)) : 0;

  function rexLeg(hipX, hipY, phase, color, near){
    const sw = Math.sin(phase);
    const up = Math.max(0, Math.cos(phase));
    const kneeX = hipX + sw * 0.23;
    const kneeY = hipY + 0.34 - up * 0.08;
    const ankleX = kneeX - 0.10 + sw * 0.15;
    const ankleY = Math.min(-0.08, kneeY + 0.31 - up * 0.09);
    const footX = ankleX + 0.23 + sw * 0.035;
    const footY = -0.025 - up * 0.035;
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = near ? 0.235 : 0.205;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.lineWidth = near ? 0.145 : 0.125;
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(ankleX, ankleY); ctx.lineTo(footX, footY); ctx.stroke();
    // Three lean weight-bearing toes with dark hooked talons. Keep the fan
    // nearly level in side view so it reads as a grounded foot, not raised nubs.
    const toes = [
      {sx:-0.075, sy:-0.012, ex:0.185, ey:-0.006, w:0.038},
      {sx:-0.055, sy: 0.005, ex:0.145, ey: 0.022, w:0.034},
      {sx:-0.050, sy:-0.022, ex:0.115, ey:-0.040, w:0.030},
    ];
    for (const toe of toes){
      ctx.strokeStyle = color;
      ctx.lineWidth = toe.w * (near ? 1 : 0.88);
      ctx.beginPath();
      ctx.moveTo(footX + toe.sx, footY + toe.sy);
      ctx.quadraticCurveTo(footX + toe.ex * 0.56, footY + toe.ey * 0.35,
                           footX + toe.ex, footY + toe.ey);
      ctx.stroke();
      // Tapered keratin claw, slightly down-curved at the point.
      const tx = footX + toe.ex, ty = footY + toe.ey;
      ctx.fillStyle = '#29271f';
      ctx.beginPath();
      ctx.moveTo(tx - 0.030, ty - toe.w * 0.42);
      ctx.lineTo(tx + 0.090, ty + 0.010);
      ctx.lineTo(tx - 0.024, ty + toe.w * 0.42);
      ctx.closePath(); ctx.fill();
    }
  }

  // Far leg first, largely hidden by the enormous hip.
  rexLeg(-0.17, -0.63, ph + Math.PI, shade(p.body, -0.38), false);

  ctx.save();
  ctx.translate(0, -bob);

  // Long, thick counterbalance with a slight living sway.
  const tailSway = Math.sin(ph * 0.82) * 0.055;
  ctx.fillStyle = shade(p.body, -0.04);
  ctx.beginPath();
  ctx.moveTo(-0.26, -0.96);
  ctx.bezierCurveTo(-0.73, -0.98, -1.16, -0.83 + tailSway, -1.75, -0.73 + tailSway);
  ctx.quadraticCurveTo(-1.91, -0.68 + tailSway, -1.74, -0.62 + tailSway);
  ctx.bezierCurveTo(-1.15, -0.61 + tailSway, -0.70, -0.51, -0.22, -0.46);
  ctx.closePath(); ctx.fill();

  // Barrel chest and huge pelvic mass form the classic heavy rex profile.
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.56, -0.82);
  ctx.bezierCurveTo(-0.36, -1.12, 0.12, -1.12, 0.43, -0.92);
  ctx.bezierCurveTo(0.58, -0.77, 0.48, -0.47, 0.18, -0.38);
  ctx.bezierCurveTo(-0.15, -0.29, -0.53, -0.43, -0.62, -0.65);
  ctx.closePath(); ctx.fill();
  // Muted throat and belly, kept irregular rather than a clean cartoon oval.
  ctx.fillStyle = p.belly;
  ctx.beginPath();
  ctx.moveTo(-0.40, -0.54);
  ctx.bezierCurveTo(-0.06, -0.34, 0.31, -0.42, 0.43, -0.68);
  ctx.bezierCurveTo(0.27, -0.56, -0.08, -0.48, -0.40, -0.62);
  ctx.closePath(); ctx.fill();

  // Subtle mottling gives the hide depth without turning into visual noise.
  ctx.fillStyle = p.accent;
  ctx.globalAlpha *= 0.30;
  const mottles = [
    [-0.48,-0.83,.15,.055,-.2],[-0.18,-.96,.12,.045,.15],[.09,-.91,.13,.05,-.1],
    [-.77,-.78,.16,.04,.08],[-1.10,-.72,.12,.035,-.1],[-.12,-.67,.10,.045,.3],
    [.24,-.78,.09,.04,-.2]
  ];
  for (const m of mottles){
    ctx.beginPath(); ctx.ellipse(m[0],m[1],m[2],m[3],m[4],0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha /= 0.30;

  // Muscular rising neck: broad at the shoulder and tightly joined to the skull.
  const headBob = Math.sin(ph * 2 + 0.7) * 0.018;
  const hx = 0.67 - roar * 0.08, hy = -1.08 + headBob - roar * 0.17;
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(0.20, -0.96);
  ctx.bezierCurveTo(0.38, -1.14, 0.51, -1.25, hx + 0.06, hy - 0.04);
  ctx.lineTo(hx + 0.14, hy + 0.31);
  ctx.bezierCurveTo(0.57, -0.70, 0.44, -0.57, 0.28, -0.51);
  ctx.lineTo(0.12, -0.69); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(p.belly, -0.10);
  ctx.beginPath();
  ctx.moveTo(0.31,-0.66); ctx.bezierCurveTo(.49,-.75,.55,-.96,hx+.06,hy+.26);
  ctx.lineTo(hx+.15,hy+.31); ctx.bezierCurveTo(.58,-.71,.47,-.55,.28,-.49); ctx.closePath(); ctx.fill();

  // Skull and jaws rotate together during the entrance roar.
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-roar * 0.30);
  // Home-screen catches have their own readable mouth performance: open on
  // the lunge, snap shut at contact, then work the jaws while holding prey.
  let biteJaw = 0;
  if (d.eat){
    const et = d.eat.t;
    biteJaw = et < 0.18 ? (et / 0.18) * 0.46
            : et < 0.40 ? 0.46
            : et < 0.48 ? (1 - (et - 0.40) / 0.08) * 0.46
            : et < 2.10 ? 0.035 + Math.abs(Math.sin((et - 0.48) * 8.5)) * 0.075
            : et < 2.45 ? 0.10 + Math.sin((et - 2.10) * 9) * 0.035
            : et < 2.75 ? (1 - (et - 2.45) / 0.30) * 0.06 : 0;
  }
  const idleJaw = d.eat ? 0 : Math.max(0, Math.sin(ph * 0.72)) * 0.025;
  const jawOpen = 0.035 + idleJaw + roar * 0.31 + biteJaw;

  // Deep, broad upper skull with a squared muzzle instead of a generic wedge.
  ctx.fillStyle = p.body;
  ctx.beginPath();
  ctx.moveTo(-0.16,-0.23);
  ctx.bezierCurveTo(0.04,-0.32,0.31,-0.29,0.48,-0.19);
  ctx.lineTo(0.63,-0.11); ctx.lineTo(0.63,0.015);
  ctx.quadraticCurveTo(0.35,0.07,-0.11,0.09);
  ctx.lineTo(-0.22,-0.05); ctx.closePath(); ctx.fill();
  // Massive brow and cheek muscle.
  ctx.fillStyle = shade(p.body, -0.16);
  ctx.beginPath(); ctx.ellipse(0.01,-0.15,0.24,0.13,-0.05,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-0.07,0.035,0.17,0.15,0.12,0,Math.PI*2); ctx.fill();
  // Knobbly nasal ridge catches a highlight along the long skull.
  ctx.strokeStyle = shade(p.body, 0.14); ctx.lineWidth = 0.035; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.02,-0.245); ctx.quadraticCurveTo(.28,-.25,.53,-.15); ctx.stroke();

  // Deep lower jaw with a muscular hinge.
  ctx.save(); ctx.translate(-0.10, 0.06); ctx.rotate(jawOpen);
  ctx.fillStyle = shade(p.body, -0.20);
  ctx.beginPath();
  ctx.moveTo(0,0); ctx.quadraticCurveTo(.31,.025,.70,-.015);
  ctx.lineTo(.67,.11); ctx.quadraticCurveTo(.28,.18,-.07,.10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#341b18';
  ctx.beginPath(); ctx.moveTo(.04,.005); ctx.quadraticCurveTo(.34,.04,.65,.005);
  ctx.lineTo(.62,.055); ctx.quadraticCurveTo(.31,.085,.03,.055); ctx.closePath(); ctx.fill();
  // Lower teeth.
  ctx.fillStyle = '#e7dfc8';
  for (let i=0;i<5;i++){
    const x=.12+i*.105, h=.04+(i%2)*.018;
    ctx.beginPath(); ctx.moveTo(x-.022,.018); ctx.lineTo(x+.022,.014); ctx.lineTo(x,.014-h); ctx.fill();
  }
  ctx.restore();

  // Irregular, interlocking upper teeth.
  ctx.fillStyle = '#eee7d3';
  const teeth = [[.04,.075],[.15,.11],[.27,.085],[.39,.12],[.51,.08],[.59,.065]];
  for (const [x,h] of teeth){
    ctx.beginPath(); ctx.moveTo(x-.025,.035); ctx.lineTo(x+.025,.03); ctx.lineTo(x+.004,.03+h); ctx.fill();
  }
  // Recessed eye under the brow: small, watchful, and amber.
  ctx.fillStyle = '#17130e'; ctx.beginPath(); ctx.ellipse(-0.005,-0.165,.052,.039,-.1,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#c99a38'; ctx.beginPath(); ctx.arc(.005,-.17,.022,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#171008'; ctx.beginPath(); ctx.ellipse(.008,-.17,.007,.019,0,0,Math.PI*2); ctx.fill();
  // Nostril near the end of the broad muzzle.
  ctx.fillStyle = shade(p.body,-0.48); ctx.beginPath(); ctx.ellipse(.48,-.115,.032,.018,-.1,0,Math.PI*2); ctx.fill();
  // A few restrained scars add age and identity without copying a decal.
  ctx.strokeStyle = shade(p.body, 0.20); ctx.lineWidth=.014;
  ctx.beginPath(); ctx.moveTo(.12,-.11); ctx.lineTo(.18,-.06); ctx.moveTo(.15,-.13); ctx.lineTo(.21,-.08); ctx.stroke();
  ctx.restore();

  // Characteristically tiny two-finger arms, tucked high against the chest.
  const armSwing = Math.sin(ph + Math.PI) * 0.025;
  const rexArm = (dy, color, width) => {
    ctx.strokeStyle=color; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=width;
    ctx.beginPath(); ctx.moveTo(.34,-.78+dy); ctx.lineTo(.48+armSwing,-.67+dy); ctx.lineTo(.43+armSwing,-.57+dy); ctx.stroke();
    ctx.lineWidth=width*.38;
    ctx.beginPath(); ctx.moveTo(.43+armSwing,-.57+dy); ctx.lineTo(.50+armSwing,-.525+dy);
    ctx.moveTo(.43+armSwing,-.57+dy); ctx.lineTo(.47+armSwing,-.50+dy); ctx.stroke();
  };
  rexArm(-.025,shade(p.body,-.38),.052);
  rexArm(.02,shade(p.body,-.12),.064);
  ctx.restore();

  // Near leg last for depth.
  rexLeg(-0.08, -0.61, ph, shade(p.body, -0.10), true);
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

  // stego back plates — kite-shaped, seated on and fanning with the back's arc
  if (f.plates){
    const qEdge = t => backEdge(0, -0.62, 0.62, 0.34, 0, t);
    ctx.fillStyle = shade(p.accent, 0.05);
    for (let i = 0; i < 5; i++){
      const e = qEdge(Math.PI * (1.14 + i * 0.155));
      const h = 0.26 * Math.sin((i + 0.5) / 5 * Math.PI) + 0.1, w = 0.105;
      const tx = -e.ny, ty = e.nx;
      ctx.beginPath();
      ctx.moveTo(e.x - tx * w - e.nx * 0.04, e.y - ty * w - e.ny * 0.04);
      ctx.lineTo(e.x - tx * w * 0.55 + e.nx * h * 0.62, e.y - ty * w * 0.55 + e.ny * h * 0.62);
      ctx.lineTo(e.x + e.nx * h, e.y + e.ny * h);                 // plate tip
      ctx.lineTo(e.x + tx * w * 0.55 + e.nx * h * 0.62, e.y + ty * w * 0.55 + e.ny * h * 0.62);
      ctx.lineTo(e.x + tx * w - e.nx * 0.04, e.y + ty * w - e.ny * 0.04);
      ctx.closePath(); ctx.fill();
    }
  }
  // anky armor bumps — half-embedded along the back's curve
  if (f.armorBumps){
    const qEdge = t => backEdge(0, -0.62, 0.62, 0.34, 0, t);
    ctx.fillStyle = shade(p.body, -0.28);
    for (let i = 0; i < 6; i++){
      const e = qEdge(Math.PI * (1.16 + i * 0.135));
      ctx.beginPath(); ctx.arc(e.x - e.nx * 0.015, e.y - e.ny * 0.015, 0.062, 0, Math.PI*2); ctx.fill();
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

/* ---------- DISTORTUS REX ----------
   Six-limbed and mostly quadrupedal: an immense distended skull, translucent
   cranial sac, gorilla-long weight-bearing arms, grasping secondary arms,
   bloated rear legs and painful asymmetry. */
function drawDistortusRex(ctx, d, ph){
  const p=d.pal, pace=Math.sin(ph), heave=Math.abs(pace)*.035;
  const roar=(d.entranceT||0)>0?Math.min(1,Math.max(0,(3.4-d.entranceT)*1.55)):0;
  const skin=p.body, shadow=shade(skin,-.34), deep=shade(skin,-.52), light=shade(skin,.13), claw='#302c25';

  function hindLeg(x,phase,color,near){
    const sw=Math.sin(phase), up=Math.max(0,Math.cos(phase));
    const kx=x+sw*.16, ky=-.38-up*.035, ax=kx-.08+sw*.10, ay=-.10-up*.04;
    ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=near?.29:.25;
    ctx.beginPath();ctx.moveTo(x,-.68);ctx.lineTo(kx,ky);ctx.stroke();
    ctx.lineWidth=near?.18:.15;ctx.beginPath();ctx.moveTo(kx,ky);ctx.lineTo(ax,ay);ctx.stroke();
    for(const toe of [{x:.23,y:.015},{x:.18,y:.055},{x:.14,y:-.025}]){
      ctx.strokeStyle=color;ctx.lineWidth=near?.052:.044;ctx.beginPath();ctx.moveTo(ax-.03,ay);ctx.lineTo(ax+toe.x,ay+toe.y);ctx.stroke();
      ctx.fillStyle=claw;ctx.beginPath();ctx.moveTo(ax+toe.x-.025,ay+toe.y-.018);
      ctx.lineTo(ax+toe.x+.075,ay+toe.y+.006);ctx.lineTo(ax+toe.x-.022,ay+toe.y+.018);ctx.fill();
    }
  }
  function greatArm(sx,sy,phase,color,near){
    // Ape-like plant cycle: reach and lift during recovery, strike ahead of
    // the shoulder, then stay low while sweeping backward under body weight.
    const stride=Math.sin(phase), recovery=Math.max(0,Math.cos(phase));
    const load=Math.max(0,-Math.cos(phase));
    const ex=sx+.27+stride*.15, ey=sy+.32-recovery*.11+load*.04;
    const wx=sx+.45+stride*.31, wy=-.10-recovery*.23;
    const handRoll=-stride*.15+recovery*.22;
    ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=near?.25:.21;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
    ctx.lineWidth=near?.19:.16;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(wx,wy);ctx.stroke();
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(wx+.03,wy,.13,.075,handRoll,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){
      const fy=wy-.035+i*.035,len=.17-i*.018+recovery*.04;
      ctx.strokeStyle=color;ctx.lineWidth=near?.045:.038;ctx.beginPath();ctx.moveTo(wx+.04,fy);ctx.lineTo(wx+len,fy+.02);ctx.stroke();
      ctx.fillStyle=claw;ctx.beginPath();ctx.moveTo(wx+len-.018,fy);ctx.lineTo(wx+len+.07,fy+.025);ctx.lineTo(wx+len-.02,fy+.034);ctx.fill();
    }
    if(load>.45){
      ctx.fillStyle='rgba(55,45,32,'+(.18*load)+')';
      ctx.beginPath();ctx.ellipse(wx+.04,.005,.20+.04*load,.035,0,0,Math.PI*2);ctx.fill();
    }
  }
  function smallArm(sx,sy,phase,color){
    const curl=Math.sin(phase)*.035,ex=sx+.23+curl,ey=sy+.15,hx=sx+.42+curl,hy=sy+.06;
    ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=.115;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.lineTo(hx,hy);ctx.stroke();
    ctx.strokeStyle=claw;ctx.lineWidth=.028;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx+.17,hy-.060+i*.055);ctx.stroke();}
  }

  // Far limbs establish the low, six-limbed stance.
  hindLeg(-.35,ph+Math.PI,deep,false);
  greatArm(.23,-.88,ph+Math.PI,deep,false);
  smallArm(.36,-.72,ph+1.2,deep);
  ctx.save();ctx.translate(0,-heave);

  // Low tail and a bloated, shoulder-heavy body.
  ctx.fillStyle=shadow;ctx.beginPath();ctx.moveTo(-.38,-.84);
  ctx.bezierCurveTo(-.88,-.86,-1.35,-.63,-1.82,-.38+Math.sin(ph*.6)*.04);
  ctx.quadraticCurveTo(-1.96,-.28,-1.78,-.22);ctx.bezierCurveTo(-1.18,-.34,-.72,-.38,-.30,-.43);ctx.fill();
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(-.58,-.61);
  ctx.bezierCurveTo(-.54,-1.02,-.20,-1.18,.12,-1.13);
  ctx.bezierCurveTo(.42,-1.20,.67,-1.02,.70,-.76);
  ctx.bezierCurveTo(.73,-.48,.38,-.35,.04,-.34);
  ctx.bezierCurveTo(-.33,-.30,-.61,-.39,-.58,-.61);ctx.fill();
  ctx.fillStyle=p.belly;ctx.beginPath();ctx.moveTo(-.40,-.50);
  ctx.bezierCurveTo(-.10,-.30,.35,-.36,.57,-.56);
  ctx.bezierCurveTo(.27,-.47,-.08,-.48,-.40,-.59);ctx.fill();

  // Uneven fatty knots under taut hide.
  ctx.fillStyle=shadow;
  const knots=[[-.40,-.84,.17,.13],[-.18,-1.02,.15,.11],[.08,-1.06,.18,.13],[.34,-.96,.14,.12],[-.31,-.56,.13,.10],[.25,-.55,.12,.09]];
  for(const [x,y,rx,ry] of knots){ctx.beginPath();ctx.ellipse(x,y,rx,ry,-.15,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle=shade(skin,.18);ctx.lineWidth=.022;ctx.globalAlpha*=.48;
  for(const [x,y,rx] of knots){ctx.beginPath();ctx.arc(x-.02,y-.025,rx*.55,Math.PI*1.05,Math.PI*1.7);ctx.stroke();}
  ctx.globalAlpha/=.48;

  // Compressed neck props up a head that looks almost too heavy to carry.
  const hx=.69-roar*.05,hy=-.92-roar*.12+Math.sin(ph*1.7)*.015;
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(.24,-1.08);
  ctx.bezierCurveTo(.47,-1.22,.67,-1.18,hx+.10,hy-.05);
  ctx.lineTo(hx+.16,hy+.35);ctx.bezierCurveTo(.56,-.62,.40,-.55,.20,-.61);ctx.fill();
  ctx.fillStyle=shade(p.belly,-.08);ctx.beginPath();ctx.moveTo(.38,-.65);
  ctx.bezierCurveTo(.57,-.72,.64,-.86,hx+.10,hy+.26);
  ctx.lineTo(hx+.18,hy+.35);ctx.bezierCurveTo(.58,-.61,.44,-.54,.31,-.58);ctx.fill();

  ctx.save();ctx.translate(hx,hy);ctx.rotate(-roar*.15);
  let bite=0;
  if(d.eat){const t=d.eat.t;bite=t<.18?t/.18*.48:t<.40?.48:t<.48?(1-(t-.40)/.08)*.48:t<2.1?.04+Math.abs(Math.sin((t-.48)*8.2))*.08:t<2.45?.11:0;}
  const jaw=.055+(d.eat?0:Math.max(0,Math.sin(ph*.65))*.025)+roar*.38+bite;

  // One continuous blunt cranial mass — forehead, skull and muzzle are fused,
  // never a separate sail. Its bulk runs backward into the shoulders.
  const dome=ctx.createRadialGradient(.12,-.34,.04,.05,-.29,.62);
  dome.addColorStop(0,shade(skin,.12));dome.addColorStop(.56,skin);dome.addColorStop(1,shadow);
  ctx.fillStyle=dome;ctx.beginPath();ctx.moveTo(-.50,.04);
  ctx.bezierCurveTo(-.56,-.18,-.38,-.41,-.09,-.47);
  ctx.bezierCurveTo(.25,-.52,.54,-.39,.61,-.20);
  ctx.bezierCurveTo(.66,-.08,.60,.04,.53,.09);
  ctx.quadraticCurveTo(.15,.17,-.29,.13);ctx.closePath();ctx.fill();
  // Broad facial pad turns the swollen dome sharply down into a short muzzle.
  ctx.fillStyle=shade(skin,-.12);ctx.beginPath();
  ctx.moveTo(.19,-.31);ctx.bezierCurveTo(.43,-.35,.62,-.24,.64,-.10);
  ctx.lineTo(.61,.075);ctx.quadraticCurveTo(.40,.12,.17,.095);
  ctx.bezierCurveTo(.08,-.04,.08,-.19,.19,-.31);ctx.fill();
  // Layered skin folds radiate backward from the overloaded face.
  ctx.strokeStyle=shade(skin,-.23);ctx.lineWidth=.022;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(.18,-.29);ctx.quadraticCurveTo(-.04,-.36,-.25,-.30);
  ctx.moveTo(.13,-.20);ctx.quadraticCurveTo(-.08,-.24,-.30,-.16);
  ctx.moveTo(.12,-.10);ctx.quadraticCurveTo(-.10,-.09,-.31,.01);
  ctx.moveTo(.33,-.38);ctx.quadraticCurveTo(.12,-.49,-.11,-.48);ctx.stroke();

  // Deep lower jaw, shortened to match the blunt face.
  ctx.save();ctx.translate(-.12,.075);ctx.rotate(jaw);
  ctx.fillStyle=deep;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(.32,.055,.73,-.01);
  ctx.lineTo(.69,.18);ctx.quadraticCurveTo(.28,.28,-.08,.16);ctx.fill();
  ctx.fillStyle='#351b19';ctx.beginPath();ctx.moveTo(.045,.025);ctx.quadraticCurveTo(.34,.08,.67,.025);
  ctx.lineTo(.62,.115);ctx.quadraticCurveTo(.30,.17,.03,.10);ctx.fill();
  ctx.fillStyle='#e7dfca';
  for(let i=0;i<6;i++){const x=.08+i*.105,h=DREX_TOOTH_LOWER[i],lean=((i%3)-1)*.012;ctx.beginPath();ctx.moveTo(x-.027,.038);ctx.lineTo(x+.026,.029);ctx.quadraticCurveTo(x+lean+.006,.03-h*.62,x+lean,.03-h);ctx.closePath();ctx.fill();}
  ctx.restore();
  ctx.fillStyle='#eee7d2';
  for(let i=0;i<6;i++){const x=.02+i*.095,h=DREX_TOOTH_UPPER[i],lean=((i%3)-1)*.014;ctx.beginPath();ctx.moveTo(x-.028,.065);ctx.lineTo(x+.027,.058);ctx.quadraticCurveTo(x+lean+.006,.06+h*.64,x+lean,.06+h);ctx.closePath();ctx.fill();}
  // Eye is pushed forward beside the muzzle, ringed by a bruised black socket.
  ctx.fillStyle='#211b17';ctx.beginPath();ctx.ellipse(.31,-.205,.085,.064,-.15,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d2a638';ctx.beginPath();ctx.arc(.32,-.21,.022,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#130b08';ctx.beginPath();ctx.ellipse(.324,-.21,.007,.019,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=deep;ctx.beginPath();ctx.ellipse(.54,-.115,.032,.018,-.1,0,Math.PI*2);ctx.fill();
  ctx.restore();

  smallArm(.43,-.74,ph+.5,light);
  ctx.restore();
  greatArm(.31,-.89,ph,light,true);
  hindLeg(-.27,ph,shade(skin,-.08),true);
}

/* Reference-led Distortus: a three-quarter presentation preserves the film
   creature's unmistakable upright hunch, broad face and six-limbed anatomy in
   a game otherwise drawn in side profile. */
function drawDistortusRef(ctx,d,ph){
  const p=d.pal, skin=p.body, dark=shade(skin,-.30), deep=shade(skin,-.50);
  const light=shade(skin,.13), nail='#29251e';
  const step=Math.sin(ph), plant=Math.max(0,Math.cos(ph));
  const bob=Math.abs(step)*.035;
  const roar=(d.entranceT||0)>0?Math.min(1,Math.max(0,(3.4-d.entranceT)*1.55)):0;

  function rearLeg(x,phase,color,near){
    const sw=Math.sin(phase),lift=Math.max(0,Math.cos(phase));
    const kx=x+sw*.14,ky=-.34-lift*.04,ax=kx-.05+sw*.08,ay=-.08-lift*.035;
    ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=near?.29:.25;
    ctx.beginPath();ctx.moveTo(x,-.68);ctx.lineTo(kx,ky);ctx.stroke();
    ctx.lineWidth=near?.18:.15;ctx.beginPath();ctx.moveTo(kx,ky);ctx.lineTo(ax,ay);ctx.stroke();
    for(const toe of [{x:.23,y:.012},{x:.18,y:.052},{x:.14,y:-.028}]){
      ctx.strokeStyle=color;ctx.lineWidth=near?.052:.044;ctx.beginPath();ctx.moveTo(ax-.02,ay);ctx.lineTo(ax+toe.x,ay+toe.y);ctx.stroke();
      ctx.fillStyle=nail;ctx.beginPath();ctx.moveTo(ax+toe.x-.02,ay+toe.y-.018);
      ctx.lineTo(ax+toe.x+.085,ay+toe.y+.005);ctx.lineTo(ax+toe.x-.018,ay+toe.y+.018);ctx.fill();
    }
  }
  function pillarArm(sx,sy,phase,color,near){
    const sw=Math.sin(phase)*.075;
    const ex=sx+.27+sw,ey=sy+.38,wx=sx+.48+sw*.6,wy=-.105;
    ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=near?.25:.21;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
    ctx.lineWidth=near?.17:.145;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(wx,wy);ctx.stroke();
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(wx+.025,wy,.13,.075,.05,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){
      const fy=wy-.035+i*.038,len=.18-i*.018;
      ctx.strokeStyle=color;ctx.lineWidth=near?.044:.037;ctx.beginPath();ctx.moveTo(wx+.03,fy);ctx.lineTo(wx+len,fy+.015);ctx.stroke();
      ctx.fillStyle=nail;ctx.beginPath();ctx.moveTo(wx+len-.015,fy-.012);
      ctx.quadraticCurveTo(wx+len+.095,fy+.005,wx+len+.075,fy+.055);
      ctx.lineTo(wx+len-.02,fy+.022);ctx.fill();
    }
  }
  function graspArm(sx,sy,phase,color,near){
    const curl=Math.sin(phase)*.03,ex=sx+.17+curl,ey=sy+.12,hx=sx+.30+curl,hy=sy+.055;
    ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=near?.09:.075;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.lineTo(hx,hy);ctx.stroke();
    for(let i=0;i<3;i++){ctx.strokeStyle=nail;ctx.lineWidth=.023;ctx.beginPath();ctx.moveTo(hx,hy);ctx.quadraticCurveTo(hx+.12,hy-.055+i*.045,hx+.09,hy+.01+i*.035);ctx.stroke();}
  }

  // Far half of all three limb pairs.
  rearLeg(-.34,ph+Math.PI,deep,false);
  pillarArm(.05,-1.00,ph+Math.PI,deep,false);
  graspArm(.20,-.89,ph+1.4,deep,false);
  ctx.save();ctx.translate(0,-bob);

  // Short heavy tail and towering arched back.
  ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-.45,-.83);
  ctx.bezierCurveTo(-.78,-.75,-1.06,-.55,-1.35,-.35+Math.sin(ph*.55)*.035);
  ctx.quadraticCurveTo(-1.47,-.25,-1.32,-.22);
  ctx.bezierCurveTo(-.96,-.30,-.66,-.38,-.36,-.44);ctx.fill();
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(-.57,-.58);
  ctx.bezierCurveTo(-.60,-1.02,-.30,-1.40,.06,-1.43);
  ctx.bezierCurveTo(.42,-1.46,.65,-1.18,.62,-.81);
  ctx.bezierCurveTo(.62,-.47,.34,-.29,-.02,-.31);
  ctx.bezierCurveTo(-.38,-.29,-.60,-.39,-.57,-.58);ctx.fill();
  // Ribbed lower flank and oversized rear thigh.
  ctx.fillStyle=p.belly;ctx.beginPath();ctx.moveTo(-.42,-.59);
  ctx.bezierCurveTo(-.18,-.36,.28,-.36,.50,-.62);
  ctx.bezierCurveTo(.20,-.52,-.10,-.53,-.42,-.67);ctx.fill();
  ctx.fillStyle=shade(skin,-.08);ctx.beginPath();ctx.ellipse(-.31,-.57,.31,.36,-.14,0,Math.PI*2);ctx.fill();

  // Broken ridge and mottled hide follow the arch, not a decorative sail.
  ctx.fillStyle=dark;
  for(const [x,y,r] of [[-.40,-1.05,.12],[-.24,-1.25,.13],[-.06,-1.34,.14],[.13,-1.32,.12],[.30,-1.20,.10],[.43,-1.04,.09]]){
    ctx.beginPath();ctx.ellipse(x,y,r,r*.63,-.18,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle=p.accent;ctx.globalAlpha*=.24;
  for(const [x,y,rx,ry] of [[-.41,-.80,.15,.05],[-.17,-.97,.17,.055],[.10,-1.10,.16,.05],[.29,-.86,.13,.05],[-.13,-.56,.12,.045]]){
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,-.15,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha/=.24;

  // Almost no neck: the massive head hangs directly from the shoulder arch.
  const hx=.39-roar*.03,hy=-1.22-roar*.10+Math.sin(ph*1.5)*.012;
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(.02,-1.36);
  ctx.bezierCurveTo(.25,-1.49,.48,-1.42,hx+.19,hy-.02);
  ctx.lineTo(hx+.13,hy+.45);ctx.bezierCurveTo(.43,-.75,.27,-.66,.08,-.70);ctx.fill();
  ctx.save();ctx.translate(hx,hy);ctx.rotate(-roar*.11);

  let bite=0;
  if(d.eat){const t=d.eat.t;bite=t<.18?t/.18*.46:t<.40?.46:t<.48?(1-(t-.40)/.08)*.46:t<2.1?.04+Math.abs(Math.sin((t-.48)*8.2))*.075:t<2.45?.10:0;}
  const jaw=.085+(d.eat?0:Math.max(0,Math.sin(ph*.62))*.025)+roar*.34+bite;

  // Broad three-quarter cranium: bulbous crown, pinched temples, almost no snout.
  const skull=ctx.createRadialGradient(-.12,-.24,.03,-.05,-.20,.64);
  skull.addColorStop(0,light);skull.addColorStop(.58,skin);skull.addColorStop(1,dark);
  ctx.fillStyle=skull;ctx.beginPath();ctx.moveTo(-.42,.10);
  ctx.bezierCurveTo(-.52,-.18,-.39,-.48,-.15,-.60);
  ctx.bezierCurveTo(.12,-.70,.43,-.54,.54,-.29);
  ctx.bezierCurveTo(.64,-.06,.52,.15,.23,.20);
  ctx.quadraticCurveTo(-.14,.26,-.42,.10);ctx.fill();
  // Short blunt muzzle nested under the dome.
  ctx.fillStyle=shade(skin,-.16);ctx.beginPath();ctx.moveTo(.05,-.20);
  ctx.bezierCurveTo(.31,-.28,.55,-.18,.59,-.03);
  ctx.lineTo(.56,.115);ctx.quadraticCurveTo(.28,.17,.00,.105);
  ctx.quadraticCurveTo(-.08,-.06,.05,-.20);ctx.fill();
  // Brow furrows sweep backward across the giant forehead.
  ctx.strokeStyle=shade(skin,-.25);ctx.lineWidth=.021;ctx.lineCap='round';ctx.beginPath();
  ctx.moveTo(.10,-.31);ctx.quadraticCurveTo(-.12,-.41,-.34,-.32);
  ctx.moveTo(.05,-.20);ctx.quadraticCurveTo(-.16,-.26,-.39,-.14);
  ctx.moveTo(.02,-.10);ctx.quadraticCurveTo(-.18,-.11,-.40,.01);ctx.stroke();
  // Heavy asymmetric brow and cheek planes stop the crown reading as a ball.
  ctx.fillStyle=shade(skin,-.27);ctx.beginPath();
  ctx.moveTo(-.12,-.29);ctx.quadraticCurveTo(.16,-.39,.38,-.26);
  ctx.lineTo(.31,-.14);ctx.quadraticCurveTo(.09,-.23,-.14,-.17);ctx.fill();
  ctx.fillStyle=shade(skin,-.16);ctx.beginPath();ctx.ellipse(.04,-.015,.20,.15,-.12,0,Math.PI*2);ctx.fill();

  // Deep compact jaw opens beneath rather than projecting like a crocodile.
  ctx.save();ctx.translate(-.01,.09);ctx.rotate(jaw);
  ctx.fillStyle=deep;ctx.beginPath();ctx.moveTo(0,0);
  ctx.quadraticCurveTo(.27,.055,.57,-.005);ctx.lineTo(.53,.19);
  ctx.quadraticCurveTo(.22,.28,-.07,.15);ctx.fill();
  ctx.fillStyle='#351b18';ctx.beginPath();ctx.moveTo(.04,.025);
  ctx.quadraticCurveTo(.28,.085,.52,.025);ctx.lineTo(.47,.12);
  ctx.quadraticCurveTo(.23,.17,.025,.095);ctx.fill();
  ctx.fillStyle='#e8dfc6';
  for(let i=0;i<5;i++){const x=.07+i*.095,h=.05+i%2*.025;ctx.beginPath();ctx.moveTo(x-.02,.035);ctx.lineTo(x+.02,.03);ctx.lineTo(x,.03-h);ctx.fill();}
  ctx.restore();
  ctx.fillStyle='#eee6cf';
  for(let i=0;i<5;i++){const x=.07+i*.095,h=.06+i%2*.03;ctx.beginPath();ctx.moveTo(x-.022,.07);ctx.lineTo(x+.022,.065);ctx.lineTo(x,.065+h);ctx.fill();}
  // Two eyes make the frontal breadth legible; near socket remains dominant.
  ctx.fillStyle='#211916';ctx.beginPath();ctx.ellipse(.20,-.225,.074,.055,-.1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d4a536';ctx.beginPath();ctx.arc(.21,-.23,.019,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#120b08';ctx.beginPath();ctx.ellipse(.214,-.23,.006,.017,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha*=.62;ctx.fillStyle='#211916';ctx.beginPath();ctx.ellipse(-.06,-.235,.050,.038,.1,0,Math.PI*2);ctx.fill();ctx.globalAlpha/=.62;
  ctx.fillStyle=deep;ctx.beginPath();ctx.ellipse(.50,-.08,.030,.017,0,0,Math.PI*2);ctx.fill();
  ctx.restore();

  // Near small arm remains tucked under the face; the great arm is a pillar.
  graspArm(.36,-.91,ph+.35,light,true);
  ctx.restore();
  pillarArm(.18,-1.02,ph,light,true);
  rearLeg(-.20,ph,shade(skin,-.08),true);
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
  if (f.ridge){                               // spine ridge fins riding the hump's curve
    ctx.fillStyle = shade(p.body, -0.3);
    for (let i = 0; i < 4; i++){
      const e = backEdge(0, -0.12, 0.52, 0.21, -0.05, Math.PI * (1.22 + i * 0.16));
      const w = 0.05, h = 0.12, tx = -e.ny, ty = e.nx;
      ctx.beginPath();
      ctx.moveTo(e.x - tx * w - e.nx * 0.02, e.y - ty * w - e.ny * 0.02);
      ctx.lineTo(e.x + e.nx * h - tx * w * 0.4, e.y + e.ny * h - ty * w * 0.4); // fins rake backward
      ctx.lineTo(e.x + tx * w - e.nx * 0.02, e.y + ty * w - e.ny * 0.02);
      ctx.closePath(); ctx.fill();
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
    ctx.fillStyle = '#f4f2e4';                 // irregular interlocking fangs
    for (let i = 0; i < 7; i++){
      const tx=0.045+i*.058*big,w=.012+(i%3)*.002,lean=((i%3)-1)*.007;
      ctx.beginPath();ctx.moveTo(tx-w,.012);ctx.lineTo(tx+w,.014);
      ctx.quadraticCurveTo(tx+lean+.004,.014+MOSA_TOOTH_UPPER[i]*.62,tx+lean,.014+MOSA_TOOTH_UPPER[i]);ctx.closePath();ctx.fill();
    }
    for(let i=0;i<6;i++){
      const tx=.075+i*.064*big,w=.012+(i%2)*.002,root=.047+jawOpen,lean=((i%3)-1)*.006;
      ctx.beginPath();ctx.moveTo(tx-w,root+.004);ctx.lineTo(tx+w,root);
      ctx.quadraticCurveTo(tx+lean+.003,root-MOSA_TOOTH_LOWER[i]*.62,tx+lean,root-MOSA_TOOTH_LOWER[i]);ctx.closePath();ctx.fill();
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

/* ---------- FILM BOSS SILHOUETTES ----------
   These bosses deliberately do not share the everyday theropod body. Their
   profiles carry the screen-recognition work: posture, skull, arms and the
   markings audiences remember. */
function bossFoot(ctx,x,y,s,flip,clawColor){
  const dir=flip?-1:1,foot=Math.max(.13,s*.7);
  // A low fleshy foot carries the weight; toes spread along the ground instead
  // of radiating upward from a single rake-like point.
  ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.ellipse(x+dir*foot*.28,y-.018,foot*.48,Math.max(.025,s*.11),0,0,Math.PI*2);ctx.fill();
  const toes=[{dx:1,dy:0},{dx:.83,dy:-.035},{dx:.72,dy:.03}];
  ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(.025,s*.13);ctx.lineCap='round';
  for(const t of toes){const bx=x+dir*foot*.22,by=y-.018+t.dy;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(x+dir*foot*t.dx,by);ctx.stroke();
    ctx.fillStyle=clawColor||'#51483b';ctx.beginPath();ctx.moveTo(x+dir*foot*(t.dx-.08),by-.022);ctx.lineTo(x+dir*foot*(t.dx+.18),by+.004);ctx.lineTo(x+dir*foot*(t.dx-.06),by+.022);ctx.closePath();ctx.fill();}
}
function filmBossLeg(ctx,x,ph,c,w,raptor,plainFoot){
  const sw=Math.sin(ph),lift=Math.max(0,Math.cos(ph))*.13;
  const kx=x+sw*.16,ky=-.35-lift,fx=x+.14+sw*.24,fy=-lift*.15;
  ctx.strokeStyle=c;ctx.lineCap='round';ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,-.68);ctx.lineTo(kx,ky);ctx.stroke();
  ctx.lineWidth=w*.62;ctx.beginPath();ctx.moveTo(kx,ky);ctx.lineTo(fx,fy);ctx.stroke();bossFoot(ctx,fx,fy,w*2.2,false,plainFoot?c:null);
  if(raptor){ctx.strokeStyle='#51483b';ctx.lineWidth=.032;ctx.beginPath();ctx.moveTo(fx+.015,fy-.045);ctx.quadraticCurveTo(fx-.015,fy-.14,fx+.075,fy-.12);ctx.quadraticCurveTo(fx+.11,fy-.11,fx+.07,fy-.075);ctx.stroke();}
}
function bossArm(ctx,x,y,ph,c,longArm){
  const sw=Math.sin(ph)*.06,ex=x+(longArm?.26:.16)+sw,ey=y+(longArm?.25:.14),hx=ex+(longArm?.21:.12),hy=ey+(longArm?.16:.08);
  ctx.strokeStyle=c;ctx.lineCap='round';ctx.lineWidth=longArm?.085:.06;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.lineTo(hx,hy);ctx.stroke();
  ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(hx,hy,.065,.045,.25,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#4b443a';ctx.lineWidth=.018;for(let i=0;i<3;i++){const sy=hy-.025+i*.028,ex2=hx+.065+i*.010,ey2=sy+.018;ctx.beginPath();ctx.moveTo(hx+.025,sy);ctx.quadraticCurveTo(ex2,sy,ex2,ey2);ctx.quadraticCurveTo(ex2+.018,ey2+.012,ex2+.010,ey2+.034);ctx.stroke();}
}
function bossTeeth(ctx,x0,x1,open,kind){
  // Crooked, interlocking fangs rooted in the actual sloping jaw edges. Fixed
  // patterns keep the silhouette lively without random frame-to-frame flicker.
  const spino=kind==='spino',small=kind==='blue'||kind==='indoraptor';
  const n=spino?9:small?6:7;
  ctx.fillStyle='#eee7d3';
  for(let i=0;i<n;i++){
    const q=(i+.48)/n,x=x0+(x1-x0)*q;
    const root=.050-.035*q,w=(spino?.012:.016)+(i%3)*.002;
    const h=(spino?.072:small?.078:.092)*BOSS_TOOTH_UPPER[i],lean=((i%3)-1)*(spino?.006:.010);
    ctx.beginPath();ctx.moveTo(x-w,root-.006);ctx.lineTo(x+w,root-.002);
    ctx.quadraticCurveTo(x+lean+w*.25,root+h*.64,x+lean,root+h);ctx.closePath();ctx.fill();
  }
  ctx.fillStyle='#e4decc';
  for(let i=0;i<n-1;i++){
    const q=(i+1.02)/n,x=x0+(x1-x0)*q;
    const root=.088+(open-.050)*q,w=(spino?.011:.014)+(i%2)*.002;
    const h=(spino?.058:small?.064:.076)*BOSS_TOOTH_LOWER[i],lean=((i%3)-1)*(spino?.005:.008);
    ctx.beginPath();ctx.moveTo(x-w,root+.005);ctx.lineTo(x+w,root+.002);
    ctx.quadraticCurveTo(x+lean+w*.2,root-h*.66,x+lean,root-h);ctx.closePath();ctx.fill();
  }
}
function bossBiteOpen(d,ph,roar,maxOpen){
  if(d.eat){const t=d.eat.t;
    if(t<.18)return .055+(maxOpen-.055)*(t/.18);
    if(t<.40)return maxOpen;
    if(t<.50)return maxOpen*(1-(t-.40)/.10)+.045*((t-.40)/.10);
    if(t<2.25)return .095+Math.max(0,Math.sin(t*12))*.035;
    return .035;
  }
  return .055+Math.max(0,Math.sin(ph*.8))*.035+roar*.22;
}
function drawFilmBoss(ctx,d,ph,kind){
  const p=d.pal,raptor=kind==='blue'||kind==='indoraptor',spino=kind==='spino',indo=kind==='indominus',giga=kind==='giga';
  const roar=(d.entranceT||0)>0?Math.min(1,(2.5-d.entranceT)*2.3):0;
  const bob=Math.abs(Math.sin(ph))*.035,slim=raptor?.75:1;
  // Species-specific depth: the near-black separation belongs on the black
  // Indoraptor, while lighter hides keep their far limbs visibly connected.
  const farDepth=kind==='indoraptor'?-.38:spino?0:indo?-.12:giga?-.25:kind==='blue'?-.22:-.20;
  const ridgeDepth=kind==='indoraptor'?-.35:indo?-.14:-.25;
  const jawDepth=kind==='indoraptor'?-.22:spino?0:indo?-.10:-.18;
  filmBossLeg(ctx,-.18,ph+Math.PI,shade(p.body,farDepth),raptor?.105:.18,raptor,spino);
  ctx.save();ctx.translate(0,-bob);
  // Long counterbalancing tail and deep, shoulder-heavy torso.
  ctx.fillStyle=p.body;ctx.beginPath();ctx.moveTo(-.18,-.82);ctx.quadraticCurveTo(-.85,-.84,-1.60,-.60+Math.sin(ph*.8)*.08);ctx.quadraticCurveTo(-.92,-.58,-.18,-.48);ctx.closePath();ctx.fill();
  const backY=raptor?-.96:giga?-1.18:spino?-1.04:-1.10;
  const chestX=giga?.78:spino?.73:raptor?.61:.70,bellyY=raptor?-.50:giga?-.35:-.40;
  const bossBack=t=>{
    const u=1-t;
    const x=u*u*u*-.28+3*u*u*t*.02+3*u*t*t*.46+t*t*t*chestX;
    const y=u*u*u*-.87+3*u*u*t*backY+3*u*t*t*(backY+.02)+t*t*t*-.76;
    const dx=3*u*u*(.02-(-.28))+6*u*t*(.46-.02)+3*t*t*(chestX-.46);
    const dy=3*u*u*(backY-(-.87))+6*u*t*((backY+.02)-backY)+3*t*t*(-.76-(backY+.02));
    const dl=Math.hypot(dx,dy)||1;
    return{x,y,tx:dx/dl,ty:dy/dl,nx:dy/dl,ny:-dx/dl};
  };
  ctx.beginPath();ctx.moveTo(-.28,-.87);ctx.bezierCurveTo(.02,backY,.46,backY+.02,chestX,-.76);ctx.bezierCurveTo(.50,bellyY,.02,bellyY-.01,-.32,-.51);ctx.closePath();ctx.fill();
  ctx.fillStyle=p.belly;ctx.globalAlpha=.52;ctx.beginPath();ctx.ellipse(.12,raptor?-.57:-.52,.42*slim,raptor?.11:.14,-.08,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // JP3 Spinosaurus: a tall, narrow sail whose base follows the exact torso
  // contour. The base is tucked into the hide and every rib fans from its
  // local back angle, so the sail wraps around the animal instead of reading
  // as a flat triangle pasted behind it.
  if(spino&&!d.hideSail){
    const N=10,t0=.015,t1=.70,sail=[];
    for(let i=0;i<=N;i++){
      const q=i/N,e=bossBack(t0+(t1-t0)*q);
      const h=.025+Math.pow(Math.sin(q*Math.PI),.72)*.61;
      sail.push({e,h,q});
    }
    ctx.fillStyle=shade(p.accent,-.18);ctx.beginPath();
    for(let i=0;i<=N;i++){
      const {e,h}=sail[i],ox=e.x+e.nx*h,oy=e.y+e.ny*h;
      if(i===0)ctx.moveTo(ox,oy);else ctx.lineTo(ox,oy);
    }
    for(let i=N;i>=0;i--){const e=sail[i].e;ctx.lineTo(e.x-e.nx*.035,e.y-e.ny*.035);}
    ctx.closePath();ctx.fill();
    ctx.strokeStyle=shade(p.accent,.22);ctx.lineWidth=.026;ctx.lineCap='round';
    for(let i=1;i<N;i+=2){const {e,h}=sail[i];ctx.beginPath();ctx.moveTo(e.x-e.nx*.018,e.y-e.ny*.018);ctx.lineTo(e.x+e.nx*h*.96,e.y+e.ny*h*.96);ctx.stroke();}
  }
  // Hybrid/Giga dorsal scutes create the broken, armored skyline.
  if(indo||giga||kind==='indoraptor'){
    ctx.fillStyle=shade(p.body,ridgeDepth);const count=indo?8:6;
    for(let i=0;i<count;i++){
      const q=i/(count-1),t=.04+q*.78,u=1-t;
      // Sample the exact cubic used by the torso above. Its derivative supplies
      // a tangent, so every base bends with the hide instead of hovering on an
      // unrelated ridge. Sink the base into the silhouette to hide any seam.
      const x=u*u*u*-.28+3*u*u*t*.02+3*u*t*t*.46+t*t*t*chestX;
      const y=u*u*u*-.87+3*u*u*t*backY+3*u*t*t*(backY+.02)+t*t*t*-.76;
      const dx=3*u*u*(.02-(-.28))+6*u*t*(.46-.02)+3*t*t*(chestX-.46);
      const dy=3*u*u*(backY-(-.87))+6*u*t*((backY+.02)-backY)+3*t*t*(-.76-(backY+.02));
      const dl=Math.hypot(dx,dy)||1,tx=dx/dl,ty=dy/dl,nx=ty,ny=-tx;
      const half=.047,inset=.025;
      const h=(indo?.09:.055)+Math.sin(q*Math.PI)*.075*(i%2?.72:1);
      ctx.beginPath();
      ctx.moveTo(x-tx*half-nx*inset,y-ty*half-ny*inset);
      ctx.lineTo(x+nx*h-tx*.012,y+ny*h-ty*.012);
      ctx.lineTo(x+tx*half-nx*inset,y+ty*half-ny*inset);
      ctx.closePath();ctx.fill();
    }
  }
  // Film markings: Blue's bordered eye-to-tail slash; Indoraptor's gold flank streak.
  if(kind==='blue'){
    const tailTipY=-.60+Math.sin(ph*.8)*.08;
    ctx.globalAlpha=.82;ctx.lineCap='round';
    // Tail and torso are separate contour sections. The tail marking follows
    // the same animated control point as the tail itself; torso sections arc
    // over the ribcage and shoulder instead of bridging them with a ruler.
    for(const pass of [{c:'#aaa99f',w:.098},{c:p.accent,w:.052}]){
      ctx.strokeStyle=pass.c;ctx.lineWidth=pass.w;
      ctx.beginPath();ctx.moveTo(-1.40,tailTipY-.015);ctx.quadraticCurveTo(-.88,-.76,-.38,-.75);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-.34,-.76);ctx.bezierCurveTo(-.10,-.84,.18,-.87,.38,-.91);ctx.stroke();
      ctx.beginPath();ctx.moveTo(.40,-.92);ctx.quadraticCurveTo(.52,-.97,.60,-.99);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  if(kind==='indoraptor'){ctx.globalAlpha=.52;ctx.strokeStyle=p.accent;ctx.lineWidth=.038;for(const seg of [[-1.25,-.72,-.82,-.76],[-.66,-.77,-.28,-.80],[-.10,-.82,.30,-.91]]){ctx.beginPath();ctx.moveTo(seg[0],seg[1]);ctx.quadraticCurveTo((seg[0]+seg[2])*.5,seg[1]-.025,seg[2],seg[3]);ctx.stroke();}ctx.globalAlpha=1;}
  // Muscular neck leading to deliberately different skull families.
  const hx=raptor?.57:.52,hy=(spino?-1.04:raptor?-1.02:-1.08)-roar*.12;
  ctx.fillStyle=p.body;ctx.beginPath();ctx.moveTo(.28,-.94);ctx.quadraticCurveTo(.48,-1.15,hx,hy);ctx.lineTo(hx+.14,hy+.32);ctx.quadraticCurveTo(.42,-.60,.25,-.52);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(hx,hy);ctx.rotate(-roar*.28);
  const sn=spino?.70:raptor?.42:giga?.58:indo?.55:.50,open=bossBiteOpen(d,ph,roar,spino?.30:raptor?.25:.29);
  ctx.fillStyle=p.body;ctx.beginPath();
  if(spino){ctx.moveTo(-.08,-.13);ctx.quadraticCurveTo(.22,-.20,sn,-.09);ctx.lineTo(sn+.06,-.015);ctx.lineTo(.16,.045);ctx.lineTo(-.10,.10);}
  else {ctx.moveTo(-.10,-.18);ctx.quadraticCurveTo(.18,-.27,sn,-.13);ctx.lineTo(sn+.04,-.01);ctx.lineTo(.20,.055);ctx.lineTo(-.12,.10);}
  ctx.closePath();ctx.fill();
  // Brow horns and rugged cheek architecture.
  if(indo||giga){ctx.fillStyle=shade(p.body,indo?-.12:-.28);ctx.beginPath();ctx.moveTo(.05,-.19);ctx.lineTo(.12,-.34);ctx.lineTo(.20,-.18);ctx.closePath();ctx.fill();ctx.beginPath();ctx.ellipse(.12,.02,.20,.13,-.15,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle=spino?p.body:shade(p.body,jawDepth);ctx.beginPath();ctx.moveTo(-.08,.055);ctx.lineTo(sn,open+.025);ctx.lineTo(sn-.02,open+.080);ctx.lineTo(-.10,.125);ctx.closePath();ctx.fill();bossTeeth(ctx,.06,sn-.02,open,kind);
  ctx.fillStyle=kind==='indoraptor'?'#d42f24':indo?'#b14832':'#d2b04f';ctx.beginPath();ctx.ellipse(.22,-.115,.032,.022,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#110d0a';ctx.beginPath();ctx.ellipse(.226,-.115,.008,.019,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
  bossArm(ctx,.33,-.82,ph+.5,spino?p.body:shade(p.body,-.1),spino||indo||raptor);
  if(spino)bossArm(ctx,.24,-.78,ph+Math.PI,p.body,true);
  ctx.restore();filmBossLeg(ctx,.10,ph,p.body,raptor?.12:.20,raptor,spino);
}
function drawBlue(ctx,d,ph){drawFilmBoss(ctx,d,ph,'blue');}
function drawSpinosaurus(ctx,d,ph){drawFilmBoss(ctx,d,ph,'spino');}
function drawIndominus(ctx,d,ph){drawFilmBoss(ctx,d,ph,'indominus');}
function drawIndoraptor(ctx,d,ph){drawFilmBoss(ctx,d,ph,'indoraptor');}
function drawGiganotosaurus(ctx,d,ph){drawFilmBoss(ctx,d,ph,'giga');}

function drawWhitePteranodon(ctx,d,ph){
  const p=d.pal,flap=Math.sin(ph*2);ctx.save();ctx.translate(0,-1.42+Math.sin(ph)*.06);
  // Mirrored wings: each has its own shoulder, long leading finger and taut
  // membrane. The old version accidentally stacked both wings on the left.
  for(let side=-1;side<=1;side+=2){ctx.save();ctx.scale(side,1);if(side<0)ctx.globalAlpha=.72;ctx.fillStyle=side>0?p.body:shade(p.body,-.18);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(.44,-.34-flap*.44);ctx.lineTo(1.38,-.54-flap*.78);ctx.lineTo(1.04,.04);ctx.lineTo(.42,.20);ctx.closePath();ctx.fill();ctx.strokeStyle=shade(p.body,-.34);ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(1.38,-.54-flap*.78);ctx.moveTo(.28,-.08);ctx.lineTo(1.04,.04);ctx.stroke();ctx.restore();}
  ctx.fillStyle=p.body;ctx.beginPath();ctx.ellipse(.04,0,.40,.16,-.08,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=p.body;ctx.lineWidth=.12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(.30,-.08);ctx.lineTo(.48,-.22);ctx.stroke();ctx.beginPath();ctx.ellipse(.56,-.25,.17,.105,-.08,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=p.accent;ctx.beginPath();ctx.moveTo(.51,-.33);ctx.lineTo(-.08,-.52);ctx.lineTo(.58,-.20);ctx.closePath();ctx.fill();
  const open=bossBiteOpen(d,ph,0,.25);ctx.fillStyle=p.body;ctx.beginPath();ctx.moveTo(.58,-.31);ctx.lineTo(1.15,-.23);ctx.lineTo(.59,-.18);ctx.closePath();ctx.fill();ctx.fillStyle=shade(p.body,-.18);ctx.beginPath();ctx.moveTo(.58,-.20);ctx.lineTo(1.10,-.20+open);ctx.lineTo(.60,-.13);ctx.closePath();ctx.fill();
  ctx.fillStyle='#a92521';ctx.beginPath();ctx.arc(.60,-.28,.024,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=shade(p.body,-.35);ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(-.10,.10);ctx.lineTo(-.18,.28);ctx.moveTo(.10,.10);ctx.lineTo(.16,.28);ctx.stroke();ctx.restore();
}
function drawMosasaurusBoss(ctx,d,ph){
  // The aquatic renderer already supplies the water interaction; scaling the
  // head and adding the deep dorsal mass makes the boss read at card size too.
  ctx.save();ctx.scale(1.16,1.16);drawAquatic(ctx,d,ph);ctx.restore();
  ctx.fillStyle=shade(d.pal.body,-.32);for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-.36+i*.15,-.35);ctx.lineTo(-.30+i*.15,-.47-Math.sin(i/4*Math.PI)*.06);ctx.lineTo(-.22+i*.15,-.34);ctx.closePath();ctx.fill();}
}

const PAINTERS = {theropod:drawTheropod, trex:drawTrex, blue:drawBlue, spino:drawSpinosaurus, indominus:drawIndominus, indoraptor:drawIndoraptor, giga:drawGiganotosaurus, whiteptera:drawWhitePteranodon, mosasaurus:drawMosasaurusBoss, quad:drawQuad, sauropod:drawSauropod, flyer:drawFlyer, mutant:drawDistortusRex, omega:drawOmegaRex, aquatic:drawAquatic};

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

/* ---------- human leg ----------
   Proper plantigrade running anatomy — unlike the dinosaurs' bird-legged
   leg() helper: the thigh swings from the hip, the knee leads, the shin
   trails and folds during recovery, the heel kicks up behind after
   push-off — and there's an actual shoe on the end. Thigh and shin take
   separate colours so shorts/pants/bare legs all read correctly. */
function humanLeg(ctx, hipX, hipY, len, ph, thighC, shinC, w, shoeC){
  const swing = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
  const a1 = swing * 0.72;                       // thigh angle from vertical
  // knee folds hard during the lift, extends again reaching for the ground
  const flex = 0.2 + lift * 1.3 * (1 - Math.max(0, swing) * 0.45);
  const a2 = a1 - flex;                          // shin trails the thigh
  const kx = hipX + Math.sin(a1) * len * 0.52, ky = hipY + Math.cos(a1) * len * 0.52;
  const fx = kx + Math.sin(a2) * len * 0.5;
  const fy = Math.min(-0.02, ky + Math.cos(a2) * len * 0.5);
  ctx.lineCap = 'round';
  ctx.strokeStyle = thighC; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.strokeStyle = shinC; ctx.lineWidth = w * 0.78;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  // the shoe — toe forward, tipping with the stride
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(Math.max(-0.85, Math.min(0.35, a2 * 0.45)));
  ctx.fillStyle = shoeC;
  ctx.beginPath(); ctx.ellipse(0.05, -0.005, 0.088, 0.044, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';      // sole highlight
  ctx.beginPath(); ctx.ellipse(0.05, 0.022, 0.082, 0.014, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ---------- TOURISTS ----------
   The park's last visitors, sprinting for the exit ahead of wave 1.
   Same conventions as the dinosaurs: unit space, facing +x, origin at
   ground level under the hips, `ph` is the sprint-cycle phase. Everyone
   is assembled from the same parts, but build, skin, outfit, hair, hat,
   accessories — and above all HOW they panic — vary per visitor. */

/* one two-segment arm. `u.arms` picks the panic pose; i=0 is the far arm
   (drawn behind the body, darker), i=1 the near arm (drawn in front). */
function tArm(ctx, u, ph, i){
  const t = u.tall, bw = u.build;
  const sx = 0.02, sy = -1.27 * t, lu = 0.28, lf = 0.26;
  const sleeve = i ? u.shirt : shade(u.shirt, -0.28);
  const skin = i ? u.skin : shade(u.skin, -0.2);
  let a1, a2, ex, ey, hx, hy;
  const wob = Math.sin(ph * 2.2 + i * 2.6);
  if (u.arms === 'flail'){                    // both hands high, waving wildly
    a1 = -1.95 - i * 0.18 + wob * 0.3;
    ex = sx + Math.cos(a1) * lu; ey = sy + Math.sin(a1) * lu;
    a2 = a1 + 0.18 + Math.sin(ph * 2.2 + 1.2 + i * 2.6) * 0.5;
    hx = ex + Math.cos(a2) * lf; hy = ey + Math.sin(a2) * lf;
  } else if (u.arms === 'clutch' && u.shock){ // the Home-Alone: hands clasped to the cheeks
    a1 = -2.2 + i * 0.3 + wob * 0.04;
    ex = sx + Math.cos(a1) * lu; ey = sy + Math.sin(a1) * lu;
    hx = 0.06 + (i ? 0.15 : -0.17); hy = -1.45 * t;
  } else if (u.arms === 'clutch'){            // hands clamped on top of the head
    a1 = -2.45 + i * 0.12 + wob * 0.05;
    ex = sx + Math.cos(a1) * lu * 1.05; ey = sy + Math.sin(a1) * lu * 1.05;
    hx = i * 0.1 - 0.03; hy = -1.58 * t - 0.16;
  } else if (u.arms === 'hathold' && i === 1){ // one hand pinning the hat down
    ex = sx + 0.18; ey = sy - 0.18;
    hx = 0.16; hy = -1.58 * t - 0.13;
  } else if (u.arms === 'camera'){            // filming the disaster, of course
    ex = sx + 0.14; ey = sy + 0.16 - i * 0.03;
    hx = 0.27; hy = -1.04 * t - i * 0.035;
  } else if (u.arms === 'canhold' && i === 1){ // near arm cradles the can up at the chest
    ex = sx + 0.15; ey = sy + 0.16;
    hx = 0.24; hy = -1.04 * t;
  } else if (u.arms === 'cane' && i === 1){    // near arm grips the cane, planted ahead
    ex = sx + 0.2; ey = sy + 0.32;
    hx = 0.34; hy = -0.6 * t;
  } else if (u.arms === 'cane'){               // far arm swings gently at a stroll
    a1 = 1.4 + Math.sin(ph * 0.6) * 0.22;
    ex = sx + Math.cos(a1) * lu; ey = sy + Math.sin(a1) * lu;
    a2 = a1 + 0.2;
    hx = ex + Math.cos(a2) * lf; hy = ey + Math.sin(a2) * lf;
  } else {                                    // pump — proper sprinter arms
    a1 = 1.35 + Math.sin(ph + Math.PI * i) * 0.8;
    ex = sx + Math.cos(a1) * lu; ey = sy + Math.sin(a1) * lu;
    a2 = a1 - 2.05 + Math.sin(ph + Math.PI * i) * 0.15; // folded tight, hands by the ribs
    hx = ex + Math.cos(a2) * lf * 0.9; hy = ey + Math.sin(a2) * lf * 0.9;
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = sleeve; ctx.lineWidth = 0.1 * bw;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = skin; ctx.lineWidth = 0.08 * bw; // bare forearm (short sleeves)
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(hx, hy, 0.055, 0, Math.PI * 2); ctx.fill();

  // props held in the near hand
  if (i === 1 && u.holdItem === 'barbasol'){   // the infamous "shaving cream" can
    ctx.save();
    ctx.translate(hx, hy - 0.02);
    ctx.fillStyle = '#f3f1ea'; ctx.fillRect(-0.045, -0.03, 0.09, 0.15);   // white body
    ctx.fillStyle = '#c23b2e'; ctx.fillRect(-0.045, 0.02, 0.09, 0.06);    // red label band
    ctx.fillStyle = '#3a5f9e'; ctx.fillRect(-0.045, 0.083, 0.09, 0.018);  // blue pin-stripe
    ctx.fillStyle = '#dd5142'; ctx.fillRect(-0.05, -0.06, 0.1, 0.035);    // red cap
    ctx.fillStyle = '#cfcfc6'; ctx.fillRect(-0.013, -0.085, 0.026, 0.03); // nozzle
    ctx.restore();
    ctx.fillStyle = skin;                        // fingers curled back over the can
    ctx.beginPath(); ctx.arc(hx + 0.03, hy, 0.03, 0, Math.PI * 2); ctx.fill();
  }
  if (i === 1 && u.cane){                        // amber-topped walking cane to the ground
    ctx.strokeStyle = '#6b4a2a'; ctx.lineCap = 'round'; ctx.lineWidth = 0.032;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 0.07, -0.02); ctx.stroke();
    ctx.fillStyle = '#d99a2b';                   // the mosquito-in-amber knob
    ctx.beginPath(); ctx.arc(hx, hy - 0.035, 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,226,140,0.65)';
    ctx.beginPath(); ctx.arc(hx - 0.015, hy - 0.05, 0.016, 0, Math.PI * 2); ctx.fill();
  }
}

/* head + hair + face + hat, shared by every tourist pose. `look` flips
   the face backward mid-glance. When `u.shock` is set, the face swaps to
   huge quivering cartoon saucer eyes (springing out over u.shockT). */
function touristHead(ctx, u, ph, headX, headY, look){
  const skin = u.skin, headR = 0.17 * (u.kid ? 1.25 : 1);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(headX, headY, headR, 0, Math.PI * 2); ctx.fill();

  // hair (under the hat)
  ctx.fillStyle = u.hairC;
  const hs = u.hairStyle;
  if (hs === 'short'){
    ctx.beginPath(); ctx.arc(headX - 0.01, headY - 0.03, headR * 1.02, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  } else if (hs === 'bob'){
    ctx.beginPath(); ctx.arc(headX - 0.02, headY - 0.03, headR * 1.05, Math.PI * 0.88, Math.PI * 2.04); ctx.fill();
    ctx.beginPath(); ctx.ellipse(headX - headR * 0.92, headY + 0.04, 0.05, 0.1, 0.15, 0, Math.PI * 2); ctx.fill();
  } else if (hs === 'pony'){
    ctx.beginPath(); ctx.arc(headX - 0.01, headY - 0.02, headR * 1.02, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
    const fl = Math.sin(ph * 1.7) * 0.07;    // tail whips with the sprint
    ctx.strokeStyle = u.hairC; ctx.lineCap = 'round'; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(headX - headR * 0.8, headY - 0.02);
    ctx.quadraticCurveTo(headX - headR - 0.12, headY + 0.14 + fl, headX - headR - 0.22, headY + 0.3 - fl);
    ctx.stroke();
  } else if (hs === 'long'){
    ctx.beginPath(); ctx.arc(headX - 0.02, headY - 0.02, headR * 1.08, Math.PI * 0.8, Math.PI * 2.1); ctx.fill();
    ctx.strokeStyle = u.hairC; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++){             // streaming behind, below the hat line
      const fl = Math.sin(ph * 1.6 + k * 1.9) * 0.05;
      ctx.lineWidth = 0.05 - k * 0.008;
      ctx.beginPath(); ctx.moveTo(headX - headR * 0.8, headY + 0.02 + k * 0.06);
      ctx.quadraticCurveTo(headX - headR - 0.13, headY + 0.08 + k * 0.07 + fl,
                           headX - headR - 0.28 - k * 0.05, headY + 0.16 + k * 0.09 - fl);
      ctx.stroke();
    }
  } else if (hs === 'bun'){
    ctx.beginPath(); ctx.arc(headX - 0.01, headY - 0.03, headR * 1.02, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.beginPath(); ctx.arc(headX - headR * 0.9, headY - headR * 0.55, 0.075, 0, Math.PI * 2); ctx.fill();
  } else if (hs === 'curls'){
    for (let k = 0; k < 4; k++){
      ctx.beginPath(); ctx.arc(headX - 0.12 + k * 0.075, headY - headR * 0.82 + Math.abs(k - 1.5) * 0.02, 0.055, 0, Math.PI * 2); ctx.fill();
    }
  } else if (hs === 'pig'){                  // kid pigtails, airborne
    ctx.strokeStyle = u.hairC; ctx.lineCap = 'round'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.arc(headX - 0.01, headY - 0.03, headR * 0.95, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    for (let k = 0; k < 2; k++){
      const fl = Math.sin(ph * 1.8 + k * 2.4) * 0.06;
      ctx.beginPath(); ctx.moveTo(headX - headR * (0.5 + k * 0.4), headY - headR * (0.8 - k * 0.5));
      ctx.quadraticCurveTo(headX - headR - 0.1 - k * 0.04, headY - headR * (0.9 - k * 0.6) + fl,
                           headX - headR - 0.2, headY - headR * (0.5 - k * 0.55) + fl * 1.5);
      ctx.stroke();
    }
  } else if (hs === 'bald'){                 // just a dignified fringe (formerly)
    ctx.beginPath(); ctx.ellipse(headX - headR * 0.82, headY + 0.05, 0.045, 0.075, 0.2, 0, Math.PI * 2); ctx.fill();
  }

  if (u.shock){
    // THE MOMENT OF REALISATION: two enormous saucer eyes spring out of
    // the head (slightly mismatched sizes — terror is never symmetrical),
    // quivering, with pinprick pupils and a tiny frozen 'o' of a mouth
    const pop = Math.min(1, (u.shockT || 0) * 7);
    const quiver = Math.sin((u.shockT || 0) * 30) * 0.008;
    for (const [dx, rr] of [[0.02, 0.105], [0.17, 0.085]]){
      const er = rr * pop + quiver;
      if (er <= 0.001) continue;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(headX + dx * look, headY - 0.04, er, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#16161c'; ctx.lineWidth = 0.016;
      ctx.stroke();
      ctx.fillStyle = '#16161c';
      ctx.beginPath(); ctx.arc(headX + dx * look + 0.015 * look, headY - 0.04, 0.02 * pop, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#5a1f18';
    ctx.beginPath(); ctx.arc(headX + 0.1 * look, headY + 0.1, 0.028 + quiver, 0, Math.PI * 2); ctx.fill();
  } else {
    // face — flips backward mid-glance
    const ex = headX + 0.08 * look, ey = headY - 0.02;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, 0.052, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(ex + 0.018 * look, ey, 0.024, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(skin, -0.42); ctx.lineWidth = 0.022; // eyebrow, shot straight up
    ctx.beginPath();
    ctx.moveTo(ex - 0.045 * look, ey - 0.07);
    ctx.quadraticCurveTo(ex, ey - 0.105, ex + 0.05 * look, ey - 0.085);
    ctx.stroke();
    if (u.glasses){
      ctx.fillStyle = '#1e1e26';
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.065, 0.045, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1e1e26'; ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.moveTo(ex - 0.06 * look, ey); ctx.lineTo(headX - headR * 0.9 * look, ey - 0.01); ctx.stroke();
    }
    ctx.fillStyle = '#5a1f18'; // the scream
    ctx.beginPath();
    ctx.ellipse(headX + 0.12 * look, headY + 0.075, 0.04, 0.05 + Math.max(0, Math.sin(ph * 2.1)) * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
    if (u.mustache){ // a certain programmer's bushy upper lip
      ctx.fillStyle = shade(u.hairC, -0.1);
      ctx.beginPath(); ctx.ellipse(headX + 0.1 * look, headY + 0.04, 0.055, 0.024, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // a full beard hugging the jaw (drawn over the mouth, eyes left clear)
  if (u.beard){
    ctx.fillStyle = u.hairC;
    ctx.beginPath();
    ctx.moveTo(headX - headR * 0.86, headY - 0.01);
    ctx.quadraticCurveTo(headX - headR * 0.5, headY + headR * 1.55, headX + 0.03, headY + headR * 1.42);
    ctx.quadraticCurveTo(headX + headR * 0.95, headY + headR * 1.15, headX + headR * 1.04, headY - 0.03);
    ctx.quadraticCurveTo(headX + headR * 0.55, headY + headR * 0.55, headX, headY + headR * 0.6);
    ctx.quadraticCurveTo(headX - headR * 0.55, headY + headR * 0.55, headX - headR * 0.86, headY - 0.01);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(headX + 0.09, headY + 0.035, 0.06, 0.026, 0, 0, Math.PI * 2); ctx.fill(); // moustache
  }

  // hat (over the hair; gone if the wind took it)
  if (u.hat && !u.hatLost){
    const hc = u.hatC;
    ctx.fillStyle = hc;
    if (u.hat === 'cap'){
      ctx.beginPath(); ctx.arc(headX, headY - 0.05, headR * 1.04, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(headX, headY - 0.085, headR + 0.13, 0.05);
      ctx.fillStyle = shade(hc, -0.25);
      ctx.beginPath(); ctx.arc(headX, headY - headR - 0.05, 0.024, 0, Math.PI * 2); ctx.fill();
    } else if (u.hat === 'sun'){
      ctx.beginPath(); ctx.arc(headX, headY - 0.08, headR * 0.95, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(headX, headY - 0.1, headR + 0.07, 0.04, -0.05, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shade(hc, -0.35); ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(headX - headR * 0.85, headY - 0.13); ctx.lineTo(headX + headR * 0.85, headY - 0.13); ctx.stroke();
    } else if (u.hat === 'safari'){
      ctx.beginPath(); ctx.ellipse(headX, headY - 0.06, headR + 0.1, 0.045, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(headX, headY - 0.07, headR * 0.88, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(hc, -0.4);
      ctx.fillRect(headX - headR * 0.88, headY - 0.125, headR * 1.76, 0.045);
    } else if (u.hat === 'panama'){ // light straw hat, low crown + dark band
      ctx.beginPath(); ctx.ellipse(headX, headY - 0.075, headR + 0.12, 0.05, 0, 0, Math.PI * 2); ctx.fill(); // brim
      ctx.beginPath(); ctx.arc(headX, headY - 0.06, headR * 0.86, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); // crown
      ctx.fillStyle = 'rgba(92,72,44,0.75)';
      ctx.fillRect(headX - headR * 0.86, headY - 0.095, headR * 1.72, 0.028); // hatband
    } else { // visor
      ctx.fillRect(headX - headR * 0.55, headY - headR * 0.8, headR * 0.55 + 0.13, 0.05);
    }
  }
}

function touristBody(ctx, u, ph){
  const t = u.tall, bw = u.build, skin = u.skin;
  const hipY = -0.78 * t, shY = -1.3 * t;
  const headX = 0.06, headY = -1.58 * t, headR = 0.17 * (u.kid ? 1.25 : 1);
  const look = u.lookT > 0 ? -1 : 1;          // terrified glance over the shoulder
  ctx.save();
  ctx.rotate(u.lean + Math.sin(ph) * 0.02);   // sprint lean + stride rock
  ctx.translate(0, -Math.abs(Math.sin(ph)) * 0.06);

  tArm(ctx, u, ph, 0);                        // far arm behind everything
  // legs — human sprint cycle with shoes; shorts cover the thigh,
  // pants cover everything, skirts show leg
  const thC = u.bottomType === 'skirt' ? skin : u.bottom;
  const shC = u.bottomType === 'pants' ? u.bottom : skin;
  const shoe = u.shoeC || '#2e2e34';
  humanLeg(ctx, -0.02, hipY, -hipY, ph + Math.PI, shade(thC, -0.3), shade(shC, -0.3), 0.135 * bw, shade(shoe, -0.3));
  humanLeg(ctx, 0.02, hipY, -hipY, ph, thC, shC, 0.15 * bw, shoe);

  // bottoms over the hips
  if (u.bottomType === 'skirt'){
    const fl = Math.sin(ph * 2) * 0.05;       // hem flutters with the stride
    ctx.fillStyle = u.bottom;
    ctx.beginPath();
    ctx.moveTo(-0.17 * bw, hipY - 0.08);
    ctx.lineTo(0.17 * bw, hipY - 0.08);
    ctx.lineTo(0.24 * bw + fl * 0.4, hipY + 0.3);
    ctx.lineTo(-0.28 * bw - fl, hipY + 0.3 + fl);
    ctx.closePath(); ctx.fill();
  } else if (u.bottomType === 'shorts'){
    ctx.fillStyle = u.bottom;
    ctx.beginPath(); ctx.ellipse(0, hipY + 0.05, 0.19 * bw, 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }

  // neck, then torso (slimmer than it is tall — people, not eggs)
  ctx.fillStyle = skin;
  ctx.fillRect(headX - 0.05, headY + headR * 0.55, 0.1, 0.16);
  ctx.fillStyle = u.shirt;
  ctx.beginPath();
  ctx.ellipse(0, (hipY + shY) / 2, 0.17 * bw, (hipY - shY) / 2 + 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  if (u.belly){
    ctx.fillStyle = shade(u.shirt, -0.07);
    ctx.beginPath(); ctx.ellipse(0.09 * bw, hipY - 0.14, 0.12 * bw, 0.15, 0.2, 0, Math.PI * 2); ctx.fill();
  }
  if (u.floral){ // the loudest vacation shirt on the island
    ctx.fillStyle = shade(u.shirt, 0.5);
    for (let i = 0; i < 6; i++){
      const fx = (-0.13 + (i % 3) * 0.12) * bw, fy = shY + 0.1 + ((i * 7) % 5) * 0.09;
      ctx.beginPath(); ctx.arc(fx, fy, 0.03, 0, Math.PI * 2); ctx.fill();
    }
  }

  // luggage
  if (u.pack === 'backpack'){
    const pb = Math.abs(Math.sin(ph)) * 0.04; // bounces against the spine
    ctx.fillStyle = u.packC;
    ctx.beginPath(); ctx.ellipse(-0.24 * bw, -1.02 * t + pb, 0.13, 0.22, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(u.packC, -0.3); ctx.lineWidth = 0.045;
    ctx.beginPath(); ctx.moveTo(-0.04, shY - 0.04); ctx.lineTo(-0.2 * bw, -1.12 * t + pb); ctx.stroke();
  } else if (u.pack === 'fanny'){
    ctx.fillStyle = u.packC;
    ctx.beginPath(); ctx.ellipse(0.17 * bw, hipY - 0.02, 0.1, 0.075, -0.2, 0, Math.PI * 2); ctx.fill();
  }

  // camera bouncing on its neck strap (unless it's up filming)
  if (u.camera && u.arms !== 'camera'){
    const cx = 0.17 + Math.sin(ph * 1.4) * 0.07, cy = -0.99 * t + Math.abs(Math.sin(ph)) * 0.05;
    ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0.0, shY - 0.02); ctx.lineTo(cx - 0.05, cy - 0.05);
    ctx.moveTo(0.09, shY); ctx.lineTo(cx + 0.05, cy - 0.05);
    ctx.stroke();
    ctx.fillStyle = '#26262c'; ctx.fillRect(cx - 0.09, cy - 0.06, 0.18, 0.12);
    ctx.fillStyle = '#55555f'; ctx.beginPath(); ctx.arc(cx + 0.01, cy, 0.035, 0, Math.PI * 2); ctx.fill();
  }
  if (u.arms === 'camera'){ // held up in front, still rolling
    ctx.fillStyle = '#26262c'; ctx.fillRect(0.19, -1.1 * t, 0.17, 0.12);
    ctx.fillStyle = '#55555f'; ctx.beginPath(); ctx.arc(0.36, -1.04 * t, 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(0.22, -1.07 * t, 0.014, 0, Math.PI * 2); ctx.fill(); // rec light
  }

  touristHead(ctx, u, ph, headX, headY, look);

  tArm(ctx, u, ph, 1); // near arm in front of everything
  // the kid's balloon, streaming behind on its string
  if (u.balloon){
    const bx = -0.52 + Math.sin(ph * 0.6) * 0.06, by = -2.08 * t + Math.sin(ph * 0.8) * 0.09;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.022;
    ctx.beginPath(); ctx.moveTo(-0.08, -1.26 * t); // tied at the shoulder strap, behind the head
    ctx.quadraticCurveTo(-0.34, -1.72 * t, bx, by + 0.2); ctx.stroke();
    ctx.fillStyle = u.balloonC;
    ctx.beginPath(); ctx.ellipse(bx, by, 0.16, 0.19, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 0.03, by + 0.18); ctx.lineTo(bx + 0.035, by + 0.18); ctx.lineTo(bx + 0.005, by + 0.24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(bx - 0.055, by - 0.07, 0.035, 0.05, 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // sweat, flying off the brow
  ctx.save();
  ctx.fillStyle = '#bfe8ff';
  for (let k = 0; k < 2; k++){
    const c = ((ph * 0.21 + k * 0.47) % 1 + 1) % 1;
    ctx.globalAlpha *= (1 - c) * 0.85;
    ctx.beginPath();
    ctx.arc(headX - 0.14 - c * 0.4, headY - headR - 0.04 - Math.sin(c * Math.PI) * 0.2 + c * 0.16, 0.036 - c * 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.restore();
}

/* Draws a tourist at world position — mirrors drawDino's contract
   (turn flip, pitch onto vertical path legs, ground shadow).
   `airborne` skips the ground shadow — for anyone travelling by talon. */
function drawTourist(ctx, u, x, y, turn, ph, alpha, pitch, airborne){
  if (alpha <= 0) return;
  const s = u.size;
  if (!airborne){
    ctx.save();
    ctx.globalAlpha = 0.26 * alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 1.5, s * 0.5, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const tx = turn === undefined ? 1 : turn;
  ctx.scale(Math.sign(tx || 1) * Math.max(0.08, Math.abs(tx)), 1);
  if (pitch){
    ctx.translate(0, -s * 0.5);
    ctx.rotate(pitch);
    ctx.translate(0, s * 0.5);
  }
  ctx.scale(s, s);
  touristBody(ctx, u, ph);
  ctx.restore();
}

/* A tourist down on their backside, scrabbling away from something much
   bigger — full-fidelity version of the menu's sitting-terror pose.
   Faces +x (toward the horror), origin at the ground; pass dir=-travel
   so they've spun around to see it coming. */
function drawTouristSitting(ctx, u, x, y, dir, time, alpha){
  const s = u.size, bw = u.build, skin = u.skin;
  ctx.save();
  ctx.globalAlpha = 0.26 * alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y + 1.5, s * 0.6, s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  const sc = time * 7, hop = Math.max(0, Math.sin(sc));
  ctx.translate(0, -hop * 0.05);              // bounces with each backward shove
  ctx.lineCap = 'round';
  const thC = u.bottomType === 'skirt' ? skin : u.bottom;
  const shC = u.bottomType === 'pants' ? u.bottom : skin;
  const shoe = u.shoeC || '#2e2e34';
  // legs kicking at the dirt — knees up, heels digging, shoes scuffing
  for (const [off, dk2, w] of [[Math.PI, -0.3, 0.115], [0, 0, 0.13]]){
    const kick = Math.sin(sc + off);
    const kx = 0.28 + kick * 0.07, ky = -0.46 - Math.max(0, kick) * 0.09;
    const hx2 = 0.52 + kick * 0.11, hy2 = -0.06;
    ctx.strokeStyle = dk2 ? shade(thC, dk2) : thC; ctx.lineWidth = w * bw;
    ctx.beginPath(); ctx.moveTo(0.02, -0.3); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = dk2 ? shade(shC, dk2) : shC; ctx.lineWidth = w * 0.8 * bw;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(hx2, hy2); ctx.stroke();
    ctx.save();
    ctx.translate(hx2, hy2); ctx.rotate(-0.5 + kick * 0.15); // heel down, toe up
    ctx.fillStyle = dk2 ? shade(shoe, dk2) : shoe;
    ctx.beginPath(); ctx.ellipse(0.05, 0, 0.085, 0.042, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // seat — the skirt fans out on the ground
  ctx.fillStyle = u.bottom;
  ctx.beginPath();
  ctx.ellipse(-0.02, -0.22, (u.bottomType === 'skirt' ? 0.3 : 0.2) * bw, 0.15, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // torso leaning away, rocking with the shoves
  const rock = Math.sin(sc * 0.9) * 0.04;
  const shx = -0.24 - rock, shy = -0.98;
  ctx.strokeStyle = u.shirt; ctx.lineWidth = 0.32 * bw;
  ctx.beginPath(); ctx.moveTo(0, -0.32); ctx.lineTo(shx, shy + 0.1); ctx.stroke();
  if (u.belly){
    ctx.fillStyle = shade(u.shirt, -0.07);
    ctx.beginPath(); ctx.ellipse(-0.04, -0.52, 0.13 * bw, 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
  }
  if (u.floral){
    ctx.fillStyle = shade(u.shirt, 0.5);
    for (let i = 0; i < 4; i++){
      ctx.beginPath(); ctx.arc(shx * (0.3 + i * 0.2), -0.42 - i * 0.14, 0.028, 0, Math.PI * 2); ctx.fill();
    }
  }
  // backpack squashed against the ground behind them
  if (u.pack === 'backpack'){
    ctx.fillStyle = u.packC;
    ctx.beginPath(); ctx.ellipse(shx - 0.18, -0.62, 0.14, 0.2, 0.5, 0, Math.PI * 2); ctx.fill();
  } else if (u.pack === 'fanny'){
    ctx.fillStyle = u.packC;
    ctx.beginPath(); ctx.ellipse(0.1, -0.32, 0.09, 0.07, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  // camera flung around on its strap
  if (u.camera){
    const cx = shx + 0.24 + Math.sin(time * 9) * 0.04;
    ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(shx, shy + 0.05); ctx.lineTo(cx, -0.62); ctx.stroke();
    ctx.fillStyle = '#26262c'; ctx.fillRect(cx - 0.08, -0.66, 0.16, 0.11);
  }
  // arms waving in big frantic overhead arcs
  for (const [i, ph0] of [[0, 0], [1, 2.3]]){
    const a = -1.85 + Math.sin(time * 13 + ph0) * 0.72;
    const ex = shx + Math.cos(a) * 0.3, ey = shy + Math.sin(a) * 0.3;
    ctx.strokeStyle = i ? u.shirt : shade(u.shirt, -0.28); ctx.lineWidth = 0.1 * bw;
    ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.stroke();
    const a2 = a + Math.sin(time * 13 + ph0 + 1.1) * 0.5;
    const hx = ex + Math.cos(a2) * 0.28, hy = ey + Math.sin(a2) * 0.28;
    ctx.strokeStyle = i ? skin : shade(skin, -0.2); ctx.lineWidth = 0.08 * bw;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = i ? skin : shade(skin, -0.2);
    ctx.beginPath(); ctx.arc(hx, hy, 0.055, 0, Math.PI * 2); ctx.fill();
  }
  // neck + head shaking "no no no", full hair/hat/face treatment
  ctx.fillStyle = skin;
  ctx.fillRect(shx - 0.05, shy - 0.1, 0.1, 0.14);
  touristHead(ctx, u, time * 4, shx - 0.02 + Math.sin(time * 15) * 0.02, shy - 0.26, 1);
  // the kid's balloon, still gamely attached
  if (u.balloon){
    const bx = shx - 0.3 + Math.sin(time * 0.9) * 0.05, by = -2.0 + Math.sin(time * 1.2) * 0.08;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.022;
    ctx.beginPath(); ctx.moveTo(shx - 0.05, shy);
    ctx.quadraticCurveTo(shx - 0.25, -1.5, bx, by + 0.2); ctx.stroke();
    ctx.fillStyle = u.balloonC;
    ctx.beginPath(); ctx.ellipse(bx, by, 0.16, 0.19, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(bx - 0.055, by - 0.07, 0.035, 0.05, 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- THE PTERANODON (abduction set piece) ----------
   A huge dark pterosaur for the wave-1 evacuation gag. Drawn in world
   space at (o.x, o.y) — its BODY position — facing o.dir. `spread`
   opens the wings (0 = swept dive tuck, 1 = full flare), `talon`
   extends the legs from tucked to reaching. Deep slate hide, blood-red
   crest, burning eye: serious monster, comedic cargo. */
function drawSnatcher(ctx, o){
  const s = o.size, flap = Math.sin(o.ph * 2.2) * (0.35 + o.spread * 0.75);
  const body = '#332e3d', belly = '#59525f', crest = '#8a2430';
  const span = 0.85 + o.spread * 0.45;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate((o.bank || 0) * o.dir);
  ctx.scale(o.dir * s, s);
  // far wing membrane
  ctx.fillStyle = shade(body, -0.32);
  ctx.beginPath();
  ctx.moveTo(-0.05, 0);
  ctx.quadraticCurveTo(-0.55 * span, -0.28 - flap * 0.55, -1.35 * span, -0.18 - flap * 0.95);
  ctx.quadraticCurveTo(-0.6 * span, 0.2, -0.05, 0.13);
  ctx.closePath(); ctx.fill();
  // body + belly
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.17, -0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(0.03, 0.07, 0.34, 0.08, -0.08, 0, Math.PI * 2); ctx.fill();
  // head: swept blood-red crest + spear of a beak
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0.52, -0.15, 0.16, 0.11, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.58, -0.22); ctx.lineTo(1.18, -0.02); ctx.lineTo(0.56, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = crest;
  ctx.beginPath(); ctx.moveTo(0.5, -0.24);
  ctx.quadraticCurveTo(0.2, -0.5, -0.08, -0.62);
  ctx.quadraticCurveTo(0.3, -0.34, 0.56, -0.12);
  ctx.closePath(); ctx.fill();
  // burning eye
  const pulse = 0.7 + 0.3 * Math.sin(o.ph * 2.5);
  const eg = ctx.createRadialGradient(0.53, -0.17, 0.005, 0.53, -0.17, 0.11);
  eg.addColorStop(0, `rgba(255,70,45,${0.9 * pulse})`);
  eg.addColorStop(1, 'rgba(255,70,45,0)');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(0.53, -0.17, 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,95,60,${pulse})`;
  ctx.beginPath(); ctx.arc(0.53, -0.17, 0.035, 0, Math.PI * 2); ctx.fill();
  // talons — tucked in flight, reaching for the grab
  ctx.strokeStyle = shade(body, -0.22); ctx.lineCap = 'round';
  for (const lx of [-0.12, 0.06]){
    const reach = 0.16 + o.talon * 0.42;
    const kx = lx + 0.08 + o.talon * 0.05, ky = 0.14 + reach * 0.55;
    const fx = lx + 0.16, fy = 0.14 + reach;
    ctx.lineWidth = 0.055;
    ctx.beginPath(); ctx.moveTo(lx, 0.1); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.lineWidth = 0.04; // claw hooks
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 0.09, fy + 0.07 + o.talon * 0.03); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 0.07, fy + 0.08 + o.talon * 0.03); ctx.stroke();
  }
  // near wing membrane + finger spars
  ctx.fillStyle = shade(body, 0.07);
  ctx.beginPath();
  ctx.moveTo(0.06, -0.05);
  ctx.quadraticCurveTo(-0.4 * span, -0.42 - flap * 0.62, -1.2 * span, -0.4 - flap * 1.05);
  ctx.quadraticCurveTo(-0.5 * span, 0.12, 0.06, 0.1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(body, -0.15); ctx.lineWidth = 0.028;
  for (const q of [0.45, 0.75]){
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-0.5 * span * q, (-0.35 - flap * 0.7) * q, -1.15 * span * q, (-0.38 - flap * 1.0) * q);
    ctx.stroke();
  }
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
  // mastery laurels: career kills earn a bronze/silver/gold outer ring with
  // star pips below the pad — gold trails a slow orbiting sparkle (game.js tallies)
  const mTier = typeof masteryTier === 'function' ? masteryTier(key) : 0;
  if (mTier){
    const mc = mTier === 3 ? '#ffd24a' : mTier === 2 ? '#c9ced6' : '#c78a4e';
    ctx.strokeStyle = mc; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = mc;
    for (let i = 0; i < mTier; i++){
      const a = Math.PI / 2 + (i - (mTier - 1) / 2) * 0.42;
      const px = Math.cos(a) * (R + 4), py = Math.sin(a) * (R + 4);
      ctx.beginPath();
      ctx.moveTo(px, py - 2.4); ctx.lineTo(px + 2.2, py + 1.7); ctx.lineTo(px - 2.2, py + 1.7);
      ctx.closePath(); ctx.fill();
    }
    if (mTier === 3){    // wall-clock time: drawTowerBase gets no game clock
      const sa = performance.now() / 700 + x * 0.1;
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath(); ctx.arc(Math.cos(sa) * (R + 3), Math.sin(sa) * (R + 3), 1.5, 0, Math.PI*2); ctx.fill();
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

/* ---------- MAP-SPECIFIC CINEMATIC LANDMARKS ----------
   These are baked once with the terrain, so the maps can carry dense visual
   storytelling without adding any work to the gameplay render loop. */
function bakeFacilityLabel(c,x,y,w,title,sub){
  c.save();c.translate(x,y);
  c.fillStyle='rgba(8,12,10,.72)';c.fillRect(-w/2,-12,w,24);
  c.strokeStyle='#d8b84a';c.lineWidth=1.2;c.strokeRect(-w/2,-12,w,24);
  c.fillStyle='#f0d778';c.font='bold 9px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(title,0,-2);
  if(sub){c.fillStyle='#c9cfbd';c.font='6px system-ui,sans-serif';c.fillText(sub,0,7);}
  c.restore();
}
function bakeFenceSpan(c,x1,y1,x2,y2,n,hot){
  const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,px=-dy/L,py=dx/L;
  c.strokeStyle=hot?'rgba(150,220,245,.68)':'rgba(170,180,176,.55)';c.lineWidth=1;
  for(const off of [-3,0,3]){c.beginPath();c.moveTo(x1+px*off,y1+py*off);c.lineTo(x2+px*off,y2+py*off);c.stroke();}
  for(let i=0;i<=n;i++){
    const t=i/n,x=x1+dx*t,y=y1+dy*t;
    c.strokeStyle='#66716d';c.lineWidth=3;c.beginPath();c.moveTo(x-px*7,y-py*7);c.lineTo(x+px*7,y+py*7);c.stroke();
    c.fillStyle='#aab2ad';c.beginPath();c.arc(x-px*7,y-py*7,2.2,0,Math.PI*2);c.fill();
    if(hot&&i>0&&i<n&&i%4===0){
      c.fillStyle='#e0b93f';c.beginPath();c.moveTo(x-5,y-5);c.lineTo(x+5,y-5);c.lineTo(x,y+5);c.closePath();c.fill();
      c.fillStyle='#202018';c.font='bold 7px sans-serif';c.textAlign='center';c.fillText('!',x,y+1.5);
    }
  }
}
function bakeRaptorPaddock(c,x,y){
  c.save();c.translate(x,y);
  c.fillStyle='rgba(12,15,12,.32)';c.fillRect(-92,-58,184,116);
  c.fillStyle='#504a37';c.globalAlpha=.55;c.fillRect(-86,-52,172,104);c.globalAlpha=1;
  for(const yy of [-51,51])bakeFenceSpan(c,-86,yy,86,yy,10,true);
  for(const xx of [-86,86])bakeFenceSpan(c,xx,-51,xx,51,6,true);
  // sliding steel transfer cage, door hanging open
  c.fillStyle='#303936';c.fillRect(-34,-24,68,48);c.strokeStyle='#83918c';c.lineWidth=3;c.strokeRect(-34,-24,68,48);
  c.lineWidth=1;for(let xx=-28;xx<=28;xx+=8){c.beginPath();c.moveTo(xx,-24);c.lineTo(xx,24);c.stroke();}
  c.save();c.translate(36,0);c.rotate(-.42);c.strokeStyle='#98a49f';c.lineWidth=3;c.strokeRect(0,-23,38,46);c.restore();
  // feeder crane and a conspicuously empty tether
  c.strokeStyle='#a79c78';c.lineWidth=5;c.beginPath();c.moveTo(-62,31);c.lineTo(-62,-23);c.lineTo(-20,-23);c.stroke();
  c.strokeStyle='#4d4635';c.lineWidth=1.5;c.beginPath();c.moveTo(-21,-23);c.lineTo(-21,3);c.stroke();
  c.fillStyle='#ddd7c5';c.beginPath();c.ellipse(-20,7,7,4,.2,0,Math.PI*2);c.fill();
  c.restore();
  bakeFacilityLabel(c,x,y-73,116,'RAPTOR PADDOCK','AUTHORIZED FEED CREW ONLY');
}
function bakeVisitorComplex(c,x,y){
  c.save();c.translate(x,y);
  c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(7,12,150,72,0,0,Math.PI*2);c.fill();
  // long low museum wings and red-tile roof
  const roof=c.createLinearGradient(0,-70,0,55);roof.addColorStop(0,'#9b5a37');roof.addColorStop(1,'#583b2c');
  c.fillStyle=roof;c.beginPath();c.moveTo(-142,-35);c.lineTo(-86,-66);c.lineTo(86,-66);c.lineTo(142,-35);c.lineTo(126,44);c.lineTo(-126,44);c.closePath();c.fill();
  c.strokeStyle='#c38958';c.lineWidth=2;c.stroke();
  // iconic circular rotunda and broken skylight
  c.fillStyle='#70503a';c.beginPath();c.arc(0,-4,59,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(127,190,185,.36)';c.beginPath();c.arc(0,-4,44,0,Math.PI*2);c.fill();
  c.strokeStyle='#d2c497';c.lineWidth=3;
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;c.beginPath();c.moveTo(0,-4);c.lineTo(Math.cos(a)*44,-4+Math.sin(a)*44);c.stroke();}
  c.fillStyle='rgba(18,24,22,.72)';c.beginPath();c.moveTo(4,-8);c.lineTo(32,-30);c.lineTo(39,-5);c.lineTo(17,5);c.closePath();c.fill();
  // broad entrance steps and shattered doors
  c.fillStyle='#aaa387';for(let i=0;i<4;i++)c.fillRect(-48-i*5,45+i*5,96+i*10,4);
  c.fillStyle='#1c2624';c.fillRect(-20,31,15,19);c.fillRect(6,31,15,19);
  c.restore();
  bakeFacilityLabel(c,x,y+83,150,'VISITOR CENTER','ISLA NUBLAR');
  // fallen grand-opening banner
  c.save();c.translate(x+15,y+104);c.rotate(-.08);c.fillStyle='#7e3328';c.fillRect(-88,-8,176,16);
  c.fillStyle='#ead9a2';c.font='bold 9px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillText('WHEN DINOSAURS RULED',0,0);c.restore();
}
function bakeAviaryDome(c,W,H){
  c.save();
  c.fillStyle='rgba(140,205,210,.045)';c.beginPath();c.ellipse(W/2,H/2,W*.48,H*.45,0,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(186,224,224,.14)';c.lineWidth=2.2;
  for(let i=-3;i<=3;i++){c.beginPath();c.ellipse(W/2,H/2,W*(.17+Math.abs(i)*.09),H*.45,0,0,Math.PI*2);c.stroke();}
  for(let i=0;i<5;i++){const yy=H*.18+i*H*.15;c.beginPath();c.ellipse(W/2,yy,W*(.45-i*.025),H*.065,0,0,Math.PI*2);c.stroke();}
  // torn-open crown with bent ribs and glass shards
  const bx=W*.79,by=H*.14;c.fillStyle='rgba(10,18,17,.44)';c.beginPath();
  c.moveTo(bx-68,by-26);c.lineTo(bx-25,by-55);c.lineTo(bx+8,by-29);c.lineTo(bx+54,by-48);c.lineTo(bx+72,by+8);c.lineTo(bx+22,by+31);c.lineTo(bx-35,by+20);c.closePath();c.fill();
  c.strokeStyle='#899b98';c.lineWidth=4;for(const [ex,ey] of [[-84,-55],[-32,-78],[31,-72],[80,-35]]){c.beginPath();c.moveTo(bx,by);c.lineTo(bx+ex,by+ey);c.stroke();}
  c.fillStyle='rgba(205,239,239,.42)';for(const [sx,sy] of [[-95,15],[-65,48],[50,46],[91,20]]){c.beginPath();c.moveTo(bx+sx,by+sy);c.lineTo(bx+sx+13,by+sy+4);c.lineTo(bx+sx+4,by+sy+18);c.closePath();c.fill();}
  c.restore();
  bakeFacilityLabel(c,W*.78,H*.09,126,'AVIARY 01','STRUCTURAL BREACH');
  // two abandoned nests with oversized eggs
  for(const [nx,ny] of [[120,H-105],[W-175,H-98]]){
    c.strokeStyle='#78694a';c.lineWidth=5;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.beginPath();c.arc(nx,ny,25+i%3*3,a,a+.9);c.stroke();}
    for(const [ox,oy] of [[-9,1],[8,-3],[1,8]]){c.fillStyle='#d8d7c2';c.beginPath();c.ellipse(nx+ox,ny+oy,7,10,.25,0,Math.PI*2);c.fill();c.fillStyle='#8d927c';c.beginPath();c.arc(nx+ox-2,ny+oy-2,1.2,0,Math.PI*2);c.fill();}
  }
}
function bakeSiteB(c,W,H){
  // faded operations helipad
  const hx=W*.72,hy=H*.59;c.fillStyle='rgba(70,72,58,.48)';c.beginPath();c.arc(hx,hy,68,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(218,210,156,.5)';c.lineWidth=5;c.beginPath();c.arc(hx,hy,59,0,Math.PI*2);c.stroke();
  c.fillStyle='rgba(224,216,160,.58)';c.font='bold 70px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('H',hx,hy+3);
  // reclaimed worker village roofs
  for(let i=0;i<3;i++){
    const x=350+i*112,y=190+(i%2)*18;c.fillStyle='rgba(0,0,0,.28)';c.fillRect(x-35,y-20,78,54);
    c.fillStyle=i===1?'#6f4a37':'#59604b';c.fillRect(x-38,y-28,76,48);c.fillStyle='#333a31';c.beginPath();c.moveTo(x-45,y-28);c.lineTo(x,y-50);c.lineTo(x+45,y-28);c.closePath();c.fill();
    c.fillStyle='#141b18';c.fillRect(x-12,y-8,24,28);c.fillStyle='rgba(231,194,100,.42)';c.fillRect(x-28,y-17,11,8);
  }
  // rusting water tower
  c.strokeStyle='#5c5545';c.lineWidth=4;c.beginPath();c.moveTo(250,210);c.lineTo(225,274);c.moveTo(250,210);c.lineTo(275,274);c.moveTo(232,252);c.lineTo(268,252);c.stroke();
  c.fillStyle='#776b55';c.beginPath();c.ellipse(250,198,31,20,0,0,Math.PI*2);c.fill();c.fillStyle='#b6a36d';c.font='bold 8px sans-serif';c.textAlign='center';c.fillText('SITE B',250,201);
  // overturned mobile field lab with torn awning
  c.save();c.translate(W-190,H*.58);c.rotate(-.18);c.fillStyle='rgba(0,0,0,.3)';c.fillRect(-62,17,130,20);c.fillStyle='#d4d0b6';c.fillRect(-64,-18,128,42);c.strokeStyle='#70766d';c.lineWidth=3;c.strokeRect(-64,-18,128,42);
  c.fillStyle='#28433b';for(let i=0;i<4;i++)c.fillRect(-50+i*28,-10,18,13);c.fillStyle='#a2392d';c.fillRect(-64,12,128,6);c.restore();
  bakeFacilityLabel(c,455,126,130,'IN GEN — SITE B','OPERATIONS VILLAGE');
}
function bakeLockwoodEstate(c,W,H){
  // Keep the manor beside the converging roads rather than covering their long
  // shared eastbound stretch. A compact footprint leaves an unmistakable ring
  // of buildable lawn between the house and both approach roads.
  const x=W*.36,y=95;c.save();c.translate(x,y);c.scale(.76,.76);
  // formal hedges frame the manor approach
  c.fillStyle='#172419';for(const yy of [35,55]){for(const i of [-5,-4,-3,3,4,5]){c.beginPath();c.arc(i*34,yy,17,0,Math.PI*2);c.fill();}}
  c.fillStyle='rgba(0,0,0,.4)';c.fillRect(-210,-54,430,116);
  c.fillStyle='#494a48';c.fillRect(-200,-66,400,112);
  c.fillStyle='#242a2d';c.beginPath();c.moveTo(-220,-66);c.lineTo(-148,-118);c.lineTo(-72,-66);c.lineTo(0,-126);c.lineTo(72,-66);c.lineTo(148,-118);c.lineTo(220,-66);c.closePath();c.fill();
  // central glass gallery and warm windows
  c.fillStyle='#30383a';c.beginPath();c.arc(0,-56,62,Math.PI,0);c.lineTo(62,45);c.lineTo(-62,45);c.closePath();c.fill();
  for(const wx of [-166,-126,-86,-38,0,38,86,126,166]){c.fillStyle='rgba(244,190,95,.68)';c.fillRect(wx-9,-45,18,27);c.strokeStyle='#171b1c';c.lineWidth=2;c.strokeRect(wx-9,-45,18,27);c.beginPath();c.moveTo(wx,-45);c.lineTo(wx,-18);c.stroke();}
  c.fillStyle='#171b1d';c.fillRect(-18,8,36,38);c.restore();
  bakeFacilityLabel(c,x,y+43,124,'LOCKWOOD ESTATE','PRIVATE COLLECTION');
  // circular fossil fountain in the courtyard
  const fx=W*.65,fy=H*.41;c.fillStyle='rgba(8,12,14,.38)';c.beginPath();c.arc(fx,fy,50,0,Math.PI*2);c.fill();c.strokeStyle='#6f7773';c.lineWidth=8;c.beginPath();c.arc(fx,fy,43,0,Math.PI*2);c.stroke();
  c.strokeStyle='#c9c5aa';c.lineWidth=4;c.beginPath();c.moveTo(fx-26,fy+10);c.quadraticCurveTo(fx,fy-27,fx+28,fy+6);c.stroke();for(let i=0;i<5;i++){const xx=fx-20+i*10;c.beginPath();c.moveTo(xx,fy-4-Math.sin(i/4*Math.PI)*12);c.lineTo(xx-4,fy+13);c.stroke();}
  // auction transport crates tucked at the service wing
  for(let i=0;i<4;i++){const bx=W-180+(i%2)*54,by=H-105+Math.floor(i/2)*42;c.fillStyle='#66513a';c.fillRect(bx-22,by-16,44,32);c.strokeStyle='#a68a5e';c.strokeRect(bx-22,by-16,44,32);c.beginPath();c.moveTo(bx-22,by-16);c.lineTo(bx+22,by+16);c.moveTo(bx+22,by-16);c.lineTo(bx-22,by+16);c.stroke();}
}
function bakeProvingGrounds(c,W,H){
  // concrete containment walls and four observation towers
  c.fillStyle='#686c5f';c.fillRect(0,18,W,18);c.fillRect(0,H-36,W,18);
  c.fillStyle='#343a34';for(let x=24;x<W;x+=72){c.fillRect(x,15,6,24);c.fillRect(x,H-39,6,24);}
  for(const [x,y] of [[70,78],[W-70,78],[70,H-78],[W-70,H-78]]){
    c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x+4,y+11,35,14,0,0,Math.PI*2);c.fill();c.fillStyle='#555d58';c.fillRect(x-24,y-24,48,42);c.fillStyle='#19211f';c.fillRect(x-17,y-16,34,10);c.strokeStyle='#858d86';c.lineWidth=4;c.beginPath();c.moveTo(x-19,y+18);c.lineTo(x-31,y+52);c.moveTo(x+19,y+18);c.lineTo(x+31,y+52);c.stroke();
  }
  // giant weathered paddock stencil and scoring rings
  c.save();c.globalAlpha=.14;c.fillStyle='#e7d58b';c.font='bold 76px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('PADDOCK 9',W/2,H/2+10);
  c.strokeStyle='#e7d58b';c.lineWidth=4;for(const r of [90,150,220]){c.beginPath();c.arc(W/2,H/2,r,0,Math.PI*2);c.stroke();}c.restore();
  bakeFacilityLabel(c,W/2,74,154,'PROVING GROUNDS','LIVE CONTAINMENT TEST');
  // battered red tracking container
  c.fillStyle='rgba(0,0,0,.28)';c.fillRect(W*.38-54,H-112,120,48);c.fillStyle='#79372e';c.fillRect(W*.38-60,H-124,120,48);c.strokeStyle='#bc725e';c.lineWidth=2;c.strokeRect(W*.38-60,H-124,120,48);for(let x=-48;x<60;x+=18){c.beginPath();c.moveTo(W*.38+x,H-122);c.lineTo(W*.38+x,H-78);c.stroke();}
}
function bakeLagoonArena(c,W,H){
  // spectator deck and empty tiered seating above the water channel
  const dx=W*.36,dy=H-56;c.fillStyle='rgba(0,0,0,.32)';c.fillRect(dx-160,dy-42,330,52);
  for(let i=0;i<4;i++){c.fillStyle=i%2?'#72766d':'#8b8c7e';c.fillRect(dx-150+i*12,dy-48-i*10,300-i*24,9);}
  c.fillStyle='#27302f';c.fillRect(dx-158,dy-10,316,12);bakeFacilityLabel(c,dx,dy-82,138,'MOSASAUR LAGOON','FEEDING GALLERY');
  // feeding crane, cable and suspended shark silhouette over the channel
  const cx=W*.72,cy=H*.57;c.strokeStyle='#59635e';c.lineWidth=11;c.beginPath();c.moveTo(cx,cy+70);c.lineTo(cx,cy-72);c.lineTo(cx-150,cy-72);c.stroke();
  c.strokeStyle='#9ba49d';c.lineWidth=3;c.beginPath();c.moveTo(cx,cy-68);c.lineTo(cx-146,cy-68);c.moveTo(cx-146,cy-68);c.lineTo(cx-146,cy+2);c.stroke();
  c.fillStyle='#394a50';c.save();c.translate(cx-146,cy+12);c.beginPath();c.moveTo(-34,0);c.quadraticCurveTo(-8,-17,26,-5);c.lineTo(43,-17);c.lineTo(39,1);c.lineTo(45,18);c.lineTo(24,7);c.quadraticCurveTo(-8,18,-34,0);c.fill();c.beginPath();c.moveTo(-3,-9);c.lineTo(8,-25);c.lineTo(16,-6);c.fill();c.restore();
  // red safety buoys trace the lagoon edge
  for(const [bx,by] of [[165,H-155],[630,H-225],[1030,H-143],[1175,H-192]]){c.fillStyle='#b34332';c.beginPath();c.arc(bx,by,7,0,Math.PI*2);c.fill();c.fillStyle='#eee0b3';c.fillRect(bx-7,by-1,14,3);}
}
function bakeMapLandmarks(c,level,W,H){
  switch(LEVELS.indexOf(level)){
    case 0:
      bakeFenceSpan(c,24,48,W-24,48,18,true);bakeFenceSpan(c,24,H-42,W-24,H-42,18,true);
      bakeRaptorPaddock(c,W*.40,H*.37);
      c.fillStyle='#3f493e';c.fillRect(55,H-150,115,72);c.fillStyle='#202924';c.beginPath();c.moveTo(47,H-150);c.lineTo(112,H-185);c.lineTo(178,H-150);c.closePath();c.fill();
      bakeFacilityLabel(c,112,H-116,92,'SECTOR 7','AUX POWER');
      break;
    case 1:bakeVisitorComplex(c,W*.57,H*.28);break;
    case 2:bakeAviaryDome(c,W,H);break;
    case 3:bakeSiteB(c,W,H);break;
    case 4:bakeLockwoodEstate(c,W,H);break;
    case 5:bakeProvingGrounds(c,W,H);break;
    case 6:bakeLagoonArena(c,W,H);break;
  }
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

  // Large, map-defining set pieces sit above the roads but below loose
  // vegetation, letting the jungle reclaim their edges naturally.
  bakeMapLandmarks(c,level,W,H);

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
  if ([0,3,5].includes(LEVELS.indexOf(level))){ // operations maps only
    for (let tries = 0; tries < 40; tries++){
      const x = 100 + rng()*(W-200), y = 90 + rng()*(H-180);
      if (nearPath(x, y, 64)) continue;
      bakeJeep(c, x, y); break;
    }
  }
  if ([1,6].includes(LEVELS.indexOf(level))){ // resort attractions only
    for (let tries = 0; tries < 40; tries++){
      const x = 110 + rng()*(W-220), y = 110 + rng()*(H-200);
      if (nearPath(x, y, 72)) continue;
      bakeGyro(c, x, y, 24); break;
    }
  }
  if (LEVELS.indexOf(level) === 0){ // a singular easter egg, not cloned scenery
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
