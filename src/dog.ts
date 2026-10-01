/**
 * One dog: body (movement + animation) and brain. The shared world (yard,
 * ball, treats, effects, the other dog) lives in Game.
 */
import { AnimPlayer, SIT_H, type AnimName } from './sprites.js';
import { Brain, type BrainContext } from './brain.js';
import { dist, rand, type Leg } from './world.js';
import type { DogProfile } from './dogs.js';
import type { Game } from './game.js';
import type { Activity, Decision, Emotion, Intent, Medium, Snapshot, Source, Stats, Vec, WorldEvent } from './types.js';

type Step =
  | { type: 'move'; to: Vec }
  | { type: 'chase'; target: () => Vec | null; near: number; timeout: number }
  | { type: 'jump'; to: Vec; into: Medium; hop?: boolean }
  | { type: 'anim'; anim: AnimName; activity?: Activity }
  | { type: 'idle'; secs: number }
  | { type: 'wait'; until: () => boolean; timeout: number }
  | { type: 'call'; fn: () => void };

interface Running { step: Step; t: number; from: Vec; dur: number }

export class Dog {
  readonly id: DogProfile['id'];
  readonly brain: Brain;
  readonly anim = new AnimPlayer();
  readonly stats: Stats = { fetches: 0, swims: 0, pets: 0, treats: 0 };

  pos: Vec;
  medium: Medium = 'land';
  face: 1 | -1 = 1;
  wet = 0;
  line: string;

  private queue: Step[] = [];
  private cur: Running | null = null;
  private pending: Intent | null = null;
  private current: Intent | null = null;
  private idleFor = 0;
  private nextThink = 2;
  private waterSince = 0;
  private rippleT = 0;
  private dripT = 0;
  /** Set when a thrown ball lands, so she chases it once she's free. */
  wantsBall = false;

  constructor(readonly profile: DogProfile, private readonly g: Game, start: Vec) {
    this.id = profile.id;
    this.brain = new Brain(profile.personality);
    this.pos = { ...start };
    this.line = profile.lines.hello;
    this.nextThink = rand(1.5, 3.5);
    this.anim.play('idle');
  }

  get name(): string { return this.profile.name; }

  // ---------- State ----------

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
  get jumping(): boolean { return this.cur?.step.type === 'jump'; }

  get activity(): Activity {
    const s = this.cur?.step;
    if (!s) return this.medium === 'water' ? 'paddling' : 'idle';
    if (s.type === 'move' || s.type === 'chase') return this.medium === 'water' ? 'swimming' : 'running';
    if (s.type === 'jump') return 'running';
    if (s.type === 'anim') return s.activity ?? 'trick';
    return this.medium === 'water' ? 'paddling' : 'idle';
  }

  get friend(): Dog | null { return this.g.friendOf(this); }

  context(): BrainContext {
    const f = this.friend;
    return {
      medium: this.medium,
      ball: this.g.ballWhere(),
      timeInWater: this.medium === 'water' ? this.g.time - this.waterSince : 0,
      friend: f ? { medium: f.medium, distance: dist(f.pos, this.pos), busy: f.busy } : null,
    };
  }

  snapshot(): Snapshot {
    const f = this.friend;
    return {
      id: this.id,
      name: this.name,
      position: { ...this.pos },
      medium: this.medium,
      activity: this.activity,
      busy: this.busy,
      needs: { ...this.brain.needs },
      mood: this.brain.mood,
      happiness: this.brain.happiness,
      wet: this.wet > 0 || this.medium === 'water',
      ball: this.g.ballWhere(this),
      stats: { ...this.stats },
      traits: { ...this.brain.personality.traits },
      friend: f ? { name: f.name, medium: f.medium, activity: f.activity, distance: dist(f.pos, this.pos) } : null,
    };
  }

  // ---------- Control surface ----------

  say(line: string): void {
    if (!line || line === this.line) return;
    this.line = line;
    this.g.emit({ type: 'say', dog: this.id, line });
  }

