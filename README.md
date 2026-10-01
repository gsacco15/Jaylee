# Jaylee's Playground

A small virtual backyard and pool for Jaylee and Helga. Each dog has needs, a personality, and their own ideas about what to do next. You can have one dog in the yard or both, chat with them, and watch them play together.

```bash
npm install
npm test        # builds, typechecks, runs brain/route/API tests
npm run serve   # static site only, at http://localhost:8080 (chat needs `npm run dev`)
npm run dev     # full site + /api/chat locally via the Vercel CLI
```

## Deploy to Vercel

1. Import this GitHub repo in Vercel (framework preset: **Other**). `vercel.json` already sets the build command (`npm run build`) and the output folder (`public`).
2. Add the environment variable `ANTHROPIC_API_KEY` (Project → Settings → Environment Variables).
3. Optional: set `JAYLEE_MODEL` to `claude-sonnet-5-5` to make chat cheaper (default `claude-opus-5-5`). Older models such as Haiku don't accept every option the request sends.

Without the key, the playground still works fully. Only the chat answers "not set up yet".

## Project layout

| Path | What it is |
|---|---|
| `public/` | The static site: `index.html`, `style.css`, `assets/` (sprite sheet), `dist/` (compiled TypeScript) |
| `api/chat.ts` | Vercel function: Claude plays Jaylee and picks actions through tools |
| `src/chat.ts` | Chat panel; validates the actions that come back and queues them for the game |

## Pages, share previews and home screen

| Link | Opens | Share preview | Home-screen app |
|---|---|---|---|
| `/` | Both dogs (remembers your last choice) | `brand/og-both.png` | "Jaylee & Helga" |
| `/jaylee` | Just Jaylee | `brand/og-jaylee.png` | "Jaylee" |
| `/helga` | Just Helga | `brand/og-helga.png` | "Helga" |

- The pages are generated from `src/page.html` by `scripts/pages.mjs` during `npm run build`. Edit the template, not `public/*.html`.
- On Vercel, preview images get absolute URLs from the production domain automatically. Elsewhere, set `SITE_URL`.
- **iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**. Each link installs as its own app, with its own icon and name.
- `npm run brand` re-creates the preview cards and icons from the real app (needs Playwright).

## Day & night, rope toy

- **Day & night** follow your local time, with a sunset glow, then stars, a moon, fireflies and pool lights. The toggle in the yard cycles Auto / Day / Night. At night the dogs get sleepy and take naps with "Zzz".
- **Tug-of-war:** a rope toy lives on the lawn. **Tug rope** makes the selected dog play tug with you. **Tug-of-war** (both dogs) has them tug each other. Strength decides who usually wins: Jaylee is strong and doesn't know it, so she usually yanks it away (with a little screen shake).

## Dogs

The switcher in the header picks **Jaylee**, **Helga** or **Both** (remembered in the browser). In Both mode:
- Tap a dog to pet them and select them. The buttons and meters follow the selected dog.
- The dogs play on their own: chase (play bow, one runs off, the other chases them around the pool), sniff greetings, swimming together, and racing for the ball (the loser may chase the winner).
- A `social` need ("wants to play with friend") only builds while the other dog is in the yard, and each dog's `sociability` trait scales it.
- The chat becomes a group chat: Claude voices each dog from their own character card, and every tool call says which dog acts.

### Personalities (from their character cards)

