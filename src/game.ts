/**
 * Game: Jaylee's body (movement + animation), the ball and treats,
 * and the glue that runs intents through her brain.
 */
import { AnimPlayer, SIT_H, type AnimName } from './sprites.js';
import { Brain, type BrainContext } from './brain.js';
import { Camera, Yard, dist, rand, type Leg } from './world.js';
import type {
  Activity, Decision, Intent, Medium, Snapshot, Source, Stats, Vec, WorldEvent,
} from './types.js';

/** Visual effects requested by the simulation; the renderer draws them. */
export type Fx =
  | { type: 'splash'; at: Vec; n: number }
  | { type: 'drip'; at: Vec }
  | { type: 'ripple'; at: Vec }
  | { type: 'hearts'; at: Vec; n: number };

type Step =
  | { type: 'move'; to: Vec }
  | { type: 'jump'; to: Vec; into: Medium; hop?: boolean }
  | { type: 'anim'; anim: AnimName; activity?: Activity }
  | { type: 'idle'; secs: number }
  | { type: 'wait'; until: () => boolean; timeout: number }
  | { type: 'call'; fn: () => void };

interface Running { step: Step; t: number; from: Vec; dur: number }

export interface Ball { state: 'none' | 'flying' | 'rest' | 'mouth'; pos: Vec; z: number; from: Vec; to: Vec; t: number }
export interface Treat { pos: Vec; visible: boolean }

export type GameListener = (e: { type: 'say'; line: string } | { type: 'decision'; intent: Intent; source: Source; decision: Decision } | WorldEvent) => void;

export class Game {
  readonly yard = new Yard();
  readonly cam = new Camera();
  readonly brain = new Brain();
  readonly anim = new AnimPlayer();
  readonly fx: Fx[] = [];
  readonly stats: Stats = { fetches: 0, swims: 0, pets: 0, treats: 0 };

  pos: Vec = { x: 0.3, y: 0.6 };
  medium: Medium = 'land';
  face: 1 | -1 = 1;
  wet = 0;
  autonomy = true;
  line = 'Hi! I’m Jaylee';
  ball: Ball = { state: 'none', pos: { x: 0, y: 0 }, z: 0, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, t: 0 };
  treat: Treat = { pos: { x: 0, y: 0 }, visible: false };
  time = 0;

  private queue: Step[] = [];
  private cur: Running | null = null;
  private pending: Intent | null = null;
  private current: Intent | null = null;
  private idleFor = 0;
  private nextThink = 2;
  private waterSince = 0;
  private rippleT = 0;
  private dripT = 0;
  private listeners: GameListener[] = [];

  constructor() {
    this.anim.play('idle');
  }

  // ---------- Public control surface ----------

