/* Jaylee's Playground
 * Sprite sheet: assets/jaylee-sprites.webp — 1343×2000, 8 columns × 11 rows of
 * equal cells. The artwork is drawn straight from the sheet, never edited.
 */
(() => {
  'use strict';

  // ---------- Sprite sheet map ----------
  const SHEET_W = 1343, SHEET_H = 2000;
  const CW = SHEET_W / 8, CH = SHEET_H / 11;

  // Every row of the sheet, what it shows, and where her paws touch the ground
  // (sheet y of the lowest paw in that row, used to plant her feet on the lawn).
  const ROWS = [
    { key: 'sit',     frames: 6, fps: 6,  feet: 176,  name: 'Sit & blink',   note: 'Idle sit, blinks and winks' },
    { key: 'runR',    frames: 8, fps: 13, feet: 330,  name: 'Run right',     note: 'Full gallop cycle →' },
    { key: 'runL',    frames: 8, fps: 13, feet: 512,  name: 'Run left',      note: 'Full gallop cycle ←' },
    { key: 'wave',    frames: 4, fps: 5,  feet: 722,  name: 'Wave hi',       note: 'Lifts a paw to say hello' },
    { key: 'hop',     frames: 5, fps: 8,  feet: 904,  name: 'Hop',           note: 'Crouch, leap, land, stand' },
    { key: 'sniff',   frames: 8, fps: 7,  feet: 1085, name: 'Sniff',         note: 'Nose down to the grass and back' },
    { key: 'curious', frames: 6, fps: 5,  feet: 1268, name: 'Curious',       note: 'Head tilt with a paw lift' },
    { key: 'beg',     frames: 6, fps: 5,  feet: 1450, name: 'Play beg',      note: 'Tongue out, paw swipes' },
    { key: 'wink',    frames: 6, fps: 5,  feet: 1631, name: 'Wink',          note: 'Head tilts and a cheeky wink' },
    { key: 'lookR',   frames: 8, fps: 7,  feet: 1812, name: 'Look right',    note: 'Looks up, turns right, looks down' },
    { key: 'lookL',   frames: 8, fps: 7,  feet: 1994, name: 'Look left',     note: 'Looks down, turns left, looks up' },
  ];
  const ROW = Object.fromEntries(ROWS.map((r, i) => [r.key, i]));
  const SIT_H = 170; // sheet px height of the sitting pose

  const seq = (row, frames, dur) => frames.map((c, i) => ({
    r: ROW[row], c, d: Array.isArray(dur) ? dur[i] : dur,
  }));

  const ANIM = {
    idle: () => [
      { r: 0, c: 0, d: 1.4 + Math.random() * 2.2 },
      ...seq('sit', [1, 2, 3, 4, 5], 0.16),
    ],
    runR: () => seq('runR', [0, 1, 2, 3, 4, 5, 6, 7], 1 / 13),
    runL: () => seq('runL', [0, 1, 2, 3, 4, 5, 6, 7], 1 / 13),
    swimR: () => seq('runR', [0, 1, 2, 3, 4, 5, 6, 7], 1 / 7),
    swimL: () => seq('runL', [0, 1, 2, 3, 4, 5, 6, 7], 1 / 7),
    treadR: () => seq('runR', [1, 2, 3, 2], 0.22),
    treadL: () => seq('runL', [1, 2, 3, 2], 0.22),
    wave: () => seq('wave', [0, 1, 2, 2, 1, 2, 2, 1, 3], [0.2, 0.18, 0.3, 0.2, 0.16, 0.3, 0.3, 0.18, 0.4]),
    hop: () => seq('hop', [0, 1, 2, 3, 4], [0.18, 0.12, 0.18, 0.12, 0.3]),
    sniff: () => seq('sniff', [0, 1, 2, 3, 4, 4, 3, 4, 4, 5, 6, 7], [0.2, 0.14, 0.14, 0.14, 0.4, 0.2, 0.2, 0.2, 0.4, 0.14, 0.14, 0.4]),
    curious: () => seq('curious', [0, 1, 2, 3, 4, 5], [0.3, 0.4, 0.5, 0.3, 0.5, 0.5]),
    beg: () => seq('beg', [0, 1, 2, 3, 4, 5], [0.25, 0.3, 0.25, 0.3, 0.35, 0.4]),
    wink: () => seq('wink', [0, 1, 2, 3, 3, 4, 5], [0.3, 0.3, 0.3, 0.25, 0.25, 0.4, 0.4]),
    look: () => [
      ...seq('lookR', [0, 1, 2, 3, 4, 5, 6, 7], [0.4, 0.14, 0.14, 0.3, 0.14, 0.14, 0.14, 0.5]),
      ...seq('lookL', [0, 1, 2, 3, 4, 5, 6, 7], [0.14, 0.14, 0.14, 0.4, 0.14, 0.14, 0.14, 0.5]),
    ],
    shake: () => seq('lookR', [3, 4, 3, 4, 3], 0.09),
  };
  const DIRECTIONAL = new Set([ROW.runR, ROW.runL]);

  // ---------- Canvas & world ----------
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const bgx = bg.getContext('2d');
  let W = 0, H = 0, DPR = 1, HZ = 0;
  let pool = { x0: 0.56, x1: 0.9, y0: 0.3, y1: 0.78 };
  const BOUNDS = { x0: 0.04, x1: 0.96, y0: 0.07, y1: 0.95 };

  const k = (y) => 0.82 + 0.26 * y; // perspective widening toward the viewer
  const project = (x, y) => ({ x: W / 2 + (x - 0.5) * W * k(y), y: HZ + y * (H - HZ) });
  const unproject = (sx, sy) => {
    const y = (sy - HZ) / (H - HZ);
    return { x: 0.5 + (sx - W / 2) / (W * k(y)), y };
  };
  const scaleAt = (y) => (Math.min(H * 0.3, W * 0.36) / SIT_H) * (0.55 + 0.45 * y);

  const sprite = new Image();
  sprite.src = 'assets/jaylee-sprites.webp';

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const inPool = (x, y, m = 0) => x > pool.x0 - m && x < pool.x1 + m && y > pool.y0 - m && y < pool.y1 + m;
  const clampToPool = (x, y, inset = 0) => ({
    x: clamp(x, pool.x0 + inset, pool.x1 - inset),
    y: clamp(y, pool.y0 + inset, pool.y1 - inset),
  });
  const clampToBounds = (p) => ({ x: clamp(p.x, BOUNDS.x0, BOUNDS.x1), y: clamp(p.y, BOUNDS.y0, BOUNDS.y1) });

  // ---------- State ----------
  const dog = {
    x: 0.3, y: 0.6, face: 1, mode: 'land',
    anim: null, plan: [], step: null, pending: null,
    idleFor: 0, nextAuto: 2.5, wet: 0, rippleT: 0, dripT: 0,
  };
  const ball = { state: 'none', x: 0, y: 0, z: 0, from: null, to: null, t: 0 };
  const particles = [];
  const ripples = [];
  const stats = { fetch: 0, swim: 0, pet: 0 };
  let time = 0;
  let roam = true;
  let marker = null;

  const statusEl = document.getElementById('status');
  let statusText = '';
  const say = (t) => { if (t !== statusText) { statusText = t; statusEl.textContent = t; } };
  const bump = (key) => { stats[key]++; document.getElementById('stat-' + key).textContent = stats[key]; };

  // ---------- Animation playback ----------
  function setAnim(frames, loop = false, name = '') {
    dog.anim = { frames, i: 0, t: 0, loop, done: false, name };
  }
  function tickAnim(a, dt) {
    if (!a || a.done) return;
    a.t += dt;
    while (a.t >= a.frames[a.i].d) {
      a.t -= a.frames[a.i].d;
      if (a.i + 1 >= a.frames.length) {
        if (a.loop) a.i = 0; else { a.done = true; return; }
      } else a.i++;
    }
  }
  const curFrame = () => dog.anim.frames[Math.min(dog.anim.i, dog.anim.frames.length - 1)];

  // ---------- Path planning ----------
  const PAD = 0.05;   // how far she stays from the pool edge on land
  function segHitsPool(a, b) {
    for (let i = 1; i < 30; i++) {
      const t = i / 30;
      if (inPool(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, PAD - 0.006)) return true;
    }
    return false;
  }
  // Walk around the pool instead of through it.
  function landPath(a, b) {
    if (!segHitsPool(a, b)) return [b];
    const c = [
      { x: pool.x0 - PAD, y: pool.y0 - PAD }, { x: pool.x1 + PAD, y: pool.y0 - PAD },
      { x: pool.x1 + PAD, y: pool.y1 + PAD }, { x: pool.x0 - PAD, y: pool.y1 + PAD },
    ].map(clampToBounds);
    const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    let best = null, bestLen = Infinity;
    for (const p of c) {
      if (!segHitsPool(a, p) && !segHitsPool(p, b)) {
        const len = d(a, p) + d(p, b);
        if (len < bestLen) { bestLen = len; best = [p, b]; }
      }
    }
    for (let i = 0; i < 4; i++) for (const j of [(i + 1) % 4, (i + 3) % 4]) {
      const p = c[i], q = c[j];
      if (!segHitsPool(a, p) && !segHitsPool(q, b)) {
        const len = d(a, p) + d(p, q) + d(q, b);
        if (len < bestLen) { bestLen = len; best = [p, q, b]; }
      }
    }
    return best || [b];
  }

  const move = (p) => ({ type: 'move', x: p.x, y: p.y });
  const act = (name, statusMsg) => ({ type: 'anim', name, status: statusMsg });
  const fn = (f) => ({ type: 'fn', f });

  // Nearest pool-edge crossing: outside point O on land, inside point I in water.
  function edgeCrossing(p) {
    const opts = [
      { d: Math.abs(p.x - pool.x0), n: { x: -1, y: 0 }, b: { x: pool.x0, y: clamp(p.y, pool.y0 + 0.06, pool.y1 - 0.06) } },
      { d: Math.abs(p.x - pool.x1), n: { x: 1, y: 0 }, b: { x: pool.x1, y: clamp(p.y, pool.y0 + 0.06, pool.y1 - 0.06) } },
      { d: Math.abs(p.y - pool.y0), n: { x: 0, y: -1 }, b: { x: clamp(p.x, pool.x0 + 0.06, pool.x1 - 0.06), y: pool.y0 } },
      { d: Math.abs(p.y - pool.y1), n: { x: 0, y: 1 }, b: { x: clamp(p.x, pool.x0 + 0.06, pool.x1 - 0.06), y: pool.y1 } },
    ];
    if (!inPool(p.x, p.y)) {
      // From outside: score edges by distance from p to the edge point.
      opts.forEach((o) => { o.d = Math.hypot(p.x - o.b.x, p.y - o.b.y); });
    }
    const o = opts.sort((a, b) => a.d - b.d)[0];
    return {
      O: clampToBounds({ x: o.b.x + o.n.x * 0.055, y: o.b.y + o.n.y * 0.055 }),
      I: { x: o.b.x - o.n.x * 0.07, y: o.b.y - o.n.y * 0.07 },
    };
  }

  function planTo(tx, ty) {
    let target = clampToBounds({ x: tx, y: ty });
    const wantWater = inPool(target.x, target.y);
    if (wantWater) target = clampToPool(target.x, target.y, 0.07);
    else if (inPool(target.x, target.y, PAD)) {
      // Tapped right beside the pool: nudge the spot out onto the deck.
      target = edgeCrossing(target).O;
    }
    const here = { x: dog.x, y: dog.y };
    const plan = [];
    if (dog.mode === 'land' && !wantWater) {
      landPath(here, target).forEach((p) => plan.push(move(p)));
    } else if (dog.mode === 'land' && wantWater) {
      const { O, I } = edgeCrossing(here);
      landPath(here, O).forEach((p) => plan.push(move(p)));
      plan.push({ type: 'jump', x: I.x, y: I.y, into: 'water' });
      plan.push(move(target));
    } else if (dog.mode === 'water' && wantWater) {
      plan.push(move(target));
    } else {
      const { O, I } = edgeCrossing(target);
      plan.push(move(I));
      plan.push({ type: 'jump', x: O.x, y: O.y, into: 'land' });
      plan.push(fn(() => { dog.wet = 4; splash(O.x, O.y, 14, 'drop'); }));
      plan.push(act('shake', 'Shake it off!'));
      if (Math.hypot(O.x - target.x, O.y - target.y) > 0.02) {
        landPath(O, target).forEach((p) => plan.push(move(p)));
      }
    }
    return plan;
  }

  // Get her back on dry land (if needed) before a trick.
  const trickPlan = (name, msg) => () => {
    const plan = [];
    if (dog.mode === 'water') {
      const { O } = edgeCrossing({ x: dog.x, y: dog.y });
      plan.push(...planTo(O.x, O.y));
    }
    plan.push(act(name, msg));
    return plan;
  };

  function command(makePlan) {
    dog.idleFor = 0;
    dog.nextAuto = rand(5, 9);
    if (ball.state === 'held') { ball.state = 'rest'; ball.x = dog.x; ball.y = clamp(dog.y + 0.02, BOUNDS.y0, BOUNDS.y1); }
    if (dog.step && dog.step.type === 'jump') { dog.pending = makePlan; return; }
    const plan = makePlan();
    if (!plan) return;
    dog.step = null;
    dog.plan = plan;
  }

  // ---------- Actions ----------
  const ACTIONS = {
    sit: trickPlan('idle', 'Jaylee sits pretty'),
    wave: trickPlan('wave', 'Jaylee waves hi!'),
    hop: () => [...trickPlan('idle', '')().slice(0, -1), { type: 'jump', x: dog.x, y: dog.y, into: 'land', hop: true }],
    sniff: trickPlan('sniff', 'Sniffing out something interesting…'),
    curious: trickPlan('curious', 'Jaylee is curious'),
    beg: trickPlan('beg', 'Play with me?'),
    wink: trickPlan('wink', 'A cheeky wink'),
    look: trickPlan('look', 'Jaylee looks around the yard'),
    swim: () => {
      const p = dog.mode === 'water'
        ? { x: rand(pool.x0, pool.x1), y: rand(pool.y0, pool.y1) }
        : { x: (pool.x0 + pool.x1) / 2 + rand(-0.1, 0.1), y: (pool.y0 + pool.y1) / 2 + rand(-0.08, 0.08) };
      return planTo(p.x, p.y);
    },
    zoomies: () => {
      const plan = [fn(() => say('ZOOMIES!'))];
      let last = { x: dog.x, y: dog.y };
      let mode = dog.mode;
      if (mode === 'water') {
        const { O } = edgeCrossing(last);
        plan.push(...planTo(O.x, O.y));
        last = O;
      }
      for (let i = 0; i < 5; i++) {
        let p;
        do { p = { x: rand(BOUNDS.x0, BOUNDS.x1), y: rand(BOUNDS.y0 + 0.05, BOUNDS.y1) }; }
        while (inPool(p.x, p.y, PAD + 0.02));
        landPath(last, p).forEach((q) => plan.push(move(q)));
        last = p;
      }
      plan.push(act('beg', 'Phew! That was fun'));
      return plan;
    },
    ball: () => {
      if (ball.state === 'air') return null;
      let to;
      if (Math.random() < 0.3) to = { x: rand(pool.x0 + 0.08, pool.x1 - 0.08), y: rand(pool.y0 + 0.08, pool.y1 - 0.08) };
      else {
        do { to = { x: rand(BOUNDS.x0 + 0.03, BOUNDS.x1 - 0.03), y: rand(BOUNDS.y0 + 0.05, BOUNDS.y1 - 0.03) }; }
        while (inPool(to.x, to.y, PAD + 0.03) || Math.hypot(to.x - dog.x, to.y - dog.y) < 0.25);
      }
      ball.state = 'air';
      ball.from = { x: dog.x, y: dog.y };
      ball.to = to;
      ball.t = 0;
      say('Ball! Ball! Ball!');
      return [{ type: 'waitBall' }, fn(() => say('Jaylee is after the ball')), ...planTo(to.x, to.y), fn(fetchBall)];
    },
  };

  function fetchBall() {
    if (ball.state !== 'rest') return;
    ball.state = 'held';
    bump('fetch');
    hearts(dog.x, dog.y, 4);
    dog.plan.unshift(
      act(dog.mode === 'water' ? 'treadR' : 'beg', 'Got it! Good girl'),
      fn(() => {
        ball.state = 'rest';
        ball.x = clamp(dog.x + dog.face * 0.04, BOUNDS.x0, BOUNDS.x1);
        ball.y = clamp(dog.y + 0.02, BOUNDS.y0, BOUNDS.y1);
        ball.z = 0;
      }),
    );
  }

  // ---------- Particles ----------
  function splash(x, y, n, kind = 'splash') {
    const p = project(x, y), s = scaleAt(y);
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = rand(60, 200) * s;
      particles.push({ kind: 'drop', x: p.x + rand(-30, 30) * s, y: p.y - (kind === 'drop' ? rand(40, 100) * s : 0),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520 * s, r: rand(1.5, 3.5) * Math.max(s, 0.6), life: rand(0.5, 0.9), t: 0, floor: p.y });
    }
    if (kind === 'splash') for (let i = 0; i < 3; i++) ripples.push({ x, y, r: 0.01 * i, life: 1.4, t: -i * 0.15 });
  }
  function hearts(x, y, n) {
    const p = project(x, y), s = scaleAt(y);
    for (let i = 0; i < n; i++) {
      particles.push({ kind: 'heart', x: p.x + rand(-40, 40) * s, y: p.y - rand(120, 170) * s,
        vx: rand(-20, 20), vy: rand(-70, -40), g: 0, r: rand(7, 12) * Math.max(s, 0.7), life: rand(1.1, 1.6), t: 0 });
    }
  }

  // ---------- Update ----------
  function startStep(s) {
    dog.step = s;
    s.t = 0;
    if (s.type === 'anim') {
      const frames = ANIM[s.name]();
      setAnim(frames, false, s.name);
      if (s.status) say(s.status);
    } else if (s.type === 'jump') {
      if (s.hop) { s.x = dog.x; s.y = dog.y; }
      s.from = { x: dog.x, y: dog.y };
      const dx = project(s.x, s.y).x - project(dog.x, dog.y).x;
      if (Math.abs(dx) > 3) dog.face = Math.sign(dx);
      const frames = s.into === 'water' ? ANIM.hop().slice(0, 4) : s.hop ? ANIM.hop() : ANIM.hop().slice(1);
      s.dur = frames.reduce((a, f) => a + f.d, 0);
      setAnim(frames, false, 'jump');
      if (s.hop) say('Boing!');
      else if (s.into === 'water') say('Cannonball!');
      else say('Climbing out…');
    } else if (s.type === 'fn') {
      s.f();
      dog.step = null;
    }
  }

  function update(dt) {
    time += dt;

    if (!dog.step && dog.plan.length) startStep(dog.plan.shift());
    const s = dog.step;

    if (s) {
      s.t += dt;
      if (s.type === 'move') {
        const a = project(dog.x, dog.y), b = project(s.x, s.y);
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const water = dog.mode === 'water';
        const speed = SIT_H * scaleAt(dog.y) * (water ? 0.75 : 2.4);
        if (Math.abs(dx) > 2) dog.face = Math.sign(dx);
        const want = water ? (dog.face > 0 ? 'swimR' : 'swimL') : (dog.face > 0 ? 'runR' : 'runL');
        if (!dog.anim || dog.anim.name !== want) setAnim(ANIM[want](), true, want);
        if (water) {
          say('Jaylee is swimming laps');
          dog.rippleT -= dt;
          if (dog.rippleT <= 0) { ripples.push({ x: dog.x, y: dog.y, r: 0, life: 1.2, t: 0 }); dog.rippleT = 0.28; }
        } else if (!statusText.startsWith('Ball') && !statusText.startsWith('ZOOM') && !statusText.startsWith('Jaylee is after')) {
          say('Jaylee is on her way');
        }
        if (d <= speed * dt || d < 0.5) {
          dog.x = s.x; dog.y = s.y; dog.step = null;
        } else {
          const n = unproject(a.x + (dx / d) * speed * dt, a.y + (dy / d) * speed * dt);
          dog.x = n.x; dog.y = n.y;
        }
      } else if (s.type === 'jump') {
        const lead = s.into === 'water' ? 0.18 : (s.hop ? 0.18 : 0);
        const p = clamp((s.t - lead) / Math.max(0.1, s.dur - lead - 0.15), 0, 1);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        dog.x = s.from.x + (s.x - s.from.x) * e;
        dog.y = s.from.y + (s.y - s.from.y) * e;
        if (s.into === 'water' && p > 0.7 && dog.mode !== 'water') {
          dog.mode = 'water';
          splash(s.x, s.y, 26);
          bump('swim');
        }
        if (s.into === 'land' && !s.hop && p > 0.3 && dog.mode !== 'land') dog.mode = 'land';
        tickAnim(dog.anim, dt);
        if (s.t >= s.dur) {
          dog.x = s.x; dog.y = s.y;
          dog.mode = s.into;
          dog.step = null;
          if (dog.pending) { dog.plan = dog.pending() || dog.plan; dog.pending = null; }
        }
      } else if (s.type === 'anim') {
        tickAnim(dog.anim, dt);
        if (dog.anim.done) dog.step = null;
      } else if (s.type === 'waitBall') {
        const w = dog.mode === 'water' ? (dog.face > 0 ? 'treadR' : 'treadL') : 'idle';
        if (!dog.anim || dog.anim.name !== w) setAnim(ANIM[w](), true, w);
        tickAnim(dog.anim, dt);
        if (ball.state === 'rest') dog.step = null;
      }
      if (s.type !== 'move' && s.type !== 'jump' && s.type !== 'anim' && s.type !== 'waitBall') dog.step = null;
      dog.idleFor = 0;
    } else {
      // Idle
      const want = dog.mode === 'water' ? (dog.face > 0 ? 'treadR' : 'treadL') : 'idle';
      if (!dog.anim || dog.anim.name !== want || dog.anim.done) setAnim(ANIM[want](), want !== 'idle', want);
      tickAnim(dog.anim, dt);
      dog.idleFor += dt;
      if (dog.idleFor > 0.4) say(dog.mode === 'water' ? 'Jaylee is paddling around' : pick0(['Jaylee is chilling', 'Jaylee is waiting for you']));
      if (roam && dog.idleFor > dog.nextAuto) autoplay();
    }

    if (dog.mode === 'water') { dog.rippleT -= dt * 0.35; if (dog.rippleT <= 0) { ripples.push({ x: dog.x, y: dog.y, r: 0, life: 1.6, t: 0 }); dog.rippleT = 0.9; } }

    // Wet fur drips after a swim
    if (dog.wet > 0 && dog.mode === 'land') {
      dog.wet -= dt;
      dog.dripT -= dt;
      if (dog.dripT <= 0) { splash(dog.x, dog.y, 1, 'drop'); dog.dripT = 0.12; }
    }

    // Ball flight
    if (ball.state === 'air') {
      ball.t += dt / 1.05;
      const t = Math.min(ball.t, 1);
      ball.x = ball.from.x + (ball.to.x - ball.from.x) * t;
      ball.y = ball.from.y + (ball.to.y - ball.from.y) * t;
      ball.z = 4 * t * (1 - t) * 1.0 + 0.25 * (1 - t);
      if (ball.t >= 1) {
        ball.state = 'rest'; ball.z = 0;
        if (inPool(ball.x, ball.y)) splash(ball.x, ball.y, 10);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t > p.life || (p.floor && p.y > p.floor + 4)) particles.splice(i, 1);
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.t += dt;
      if (r.t > r.life) ripples.splice(i, 1);
    }
  }

  let lastIdleMsg = '';
  function pick0(arr) { if (!lastIdleMsg) lastIdleMsg = pick(arr); return lastIdleMsg; }

  function autoplay() {
    lastIdleMsg = '';
    if (dog.mode === 'water') {
      if (Math.random() < 0.55) command(ACTIONS.swim);
      else command(() => {
        let p;
        do { p = { x: rand(BOUNDS.x0, BOUNDS.x1), y: rand(BOUNDS.y0 + 0.05, BOUNDS.y1) }; } while (inPool(p.x, p.y, PAD + 0.03));
        return planTo(p.x, p.y);
      });
      return;
    }
    const choices = [
      ['wander', 30], ['sniff', 12], ['curious', 8], ['beg', 6], ['wink', 8],
      ['look', 10], ['wave', 5], ['hop', 5], ['swim', 12], ['zoomies', 3],
    ];
    let r = Math.random() * choices.reduce((a, c) => a + c[1], 0);
    let choice = choices[0][0];
    for (const [name, w] of choices) { if ((r -= w) < 0) { choice = name; break; } }
    if (choice === 'wander') {
      command(() => {
        let p;
        do { p = { x: clamp(dog.x + rand(-0.4, 0.4), BOUNDS.x0, BOUNDS.x1), y: clamp(dog.y + rand(-0.3, 0.3), BOUNDS.y0 + 0.05, BOUNDS.y1) }; }
        while (inPool(p.x, p.y, PAD + 0.02));
        return [...planTo(p.x, p.y), ...(Math.random() < 0.5 ? [act('sniff', 'Sniffing around…')] : [])];
      });
    } else command(ACTIONS[choice]);
  }

  // ---------- Background (rendered once per resize) ----------
  function seeded(seed) {
    return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  function paintBackground() {
    bg.width = Math.round(W * DPR);
    bg.height = Math.round(H * DPR);
    const g = bgx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const R = seeded(42);

    // Sky
    let gr = g.createLinearGradient(0, 0, 0, HZ);
    gr.addColorStop(0, '#9fcbe6');
    gr.addColorStop(0.7, '#d9ebf1');
    gr.addColorStop(1, '#f6eadb');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, HZ + 2);
    // Warm sun glow
    gr = g.createRadialGradient(W * 0.82, HZ * 0.25, 0, W * 0.82, HZ * 0.25, W * 0.45);
    gr.addColorStop(0, 'rgba(255, 233, 196, 0.85)');
    gr.addColorStop(1, 'rgba(255, 233, 196, 0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, HZ);

    // Distant tree line
    const blob = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    for (let x = -20; x < W + 40; x += 26 + R() * 30) blob(x, HZ - 18 - R() * 30, 24 + R() * 30, `rgba(${88 + R() * 20 | 0}, ${128 + R() * 20 | 0}, ${96 + R() * 10 | 0}, 0.55)`);
    // Hedge
    for (let x = -20; x < W + 30; x += 14 + R() * 14) blob(x, HZ - 4 - R() * 8, 14 + R() * 12, `rgb(${52 + R() * 18 | 0}, ${102 + R() * 22 | 0}, ${54 + R() * 14 | 0})`);
    for (let x = -10; x < W + 20; x += 10 + R() * 12) blob(x, HZ - 10 - R() * 10, 6 + R() * 6, `rgba(150, 196, 110, ${0.25 + R() * 0.2})`);

    // Lawn
    gr = g.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, '#a6c777');
    gr.addColorStop(0.35, '#7fb456');
    gr.addColorStop(1, '#4f8f36');
    g.fillStyle = gr;
    g.fillRect(0, HZ, W, H - HZ);

    // Mowing stripes converging to the horizon
    const N = 16;
    for (let i = -6; i < N + 6; i++) {
      if (i % 2) continue;
      const xa = i / N, xb = (i + 1) / N;
      const p1 = project(xa, 0), p2 = project(xb, 0), p3 = project(xb, 1.15), p4 = project(xa, 1.15);
      g.fillStyle = 'rgba(255, 255, 230, 0.06)';
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.lineTo(p4.x, p4.y); g.closePath(); g.fill();
    }
    // Haze where the lawn meets the hedge
    gr = g.createLinearGradient(0, HZ, 0, HZ + (H - HZ) * 0.18);
    gr.addColorStop(0, 'rgba(40, 70, 35, 0.35)');
    gr.addColorStop(1, 'rgba(40, 70, 35, 0)');
    g.fillStyle = gr;
    g.fillRect(0, HZ, W, (H - HZ) * 0.18);

    // Grass blades
    const blades = Math.min(5200, (W * (H - HZ)) / 55);
    g.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const y = Math.pow(R(), 0.8);
      const sy = HZ + y * (H - HZ);
      const sx = R() * W;
      const len = (2 + 7 * y) * (0.6 + R() * 0.8);
      g.strokeStyle = R() < 0.5 ? `rgba(40, 92, 30, ${0.2 + 0.25 * y})` : `rgba(190, 220, 130, ${0.12 + 0.2 * y})`;
      g.lineWidth = 0.6 + y;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (R() - 0.5) * len * 0.6, sy - len); g.stroke();
    }
    // A few tiny flowers
    for (let i = 0; i < 40; i++) {
      const y = R() * 0.9 + 0.03, x = R();
      if (inPool(x, y, 0.08)) continue;
      const p = project(x, y), s = scaleAt(y);
      g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.85)' : 'rgba(240, 140, 175, .85)';
      g.beginPath(); g.arc(p.x, p.y, 1.6 + 2.2 * s, 0, Math.PI * 2); g.fill();
    }

    // Vignette
    gr = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.85);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(20, 30, 10, 0.28)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  // ---------- Pool ----------
  function poolPath(c, inset = 0) {
    const corners = [
      project(pool.x0 + inset, pool.y0 + inset), project(pool.x1 - inset, pool.y0 + inset),
      project(pool.x1 - inset, pool.y1 - inset), project(pool.x0 + inset, pool.y1 - inset),
    ];
    const r = 14;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4], prev = corners[(i + 3) % 4];
      const l1 = Math.hypot(a.x - prev.x, a.y - prev.y), l2 = Math.hypot(b.x - a.x, b.y - a.y);
      const s1 = { x: a.x + (prev.x - a.x) * (r / l1), y: a.y + (prev.y - a.y) * (r / l1) };
      const e1 = { x: a.x + (b.x - a.x) * (r / l2), y: a.y + (b.y - a.y) * (r / l2) };
      if (i === 0) c.moveTo(s1.x, s1.y); else c.lineTo(s1.x, s1.y);
      c.quadraticCurveTo(a.x, a.y, e1.x, e1.y);
    }
    c.closePath();
    return corners;
  }

  function drawPool() {
    const c = ctx;
    // Deck / coping
    const deckW = Math.max(10, W * 0.022);
    c.save();
    poolPath(c);
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(30, 40, 20, 0.22)';
    c.lineWidth = deckW * 2 + 6;
    c.stroke();
    c.strokeStyle = '#efe5d7';
    c.lineWidth = deckW * 2;
    c.stroke();
    c.strokeStyle = 'rgba(160, 140, 120, 0.35)';
    c.lineWidth = 1;
    c.stroke();

    // Water
    const corners = poolPath(c);
    c.clip();
    const top = corners[0].y, bottom = corners[2].y;
    let gr = c.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, '#2f9fb8');
    gr.addColorStop(0.5, '#4cc0d0');
    gr.addColorStop(1, '#7fd9df');
    c.fillStyle = gr;
    c.fillRect(0, top - 10, W, bottom - top + 20);

    // Shadowed far wall
    gr = c.createLinearGradient(0, top, 0, top + (bottom - top) * 0.22);
    gr.addColorStop(0, 'rgba(10, 60, 80, 0.45)');
    gr.addColorStop(1, 'rgba(10, 60, 80, 0)');
    c.fillStyle = gr;
    c.fillRect(0, top, W, (bottom - top) * 0.22);

    // Caustics
    c.lineWidth = 1.4;
    for (let j = 0; j < 22; j++) {
      const wy = pool.y0 + (j + 0.5) / 22 * (pool.y1 - pool.y0);
      c.strokeStyle = `rgba(255, 255, 255, ${0.08 + 0.1 * (j / 22)})`;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const wx = pool.x0 + (i / 40) * (pool.x1 - pool.x0);
        const off = Math.sin(wx * 60 + time * 1.6 + j * 1.3) * 0.006 + Math.sin(wx * 23 - time * 1.1 + j) * 0.005;
        const p = project(wx, wy + off);
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.stroke();
    }
    // Sky reflection sheen
    gr = c.createLinearGradient(corners[0].x, top, corners[2].x, bottom);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.fillRect(0, top, W, bottom - top);

    // Ripples
    for (const r of ripples) {
      if (r.t < 0) continue;
      const p = project(r.x, r.y), s = scaleAt(r.y);
      const rr = (20 + r.t * 70) * s;
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r.t / r.life)})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(p.x, p.y, rr, rr * 0.32, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  // ---------- Dog & ball ----------
  function drawShadow(x, y, w, alpha = 0.28) {
    const p = project(x, y), s = scaleAt(y);
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * s);
    gr.addColorStop(0, `rgba(25, 40, 15, ${alpha})`);
    gr.addColorStop(1, 'rgba(25, 40, 15, 0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * s, w * s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  let dogRect = null;
  function drawDog() {
    if (!dog.anim) return;
    const f = curFrame();
    const p = project(dog.x, dog.y), s = scaleAt(dog.y);
    const step = dog.step;

    // How deep she sits in the water (sheet px below the waterline)
    let sink = 0;
    if (dog.mode === 'water') sink = 46;
    if (step && step.type === 'jump' && !step.hop) {
      const prog = clamp(step.t / step.dur, 0, 1);
      if (step.into === 'water') sink = prog > 0.7 ? 46 * Math.min(1, (prog - 0.7) / 0.25) : 0;
      else sink = prog < 0.3 ? 46 * (1 - prog / 0.3) : 0;
    }
    const bob = sink ? Math.sin(time * 3.2) * 2.2 * s : 0;

    if (!sink) drawShadow(dog.x, dog.y, 62);

    const feetOff = (ROWS[f.r].feet - f.r * CH) * s;
    const mirror = !DIRECTIONAL.has(f.r) && dog.face < 0;
    ctx.save();
    if (sink) {
      ctx.beginPath();
      ctx.rect(0, 0, W, p.y + bob);
      ctx.clip();
    }
    ctx.translate(p.x, p.y + sink * s + bob);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(sprite, f.c * CW, f.r * CH, CW, CH, -CW * s / 2, -feetOff, CW * s, CH * s);
    ctx.restore();
    dogRect = { x: p.x - CW * s * 0.4, y: p.y - feetOff + sink * s + CH * s * 0.05, w: CW * s * 0.8, h: feetOff * 0.95 - sink * s };

    if (sink) {
      // Waterline around her body
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + bob, 46 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120, 215, 225, 0.35)';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBall() {
    if (ball.state === 'none' || ball.state === 'held') return;
    const s = scaleAt(ball.y);
    const r = 11 * Math.max(s, 0.55);
    const p = project(ball.x, ball.y);
    const floating = ball.state === 'rest' && inPool(ball.x, ball.y);
    if (!floating) drawShadow(ball.x, ball.y, 16 + 10 * (1 - Math.min(1, ball.z)), 0.3 * (1 - Math.min(0.7, ball.z * 0.6)));
    const y = p.y - r - ball.z * (H - HZ) * 0.45 + (floating ? r * 0.5 + Math.sin(time * 3) * 1.5 : 0);
    const gr = ctx.createRadialGradient(p.x - r * 0.35, y - r * 0.35, r * 0.1, p.x, y, r);
    gr.addColorStop(0, '#ffd1e0');
    gr.addColorStop(0.5, '#ec6f99');
    gr.addColorStop(1, '#b8406a');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath(); ctx.arc(p.x - r * 0.9, y, r * 0.95, -0.9, 0.9); ctx.stroke();
    if (floating) {
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.6, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawHeart(x, y, r, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ef5f92';
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.bezierCurveTo(-r * 1.1, -r * 0.35, -r * 0.5, -r * 1.05, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.1, -r * 0.35, 0, r * 0.35);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.t / p.life;
      if (p.kind === 'heart') drawHeart(p.x, p.y, p.r, Math.min(1, a * 1.5));
      else {
        ctx.fillStyle = `rgba(225, 248, 255, ${0.85 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (marker) {
      marker.t += 1 / 60;
      const a = 1 - marker.t / 0.6;
      if (a <= 0) marker = null;
      else {
        const p = project(marker.x, marker.y), s = scaleAt(marker.y);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, (14 + 30 * marker.t) * s, (4 + 9 * marker.t) * s, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawClouds() {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const clouds = [[0.15, 0.25, 1], [0.55, 0.15, 0.8], [0.9, 0.35, 0.65]];
    for (const [cx, cy, sz] of clouds) {
      const x = ((cx * W + time * 6 * sz) % (W + 240)) - 120;
      const y = cy * HZ, r = 22 * sz * Math.max(0.7, W / 1100);
      for (const [ox, oy, rr] of [[0, 0, 1], [1.1, 0.2, 0.8], [-1.1, 0.25, 0.75], [0.5, -0.45, 0.75]]) {
        ctx.beginPath(); ctx.arc(x + ox * r, y + oy * r, rr * r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bg, 0, 0, W, H);
    drawClouds();
    drawPool();
    // Depth-sort the ball and the dog
    const items = [{ y: dog.y, draw: drawDog }];
    if (ball.state !== 'none') items.push({ y: ball.y, draw: drawBall });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    drawParticles();
  }

  // ---------- Layout ----------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    HZ = H * (W < H ? 0.24 : 0.3);
    pool = W < H * 0.95
      ? { x0: 0.14, x1: 0.86, y0: 0.56, y1: 0.86 }
      : { x0: 0.57, x1: 0.9, y0: 0.3, y1: 0.76 };
    // Keep Jaylee somewhere sensible after a layout change
    if (dog.mode === 'water' && !inPool(dog.x, dog.y)) { const q = clampToPool(dog.x, dog.y, 0.07); dog.x = q.x; dog.y = q.y; }
    if (dog.mode === 'land' && inPool(dog.x, dog.y, PAD)) { const q = edgeCrossing({ x: dog.x, y: dog.y }).O; dog.x = q.x; dog.y = q.y; }
    paintBackground();
  }
  let layoutKey = '';
  window.addEventListener('resize', () => {
    resize();
    // Only drop her current route if the yard layout itself changed.
    const key = JSON.stringify(pool);
    if (key !== layoutKey) { layoutKey = key; dog.step = null; dog.plan = []; }
  });

  // ---------- Input ----------
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (dogRect && sx > dogRect.x && sx < dogRect.x + dogRect.w && sy > dogRect.y && sy < dogRect.y + dogRect.h) {
      bump('pet');
      hearts(dog.x, dog.y, 5);
      say(pick(['Jaylee loves that!', 'Belly rubs please', 'Who is a good girl?']));
      if (dog.mode === 'land' && !dog.step) command(trickPlan(pick(['wave', 'beg', 'wink', 'curious'])));
      return;
    }
    if (sy < HZ - 4) return;
    const w = unproject(sx, sy);
    marker = { x: w.x, y: w.y, t: 0 };
    command(() => planTo(w.x, w.y));
  });

  document.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => command(ACTIONS[b.dataset.act]));
  });
  document.getElementById('roam').addEventListener('change', (e) => { roam = e.target.checked; dog.idleFor = 0; });

  // ---------- Move-set gallery ----------
  const GALLERY_ACT = { sit: 'sit', runR: 'zoomies', runL: 'zoomies', wave: 'wave', hop: 'hop', sniff: 'sniff', curious: 'curious', beg: 'beg', wink: 'wink', lookR: 'look', lookL: 'look' };
  const thumbs = ROWS.map((row, r) => {
    const btn = document.createElement('button');
    btn.className = 'move';
    btn.type = 'button';
    const cv = document.createElement('canvas');
    cv.width = 220; cv.height = 220;
    btn.append(cv);
    btn.insertAdjacentHTML('beforeend', `<strong>${row.name}</strong><small>Row ${r + 1} · ${row.frames} frames · ${row.note}</small>`);
    btn.addEventListener('click', () => {
      command(ACTIONS[GALLERY_ACT[row.key]]);
      canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.getElementById('moves').append(btn);
    return { cv, g: cv.getContext('2d'), r, row };
  });
  function drawThumbs() {
    for (const t of thumbs) {
      const c = Math.floor(time * t.row.fps) % t.row.frames;
      const s = 200 / CW * 0.92;
      t.g.clearRect(0, 0, 220, 220);
      const feet = (t.row.feet - t.r * CH);
      t.g.drawImage(sprite, c * CW, t.r * CH, CW, CH, 110 - CW * s / 2, 205 - feet * s, CW * s, CH * s);
    }
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    drawThumbs();
    requestAnimationFrame(frame);
  }

  function start() {
    resize();
    layoutKey = JSON.stringify(pool);
    setAnim(ANIM.idle(), false, 'idle');
    say('Hi! I’m Jaylee');
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  if (sprite.complete && sprite.naturalWidth) start();
  else sprite.addEventListener('load', start, { once: true });
})();
