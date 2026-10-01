/**
 * Game: Jaylee's body (movement + animation), the ball and treats,
 * and the glue that runs intents through her brain.
 */
import { AnimPlayer } from './sprites.js';
import { Brain, type BrainContext } from './brain.js';
import { Camera, Yard } from './world.js';
import type { Activity, Decision, Intent, Medium, Snapshot, Source, Stats, Vec, WorldEvent } from './types.js';
/** Visual effects requested by the simulation; the renderer draws them. */
export type Fx = {
    type: 'splash';
    at: Vec;
    n: number;
} | {
    type: 'drip';
    at: Vec;
} | {
    type: 'ripple';
    at: Vec;
} | {
    type: 'hearts';
    at: Vec;
    n: number;
};
export interface Ball {
    state: 'none' | 'flying' | 'rest' | 'mouth';
    pos: Vec;
    z: number;
    from: Vec;
    to: Vec;
    t: number;
}
export interface Treat {
    pos: Vec;
    visible: boolean;
}
export type GameListener = (e: {
    type: 'say';
    line: string;
} | {
    type: 'decision';
    intent: Intent;
    source: Source;
    decision: Decision;
} | WorldEvent) => void;
export declare class Game {
    readonly yard: Yard;
    readonly cam: Camera;
    readonly brain: Brain;
    readonly anim: AnimPlayer;
    readonly fx: Fx[];
    readonly stats: Stats;
    pos: Vec;
    medium: Medium;
    face: 1 | -1;
    wet: number;
    autonomy: boolean;
    line: string;
    ball: Ball;
    treat: Treat;
    time: number;
    private queue;
    private cur;
    private pending;
    private current;
    private idleFor;
    private nextThink;
    private waterSince;
    private rippleT;
    private dripT;
    private listeners;
    constructor();
    on(fn: GameListener): () => void;
    private emit;
    say(line: string): void;
    /** 0 = on land, 1 = swimming; in between while jumping in or out. */
    get submerged(): number;
    get busy(): boolean;
    get activity(): Activity;
    context(): BrainContext;
    private ballWhere;
    snapshot(): Snapshot;
    /** Ask Jaylee to do something. She may say no. */
    request(intent: Intent, source?: Source): Decision;
    /** Player throws the ball; Jaylee decides whether to chase it. */
    throwBall(): void;
    pet(): void;
    private feel;
    private start;
    private compile;
    private pickUpBall;
    private dropBall;
    private eatTreat;
    update(dt: number): void;
    private idleLine;
    private think;
    private finished;
    private lastThrowPending;
    private begin;
    private idleAnim;
    private stepMove;
    private stepJump;
    private updateBall;
    /** Keep her somewhere valid after the yard layout changes. */
    relayout(): void;
}
