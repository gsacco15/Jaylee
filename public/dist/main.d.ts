/** Boot: wires the game, renderer, page UI and the public `window.playground` API. */
import { type GameListener, type Mode } from './game.js';
import { type DogId } from './dogs.js';
import type { Option } from './brain.js';
import type { Decision, Intent, Snapshot } from './types.js';
/** Typed control API: from the console now, and for AI layers later. */
export interface PlaygroundAPI {
    /** Ask a dog (default: the selected one) to do something. They may decline. */
    request(intent: Intent, dog?: DogId): Decision;
    snapshot(dog?: DogId): Snapshot;
    /** What a dog's brain would score each option right now. */
    options(dog?: DogId): Option[];
    setMode(mode: Mode): void;
    setAutonomy(on: boolean): void;
    on(fn: GameListener): () => void;
}
declare global {
    interface Window {
        playground: PlaygroundAPI;
        jaylee: PlaygroundAPI;
    }
}
