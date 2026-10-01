/**
 * Game: the shared world — yard, camera, ball, treats, effects — and the
 * dogs in it. One dog or both, depending on the mode.
 */
import { Dog } from './dog.js';
import { type DogId } from './dogs.js';
import { Camera, Yard } from './world.js';
import type { Decision, Intent, Snapshot, Source, TimeOfDay, Vec, WorldEvent } from './types.js';
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
} | {
    type: 'zzz';
    at: Vec;
} | {
    type: 'shake';
};
export interface Ball {
    state: 'none' | 'flying' | 'rest' | 'mouth';
    pos: Vec;
    z: number;
    from: Vec;
    to: Vec;
    t: number;
    holder: DogId | null;
}
export interface Treat {
    pos: Vec;
    visible: boolean;
}
export type Mode = DogId | 'both';
export type TimeMode = 'auto' | 'day' | 'night';
export interface Rope {
    state: 'lawn' | 'tug' | 'carried';
    pos: Vec;
    /** Who's carrying it (state 'carried'). */
    holder: DogId | null;
    /** The two ends during a tug. */
    a: DogId | null;
    b: DogId | 'human' | null;
    t: number;
    dur: number;
    anchor: Vec;
    axis: 1 | -1;
}
export type GameEvent = {
    type: 'say';
    dog: DogId;
    line: string;
} | {
    type: 'decision';
    dog: DogId;
    intent: Intent;
    source: Source;
    decision: Decision;
} | {
    type: 'mode';
    mode: Mode;
} | {
    type: 'select';
    dog: DogId;
} | (WorldEvent & {
    dog: DogId;
});
export type GameListener = (e: GameEvent) => void;
export declare class Game {
    readonly yard: Yard;
    readonly cam: Camera;
    readonly fx: Fx[];
    /** Every dog, whether or not they're in the yard right now. */
    readonly roster: Readonly<Record<DogId, Dog>>;
    mode: Mode;
    autonomy: boolean;
    time: number;
    ball: Ball;
    treat: Treat;
    rope: Rope;
    /** Day/night: follow the local clock, or force one. */
    timeMode: TimeMode;
    /** 0 = night, 1 = full day (eased toward the target). */
    light: number;
    /** Sunset / sunrise glow, 0..1. */
    warmth: number;
    private selectedId;
    private listeners;
    constructor();
    /** Dogs currently in the yard. */
    get dogs(): Dog[];
    /** The dog the buttons and meters are about. */
    get selected(): Dog;
    select(id: DogId): void;
    setMode(mode: Mode): void;
    friendOf(dog: Dog): Dog | null;
    dogAt(id: string): Dog | null;
    on(fn: GameListener): () => void;
    emit(e: GameEvent): void;
    ballWhere(asSeenBy?: Dog): Snapshot['ball'];
    ballHolder(): Dog | null;
    /** Player throws the ball from the selected dog; everyone watches it fly. */
    throwBall(): void;
    /** First dog to reach the ball gets it. */
    pickUpBall(dog: Dog): boolean;
    dropBall(dog: Dog): void;
    private updateBall;
    get night(): boolean;
    get timeOfDay(): TimeOfDay;
    private updateLight;
    tugging(dog: Dog): boolean;
    /** Pick the rope up off the lawn. */
    holdRope(dog: Dog): boolean;
    dropRope(dog: Dog): void;
    /** Start a match between a dog and the human, or two dogs. */
    startTug(a: Dog, b: Dog | 'human'): boolean;
    private updateRope;
    placeTreat(at: Vec): void;
    eatTreat(): boolean;
    /** Two dogs just played: both feel it. */
    played(a: Dog, b: Dog, hearts: number): void;
    update(dt: number): void;
    relayout(dropPlans?: boolean): void;
}
