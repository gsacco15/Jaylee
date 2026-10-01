/** Boot: wires the game, renderer, page UI and the public `window.jaylee` API. */
import { type GameListener } from './game.js';
import type { Option } from './brain.js';
import type { Decision, Intent, Snapshot } from './types.js';
/** Typed control API, handy from the console now and for a chat/AI layer later. */
export interface JayleeAPI {
    /** Ask her to do something. She may decline. */
    request(intent: Intent): Decision;
    /** Same as request, tagged as coming from a chat / AI model. */
    chat(intent: Intent): Decision;
    snapshot(): Snapshot;
    /** What her brain would score each option right now. */
    options(): Option[];
    setAutonomy(on: boolean): void;
    on(fn: GameListener): () => void;
}
declare global {
    interface Window {
        jaylee: JayleeAPI;
    }
}
