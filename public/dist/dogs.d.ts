/**
 * The dogs. Each has their own art, personality and voice.
 * Their chat character cards live server-side in api/chat.ts (same ids).
 */
import { type SpriteSet } from './sprites.js';
import type { Personality } from './types.js';
export type DogId = 'jaylee' | 'helga';
export declare const DOG_IDS: readonly DogId[];
export interface DogProfile {
    readonly id: DogId;
    readonly name: string;
    /** UI accent colour (selection ring, chat bubbles). */
    readonly accent: string;
    readonly personality: Personality;
    readonly sprites: SpriteSet;
    /** Canvas filter, used while a dog borrows another dog's art. */
    readonly filter?: string;
    /** Size relative to the art. */
    readonly scale?: number;
    /** True until this dog has art of their own. */
    readonly standIn?: boolean;
    /** Their person. */
    readonly owner: string;
    /** What they do when spooked: run off and hide, or run to their people. */
    readonly whenScared: 'flee' | 'comfort';
    readonly lines: {
        readonly pet: readonly string[];
        readonly gotBall: readonly string[];
        readonly hello: string;
        readonly noPlay: readonly string[];
        readonly scared: readonly string[];
    };
}
export declare const DOGS: Readonly<Record<DogId, DogProfile>>;