  feel(e: WorldEvent): void {
    this.brain.feel(e);
    this.g.emit({ ...e, dog: this.id });
  }

  /** Ask her to do something. She may say no. */
  request(intent: Intent, source: Source = 'player'): Decision {
    if (intent.kind === 'fetch' && this.g.ball.state !== 'rest') {
      return { accept: false, line: this.g.ball.state === 'flying' ? 'Waiting for it to land…' : 'No ball out there' };
    }
    if ((intent.kind === 'playWith' || intent.kind === 'greet' || intent.kind === 'joinFriend') && !this.friend) {
      return { accept: false, line: 'Nobody to play with…' };
    }
    const decision = this.brain.consider(intent, source, this.context());
    this.g.emit({ type: 'decision', dog: this.id, intent, source, decision });
    if (source !== 'chat' || !decision.accept) this.say(decision.line);
    if (!decision.accept) return decision;
    this.idleFor = 0;
    this.nextThink = rand(3, 7);
    if (!(intent.kind === 'fetch')) this.g.dropBall(this);
    if (this.jumping) { this.pending = intent; return decision; }
    this.start(intent);
    return decision;
  }

  /** Watch a thrown ball until it lands. */
  watchBall(): void {
    if (!this.jumping) this.cur = null;
    this.queue = [{ type: 'wait', until: () => this.g.ball.state !== 'flying', timeout: 3 }];
    this.pending = null;
    this.current = null;
    this.idleFor = 0;
  }

  /** Someone talked to her in chat: she pauses and listens. */
  hear(): void {
    this.feel({ type: 'talkedTo' });
    this.nextThink = Math.max(this.nextThink, this.idleFor + 8);
    if (!this.busy && this.medium === 'land') {
      this.current = null;
      this.queue = [{ type: 'anim', anim: 'curious' }];
    }
  }

  /** A feeling from chat. */
  sense(emotion: Emotion): void {
    this.feel({ type: 'feeling', emotion });
    if (emotion === 'loved') this.g.fx.push({ type: 'hearts', at: { ...this.pos }, n: 4 });
    if (emotion === 'scared') this.spook();
  }

  /** Spooked: some dogs bolt to the back of the yard, some run to their people. */
  spook(): void {
    const lines = this.profile.lines.scared;
    this.say(lines[Math.floor(Math.random() * lines.length)]!);
    if (this.jumping) return;
    this.pending = null;
    this.idleFor = 0;
    this.nextThink = 10;
    if (this.profile.whenScared === 'comfort') {
      this.start({ kind: 'seekAttention' });
      return;
    }
    // Wide-eyed look, then bolt somewhere far from the front of the yard.
    const y = this.g.yard;
    const hide = y.randomLand({ x: this.pos.x < 0.5 ? 0.15 : 0.85, y: 0.12 }, 0.2);
    this.current = { kind: 'rest' };
    this.cur = null;
    const steps: Step[] = [{ type: 'anim', anim: 'curious' }];
    let at = this.pos, medium = this.medium;
    for (const leg of y.route(at, medium, hide)) { steps.push(legToStep(leg)); at = leg.to; if (leg.type === 'jump') medium = leg.into; }
    steps.push({ type: 'anim', anim: 'look' }, { type: 'idle', secs: 2.5 });
    this.queue = steps;
  }

  pet(): void {
    this.stats.pets++;
    this.feel({ type: 'petted' });
    this.g.fx.push({ type: 'hearts', at: { ...this.pos }, n: 5 });
    if (!this.busy && this.medium === 'land') {
      const trick = (['wave', 'beg', 'wink', 'curious'] as const)[Math.floor(Math.random() * 4)]!;
      this.request({ kind: 'trick', trick }, 'self');
    }
    const lines = this.profile.lines.pet;
    this.say(lines[Math.floor(Math.random() * lines.length)]!);
  }

  // ---------- Playing with the other dog ----------