- **Jaylee** (Gabby's dog): an affectionate pit bull who loves people, toys, tug and swimming. A strong, cuddly big baby who doesn't know her own strength, is scared of thunder and weird things, loves warm laundry, and isn't a fan of other dogs (low `sociability`, so she often turns Helga down).
- **Helga** (Shannah's dog): sweet, playful and very expressive. Spooks easily, adores Shannah and listens well (high `obedience`), and is cautious with strangers.

The **"I'm …" picker** in the chat (Gabby, Shannah, or a guest) tells the dogs who is talking. A dog's own person makes them run over happy. A guest spooks Helga, who bolts to the back of the yard. The `scared` feeling works per dog: Helga runs off and hides, while Jaylee runs to her people for comfort.

### Adding a dog's art and character

- **Profile** (`src/dogs.ts`): name, accent colour, personality traits, sprite set, and a few short lines.
- **Character card** (`CARDS` in `api/chat.ts`): pronouns, looks, personality, loves, dislikes, quirks, voice, and how they are with the other dog.
- **Sprites** (`src/sprites.ts`): a `SpriteSet` must provide every row (`sit`, `runR`, `runL`, `wave`, `hop`, `sniff`, `curious`, `beg`, `wink`, `lookR`, `lookL`, `swimR`, `swimL`). Give the new sheets and rows their own set and point the dog's profile at it.

Helga's art is `public/assets/helga-sprites.webp` (same 8 × 11 layout as Jaylee's main sheet, 73 frames). There's no Helga swim sheet yet, so in the pool Helga paddles with the run rows, cut at the waterline. Add a swim sheet later and point `swimR`/`swimL` in `HELGA_SPRITES` at it. Helga's character card and personality numbers are still placeholders.

## How she works

| Module | Job |
|---|---|
| `src/types.ts` | The typed control surface: `Intent`, `Needs`, `Traits`, `Snapshot`, `WorldEvent` |
| `src/brain.ts` | Needs + personality. Scores every option (utility AI), picks what to do and decides whether to accept requests |
| `src/dog.ts` | One dog's body: turns an intent into steps (run, swim, jump in or out, tricks, chase) |
| `src/game.ts` | The shared world: the dogs in the yard, the mode, the ball, treats and effects |
| `src/dogs.ts` | Dog profiles (name, colour, traits, sprite set) |
| `src/world.ts` | Yard and pool geometry, route planning around and into the pool |
| `src/sprites.ts` | Sprite-sheet map (main + swim sheets) and animation recipes (kept behind the scenes) |
| `src/render.ts` | Canvas drawing |
| `src/main.ts` | Page UI and the `window.jaylee` API |

**Needs** (0–1): `energy`, `boredom`, `heat`, `curiosity`, `affection`. They change with what she is doing. Running makes her hot and tired. Swimming cools her down. When nobody pays attention, she wants affection.

**Personality** (`JAYLEE` in `brain.ts`): `waterLove 0.95`, `playfulness 0.85`, `curiosity 0.7`, `cuddliness 0.8`, `obedience 0.8`.

**Decisions:** when she is idle and *Let her decide* is on, she scores options such as swim, rest, wander, zoomies, seekAttention, fetch and tricks from her needs and traits. She then picks one, leaning toward the top scores. Player requests go through `brain.consider()`, so she may decline. For example, when she is exhausted she answers "Too pooped… maybe a treat?".

### Control API (browser console now, chat or AI later)

```js
playground.request({ kind: 'swim' }, 'helga')  // → { accept, line } (default dog: the selected one)
playground.request({ kind: 'playWith' })       // play chase with the other dog
playground.snapshot('jaylee')                  // position, mood, needs, traits, friend...
playground.options()                           // what the selected dog's brain is weighing
playground.setMode('both')                     // 'jaylee' | 'helga' | 'both'
playground.on(e => console.log(e))             // say / decision / world events (each tagged with its dog)
```

Every `Intent` is a typed union. The chat maps Claude's tool calls onto these intents, so whatever she says, she can only do things the game understands, and her brain can still say no.

### Chat

`POST /api/chat` takes `{ messages: [{ role, text }], dogs: [{ id, state: Snapshot }] }` and returns `{ replies, actions, feelings, habits }`, each entry tagged with its `dog`.
- The persona prompt lives in `api/chat.ts`. Her live state (mood, needs, whether she is in the pool, where the ball is) is sent as a system message, so her words match how she feels.
- She has 8 action tools (swim, leave the pool, fetch, tricks, zoomies, wander, rest, come to her human), with at most 2 actions per reply.
- Chatting changes her behavior, not just her next action:
  - **Being talked to** counts as attention: she stops, tilts her head, and listens.
  - **Feelings** (`feel` tool: loved, excited, calm, curious, sad, hot) shift her needs. For example, "it's so hot" makes her want the pool, and "good girl" fills her need for affection. Her own later decisions follow.
  - **Habits** (`change_habit` tool, e.g. "swim less", "be calmer") permanently adjust her personality traits. They are saved per dog in the browser (`localStorage`, key `dog:<id>:traits`).
  - The chat shows a short note whenever her feelings or habits change.
- Abuse guards: the last 20 messages are kept, each message is limited to 500 characters, and the reply size is capped. There is no login or rate limit, so watch usage on your Anthropic account.

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

### Swim sheet

`public/assets/jaylee-swim.webp` is 2000×460 px: 8 columns × 2 rows of 250×230 cells (row 1 paddles right, row 2 paddles left). It was cut out of the supplied black-background image (black that touches the edges was made transparent and the edge fringe cleaned up), and the frames were not otherwise changed.

When she swims, her head and back are drawn above the waterline. Her paddling legs show faintly through the water, and ripples spread around her.
Sitting tricks are mirrored when she faces left.
