/**
 * Sprite sheet map — assets/jaylee-sprites.webp, 1343×2000 px,
 * 8 columns × 11 rows of equal cells. Artwork is drawn untouched.
 */
export declare const SHEET_W = 1343;
export declare const SHEET_H = 2000;
export declare const CELL_W: number;
export declare const CELL_H: number;
/** Sheet-px height of her sitting pose, used to size her on screen. */
export declare const SIT_H = 170;
export type RowKey = 'sit' | 'runR' | 'runL' | 'wave' | 'hop' | 'sniff' | 'curious' | 'beg' | 'wink' | 'lookR' | 'lookL';
interface RowInfo {
    /** Row index in the sheet. */
    readonly row: number;
    readonly frames: number;
    /** Sheet y of the lowest paw in this row (plants her feet on the ground). */
    readonly feet: number;
    /** Rows already drawn facing a direction must not be mirrored. */
    readonly directional: boolean;
}
export declare const ROWS: Readonly<Record<RowKey, RowInfo>>;
export interface Frame {
    readonly key: RowKey;
    readonly col: number;
    /** Seconds to hold this frame. */
    readonly dur: number;
}
export type AnimName = 'idle' | 'runR' | 'runL' | 'swimR' | 'swimL' | 'treadR' | 'treadL' | 'wave' | 'hop' | 'sniff' | 'curious' | 'beg' | 'wink' | 'look' | 'shake' | 'eat';
/** Animation recipes. Functions so idle holds can vary each time. */
export declare const ANIMS: Readonly<Record<AnimName, () => Frame[]>>;
export declare class AnimPlayer {
    frames: Frame[];
    name: AnimName | null;
    loop: boolean;
    done: boolean;
    private i;
    private t;
    play(name: AnimName, loop?: boolean): void;
    /** Play unless this looping animation is already running. */
    ensure(name: AnimName, loop?: boolean): void;
    get duration(): number;
    tick(dt: number): void;
    get frame(): Frame;
}
export {};
