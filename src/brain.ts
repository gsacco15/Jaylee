/**
 * Jaylee's brain: needs + personality → decisions.
 *
 * Needs drift over time based on what her body is doing. Every few seconds of
 * idling she scores each thing she could do (utility AI) and picks one,
 * leaning toward the highest scores. Requests from the player (or a future
 * chat model) go through `consider`, so she can say yes, or say no when she's
 * worn out.
 */
import type {
  Activity, Decision, Emotion, Habit, Intent, IntentKind, Medium, Mood, Needs, Personality, Traits, Trick, WorldEvent,
} from './types.js';
import { clamp } from './world.js';

export const JAYLEE: Personality = {
  name: 'Jaylee',
  traits: { waterLove: 0.95, playfulness: 0.85, curiosity: 0.7, cuddliness: 0.8, obedience: 0.8 },
};

/** What the brain needs to know about the world to choose well. */
export interface BrainContext {
  medium: Medium;
  ball: 'none' | 'flying' | 'lawn' | 'pool' | 'mouth';
  /** Seconds since she last entered the water (0 on land). */
  timeInWater: number;
}

export interface Option {
  intent: Intent;
  score: number;
}

const LINES: Readonly<Record<IntentKind, readonly string[]>> = {
  goTo: ['On my way!', 'Coming!', 'Where we going?'],
  swim: ['Pool time!', 'Cannonball!', 'Splash splash splash'],
  leavePool: ['Okay, drying off', 'Sun nap time', 'Shake shake!'],
  fetch: ['BALL!', 'I got it, I got it!', 'Mine!'],
  trick: ['Watch this!', 'Look at me!'],
  zoomies: ['ZOOMIES!', 'Can’t stop won’t stop', 'Nyoooom'],
  wander: ['Patrolling the yard', 'Just checking things out', 'Hmm, what’s over here?'],
  rest: ['Taking a breather', 'Sitting pretty', 'Just gonna chill'],
  seekAttention: ['Pet me pls?', 'Hi! Hi! Notice me!', 'Got any love for me?'],
  eatTreat: ['Treat?! Yes please!', 'Nom nom nom', 'Best. Day. Ever.'],
};

const TRICK_LINES: Readonly<Record<Trick, readonly string[]>> = {
  sit: ['Sitting pretty'],
  wave: ['Hiii!', 'Wave hello!'],
  hop: ['Boing!', 'Hop hop!'],
  sniff: ['Sniff sniff… something was here', 'Smells interesting'],
  curious: ['Hmm?', 'Whatcha doing?'],
  beg: ['Play with me?', 'Pleeease?'],
  wink: ['Cheeky wink', 'You know you love me'],
  look: ['Looking around…', 'Did you hear that?'],
};

/** Intents that need energy; she can turn these down when she's exhausted. */
const ENERGETIC: ReadonlySet<IntentKind> = new Set(['zoomies', 'fetch', 'swim']);

const HABITS: Readonly<Record<Habit, readonly [keyof Traits, 1 | -1]>> = {
  swimMore: ['waterLove', 1], swimLess: ['waterLove', -1],
  playMore: ['playfulness', 1], playLess: ['playfulness', -1],
  cuddleMore: ['cuddliness', 1], cuddleLess: ['cuddliness', -1],
  exploreMore: ['curiosity', 1], exploreLess: ['curiosity', -1],
  listenMore: ['obedience', 1],
};

/** Chat feelings push her needs, which changes what she chooses next. */
function applyEmotion(n: Needs, e: Emotion): void {
  const add = (k: keyof Needs, v: number): void => { n[k] = clamp(n[k] + v, 0, 1); };
  switch (e) {
    case 'loved': add('affection', -0.4); add('boredom', -0.1); break;
    case 'excited': add('boredom', 0.35); add('energy', 0.1); break;
    case 'calm': add('boredom', -0.25); add('energy', -0.15); break;
    case 'curious': add('curiosity', 0.45); break;
    case 'sad': add('affection', 0.45); add('boredom', 0.1); break;
    case 'hot': add('heat', 0.4); break;
  }
}

export const intentKey = (i: Intent): string => (i.kind === 'trick' ? `trick:${i.trick}` : i.kind);

export class Brain {
  readonly needs: Needs = { energy: 0.85, boredom: 0.35, heat: 0.35, curiosity: 0.4, affection: 0.3 };
  private readonly cooldowns = new Map<string, number>();

