# Jaylee's Playground

A small virtual backyard and pool for Jaylee. She has needs, a personality, and her own ideas about what to do next.

```bash
npm install
npm run build   # compiles src/ (TypeScript) into dist/
npm test        # brain + route tests
npm run serve   # http://localhost:8080
```

`dist/` is committed so the site works as plain static files, for example on GitHub Pages.

## How she works

| Module | Job |
|---|---|
| `src/types.ts` | The typed control surface: `Intent`, `Needs`, `Traits`, `Snapshot`, `WorldEvent` |
| `src/brain.ts` | Needs + personality. Scores every option (utility AI), picks what to do and decides whether to accept requests |
| `src/game.ts` | Her body: turns an intent into steps (run, swim, jump in or out, tricks), plus the ball and treats |
| `src/world.ts` | Yard and pool geometry, route planning around and into the pool |
| `src/sprites.ts` | Sprite-sheet map and animation recipes (kept behind the scenes) |
| `src/render.ts` | Canvas drawing |
| `src/main.ts` | Page UI and the `window.jaylee` API |

**Needs** (0–1): `energy`, `boredom`, `heat`, `curiosity`, `affection`. They change with what she is doing. Running makes her hot and tired. Swimming cools her down. When nobody pays attention, she wants affection.

**Personality** (`JAYLEE` in `brain.ts`): `waterLove 0.95`, `playfulness 0.85`, `curiosity 0.7`, `cuddliness 0.8`, `obedience 0.8`.

**Decisions:** when she is idle and *Let her decide* is on, she scores options such as swim, rest, wander, zoomies, seekAttention, fetch and tricks from her needs and traits. She then picks one, leaning toward the top scores. Player requests go through `brain.consider()`, so she may decline. For example, when she is exhausted she answers "Too pooped… maybe a treat?".

### Control API (browser console now, chat or AI later)

```js
jaylee.request({ kind: 'swim' })             // → { accept, line }
jaylee.chat({ kind: 'trick', trick: 'wave' }) // same, tagged as coming from chat
jaylee.snapshot()                            // position, mood, needs, stats...
jaylee.options()                             // what her brain is weighing right now
jaylee.on(e => console.log(e))               // say / decision / world events
```

Every `Intent` is a typed union, so a future chat personality can be given these as tools and stay type-safe.

## Sprite sheet states

`assets/jaylee-sprites.webp` is 1343×2000 px: a grid of 8 columns × 11 rows with equal cells (≈167.9×181.8 px).
The artwork is drawn straight from the sheet and is never edited.

| Row | State | Frames | What it shows |
|----:|-------|-------:|---------------|
| 1 | Sit & blink | 6 | Idle sit, blinks / winks |
| 2 | Run right | 8 | Gallop cycle facing right |
| 3 | Run left | 8 | Gallop cycle facing left |
| 4 | Wave hi | 4 | Sit → paw up → paw high → sit |
| 5 | Hop | 5 | Crouch, leap, mid-air, land, stand |
| 6 | Sniff | 8 | Head lowers to the ground and comes back up |
| 7 | Curious | 6 | Head tilts and a paw lift |
| 8 | Play beg | 6 | Tongue out, paw swipes |
| 9 | Wink | 6 | Head tilts and a wink |
| 10 | Look right | 8 | Looks up, turns right, looks down |
| 11 | Look left | 8 | Looks down, turns left, looks up (continues from row 10) |

Swimming is built from the run rows: they play at a slower pace, and her body is cut off at the waterline with ripples around her.
Sitting tricks are mirrored when she faces left.
