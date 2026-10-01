/**
 * Yard geometry: a 2.5D ground plane (x 0..1 left→right, y 0..1 far→near)
 * with a rectangular pool. Pure math, no DOM — easy to test.
 */
import type { Medium, Vec } from './types.js';

export interface Rect { x0: number; x1: number; y0: number; y1: number }

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** Gap she keeps from the pool edge while on land. */
export const DECK = 0.05;

/** A single movement step in a route. */
export type Leg =
  | { type: 'move'; to: Vec }
  | { type: 'jump'; to: Vec; into: Medium };

export class Yard {
  bounds: Rect = { x0: 0.04, x1: 0.96, y0: 0.07, y1: 0.95 };
  pool: Rect = { x0: 0.57, x1: 0.9, y0: 0.3, y1: 0.76 };

  /** Landscape screens put the pool to the right, portrait at the front. */
  layout(portrait: boolean): void {
    this.pool = portrait
      ? { x0: 0.14, x1: 0.86, y0: 0.56, y1: 0.86 }
      : { x0: 0.57, x1: 0.9, y0: 0.3, y1: 0.76 };
  }

  inPool(p: Vec, margin = 0): boolean {
    const r = this.pool;
    return p.x > r.x0 - margin && p.x < r.x1 + margin && p.y > r.y0 - margin && p.y < r.y1 + margin;
  }

  clampToPool(p: Vec, inset = 0.07): Vec {
    const r = this.pool;
    return { x: clamp(p.x, r.x0 + inset, r.x1 - inset), y: clamp(p.y, r.y0 + inset, r.y1 - inset) };
  }

  clampToBounds(p: Vec): Vec {
    const b = this.bounds;
    return { x: clamp(p.x, b.x0, b.x1), y: clamp(p.y, b.y0, b.y1) };
  }

  randomLand(near?: Vec, spread = 1): Vec {
    for (let i = 0; i < 60; i++) {
      const p = near
        ? this.clampToBounds({ x: near.x + rand(-0.4, 0.4) * spread, y: near.y + rand(-0.3, 0.3) * spread })
        : { x: rand(this.bounds.x0, this.bounds.x1), y: rand(this.bounds.y0 + 0.05, this.bounds.y1) };
      if (!this.inPool(p, DECK + 0.02)) return p;
    }
    return { x: this.bounds.x0 + 0.05, y: this.bounds.y1 - 0.05 };
  }

  randomWater(): Vec {
    const r = this.pool;
    return { x: rand(r.x0 + 0.08, r.x1 - 0.08), y: rand(r.y0 + 0.08, r.y1 - 0.08) };
  }

  /** Nearest pool-edge crossing: O on the deck, I in the water. */
  edgeCrossing(p: Vec): { O: Vec; I: Vec } {
    const r = this.pool;
    const ey = clamp(p.y, r.y0 + 0.06, r.y1 - 0.06);
    const ex = clamp(p.x, r.x0 + 0.06, r.x1 - 0.06);
    const opts = [
      { b: { x: r.x0, y: ey }, n: { x: -1, y: 0 } },
      { b: { x: r.x1, y: ey }, n: { x: 1, y: 0 } },
      { b: { x: ex, y: r.y0 }, n: { x: 0, y: -1 } },
      { b: { x: ex, y: r.y1 }, n: { x: 0, y: 1 } },
    ];
    const inside = this.inPool(p);
    const score = (o: (typeof opts)[number]): number =>
      inside ? Math.abs(o.n.x ? p.x - o.b.x : p.y - o.b.y) : dist(p, o.b);
    const best = opts.reduce((a, b) => (score(b) < score(a) ? b : a));
    return {
      O: this.clampToBounds({ x: best.b.x + best.n.x * 0.055, y: best.b.y + best.n.y * 0.055 }),
      I: { x: best.b.x - best.n.x * 0.07, y: best.b.y - best.n.y * 0.07 },
    };
  }

  private segHitsPool(a: Vec, b: Vec): boolean {
    for (let i = 1; i < 30; i++) {
      const t = i / 30;
      if (this.inPool({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, DECK - 0.006)) return true;
    }
    return false;
  }

  /** Waypoints across the lawn that walk around the pool rather than through it. */
  landPath(a: Vec, b: Vec): Vec[] {
    if (!this.segHitsPool(a, b)) return [b];
    const r = this.pool;
    const c = [
      { x: r.x0 - DECK, y: r.y0 - DECK }, { x: r.x1 + DECK, y: r.y0 - DECK },
      { x: r.x1 + DECK, y: r.y1 + DECK }, { x: r.x0 - DECK, y: r.y1 + DECK },
    ].map((p) => this.clampToBounds(p));
    let best: Vec[] = [b];
    let bestLen = Infinity;
    const consider = (pts: Vec[]): void => {
      const full = [a, ...pts];
      for (let i = 0; i < full.length - 1; i++) {
        if (this.segHitsPool(full[i]!, full[i + 1]!)) return;
      }
      let len = 0;
      for (let i = 0; i < full.length - 1; i++) len += dist(full[i]!, full[i + 1]!);
      if (len < bestLen) { bestLen = len; best = pts; }
    };
    for (let i = 0; i < 4; i++) {
      consider([c[i]!, b]);
      consider([c[i]!, c[(i + 1) % 4]!, b]);
      consider([c[i]!, c[(i + 3) % 4]!, b]);
    }
    return best;
  }

  /** Full route from where she is to a target, including jumping in/out of the pool. */
  route(from: Vec, medium: Medium, target: Vec): Leg[] {
    let t = this.clampToBounds(target);
    const wantWater = this.inPool(t);
    if (wantWater) t = this.clampToPool(t);
    else if (this.inPool(t, DECK)) t = this.edgeCrossing(t).O;

    const legs: Leg[] = [];
    const walk = (a: Vec, b: Vec): void => { this.landPath(a, b).forEach((p) => legs.push({ type: 'move', to: p })); };

    if (medium === 'land' && !wantWater) walk(from, t);
    else if (medium === 'land' && wantWater) {
      const { O, I } = this.edgeCrossing(from);
      walk(from, O);
      legs.push({ type: 'jump', to: I, into: 'water' });
      legs.push({ type: 'move', to: t });
    } else if (medium === 'water' && wantWater) legs.push({ type: 'move', to: t });
    else {
      const { O, I } = this.edgeCrossing(t);
      legs.push({ type: 'move', to: I });
      legs.push({ type: 'jump', to: O, into: 'land' });
      if (dist(O, t) > 0.02) walk(O, t);
    }
    return legs;
  }
}

/** Screen projection for the yard. */
export class Camera {
  W = 0;
  H = 0;
  HZ = 0;

  resize(w: number, h: number): void {
    this.W = w;
    this.H = h;
    this.HZ = h * (w < h ? 0.24 : 0.3);
  }

  private k(y: number): number { return 0.82 + 0.26 * y; }

  project(p: Vec): Vec {
    return { x: this.W / 2 + (p.x - 0.5) * this.W * this.k(p.y), y: this.HZ + p.y * (this.H - this.HZ) };
  }

  unproject(sx: number, sy: number): Vec {
    const y = (sy - this.HZ) / (this.H - this.HZ);
    return { x: 0.5 + (sx - this.W / 2) / (this.W * this.k(y)), y };
  }

  /** Sprite scale (screen px per sheet px) at ground depth y. */
  scaleAt(y: number): number {
    return (Math.min(this.H * 0.3, this.W * 0.36) / 170) * (0.55 + 0.45 * y);
  }
}