  readonly personality: Personality;

  constructor(personality: Personality = JAYLEE, private readonly rng: () => number = Math.random) {
    // Own copy: habits learned in chat change these traits.
    this.personality = { name: personality.name, traits: { ...personality.traits } };
  }

  /** Nudge her personality for good. Returns the trait that changed. */
  adjustHabit(habit: Habit): keyof Traits {
    const [trait, dir] = HABITS[habit];
    const t = this.personality.traits;
    t[trait] = clamp(t[trait] + dir * 0.2, 0.1, 1);
    return trait;
  }

  private line(intent: Intent): string {
    const pool = intent.kind === 'trick' ? TRICK_LINES[intent.trick] : LINES[intent.kind];
    return pool[Math.floor(this.rng() * pool.length)] ?? '';
  }

  /** Needs drift every frame based on what the body is doing. */
  tick(dt: number, activity: Activity, medium: Medium): void {
    const n = this.needs, t = this.personality.traits;
    const rate: Record<Activity, Partial<Needs>> = {
      idle:     { energy: +0.02,  boredom: +0.014 * t.playfulness, heat: +0.004 },
      running:  { energy: -0.03,  boredom: -0.03,  heat: +0.028 },
      swimming: { energy: -0.02,  boredom: -0.03,  heat: -0.035 },
      paddling: { energy: -0.002, boredom: +0.004, heat: -0.025 },
      trick:    { energy: -0.006, boredom: -0.02,  heat: +0.002 },
      eating:   { energy: +0.03,  boredom: -0.01 },
    };
    const r = rate[activity];
    n.energy = clamp(n.energy + (r.energy ?? 0) * dt, 0, 1);
    n.boredom = clamp(n.boredom + (r.boredom ?? 0) * dt, 0, 1);
    n.heat = clamp(n.heat + (r.heat ?? 0) * dt + (medium === 'water' ? -0.01 * dt : 0), 0, 1);
    n.curiosity = clamp(n.curiosity + (medium === 'land' ? 0.012 * t.curiosity : 0.003) * dt, 0, 1);
    n.affection = clamp(n.affection + 0.007 * t.cuddliness * dt, 0, 1);
    for (const [k, v] of this.cooldowns) {
      if (v - dt <= 0) this.cooldowns.delete(k); else this.cooldowns.set(k, v - dt);
    }
  }

  /** React to something that happened to her. */
  feel(e: WorldEvent): void {
    const n = this.needs;
    switch (e.type) {
      case 'petted': n.affection = clamp(n.affection - 0.35, 0, 1); n.boredom = clamp(n.boredom - 0.05, 0, 1); break;
      case 'treat': n.energy = clamp(n.energy + 0.35, 0, 1); n.affection = clamp(n.affection - 0.15, 0, 1); break;
      case 'fetched': n.boredom = clamp(n.boredom - 0.3, 0, 1); n.affection = clamp(n.affection - 0.1, 0, 1); break;
      case 'enteredWater': n.heat = clamp(n.heat - 0.1, 0, 1); break;
      case 'ballThrown': n.boredom = clamp(n.boredom + 0.1, 0, 1); break;
      case 'talkedTo': n.affection = clamp(n.affection - 0.08, 0, 1); break;
      case 'feeling': applyEmotion(n, e.emotion); break;
      case 'ballLanded': case 'leftWater': break;
    }
  }

  /** Called when an intent finishes so it can satisfy the matching need. */
  satisfied(intent: Intent): void {
    const n = this.needs;
    if (intent.kind === 'trick') {
      if (intent.trick === 'sniff') n.curiosity = clamp(n.curiosity - 0.55, 0, 1);
      else if (intent.trick === 'look' || intent.trick === 'curious') n.curiosity = clamp(n.curiosity - 0.3, 0, 1);
      else n.boredom = clamp(n.boredom - 0.08, 0, 1);
    } else if (intent.kind === 'wander') n.curiosity = clamp(n.curiosity - 0.2, 0, 1);
    else if (intent.kind === 'zoomies') n.boredom = clamp(n.boredom - 0.4, 0, 1);
  }

