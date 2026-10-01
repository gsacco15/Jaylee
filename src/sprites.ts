/**
 * Sprite sheet map. Artwork is drawn straight from the sheets, never edited.
 * - main: assets/jaylee-sprites.webp, 1343×2000 px, 8 × 11 cells
 * - swim: assets/jaylee-swim.webp, 2000×460 px, 8 × 2 cells (paddling, → and ←)
 */

export type SheetId = 'main' | 'swim';

export interface SheetInfo { readonly src: string; readonly cellW: number; readonly cellH: number }

export const SHEETS: Readonly<Record<SheetId, SheetInfo>> = {
  main: { src: '/assets/jaylee-sprites.webp', cellW: 1343 / 8, cellH: 2000 / 11 },
  swim: { src: '/assets/jaylee-swim.webp', cellW: 250, cellH: 230 },
};

/** Main-sheet px height of her sitting pose, used to size her on screen. */
export const SIT_H = 170;

export type RowKey =
  | 'sit' | 'runR' | 'runL' | 'wave' | 'hop' | 'sniff'
  | 'curious' | 'beg' | 'wink' | 'lookR' | 'lookL'
  | 'swimR' | 'swimL';

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

const main = (row: number, frames: number, feet: number, directional = false, mouth: readonly [number, number] = [34, 112]): RowInfo =>
  ({ sheet: 'main', row, frames, feet, directional, scale: 1, sink: 46, mouth });

export const ROWS: Readonly<Record<RowKey, RowInfo>> = {
  sit:     main(0, 6, 176),               // idle sit, blinks
  runR:    main(1, 8, 330, true, [34, 72]), // gallop →
  runL:    main(2, 8, 512, true, [34, 72]), // gallop ←
  wave:    main(3, 4, 722),               // paw up hello
  hop:     main(4, 5, 904, false, [44, 92]),               // crouch, leap, land, stand
  sniff:   main(5, 8, 1085),              // nose to ground and back
  curious: main(6, 6, 1268),              // head tilt, paw lift
  beg:     main(7, 6, 1450),              // tongue out, paw swipes
  wink:    main(8, 6, 1631),              // tilt and wink
  lookR:   main(9, 8, 1812),              // up → right → down
  lookL:   main(10, 8, 1994),             // down → left → up
  // Paddling, from the swim sheet
  swimR:   { sheet: 'swim', row: 0, frames: 8, feet: 180, directional: true, scale: 0.66, sink: 62, mouth: [100, 85] },
  swimL:   { sheet: 'swim', row: 1, frames: 8, feet: 410, directional: true, scale: 0.66, sink: 62, mouth: [100, 85] },
};

/** A dog's full set of art. Every dog must provide every row, so animations work for all. */
export interface SpriteSet {
  readonly sheets: Readonly<Record<SheetId, SheetInfo>>;
  readonly rows: Readonly<Record<RowKey, RowInfo>>;
}

export const JAYLEE_SPRITES: SpriteSet = { sheets: SHEETS, rows: ROWS };

/**
 * Helga: assets/helga-sprites.webp, same 8 × 11 layout as Jaylee's main sheet.
 * No swim sheet yet, so in the pool Helga paddles with the run rows (cut at the waterline).
 */
const helgaMain: SheetInfo = { src: '/assets/helga-sprites.webp', cellW: 1343 / 8, cellH: 2000 / 11 };
const helga = (row: number, frames: number, feet: number, directional = false, mouth: readonly [number, number] = [28, 96]): RowInfo =>
  ({ sheet: 'main', row, frames, feet, directional, scale: 1, sink: 46, mouth });

export const HELGA_SPRITES: SpriteSet = {
  sheets: { main: helgaMain, swim: helgaMain },
  rows: {
    sit:     helga(0, 6, 173),
    runR:    helga(1, 8, 354, true, [42, 66]),
    runL:    helga(2, 8, 536, true, [42, 66]),
    wave:    helga(3, 4, 718),
    hop:     helga(4, 5, 904, false, [38, 78]),
    sniff:   helga(5, 8, 1081),
    curious: helga(6, 6, 1263),
    beg:     helga(7, 6, 1445),
    wink:    helga(8, 6, 1627),
    lookR:   helga(9, 8, 1810),
    lookL:   helga(10, 8, 1992),
    swimR:   { ...helga(1, 8, 354, true, [42, 66]), sink: 50 },
    swimL:   { ...helga(2, 8, 536, true, [42, 66]), sink: 50 },
  },
};

export interface Frame {
  readonly key: RowKey;
  readonly col: number;
  /** Seconds to hold this frame. */
  readonly dur: number;
}

