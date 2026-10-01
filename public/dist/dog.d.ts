/**
 * One dog: body (movement + animation) and brain. The shared world (yard,
 * ball, treats, effects, the other dog) lives in Game.
 */
import { AnimPlayer, type AnimName } from './sprites.js';
import { Brain, type BrainContext } from './brain.js';
import type { DogProfile } from './dogs.js';
import type { Game } from './game.js';
import type { Activity, Decision, Emotion, Intent, Medium, Snapshot, Source, Stats, Vec, WorldEvent } from './types.js';
type Step = {
    type: 'move';
    to: Vec;
} | {
    type: 'chase';
    target: () => Vec | null;
    near: number;
    timeout: number;
} | {
    type: 'jump';
    to: Vec;
    into: Medium;
    hop?: boolean;
} | {
    type: 'anim';
    anim: AnimName;
    activity?: Activity;
} | {
    type: 'idle';
    secs: number;
} | {
    type: 'wait';
    until: () => boolean;
    timeout: number;
} | {
    type: 'call';
    fn: () => void;
} | {
    type: 'tug';
} | {
    type: 'sleep';
    secs: number;
};
interface Running {
    step: Step;
    t: number;
    from: Vec;
    dur: number;
}
export declare class Dog {
    readonly profile: DogProfile;
    private readonly g;
    readonly id: DogProfile['id'];
    readonly brain: Brain;
    readonly anim: AnimPlayer;
    readonly stats: Stats;
    pos: Vec;
    medium: Medium;
    face: 1 | -1;
    wet: number;
    line: string;
    queue: Step[];
    cur: Running | null;
    pending: Intent | null;
    current: Intent | null;
    private idleFor;
    private nextThink;
    private waterSince;
    private rippleT;
    private dripT;
    private zzzT;
    /** Who asked for the current plan; human asks carry more weight with the other dog. */
    private askedBy;
    /** Set when a thrown ball lands, so she chases it once she's free. */
    wantsBall: boolean;
    constructor(profile: DogProfile, g: Game, start: Vec);
    get name(): string;
    /** 0 = on land, 1 = swimming; in between while jumping in or out. */
    get submerged(): number;
    get busy(): boolean;
    get jumping(): boolean;
    get activity(): Activity;
    get friend(): Dog | null;
    context(): BrainContext;
    snapshot(): Snapshot;
    say(line: string): void;
    feel(e: WorldEvent): void;
    /** Ask her to do something. She may say no. */
    request(intent: Intent, source?: Source): Decision;
    /** Watch a thrown ball until it lands. */
    watchBall(): void;
    /** Someone talked to her in chat: she pauses and listens. */
    hear(): void;
    /** A feeling from chat. */
    sense(emotion: Emotion): void;
    /** Spooked: some dogs bolt to the back of the yard, some run to their people. */
    spook(): void;
    get sleeping(): boolean;
    /** Gently wake her up. */
    wake(): void;
    pet(): void;
    /** The other dog wants to play chase: run off, then play-bow. */
    private beChased;
    /** Pick up the rope and offer the other end to the friend. */
    private inviteTug;
    /** Ask the other dog's brain (it may say no), and let them say so. */
    private brainSaysYes;
    /** The tug match ended. */
    tugOver(won: boolean): void;
    /** The other dog came over to sniff hello. */
    private greetedBy;
    private faceTo;
    private start;
    private compile;
    private tagged;
    private grabBall;
    private eatTreat;
    update(dt: number): void;
    private idleLine;
    private think;
    private finished;
    /** Called by the game when the ball lands. */
    ballLanded(): void;
    private begin;
    private idleAnim;
    /** Move toward `to`; true when she gets there. */
    private stepMove;
    private stepJump;
    /** Keep her somewhere valid after the yard layout changes. */
    relayout(dropPlans?: boolean): void;
    /** Gently push apart when two dogs end up standing on the same spot. */
    nudge(dx: number, dy: number): void;
}
export {};
