'use strict';
/* =========================================================
   DINO DEFENSE — DISTORTUS REX ("D-Rex"), the wave-100 boss
   =========================================================
   Lives in its own file rather than in draw.js: it is by far the
   most involved painter in the game, and it also exports
   drexMouth() for the menu's tourist-eating sequence. It registers
   itself into PAINTERS at the bottom, so draw.js deliberately has
   no `mutant` entry — load order is draw.js → drex.js → game.js
   (see index.html). drex-lab.html is the design harness for it.

   Same contract as every painter in draw.js:
     side view, facing +x, origin at ground level under the hips,
     caller has already translated/flipped/scaled. `ph` is the
     walk-cycle phase in radians.

   ---- Proportions, measured off the reference -------------------
   Taking total nose-to-tail as 1.0 on the iNgen concept sheet:
     shoulder hump height  ~0.42     head length          ~0.18
     body (shoulder→hip)   ~0.35     tail                 ~0.35
     skull top sits at     ~0.72 of hump height
     belly clears ground by ~0.50 of hump height

   The calls this design is built on, in the order they matter:

   1. SHOULDERS ABOVE HIPS, ARMS LONGER THAN LEGS. This is a
      knuckle-walker. The hump crest is the tallest point, set
      forward over the shoulders, and it must clear the skull
      decisively — level the two and the animal reads as a lizard.
   2. THE ANIMAL STANDS. Long limbs hold a deep chest well clear
      of the ground. Drawn squat it becomes a toad with teeth.
   3. THE SKULL IS STEPPED, NOT ROUND. Broad brow-heavy dome, a
      distinct step down, then a short blunt snout. That step is
      the single most identifiable line on the creature.
   4. THE MOUTH HANGS OPEN. The reference is almost never
      closed-jawed — a permanent slack gape showing a cavernous
      maw and irregular teeth is most of the character.
   5. THE SKULL OVERLAPS THE CHEST. No neck, and no visible gap:
      any daylight between head and body and the head reads as a
      separate object on a stick.
   6. FOUR ARMS, TWO JOBS. Long weight-bearing pair that plants
      like knuckles, plus a spindly grasping pair held forward in
      open space under the jaw. Both need a visible Z-bend at the
      elbow — two straight strokes read as a stilt, not a limb.

   Everything derives from d.pal, and deathMask/entranceT/eat are
   honoured exactly as the shipping painters do — swap-in ready.
   ========================================================= */

/* ---- art-directed detail tables (fixed, not random: the hide must
        not crawl between frames) ---- */

// Blotchy dappling — long, narrow and angled along the flank, never round.
// Aspect ratios are kept extreme (roughly 4:1) so they read as smears of
// pigment stretched over moving hide rather than as spots.
const DREX_MOTTLE = [
  [-0.30, -1.38, 0.21, 0.048, -0.46], [-0.06, -1.54, 0.23, 0.044, -0.18],
  [ 0.18, -1.53, 0.17, 0.040,  0.18], [ 0.40, -1.36, 0.14, 0.036,  0.48],
  [-0.44, -1.18, 0.17, 0.042, -0.34], [-0.16, -1.26, 0.22, 0.046, -0.14],
  [ 0.14, -1.28, 0.18, 0.038,  0.10], [ 0.44, -1.14, 0.12, 0.032,  0.40],
  [-0.30, -1.02, 0.16, 0.036, -0.20], [ 0.02, -1.00, 0.19, 0.036,  0.02],
  [ 0.34, -0.96, 0.12, 0.030,  0.22], [-0.50, -1.30, 0.11, 0.032, -0.52],
  [ 0.06, -1.44, 0.20, 0.036, -0.06], [-0.22, -1.44, 0.18, 0.034, -0.30],
  [ 0.28, -1.18, 0.15, 0.032,  0.26], [-0.10, -1.12, 0.20, 0.034, -0.10],
];

// Creases running down and back off the spine: x0,y0 → control → x1,y1.
// The hide markings on this animal are LINEAR — long wrinkles and stretched
// blotches following the body's curve. No spines, and no round bumps either:
// discs read as warts or bubble-wrap, which is nothing like the reference.
// Trailing value is opacity weight. Lengths, spacing and strength are all
// deliberately uneven: evenly spaced full-length creases of equal weight
// stop reading as skin and start reading as armadillo banding.
const DREX_CREASES = [
  [ 0.54, -1.34,  0.34, -1.16,  0.26, -0.92, 1.00],
  [ 0.40, -1.46,  0.22, -1.30,  0.18, -1.14, 0.55],
  [ 0.14, -1.57, -0.06, -1.30, -0.12, -0.98, 0.85],
  [ 0.02, -1.56, -0.12, -1.42, -0.15, -1.30, 0.40],
  [-0.22, -1.55, -0.38, -1.30, -0.44, -1.04, 1.00],
  [-0.40, -1.44, -0.52, -1.30, -0.53, -1.18, 0.50],
  [ 0.30, -1.20,  0.16, -1.08,  0.10, -0.94, 0.45],
];
// short broken creases that stop the long ones reading as stripes
const DREX_NICKS = [
  [ 0.44, -1.22,  0.30, -1.14], [ 0.20, -1.10,  0.06, -1.06],
  [-0.06, -1.20, -0.20, -1.14], [-0.30, -1.16, -0.42, -1.12],
  [ 0.30, -1.40,  0.18, -1.34], [-0.02, -1.46, -0.16, -1.42],
];