  get happiness(): number {
    const n = this.needs;
    return clamp(1 - (n.boredom * 0.3 + n.affection * 0.3 + n.heat * 0.25 + (1 - n.energy) * 0.15), 0, 1);
  }

  get mood(): Mood {
    const n = this.needs;
    if (n.energy < 0.2) return 'sleepy';
    if (n.heat > 0.75) return 'hot';
    if (n.affection > 0.7) return 'needy';
    if (n.boredom > 0.65) return 'playful';
    if (n.curiosity > 0.7) return 'curious';
    return this.happiness > 0.7 ? 'happy' : 'content';
  }

  /** Score everything she could choose to do right now. */
  options(ctx: BrainContext): Option[] {
    const n = this.needs, t = this.personality.traits;
    const awake = n.energy > 0.15 ? 1 : 0.15;
    const o: Option[] = [];
    const add = (intent: Intent, score: number): void => {
      const cd = this.cooldowns.has(intentKey(intent)) ? 0.25 : 1;
      o.push({ intent, score: Math.max(0, score) * cd });
    };

    if (ctx.medium === 'water') {
      add({ kind: 'swim' }, (t.waterLove * 0.5 * n.energy + n.boredom * 0.2) * awake);
      add({ kind: 'leavePool' }, (1 - n.heat) * 0.4 + (1 - n.energy) * 0.9 + Math.min(ctx.timeInWater / 45, 0.6));
      add({ kind: 'rest' }, 0.08); // tread water a bit
    } else {
      add({ kind: 'swim' }, (Math.pow(n.heat, 1.5) * t.waterLove * 1.7 + 0.06 * t.waterLove) * awake);
      add({ kind: 'rest' }, Math.pow(1 - n.energy, 2) * 1.7);
      add({ kind: 'wander' }, (0.22 + n.curiosity * 0.25) * awake);
      add({ kind: 'zoomies' }, Math.pow(n.boredom, 2) * t.playfulness * Math.pow(n.energy, 2) * 1.8);
      add({ kind: 'seekAttention' }, Math.pow(n.affection, 1.5) * t.cuddliness * 1.5);
      add({ kind: 'trick', trick: 'sniff' }, n.curiosity * t.curiosity * 1.1);
      add({ kind: 'trick', trick: 'look' }, n.curiosity * 0.45 + 0.05);
      for (const trick of ['wink', 'curious', 'beg', 'wave', 'hop'] as const) {
        add({ kind: 'trick', trick }, 0.05 + n.boredom * 0.12 * (trick === 'hop' ? n.energy : 1));
      }
    }
    if (ctx.ball === 'lawn' || ctx.ball === 'pool') {
      const wet = ctx.ball === 'pool' ? 0.6 + t.waterLove * 0.5 : 1;
      add({ kind: 'fetch' }, (n.boredom * t.playfulness * n.energy * 1.4 + 0.08) * wet * awake);
    }
    return o.sort((a, b) => b.score - a.score);
  }

  /** Pick something to do on her own: weighted toward the top few options. */
  decide(ctx: BrainContext): { intent: Intent; line: string } {
    const top = this.options(ctx).slice(0, 3);
    const weights = top.map((x) => x.score * x.score + 1e-4);
    let r = this.rng() * weights.reduce((a, b) => a + b, 0);
    let chosen = top[0]?.intent ?? { kind: 'rest' };
    for (let i = 0; i < top.length; i++) {
      r -= weights[i]!;
      if (r <= 0) { chosen = top[i]!.intent; break; }
    }
    this.cooldowns.set(intentKey(chosen), 12);
    return { intent: chosen, line: this.line(chosen) };
  }

  /** Should she do what she's asked? Returns her answer either way. */
  consider(intent: Intent, source: 'player' | 'self' | 'chat', ctx: BrainContext): Decision {
    const n = this.needs, t = this.personality.traits;
    if (source !== 'self') {
      if (ENERGETIC.has(intent.kind) && n.energy < 0.12 && this.rng() > t.obedience * 0.3) {
        return { accept: false, line: 'Too pooped… maybe a treat?' };
      }
      if (intent.kind === 'goTo' && ctx.medium === 'water' && n.heat > 0.6 && this.rng() > t.obedience) {
        return { accept: false, line: 'One more lap first!' };
      }
    }
    this.cooldowns.set(intentKey(intent), 8);
    return { accept: true, intent, line: this.line(intent) };
  }
}
