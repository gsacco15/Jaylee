/** Canvas renderer for the yard, pool, dogs, toys and effects. */
import type { Game } from './game.js';
import type { Dog } from './dog.js';
import type { Vec } from './types.js';

interface Particle { kind: 'drop' | 'heart'; x: number; y: number; vx: number; vy: number; g: number; r: number; life: number; t: number; floor?: number }
interface Ripple { at: Vec; t: number; life: number }

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

function seeded(seed: number): () => number {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bg = document.createElement('canvas');
  private dpr = 1;
  private particles: Particle[] = [];
  private ripples: Ripple[] = [];
  private marker: { at: Vec; t: number } | null = null;
  /** Screen-space boxes around each dog (draw order), for tapping. */
  private dogBoxes: Array<{ dog: Dog; x: number; y: number; w: number; h: number }> = [];
  private tags: Array<{ x: number; y: number; name: string; color: string; size: number }> = [];
  private readonly images = new Map<string, HTMLImageElement>();

  constructor(private readonly canvas: HTMLCanvasElement, private readonly game: Game, preload: readonly HTMLImageElement[] = []) {
    for (const img of preload) this.images.set(img.getAttribute('src') ?? img.src, img);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
  }

  private get W(): number { return this.game.cam.W; }
  private get H(): number { return this.game.cam.H; }
  private get HZ(): number { return this.game.cam.HZ; }
  private p(v: Vec): Vec { return this.game.cam.project(v); }
  private s(y: number): number { return this.game.cam.scaleAt(y); }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.game.cam.resize(r.width, r.height);
    this.game.yard.layout(r.width < r.height * 0.95);
    this.paintBackground();
  }

  tapMarker(at: Vec): void { this.marker = { at, t: 0 }; }

  // ---------- Effects ----------
  private consumeFx(): void {
    for (const f of this.game.fx.splice(0)) {
      if (f.type === 'ripple') this.ripples.push({ at: f.at, t: 0, life: 1.4 });
      else if (f.type === 'hearts') this.hearts(f.at, f.n);
      else this.splash(f.at, f.type === 'drip' ? 1 : f.n, f.type === 'drip');
    }
  }

  private splash(at: Vec, n: number, fromFur: boolean): void {
    const p = this.p(at), s = this.s(at.y);
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(60, 200) * s;
      this.particles.push({ kind: 'drop', x: p.x + rnd(-30, 30) * s, y: p.y - (fromFur ? rnd(40, 100) * s : 0),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520 * s, r: rnd(1.5, 3.5) * Math.max(s, 0.6), life: rnd(0.5, 0.9), t: 0, floor: p.y });
    }
    if (!fromFur && n > 5) for (let i = 0; i < 3; i++) this.ripples.push({ at, t: -i * 0.15, life: 1.4 });
  }

  private hearts(at: Vec, n: number): void {
    const p = this.p(at), s = this.s(at.y);
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'heart', x: p.x + rnd(-40, 40) * s, y: p.y - rnd(120, 170) * s,
        vx: rnd(-20, 20), vy: rnd(-70, -40), g: 0, r: rnd(7, 12) * Math.max(s, 0.7), life: rnd(1.1, 1.6), t: 0 });
    }
  }

  private stepFx(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      return p.t < p.life && !(p.floor !== undefined && p.y > p.floor + 4);
    });
    this.ripples = this.ripples.filter((r) => (r.t += dt) < r.life);
    if (this.marker && (this.marker.t += dt) > 0.6) this.marker = null;
  }

  // ---------- Background ----------
  private paintBackground(): void {
    const { W, H, HZ } = this;
    this.bg.width = Math.round(W * this.dpr);
    this.bg.height = Math.round(H * this.dpr);
    const g = this.bg.getContext('2d');
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const R = seeded(42);

    let gr = g.createLinearGradient(0, 0, 0, HZ);
    gr.addColorStop(0, '#9fcbe6'); gr.addColorStop(0.7, '#d9ebf1'); gr.addColorStop(1, '#f6eadb');
    g.fillStyle = gr; g.fillRect(0, 0, W, HZ + 2);
    gr = g.createRadialGradient(W * 0.82, HZ * 0.25, 0, W * 0.82, HZ * 0.25, W * 0.45);
    gr.addColorStop(0, 'rgba(255, 233, 196, 0.85)'); gr.addColorStop(1, 'rgba(255, 233, 196, 0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, HZ);

    const blob = (x: number, y: number, r: number, c: string): void => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    for (let x = -20; x < W + 40; x += 26 + R() * 30) blob(x, HZ - 18 - R() * 30, 24 + R() * 30, `rgba(${88 + R() * 20 | 0}, ${128 + R() * 20 | 0}, ${96 + R() * 10 | 0}, 0.55)`);
    for (let x = -20; x < W + 30; x += 14 + R() * 14) blob(x, HZ - 4 - R() * 8, 14 + R() * 12, `rgb(${52 + R() * 18 | 0}, ${102 + R() * 22 | 0}, ${54 + R() * 14 | 0})`);
    for (let x = -10; x < W + 20; x += 10 + R() * 12) blob(x, HZ - 10 - R() * 10, 6 + R() * 6, `rgba(150, 196, 110, ${0.25 + R() * 0.2})`);

    gr = g.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, '#a6c777'); gr.addColorStop(0.35, '#7fb456'); gr.addColorStop(1, '#4f8f36');
    g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);

    // Mowing stripes converging to the horizon
    const N = 16;
    g.fillStyle = 'rgba(255, 255, 230, 0.06)';
    for (let i = -6; i < N + 6; i += 2) {
      const a = this.p({ x: i / N, y: 0 }), b = this.p({ x: (i + 1) / N, y: 0 });
      const c = this.p({ x: (i + 1) / N, y: 1.15 }), d = this.p({ x: i / N, y: 1.15 });
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
    }
    gr = g.createLinearGradient(0, HZ, 0, HZ + (H - HZ) * 0.18);
    gr.addColorStop(0, 'rgba(40, 70, 35, 0.35)'); gr.addColorStop(1, 'rgba(40, 70, 35, 0)');
    g.fillStyle = gr; g.fillRect(0, HZ, W, (H - HZ) * 0.18);

    const blades = Math.min(5200, (W * (H - HZ)) / 55);
    g.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const y = Math.pow(R(), 0.8), sy = HZ + y * (H - HZ), sx = R() * W;
      const len = (2 + 7 * y) * (0.6 + R() * 0.8);
      g.strokeStyle = R() < 0.5 ? `rgba(40, 92, 30, ${0.2 + 0.25 * y})` : `rgba(190, 220, 130, ${0.12 + 0.2 * y})`;
      g.lineWidth = 0.6 + y;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (R() - 0.5) * len * 0.6, sy - len); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const v = { x: R(), y: R() * 0.9 + 0.03 };
      const white = R() < 0.5;
      if (this.game.yard.inPool(v, 0.08)) continue;
      const p = this.p(v);
      g.fillStyle = white ? 'rgba(255,255,255,.85)' : 'rgba(240, 140, 175, .85)';
      g.beginPath(); g.arc(p.x, p.y, 1.6 + 2.2 * this.s(v.y), 0, Math.PI * 2); g.fill();
    }
    gr = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.85);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20, 30, 10, 0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  // ---------- Pool ----------
  private poolPath(): Vec[] {
    const r = this.game.yard.pool, c = this.ctx;
    const k = [this.p({ x: r.x0, y: r.y0 }), this.p({ x: r.x1, y: r.y0 }), this.p({ x: r.x1, y: r.y1 }), this.p({ x: r.x0, y: r.y1 })];
    const rad = 14;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = k[i]!, b = k[(i + 1) % 4]!, prev = k[(i + 3) % 4]!;
      const l1 = Math.hypot(a.x - prev.x, a.y - prev.y), l2 = Math.hypot(b.x - a.x, b.y - a.y);
      const s1x = a.x + (prev.x - a.x) * (rad / l1), s1y = a.y + (prev.y - a.y) * (rad / l1);
      if (i === 0) c.moveTo(s1x, s1y); else c.lineTo(s1x, s1y);
      c.quadraticCurveTo(a.x, a.y, a.x + (b.x - a.x) * (rad / l2), a.y + (b.y - a.y) * (rad / l2));
    }
    c.closePath();
    return k;
  }

  private drawPool(): void {
    const c = this.ctx, { W } = this, t = this.game.time, pool = this.game.yard.pool;
    const deck = Math.max(10, W * 0.022);
    c.save();
    this.poolPath();
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(30, 40, 20, 0.22)'; c.lineWidth = deck * 2 + 6; c.stroke();
    c.strokeStyle = '#efe5d7'; c.lineWidth = deck * 2; c.stroke();
    c.strokeStyle = 'rgba(160, 140, 120, 0.35)'; c.lineWidth = 1; c.stroke();

    const k = this.poolPath();
    c.clip();
    const top = k[0]!.y, bottom = k[2]!.y, h = bottom - top;
    let gr = c.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, '#2f9fb8'); gr.addColorStop(0.5, '#4cc0d0'); gr.addColorStop(1, '#7fd9df');
    c.fillStyle = gr; c.fillRect(0, top - 10, W, h + 20);
    gr = c.createLinearGradient(0, top, 0, top + h * 0.22);
    gr.addColorStop(0, 'rgba(10, 60, 80, 0.45)'); gr.addColorStop(1, 'rgba(10, 60, 80, 0)');
    c.fillStyle = gr; c.fillRect(0, top, W, h * 0.22);

    c.lineWidth = 1.4;
    for (let j = 0; j < 22; j++) {
      const wy = pool.y0 + ((j + 0.5) / 22) * (pool.y1 - pool.y0);
      c.strokeStyle = `rgba(255, 255, 255, ${0.08 + 0.1 * (j / 22)})`;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const wx = pool.x0 + (i / 40) * (pool.x1 - pool.x0);
        const off = Math.sin(wx * 60 + t * 1.6 + j * 1.3) * 0.006 + Math.sin(wx * 23 - t * 1.1 + j) * 0.005;
        const p = this.p({ x: wx, y: wy + off });
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.stroke();
    }
    gr = c.createLinearGradient(k[0]!.x, top, k[2]!.x, bottom);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, top, W, h);

    for (const r of this.ripples) {
      if (r.t < 0) continue;
      const p = this.p(r.at), s = this.s(r.at.y), rr = (20 + r.t * 70) * s;
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r.t / r.life)})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(p.x, p.y, rr, rr * 0.32, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  // ---------- Things on the lawn ----------
  private shadow(at: Vec, w: number, alpha = 0.28): void {
    const c = this.ctx, p = this.p(at), s = this.s(at.y);
    const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * s);
    gr.addColorStop(0, `rgba(25, 40, 15, ${alpha})`); gr.addColorStop(1, 'rgba(25, 40, 15, 0)');
    c.fillStyle = gr;
    c.beginPath(); c.ellipse(p.x, p.y, w * s, w * s * 0.25, 0, 0, Math.PI * 2); c.fill();
  }

  /** Image cache keyed by sheet src, shared by every dog using that art. */
  private image(src: string): HTMLImageElement {
    let img = this.images.get(src);
    if (!img) { img = new Image(); img.src = src; this.images.set(src, img); }
    return img;
  }

  private drawDog(dog: Dog): void {
    const g = this.game, c = this.ctx, set = dog.profile.sprites;
    const f = dog.anim.frame, row = set.rows[f.key], sheet = set.sheets[row.sheet];
    const p = this.p(dog.pos), s = this.s(dog.pos.y) * (dog.profile.scale ?? 1), rs = s * row.scale;
    const sink = row.sink * dog.submerged * rs; // screen px of the dog below the waterline
    const bob = sink ? Math.sin(g.time * 3.2 + (dog.id === 'hegla' ? 1.7 : 0)) * 2.2 * s : 0;
    const both = g.dogs.length > 1;
    if (!sink) this.shadow(dog.pos, 62);
    if (both && dog === g.selected) {
      // Selection ring in the dog's colour.
      c.save();
      c.strokeStyle = dog.profile.accent;
      c.globalAlpha = 0.85;
      c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(p.x, p.y + bob, 50 * s, 12 * s, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    }

    const feet = (row.feet - row.row * sheet.cellH) * rs;
    const w = sheet.cellW * rs, h = sheet.cellH * rs;
    const img = this.image(sheet.src);
    const draw = (): void => {
      c.save();
      if (dog.profile.filter) c.filter = dog.profile.filter;
      c.translate(p.x, p.y + sink + bob);
      if (!row.directional && dog.face < 0) c.scale(-1, 1);
      c.drawImage(img, f.col * sheet.cellW, row.row * sheet.cellH, sheet.cellW, sheet.cellH, -w / 2, -feet, w, h);
      c.restore();
    };
    if (sink) {
      // Below the waterline: faint, so paddling paws show through the water.
      c.save();
      c.beginPath(); c.rect(0, p.y + bob, this.W, this.H); c.clip();
      c.globalAlpha = 0.32;
      draw();
      c.restore();
      c.save();
      c.beginPath(); c.rect(0, 0, this.W, p.y + bob); c.clip();
      draw();
      c.restore();
    } else draw();
    const top = p.y - feet + sink + bob;
    this.dogBoxes.push({ dog, x: p.x - w * 0.4, y: top + h * 0.05, w: w * 0.8, h: Math.max(20, p.y + bob - top) });

    if (sink) {
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(p.x, p.y + bob, 46 * s, 9 * s, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(120, 215, 225, 0.35)'; c.fill();
      c.restore();
    }
    if (g.ball.state === 'mouth' && g.ball.holder === dog.id) {
      // Ball held in the muzzle
      const dir = row.directional ? (f.key.endsWith('R') ? 1 : -1) : dog.face;
      this.ballAt({ x: p.x + dir * row.mouth[0] * rs, y: p.y + sink - row.mouth[1] * rs + bob }, s, false);
    }
    if (both) this.tags.push({ x: p.x, y: top + h * 0.02 - 6, name: dog.name, color: dog.profile.accent, size: Math.max(11, Math.round(13 * Math.min(1.2, s * 1.3))) });
  }

  /** Name tags, drawn after all dogs and nudged apart so they never overlap. */
  private drawTags(): void {
    const c = this.ctx;
    c.save();
    c.textAlign = 'center';
    const placed: Array<{ x0: number; x1: number; y: number }> = [];
    for (const t of this.tags.sort((a, b) => b.y - a.y)) {
      c.font = `600 ${t.size}px Outfit, system-ui, sans-serif`;
      const w = c.measureText(t.name).width + 14;
      let y = t.y;
      for (const o of placed) {
        if (t.x - w / 2 < o.x1 && t.x + w / 2 > o.x0 && Math.abs(y - o.y) < 22) y = o.y - 24;
      }
      placed.push({ x0: t.x - w / 2, x1: t.x + w / 2, y });
      c.fillStyle = 'rgba(255,250,244,.88)';
      c.beginPath(); c.roundRect(t.x - w / 2, y - 15, w, 20, 10); c.fill();
      c.fillStyle = t.color;
      c.fillText(t.name, t.x, y);
    }
    c.restore();
    this.tags = [];
  }

  /** The dog under a screen point, front-most first. */
  dogAt(x: number, y: number): Dog | null {
    for (let i = this.dogBoxes.length - 1; i >= 0; i--) {
      const b = this.dogBoxes[i]!;
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b.dog;
    }
    return null;
  }

  private ballAt(sp: Vec, s: number, floating: boolean): void {
    const c = this.ctx, r = 11 * Math.max(s, 0.55);
    const gr = c.createRadialGradient(sp.x - r * 0.35, sp.y - r * 0.35, r * 0.1, sp.x, sp.y, r);
    gr.addColorStop(0, '#ffd1e0'); gr.addColorStop(0.5, '#ec6f99'); gr.addColorStop(1, '#b8406a');
    c.fillStyle = gr;
    c.beginPath(); c.arc(sp.x, sp.y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, r * 0.14);
    c.beginPath(); c.arc(sp.x - r * 0.9, sp.y, r * 0.95, -0.9, 0.9); c.stroke();
    if (floating) {
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(sp.x, sp.y + r * 0.5, r * 1.6, r * 0.45, 0, 0, Math.PI * 2); c.stroke();
    }
  }

  private drawBall(): void {
    const b = this.game.ball;
    if (b.state === 'none' || b.state === 'mouth') return;
    const s = this.s(b.pos.y), p = this.p(b.pos), r = 11 * Math.max(s, 0.55);
    const floating = b.state === 'rest' && this.game.yard.inPool(b.pos);
    if (!floating) this.shadow(b.pos, 16 + 10 * (1 - Math.min(1, b.z)), 0.3 * (1 - Math.min(0.7, b.z * 0.6)));
    const y = p.y - r - b.z * (this.H - this.HZ) * 0.45 + (floating ? r * 0.5 + Math.sin(this.game.time * 3) * 1.5 : 0);
    this.ballAt({ x: p.x, y }, s, floating);
  }

  private drawTreat(): void {
    const t = this.game.treat;
    if (!t.visible) return;
    const c = this.ctx, p = this.p(t.pos), s = Math.max(this.s(t.pos.y), 0.6);
    const w = 16 * s, h = 5 * s, y = p.y - h;
    this.shadow(t.pos, 14, 0.25);
    c.fillStyle = '#f3e1c4';
    c.strokeStyle = 'rgba(120, 80, 40, .35)';
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(p.x - w / 2, y - h / 2, w, h, h / 2);
    for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) c.moveTo(p.x + dx * w / 2 + h * 0.55, y + dy * h * 0.5), c.arc(p.x + dx * w / 2, y + dy * h * 0.5, h * 0.55, 0, Math.PI * 2);
    c.fill(); c.stroke();
  }

  private heart(x: number, y: number, r: number, a: number): void {
    const c = this.ctx;
    c.save();
    c.globalAlpha = a; c.fillStyle = '#ef5f92'; c.translate(x, y);
    c.beginPath();
    c.moveTo(0, r * 0.35);
    c.bezierCurveTo(-r * 1.1, -r * 0.35, -r * 0.5, -r * 1.05, 0, -r * 0.45);
    c.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.1, -r * 0.35, 0, r * 0.35);
    c.fill();
    c.restore();
  }

  private drawFx(): void {
    const c = this.ctx;
    for (const p of this.particles) {
      const a = 1 - p.t / p.life;
      if (p.kind === 'heart') this.heart(p.x, p.y, p.r, Math.min(1, a * 1.5));
      else { c.fillStyle = `rgba(225, 248, 255, ${0.85 * a})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
    }
    if (this.marker) {
      const m = this.marker, a = 1 - m.t / 0.6, p = this.p(m.at), s = this.s(m.at.y);
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 2;
      c.beginPath(); c.ellipse(p.x, p.y, (14 + 30 * m.t) * s, (4 + 9 * m.t) * s, 0, 0, Math.PI * 2); c.stroke();
    }
  }

  private drawClouds(): void {
    const c = this.ctx, { W, HZ } = this, t = this.game.time;
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [cx, cy, sz] of [[0.15, 0.25, 1], [0.55, 0.15, 0.8], [0.9, 0.35, 0.65]] as const) {
      const x = ((cx * W + t * 6 * sz) % (W + 240)) - 120, y = cy * HZ, r = 22 * sz * Math.max(0.7, W / 1100);
      for (const [ox, oy, rr] of [[0, 0, 1], [1.1, 0.2, 0.8], [-1.1, 0.25, 0.75], [0.5, -0.45, 0.75]] as const) {
        c.beginPath(); c.arc(x + ox * r, y + oy * r, rr * r, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }

  draw(dt: number): void {
    this.consumeFx();
    this.stepFx(dt);
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(this.bg, 0, 0, this.W, this.H);
    this.drawClouds();
    this.drawPool();
    const g = this.game;
    this.dogBoxes = [];
    const items: Array<{ y: number; draw: () => void }> = g.dogs.map((d) => ({ y: d.pos.y, draw: () => this.drawDog(d) }));
    if (g.ball.state === 'rest' || g.ball.state === 'flying') items.push({ y: g.ball.pos.y, draw: () => this.drawBall() });
    if (g.treat.visible) items.push({ y: g.treat.pos.y, draw: () => this.drawTreat() });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    this.drawTags();
    this.drawFx();
  }
}