  on(fn: GameListener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  private emit(e: Parameters<GameListener>[0]): void {
    this.listeners.forEach((l) => l(e));
  }

  say(line: string): void {
    if (!line || line === this.line) return;
    this.line = line;
    this.emit({ type: 'say', line });
  }

  /** 0 = on land, 1 = swimming; in between while jumping in or out. */
  get submerged(): number {
    const r = this.cur;
    if (r && r.step.type === 'jump' && !r.step.hop && r.dur > 0) {
      const p = Math.min(1, r.t / r.dur);
      return r.step.into === 'water' ? (p > 0.7 ? Math.min(1, (p - 0.7) / 0.25) : 0) : (p < 0.3 ? 1 - p / 0.3 : 0);
    }
    return this.medium === 'water' ? 1 : 0;
  }

  get busy(): boolean { return this.cur !== null || this.queue.length > 0; }

  get activity(): Activity {
    const s = this.cur?.step;
    if (!s) return this.medium === 'water' ? 'paddling' : 'idle';
    if (s.type === 'move') return this.medium === 'water' ? 'swimming' : 'running';
    if (s.type === 'jump') return 'running';
    if (s.type === 'anim') return s.activity ?? 'trick';
    return this.medium === 'water' ? 'paddling' : 'idle';
  }

  context(): BrainContext {
    return { medium: this.medium, ball: this.ballWhere(), timeInWater: this.medium === 'water' ? this.time - this.waterSince : 0 };
  }

  private ballWhere(): Snapshot['ball'] {
    const b = this.ball;
    if (b.state === 'none') return 'none';
    if (b.state === 'flying') return 'flying';
    if (b.state === 'mouth') return 'mouth';
    return this.yard.inPool(b.pos) ? 'pool' : 'lawn';
  }

  snapshot(): Snapshot {
    return {
      name: this.brain.personality.name,
      position: { ...this.pos },
      medium: this.medium,
      activity: this.activity,
      busy: this.busy,
      needs: { ...this.brain.needs },
      mood: this.brain.mood,
      happiness: this.brain.happiness,
      wet: this.wet > 0 || this.medium === 'water',
      ball: this.ballWhere(),
      stats: { ...this.stats },
    };
  }

  /** Ask Jaylee to do something. She may say no. */
  request(intent: Intent, source: Source = 'player'): Decision {
    if (intent.kind === 'fetch' && this.ball.state !== 'rest') {
      return { accept: false, line: this.ball.state === 'flying' ? 'Waiting for it to land…' : 'No ball out there' };
    }
    const decision = this.brain.consider(intent, source, this.context());
    this.emit({ type: 'decision', intent, source, decision });
    if (source !== 'chat' || !decision.accept) this.say(decision.line);
    if (!decision.accept) return decision;
    this.idleFor = 0;
    this.nextThink = rand(3, 7);
    this.dropBall();
    if (this.cur?.step.type === 'jump') { this.pending = intent; return decision; }
    this.start(intent);
    return decision;
  }

  /** Player throws the ball; Jaylee decides whether to chase it. */
  throwBall(): void {
    if (this.ball.state === 'flying') return;
    if (this.ball.state === 'mouth') this.dropBall();
    const y = this.yard;
    const to = Math.random() < 0.3 ? y.randomWater() : (() => {
      for (let i = 0; i < 40; i++) { const p = y.randomLand(); if (dist(p, this.pos) > 0.25) return p; }
      return y.randomLand();
    })();
    this.ball = { state: 'flying', pos: { ...this.pos }, z: 0.25, from: { ...this.pos }, to, t: 0 };
    this.feel({ type: 'ballThrown', to });
    this.say('Ball! Ball! Ball!');
    // Let a jump in progress finish, then watch the ball.
    if (this.cur?.step.type !== 'jump') this.cur = null;
    this.queue = [{ type: 'wait', until: () => this.ball.state !== 'flying', timeout: 3 }];
    this.pending = null;
    this.current = null;
    this.idleFor = 0;
  }

  pet(): void {
    this.stats.pets++;
    this.feel({ type: 'petted' });
    this.fx.push({ type: 'hearts', at: { ...this.pos }, n: 5 });
    if (!this.busy && this.medium === 'land') {
      const trick = (['wave', 'beg', 'wink', 'curious'] as const)[Math.floor(Math.random() * 4)]!;
      this.request({ kind: 'trick', trick }, 'self');
    }
    this.say(['I love that!', 'Belly rubs please', 'Who’s a good girl? Me!'][Math.floor(Math.random() * 3)]!);
  }

  private feel(e: WorldEvent): void {
    this.brain.feel(e);
    this.emit(e);
  }

  // ---------- Intent → steps ----------

  private start(intent: Intent): void {
    this.current = intent;
    this.cur = null;
    this.queue = this.compile(intent);
  }

  private compile(intent: Intent): Step[] {
    const y = this.yard;
    const steps: Step[] = [];
    let at: Vec = { ...this.pos };
    let medium: Medium = this.medium;

    const go = (target: Vec): void => {
      for (const leg of y.route(at, medium, target)) {
        steps.push(legToStep(leg));
        at = leg.to;
        if (leg.type === 'jump') medium = leg.into;
      }
    };
    const toLand = (): void => {
      if (medium === 'water') go(y.randomLand(y.edgeCrossing(at).O, 0.12));
    };

    switch (intent.kind) {
      case 'goTo': go({ x: intent.x, y: intent.y }); break;
      case 'swim': {
        let p = y.randomWater();
        for (let i = 0; i < 10 && medium === 'water' && dist(p, at) < 0.15; i++) p = y.randomWater();
        go(p);
        break;
      }
      case 'leavePool': toLand(); steps.push({ type: 'idle', secs: rand(1, 2) }); break;
      case 'fetch': {
        // Grab it, bring it back to the front of the yard, drop it and ask for more.
        go(this.ball.pos);
        steps.push({ type: 'call', fn: () => this.pickUpBall() });
        go(y.randomLand({ x: 0.35, y: 0.9 }, 0.25));
        steps.push({ type: 'call', fn: () => this.dropBall() });
        steps.push({ type: 'anim', anim: 'beg' });
        break;
      }
      case 'trick':
        toLand();
        if (intent.trick === 'sit') steps.push({ type: 'idle', secs: 3 });
        else if (intent.trick === 'hop') steps.push({ type: 'jump', to: at, into: 'land', hop: true });
        else steps.push({ type: 'anim', anim: intent.trick });
        break;
      case 'zoomies':
        toLand();
        for (let i = 0; i < 5; i++) go(y.randomLand());
        steps.push({ type: 'anim', anim: 'beg' });
        break;
      case 'wander':
        toLand();
        go(y.randomLand(at, 0.8));
        if (Math.random() < 0.4) steps.push({ type: 'anim', anim: 'sniff' });
        break;
      case 'rest':
        if (medium === 'water') steps.push({ type: 'idle', secs: rand(2, 4) });
        else steps.push({ type: 'idle', secs: rand(5, 9) });
        break;
      case 'seekAttention':
        toLand();
        go(y.randomLand({ x: 0.4, y: 0.88 }, 0.3));
        steps.push({ type: 'anim', anim: 'wave' }, { type: 'anim', anim: 'beg' });
        break;
      case 'eatTreat': {
        toLand();
        const spot = y.clampToBounds({ x: at.x + 0.06 * this.face, y: at.y + 0.03 });
        steps.push({ type: 'call', fn: () => { this.treat = { pos: spot, visible: true }; } });
        steps.push({ type: 'move', to: { x: spot.x - 0.025 * Math.sign(spot.x - at.x || 1), y: spot.y } });
        steps.push({ type: 'anim', anim: 'eat', activity: 'eating' });
        steps.push({ type: 'call', fn: () => this.eatTreat() });
        break;
      }
    }
    return steps;
  }

  private pickUpBall(): void {
    if (this.ball.state !== 'rest' || dist(this.ball.pos, this.pos) > 0.08) return;
    this.ball.state = 'mouth';
    this.stats.fetches++;
    this.feel({ type: 'fetched' });
    this.fx.push({ type: 'hearts', at: { ...this.pos }, n: 4 });
    this.say('Got it! Again! Again!');
  }

  private dropBall(): void {
    if (this.ball.state !== 'mouth') return;
    this.ball.state = 'rest';
    this.ball.pos = this.yard.clampToBounds({ x: this.pos.x + this.face * 0.04, y: this.pos.y + 0.02 });
    this.ball.z = 0;
  }

  private eatTreat(): void {
    this.treat.visible = false;
    this.stats.treats++;
    this.feel({ type: 'treat' });
    this.fx.push({ type: 'hearts', at: { ...this.pos }, n: 3 });
  }

  // ---------- Simulation ----------

  update(dt: number): void {
    this.time += dt;
    this.brain.tick(dt, this.activity, this.medium);

    if (!this.cur && this.queue.length) this.begin(this.queue.shift()!);
    const r = this.cur;

    if (r) {
      r.t += dt;
      this.idleFor = 0;
      const s = r.step;
      switch (s.type) {
        case 'move': this.stepMove(s.to, dt); break;
        case 'jump': this.stepJump(r, s, dt); break;
        case 'anim': this.anim.tick(dt); if (this.anim.done) this.cur = null; break;
        case 'idle': this.idleAnim(dt); if (r.t >= s.secs) this.cur = null; break;
        case 'wait': this.idleAnim(dt); if (s.until() || r.t > s.timeout) this.cur = null; break;
        case 'call': this.cur = null; break;
      }
      if (!this.cur && !this.queue.length) this.finished();
    } else {
      this.idleAnim(dt);
      this.idleFor += dt;
      if (this.idleFor > 1.2 && this.idleFor - dt <= 1.2) this.say(this.idleLine());
      if (this.autonomy && this.idleFor > this.nextThink) this.think();
    }

    if (this.medium === 'water') {
      this.rippleT -= dt;
      if (this.rippleT <= 0) {
        this.fx.push({ type: 'ripple', at: { ...this.pos } });
        this.rippleT = this.activity === 'swimming' ? 0.28 : 0.9;
      }
    }
    if (this.wet > 0 && this.medium === 'land') {
      this.wet -= dt;
      this.dripT -= dt;
      if (this.dripT <= 0) { this.fx.push({ type: 'drip', at: { ...this.pos } }); this.dripT = 0.12; }
    }
    this.updateBall(dt);
  }

  private idleLine(): string {
    const m = this.brain.mood;
    const lines: Record<typeof m, string> = {
      sleepy: 'So sleepy…', hot: 'Phew, it’s hot out here', needy: 'Pet me?', playful: 'Throw the ball!',
      curious: 'Something smells interesting…', happy: 'Life is good', content: 'Just chilling',
    };
    return lines[m];
  }

  private think(): void {
    const { intent } = this.brain.decide(this.context());
    this.request(intent, 'self');
    this.nextThink = rand(2.5, 6);
  }

  private finished(): void {
    if (this.current) this.brain.satisfied(this.current);
    this.current = null;
    this.idleFor = 0;
    // Chase the ball if one just landed.
    if (this.ball.state === 'rest' && this.lastThrowPending) {
      this.lastThrowPending = false;
      this.request({ kind: 'fetch' }, 'player');
    }
  }
  private lastThrowPending = false;

  private begin(step: Step): void {
    this.cur = { step, t: 0, from: { ...this.pos }, dur: 0 };
    if (step.type === 'anim') this.anim.play(step.anim);
    else if (step.type === 'jump') {
      const dx = step.to.x - this.pos.x;
      if (Math.abs(dx) > 0.005) this.face = dx > 0 ? 1 : -1;
      this.anim.play('hop');
      // Into water: skip the final standing frame. Out of water: skip the crouch.
      if (step.into === 'water' && !step.hop) this.anim.frames = this.anim.frames.slice(0, 4);
      else if (!step.hop) this.anim.frames = this.anim.frames.slice(1);
      this.cur.dur = this.anim.duration;
    } else if (step.type === 'call') step.fn();
  }

  private idleAnim(dt: number): void {
    if (this.medium === 'water') this.anim.ensure(this.face > 0 ? 'treadR' : 'treadL');
    else if (this.anim.name !== 'idle' || this.anim.done) this.anim.play('idle');
    this.anim.tick(dt);
  }

  private stepMove(to: Vec, dt: number): void {
    const c = this.cam;
    const a = c.project(this.pos), b = c.project(to);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    const water = this.medium === 'water';
    const speed = SIT_H * c.scaleAt(this.pos.y) * (water ? 0.75 : 2.4) * (this.brain.needs.energy < 0.2 ? 0.7 : 1);
    if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
    this.anim.ensure(water ? (this.face > 0 ? 'swimR' : 'swimL') : (this.face > 0 ? 'runR' : 'runL'));
    this.anim.tick(dt);
    if (d <= speed * dt || d < 0.5 || !Number.isFinite(d)) {
      this.pos = { ...to };
      this.cur = null;
    } else {
      this.pos = c.unproject(a.x + (dx / d) * speed * dt, a.y + (dy / d) * speed * dt);
    }
  }

  private stepJump(r: Running, s: Extract<Step, { type: 'jump' }>, dt: number): void {
    const lead = s.hop || s.into === 'water' ? 0.18 : 0;
    const p = Math.min(1, Math.max(0, (r.t - lead) / Math.max(0.1, r.dur - lead - 0.15)));
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    this.pos = { x: r.from.x + (s.to.x - r.from.x) * e, y: r.from.y + (s.to.y - r.from.y) * e };
    if (!s.hop && s.into === 'water' && p > 0.7 && this.medium !== 'water') {
      this.medium = 'water';
      this.waterSince = this.time;
      this.stats.swims++;
      this.fx.push({ type: 'splash', at: { ...s.to }, n: 26 });
      this.feel({ type: 'enteredWater' });
    }
    if (!s.hop && s.into === 'land' && p > 0.3 && this.medium !== 'land') this.medium = 'land';
    this.anim.tick(dt);
    if (r.t >= r.dur) {
      this.pos = { ...s.to };
      this.medium = s.into;
      this.cur = null;
      if (!s.hop && s.into === 'land') {
        this.wet = 4;
        this.fx.push({ type: 'splash', at: { ...this.pos }, n: 14 });
        this.feel({ type: 'leftWater' });
        this.queue.unshift({ type: 'anim', anim: 'shake' });
      }
      if (this.pending) {
        const next = this.pending;
        this.pending = null;
        this.start(next);
      }
    }
  }

  private updateBall(dt: number): void {
    const b = this.ball;
    if (b.state !== 'flying') return;
    b.t += dt / 1.05;
    const t = Math.min(b.t, 1);
    b.pos = { x: b.from.x + (b.to.x - b.from.x) * t, y: b.from.y + (b.to.y - b.from.y) * t };
    b.z = 4 * t * (1 - t) + 0.25 * (1 - t);
    if (b.t >= 1) {
      b.state = 'rest';
      b.z = 0;
      const inWater = this.yard.inPool(b.pos);
      if (inWater) this.fx.push({ type: 'splash', at: { ...b.pos }, n: 10 });
      this.feel({ type: 'ballLanded', inWater });
      this.lastThrowPending = true;
      if (!this.cur && !this.queue.length) this.finished();
    }
  }

  /** Keep her somewhere valid after the yard layout changes. */
  relayout(): void {
    const y = this.yard;
    if (this.medium === 'water' && !y.inPool(this.pos)) this.pos = y.clampToPool(this.pos);
    if (this.medium === 'land' && y.inPool(this.pos, 0.05)) this.pos = y.edgeCrossing(this.pos).O;
    if (this.ball.state === 'rest' && y.inPool(this.ball.pos, 0.05) && !y.inPool(this.ball.pos)) this.ball.pos = y.edgeCrossing(this.ball.pos).O;
    this.cur = null;
    this.queue = [];
    this.pending = null;
  }
}

function legToStep(leg: Leg): Step {
  return leg.type === 'move' ? { type: 'move', to: leg.to } : { type: 'jump', to: leg.to, into: leg.into };
}
