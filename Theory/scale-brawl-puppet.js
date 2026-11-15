/* scale-brawl-puppet.js — a small cut-out ("puppet") animation engine, and the Baron.
 *
 * A character is a skeleton of bones with drawn parts pinned to them. Clips
 * are keyframed poses with easing; the engine blends between clips, keeps the
 * feet planted with two-bone IK, and gives loose parts (coat tails, hair)
 * springy follow-through. Live inputs come from the game every frame:
 *
 *     puppet.play('throw')                     one-shot moves
 *     puppet.update(dt, {beat, hp})            beat = 0…1 through the current beat, hp = 0…1
 *     puppet.draw(ctx, x, y, {flip, scale})
 *     puppet.point('baton', 0, 56, x, y, opts) where a part is on screen
 *
 * Those are the same inputs a Rive state machine would take (attack / hit /
 * block / ko / win triggers, beat + hp numbers), so a character drawn later in
 * Rive or Spine can replace one of these without touching the game.
 *
 * Coordinates: model space, +x = the way the character faces, y up is negative,
 * (0,0) = on the floor between the feet. Limb bones point along +y at rot 0;
 * rot is in radians, clockwise on screen.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const EASE = {
    lin:  t => t,
    in:   t => t * t * t,
    out:  t => 1 - Math.pow(1 - t, 3),
    io:   t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    snap: t => 1 - Math.pow(1 - t, 6),            // fighting-game snap: almost all of it at once
    back: t => { const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },  // overshoot
    step: t => t < 1 ? 0 : 1                      // hold, then jump
  };
  const CH = ['x', 'y', 'rot', 'sx', 'sy'];

  // ---- 2×3 affine matrices [a b c d e f], same layout as canvas setTransform ----
  function mul(m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  function local(x, y, r, sx, sy) { const c = Math.cos(r), s = Math.sin(r); return [c * sx, s * sx, -s * sy, c * sy, x, y]; }
  const ID = [1, 0, 0, 1, 0, 0];
  const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const worldRot = m => Math.atan2(m[1], m[0]);
  // a direction (screen angle) → this engine's bone rotation, and back
  const dirToRot = a => a - Math.PI / 2;
  const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

  // ---- clips: built from a list of key POSES, so they read like an animator's key frames ----
  // keys: [[time, pose, ease], …]; a pose is {bone:{rot,x,y,sx,sy}, …, expr:'name'}.
  // Every pose is laid over the rest pose, so a key only lists what it changes.
  function buildClip(rest, spec) {
    const tracks = {}, expr = [];
    spec.keys.forEach(([t, pose, ease]) => {
      const full = {};
      for (const b in rest) full[b] = Object.assign({}, rest[b], (pose && pose[b]) || {});
      for (const b in full) {
        tracks[b] = tracks[b] || {};
        CH.forEach(c => { (tracks[b][c] = tracks[b][c] || []).push([t, full[b][c], ease || 'io']); });
      }
      if (pose && pose.expr) expr.push([t, pose.expr]);
    });
    return Object.assign({ loop: false, hold: false, mix: .08, next: 'idle' }, spec, { tracks, expr });
  }
  function sample(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t < b[0]) { const u = (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * EASE[b[2] || 'io'](u); }
    }
    return keys[keys.length - 1][1];
  }
  function evalClip(clip, rest, t) {
    const p = {};
    for (const b in rest) {
      const tr = clip.tracks[b], r = rest[b], o = {};
      CH.forEach(c => { o[c] = tr && tr[c] ? sample(tr[c], t) : r[c]; });
      p[b] = o;
    }
    return p;
  }
  function blendPose(a, b, u) {
    const p = {};
    for (const k in b) {
      const A = a[k] || b[k], B = b[k], o = {};
      CH.forEach(c => { o[c] = c === 'rot' ? A[c] + wrap(B[c] - A[c]) * u : A[c] + (B[c] - A[c]) * u; });
      p[k] = o;
    }
    return p;
  }

  /* ------------------------------------------------------------------ *
   *  The engine
   * ------------------------------------------------------------------ */
  function Puppet(def) {
    this.def = def;
    this.rest = {};
    def.bones.forEach(b => { this.rest[b.name] = { x: b.x || 0, y: b.y || 0, rot: b.rot || 0, sx: b.sx || 1, sy: b.sy || 1 }; });
    this.clips = {};
    for (const k in def.clips) this.clips[k] = buildClip(this.rest, def.clips[k]);
    this.state = 'idle'; this.t = 0; this.time = 0;
    this.from = null; this.mixT = 0; this.mixDur = 0;
    this.expr = 'normal'; this.pose = null; this.m = {}; this.spring = {};
    this.inputs = { beat: 0, hp: 1 };
    this.solve(evalClip(this.clips.idle, this.rest, 0), 0);
  }
  Puppet.prototype.play = function (name) {
    if (!this.clips[name]) name = 'idle';
    if (this.pose) this.from = this.pose;               // blend out of wherever we are now
    this.mixT = 0; this.mixDur = this.clips[name].mix;
    this.state = name; this.t = 0;
  };
  Puppet.prototype.update = function (dt, inputs) {
    if (inputs) Object.assign(this.inputs, inputs);
    this.time += dt; this.t += dt;
    let clip = this.clips[this.state];
    if (!clip.loop && !clip.hold && this.t >= clip.dur) { this.play(clip.next); clip = this.clips[this.state]; }
    const ct = clip.loop ? this.t % clip.dur : Math.min(this.t, clip.dur);
    let p = evalClip(clip, this.rest, ct);
    // expression: the last expr key at or before now
    let ex = clip.expr.length ? clip.expr[0][1] : 'normal';
    clip.expr.forEach(([t, e]) => { if (ct >= t) ex = e; });
    this.expr = ex;
    if (this.def.layers) this.def.layers(p, this, this.inputs, dt);
    if (this.from && this.mixT < this.mixDur) {
      this.mixT += dt;
      p = blendPose(this.from, p, EASE.out(Math.min(1, this.mixT / this.mixDur)));
    } else this.from = null;
    this.solve(p, dt);
  };
  // forward kinematics, with IK legs and spring bones solved on the way down the tree
  Puppet.prototype.solve = function (p, dt) {
    const def = this.def, m = this.m;
    const ik = {}; (def.ik || []).forEach(l => { ik[l.upper] = l; });
    const levels = {}; (def.level || []).forEach(n => { levels[n] = 1; });
    def.bones.forEach(b => {
      const parent = b.parent ? m[b.parent] : ID;
      const q = p[b.name];
      if (ik[b.name]) this.solveLeg(ik[b.name], p, parent);
      if (levels[b.name]) {                              // feet stay flat to the floor (or to the body, once he's down)
        const shin = m[b.parent], root = m.root;
        q.rot = wrap(worldRot(root) - worldRot(shin));
      }
      const sp = def.springs && def.springs[b.name];
      if (sp) this.solveSpring(b, sp, q, parent, dt);
      m[b.name] = mul(parent, local(q.x, q.y, q.rot, q.sx, q.sy));
    });
    this.pose = p;
  };
  // analytic two-bone IK: hip → knee → ankle, knee bending the way the character faces
  Puppet.prototype.solveLeg = function (l, p, parentM) {
    const up = p[l.upper], lo = p[l.lower];
    const hip = apply(parentM, up.x, up.y);
    const tg = p[l.target], tW = apply(this.m.root || ID, tg.x, tg.y);
    const L1 = l.len1, L2 = l.len2;
    let dx = tW.x - hip.x, dy = tW.y - hip.y, d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(L1 - L2) + .01, Math.min(L1 + L2 - .01, d));
    const a1 = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const phi = Math.atan2(dy, dx);
    const thighDir = phi - a1 * (l.bend || 1);
    const knee = { x: hip.x + Math.cos(thighDir) * L1, y: hip.y + Math.sin(thighDir) * L1 };
    const shinDir = Math.atan2(tW.y - knee.y, tW.x - knee.x);
    const pr = worldRot(parentM);
    up.rot = wrap(dirToRot(thighDir) - pr);
    lo.rot = wrap(dirToRot(shinDir) - dirToRot(thighDir));
  };
  // loose parts lag behind the body and swing back (follow-through)
  Puppet.prototype.solveSpring = function (b, sp, q, parentM, dt) {
    const s = this.spring[b.name] || (this.spring[b.name] = { a: null, w: 0, px: null, py: null });
    const pr = worldRot(parentM), want0 = pr + q.rot;
    const at = apply(parentM, q.x, q.y);
    let vx = 0;
    if (s.px != null && dt > 0) vx = (at.x - s.px) / dt;
    s.px = at.x; s.py = at.y;
    const want = want0 + Math.max(-sp.maxLag, Math.min(sp.maxLag, vx * sp.drag));
    if (s.a == null || dt <= 0) { s.a = want; s.w = 0; }
    else {
      const steps = Math.ceil(dt / .008), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        s.w += (wrap(want - s.a) * sp.stiff - s.w * sp.damp) * h;
        s.a += s.w * h;
      }
    }
    q.rot = wrap(s.a - pr);
  };
  Puppet.prototype.draw = function (ctx, x, y, o) {
    o = o || {};
    if (o.glow && !o._inner && typeof document !== 'undefined') {
      // draw the whole puppet offscreen, then stamp it with a soft light round its outline only
      const cv = ctx.canvas, oc = this._oc || (this._oc = document.createElement('canvas'));
      if (oc.width !== cv.width || oc.height !== cv.height) { oc.width = cv.width; oc.height = cv.height; }
      const ox = oc.getContext('2d');
      ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, oc.width, oc.height);
      ox.setTransform(ctx.getTransform());
      this.draw(ox, x, y, Object.assign({}, o, { _inner: true, alpha: null }));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      const dpr = cv.width / (cv.clientWidth || cv.width) || 1;      // shadow blur is in device pixels
      ctx.shadowColor = o.glow; ctx.shadowBlur = (o.glowBlur || 12) * Math.max(1, dpr);
      ctx.drawImage(oc, 0, 0);
      ctx.restore();
      return;
    }
    const sc = o.scale || 1;
    ctx.save();
    ctx.translate(x, y); if (o.flip) ctx.scale(-1, 1); ctx.scale(sc, sc);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    this.def.parts.forEach(part => {
      const m = this.m[part.bone]; if (!m) return;
      ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      part.draw(ctx, this);
      ctx.restore();
    });
    if (o.bones) this.drawBones(ctx);
    ctx.restore();
  };
  Puppet.prototype.drawBones = function (ctx) {
    ctx.save(); ctx.globalAlpha = .9;
    this.def.bones.forEach(b => {
      const m = this.m[b.name], o = apply(m, 0, 0);
      if (b.parent) { const pm = this.m[b.parent], po = apply(pm, 0, 0); ctx.strokeStyle = '#00E0B0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(o.x, o.y); ctx.stroke(); }
      ctx.fillStyle = (this.def.springs && this.def.springs[b.name]) ? '#FF4E86' : '#00E0B0';
      ctx.beginPath(); ctx.arc(o.x, o.y, 2.6, 0, TAU); ctx.fill();
    });
    ctx.restore();
  };
  // where a point on a bone is on screen (e.g. the baton tip, for notes to fly from)
  Puppet.prototype.point = function (bone, lx, ly, x, y, o) {
    o = o || {};
    const m = this.m[bone]; if (!m) return { x, y };
    const q = apply(m, lx, ly), sc = o.scale || 1;
    return { x: x + (o.flip ? -1 : 1) * q.x * sc, y: y + q.y * sc };
  };

  /* ------------------------------------------------------------------ *
   *  Drawing helpers: flat fills, a shade on the side away from the
   *  stage lights, a highlight, and one ink outline weight everywhere.
   * ------------------------------------------------------------------ */
  const INK = '#17140E';
  const LW = 3;
  function paint(ctx, path, fill, shade) {
    ctx.fillStyle = fill; ctx.fill(path);
    if (shade) { ctx.save(); ctx.clip(path); shade(ctx); ctx.restore(); }
    ctx.lineWidth = LW; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path);
  }
  // a tapered limb running down +y, rounded at both ends
  function capsule(y1, r1, y2, r2) {
    const p = new Path2D();
    p.moveTo(-r1, y1); p.lineTo(-r2, y2);
    p.arc(0, y2, r2, Math.PI, 0, true);
    p.lineTo(r1, y1);
    p.arc(0, y1, r1, 0, Math.PI, true);
    p.closePath();
    return p;
  }
  const shadeBack = (col, w) => ctx => { ctx.fillStyle = col; ctx.fillRect(-80, -120, 80 - w, 260); };
  const hiLine = (ctx, x, y1, y2, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke(); };

  /* ------------------------------------------------------------------ *
   *  Baron von Baton
   * ------------------------------------------------------------------ */
  const C = {
    coat: '#2B2442', coatSh: '#17122A', coatHi: '#5C5185', satin: '#3A3159',
    shirt: '#FBF7EE', shirtSh: '#DDD5C4', skin: '#F0C9A6', skinSh: '#D6A47F', blush: '#F2A08F',
    hair: '#DAD4C8', hairSh: '#ABA496', hairHi: '#F4F1EA',
    trous: '#4A4558', trousSh: '#36324A', stripe: '#5F5A74',
    shoe: '#221D30', shine: '#7A7495', spat: '#F4EFE3',
    glove: '#FFFFFF', gloveSh: '#E2DBCD', pink: '#FF4E86', pinkSh: '#D12F66', gold: '#FFC53D', goldSh: '#C98F12',
    cork: '#B9874F', mouth: '#5A1A2A', tongue: '#FF7FA0'
  };

  // ---- the shapes, built once ----
  const S = {};
  S.torso = (() => { const p = new Path2D();
    p.moveTo(-16, 5);
    p.bezierCurveTo(-21, -18, -21, -44, -15, -60);
    p.quadraticCurveTo(-6, -69, 4, -68);
    p.quadraticCurveTo(15, -67, 17, -59);
    p.bezierCurveTo(26, -45, 25, -24, 15, -9);
    p.lineTo(11, 5); p.closePath(); return p; })();
  S.shirt = (() => { const p = new Path2D();
    p.moveTo(1, -67); p.lineTo(14, -64);
    p.bezierCurveTo(20, -50, 19, -36, 12, -21);
    p.lineTo(7, -23);
    p.bezierCurveTo(9, -40, 7, -55, 1, -67); p.closePath(); return p; })();
  S.lapel = (() => { const p = new Path2D();
    p.moveTo(1, -67); p.bezierCurveTo(7, -55, 9, -40, 7, -23);
    p.lineTo(2, -27); p.bezierCurveTo(3, -42, 1, -55, -4, -64); p.closePath(); return p; })();
  S.collar = (() => { const p = new Path2D(); p.moveTo(3, -69); p.lineTo(14, -66); p.lineTo(12, -61); p.lineTo(5, -63); p.closePath(); return p; })();
  S.seat = (() => { const p = new Path2D(); p.moveTo(-16, -6); p.quadraticCurveTo(-18, 10, -6, 12); p.lineTo(10, 12); p.quadraticCurveTo(17, 8, 14, -6); p.closePath(); return p; })();
  S.tail = (() => { const p = new Path2D();
    p.moveTo(-3, -6); p.bezierCurveTo(-10, 14, -11, 32, -7, 50);
    p.lineTo(-1, 42); p.lineTo(4, 52);
    p.bezierCurveTo(9, 32, 10, 12, 8, -6); p.closePath(); return p; })();
  S.mane = (() => { const p = new Path2D();
    p.moveTo(-9, -2); p.bezierCurveTo(-14, 10, -10, 22, 1, 32);
    p.bezierCurveTo(1, 24, 5, 26, 6, 30);
    p.bezierCurveTo(9, 20, 12, 10, 9, -2); p.closePath(); return p; })();
  S.thigh = capsule(0, 10.5, 42, 8.5);
  S.shin = capsule(0, 8.5, 41, 7);
  S.upper = capsule(0, 9, 31, 7.5);
  S.fore = capsule(0, 7.5, 27, 6.5);
  S.cuff = capsule(23, 7.2, 28, 7.2);
  S.shoe = (() => { const p = new Path2D();
    p.moveTo(-10, 1); p.lineTo(-10, 9); p.lineTo(22, 9);
    p.quadraticCurveTo(28, 9, 25, 3); p.quadraticCurveTo(18, -2, 6, -2); p.lineTo(-6, -2); p.closePath(); return p; })();
  S.spat = (() => { const p = new Path2D(); p.moveTo(-8, -9); p.lineTo(8, -9); p.lineTo(10, 2); p.lineTo(-9, 2); p.closePath(); return p; })();
  S.fist = (() => { const p = new Path2D(); p.moveTo(-7, -1); p.quadraticCurveTo(-8, 13, 0, 13); p.quadraticCurveTo(9, 13, 8, 3); p.quadraticCurveTo(8, -3, 0, -3); p.closePath(); return p; })();
  S.palm = (() => { const p = new Path2D();
    p.moveTo(-6, -1); p.quadraticCurveTo(-8, 10, -3, 15); p.lineTo(-4, 21); p.quadraticCurveTo(-1, 23, 1, 18);
    p.lineTo(2, 22); p.quadraticCurveTo(5, 24, 6, 18); p.lineTo(7, 19); p.quadraticCurveTo(10, 19, 8, 12);
    p.quadraticCurveTo(9, 2, 6, -2); p.closePath(); return p; })();
  S.skull = (() => { const p = new Path2D(); p.ellipse(1, -27, 17, 21, 0, 0, TAU); return p; })();
  S.neck = (() => { const p = new Path2D(); p.moveTo(-5, -2); p.lineTo(-4, -12); p.lineTo(7, -12); p.lineTo(6, -2); p.closePath(); return p; })();
  S.nose = (() => { const p = new Path2D(); p.moveTo(14, -34); p.bezierCurveTo(23, -32, 31, -19, 27, -15); p.quadraticCurveTo(22, -12, 16, -15); p.closePath(); return p; })();
  S.ear = (() => { const p = new Path2D(); p.ellipse(-4, -25, 4.2, 6.5, -.2, 0, TAU); return p; })();
  S.hairTop = (() => { const p = new Path2D();
    p.moveTo(-17, -19);
    p.bezierCurveTo(-23, -40, -6, -54, 12, -46);
    p.quadraticCurveTo(17, -44, 16, -39);
    p.quadraticCurveTo(6, -44, -2, -39);
    p.quadraticCurveTo(-8, -33, -8, -22);
    p.quadraticCurveTo(-12, -16, -17, -19); p.closePath(); return p; })();
  S.moustache = (() => { const p = new Path2D();
    p.moveTo(17, -15);
    p.bezierCurveTo(26, -17, 33, -14, 36, -9);              // front lobe out
    p.bezierCurveTo(39, -15, 37, -22, 32, -21);             // curl up at the tip
    p.bezierCurveTo(36, -18, 35, -14, 33, -13);
    p.bezierCurveTo(29, -5, 20, -6, 15, -9);
    p.bezierCurveTo(10, -5, 2, -6, 0, -12);                 // back lobe
    p.bezierCurveTo(-4, -16, -1, -22, 3, -20);
    p.bezierCurveTo(0, -17, 2, -14, 5, -14);
    p.bezierCurveTo(9, -16, 13, -16, 17, -15); p.closePath(); return p; })();
  S.baton = (() => { const p = new Path2D(); p.moveTo(-2.6, 8); p.lineTo(-1.1, 58); p.lineTo(1.1, 58); p.lineTo(2.6, 8); p.closePath(); return p; })();

  const BARON = {
    bones: [
      { name: 'root' },
      { name: 'ikF', parent: 'root', x: 18, y: -9 },     // where each ankle wants to be (IK targets)
      { name: 'ikB', parent: 'root', x: -17, y: -9 },
      { name: 'hips', parent: 'root', y: -92 },
      { name: 'thighB', parent: 'hips', x: -5, y: 2 },
      { name: 'shinB', parent: 'thighB', y: 42 },
      { name: 'footB', parent: 'shinB', y: 41 },
      { name: 'torso', parent: 'hips', y: -2, rot: .06 },
      { name: 'tail', parent: 'torso', x: -15, y: -6, rot: .32 },
      { name: 'upperArmB', parent: 'torso', x: -7, y: -55, rot: .45 },
      { name: 'foreArmB', parent: 'upperArmB', y: 31, rot: -1.7 },
      { name: 'handB', parent: 'foreArmB', y: 27, rot: -.2 },
      { name: 'head', parent: 'torso', x: 3, y: -64, sx: 1.2, sy: 1.2 },
      { name: 'mane', parent: 'head', x: -13, y: -31, rot: 1.0 },
      { name: 'thighF', parent: 'hips', x: 5, y: 2 },
      { name: 'shinF', parent: 'thighF', y: 42 },
      { name: 'footF', parent: 'shinF', y: 41 },
      { name: 'upperArmF', parent: 'torso', x: 9, y: -56, rot: -.35 },
      { name: 'foreArmF', parent: 'upperArmF', y: 31, rot: -1.15 },
      { name: 'handF', parent: 'foreArmF', y: 27, rot: -.75 },
      { name: 'baton', parent: 'handF', x: 1, y: 5 }
    ],
    ik: [
      { upper: 'thighF', lower: 'shinF', target: 'ikF', len1: 42, len2: 41 },
      { upper: 'thighB', lower: 'shinB', target: 'ikB', len1: 42, len2: 41 }
    ],
    level: ['footF', 'footB'],
    springs: {
      tail: { stiff: 140, damp: 11, drag: -.0045, maxLag: .7 },
      mane: { stiff: 170, damp: 12, drag: -.004, maxLag: .6 }
    },

    /* ---- key poses, laid over the rest pose (idle stance) ---- */
    clips: (function () {
      const WIND = { hips: { x: -5, y: -83 }, torso: { rot: -.18 }, head: { rot: -.14 },
        upperArmF: { rot: 2.55 }, foreArmF: { rot: -.95 }, handF: { rot: -.55 },
        upperArmB: { rot: -1.15 }, foreArmB: { rot: -.35 }, handB: { rot: -.3 },
        ikF: { x: 22 }, ikB: { x: -15 }, expr: 'focus' };
      const THROW = { hips: { x: 9, y: -82 }, torso: { rot: .32, sx: .97, sy: 1.05 }, head: { rot: .14 },
        upperArmF: { rot: -1.38 }, foreArmF: { rot: -.12 }, handF: { rot: -.2 },
        upperArmB: { rot: 1.65 }, foreArmB: { rot: -.25 }, handB: { rot: .2 },
        ikF: { x: 26 }, ikB: { x: -19 }, expr: 'shout' };
      const FOLLOW = { hips: { x: 11, y: -84 }, torso: { rot: .38 }, head: { rot: .08 },
        upperArmF: { rot: -1.12 }, foreArmF: { rot: .14 }, handF: { rot: .12 },
        upperArmB: { rot: 1.4 }, foreArmB: { rot: -.4 },
        ikF: { x: 26 }, ikB: { x: -19 }, expr: 'shout' };
      const BLOCK = { hips: { x: -4, y: -85 }, torso: { rot: -.06 }, head: { rot: -.1 },
        upperArmF: { rot: -.85 }, foreArmF: { rot: -1.95 }, handF: { rot: -.35 },
        upperArmB: { rot: -.6 }, foreArmB: { rot: -1.5 }, expr: 'focus' };
      const HIT1 = { hips: { x: -15, y: -89 }, torso: { rot: -.34, sx: 1.07, sy: .9 }, head: { rot: -.32 },
        upperArmF: { rot: 2.4 }, foreArmF: { rot: .7 }, handF: { rot: .3 },
        upperArmB: { rot: 2.2 }, foreArmB: { rot: .8 }, ikF: { x: 12 }, ikB: { x: -24 }, expr: 'ouch' };
      const HIT2 = { hips: { x: -11, y: -89 }, torso: { rot: -.22, sy: 1.02 }, head: { rot: -.18 },
        upperArmF: { rot: .4 }, foreArmF: { rot: -.9 }, upperArmB: { rot: 1.0 }, foreArmB: { rot: -.9 },
        ikF: { x: 12 }, ikB: { x: -24 }, expr: 'ouch' };
      const STAGGER = { hips: { x: -24, y: -80 }, torso: { rot: -.5 }, head: { rot: -.7 },
        upperArmF: { rot: 1.2 }, foreArmF: { rot: -.2 }, handF: { rot: .4 },
        upperArmB: { rot: 2.0 }, foreArmB: { rot: .5 }, ikF: { x: 4 }, ikB: { x: -26 }, expr: 'ko' };
      const TOPPLE = Object.assign({}, STAGGER, { root: { rot: -.75, x: 22 }, hips: { x: -18, y: -82 } });   // slides forward as he goes, so he lands on stage
      const DOWN = { root: { rot: -1.62, y: -20, x: 62 }, hips: { x: -6, y: -86 }, torso: { rot: -.08 }, head: { rot: -.3 },
        upperArmF: { rot: 2.2 }, foreArmF: { rot: .3 }, handF: { rot: .2 },
        upperArmB: { rot: 2.8 }, foreArmB: { rot: .2 }, ikF: { x: 6 }, ikB: { x: -10 }, expr: 'ko' };
      const DOWNSETTLE = Object.assign({}, DOWN, { root: { rot: -1.55, y: -24, x: 62 } });
      const WIN1 = { hips: { y: -90 }, torso: { rot: -.14 }, head: { rot: -.22 },
        upperArmF: { rot: 2.75 }, foreArmF: { rot: -.45 }, handF: { rot: -.3 },
        upperArmB: { rot: -2.7 }, foreArmB: { rot: .45 }, handB: { rot: .3 }, expr: 'smug' };
      const WIN2 = { hips: { y: -87 }, torso: { rot: -.06 }, head: { rot: -.08 },
        upperArmF: { rot: 2.35 }, foreArmF: { rot: -.85 }, handF: { rot: -.6 },
        upperArmB: { rot: -2.35 }, foreArmB: { rot: .8 }, handB: { rot: .5 }, expr: 'smug' };
      return {
        idle:   { dur: 1, loop: true, mix: .16, keys: [[0, {}], [1, {}]] },
        // wind-up: anticipation, then hold (with a tremble) until he lets go
        windup: { dur: .3, hold: true, mix: .07, keys: [[0, { expr: 'focus' }], [.3, WIND, 'back']] },
        // the throw: snaps out in two frames, overshoots, settles back
        throw:  { dur: .5, mix: .03, keys: [[0, WIND], [.07, THROW, 'snap'], [.17, FOLLOW, 'out'], [.5, {}, 'io']] },
        block:  { dur: .4, mix: .03, keys: [[0, {}], [.06, BLOCK, 'snap'], [.2, BLOCK, 'lin'], [.4, {}, 'io']] },
        hit:    { dur: .55, mix: .02, keys: [[0, HIT1], [.05, HIT1, 'snap'], [.2, HIT2, 'out'], [.55, {}, 'io']] },
        ko:     { dur: 1.25, hold: true, mix: .03, keys: [[0, HIT1], [.08, HIT1, 'snap'], [.45, STAGGER, 'out'], [.72, TOPPLE, 'in'], [1.0, DOWN, 'in'], [1.25, DOWNSETTLE, 'out']] },
        win:    { dur: 1.2, loop: true, mix: .15, keys: [[0, WIN1], [.6, WIN2, 'io'], [1.2, WIN1, 'io']] }
      };
    })(),

    /* ---- live layers: the beat, breathing, how hurt he is ---- */
    layers(p, P, inp) {
      const beat = inp.beat == null ? (P.time * 1.5) % 1 : inp.beat;
      const pulse = Math.pow(1 - beat, 3);                 // a kick on every beat, fading
      if (P.state === 'idle' || P.state === 'win') {
        p.hips.y += 3.2 * pulse;                            // dips on the beat (IK keeps the feet planted)
        p.head.rot += .07 * pulse;                          // and nods
      }
      if (P.state === 'idle') {                             // he conducts the band in time
        p.foreArmF.rot += .26 * Math.sin(beat * TAU);
        p.handF.rot += .2 * Math.cos(beat * TAU);
        p.foreArmB.rot += .08 * Math.sin(beat * TAU + 1);
      }
      p.torso.sy *= 1 + .012 * Math.sin(P.time * 2.3);      // breathing
      const hurt = 1 - Math.max(0, Math.min(1, inp.hp == null ? 1 : inp.hp));
      if (P.state !== 'ko') { p.torso.rot += .08 * hurt; p.head.rot += .12 * hurt; p.hips.y += 5 * hurt; }
      if (P.state === 'windup' && P.t > .3) p.upperArmF.rot += .03 * Math.sin(P.time * 42);   // straining
    },

    /* ---- parts, back to front ---- */
    parts: [
      { bone: 'upperArmB', draw: c => paint(c, S.upper, C.coatSh) },
      { bone: 'foreArmB', draw: c => { paint(c, S.fore, C.coatSh); paint(c, S.cuff, C.shirtSh); } },
      { bone: 'handB', draw: c => paint(c, S.palm, C.gloveSh) },
      { bone: 'thighB', draw: c => paint(c, S.thigh, C.trousSh) },
      { bone: 'shinB', draw: c => paint(c, S.shin, C.trousSh) },
      { bone: 'footB', draw: c => { paint(c, S.shoe, C.shoe); paint(c, S.spat, C.shirtSh); } },
      { bone: 'tail', draw: c => paint(c, S.tail, C.coat, x => { x.fillStyle = C.coatSh; x.fillRect(-20, -10, 20, 70); hiLine(x, 5, 2, 38, C.coatHi); }) },
      { bone: 'mane', draw: c => paint(c, S.mane, C.hair, x => {
          x.fillStyle = C.hairSh; x.fillRect(-20, -6, 16, 50);
          x.strokeStyle = C.hairSh; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-2, 2); x.quadraticCurveTo(-4, 16, 2, 26); x.moveTo(4, 2); x.quadraticCurveTo(4, 14, 5, 24); x.stroke(); }) },
      { bone: 'hips', draw: c => paint(c, S.seat, C.trous, shadeBack(C.trousSh, 4)) },
      { bone: 'thighF', draw: c => paint(c, S.thigh, C.trous, x => { shadeBack(C.trousSh, 3)(x); hiLine(x, -1, 4, 38, C.stripe); hiLine(x, 4, 4, 38, C.stripe); }) },
      { bone: 'shinF', draw: c => paint(c, S.shin, C.trous, x => { shadeBack(C.trousSh, 2.5)(x); hiLine(x, -1, 3, 36, C.stripe); hiLine(x, 3.5, 3, 36, C.stripe); }) },
      { bone: 'footF', draw: c => { paint(c, S.shoe, C.shoe, x => { x.fillStyle = C.shine; x.beginPath(); x.ellipse(15, 2, 5, 1.6, -.15, 0, TAU); x.fill(); });
          paint(c, S.spat, C.spat, x => { x.fillStyle = C.shirtSh; x.fillRect(-12, -12, 6, 20); x.fillStyle = INK; [-5, -1].forEach(yy => { x.beginPath(); x.arc(6, yy, 1.1, 0, TAU); x.fill(); }); }); } },
      { bone: 'torso', draw: (c, P) => {
          paint(c, S.torso, C.coat, x => {
            x.fillStyle = C.coatSh; x.fillRect(-40, -80, 30, 100);
            x.strokeStyle = C.coatHi; x.lineWidth = 2.5; x.beginPath(); x.moveTo(20, -50); x.quadraticCurveTo(23, -36, 18, -22); x.stroke();
          });
          paint(c, S.shirt, C.shirt, x => {
            x.fillStyle = C.shirtSh; x.fillRect(-10, -70, 14, 60);
            x.strokeStyle = C.shirtSh; x.lineWidth = 1.2; x.beginPath(); x.moveTo(11, -58); x.lineTo(14, -36); x.moveTo(8, -58); x.lineTo(10, -34); x.stroke();
          });
          paint(c, S.lapel, C.satin, x => { hiLine(x, 4, -60, -32, C.coatHi); });
          paint(c, S.collar, C.shirt);
          // bow tie
          const bt = new Path2D(); bt.moveTo(10, -61); bt.lineTo(2, -66.5); bt.lineTo(1.5, -55.5); bt.closePath(); bt.moveTo(10, -61); bt.lineTo(18.5, -66.5); bt.lineTo(19, -55.5); bt.closePath();
          paint(c, bt, C.pink, x => { x.fillStyle = C.pinkSh; x.fillRect(-5, -62, 30, 6); });
          const knot = new Path2D(); knot.rect(7.8, -63.5, 4.6, 5); paint(c, knot, C.pinkSh);
          // button + watch chain
          c.fillStyle = C.gold; c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(15, -13, 2.6, 0, TAU); c.fill(); c.stroke();
          c.strokeStyle = C.gold; c.lineWidth = 1.6; c.beginPath(); c.moveTo(16, -26); c.quadraticCurveTo(10, -20, 4, -21); c.stroke();
          if (P.expr === 'ouch' || P.expr === 'ko') {       // the monocle has popped out and swings on its cord
            const sw = Math.sin(P.time * 9) * 4;
            c.strokeStyle = C.goldSh; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, -56); c.quadraticCurveTo(8 + sw, -44, 10 + sw, -36); c.stroke();
            c.strokeStyle = C.gold; c.lineWidth = 2.6; c.beginPath(); c.arc(10 + sw, -31, 5.5, 0, TAU); c.stroke();
            c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(10 + sw, -31, 7, 0, TAU); c.stroke();
          }
        } },
      { bone: 'head', draw: (c, P) => drawBaronHead(c, P) },
      { bone: 'upperArmF', draw: c => paint(c, S.upper, C.coat, x => { shadeBack(C.coatSh, 2.5)(x); hiLine(x, 5, 4, 27, C.coatHi); }) },
      { bone: 'foreArmF', draw: c => { paint(c, S.fore, C.coat, x => { shadeBack(C.coatSh, 2)(x); hiLine(x, 4, 3, 21, C.coatHi); }); paint(c, S.cuff, C.shirt); } },
      { bone: 'baton', draw: c => {
          c.fillStyle = '#FFFFFF'; c.fill(S.baton); c.fillStyle = '#E2DCCF'; c.save(); c.clip(S.baton); c.fillRect(-4, 0, 3.4, 60); c.restore();
          c.lineWidth = 1.6; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(S.baton);
          const cork = new Path2D(); cork.ellipse(0, 3, 4.6, 6.5, 0, 0, TAU); paint(c, cork, C.cork, x => { x.fillStyle = '#8E6334'; x.fillRect(-8, -6, 5, 16); });
        } },
      { bone: 'handF', draw: c => paint(c, S.fist, C.glove, x => {
          x.fillStyle = C.gloveSh; x.fillRect(-12, -6, 8, 22);
          x.strokeStyle = C.gloveSh; x.lineWidth = 1.3; x.beginPath(); x.moveTo(1, 6); x.lineTo(7, 6); x.moveTo(1, 9.5); x.lineTo(7, 9.5); x.stroke(); }) }
    ]
  };

  function drawBaronHead(c, P) {
    const e = P.expr;
    paint(c, S.neck, C.skin, x => { x.fillStyle = C.skinSh; x.fillRect(-10, -14, 8, 20); });
    paint(c, S.skull, C.skin, x => {
      x.fillStyle = C.skinSh; x.beginPath(); x.ellipse(-8, -24, 12, 22, 0, 0, TAU); x.fill();
      if (e === 'smug' || e === 'shout') { x.fillStyle = C.blush; x.globalAlpha = .55; x.beginPath(); x.ellipse(9, -17, 6, 3.5, 0, 0, TAU); x.fill(); x.globalAlpha = 1; }
    });
    paint(c, S.ear, C.skin, x => { x.strokeStyle = C.skinSh; x.lineWidth = 1.5; x.beginPath(); x.arc(-4, -25, 2.4, -1.2, 1.6); x.stroke(); });
    paint(c, S.hairTop, C.hair, x => {
      x.fillStyle = C.hairSh; x.fillRect(-30, -30, 20, 20);
      x.strokeStyle = C.hairHi; x.lineWidth = 2; x.beginPath(); x.moveTo(-10, -44); x.quadraticCurveTo(2, -49, 10, -44); x.stroke();
      x.strokeStyle = C.hairSh; x.lineWidth = 1.3; x.beginPath(); x.moveTo(-14, -30); x.quadraticCurveTo(-6, -42, 6, -42); x.moveTo(-15, -24); x.quadraticCurveTo(-9, -34, 0, -38); x.stroke();
    });
    // eye (and brow) by expression
    const ex = 11, ey = -27;
    c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = 'round';
    if (e === 'ko') {
      c.lineWidth = 2.4; c.beginPath(); c.moveTo(ex - 3.5, ey - 3.5); c.lineTo(ex + 3.5, ey + 3.5); c.moveTo(ex + 3.5, ey - 3.5); c.lineTo(ex - 3.5, ey + 3.5); c.stroke();
    } else if (e === 'ouch') {
      c.lineWidth = 2.4; c.beginPath(); c.moveTo(ex - 4, ey - 3); c.lineTo(ex + 2, ey); c.lineTo(ex - 4, ey + 3); c.stroke();
    } else if (e === 'smug') {
      c.lineWidth = 2.4; c.beginPath(); c.arc(ex, ey + 1, 3.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (e === 'focus') {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, 4.2, 2.6, 0, 0, TAU); c.fill(); c.lineWidth = 1.4; c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(ex + 1.4, ey, 1.9, 0, TAU); c.fill();
    } else {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, 4, 4.4, 0, 0, TAU); c.fill(); c.lineWidth = 1.4; c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(ex + (e === 'shout' ? .8 : 1.6), ey + .3, e === 'shout' ? 1.5 : 2.1, 0, TAU); c.fill();
    }
    // the eyebrow: a bushy grey wedge that does most of the acting
    const tilt = { focus: .32, shout: .4, ouch: -.45, ko: -.3, smug: -.35 }[e] || .15;
    c.save(); c.translate(ex - 1, ey - 8); c.rotate(tilt);
    const br = new Path2D(); br.moveTo(-8, 1); br.quadraticCurveTo(-2, -5, 9, -2); br.lineTo(9, 2.5); br.quadraticCurveTo(0, 0, -8, 4); br.closePath();
    paint(c, br, C.hair, x => { x.fillStyle = C.hairSh; x.fillRect(-10, 1.5, 22, 4); });
    c.restore();
    // monocle, unless it's been knocked out
    if (e !== 'ouch' && e !== 'ko') {
      c.strokeStyle = INK; c.lineWidth = 4.2; c.beginPath(); c.arc(ex, ey, 7.4, 0, TAU); c.stroke();
      c.strokeStyle = C.gold; c.lineWidth = 2.4; c.beginPath(); c.arc(ex, ey, 7.4, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.4; c.beginPath(); c.arc(ex, ey, 5, -2.4, -1.5); c.stroke();
      c.strokeStyle = C.goldSh; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex - 6, ey + 4); c.quadraticCurveTo(ex - 10, ey + 16, ex - 8, ey + 26); c.stroke();
    }
    // mouth (only when he's shouting or hurt), under the moustache
    if (e === 'shout' || e === 'ouch') {
      const mo = new Path2D(); mo.ellipse(17, -6, e === 'shout' ? 6 : 4.5, e === 'shout' ? 5.5 : 3.5, 0, 0, TAU);
      paint(c, mo, C.mouth, x => { x.fillStyle = C.tongue; x.beginPath(); x.ellipse(17, -2, 4, 2.5, 0, 0, TAU); x.fill(); });
    }
    paint(c, S.nose, C.skin, x => { x.fillStyle = C.skinSh; x.fillRect(10, -20, 20, 8); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(21, -27, 2.5, 1.5, .6, 0, TAU); x.fill(); });
    paint(c, S.moustache, C.hair, x => {
      x.fillStyle = C.hairSh; x.fillRect(-5, -11, 45, 8);
      x.strokeStyle = C.hairHi; x.lineWidth = 1.6; x.beginPath(); x.moveTo(20, -14); x.quadraticCurveTo(28, -15, 33, -12); x.moveTo(13, -14); x.quadraticCurveTo(7, -14, 3, -16); x.stroke();
    });
  }

  global.BrawlPuppet = {
    Puppet, EASE,
    baron: () => new Puppet(BARON),
    // where the baton's tip is, in this character's own space
    BATON_TIP: { bone: 'baton', x: 0, y: 57 }
  };
})(window);