  /** The other dog wants to play chase: run off, then play-bow. */
  private beChased(by: Dog): boolean {
    if (this.jumping || this.medium !== 'land') return false;
    const d = this.brain.consider({ kind: 'playWith' }, 'friend', this.context());
    if (!d.accept) {
      const no = this.profile.lines.noPlay;
      this.say(no[Math.floor(Math.random() * no.length)]!);
      return false;
    }
    this.say(d.line);
    this.idleFor = 0;
    // Replace her own chase plan with fleeing.
    const away = this.g.yard.randomLand({ x: this.pos.x * 2 - by.pos.x, y: this.pos.y * 2 - by.pos.y }, 0.35);
    this.current = { kind: 'playWith' };
    this.cur = null;
    this.queue = [
      { type: 'anim', anim: 'beg' },
      ...this.g.yard.landPath(this.pos, away).map((to): Step => ({ type: 'move', to })),
      { type: 'wait', until: () => !by.busy || dist(by.pos, this.pos) < 0.07, timeout: 5 },
      { type: 'call', fn: () => this.faceTo(by.pos) },
      { type: 'anim', anim: 'beg' },
    ];
    return true;
  }

  /** The other dog came over to sniff hello. */
  private greetedBy(by: Dog): void {
    if (this.busy || this.medium !== 'land') return;
    this.faceTo(by.pos);
    this.queue = [{ type: 'anim', anim: Math.random() < 0.5 ? 'curious' : 'wink' }];
  }

  private faceTo(p: Vec): void {
    if (Math.abs(p.x - this.pos.x) > 0.005) this.face = p.x > this.pos.x ? 1 : -1;
  }

  // ---------- Intent → steps ----------

  private start(intent: Intent): void {
    this.current = intent;
    this.cur = null;
    this.queue = this.compile(intent);
  }

