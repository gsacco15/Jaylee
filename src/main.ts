/** Boot: wires the game, renderer, page UI and the public `window.playground` API. */
import { Game, type GameListener, type Mode } from './game.js';
import { Renderer } from './render.js';
import { Chat } from './chat.js';
import { DOGS, DOG_IDS, type DogId } from './dogs.js';
import type { Option } from './brain.js';
import type { Dog } from './dog.js';
import type { Decision, Intent, Snapshot, Trick } from './types.js';

/** Typed control API: from the console now, and for AI layers later. */
export interface PlaygroundAPI {
  /** Ask a dog (default: the selected one) to do something. They may decline. */
  request(intent: Intent, dog?: DogId): Decision;
  snapshot(dog?: DogId): Snapshot;
  /** What a dog's brain would score each option right now. */
  options(dog?: DogId): Option[];
  setMode(mode: Mode): void;
  setAutonomy(on: boolean): void;
  on(fn: GameListener): () => void;
}

declare global {
  interface Window { playground: PlaygroundAPI; jaylee: PlaygroundAPI }
}

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};
const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const canvas = $<HTMLCanvasElement>('#stage');
const statusEl = $('#status');
const game = new Game();

// Preload every sheet any dog uses.
const sources = new Set(DOG_IDS.flatMap((id) => Object.values(DOGS[id].sprites.sheets).map((s) => s.src)));
const images = [...sources].map((src) => { const img = new Image(); img.src = src; return img; });
const renderer = new Renderer(canvas, game, images);

// ---------- Habits per dog (remembered in this browser) ----------
const traitsKey = (id: DogId): string => `dog:${id}:traits`;
function loadTraits(dog: Dog): void {
  const raw = store.get(traitsKey(dog.id)) ?? (dog.id === 'jaylee' ? store.get('jaylee:traits') : null);
  try {
    const saved = JSON.parse(raw ?? 'null') as Record<string, unknown> | null;
    const traits = dog.brain.personality.traits;
    if (saved) for (const k of Object.keys(traits) as (keyof typeof traits)[]) {
      const v = saved[k];
      if (typeof v === 'number' && v >= 0.1 && v <= 1) traits[k] = v;
    }
  } catch { /* start fresh */ }
}
const saveTraits = (dog: Dog): void => store.set(traitsKey(dog.id), JSON.stringify(dog.brain.personality.traits));
for (const id of DOG_IDS) loadTraits(game.roster[id]);

// ---------- Speech ----------
function showLine(dog: Dog, line: string): void {
  statusEl.textContent = game.dogs.length > 1 ? `${dog.name}: ${line}` : line;
  statusEl.style.setProperty('--accent', dog.profile.accent);
  statusEl.classList.remove('pop');
  void statusEl.offsetWidth; // restart the pop animation
  statusEl.classList.add('pop');
}
game.on((e) => {
  if (e.type === 'say') { const d = game.dogAt(e.dog); if (d) showLine(d, e.line); }
  else if (e.type === 'mode' || e.type === 'select') syncChrome();
});

// ---------- Header, switcher, meters ----------
const meters = { energy: $('#m-energy'), happy: $('#m-happy'), cool: $('#m-cool') };
const moodEl = $('#mood');
const whoEl = $('#mood-who');
const statsEl = $('#stats');
const titleEl = $('#title');
const chatTitle = $('#chat-title');
const pairButtons = document.querySelectorAll<HTMLElement>('[data-pair]');
const modeButtons = document.querySelectorAll<HTMLButtonElement>('[data-mode]');
const MOOD_LABEL: Record<Snapshot['mood'], string> = {
  happy: 'Happy', playful: 'Playful', sleepy: 'Sleepy', hot: 'Overheating', curious: 'Curious', needy: 'Wants love', content: 'Content',
};
const names = (): string => game.dogs.map((d) => d.name).join(' & ');

function syncChrome(): void {
  const both = game.dogs.length > 1;
  titleEl.textContent = `${names()}’s Playground`;
  document.title = titleEl.textContent;
  chatTitle.textContent = `Talk to ${names()}`;
  modeButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === game.mode)));
  pairButtons.forEach((b) => { b.hidden = !both; });
  document.documentElement.style.setProperty('--dog-accent', game.selected.profile.accent);
  whoEl.textContent = game.selected.name;
  updateUI();
}

let uiT = 0;
function updateUI(): void {
  const s = game.selected.snapshot();
  meters.energy.style.setProperty('--v', String(s.needs.energy));
  meters.happy.style.setProperty('--v', String(s.happiness));
  meters.cool.style.setProperty('--v', String(1 - s.needs.heat));
  moodEl.textContent = MOOD_LABEL[s.mood];
  const st = game.dogs.reduce((a, d) => ({
    fetches: a.fetches + d.stats.fetches, swims: a.swims + d.stats.swims, pets: a.pets + d.stats.pets, treats: a.treats + d.stats.treats,
  }), { fetches: 0, swims: 0, pets: 0, treats: 0 });
  statsEl.textContent = `${st.fetches} fetches · ${st.swims} swims · ${st.pets} pets · ${st.treats} treats`;
}

