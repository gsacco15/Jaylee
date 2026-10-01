/**
 * Sprite sheet map. Artwork is drawn straight from the sheets, never edited.
 * - main: assets/jaylee-sprites.webp, 1343×2000 px, 8 × 11 cells
 * - swim: assets/jaylee-swim.webp, 2000×460 px, 8 × 2 cells (paddling, → and ←)
 */
export type SheetId = 'main' | 'swim';
export interface SheetInfo {
    readonly src: string;
    readonly cellW: number;
    readonly cellH: number;
}
export declare const SHEETS: Readonly<Record<SheetId, SheetInfo>>;
/** Main-sheet px height of her sitting pose, used to size her on screen. */
export declare const SIT_H = 170;
export type RowKey = 'sit' | 'runR' | 'runL' | 'wave' | 'hop' | 'sniff' | 'curious' | 'beg' | 'wink' | 'lookR' | 'lookL' | 'swimR' | 'swimL';
export interface RowInfo {
    readonly sheet: SheetId;
    /** Row index in its sheet. */
    readonly row: number;
    readonly frames: number;
    /** Sheet y of the lowest paw in this row (plants her feet on the ground). */
    readonly feet: number;
    /** Rows already drawn facing a direction must not be mirrored. */
    readonly directional: boolean;
    /** Draw scale relative to the main sheet, so she stays the same size. */
    readonly scale: number;
    /** Sheet px of her body below the waterline when she's in the pool. */
    readonly sink: number;
    /** Muzzle position (sheet px from paws-centre, facing right), for carrying the ball. */
    readonly mouth: readonly [number, number];
}
export declare const ROWS: Readonly<Record<RowKey, RowInfo>>;
/** A dog's full set of art. Every dog must provide every row, so animations work for all. */
export interface SpriteSet {
    readonly sheets: Readonly<Record<SheetId, SheetInfo>>;
    readonly rows: Readonly<Record<RowKey, RowInfo>>;
}
export declare const JAYLEE_SPRITES: SpriteSet;
export declare const HELGA_SPRITES: SpriteSet;
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
