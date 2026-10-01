/**
 * Writes public/index.html (both dogs), public/jaylee.html and public/helga.html
 * from src/page.html, each with its own share preview, icon and home-screen app.
 * Runs as part of `npm run build`.
 *
 * Link previews need absolute image URLs: set SITE_URL, or on Vercel the
 * production domain is used automatically.
 */
import { readFile, writeFile } from 'node:fs/promises';

const host = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const site = host.replace(/\/$/, '');
const abs = (path) => (site ? `${site}/${path}` : path);

const PAGES = [
  {
    file: 'index.html', path: '', mode: 'both', icon: 'both', manifest: 'site.webmanifest',
    title: 'Jaylee & Helga’s Playground', app: 'Jaylee & Helga',
    description: 'Two very good girls, one backyard pool. Play tug-of-war, throw the ball, and chat with Jaylee and Helga.',
    alt: 'Helga waving on the lawn while Jaylee swims in the backyard pool',
  },
  {
    file: 'jaylee.html', path: 'jaylee', mode: 'jaylee', icon: 'jaylee', manifest: 'jaylee.webmanifest',
    title: 'Jaylee’s Playground', app: 'Jaylee',
    description: 'A pool-loving pit bull and total cuddle bug, who doesn’t know her own strength. Come play with Jaylee!',
    alt: 'Jaylee the pit bull sitting happily on the lawn by the pool',
  },
  {
    file: 'helga.html', path: 'helga', mode: 'helga', icon: 'helga', manifest: 'helga.webmanifest',
    title: 'Helga’s Playground', app: 'Helga',
    description: 'Sweet, expressive and a little shy. Say hi to Helga gently, and she’ll wave right back.',
    alt: 'Helga the black-and-tan pup waving hello on the lawn',
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const template = await readFile('src/page.html', 'utf8');

for (const p of PAGES) {
  const html = template
    .replaceAll('{{MODE}}', p.mode)
    .replaceAll('{{TITLE}}', esc(p.title))
    .replaceAll('{{DESCRIPTION}}', esc(p.description))
    .replaceAll('{{OG_IMAGE}}', (site ? abs(`brand/og-${p.icon}.png`) : `/brand/og-${p.icon}.png`))
    .replaceAll('{{OG_ALT}}', esc(p.alt))
    .replaceAll('{{OG_URL}}', site ? `<meta property="og:url" content="${site}/${p.path}" />` : '')
    .replaceAll('{{ICON}}', p.icon)
    .replaceAll('{{MANIFEST}}', p.manifest)
    .replaceAll('{{APP_NAME}}', esc(p.app));
  await writeFile(`public/${p.file}`, html);

  const manifest = {
    name: p.title,
    short_name: p.app,
    description: p.description,
    start_url: `/${p.path}`,
    scope: '/',
    display: 'standalone',
    background_color: '#f7efe6',
    theme_color: '#f7efe6',
    icons: [
      { src: `/brand/icon-${p.icon}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/brand/icon-${p.icon}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/brand/icon-${p.icon}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  await writeFile(`public/${p.manifest}`, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`pages: ${PAGES.map((p) => p.file).join(', ')}${site ? ` (${site})` : ' (relative image URLs; set SITE_URL for absolute)'}`);
