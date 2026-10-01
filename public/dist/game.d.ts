/**
 * Game: the shared world — yard, camera, ball, treats, effects — and the
 * dogs in it. One dog or both, depending on the mode.
 */
import { Dog } from './dog.js';
import { type DogId } from './dogs.js';
import { Camera, Yard } from './world.js';
import type { Decision, Intent, Snapshot, Source, Vec, WorldEvent } from './types.js';
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
    holder: DogId | null;
}
export interface Treat {
    pos: Vec;
    visible: boolean;
}
export type Mode = DogId | 'both';
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
    placeTreat(at: Vec): void;
    eatTreat(): boolean;
    /** Two dogs just played: both feel it. */
    played(a: Dog, b: Dog, hearts: number): void;
    update(dt: number): void;
    relayout(dropPlans?: boolean): void;
}