// teeth: x along the lip, length, lean. Deliberately irregular — an even
// row reads as a comb, and the reference mouth is a ruin. The row spans
// nearly the whole skull, because on this creature it does.
const DREX_TEETH_UPPER = [
  [-0.13, 0.032, -0.014], [-0.07, 0.062, -0.008], [-0.01, 0.042, -0.002],
  [ 0.05, 0.072,  0.004], [ 0.11, 0.046,  0.009], [ 0.17, 0.060,  0.013],
  [ 0.23, 0.038,  0.017], [ 0.28, 0.028,  0.021],
];
const DREX_TEETH_LOWER = [
  [-0.10, 0.030, 0.014], [-0.04, 0.056, 0.008], [ 0.02, 0.038, 0.003],
  [ 0.08, 0.064, -0.003], [ 0.14, 0.040, -0.008], [ 0.20, 0.050, -0.013],
  [ 0.26, 0.030, -0.017],
];

/* A tapered, hooked claw drawn as a filled sickle — big claws have to
   read as blades, and stroked lines never do. `curve` bows the tip
   perpendicular to the sweep direction. */
function drexClaw(ctx, x, y, len, ang, curve, halfW, col, tipCol){
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  const tipX = x + ca * len + nx * curve, tipY = y + sa * len + ny * curve;
  const mx = x + ca * len * 0.5, my = y + sa * len * 0.5;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + nx * halfW, y + ny * halfW);
  ctx.quadraticCurveTo(mx + nx * (curve * 0.35 + halfW * 0.75), my + ny * (curve * 0.35 + halfW * 0.75), tipX, tipY);
  ctx.quadraticCurveTo(mx + nx * (curve * 0.35 - halfW * 0.95), my + ny * (curve * 0.35 - halfW * 0.95), x - nx * halfW, y - ny * halfW);
  ctx.closePath(); ctx.fill();
  if (tipCol){ // keratin highlight down the outer edge
    ctx.strokeStyle = tipCol; ctx.lineWidth = halfW * 0.32; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + nx * halfW * 0.5, y + ny * halfW * 0.5);
    ctx.quadraticCurveTo(mx + nx * (curve * 0.35 + halfW * 0.5), my + ny * (curve * 0.35 + halfW * 0.5), tipX, tipY);
    ctx.stroke();
  }
}

/* Soft contact shadow that darkens as a limb takes load — cheap, but it
   is most of what sells the animal's weight. */
function drexContact(ctx, x, load, w){
  if (load <= 0.02) return;
  ctx.fillStyle = `rgba(26,18,11,${0.28 * load})`;
  ctx.beginPath(); ctx.ellipse(x, 0.012, w * (0.85 + 0.25 * load), 0.036, 0, 0, Math.PI * 2); ctx.fill();
}

/* ---- colour blending ----
   The reference hide is two-tone: olive-khaki over the dorsal surfaces
   grading into rust down the flanks, with the lower limbs going cooler
   and greyer still. A single shade() ramp off one hue can't express that,
   so these mix toward explicit reference colours. */
