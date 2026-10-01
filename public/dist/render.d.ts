import type { Game } from './game.js';
import type { Vec } from './types.js';
export declare class Renderer {
    private readonly canvas;
    private readonly game;
    private readonly sprite;
    private readonly ctx;
    private readonly bg;
    private dpr;
    private particles;
    private ripples;
    private marker;
    /** Screen-space box around Jaylee, for tap-to-pet. */
    dogBox: {
        x: number;
        y: number;
        w: number;
        h: number;
    } | null;
    constructor(canvas: HTMLCanvasElement, game: Game, sprite: HTMLImageElement);
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
    /** How many sheet px of her body are below the waterline right now. */
    private sink;
    private drawDog;
    private ballAt;
    private drawBall;
    private drawTreat;
    private heart;
    private drawFx;
    private drawClouds;
    draw(dt: number): void;
}
