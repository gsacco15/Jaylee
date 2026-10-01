/**
 * The dogs. Each has their own art, personality and voice.
 * Their chat character cards live server-side in api/chat.ts (same ids).
 */
import { HELGA_SPRITES, JAYLEE_SPRITES, type SpriteSet } from './sprites.js';
import type { Personality } from './types.js';

export type DogId = 'jaylee' | 'helga';
export const DOG_IDS: readonly DogId[] = ['jaylee', 'helga'];

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
  /** Pulling power in tug-of-war, 0..1. */
  readonly strength: number;
  /** What they do when spooked: run off and hide, or run to their people. */
  readonly whenScared: 'flee' | 'comfort';
  readonly lines: {
    readonly pet: readonly string[];
    readonly gotBall: readonly string[];
    readonly hello: string;
    readonly noPlay: readonly string[];
    readonly scared: readonly string[];
    readonly tugWin: readonly string[];
    readonly tugLose: readonly string[];
  };
}

export const DOGS: Readonly<Record<DogId, DogProfile>> = {
  jaylee: {
    id: 'jaylee',
    name: 'Jaylee',
    accent: '#e8638f',
    // From Jaylee's character card: loves people, toys, tug and swimming;
    // a strong, cuddly big baby who isn't a fan of other dogs.
    personality: {
      name: 'Jaylee',
      traits: { waterLove: 0.95, playfulness: 0.85, curiosity: 0.55, cuddliness: 0.95, obedience: 0.6, sociability: 0.3 },
    },
    sprites: JAYLEE_SPRITES,
    owner: 'Gabby',
    strength: 1, // doesn't know her own strength
    whenScared: 'comfort',
    lines: {
      pet: ['I love that!', 'Belly rubs please', 'More! Don’t stop!', 'Cuddle me like warm laundry'],
      gotBall: ['MINE. Mine mine mine!', 'Got it! Tug? TUG?!'],
      hello: 'Hi! I’m Jaylee',
      noPlay: ['Ugh, other dogs…', 'Not now, Helga', 'Find your own toy'],
      scared: ['Eep! Save me!', 'What was THAT?!', 'Hold me…'],
      tugWin: ['Oops… did I do that?', 'MINE! *proud wiggle*', 'Too strong? Didn’t notice!'],
      tugLose: ['Hey! Again! AGAIN!', 'Rematch!!'],
    },
  },
  helga: {
    id: 'helga',
    name: 'Helga',
    accent: '#a8641a',
    // From Helga's character card: sweet, playful, very expressive; spooks
    // easily, adores Shannah and listens well; cautious with strangers.
    personality: {
      name: 'Helga',
      traits: { waterLove: 0.5, playfulness: 0.85, curiosity: 0.5, cuddliness: 0.8, obedience: 0.9, sociability: 0.7 },
    },
    sprites: HELGA_SPRITES,
    owner: 'Shannah',
    strength: 0.45,
    whenScared: 'flee',
    lines: {
      pet: ['Ooh, hi! Scritches!', 'Hehe, that tickles', 'I like you'],
      gotBall: ['I got it! I got it!', 'Look, look, I got it!'],
      hello: 'Hi… I’m Helga',
      noPlay: ['Maybe later…', 'Too much right now'],
      scared: ['!!!', 'Nope nope nope', 'Eek!'],
      tugWin: ['I won?! I WON!', 'Look! I got it!'],
      tugLose: ['Whoa! *wide eyes*', 'You’re so strong…'],
    },
  },
};
