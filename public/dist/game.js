/**
 * Game: the shared world — yard, camera, ball, treats, effects — and the
 * dogs in it. One dog or both, depending on the mode.
 */
import { Dog } from './dog.js';
import { DOGS, DOG_IDS } from './dogs.js';
import { Camera, Yard, daylight, dist, rand } from './world.js';
/** How hard the human pulls, on the same 0..1 scale as dogs' strength. */
const HUMAN_STRENGTH = 0.6;
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
    rope = { state: 'lawn', pos: { x: 0.45, y: 0.86 }, holder: null, a: null, b: null, t: 0, dur: 0, anchor: { x: 0, y: 0 }, axis: 1 };
    /** Day/night: follow the local clock, or force one. */
    timeMode = 'auto';
    /** 0 = night, 1 = full day (eased toward the target). */
    light = 1;
    /** Sunset / sunrise glow, 0..1. */
    warmth = 0;
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
    // ---------- Day & night ----------
    get night() { return this.light < 0.35; }
    get timeOfDay() {
        if (this.timeMode !== 'auto')
            return this.timeMode === 'day' ? 'day' : 'night';
        const h = localHour();
        return h < 5 || h >= 20.5 ? 'night' : h < 9 ? 'morning' : h < 18 ? 'day' : 'evening';
    }
    updateLight(dt) {
        const auto = daylight(localHour());
        const target = this.timeMode === 'day' ? { light: 1, warmth: 0 } : this.timeMode === 'night' ? { light: 0, warmth: 0 } : auto;
        const k = Math.min(1, dt * 1.5);
        this.light += (target.light - this.light) * k;
        this.warmth += (target.warmth - this.warmth) * k;
    }
    // ---------- Rope / tug-of-war ----------
    tugging(dog) {
        const r = this.rope;
        return r.state === 'tug' && (r.a === dog.id || r.b === dog.id);
    }
    /** Pick the rope up off the lawn. */
    holdRope(dog) {
        const r = this.rope;
        if (r.state !== 'lawn' || dist(r.pos, dog.pos) > 0.12)
            return false;
        r.state = 'carried';
        r.holder = dog.id;
        return true;
    }
    dropRope(dog) {
        const r = this.rope;
        if (r.state !== 'carried' || r.holder !== dog.id)
            return;
        r.state = 'lawn';
        r.holder = null;
        r.pos = this.yard.clampToBounds({ x: dog.pos.x + dog.face * 0.04, y: dog.pos.y + 0.02 });
    }
    /** Start a match between a dog and the human, or two dogs. */
    startTug(a, b) {
        const r = this.rope;
        const ready = (r.state === 'lawn' && dist(r.pos, a.pos) < 0.12) || (r.state === 'carried' && r.holder === a.id);
        if (!ready || (b !== 'human' && (b.medium !== 'land' || a.medium !== 'land')))
            return false;
        r.state = 'tug';
        r.holder = null;
        r.a = a.id;
        r.b = b === 'human' ? 'human' : b.id;
        r.t = 0;
        r.dur = rand(3.5, 5.5);
        if (b === 'human') {
            r.anchor = { ...a.pos };
            r.axis = 1;
        }
        else {
            r.axis = b.pos.x >= a.pos.x ? 1 : -1;
            r.anchor = this.yard.clampToBounds({ x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 });
            a.face = r.axis;
            b.face = r.axis === 1 ? -1 : 1;
        }
        return true;
    }
    updateRope(dt) {
        const r = this.rope;
        if (r.state === 'carried') {
            const h = r.holder ? this.dogAt(r.holder) : null;
            if (!h) {
                r.state = 'lawn';
                r.holder = null;
                return;
            }
            r.pos = { ...h.pos };
            return;
        }
        if (r.state !== 'tug')
            return;
        const a = r.a ? this.dogAt(r.a) : null;
        const b = r.b === 'human' ? 'human' : r.b ? this.dogAt(r.b) : null;
        // Someone got called away mid-match (e.g. by a button or the chat): call it off.
        const quit = (d) => !d || (d !== 'human' && r.t > 0.5 && d.cur?.step.type !== 'tug');
        if (!a || quit(a) || quit(b)) {
            r.state = 'lawn';
            r.a = r.b = null;
            return;
        }
        if (!b)
            return;
        r.t += dt;
        const sa = a.profile.strength, sb = b === 'human' ? HUMAN_STRENGTH : b.profile.strength;
        // Shift > 0 means the rope (and both dogs) slide toward A, the stronger side winning ground.
        const p = Math.min(1, r.t / r.dur);
        const shift = (sa - sb) * 0.06 * p + Math.sin(r.t * 9) * 0.006 + Math.sin(r.t * 3.3) * 0.012;
        if (b === 'human') {
            a.pos = this.yard.clampToBounds({ x: r.anchor.x + Math.sin(r.t * 5) * 0.006, y: r.anchor.y - shift * 0.9 });
        }
        else {
            a.pos = this.yard.clampToBounds({ x: r.anchor.x - r.axis * (0.09 + shift), y: r.anchor.y });
            b.pos = this.yard.clampToBounds({ x: r.anchor.x + r.axis * (0.09 - shift), y: r.anchor.y });
        }
        r.pos = { x: r.anchor.x - r.axis * shift, y: r.anchor.y };
        if (r.t < r.dur)
            return;
        // Stronger pullers usually win (Jaylee very often).
        const aWins = Math.random() < (sa * sa) / (sa * sa + sb * sb);
        r.a = r.b = null;
        if (b === 'human') {
            if (aWins) {
                r.state = 'carried';
                r.holder = a.id;
                if (sa > 0.8)
                    this.fx.push({ type: 'shake' });
            }
            else {
                r.state = 'lawn';
                r.pos = this.yard.clampToBounds({ x: 0.5, y: 0.93 });
            }
            a.tugOver(aWins);
            return;
        }
        const [win, lose] = aWins ? [a, b] : [b, a];
        r.state = 'carried';
        r.holder = win.id;
        if (win.profile.strength - lose.profile.strength > 0.3) {
            // Yanked: the loser gets pulled a step toward the winner.
            lose.pos = this.yard.clampToBounds({ x: lose.pos.x + (win.pos.x - lose.pos.x) * 0.35, y: lose.pos.y });
            this.fx.push({ type: 'shake' });
        }
        win.tugOver(true);
        lose.tugOver(false);
        this.played(win, lose, 3);
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
        this.updateLight(dt);
        for (const d of dogs)
            d.update(dt);
        this.updateBall(dt);
        this.updateRope(dt);
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
        if (this.rope.state !== 'carried') {
            this.rope.state = 'lawn';
            this.rope.a = this.rope.b = null;
            this.rope.pos = y.clampToBounds(y.inPool(this.rope.pos, 0.06) ? y.edgeCrossing(this.rope.pos).O : this.rope.pos);
        }
    }
}
function localHour() {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
}
