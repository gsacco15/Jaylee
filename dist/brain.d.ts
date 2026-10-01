/**
 * Jaylee's brain: needs + personality → decisions.
 *
 * Needs drift over time based on what her body is doing. Every few seconds of
 * idling she scores each thing she could do (utility AI) and picks one,
 * leaning toward the highest scores. Requests from the player (or a future
 * chat model) go through `consider`, so she can say yes, or say no when she's
 * worn out.
 */
import type { Activity, Decision, Intent, Medium, Mood, Needs, Personality, WorldEvent } from './types.js';
export declare const JAYLEE: Personality;
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
export declare const intentKey: (i: Intent) => string;
export declare class Brain {
    readonly personality: Personality;
    private readonly rng;
    readonly needs: Needs;
    private readonly cooldowns;
    constructor(personality?: Personality, rng?: () => number);
    private line;
    /** Needs drift every frame based on what the body is doing. */
    tick(dt: number, activity: Activity, medium: Medium): void;
    /** React to something that happened to her. */
    feel(e: WorldEvent): void;
    /** Called when an intent finishes so it can satisfy the matching need. */
    satisfied(intent: Intent): void;
    get happiness(): number;
    get mood(): Mood;
    /** Score everything she could choose to do right now. */
    options(ctx: BrainContext): Option[];
    /** Pick something to do on her own: weighted toward the top few options. */
    decide(ctx: BrainContext): {
        intent: Intent;
        line: string;
    };
    /** Should she do what she's asked? Returns her answer either way. */
    consider(intent: Intent, source: 'player' | 'self' | 'chat', ctx: BrainContext): Decision;
}