const DREX_OLIVE = [142, 135, 87];   // dorsal khaki
const DREX_COOL  = [109, 106, 84];   // cool grey-olive of the lower limbs
function drexRgb(c){
  if (/^#[0-9a-f]{6}$/i.test(c)){
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = String(c).match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return m ? [+m[1], +m[2], +m[3]] : [140, 110, 70];
}
function drexMix(c, target, t){
  const a = drexRgb(c);
  return `rgb(${Math.round(a[0] + (target[0] - a[0]) * t)},${Math.round(a[1] + (target[1] - a[1]) * t)},${Math.round(a[2] + (target[2] - a[2]) * t)})`;
}

/* ---- where the jaws are ---------------------------------------------
   The menu's tourist-eating sequence has to place a victim inside the
   mouth. game.js does that from the fixed MENU_MOUTHS table, but a
   constant offset cannot describe this painter: the skull hinges at its
   rear and the whole body pitches and heaves with the gait, so the mouth
   travels through the walk cycle. This reports it exactly.

   Returns painter unit space — origin at ground under the hips, facing
   +x — i.e. BEFORE drawDino's own translate/flip/scale/pitch. Keep it in
   step with the transform stack in drawDistortusRex below. */
function drexMouth(ph, roar){
  const heave = Math.abs(Math.sin(ph)) * 0.038;
  const roll  = Math.sin(ph * 2) * 0.010 * 0.30;
  const HIPX = -0.34, HIPY = -1.02;
  const pitch = -(0.115 + Math.abs(Math.cos(ph)) * 0.075);
  const S = 1.09, HX = 0.94, HY = -1.08, PX = -0.45, PY = -0.10;
  const lx = 0.10, ly = 0.09;                    // a point between the lips
  const a = 0.06 - (roar || 0) * 0.42, ca = Math.cos(a), sa = Math.sin(a);
  const rx = lx - PX, ry = ly - PY;
  const hxw = HX + (PX + rx * ca - ry * sa) * S;
  const hyw = HY + (PY + rx * sa + ry * ca) * S;
  const rc = Math.cos(roll), rs = Math.sin(roll);          // roll, about the origin
  const x1 = hxw * rc - hyw * rs, y1 = hxw * rs + hyw * rc;
  const pc = Math.cos(pitch), ps = Math.sin(pitch);        // pitch, about the hip
  const dx = x1 - HIPX, dy = y1 - HIPY;
  return {x: HIPX + dx * pc - dy * ps, y: HIPY + dx * ps + dy * pc - heave};
}

function drawDistortusRex(ctx, d, ph){
  const p = d.pal || {body:'#8f6a42', belly:'#b89264', accent:'#4a3826'};
  const mask = d.deathMask || {};
  /* Value range is kept deliberately tight and dark. An earlier pass ran
     lit at +0.26 and the whole animal washed out to a uniform milky tan;
     the references are a fairly dark, saturated creature whose contrast
     comes from the olive/rust hue split rather than from brightness. */
  const skin  = p.body;
  const lit   = shade(skin,  0.13);
  const light = shade(skin,  0.04);
  const dark  = shade(skin, -0.22);
  const deep  = shade(skin, -0.40);
  const abyss = shade(skin, -0.58);
  const belly = p.belly;
  const accent = p.accent || deep;
  const nail   = '#d8c9a6';   // reference claws are pale keratin, not black
  const nailHi = '#f2e9cf';

  /* ---- gait -------------------------------------------------------
     A six-limbed lumber: diagonal support (near hind with far arm),
     the whole mass heaving vertically, shoulders rolling on top.

     The animal also PROPS ITSELF UP on its arms. `pitch` rotates the
     body about the hip, nose-up, and deepens as an arm takes support —
     so the chest and head ride up and settle with each step instead of
     the whole creature staying folded over at a constant hunch. Hind
     legs are unaffected because the hip is the pivot; the arms get
     their shoulder anchors run through the same rotation. */
  const heave = Math.abs(Math.sin(ph)) * 0.038;
  const roll  = Math.sin(ph * 2) * 0.010;
  const sway  = Math.sin(ph * 0.55);
  const roar  = (d.entranceT || 0) > 0 ? Math.min(1, Math.max(0, (3.4 - d.entranceT) * 1.55)) : 0;

  const HIPX = -0.34, HIPY = -1.02;
  const pitch = -(0.115 + Math.abs(Math.cos(ph)) * 0.075);
  const pc = Math.cos(pitch), ps = Math.sin(pitch);
  // shoulder/chest anchors, rotated about the hip and lifted with the heave
  function anchor(x, y){
    const dx = x - HIPX, dy = y - HIPY;
    return {x: HIPX + dx * pc - dy * ps, y: HIPY + dx * ps + dy * pc - heave};
  }

  /* ---- hind leg: heavy thigh, long shank, broad three-toed foot ----
     Hip sits at y=-1.02, deliberately LOWER than the shoulder. */
  function hindLeg(x0, phase, tone, near){
    const sw = Math.sin(phase), lift = Math.max(0, Math.cos(phase)), load = Math.max(0, -Math.cos(phase));
    const kx = x0 + sw * 0.14, ky = -0.54 - lift * 0.05;
    const ax = kx - 0.05 + sw * 0.10, ay = -0.16 - lift * 0.045;
    // lower limb cools toward grey-olive, as it does in both reference renders
    const shank = drexMix(tone, DREX_COOL, 0.34);
    const foot  = drexMix(tone, DREX_COOL, 0.46);
    // Thigh reads as a slanted teardrop tucked under the hip, not a disc —
    // a circle here bulges out of the flank and looks like a bolted-on joint.
    ctx.fillStyle = tone;
    ctx.beginPath(); ctx.ellipse(x0 + 0.01, -1.00 - heave, 0.175, 0.245, -0.28 + sw * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tone; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = near ? 0.26 : 0.22;
    ctx.beginPath(); ctx.moveTo(x0, -1.02 - heave); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = shank; ctx.lineWidth = near ? 0.165 : 0.140;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.fillStyle = shade(tone, -0.06);
    ctx.beginPath(); ctx.ellipse(kx, ky, near ? 0.086 : 0.074, near ? 0.078 : 0.067, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = foot;
    ctx.beginPath(); ctx.ellipse(ax, ay, near ? 0.088 : 0.076, near ? 0.074 : 0.063, 0, 0, Math.PI * 2); ctx.fill();
    for (const [tx, ty, tl] of [[0.23, 0.030, 0.100], [0.17, 0.070, 0.086], [0.13, -0.026, 0.078]]){
      ctx.strokeStyle = foot; ctx.lineWidth = near ? 0.052 : 0.044;
      ctx.beginPath(); ctx.moveTo(ax - 0.02, ay + 0.02); ctx.lineTo(ax + tx, ay + ty + 0.07); ctx.stroke();
      drexClaw(ctx, ax + tx, ay + ty + 0.07, tl, 0.10, 0.026, near ? 0.028 : 0.023, nail, near ? nailHi : null);
    }
    drexContact(ctx, ax + 0.12, load, 0.20);
  }

  /* ---- great arm: the weight-bearer, and the longest limb here.
     The elbow kicks BACKWARD while the wrist swings forward, so the
     limb makes a visible Z. Upper arm is drawn markedly thicker than
     the forearm and the elbow gets its own darker knuckle — without
     that contrast the whole limb flattens into a pale tube.

     KNUCKLE WALK: the fingers fold under and the animal bears weight on
     the backs of them, claws hooked backward clear of the dirt. That is
     exactly WHY an animal with claws this size knuckle-walks — planted
     claw tips would catch.

     Timing matters as much as the pose. The fold is driven by `curl`,
     which is deliberately phase-LED so the hand is already a closed fist
     BEFORE it touches down; tying it to ground load instead makes the
     animal land claws-first and roll onto its knuckles afterward, which
     is exactly the tell that looked wrong. It stays shut through stance
     and only unfurls after lift-off. */
  function greatArm(sx, sy, phase, tone, near){
    const st = Math.sin(phase), rec = Math.max(0, Math.cos(phase)), load = Math.max(0, -Math.cos(phase));
    // reaches 1 by touchdown (phase π/2), holds through stance, opens after lift-off
    const curl = Math.max(0, Math.min(1, (-Math.cos(phase) + 0.9) / 0.9));
    const ex = sx - 0.10 + st * 0.09, ey = sy + 0.64 - rec * 0.09;   // elbow kicks back
    const wx = sx + 0.22 + st * 0.26, wy = -0.15 - rec * 0.26 - curl * 0.05;
    const fore = drexMix(tone, DREX_COOL, 0.30);
    const hand = drexMix(tone, DREX_COOL, 0.42);
    ctx.strokeStyle = tone; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = near ? 0.200 : 0.172;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = fore; ctx.lineWidth = near ? 0.128 : 0.110;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(wx, wy); ctx.stroke();
    ctx.fillStyle = shade(tone, -0.16);
    ctx.beginPath(); ctx.ellipse(ex, ey, near ? 0.106 : 0.092, near ? 0.096 : 0.083, 0, 0, Math.PI * 2); ctx.fill();
    // hand mass: a flat palm when open, balling up as the fingers fold
    ctx.fillStyle = hand;
    ctx.beginPath();
    ctx.ellipse(wx + 0.02 - curl * 0.02, wy + 0.02, (near ? 0.106 : 0.092) - curl * 0.020,
                (near ? 0.066 : 0.056) + curl * 0.028, -0.12 + st * 0.10, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++){
      const spread = -0.10 + i * 0.22;
      // finger sweeps from pointing forward (swing) to tucked under (plant)
      const ang = (0.24 + spread) * (1 - curl) + (1.22 + spread * 0.30) * curl;
      const len = (0.150 - i * 0.014) + rec * 0.028;
      const fx2 = wx + 0.03 + Math.cos(ang) * len, fy2 = wy + Math.sin(ang) * len;
      ctx.strokeStyle = hand; ctx.lineWidth = near ? 0.048 : 0.040;
      ctx.beginPath(); ctx.moveTo(wx + 0.03, wy - 0.02 + i * 0.022); ctx.lineTo(fx2, fy2); ctx.stroke();
      if (curl > 0.25){ // swollen knuckle pad taking the animal's weight
        ctx.fillStyle = shade(hand, -0.12);
        ctx.beginPath(); ctx.ellipse(fx2, fy2, 0.052 * curl, 0.044 * curl, 0, 0, Math.PI * 2); ctx.fill();
      }
      // claw swings from forward-reaching to hooking back over the knuckle
      const clawAng = (0.16 + spread) * (1 - curl) + (2.62 - spread * 0.20) * curl;
      drexClaw(ctx, fx2, fy2, 0.126 - i * 0.012, clawAng, 0.044 - curl * 0.020,
                near ? 0.030 : 0.025, nail, near ? nailHi : null);
    }
    drexContact(ctx, wx + 0.12, load, 0.20);
  }

  /* ---- grasping arm: the second pair, and the detail that makes this
     creature unmistakable. These root in the CHEST, low and forward on
     the sternum — well below and ahead of the great arms' shoulder
     socket. Rooting them at the shoulder made the animal read as
     having four identical forelimbs; coming off the chest they read
     as a separate, vestigial second pair, which is the design.
     Elbow drops out and forward, hand carried ahead of the jaw in
     open air so the pair still reads at gameplay scale. */
  function graspArm(sx, sy, phase, tone, near){
    const curl = Math.sin(phase) * 0.026;
    const ex = sx + 0.15 + curl, ey = sy + 0.15;          // elbow drops out and forward
    const hx = sx + 0.31 + curl * 1.6, hy = sy + 0.24;    // hand carried forward of the jaw
    ctx.strokeStyle = tone; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = near ? 0.072 : 0.058;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = near ? 0.056 : 0.046;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = shade(tone, -0.14);
    ctx.beginPath(); ctx.ellipse(ex, ey, near ? 0.045 : 0.037, near ? 0.040 : 0.033, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tone;
    ctx.beginPath(); ctx.ellipse(hx, hy, near ? 0.041 : 0.034, near ? 0.033 : 0.027, 0.3, 0, Math.PI * 2); ctx.fill();
    // Fingers splay forward and DOWN into open air ahead of the chest.
    // Every angle stays below horizontal on purpose — aim one up and the
    // claws rake straight through the jaw sitting just above them.
    for (let i = 0; i < 3; i++){
      const a = 0.20 + i * 0.34, fl = 0.165 - i * 0.014;
      const fx2 = hx + Math.cos(a) * fl, fy2 = hy + Math.sin(a) * fl;
      ctx.strokeStyle = tone; ctx.lineWidth = near ? 0.025 : 0.020;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx2, fy2); ctx.stroke();
      drexClaw(ctx, fx2, fy2, 0.090, a + 0.20, 0.042, near ? 0.017 : 0.014, nail, near ? nailHi : null);
    }
  }

  /* ---- torso outline: a long, only gently arched back. The earlier
     draft crested hard over the shoulders and read as permanently folded
     over; both reference renders show a much flatter topline with the
     chest carried high. Belly tucks up toward the hips so the chest
     still reads deep rather than barrel-like. Reused for fill/clip. */
  function torsoPath(){
    ctx.beginPath();
    ctx.moveTo(-0.56, -1.02);
    ctx.bezierCurveTo(-0.64, -1.22, -0.56, -1.38, -0.38, -1.44);   // over the hips
    ctx.bezierCurveTo(-0.22, -1.49, -0.10, -1.53,  0.04, -1.56);   // one long unbroken rise…
    ctx.bezierCurveTo( 0.18, -1.59,  0.30, -1.60,  0.42, -1.59);   // …to a shallow plateau, NOT a crest
    ctx.bezierCurveTo( 0.58, -1.56,  0.72, -1.44,  0.76, -1.26);   // slides away under the skull
    // Chest tucks BACK below the jaw line. Carried further forward it
    // overlapped the mouth corner, and since the head draws underneath,
    // the body was clipping the back of his own mouth.
    ctx.bezierCurveTo( 0.79, -1.15,  0.76, -1.04,  0.66, -0.98);   // deep chest front
    ctx.bezierCurveTo( 0.44, -0.88,  0.06, -0.84, -0.22, -0.90);   // belly, tucking up
    ctx.bezierCurveTo(-0.42, -0.95, -0.55, -0.97, -0.56, -1.02);   // belly → hip
    ctx.closePath();
  }

  /* =================== FAR SIDE (drawn first, deep tones) ============ */
  if (!mask.farLeg) hindLeg(-0.42, ph + Math.PI, abyss, false);
  const fArm = anchor(0.40, -1.32), fGrasp = anchor(0.50, -1.02);
  if (!mask.farArm) greatArm(fArm.x, fArm.y, ph, abyss, false);
  if (!mask.farArm) graspArm(fGrasp.x, fGrasp.y, ph + 1.4, shade(skin, -0.44), false);

  ctx.save();
  ctx.translate(0, -heave);
  ctx.translate(HIPX, HIPY); ctx.rotate(pitch); ctx.translate(-HIPX, -HIPY);
  ctx.rotate(roll * 0.30);

  /* ---- tail: thick-based, tapering to a point, held clear of the
     ground. A fat even paddle reads as a beaver. Smooth — no spines. -- */
  if (!mask.tail){
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-0.50, -1.30);
    ctx.bezierCurveTo(-0.88, -1.26, -1.22, -1.06, -1.58, -0.66 + sway * 0.055);
    ctx.quadraticCurveTo(-1.68, -0.59, -1.56, -0.57 + sway * 0.05);
    ctx.bezierCurveTo(-1.14, -0.78, -0.84, -0.92, -0.48, -0.98);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = deep; ctx.globalAlpha *= 0.45;
    ctx.beginPath();
    ctx.moveTo(-0.50, -1.03);
    ctx.bezierCurveTo(-0.86, -1.00, -1.16, -0.90, -1.56, -0.58 + sway * 0.05);
    ctx.bezierCurveTo(-1.16, -0.79, -0.86, -0.92, -0.50, -0.98);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha /= 0.45;
  }

  // Head goes down BEFORE the torso so the body can bury its rear.
  drawHead();

  /* ---- torso -------------------------------------------------------
     deathMask.torso drops the whole body shell. The death finale needs it
     so individual parts can be launched as fragments drawn with the real
     artwork — mask everything but the head and you get a genuinely
     recognisable skull tumbling through the air. */
  if (!mask.torso){
  const tg = ctx.createLinearGradient(0, -1.66, 0, -0.84);
  tg.addColorStop(0.00, lit);        // sun on the dorsal surface
  tg.addColorStop(0.36, light);
  tg.addColorStop(0.70, skin);
  tg.addColorStop(1.00, deep);       // shadowed underbelly
  ctx.fillStyle = tg; torsoPath(); ctx.fill();

  // hide detail, clipped to the body so nothing leaks past the outline
  ctx.save(); torsoPath(); ctx.clip();

  // Dorsal khaki wash: both references run olive over the back and
  // shoulders, grading into rust down the flanks. One shade() ramp off a
  // single hue can't do that, so the olive is laid over the top half and
  // a warm rust wash lifts the mid-flank underneath it.
  const olive = ctx.createLinearGradient(0, -1.66, 0, -1.02);
  olive.addColorStop(0.00, `rgba(${DREX_OLIVE[0]},${DREX_OLIVE[1]},${DREX_OLIVE[2]},0.68)`);
  olive.addColorStop(0.50, `rgba(${DREX_OLIVE[0]},${DREX_OLIVE[1]},${DREX_OLIVE[2]},0.30)`);
  olive.addColorStop(1.00, `rgba(${DREX_OLIVE[0]},${DREX_OLIVE[1]},${DREX_OLIVE[2]},0)`);
  ctx.fillStyle = olive; ctx.fillRect(-0.70, -1.70, 1.50, 0.72);

  const rust = ctx.createLinearGradient(0, -1.24, 0, -0.82);
  rust.addColorStop(0.00, 'rgba(160,88,42,0)');
  rust.addColorStop(0.45, 'rgba(160,88,42,0.30)');
  rust.addColorStop(1.00, 'rgba(120,60,30,0.26)');
  ctx.fillStyle = rust; ctx.fillRect(-0.70, -1.26, 1.50, 0.46);

  ctx.globalAlpha *= 0.20; ctx.fillStyle = accent;
  for (const [x, y, rx, ry, rot] of DREX_MOTTLE){
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha /= 0.20;

  // Long creases sweeping down and back off the spine, each doubled with a
  // faint highlight on its upper side so the hide reads as folded rather
  // than merely drawn on. These replace the old round knots entirely.
  ctx.lineCap = 'round';
  const baseAlpha = ctx.globalAlpha;
  ctx.strokeStyle = deep; ctx.lineWidth = 0.020;
  for (const [x0, y0, cx, cy, x1, y1, w] of DREX_CREASES){
    ctx.globalAlpha = baseAlpha * 0.34 * w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
  }
  // Highlight only the two deepest folds. Pairing every dark line with a
  // light one is precisely what manufactures the banded-shell look.
  ctx.strokeStyle = lit; ctx.lineWidth = 0.013;
  for (const i of [0, 4]){
    const [x0, y0, cx, cy, x1, y1] = DREX_CREASES[i];
    ctx.globalAlpha = baseAlpha * 0.15;
    ctx.beginPath(); ctx.moveTo(x0 + 0.024, y0); ctx.quadraticCurveTo(cx + 0.024, cy, x1 + 0.024, y1); ctx.stroke();
  }
  ctx.globalAlpha = baseAlpha;
  ctx.globalAlpha *= 0.26; ctx.strokeStyle = deep; ctx.lineWidth = 0.016;
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of DREX_NICKS){ ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  ctx.stroke();
  ctx.globalAlpha /= 0.26;

  // belly counter-shading
  ctx.fillStyle = belly; ctx.globalAlpha *= 0.42;
  ctx.beginPath();
  ctx.moveTo(-0.40, -0.98);
  ctx.bezierCurveTo(-0.12, -0.82, 0.32, -0.82, 0.58, -0.90);
  ctx.bezierCurveTo(0.30, -0.88, -0.10, -0.90, -0.40, -1.04);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha /= 0.42;

  // occlusion where the skull is jammed into the shoulders
  const ao = ctx.createRadialGradient(0.66, -1.20, 0.04, 0.66, -1.20, 0.44);
  ao.addColorStop(0, 'rgba(18,12,6,0.40)'); ao.addColorStop(1, 'rgba(18,12,6,0)');
  ctx.fillStyle = ao; ctx.fillRect(0.22, -1.64, 0.64, 0.86);
  ctx.restore();

  /* Soft occlusion spilling FORWARD out of the shoulder onto the skull,
     right where the melon emerges. Without it the two masses butt-join
     along a clean edge; with it the shoulder appears to roll over into
     the head. Feathered hard and kept weak — any crisp edge here and the
     seam we just eliminated comes straight back. */
  const seam = ctx.createRadialGradient(0.60, -1.30, 0.02, 0.60, -1.30, 0.36);
  seam.addColorStop(0.00, 'rgba(20,13,7,0.26)');
  seam.addColorStop(0.55, 'rgba(20,13,7,0.10)');
  seam.addColorStop(1.00, 'rgba(20,13,7,0)');
  ctx.fillStyle = seam;
  ctx.beginPath(); ctx.arc(0.60, -1.30, 0.36, 0, Math.PI * 2); ctx.fill();

  // Rim light riding the dorsal contour. It has to STOP where the torso
  // outline stops — carried on over the melon it stroked through empty
  // air above the skull, since the head's crown sits on a different
  // curve. The head paints its own sheen; this one stays on the body.
  ctx.strokeStyle = shade(skin, 0.44); ctx.lineWidth = 0.028; ctx.lineCap = 'round';
  ctx.globalAlpha *= 0.45;
  ctx.beginPath();
  ctx.moveTo(-0.56, -1.04);
  ctx.bezierCurveTo(-0.64, -1.23, -0.56, -1.39, -0.38, -1.45);
  ctx.bezierCurveTo(-0.22, -1.50, -0.10, -1.54, 0.04, -1.57);
  ctx.bezierCurveTo(0.18, -1.60, 0.30, -1.61, 0.42, -1.60);
  ctx.stroke();
  ctx.globalAlpha /= 0.45;
  }   // end !mask.torso

  /* No separate neck shape any more. The skull path itself now runs back
     into the shoulder mass, so a neck drawn here would only reintroduce
     the value seam that made the head look bolted on. */

  /* =================== HEAD ========================================= */
  /* Anchored at x=0.94: far enough forward that the near great arm
     passes BEHIND the skull instead of raking across the face, but
     still overlapping the chest — there is no neck, and there must be
     no daylight between head and body. Carried higher and closer to
     level than the earlier draft, which drooped and read as cowering.

     Declared as a function and CALLED BEFORE THE TORSO (see above). The
     head used to paint over the body, which meant its rear outline was
     drawn across the shoulder — and that edge, not the shape, was what
     kept reading as a join. Rendered underneath, the skull has no rear
     edge at all: the torso simply covers it until the melon rises out
     from under the shoulder around x≈0.5, so the two share one
     uninterrupted mass and there is nowhere for a neck to be. */
  function drawHead(){
    if (mask.head) return;
    /* The skull carries NO independent bob. It used to ride its own
       sin(ph*1.6) wobble, which drifted out of phase with the body's
       pitch and heave — and every time it dipped, the melon's rear fell
       below the shoulder plateau and the "m" valley reopened mid-stride.
       Sitting inside the pitched group it already rises and settles with
       the body; making that motion rigid means the two can never
       separate at any phase. Liveliness comes from the jaw instead,
       which doesn't touch the topline. */
    const hx = 0.94, hy = -1.08;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(1.09, 1.09);                   // the skull carries real mass
    /* Pivot at the skull's REAR, where it meets the body — not its
       centre. Rotating about the centre swung the rear down and out of
       the shoulder during a roar, tearing the join open exactly when the
       head is most visible. Hinged at the back, the rear stays seated
       and only the muzzle swings. */
    ctx.translate(-0.45, -0.10);
    ctx.rotate(0.06 - roar * 0.42);          // near level at rest; roar throws it up
    ctx.translate(0.45, 0.10);

    let bite = 0;
    if (d.eat){
      const t = d.eat.t;
      bite = t < 0.18 ? t / 0.18 * 0.46
           : t < 0.40 ? 0.46
           : t < 0.48 ? (1 - (t - 0.40) / 0.08) * 0.46
           : t < 2.10 ? 0.04 + Math.abs(Math.sin((t - 0.48) * 8.2)) * 0.075
           : t < 2.45 ? 0.10 : 0;
    }
    // permanent slack gape — the reference is essentially never closed
    const jaw = 0.26 + (d.eat ? 0 : Math.max(0, Math.sin(ph * 0.62)) * 0.040) + roar * 0.42 + bite;

    // heavy jowl sagging behind the jaw hinge, under the cranium
    ctx.fillStyle = shade(skin, -0.26);
    ctx.beginPath();
    ctx.moveTo(-0.32, 0.00);
    ctx.quadraticCurveTo(-0.26, 0.20, -0.02, 0.22);
    ctx.quadraticCurveTo(-0.16, 0.12, -0.20, 0.00);
    ctx.closePath(); ctx.fill();

    /* Dark maw, drawn before the jaw so the cavity sits behind the teeth.
       Its lower edge is derived from the ACTUAL jaw rotation rather than
       scaled off the gape angle: the menu tourist-eating sequence drives
       the gape far wider than the walk cycle ever does (base + roar +
       bite stacks past a radian), and an approximated edge overshoots
       the jawline there and hangs a red wedge out in open air. Tying it
       to the transformed jaw means the cavity can never outrun the mouth
       no matter how wide, or how the head is pitched. */
    const jc = Math.cos(jaw), js = Math.sin(jaw);
    const jawPt = (lx, ly) => ({x: -0.17 + lx * jc - ly * js, y: 0.12 + lx * js + ly * jc});
    const mawBack = jawPt(0.02, -0.03), mawFront = jawPt(0.44, -0.05);
    ctx.fillStyle = '#2e120e';
    ctx.beginPath();
    ctx.moveTo(-0.15, 0.10);
    ctx.quadraticCurveTo(0.06, 0.16, 0.31, 0.04);
    ctx.lineTo(mawFront.x, mawFront.y);
    ctx.quadraticCurveTo((mawBack.x + mawFront.x) * 0.5, (mawBack.y + mawFront.y) * 0.5 + 0.03, mawBack.x, mawBack.y);
    ctx.closePath(); ctx.fill();

    // lower jaw — deep, heavy, rounded chin; swings on the gape
    if (!mask.lowerJaw){
      ctx.save();
      ctx.translate(-0.17, 0.12);
      ctx.rotate(jaw);
      ctx.fillStyle = shade(skin, -0.32);
      ctx.beginPath();
      ctx.moveTo(-0.04, -0.04);
      ctx.quadraticCurveTo(0.20, 0.04, 0.48, -0.04);
      ctx.quadraticCurveTo(0.53, 0.07, 0.45, 0.16);
      ctx.quadraticCurveTo(0.16, 0.24, -0.08, 0.12);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3f1d18';   // gum line
      ctx.beginPath();
      ctx.moveTo(-0.01, 0.002);
      ctx.quadraticCurveTo(0.20, 0.070, 0.45, 0.000);
      ctx.lineTo(0.42, 0.060);
      ctx.quadraticCurveTo(0.18, 0.128, 0.00, 0.060);
      ctx.closePath(); ctx.fill();
      for (const [tx, tl, lean] of DREX_TEETH_LOWER){
        ctx.fillStyle = '#e7dcbe';
        ctx.beginPath();
        ctx.moveTo(tx + 0.15 - 0.019, 0.042);
        ctx.lineTo(tx + 0.15 + 0.019, 0.036);
        ctx.quadraticCurveTo(tx + 0.15 + lean + 0.003, 0.036 - tl * 0.62, tx + 0.15 + lean, 0.036 - tl);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    /* Cranium: a BELUGA MELON, fused into the shoulders.

       Two things were making the head read as a ball stuck on a body.
       First it closed off at the back, giving the silhouette a discrete
       circular edge where the reference has none — there, skull, neck
       and shoulder are one unbroken mass and you genuinely cannot say
       where the head ends. So the path now runs back to x=-0.60, deep
       inside the torso, and the melon is stretched along the body axis
       instead of being domed like a sphere.

       Second, its radial gradient darkened toward the rear while the
       torso behind it was light, so even overlapping perfectly there was
       a value step betraying the join. The fill is now the same
       dorsal-to-ventral ramp the torso uses — olive crown, body mid,
       shadowed jaw — so the two blend with no seam to find. */
    const sk = ctx.createLinearGradient(0, -0.56, 0, 0.14);
    sk.addColorStop(0.00, drexMix(shade(skin, 0.13), DREX_OLIVE, 0.52)); // olive crown
    sk.addColorStop(0.42, light);
    sk.addColorStop(0.74, skin);
    sk.addColorStop(1.00, deep);
    ctx.fillStyle = sk;
    ctx.beginPath();
    ctx.moveTo(-0.62, 0.10);                                        // buried in the shoulder
    // Rear height solved numerically, not eyeballed: it has to clear the
    // shoulder plateau at the handoff (x≈0.45) or the topline dips there.
    // -0.46/-0.51 sits mid-band, so it stays monotonic under small drift.
    ctx.bezierCurveTo(-0.70, -0.16, -0.68, -0.36, -0.56, -0.46);    // rear rises HIGH, still hidden
    ctx.bezierCurveTo(-0.38, -0.51, -0.20, -0.524, -0.02, -0.535);  // long high crown
    ctx.bezierCurveTo( 0.16, -0.525,  0.30, -0.44,  0.35, -0.29);   // rolls forward, then down
    ctx.bezierCurveTo( 0.385, -0.22,  0.362, -0.175,  0.32, -0.15); // its lip overhangs the face
    ctx.bezierCurveTo( 0.35, -0.10,  0.362, -0.05,  0.352,  0.01);  // stubby muzzle tucked beneath
    ctx.lineTo(0.318, 0.06);                                        // blunt front, near-vertical
    ctx.quadraticCurveTo(0.06, 0.14, -0.16, 0.13);                 // long mouth line → corner
    ctx.quadraticCurveTo(-0.40, 0.13, -0.62, 0.10);                // cheek running back into the chest
    ctx.closePath(); ctx.fill();

    // Creases only — the same linear language as the body, carried
    // forward across the skull so head and torso share a skin.
    ctx.globalAlpha *= 0.30; ctx.strokeStyle = shade(skin, -0.26); ctx.lineWidth = 0.018;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.30, -0.20); ctx.quadraticCurveTo(0.10, -0.30, -0.16, -0.31);
    ctx.moveTo(0.16, -0.06); ctx.quadraticCurveTo(-0.10, -0.14, -0.38, -0.17);
    ctx.moveTo(-0.22, -0.44); ctx.quadraticCurveTo(-0.40, -0.38, -0.54, -0.26);
    ctx.stroke();
    ctx.globalAlpha /= 0.30;
    // sheen along the crown, stretched with the melon rather than a disc
    ctx.globalAlpha *= 0.20; ctx.fillStyle = shade(skin, 0.34);
    ctx.beginPath(); ctx.ellipse(-0.14, -0.455, 0.210, 0.040, -0.10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha /= 0.20;
    // lower face darkens toward the jaw, as it does in both references
    ctx.globalAlpha *= 0.34; ctx.fillStyle = deep;
    ctx.beginPath();
    ctx.moveTo(-0.30, 0.02); ctx.quadraticCurveTo(0.02, 0.02, 0.32, -0.04);
    ctx.lineTo(0.315, 0.06); ctx.quadraticCurveTo(0.06, 0.14, -0.16, 0.13);
    ctx.quadraticCurveTo(-0.28, 0.11, -0.30, 0.02);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha /= 0.34;

    // Brow shelf overhanging a deep-set eye. Kept soft and curved and low
    // in contrast — as a hard-edged slab it reads as a rectangle stuck to
    // the forehead rather than bone under skin.
    ctx.fillStyle = shade(skin, -0.20); ctx.globalAlpha *= 0.80;
    ctx.beginPath();
    ctx.moveTo(-0.14, -0.20);
    ctx.quadraticCurveTo(0.02, -0.27, 0.19, -0.18);
    ctx.quadraticCurveTo(0.07, -0.160, -0.01, -0.150);
    ctx.quadraticCurveTo(-0.08, -0.145, -0.14, -0.20);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha /= 0.80;

    // deep folds bracketing the jaw hinge — the reference face is a ruin
    ctx.strokeStyle = shade(skin, -0.34); ctx.lineWidth = 0.015; ctx.lineCap = 'round';
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.moveTo(-0.09, 0.02); ctx.quadraticCurveTo(-0.19, -0.02, -0.28, -0.08);
    ctx.moveTo(-0.07, 0.08); ctx.quadraticCurveTo(-0.17, 0.06, -0.27, 0.03);
    ctx.stroke();
    ctx.globalAlpha /= 0.55;

    // upper teeth LAST so they hang outside the open jaw
    for (const [tx, tl, lean] of DREX_TEETH_UPPER){
      ctx.fillStyle = '#efe6c9';
      ctx.beginPath();
      ctx.moveTo(tx - 0.018, 0.112);
      ctx.lineTo(tx + 0.018, 0.106);
      ctx.quadraticCurveTo(tx + lean + 0.003, 0.108 + tl * 0.64, tx + lean, 0.108 + tl);
      ctx.closePath(); ctx.fill();
    }
    // upper lip fold over the tooth roots
    ctx.strokeStyle = shade(skin, -0.42); ctx.lineWidth = 0.017; ctx.globalAlpha *= 0.7;
    ctx.beginPath(); ctx.moveTo(-0.16, 0.104); ctx.quadraticCurveTo(0.06, 0.150, 0.31, 0.062); ctx.stroke();
    ctx.globalAlpha /= 0.7;

    // small beady eye, tucked in the shadow under the melon's overhang
    ctx.fillStyle = shade(skin, -0.42);
    ctx.beginPath(); ctx.ellipse(0.00, -0.128, 0.044, 0.031, -0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#191310';
    ctx.beginPath(); ctx.ellipse(0.006, -0.126, 0.028, 0.020, -0.14, 0, Math.PI * 2); ctx.fill();
    const er = roar > 0.3 ? 0.014 : 0.011;
    ctx.fillStyle = '#c8992f';
    ctx.beginPath(); ctx.arc(0.012, -0.124, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0705';
    ctx.beginPath(); ctx.ellipse(0.014, -0.124, 0.004, er * 0.85, 0, 0, Math.PI * 2); ctx.fill();

    // nostril slit high on the stubby muzzle
    ctx.fillStyle = shade(skin, -0.50);
    ctx.beginPath(); ctx.ellipse(0.290, -0.048, 0.023, 0.014, -0.35, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  /* ---- the gulp ----------------------------------------------------
     A tourist-sized lump distending the hide as it slides down the
     throat and into the belly, on the same 2.45s beat the other menu
     dinosaurs use. It lives in the painter rather than in the menu code
     because the menu's generic version is a hardcoded offset tuned to
     the OLD skull's geometry — on this body it would surface in the
     wrong place entirely.

     Drawn INSIDE the body group, before the near-side limbs, so the lump
     passes behind the near arm and leg on its way down rather than
     floating over the top of them. */
  if (d.eat && d.eat.t >= 2.45 && !mask.torso){
    // 2.45 → 2.90, finishing inside the game's 2.95s eat window rather than
    // being cut off by it
    const k = Math.max(0, Math.min(1, (d.eat.t - 2.45) / 0.45));
    const e = 1 - Math.pow(1 - k, 2);                       // eases as it settles
    const p0 = [0.84, -1.14], p1 = [0.56, -1.02], p2 = [0.14, -0.98];
    const u = 1 - e;
    const gx = u * u * p0[0] + 2 * u * e * p1[0] + e * e * p2[0];
    const gy = u * u * p0[1] + 2 * u * e * p1[1] + e * e * p2[1];
    const r = 0.128 - e * 0.032;                            // sinks as it goes down
    ctx.save();
    ctx.globalAlpha *= 0.92;
    ctx.fillStyle = shade(skin, 0.17);                      // the bulge itself
    ctx.beginPath(); ctx.ellipse(gx, gy, r, r * 0.86, -0.20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha *= 0.55; ctx.fillStyle = deep;          // volume pressing outward
    ctx.beginPath(); ctx.ellipse(gx + r * 0.20, gy + r * 0.44, r * 0.76, r * 0.34, -0.20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.42; ctx.fillStyle = shade(skin, 0.42);
    ctx.beginPath(); ctx.ellipse(gx - r * 0.24, gy - r * 0.34, r * 0.42, r * 0.17, -0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* =================== NEAR SIDE ==================================== */
  ctx.restore();
  const nGrasp = anchor(0.56, -1.00), nArm = anchor(0.44, -1.36);
  // Grasping pair stays the lightest thing on the body so the second pair
  // still separates; the great arm sits at body value rather than lighter,
  // or it reads as a pale pole laid across the neck.
  if (!mask.nearArm) graspArm(nGrasp.x, nGrasp.y, ph + 0.4, shade(skin, 0.14), true);
  if (!mask.nearArm) greatArm(nArm.x, nArm.y, ph + Math.PI, shade(skin, -0.03), true);
  if (!mask.nearLeg) hindLeg(-0.30, ph, shade(skin, -0.06), true);
}

/* draw.js has no `mutant` entry — the D-Rex registers itself here so the
   painter and its mouth helper can live together in one file. */
PAINTERS.mutant = drawDistortusRex;
