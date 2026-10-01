/**
 * Sprite sheet map — assets/jaylee-sprites.webp, 1343×2000 px,
 * 8 columns × 11 rows of equal cells. Artwork is drawn untouched.
 */

export const SHEET_W = 1343;
export const SHEET_H = 2000;
export const CELL_W = SHEET_W / 8;
export const CELL_H = SHEET_H / 11;
/** Sheet-px height of her sitting pose, used to size her on screen. */
export const SIT_H = 170;

export type RowKey =
  | 'sit' | 'runR' | 'runL' | 'wave' | 'hop' | 'sniff'
  | 'curious' | 'beg' | 'wink' | 'lookR' | 'lookL';

interface RowInfo {
  /** Row index in the sheet. */
  readonly row: number;
  readonly frames: number;
  /** Sheet y of the lowest paw in this row (plants her feet on the ground). */
  readonly feet: number;
  /** Rows already drawn facing a direction must not be mirrored. */
  readonly directional: boolean;
}

export const ROWS: Readonly<Record<RowKey, RowInfo>> = {
  sit:     { row: 0,  frames: 6, feet: 176,  directional: false }, // idle sit, blinks
  runR:    { row: 1,  frames: 8, feet: 330,  directional: true },  // gallop →
  runL:    { row: 2,  frames: 8, feet: 512,  directional: true },  // gallop ←
  wave:    { row: 3,  frames: 4, feet: 722,  directional: false }, // paw up hello
  hop:     { row: 4,  frames: 5, feet: 904,  directional: false }, // crouch, leap, land, stand
  sniff:   { row: 5,  frames: 8, feet: 1085, directional: false }, // nose to ground and back
  curious: { row: 6,  frames: 6, feet: 1268, directional: false }, // head tilt, paw lift
  beg:     { row: 7,  frames: 6, feet: 1450, directional: false }, // tongue out, paw swipes
  wink:    { row: 8,  frames: 6, feet: 1631, directional: false }, // tilt and wink
  lookR:   { row: 9,  frames: 8, feet: 1812, directional: false }, // up → right → down
  lookL:   { row: 10, frames: 8, feet: 1994, directional: false }, // down → left → up
};

export interface Frame {
  readonly key: RowKey;
  readonly col: number;
  /** Seconds to hold this frame. */
  readonly dur: number;
}

export type AnimName =
  | 'idle' | 'runR' | 'runL' | 'swimR' | 'swimL' | 'treadR' | 'treadL'
  | 'wave' | 'hop' | 'sniff' | 'curious' | 'beg' | 'wink' | 'look' | 'shake' | 'eat';

const seq = (key: RowKey, cols: readonly number[], dur: number | readonly number[]): Frame[] =>
  cols.map((col, i) => ({ key, col, dur: typeof dur === 'number' ? dur : dur[i] ?? 0.15 }));

const run8 = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** Animation recipes. Functions so idle holds can vary each time. */
export const ANIMS: Readonly<Record<AnimName, () => Frame[]>> = {
  idle: () => [{ key: 'sit', col: 0, dur: 1.4 + Math.random() * 2.2 }, ...seq('sit', [1, 2, 3, 4, 5], 0.16)],
  runR: () => seq('runR', run8, 1 / 13),
  runL: () => seq('runL', run8, 1 / 13),
  swimR: () => seq('runR', run8, 1 / 7),
  swimL: () => seq('runL', run8, 1 / 7),
  treadR: () => seq('runR', [1, 2, 3, 2], 0.22),
  treadL: () => seq('runL', [1, 2, 3, 2], 0.22),
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