modeButtons.forEach((b) => b.addEventListener('click', () => {
  const mode = b.dataset.mode as Mode;
  game.setMode(mode);
  store.set('playground:mode', mode);
  chat.modeChanged();
}));

// ---------- Input ----------
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const hit = renderer.dogAt(sx, sy);
  if (hit) {
    game.select(hit.id);
    hit.pet();
    return;
  }
  if (sy < game.cam.HZ - 4) return;
  const at = game.cam.unproject(sx, sy);
  renderer.tapMarker(at);
  game.selected.request({ kind: 'goTo', x: at.x, y: at.y });
});

const TRICKS: readonly Trick[] = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
  b.addEventListener('click', () => {
    const act = b.dataset.act ?? '';
    const dog = game.selected;
    if (act === 'ball') game.throwBall();
    else if (act === 'treat') dog.request({ kind: 'eatTreat' });
    else if (act === 'swim') dog.request({ kind: 'swim' });
    else if (act === 'zoomies') dog.request({ kind: 'zoomies' });
    else if (act === 'play') dog.request({ kind: 'playWith' });
    else if (act === 'greet') dog.request({ kind: 'greet' });
    else if (act === 'tug') dog.request({ kind: 'tug' });
    else if (act === 'tugFriend') dog.request({ kind: 'tugFriend' });
    else if (act === 'sleep') dog.request({ kind: 'sleep' });
    else if ((TRICKS as readonly string[]).includes(act)) dog.request({ kind: 'trick', trick: act as Trick });
  });
});
$<HTMLInputElement>('#roam').addEventListener('change', (e) => {
  game.autonomy = (e.target as HTMLInputElement).checked;
});

// ---------- Day / night ----------
const timeBtn = $<HTMLButtonElement>('#time');
const TIME_MODES = ['auto', 'day', 'night'] as const;
const TIME_LABEL = { auto: 'Auto', day: 'Day', night: 'Night' } as const;
function setTimeMode(mode: (typeof TIME_MODES)[number]): void {
  game.timeMode = mode;
  timeBtn.dataset.mode = mode;
  $('#time-label').textContent = TIME_LABEL[mode];
  timeBtn.setAttribute('aria-label', mode === 'auto' ? 'Time of day: follows your clock' : `Time of day: always ${mode}`);
  store.set('playground:time', mode);
}
const savedTime = store.get('playground:time');
setTimeMode((TIME_MODES as readonly string[]).includes(savedTime ?? '') ? (savedTime as (typeof TIME_MODES)[number]) : 'auto');
timeBtn.addEventListener('click', () => setTimeMode(TIME_MODES[(TIME_MODES.indexOf(game.timeMode) + 1) % 3]!));

// ---------- Chat ----------
const chat = new Chat(game, $('#chat-log'), $<HTMLFormElement>('#chat-form'), $<HTMLInputElement>('#chat-input'), saveTraits);
const humanSel = $<HTMLSelectElement>('#human');
const savedHuman = store.get('playground:human');
if (savedHuman && [...humanSel.options].some((o) => o.value === savedHuman)) humanSel.value = savedHuman;
chat.human = humanSel.value;
humanSel.addEventListener('change', () => {
  store.set('playground:human', humanSel.value);
  chat.humanChanged(humanSel.value, humanSel.selectedOptions[0]?.textContent ?? 'Someone');
});

// ---------- Public API ----------
const pick = (id?: DogId): Dog => (id && game.dogAt(id)) || game.selected;
window.playground = window.jaylee = {
  request: (intent, id) => pick(id).request(intent, 'player'),
  snapshot: (id) => pick(id).snapshot(),
  options: (id) => { const d = pick(id); return d.brain.options(d.context()); },
  setMode: (mode) => { game.setMode(mode); chat.modeChanged(); },
  setAutonomy: (on) => { game.autonomy = on; $<HTMLInputElement>('#roam').checked = on; },
  on: (fn) => game.on(fn),
};

// ---------- Layout & loop ----------
let layoutKey = '';
function resize(): void {
  renderer.resize();
  const key = JSON.stringify(game.yard.pool);
  if (key !== layoutKey) { game.relayout(layoutKey !== ''); layoutKey = key; }
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  chat.tick();
  renderer.draw(dt);
  if ((uiT -= dt) <= 0) { updateUI(); uiT = 0.25; }
  requestAnimationFrame(frame);
}

function start(): void {
  // /jaylee and /helga always open on that dog; the main page remembers your last choice (both dogs by default).
  const page = document.documentElement.dataset.startMode;
  const saved = store.get('playground:mode');
  if ((DOG_IDS as readonly string[]).includes(page ?? '')) game.setMode(page as Mode);
  else game.setMode(saved === 'both' || (DOG_IDS as readonly string[]).includes(saved ?? '') ? (saved as Mode) : 'both');
  resize();
  syncChrome();
  chat.modeChanged(true);
  showLine(game.selected, game.selected.line);
  requestAnimationFrame((t) => { last = t; frame(t); });
}
Promise.all(images.map((img) => img.decode())).then(start, start);
