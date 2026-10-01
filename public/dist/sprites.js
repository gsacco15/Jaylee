/**
 * Sprite sheet map. Artwork is drawn straight from the sheets, never edited.
 * - main: assets/jaylee-sprites.webp, 1343×2000 px, 8 × 11 cells
 * - swim: assets/jaylee-swim.webp, 2000×460 px, 8 × 2 cells (paddling, → and ←)
 */
export const SHEETS = {
    main: { src: 'assets/jaylee-sprites.webp', cellW: 1343 / 8, cellH: 2000 / 11 },
    swim: { src: 'assets/jaylee-swim.webp', cellW: 250, cellH: 230 },
};
/** Main-sheet px height of her sitting pose, used to size her on screen. */
export const SIT_H = 170;
const main = (row, frames, feet, directional = false, mouth = [34, 112]) => ({ sheet: 'main', row, frames, feet, directional, scale: 1, sink: 46, mouth });
export const ROWS = {
    sit: main(0, 6, 176), // idle sit, blinks
    runR: main(1, 8, 330, true, [34, 72]), // gallop →
    runL: main(2, 8, 512, true, [34, 72]), // gallop ←
    wave: main(3, 4, 722), // paw up hello
    hop: main(4, 5, 904), // crouch, leap, land, stand
    sniff: main(5, 8, 1085), // nose to ground and back
    curious: main(6, 6, 1268), // head tilt, paw lift
    beg: main(7, 6, 1450), // tongue out, paw swipes
    wink: main(8, 6, 1631), // tilt and wink
    lookR: main(9, 8, 1812), // up → right → down
    lookL: main(10, 8, 1994), // down → left → up
    // Paddling, from the swim sheet
    swimR: { sheet: 'swim', row: 0, frames: 8, feet: 180, directional: true, scale: 0.66, sink: 62, mouth: [100, 85] },
    swimL: { sheet: 'swim', row: 1, frames: 8, feet: 410, directional: true, scale: 0.66, sink: 62, mouth: [100, 85] },
};
export const JAYLEE_SPRITES = { sheets: SHEETS, rows: ROWS };
const seq = (key, cols, dur) => cols.map((col, i) => ({ key, col, dur: typeof dur === 'number' ? dur : dur[i] ?? 0.15 }));
const run8 = [0, 1, 2, 3, 4, 5, 6, 7];
/** Animation recipes. Functions so idle holds can vary each time. */
export const ANIMS = {
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
    // Nose down to the treat, munch, look up happy.
    eat: () => [...seq('sniff', [0, 1, 2, 3, 4, 3, 4, 3, 4], [0.15, 0.12, 0.12, 0.15, 0.2, 0.18, 0.2, 0.18, 0.25]), ...seq('beg', [0, 2], 0.4)],
};
export class AnimPlayer {
    frames = [];
    name = null;
    loop = false;
    done = true;
    i = 0;
    t = 0;
    play(name, loop = false) {
        this.frames = ANIMS[name]();
        this.name = name;
        this.loop = loop;
        this.done = false;
        this.i = 0;
        this.t = 0;
    }
    /** Play unless this looping animation is already running. */
    ensure(name, loop = true) {
        if (this.name !== name || this.done)
            this.play(name, loop);
    }
    get duration() {
        return this.frames.reduce((a, f) => a + f.dur, 0);
    }
    tick(dt) {
        if (this.done)
            return;
        this.t += dt;
        let f = this.frames[this.i];
        while (f && this.t >= f.dur) {
            this.t -= f.dur;
            if (this.i + 1 >= this.frames.length) {
                if (this.loop)
                    this.i = 0;
                else {
                    this.done = true;
                    return;
                }
            }
            else
                this.i++;
            f = this.frames[this.i];
        }
    }
    get frame() {
        return this.frames[Math.min(this.i, this.frames.length - 1)] ?? { key: 'sit', col: 0, dur: 1 };
    }
}
