/**
 * The dogs. Each has their own art, personality and voice.
 * Their chat character cards live server-side in api/chat.ts (same ids).
 */
import { HEGLA_SPRITES, JAYLEE_SPRITES } from './sprites.js';
export const DOG_IDS = ['jaylee', 'hegla'];
export const DOGS = {
    jaylee: {
        id: 'jaylee',
        name: 'Jaylee',
        accent: '#e8638f',
        personality: {
            name: 'Jaylee',
            traits: { waterLove: 0.95, playfulness: 0.85, curiosity: 0.7, cuddliness: 0.8, obedience: 0.8, sociability: 0.85 },
        },
        sprites: JAYLEE_SPRITES,
        lines: {
            pet: ['I love that!', 'Belly rubs please', 'Who’s a good girl? Me!'],
            gotBall: ['Got it! Again! Again!', 'Mine mine mine!'],
            hello: 'Hi! I’m Jaylee',
        },
    },
    hegla: {
        id: 'hegla',
        name: 'Hegla',
        accent: '#a8641a',
        // Placeholder personality until Hegla's character card arrives.
        personality: {
            name: 'Hegla',
            traits: { waterLove: 0.45, playfulness: 0.95, curiosity: 0.85, cuddliness: 0.6, obedience: 0.6, sociability: 0.9 },
        },
        sprites: HEGLA_SPRITES,
        lines: {
            pet: ['More scratches!', 'Best human ever', 'Right there, yes!'],
            gotBall: ['Ha! Got it first!', 'Ball secured!'],
            hello: 'Hey! Hegla here',
        },
    },
};