export type AnimName =
  | 'idle' | 'runR' | 'runL' | 'swimR' | 'swimL' | 'treadR' | 'treadL'
  | 'wave' | 'hop' | 'sniff' | 'curious' | 'beg' | 'wink' | 'look' | 'shake' | 'eat'
  | 'tug' | 'sleep';

const seq = (key: RowKey, cols: readonly number[], dur: number | readonly number[]): Frame[] =>
  cols.map((col, i) => ({ key, col, dur: typeof dur === 'number' ? dur : dur[i] ?? 0.15 }));

const run8 = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** Animation recipes. Functions so idle holds can vary each time. */
export const ANIMS: Readonly<Record<AnimName, () => Frame[]>> = {
  idle: () => [{ key: 'sit', col: 0, dur: 1.4 + Math.random() * 2.2 }, ...seq('sit', [1, 2, 3, 4, 5], 0.16)],
  runR: () => seq('runR', run8, 1 / 13),
  runL: () => seq('runL', run8, 1 / 13),
  swimR: () => seq('swimR', run8, 1 / 9),
  swimL: () => seq('swimL', run8, 1 / 9),
  treadR: () => seq('swimR', run8, 1 / 5),
  treadL: () => seq('swimL', run8, 1 / 5),
  wave: () => seq('wave', [0, 1, 2, 2, 1, 2, 2, 1, 3], [0.2, 0.18, 0.3, 0.2, 0.16, 0.3, 0.3, 0.18, 0.4]),
  hop: () => seq('hop', [0, 1, 2, 3, 4], [0.18, 0.12, 0.18, 0.12, 0.3]),
  sniff: () => seq('sniff', [0, 1, 2, 3, 4, 4, 3, 4, 4, 5, 6, 7], [0.2, 0.14, 0.14, 0.14, 0.4, 0.2, 0.2, 0.2, 0.4, 0.14, 0.14, 0.4]),
  curious: () => seq('curious', [0, 1, 2, 3, 4, 5], [0.3, 0.4, 0.5, 0.3, 0.5, 0.5]),
  beg: () => seq('beg', [0, 1, 2, 3, 4, 5], [0.25, 0.3, 0.25, 0.3, 0.35, 0.4]),
  wink: () => seq('wink', [0, 1, 2, 3, 3, 4, 5], [0.3, 0.3, 0.3, 0.25, 0.25, 0.4, 0.4]),
  look: () => [
    ...seq('lookR', run8, [0.4, 0.14, 0.14, 0.3, 0.14, 0.14, 0.14, 0.5]),
    ...seq('lookL', run8, [0.14, 0.14, 0.14, 0.4, 0.14, 0.14, 0.14, 0.5]),
  ],
  shake: () => seq('lookR', [3, 4, 3, 4, 3], 0.09),
  // Crouched low, pulling: the hop row's crouch frame, held.
  tug: () => seq('hop', [0], 0.5),
  // No sleeping frames: head down (sniff) held, with Zzz drawn on top.
  sleep: () => seq('sniff', [4], 2),
  // Nose down to the treat, munch, look up happy.
  eat: () => [...seq('sniff', [0, 1, 2, 3, 4, 3, 4, 3, 4], [0.15, 0.12, 0.12, 0.15, 0.2, 0.18, 0.2, 0.18, 0.25]), ...seq('beg', [0, 2], 0.4)],
};

export class AnimPlayer {
  frames: Frame[] = [];
  name: AnimName | null = null;
  loop = false;
  done = true;
  private i = 0;
  private t = 0;

  play(name: AnimName, loop = false): void {
    this.frames = ANIMS[name]();
    this.name = name;
    this.loop = loop;
    this.done = false;
    this.i = 0;
    this.t = 0;
  }

  /** Play unless this looping animation is already running. */
  ensure(name: AnimName, loop = true): void {
    if (this.name !== name || this.done) this.play(name, loop);
  }

  get duration(): number {
    return this.frames.reduce((a, f) => a + f.dur, 0);
  }

  tick(dt: number): void {
    if (this.done) return;
    this.t += dt;
    let f = this.frames[this.i];
    while (f && this.t >= f.dur) {
      this.t -= f.dur;
      if (this.i + 1 >= this.frames.length) {
        if (this.loop) this.i = 0;
        else { this.done = true; return; }
      } else this.i++;
      f = this.frames[this.i];
    }
  }

  get frame(): Frame {
    return this.frames[Math.min(this.i, this.frames.length - 1)] ?? { key: 'sit', col: 0, dur: 1 };
  }
}
