// Renders the app and tray icons from assets/*.svg to PNG (npm run build:icons).
// The PNGs are committed, so this only needs running when the SVGs change.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));
const OUTPUTS = [
  ['tray.svg', 'tray.png', 16],
  ['tray.svg', 'tray@2x.png', 32],
  ['icon.svg', 'icon.png', 256],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [source, target, size] of OUTPUTS) {
    const svg = await readFile(path.join(ASSETS, source), 'utf8');
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    const png = await page.locator('svg').screenshot({ omitBackground: true });
    await writeFile(path.join(ASSETS, target), png);
    console.log(`assets/${target} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
