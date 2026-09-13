import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('docs/screenshots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5176/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1200);

async function shot(name) {
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  console.log('wrote', name);
}

// Device: select a port row then connect
await page.getByRole('button', { name: 'Device', exact: true }).click();
await page.waitForTimeout(400);
const port = page.getByText(/USB Serial Device/).first();
if (await port.count()) {
  await port.click();
  await page.waitForTimeout(300);
}
const connect = page.getByRole('button', { name: 'Connect', exact: true });
if ((await connect.count()) && (await connect.isEnabled())) {
  await connect.click();
  await page.waitForTimeout(900);
}
await shot('device');

await page.getByRole('button', { name: 'Serial', exact: true }).click();
await page.waitForTimeout(500);
await shot('serial');

await page.getByRole('button', { name: 'Apps', exact: true }).click();
await page.waitForTimeout(500);
await shot('apps');

await page.getByRole('button', { name: 'IDE', exact: true }).click();
await page.waitForTimeout(500);
const sample = page.getByRole('button', { name: 'Sample project' });
if (await sample.count()) {
  await sample.click();
  await page.waitForTimeout(1200);
}
await shot('ide');

await browser.close();
