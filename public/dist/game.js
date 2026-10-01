/**
 * Game: the shared world — yard, camera, ball, treats, effects — and the
 * dogs in it. One dog or both, depending on the mode.
 */
import { Dog } from './dog.js';
import { DOGS, DOG_IDS } from './dogs.js';
import { Camera, Yard, dist } from './world.js';
const START = { jaylee: { x: 0.3, y: 0.6 }, helga: { x: 0.2, y: 0.78 } };
export class Game {
    yard = new Yard();
    cam = new Camera();
    fx = [];
    /** Every dog, whether or not they're in the yard right now. */
    roster;
    mode = 'jaylee';
    autonomy = true;
    time = 0;
    ball = { state: 'none', pos: { x: 0, y: 0 }, z: 0, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, t: 0, holder: null };
    treat = { pos: { x: 0, y: 0 }, visible: false };
    selectedId = 'jaylee';
    listeners = [];
    constructor() {
        const r = {};
        for (const id of DOG_IDS)
            r[id] = new Dog(DOGS[id], this, START[id]);
        this.roster = r;
    }
    // ---------- Dogs & mode ----------
    /** Dogs currently in the yard. */
    get dogs() {
        return this.mode === 'both' ? DOG_IDS.map((id) => this.roster[id]) : [this.roster[this.mode]];
    }
    /** The dog the buttons and meters are about. */
    get selected() {
        return this.dogs.find((d) => d.id === this.selectedId) ?? this.dogs[0];
    }
    select(id) {
        if (!this.dogs.some((d) => d.id === id) || id === this.selectedId)
            return;
        this.selectedId = id;
        this.emit({ type: 'select', dog: id });
    }
    setMode(mode) {
        if (mode === this.mode)
            return;
        this.mode = mode;
        if (mode !== 'both')
            this.selectedId = mode;
        if (this.ball.state === 'mouth' && !this.dogs.some((d) => d.id === this.ball.holder))
            this.dropBall(this.roster[this.ball.holder]);
        for (const d of this.dogs)
            d.relayout();
        this.emit({ type: 'mode', mode });
    }
    friendOf(dog) {
        if (this.mode !== 'both')
            return null;
        return this.dogs.find((d) => d !== dog) ?? null;
    }
    dogAt(id) {
        return this.dogs.find((d) => d.id === id) ?? null;
    }
    // ---------- Events ----------
    on(fn) {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
    }
    emit(e) {
        this.listeners.forEach((l) => l(e));
    }
    // ---------- Ball ----------
    ballWhere(asSeenBy) {
        const b = this.ball;
        if (b.state === 'none')
            return 'none';
        if (b.state === 'flying')
            return 'flying';
        if (b.state === 'mouth')
            return asSeenBy && b.holder !== asSeenBy.id ? 'lawn' : 'mouth';
        return this.yard.inPool(b.pos) ? 'pool' : 'lawn';
    }
    ballHolder() {
        return this.ball.state === 'mouth' && this.ball.holder ? this.roster[this.ball.holder] : null;
    }
    /** Player throws the ball from the selected dog; everyone watches it fly. */
    throwBall() {
        if (this.ball.state === 'flying')
            return;
        const from = this.selected;
        const holder = this.ballHolder();
        if (holder)
            this.dropBall(holder);
        const y = this.yard;
        const to = Math.random() < 0.3 ? y.randomWater() : (() => {
            for (let i = 0; i < 40; i++) {
                const p = y.randomLand();
                if (dist(p, from.pos) > 0.25)
                    return p;
            }
            return y.randomLand();
        })();
        this.ball = { state: 'flying', pos: { ...from.pos }, z: 0.25, from: { ...from.pos }, to, t: 0, holder: null };
        for (const d of this.dogs) {
            d.feel({ type: 'ballThrown', to });
            d.watchBall();
        }
        from.say('Ball! Ball! Ball!');
    }
    /** First dog to reach the ball gets it. */
    pickUpBall(dog) {
        if (this.ball.state !== 'rest' || dist(this.ball.pos, dog.pos) > 0.08)
            return false;
        this.ball.state = 'mouth';
        this.ball.holder = dog.id;
        return true;
    }
    dropBall(dog) {
        if (this.ball.state !== 'mouth' || this.ball.holder !== dog.id)
            return;
        this.ball.state = 'rest';
        this.ball.holder = null;
        this.ball.pos = this.yard.clampToBounds({ x: dog.pos.x + dog.face * 0.04, y: dog.pos.y + 0.02 });
        this.ball.z = 0;
    }
    updateBall(dt) {
        const b = this.ball;
        if (b.state === 'mouth') {
            const h = this.ballHolder();
            if (h)
                b.pos = { ...h.pos };
            return;
        }
        if (b.state !== 'flying')
            return;
        b.t += dt / 1.05;
        const t = Math.min(b.t, 1);
        b.pos = { x: b.from.x + (b.to.x - b.from.x) * t, y: b.from.y + (b.to.y - b.from.y) * t };
        b.z = 4 * t * (1 - t) + 0.25 * (1 - t);
        if (b.t >= 1) {
            b.state = 'rest';
            b.z = 0;
            const inWater = this.yard.inPool(b.pos);
            if (inWater)
                this.fx.push({ type: 'splash', at: { ...b.pos }, n: 10 });
            for (const d of this.dogs) {
                d.feel({ type: 'ballLanded', inWater });
                d.ballLanded();
            }
        }
    }
    // ---------- Treats & play ----------
    placeTreat(at) { this.treat = { pos: at, visible: true }; }
    eatTreat() {
        if (!this.treat.visible)
            return false;
        this.treat.visible = false;
        return true;
    }
    /** Two dogs just played: both feel it. */
    played(a, b, hearts) {
        a.feel({ type: 'playedWithFriend' });
        b.feel({ type: 'playedWithFriend' });
        if (hearts)
            this.fx.push({ type: 'hearts', at: { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 }, n: hearts });
    }
    // ---------- Simulation ----------
    update(dt) {
        this.time += dt;
        const dogs = this.dogs;
        for (const d of dogs)
            d.update(dt);
        this.updateBall(dt);
        // Keep two dogs from standing exactly on top of each other.
        if (dogs.length === 2) {
            const [a, b] = dogs;
            const dx = b.pos.x - a.pos.x, dy = (b.pos.y - a.pos.y) * 1.6, d = Math.hypot(dx, dy);
            if (d < 0.06 && a.medium === b.medium) {
                const push = (0.06 - d) * 0.5 * Math.min(1, dt * 6);
                const nx = d > 1e-4 ? dx / d : 1, ny = d > 1e-4 ? dy / d : 0;
                a.nudge(-nx * push, -ny * push / 1.6);
                b.nudge(nx * push, ny * push / 1.6);
            }
        }
    }
    relayout(dropPlans = true) {
        for (const d of this.dogs)
            d.relayout(dropPlans);
        const y = this.yard;
        if (this.ball.state === 'rest' && y.inPool(this.ball.pos, 0.05) && !y.inPool(this.ball.pos))
            this.ball.pos = y.edgeCrossing(this.ball.pos).O;
    }
}
