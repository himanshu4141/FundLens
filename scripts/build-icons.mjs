#!/usr/bin/env node
// Renders the canonical FolioLens brand SVGs in `assets/brand/` to the PNG
// files Expo / the OS expect under `assets/images/`. Re-run any time the
// brand SVGs change. Requires `@resvg/resvg-js` (installed locally for the
// duration of the run if missing).

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const brandDir = join(root, 'assets', 'brand');
const outDir = join(root, 'assets', 'images');

const targets = [
  { src: 'icon-light.svg',   out: 'icon.png',            size: 1024 },
  { src: 'icon-dark.svg',    out: 'icon-dark.png',       size: 1024 },
  { src: 'icon-tinted.svg',  out: 'icon-tinted.png',     size: 1024 },
  { src: 'icon-tinted.svg',  out: 'monochrome-icon.png', size: 1024 },
  { src: 'adaptive-icon.svg',out: 'adaptive-icon.png',   size: 1024 },
  { src: 'splash.svg',       out: 'splash-icon.png',     size: 512  },
  { src: 'favicon.svg',      out: 'favicon.png',         size: 64   },
];

async function ensureResvg() {
  try {
    return await import('@resvg/resvg-js');
  } catch {
    // `npm install -g` is too invasive; install into a tmp prefix and import
    // from there. Fast on subsequent runs because npm caches the tarball.
    const tmpRoot = '/tmp/foliolens-resvg';
    await mkdir(tmpRoot, { recursive: true });
    try {
      await access(join(tmpRoot, 'node_modules', '@resvg', 'resvg-js'));
    } catch {
      execSync('npm init -y >/dev/null && npm install --silent --no-audit --no-fund @resvg/resvg-js@2.6.2', {
        cwd: tmpRoot,
        stdio: 'inherit',
      });
    }
    return import(join(tmpRoot, 'node_modules', '@resvg', 'resvg-js', 'index.js'));
  }
}

const { Resvg } = await ensureResvg();

await mkdir(outDir, { recursive: true });
for (const t of targets) {
  const svg = await readFile(join(brandDir, t.src));
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: t.size },
    background: 'rgba(0,0,0,0)',
    shapeRendering: 2, // geometricPrecision
    textRendering: 1,
    imageRendering: 0,
  });
  const png = resvg.render().asPng();
  await writeFile(join(outDir, t.out), png);
  console.log(`rendered ${t.src} -> ${t.out} (${t.size}px)`);
}
