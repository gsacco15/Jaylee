/** How much wider the ground looks at depth y (0 = horizon, 1 = front). */
export const perspective = (y) => 0.82 + 0.26 * y;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (a, b) => a + Math.random() * (b - a);
/** Gap she keeps from the pool edge while on land. */
export const DECK = 0.05;
export class Yard {
    bounds = { x0: 0.04, x1: 0.96, y0: 0.07, y1: 0.95 };
    pool = { x0: 0.57, x1: 0.9, y0: 0.3, y1: 0.76 };
    /** Landscape screens put the pool to the right, portrait at the front. */
    layout(portrait) {
        this.pool = portrait
            ? { x0: 0.24, x1: 0.76, y0: 0.56, y1: 0.84 }
            : { x0: 0.57, x1: 0.88, y0: 0.3, y1: 0.76 };
        // Keep dogs fully on screen (narrow screens need a wider margin).
        this.edge = portrait ? 0.14 : 0.05;
    }
    inPool(p, margin = 0) {
        const r = this.pool;
        return p.x > r.x0 - margin && p.x < r.x1 + margin && p.y > r.y0 - margin && p.y < r.y1 + margin;
    }
    clampToPool(p, inset = 0.07) {
        const r = this.pool;
        return { x: clamp(p.x, r.x0 + inset, r.x1 - inset), y: clamp(p.y, r.y0 + inset, r.y1 - inset) };
    }
    /** Fraction of the screen width kept clear at each side, so dogs stay fully visible. */
    edge = 0.05;
    clampToBounds(p) {
        const b = this.bounds;
        const y = clamp(p.y, b.y0, b.y1);
        // Perspective widens the ground toward the viewer, so the side limit depends on depth.
        const half = (0.5 - this.edge) / perspective(y);
        return { x: clamp(p.x, Math.max(b.x0, 0.5 - half), Math.min(b.x1, 0.5 + half)), y };
    }
    randomLand(near, spread = 1) {
        for (let i = 0; i < 60; i++) {
            const p = near
                ? this.clampToBounds({ x: near.x + rand(-0.4, 0.4) * spread, y: near.y + rand(-0.3, 0.3) * spread })
                : this.clampToBounds({ x: rand(this.bounds.x0, this.bounds.x1), y: rand(this.bounds.y0 + 0.05, this.bounds.y1) });
            if (!this.inPool(p, DECK + 0.02))
                return p;
        }
        return this.clampToBounds({ x: this.bounds.x0 + 0.05, y: this.bounds.y1 - 0.05 });
    }
    randomWater() {
        const r = this.pool;
        return { x: rand(r.x0 + 0.08, r.x1 - 0.08), y: rand(r.y0 + 0.08, r.y1 - 0.08) };
    }
    /** Nearest pool-edge crossing: O on the deck, I in the water. */
    edgeCrossing(p) {
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
        const score = (o) => inside ? Math.abs(o.n.x ? p.x - o.b.x : p.y - o.b.y) : dist(p, o.b);
        const best = opts.reduce((a, b) => (score(b) < score(a) ? b : a));
        return {
            O: this.clampToBounds({ x: best.b.x + best.n.x * 0.055, y: best.b.y + best.n.y * 0.055 }),
            I: { x: best.b.x - best.n.x * 0.07, y: best.b.y - best.n.y * 0.07 },
        };
    }
    segHitsPool(a, b) {
        for (let i = 1; i < 30; i++) {
            const t = i / 30;
            if (this.inPool({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, DECK - 0.006))
                return true;
        }
        return false;
    }
    /** Waypoints across the lawn that walk around the pool rather than through it. */
    landPath(a, b) {
        if (!this.segHitsPool(a, b))
            return [b];
        const r = this.pool;
        const c = [
            { x: r.x0 - DECK, y: r.y0 - DECK }, { x: r.x1 + DECK, y: r.y0 - DECK },
            { x: r.x1 + DECK, y: r.y1 + DECK }, { x: r.x0 - DECK, y: r.y1 + DECK },
        ].map((p) => this.clampToBounds(p));
        let best = [b];
        let bestLen = Infinity;
        const consider = (pts) => {
            const full = [a, ...pts];
            for (let i = 0; i < full.length - 1; i++) {
                if (this.segHitsPool(full[i], full[i + 1]))
                    return;
            }
            let len = 0;
            for (let i = 0; i < full.length - 1; i++)
                len += dist(full[i], full[i + 1]);
            if (len < bestLen) {
                bestLen = len;
                best = pts;
            }
        };
        for (let i = 0; i < 4; i++) {
            consider([c[i], b]);
            consider([c[i], c[(i + 1) % 4], b]);
            consider([c[i], c[(i + 3) % 4], b]);
        }
        return best;
    }
    /** Full route from where she is to a target, including jumping in/out of the pool. */
    route(from, medium, target) {
        let t = this.clampToBounds(target);
        const wantWater = this.inPool(t);
        if (wantWater)
            t = this.clampToPool(t);
        else if (this.inPool(t, DECK))
            t = this.edgeCrossing(t).O;
        const legs = [];
        const walk = (a, b) => { this.landPath(a, b).forEach((p) => legs.push({ type: 'move', to: p })); };
        if (medium === 'land' && !wantWater)
            walk(from, t);
        else if (medium === 'land' && wantWater) {
            const { O, I } = this.edgeCrossing(from);
            walk(from, O);
            legs.push({ type: 'jump', to: I, into: 'water' });
            legs.push({ type: 'move', to: t });
        }
        else if (medium === 'water' && wantWater)
            legs.push({ type: 'move', to: t });
        else {
            const { O, I } = this.edgeCrossing(t);
            legs.push({ type: 'move', to: I });
            legs.push({ type: 'jump', to: O, into: 'land' });
            if (dist(O, t) > 0.02)
                walk(O, t);
        }
        return legs;
    }
}
/** Screen projection for the yard. */
export class Camera {
    W = 0;
    H = 0;
    HZ = 0;
    resize(w, h) {
        this.W = w;
        this.H = h;
        this.HZ = h * (w < h ? 0.24 : 0.3);
    }
    k(y) { return perspective(y); }
    project(p) {
        return { x: this.W / 2 + (p.x - 0.5) * this.W * this.k(p.y), y: this.HZ + p.y * (this.H - this.HZ) };
    }
    unproject(sx, sy) {
        const y = (sy - this.HZ) / (this.H - this.HZ);
        return { x: 0.5 + (sx - this.W / 2) / (this.W * this.k(y)), y };
    }
    /** Sprite scale (screen px per sheet px) at ground depth y. */
    scaleAt(y) {
        return (Math.min(this.H * 0.3, this.W * 0.36) / 170) * (0.55 + 0.45 * y);
    }
}
