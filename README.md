# Jaylee's Playground

A small virtual backyard and pool for Jaylee, animated from her sprite sheet.
Open `index.html` through any static server (for example `python3 -m http.server`).

- Tap the lawn and she runs there. She goes around the pool, not through it.
- Tap the pool and she jumps in and swims. Tap the lawn again and she climbs out and shakes off.
- Tap Jaylee to pet her. You can also throw her ball, which can land in the pool.
- With **Free roam** on, she wanders, sniffs, does tricks and goes for swims by herself.

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
