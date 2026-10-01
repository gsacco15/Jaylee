/**
 * Builds the share-preview images and app icons from the real app.
 *   npm run build && npm run brand
 * Needs Playwright (Chromium). Writes into public/brand/.
 *
 * - og-both.png / og-jaylee.png / og-helga.png  (1200×630 link previews)
 * - icon-*.png, apple-touch-icon*.png, favicon-*.png
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const ROOT = resolve('public');
const OUT = join(ROOT, 'brand');
const FONT = (w) => resolve(`node_modules/@fontsource/outfit/files/outfit-latin-${w}-normal.woff2`);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// Tiny static server for the built site.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const VARIANTS = {
  both: {
    title: 'Jaylee & Helga’s Playground',
    blurb: 'Two very good girls, one backyard pool. Play tug-of-war, throw the ball, and chat with them.',
    accent: '#e8638f',
    chips: ['Swim', 'Tug-of-war', 'Chat', 'Day & night'],
    setup: () => {
      playground.setMode('both'); playground.setAutonomy(false);
      playground.request({ kind: 'swim' }, 'jaylee');
      playground.request({ kind: 'goTo', x: 0.42, y: 0.78 }, 'helga');
      setTimeout(() => playground.request({ kind: 'trick', trick: 'wave' }, 'helga'), 4200);
    },
    wait: 5000,
    focus: '62% 60%',
  },
  jaylee: {
    title: 'Jaylee’s Playground',
    blurb: 'A pool-loving pit bull and total cuddle bug, who doesn’t know her own strength. Come play!',
    accent: '#e8638f',
    chips: ['Swim', 'Fetch', 'Tug', 'Chat'],
    setup: () => {
      playground.setMode('jaylee'); playground.setAutonomy(false);
      playground.request({ kind: 'goTo', x: 0.42, y: 0.84 }, 'jaylee');
      setTimeout(() => playground.request({ kind: 'trick', trick: 'beg' }, 'jaylee'), 3000);
    },
    wait: 3900,
    focus: '45% 75%',
  },
  helga: {
    title: 'Helga’s Playground',
    blurb: 'Sweet, expressive and a little shy. Say hi gently, and she’ll wave right back.',
    accent: '#a8641a',
    chips: ['Play', 'Swim', 'Chat', 'Day & night'],
    setup: () => {
      playground.setMode('helga'); playground.setAutonomy(false);
      playground.request({ kind: 'goTo', x: 0.42, y: 0.84 }, 'helga');
      setTimeout(() => playground.request({ kind: 'trick', trick: 'wave' }, 'helga'), 3000);
    },
    wait: 3800,
    focus: '45% 75%',
  },
};

const fontFaces = async () => (await Promise.all([400, 600, 800].map(async (w) =>
  `@font-face{font-family:Outfit;font-weight:${w};src:url(data:font/woff2;base64,${(await readFile(FONT(w))).toString('base64')}) format('woff2')}`))).join('');

const cardHtml = (v, scene, fonts) => `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;font-family:Outfit,sans-serif;color:#3a2a1f;
  background:radial-gradient(900px 500px at 0% 0%,#ffe3ec 0%,transparent 60%),radial-gradient(700px 500px at 100% 100%,#ffe9cf 0%,transparent 60%),#f7efe6}
.text{position:absolute;left:72px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.pill{align-self:flex-start;display:flex;align-items:center;gap:10px;font-weight:600;font-size:22px;color:${v.accent};
  background:#fffaf4;border-radius:999px;padding:8px 18px 8px 10px;box-shadow:0 6px 18px -10px rgba(90,55,30,.4)}
.dot{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f4b98a,#d79a5f 60%,#b97a42);box-shadow:inset 0 -4px 0 0 ${v.accent}}
h1{font-weight:800;font-size:${v.title.length > 22 ? 68 : 76}px;line-height:1.02;letter-spacing:-.03em}
p{font-size:27px;line-height:1.35;color:#7a6353}
.chips{display:flex;gap:10px;flex-wrap:wrap}
.chips span{font-weight:600;font-size:21px;padding:8px 16px;border-radius:999px;background:${v.accent};color:#fff}
.chips span:nth-child(n+2){background:#fffaf4;color:#3a2a1f;border:1px solid rgba(58,42,31,.1)}
.card{position:absolute;right:-30px;top:50px;width:620px;height:530px;border-radius:40px;overflow:hidden;
  transform:rotate(2.5deg);box-shadow:0 40px 80px -30px rgba(90,55,30,.55),0 0 0 10px #fffaf4}
.card img{width:100%;height:100%;object-fit:cover;object-position:${v.focus};transform:scale(1.35);transform-origin:${v.focus}}
</style></head><body>
<div class="text">
  <div class="pill"><span class="dot"></span>Virtual dog playground</div>
  <h1>${v.title}</h1>
  <p>${v.blurb}</p>
  <div class="chips">${v.chips.map((c) => `<span>${c}</span>`).join('')}</div>
</div>
<div class="card"><img src="data:image/png;base64,${scene.toString('base64')}"></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
await mkdir(OUT, { recursive: true });
const fonts = await fontFaces();

for (const [name, v] of Object.entries(VARIANTS)) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 820 }, deviceScaleFactor: 3 });
  await page.addInitScript(() => { localStorage.setItem('playground:time', 'day'); });
  await page.goto(`${base}/`);
  await page.addStyleTag({ content: '.status,.hint,.time-toggle{display:none!important}' });
  await page.waitForTimeout(700);
  await page.evaluate(v.setup);
  await page.waitForTimeout(v.wait);
  const scene = await page.locator('#stage').screenshot();
  await page.close();

  const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await card.setContent(cardHtml(v, scene, fonts));
  await card.waitForTimeout(300);
  await card.screenshot({ path: join(OUT, `og-${name}.png`) });
  await card.close();
  console.log(`og-${name}.png`);
}

// App icons: dog head(s) on a warm rounded tile.
const sheet = async (f) => `data:image/webp;base64,${(await readFile(join(ROOT, 'assets', f))).toString('base64')}`;
const J = await sheet('jaylee-sprites.webp'), H = await sheet('helga-sprites.webp');
// Head crops (sheet px): x, y, w, h of the head in each dog's first sitting frame.
const HEADS = { jaylee: { src: J, x: 52, y: 6, w: 92, h: 92 }, helga: { src: H, x: 56, y: 30, w: 70, h: 70 } };
const head = (h, size, left, top) =>
  `<div style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size * 1.6}px;background:url(${h.src}) -${h.x * size / h.w}px -${h.y * size / h.h}px/${1343 * size / h.w}px ${2000 * size / h.h}px no-repeat"></div>`;
const ICONS = {
  both: { bg: 'linear-gradient(145deg,#ffd6e3,#ffe8cc)', heads: (s) => head(HEADS.jaylee, s * 0.62, s * 0.02, s * 0.2) + head(HEADS.helga, s * 0.56, s * 0.44, s * 0.26) },
  jaylee: { bg: 'linear-gradient(145deg,#ffc9db,#ffe3cc)', heads: (s) => head(HEADS.jaylee, s * 0.84, s * 0.08, s * 0.12) },
  helga: { bg: 'linear-gradient(145deg,#ffe3b8,#fff1dc)', heads: (s) => head(HEADS.helga, s * 0.8, s * 0.1, s * 0.14) },
};
const iconPage = await browser.newPage();
for (const [name, ic] of Object.entries(ICONS)) {
  for (const [file, size, round] of [
    [`icon-${name}-512.png`, 512, false], [`icon-${name}-192.png`, 192, false],
    [`apple-touch-icon-${name}.png`, 180, false], [`favicon-${name}-64.png`, 64, true],
  ]) {
    await iconPage.setViewportSize({ width: size, height: size });
    await iconPage.setContent(`<body style="margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${round ? 'transparent' : ic.bg}">
      <div style="position:absolute;inset:0;background:${ic.bg};border-radius:${round ? size * 0.22 : 0}px;overflow:hidden">${ic.heads(size)}</div></body>`);
    await iconPage.waitForTimeout(150);
    await iconPage.screenshot({ path: join(OUT, file), omitBackground: round });
  }
  console.log(`icons: ${name}`);
}

await browser.close();
server.close();
await writeFile(join(OUT, '.generated'), new Date().toISOString());