  private compile(intent: Intent): Step[] {
    const y = this.g.yard;
    const steps: Step[] = [];
    let at: Vec = { ...this.pos };
    let medium: Medium = this.medium;
    const friend = this.friend;

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
        go(this.g.ball.pos);
        steps.push({ type: 'call', fn: () => this.grabBall() });
        go(y.randomLand({ x: 0.35, y: 0.9 }, 0.25));
        steps.push({ type: 'call', fn: () => this.g.dropBall(this) });
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
        steps.push({ type: 'idle', secs: medium === 'water' ? rand(2, 4) : rand(5, 9) });
        break;
      case 'seekAttention':
        toLand();
        go(y.randomLand({ x: 0.4, y: 0.88 }, 0.3));
        steps.push({ type: 'anim', anim: 'wave' }, { type: 'anim', anim: 'beg' });
        break;
      case 'eatTreat': {
        toLand();
        const spot = y.clampToBounds({ x: at.x + 0.06 * this.face, y: at.y + 0.03 });
        steps.push({ type: 'call', fn: () => this.g.placeTreat(spot) });
        steps.push({ type: 'move', to: { x: spot.x - 0.025 * Math.sign(spot.x - at.x || 1), y: spot.y } });
        steps.push({ type: 'anim', anim: 'eat', activity: 'eating' });
        steps.push({ type: 'call', fn: () => this.eatTreat() });
        break;
      }
      case 'playWith': {
        if (!friend) break;
        toLand();
        // Play bow, invite, then chase them down.
        steps.push(
          { type: 'call', fn: () => this.faceTo(friend.pos) },
          { type: 'anim', anim: 'beg' },
          { type: 'call', fn: () => { if (!friend.beChased(this)) { this.say('Aww… fine'); this.queue = [{ type: 'anim', anim: 'curious' }]; } } },
          { type: 'idle', secs: 0.5 },
          { type: 'chase', target: () => (friend.medium === 'land' ? friend.pos : null), near: 0.07, timeout: 7 },
          { type: 'call', fn: () => this.tagged(friend) },
          { type: 'anim', anim: 'beg' },
        );
        break;
      }
      case 'greet': {
        if (!friend) break;
        if (friend.medium === 'water') { go(y.clampToPool(friend.pos)); break; }
        toLand();
        const side = at.x < friend.pos.x ? -1 : 1;
        go(y.clampToBounds({ x: friend.pos.x + side * 0.07, y: friend.pos.y + 0.01 }));
        steps.push(
          { type: 'call', fn: () => { this.faceTo(friend.pos); friend.greetedBy(this); } },
          { type: 'anim', anim: 'sniff' },
          { type: 'call', fn: () => this.g.played(this, friend, 1) },
        );
        break;
      }
      case 'joinFriend': {
        if (!friend) break;
        if (friend.medium === 'water') go(y.clampToPool({ x: friend.pos.x + rand(-0.06, 0.06), y: friend.pos.y + rand(-0.05, 0.05) }));
        else {
          toLand();
          const side = at.x < friend.pos.x ? -1 : 1;
          go(y.clampToBounds({ x: friend.pos.x + side * 0.08, y: friend.pos.y + 0.02 }));
          steps.push({ type: 'call', fn: () => this.faceTo(friend.pos) }, { type: 'anim', anim: 'beg' });
        }
        break;
      }
    }
    return steps;
  }

  private tagged(friend: Dog): void {
    if (dist(friend.pos, this.pos) > 0.12) return;
    this.faceTo(friend.pos);
    this.g.played(this, friend, 4);
    this.say('Tag! Got you!');
  }

  private grabBall(): void {
    if (this.g.pickUpBall(this)) {
      this.stats.fetches++;
      this.feel({ type: 'fetched' });
      this.g.fx.push({ type: 'hearts', at: { ...this.pos }, n: 4 });
      const lines = this.profile.lines.gotBall;
      this.say(lines[Math.floor(Math.random() * lines.length)]!);
      return;
    }
    // Beaten to it.
    const holder = this.g.ballHolder();
    this.current = null;
    this.queue = [{ type: 'anim', anim: 'curious' }];
    if (holder && holder !== this && holder.medium === 'land' && this.medium === 'land' && this.brain.personality.traits.sociability > 0.5) {
      this.say('Hey! No fair!');
      this.queue.push({ type: 'chase', target: () => (holder.medium === 'land' ? holder.pos : null), near: 0.08, timeout: 4 }, { type: 'anim', anim: 'beg' });
    } else this.say('Aww, beaten to it');
  }

  private eatTreat(): void {
    if (!this.g.eatTreat()) return;
    this.stats.treats++;
    this.feel({ type: 'treat' });
    this.g.fx.push({ type: 'hearts', at: { ...this.pos }, n: 3 });
  }

  // ---------- Simulation ----------

  update(dt: number): void {
    this.brain.tick(dt, this.activity, this.medium, this.friend !== null);

    if (!this.cur && this.queue.length) this.begin(this.queue.shift()!);
    const r = this.cur;

    if (r) {
      r.t += dt;
      this.idleFor = 0;
      const s = r.step;
      switch (s.type) {
        case 'move': if (this.stepMove(s.to, dt)) this.cur = null; break;
        case 'chase': {
          const t = s.target();
          if (!t || r.t > s.timeout || dist(t, this.pos) < s.near) { this.cur = null; break; }
          // Head for the next waypoint around the pool, not straight through it.
          const via = this.medium === 'land' ? this.g.yard.landPath(this.pos, t)[0] ?? t : t;
          this.stepMove(via, dt, 1.15);
          break;
        }
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
      if (this.g.autonomy && this.idleFor > this.nextThink) this.think();
    }

    if (this.medium === 'water') {
      this.rippleT -= dt;
      if (this.rippleT <= 0) {
        this.g.fx.push({ type: 'ripple', at: { ...this.pos } });
        this.rippleT = this.activity === 'swimming' ? 0.28 : 0.9;
      }
    }
    if (this.wet > 0 && this.medium === 'land') {
      this.wet -= dt;
      this.dripT -= dt;
      if (this.dripT <= 0) { this.g.fx.push({ type: 'drip', at: { ...this.pos } }); this.dripT = 0.12; }
    }
  }

  private idleLine(): string {
    const m = this.brain.mood;
    const f = this.friend;
    if (f && this.brain.needs.social > 0.6) return `Wanna play, ${f.name}?`;
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
    if (this.wantsBall && this.g.ball.state === 'rest') {
      this.wantsBall = false;
      this.request({ kind: 'fetch' }, 'player');
    }
  }

  /** Called by the game when the ball lands. */
  ballLanded(): void {
    this.wantsBall = true;
    if (!this.busy) this.finished();
  }

  private begin(step: Step): void {
    this.cur = { step, t: 0, from: { ...this.pos }, dur: 0 };
    if (step.type === 'anim') this.anim.play(step.anim);
    else if (step.type === 'jump') {
      this.faceTo(step.to);
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

  /** Move toward `to`; true when she gets there. */
  private stepMove(to: Vec, dt: number, boost = 1): boolean {
    const c = this.g.cam;
    const a = c.project(this.pos), b = c.project(to);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    const water = this.medium === 'water';
    const speed = SIT_H * c.scaleAt(this.pos.y) * (water ? 0.75 : 2.4) * (this.brain.needs.energy < 0.2 ? 0.7 : 1) * boost;
    if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
    this.anim.ensure(water ? (this.face > 0 ? 'swimR' : 'swimL') : (this.face > 0 ? 'runR' : 'runL'));
    this.anim.tick(dt);
    if (d <= speed * dt || d < 0.5 || !Number.isFinite(d)) {
      this.pos = { ...to };
      return true;
    }
    const next = c.unproject(a.x + (dx / d) * speed * dt, a.y + (dy / d) * speed * dt);
    // Never run across the water while chasing on land.
    if (!water && this.g.yard.inPool(next, 0.02)) return true;
    this.pos = next;
    return false;
  }

  private stepJump(r: Running, s: Extract<Step, { type: 'jump' }>, dt: number): void {
    const lead = s.hop || s.into === 'water' ? 0.18 : 0;
    const p = Math.min(1, Math.max(0, (r.t - lead) / Math.max(0.1, r.dur - lead - 0.15)));
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    this.pos = { x: r.from.x + (s.to.x - r.from.x) * e, y: r.from.y + (s.to.y - r.from.y) * e };
    if (!s.hop && s.into === 'water' && p > 0.7 && this.medium !== 'water') {
      this.medium = 'water';
      this.waterSince = this.g.time;
      this.stats.swims++;
      this.g.fx.push({ type: 'splash', at: { ...s.to }, n: 26 });
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
        this.g.fx.push({ type: 'splash', at: { ...this.pos }, n: 14 });
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

  /** Keep her somewhere valid after the yard layout changes. */
  relayout(dropPlans = true): void {
    const y = this.g.yard;
    if (this.medium === 'water' && !y.inPool(this.pos)) this.pos = y.clampToPool(this.pos);
    if (this.medium === 'land') this.pos = y.clampToBounds(this.pos);
    if (this.medium === 'land' && y.inPool(this.pos, 0.05)) this.pos = y.edgeCrossing(this.pos).O;
    if (!dropPlans) return;
    this.cur = null;
    this.queue = [];
    this.pending = null;
  }

  /** Gently push apart when two dogs end up standing on the same spot. */
  nudge(dx: number, dy: number): void {
    if (this.jumping || this.cur?.step.type === 'move' || this.cur?.step.type === 'chase') return;
    const p = this.g.yard.clampToBounds({ x: this.pos.x + dx, y: this.pos.y + dy });
    const inPool = this.g.yard.inPool(p);
    if ((this.medium === 'water') === inPool && !(this.medium === 'land' && this.g.yard.inPool(p, 0.04))) this.pos = p;
  }
}

function legToStep(leg: Leg): Step {
  return leg.type === 'move' ? { type: 'move', to: leg.to } : { type: 'jump', to: leg.to, into: leg.into };
}
