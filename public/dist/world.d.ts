/**
 * Yard geometry: a 2.5D ground plane (x 0..1 left→right, y 0..1 far→near)
 * with a rectangular pool. Pure math, no DOM — easy to test.
 */
import type { Medium, Vec } from './types.js';
export interface Rect {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
}
export declare const clamp: (v: number, a: number, b: number) => number;
export declare const dist: (a: Vec, b: Vec) => number;
export declare const rand: (a: number, b: number) => number;
/** Gap she keeps from the pool edge while on land. */
export declare const DECK = 0.05;
/** A single movement step in a route. */
export type Leg = {
    type: 'move';
    to: Vec;
} | {
    type: 'jump';
    to: Vec;
    into: Medium;
};
export declare class Yard {
    bounds: Rect;
    pool: Rect;
    /** Landscape screens put the pool to the right, portrait at the front. */
    layout(portrait: boolean): void;
    inPool(p: Vec, margin?: number): boolean;
    clampToPool(p: Vec, inset?: number): Vec;
    clampToBounds(p: Vec): Vec;
    randomLand(near?: Vec, spread?: number): Vec;
    randomWater(): Vec;
    /** Nearest pool-edge crossing: O on the deck, I in the water. */
    edgeCrossing(p: Vec): {
        O: Vec;
        I: Vec;
    };
    private segHitsPool;
    /** Waypoints across the lawn that walk around the pool rather than through it. */
    landPath(a: Vec, b: Vec): Vec[];
    /** Full route from where she is to a target, including jumping in/out of the pool. */
    route(from: Vec, medium: Medium, target: Vec): Leg[];
}
/** Screen projection for the yard. */
export declare class Camera {
    W: number;
    H: number;
    HZ: number;
    resize(w: number, h: number): void;
    private k;
    project(p: Vec): Vec;
    unproject(sx: number, sy: number): Vec;
    /** Sprite scale (screen px per sheet px) at ground depth y. */
    scaleAt(y: number): number;
}
