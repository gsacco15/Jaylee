/** Canvas renderer for the yard, pool, dogs, toys and effects. */
import type { Game } from './game.js';
import type { Dog } from './dog.js';
import type { Vec } from './types.js';
export declare class Renderer {
    private readonly canvas;
    private readonly game;
    private readonly ctx;
    private readonly bg;
    private dpr;
    private particles;
    private ripples;
    private marker;
    /** Screen-space boxes around each dog (draw order), for tapping. */
    private dogBoxes;
    private shakeT;
    /** Where each dog's mouth is on screen this frame (for the rope). */
    private mouths;
    private readonly stars;
    private readonly flies;
    private tags;
    private readonly images;
    constructor(canvas: HTMLCanvasElement, game: Game, preload?: readonly HTMLImageElement[]);
    private get W();
    private get H();
    private get HZ();
    private p;
    private s;
    resize(): void;
    tapMarker(at: Vec): void;
    private consumeFx;
    private splash;
    private hearts;
    private stepFx;
    private paintBackground;
    private poolPath;
    private drawPool;
    private shadow;
    /** Image cache keyed by sheet src, shared by every dog using that art. */
    private image;
    private drawDog;
    private ropeStroke;
    private drawRopeOnLawn;
    private drawRopeHeld;
    private drawNight;
    /** Name tags, drawn after all dogs and nudged apart so they never overlap. */
    private drawTags;
    /** The dog under a screen point, front-most first. */
    dogAt(x: number, y: number): Dog | null;
    private ballAt;
    private drawBall;
    private drawTreat;
    private heart;
    private drawFx;
    private drawClouds;
    draw(dt: number): void;
}
