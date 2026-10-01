import { clamp } from './world.js';
export const JAYLEE = {
    name: 'Jaylee',
    traits: { waterLove: 0.95, playfulness: 0.85, curiosity: 0.7, cuddliness: 0.8, obedience: 0.8 },
};
const LINES = {
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
const TRICK_LINES = {
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
const ENERGETIC = new Set(['zoomies', 'fetch', 'swim']);
export const intentKey = (i) => (i.kind === 'trick' ? `trick:${i.trick}` : i.kind);
export class Brain {
    personality;
    rng;
    needs = { energy: 0.85, boredom: 0.35, heat: 0.35, curiosity: 0.4, affection: 0.3 };
    cooldowns = new Map();
    constructor(personality = JAYLEE, rng = Math.random) {
        this.personality = personality;
        this.rng = rng;
    }
    line(intent) {
        const pool = intent.kind === 'trick' ? TRICK_LINES[intent.trick] : LINES[intent.kind];
        return pool[Math.floor(this.rng() * pool.length)] ?? '';
    }
    /** Needs drift every frame based on what the body is doing. */
    tick(dt, activity, medium) {
        const n = this.needs, t = this.personality.traits;
        const rate = {
            idle: { energy: +0.02, boredom: +0.014 * t.playfulness, heat: +0.004 },
            running: { energy: -0.03, boredom: -0.03, heat: +0.028 },
            swimming: { energy: -0.02, boredom: -0.03, heat: -0.035 },
            paddling: { energy: -0.002, boredom: +0.004, heat: -0.025 },
            trick: { energy: -0.006, boredom: -0.02, heat: +0.002 },
            eating: { energy: +0.03, boredom: -0.01 },
        };
        const r = rate[activity];
        n.energy = clamp(n.energy + (r.energy ?? 0) * dt, 0, 1);
        n.boredom = clamp(n.boredom + (r.boredom ?? 0) * dt, 0, 1);
        n.heat = clamp(n.heat + (r.heat ?? 0) * dt + (medium === 'water' ? -0.01 * dt : 0), 0, 1);
        n.curiosity = clamp(n.curiosity + (medium === 'land' ? 0.012 * t.curiosity : 0.003) * dt, 0, 1);
        n.affection = clamp(n.affection + 0.007 * t.cuddliness * dt, 0, 1);
        for (const [k, v] of this.cooldowns) {
            if (v - dt <= 0)
                this.cooldowns.delete(k);
            else
                this.cooldowns.set(k, v - dt);
        }
    }
    /** React to something that happened to her. */
    feel(e) {
        const n = this.needs;
        switch (e.type) {
            case 'petted':
                n.affection = clamp(n.affection - 0.35, 0, 1);
                n.boredom = clamp(n.boredom - 0.05, 0, 1);
                break;
            case 'treat':
                n.energy = clamp(n.energy + 0.35, 0, 1);
                n.affection = clamp(n.affection - 0.15, 0, 1);
                break;
            case 'fetched':
                n.boredom = clamp(n.boredom - 0.3, 0, 1);
                n.affection = clamp(n.affection - 0.1, 0, 1);
                break;
            case 'enteredWater':
                n.heat = clamp(n.heat - 0.1, 0, 1);
                break;
            case 'ballThrown':
                n.boredom = clamp(n.boredom + 0.1, 0, 1);
                break;
            case 'ballLanded':
            case 'leftWater': break;
        }
    }
    /** Called when an intent finishes so it can satisfy the matching need. */
    satisfied(intent) {
        const n = this.needs;
        if (intent.kind === 'trick') {
            if (intent.trick === 'sniff')
                n.curiosity = clamp(n.curiosity - 0.55, 0, 1);
            else if (intent.trick === 'look' || intent.trick === 'curious')
                n.curiosity = clamp(n.curiosity - 0.3, 0, 1);
            else
                n.boredom = clamp(n.boredom - 0.08, 0, 1);
        }
        else if (intent.kind === 'wander')
            n.curiosity = clamp(n.curiosity - 0.2, 0, 1);
        else if (intent.kind === 'zoomies')
            n.boredom = clamp(n.boredom - 0.4, 0, 1);
    }
    get happiness() {
        const n = this.needs;
        return clamp(1 - (n.boredom * 0.3 + n.affection * 0.3 + n.heat * 0.25 + (1 - n.energy) * 0.15), 0, 1);
    }
    get mood() {
        const n = this.needs;
        if (n.energy < 0.2)
            return 'sleepy';
        if (n.heat > 0.75)
            return 'hot';
        if (n.affection > 0.7)
            return 'needy';
        if (n.boredom > 0.65)
            return 'playful';
        if (n.curiosity > 0.7)
            return 'curious';
        return this.happiness > 0.7 ? 'happy' : 'content';
    }
    /** Score everything she could choose to do right now. */
    options(ctx) {
        const n = this.needs, t = this.personality.traits;
        const awake = n.energy > 0.15 ? 1 : 0.15;
        const o = [];
        const add = (intent, score) => {
            const cd = this.cooldowns.has(intentKey(intent)) ? 0.25 : 1;
            o.push({ intent, score: Math.max(0, score) * cd });
        };
        if (ctx.medium === 'water') {
            add({ kind: 'swim' }, (t.waterLove * 0.5 * n.energy + n.boredom * 0.2) * awake);
            add({ kind: 'leavePool' }, (1 - n.heat) * 0.4 + (1 - n.energy) * 0.9 + Math.min(ctx.timeInWater / 45, 0.6));
            add({ kind: 'rest' }, 0.08); // tread water a bit
        }
        else {
            add({ kind: 'swim' }, (Math.pow(n.heat, 1.5) * t.waterLove * 1.7 + 0.06 * t.waterLove) * awake);
            add({ kind: 'rest' }, Math.pow(1 - n.energy, 2) * 1.7);
            add({ kind: 'wander' }, (0.22 + n.curiosity * 0.25) * awake);
            add({ kind: 'zoomies' }, Math.pow(n.boredom, 2) * t.playfulness * Math.pow(n.energy, 2) * 1.8);
            add({ kind: 'seekAttention' }, Math.pow(n.affection, 1.5) * t.cuddliness * 1.5);
            add({ kind: 'trick', trick: 'sniff' }, n.curiosity * t.curiosity * 1.1);
            add({ kind: 'trick', trick: 'look' }, n.curiosity * 0.45 + 0.05);
            for (const trick of ['wink', 'curious', 'beg', 'wave', 'hop']) {
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
    decide(ctx) {
        const top = this.options(ctx).slice(0, 3);
        const weights = top.map((x) => x.score * x.score + 1e-4);
        let r = this.rng() * weights.reduce((a, b) => a + b, 0);
        let chosen = top[0]?.intent ?? { kind: 'rest' };
        for (let i = 0; i < top.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                chosen = top[i].intent;
                break;
            }
        }
        this.cooldowns.set(intentKey(chosen), 12);
        return { intent: chosen, line: this.line(chosen) };
    }
    /** Should she do what she's asked? Returns her answer either way. */
    consider(intent, source, ctx) {
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
