/** Boot: wires the game, renderer, page UI and the public `window.playground` API. */
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Chat } from './chat.js';
import { DOGS, DOG_IDS } from './dogs.js';
const $ = (sel) => {
    const el = document.querySelector(sel);
    if (!el)
        throw new Error(`Missing ${sel}`);
    return el;
};
const store = {
    get: (k) => { try {
        return localStorage.getItem(k);
    }
    catch {
        return null;
    } },
    set: (k, v) => { try {
        localStorage.setItem(k, v);
    }
    catch { /* ignore */ } },
};
const canvas = $('#stage');
const statusEl = $('#status');
const game = new Game();
// Preload every sheet any dog uses.
const sources = new Set(DOG_IDS.flatMap((id) => Object.values(DOGS[id].sprites.sheets).map((s) => s.src)));
const images = [...sources].map((src) => { const img = new Image(); img.src = src; return img; });
const renderer = new Renderer(canvas, game, images);
// ---------- Habits per dog (remembered in this browser) ----------
const traitsKey = (id) => `dog:${id}:traits`;
function loadTraits(dog) {
    const raw = store.get(traitsKey(dog.id)) ?? (dog.id === 'jaylee' ? store.get('jaylee:traits') : null);
    try {
        const saved = JSON.parse(raw ?? 'null');
        const traits = dog.brain.personality.traits;
        if (saved)
            for (const k of Object.keys(traits)) {
                const v = saved[k];
                if (typeof v === 'number' && v >= 0.1 && v <= 1)
                    traits[k] = v;
            }
    }
    catch { /* start fresh */ }
}
const saveTraits = (dog) => store.set(traitsKey(dog.id), JSON.stringify(dog.brain.personality.traits));
for (const id of DOG_IDS)
    loadTraits(game.roster[id]);
// ---------- Speech ----------
function showLine(dog, line) {
    statusEl.textContent = game.dogs.length > 1 ? `${dog.name}: ${line}` : line;
    statusEl.style.setProperty('--accent', dog.profile.accent);
    statusEl.classList.remove('pop');
    void statusEl.offsetWidth; // restart the pop animation
    statusEl.classList.add('pop');
}
game.on((e) => {
    if (e.type === 'say') {
        const d = game.dogAt(e.dog);
        if (d)
            showLine(d, e.line);
    }
    else if (e.type === 'mode' || e.type === 'select')
        syncChrome();
});
// ---------- Header, switcher, meters ----------
const meters = { energy: $('#m-energy'), happy: $('#m-happy'), cool: $('#m-cool') };
const moodEl = $('#mood');
const whoEl = $('#mood-who');
const statsEl = $('#stats');
const titleEl = $('#title');
const chatTitle = $('#chat-title');
const pairButtons = document.querySelectorAll('[data-pair]');
const modeButtons = document.querySelectorAll('[data-mode]');
const MOOD_LABEL = {
    happy: 'Happy', playful: 'Playful', sleepy: 'Sleepy', hot: 'Overheating', curious: 'Curious', needy: 'Wants love', content: 'Content',
};
const names = () => game.dogs.map((d) => d.name).join(' & ');
function syncChrome() {
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
function updateUI() {
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
    const mode = b.dataset.mode;
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
    if (sy < game.cam.HZ - 4)
        return;
    const at = game.cam.unproject(sx, sy);
    renderer.tapMarker(at);
    game.selected.request({ kind: 'goTo', x: at.x, y: at.y });
});
const TRICKS = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
document.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
        const act = b.dataset.act ?? '';
        const dog = game.selected;
        if (act === 'ball')
            game.throwBall();
        else if (act === 'treat')
            dog.request({ kind: 'eatTreat' });
        else if (act === 'swim')
            dog.request({ kind: 'swim' });
        else if (act === 'zoomies')
            dog.request({ kind: 'zoomies' });
        else if (act === 'play')
            dog.request({ kind: 'playWith' });
        else if (act === 'greet')
            dog.request({ kind: 'greet' });
        else if (TRICKS.includes(act))
            dog.request({ kind: 'trick', trick: act });
    });
});
$('#roam').addEventListener('change', (e) => {
    game.autonomy = e.target.checked;
});
// ---------- Chat ----------
const chat = new Chat(game, $('#chat-log'), $('#chat-form'), $('#chat-input'), saveTraits);
// ---------- Public API ----------
const pick = (id) => (id && game.dogAt(id)) || game.selected;
window.playground = window.jaylee = {
    request: (intent, id) => pick(id).request(intent, 'player'),
    snapshot: (id) => pick(id).snapshot(),
    options: (id) => { const d = pick(id); return d.brain.options(d.context()); },
    setMode: (mode) => { game.setMode(mode); chat.modeChanged(); },
    setAutonomy: (on) => { game.autonomy = on; $('#roam').checked = on; },
    on: (fn) => game.on(fn),
};
// ---------- Layout & loop ----------
let layoutKey = '';
function resize() {
    renderer.resize();
    const key = JSON.stringify(game.yard.pool);
    if (key !== layoutKey) {
        game.relayout(layoutKey !== '');
        layoutKey = key;
    }
}
window.addEventListener('resize', resize);
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    chat.tick();
    renderer.draw(dt);
    if ((uiT -= dt) <= 0) {
        updateUI();
        uiT = 0.25;
    }
    requestAnimationFrame(frame);
}
function start() {
    const saved = store.get('playground:mode');
    if (saved === 'both' || DOG_IDS.includes(saved ?? ''))
        game.setMode(saved);
    resize();
    syncChrome();
    chat.modeChanged(true);
    showLine(game.selected, game.selected.line);
    requestAnimationFrame((t) => { last = t; frame(t); });
}
Promise.all(images.map((img) => img.decode())).then(start, start);
