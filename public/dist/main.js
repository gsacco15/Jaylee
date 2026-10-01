/** Boot: wires the game, renderer, page UI and the public `window.jaylee` API. */
import { Game } from './game.js';
import { Renderer } from './render.js';
import { SHEETS } from './sprites.js';
import { Chat } from './chat.js';
const $ = (sel) => {
    const el = document.querySelector(sel);
    if (!el)
        throw new Error(`Missing ${sel}`);
    return el;
};
const canvas = $('#stage');
const statusEl = $('#status');
const game = new Game();
const load = (src) => { const img = new Image(); img.src = src; return img; };
const sprites = { main: load(SHEETS.main.src), swim: load(SHEETS.swim.src) };
const renderer = new Renderer(canvas, game, sprites);
// ---------- Speech ----------
game.on((e) => {
    if (e.type === 'say') {
        statusEl.textContent = e.line;
        statusEl.classList.remove('pop');
        void statusEl.offsetWidth; // restart the pop animation
        statusEl.classList.add('pop');
    }
});
// ---------- Mood meters ----------
const meters = {
    energy: $('#m-energy'),
    happy: $('#m-happy'),
    cool: $('#m-cool'),
};
const moodEl = $('#mood');
const statsEl = $('#stats');
const MOOD_LABEL = {
    happy: 'Happy', playful: 'Playful', sleepy: 'Sleepy', hot: 'Overheating', curious: 'Curious', needy: 'Wants love', content: 'Content',
};
let uiT = 0;
function updateUI() {
    const s = game.snapshot();
    meters.energy.style.setProperty('--v', String(s.needs.energy));
    meters.happy.style.setProperty('--v', String(s.happiness));
    meters.cool.style.setProperty('--v', String(1 - s.needs.heat));
    moodEl.textContent = MOOD_LABEL[s.mood];
    const st = s.stats;
    statsEl.textContent = `${st.fetches} fetches · ${st.swims} swims · ${st.pets} pets · ${st.treats} treats`;
}
// ---------- Input ----------
canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const box = renderer.dogBox;
    if (box && sx > box.x && sx < box.x + box.w && sy > box.y && sy < box.y + box.h) {
        game.pet();
        return;
    }
    if (sy < game.cam.HZ - 4)
        return;
    const at = game.cam.unproject(sx, sy);
    renderer.tapMarker(at);
    game.request({ kind: 'goTo', x: at.x, y: at.y });
});
const TRICKS = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
document.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
        const act = b.dataset.act ?? '';
        if (act === 'ball')
            game.throwBall();
        else if (act === 'treat')
            game.request({ kind: 'eatTreat' });
        else if (act === 'swim')
            game.request({ kind: 'swim' });
        else if (act === 'zoomies')
            game.request({ kind: 'zoomies' });
        else if (TRICKS.includes(act))
            game.request({ kind: 'trick', trick: act });
    });
});
$('#roam').addEventListener('change', (e) => {
    game.autonomy = e.target.checked;
});
// ---------- Public API ----------
window.jaylee = {
    request: (intent) => game.request(intent, 'player'),
    chat: (intent) => game.request(intent, 'chat'),
    snapshot: () => game.snapshot(),
    options: () => game.brain.options(game.context()),
    setAutonomy: (on) => { game.autonomy = on; $('#roam').checked = on; },
    on: (fn) => game.on(fn),
};
// ---------- Chat ----------
// Habits she learns in chat are remembered in this browser.
const TRAITS_KEY = 'jaylee:traits';
try {
    const saved = JSON.parse(localStorage.getItem(TRAITS_KEY) ?? 'null');
    const traits = game.brain.personality.traits;
    if (saved)
        for (const k of Object.keys(traits)) {
            const v = saved[k];
            if (typeof v === 'number' && v >= 0.1 && v <= 1)
                traits[k] = v;
        }
}
catch { /* storage unavailable: start fresh */ }
const saveTraits = () => {
    try {
        localStorage.setItem(TRAITS_KEY, JSON.stringify(game.brain.personality.traits));
    }
    catch { /* ignore */ }
};
const chat = new Chat(game, $('#chat-log'), $('#chat-form'), $('#chat-input'), saveTraits);
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
    resize();
    statusEl.textContent = game.line;
    updateUI();
    requestAnimationFrame((t) => { last = t; frame(t); });
}
Promise.all(Object.values(sprites).map((img) => img.decode())).then(start, start);
