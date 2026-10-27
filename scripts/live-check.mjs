import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const extension = resolve(import.meta.dirname, '../extension');
const output = resolve(import.meta.dirname, '../artifacts/verification');
await mkdir(output, { recursive: true });
const version = execFileSync(chromium.executablePath(), ['--version'], { encoding: 'utf8' }).match(/\d+(?:\.\d+){3}/)[0];
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1366, height: 900 },
  // Exercise the browser compatibility path used by normal desktop Chrome.
  userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const report = [];
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionUrl = `chrome-extension://${new URL(worker.url()).hostname}`;
  const control = await context.newPage();
  await control.goto(`${extensionUrl}/popup/popup.html`);
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('Browser:', error.stack));
  const cases = [
    ['amazon-search', 'https://www.amazon.it/s?k=lego'],
    ['amazon-product', 'https://www.amazon.it/dp/B0DHS9Y433'],
    ['zalando-search', 'https://www.zalando.it/catalogo/?q=sneakers'],
    ['zalando-product', 'https://www.zalando.it/nike-sportswear-air-force-1-07-sneakers-basse-white-ni112n022-a11.html'],
  ];
  for (const [name, url] of cases.filter(([name]) => !process.argv[2] || name.startsWith(process.argv[2]))) {
    console.log(`Controllo pagina reale: ${name}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    try {
      await page.waitForSelector('.a-price,[data-sorpresa-price]', { state: 'attached', timeout: 15_000 });
    } catch (error) {
      await page.screenshot({ path: resolve(output, `${name}-unavailable.png`) });
      console.error({ url: page.url(), title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 700) });
      throw error;
    }
    await page.screenshot({ path: resolve(output, `${name}.png`) });
    const result = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const visible = [];
      const masks = [...(CSS.highlights.get('sorpresa-prices') || [])];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const element = node.parentElement;
        if (!/(?:€|EUR)\s*\d|\d[\d.,\s]*\s*(?:€|EUR)/i.test(node.textContent) || element.closest('script,style,nav,footer')) continue;
        if (!element.getClientRects().length || getComputedStyle(element).visibility !== 'visible') continue;
        const amounts = [...node.textContent.matchAll(/(?:€|EUR)\s*\d[\d.,\s]*|\d[\d.,\s]*\s*(?:€|EUR)/gi)];
        if (amounts.length && amounts.every((amount) => masks.some((range) => range.startContainer === node && range.endContainer === node && range.startOffset <= amount.index && range.endOffset >= amount.index + amount[0].trimEnd().length))) continue;
        if (!element.closest('[data-asin],article,#dp') && !(location.hostname.includes('zalando') && location.pathname.endsWith('.html') && element.closest('main'))) continue;
        const label = (element.closest('p') || element.parentElement).textContent;
        if (/spedizion|consegna|shipping|delivery|total|ordini|orders/i.test(label)) continue;
        visible.push({ text: node.textContent.trim().slice(0, 100), html: element.outerHTML.slice(0, 600), context: element.parentElement.outerHTML.slice(0, 1000) });
      }
      return { title: document.title, hidden: document.querySelectorAll('[data-sorpresa-price],.a-price').length, visibleProductAmounts: visible };
    });
    console.log(JSON.stringify(result));
    assert.equal(result.visibleProductAmounts.length, 0, `${name}: importi prodotto ancora visibili`);
    report.push({ name, url, ...result });
    if (name.endsWith('product')) {
      const saved = await control.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((tab) => tab.url === url);
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT' }, { frameId: 0 });
        if (!result.ok) throw new Error(result.error);
        return chrome.runtime.sendMessage({ type: 'SAVE_PRODUCT', product: result.product });
      }, page.url());
      assert.equal(saved.ok, true);
      assert.equal(saved.imageSaved, true, `${name}: foto non salvata offline`);
      console.log(`${name}: prodotto e foto salvati offline`);
    }
    await page.mouse.wheel(0, 900);
  }
  await page.bringToFront();
  await control.reload();
  await control.setViewportSize({ width: 390, height: 600 });
  await control.waitForFunction(() => !document.querySelector('#page-hint').textContent.startsWith('Apro'), null, { timeout: 5000 });
  await control.screenshot({ path: resolve(output, 'popup.png') });
  const collection = await context.newPage();
  await collection.goto(`${extensionUrl}/collection/collection.html`);
  await collection.locator('.idea-card').first().waitFor();
  await collection.evaluate(async () => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
  await collection.screenshot({ path: resolve(output, 'collection-desktop.png'), fullPage: true });
  await collection.setViewportSize({ width: 390, height: 844 });
  await collection.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const contentHeight = await collection.evaluate(() => document.documentElement.scrollHeight);
  await collection.setViewportSize({ width: 390, height: contentHeight });
  await collection.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await collection.screenshot({ path: resolve(output, 'collection-mobile.png'), fullPage: true });
  await context.setOffline(true);
  await collection.reload();
  assert.equal(await collection.locator('.idea-card img[src^="data:"]').count(), report.filter((entry) => entry.name.endsWith('product')).length);
  await collection.pdf({ path: resolve(output, 'idee-regalo.pdf'), format: 'A4', printBackground: true });
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Verifica reale completata; schermate e PDF in ${output}`);
} finally {
  await context.close();
}
