import { test as base, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { amazonProduct, zalandoCatalog, zalandoProduct } from './fixtures.js';

const extensionPath = fileURLToPath(new URL('../../extension', import.meta.url));
const image = readFileSync(new URL('../../extension/icons/128.png', import.meta.url));

const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.route('https://**/*', async (route) => {
      const url = route.request().url();
      if (/media-amazon\.com|ztat\.net/.test(url)) return route.fulfill({ contentType: 'image/png', body: image });
      if (url.includes('amazon.it')) return route.fulfill({ contentType: 'text/html', body: amazonProduct });
      if (url.includes('zalando.it')) return route.fulfill({ contentType: 'text/html', body: url.includes('.html') ? zalandoProduct : zalandoCatalog });
      return route.abort();
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).hostname);
  },
});

test('Amazon: split prices stay hidden on reload, dynamic updates and full navigation', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://www.amazon.it/dp/B0DHS9Y433');
  await expect(page.locator('#product-price')).toBeHidden();
  await expect(page.locator('#shipping')).toBeVisible();
  await expect(page.locator('#total')).toBeVisible();
  await expect(page.locator('#buy')).toBeVisible();
  await page.evaluate(() => {
    document.querySelector('#dynamic').innerHTML = '<article><span id="lazy-price">44,95 €</span><img id="lazy-image" src="https://m.media-amazon.com/images/test.jpg"></article>';
  });
  await expect(page.locator('#lazy-price')).toBeHidden();
  await expect(page.locator('#lazy-image')).toBeVisible();
  await page.reload();
  await expect(page.locator('#product-price')).toBeHidden();
  await page.goto('https://www.amazon.it/dp/B0DHS9Y434');
  await expect(page.locator('#product-price')).toBeHidden();
});

test('Zalando: unknown markup, infinite scroll, recycled nodes and SPA navigation', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://www.zalando.it/catalogo/');
  await expect(page.locator('#product-price')).toBeHidden();
  await expect(page.locator('#old-price')).toBeHidden();
  await expect(page.locator('#discount')).toBeVisible();
  await expect(page.locator('#shipping')).toBeVisible();
  await expect(page.locator('#total')).toBeVisible();
  await page.evaluate(() => {
    const article = document.createElement('article');
    article.innerHTML = '<p><span id="lazy-price">€</span><span> 49,95</span></p><h2 id="lazy-name">Maglione</h2>';
    document.querySelector('#dynamic').append(article);
    window.scrollTo(0, document.body.scrollHeight);
  });
  await expect(page.locator('#lazy-price')).toBeHidden();
  await expect(page.locator('#lazy-name')).toBeVisible();
  await page.evaluate(() => { document.querySelector('#product-price').firstChild.data = 'Disponibile'; });
  await expect(page.locator('#product-price')).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, '', '/nike-scarpa-ni112n022-a11.html');
    document.querySelector('main').innerHTML = '<h1>Scarpa</h1><p><span id="spa-price">79,99 €</span></p>';
  });
  await expect(page.locator('#spa-price')).toBeHidden();
  await page.goto('https://www.zalando.it/nike-scarpa-ni112n022-a11.html');
  await expect(page.locator('#product-price')).toBeHidden();
  await expect(page.locator('#discount')).toBeVisible();
});

test('the toggle restores prices and synchronizes across tabs and later reloads', async ({ context, extensionId }) => {
  const amazon = await context.newPage();
  await amazon.goto('https://www.amazon.it/dp/B0DHS9Y433');
  const zalando = await context.newPage();
  await zalando.goto('https://www.zalando.it/catalogo/');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.getByRole('switch').uncheck();
  await expect(amazon.locator('#product-price')).toBeVisible();
  await expect(zalando.locator('#product-price')).toBeVisible();
  await amazon.reload();
  await expect(amazon.locator('#product-price')).toBeVisible();
  await popup.getByRole('switch').check();
  await expect(amazon.locator('#product-price')).toBeHidden();
  await expect(zalando.locator('#product-price')).toBeHidden();
});

test('save current product, prevent duplicates, export CSV, reopen list, print and remove', async ({ context, extensionId }) => {
  const errors = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  const product = await context.newPage();
  await product.goto('https://www.amazon.it/dp/B0DHS9Y433?tag=tracking');
  // The popup is displayed in a separate test page while Chrome reports the merchant tab as active.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await product.bringToFront();
  await popup.reload();
  await expect(popup.getByRole('button', { name: 'Salva questo prodotto' })).toBeEnabled();
  await popup.getByRole('button', { name: 'Salva questo prodotto' }).click();
  await expect(popup.locator('#count')).toHaveText('1');
  const saved = await popup.evaluate(async () => (await chrome.storage.local.get('items')).items[0]);
  expect(saved.imageData).toMatch(/^data:image\/jpeg;base64,/);
  await expect(popup.getByRole('button', { name: 'Già nella tua lista' })).toBeDisabled();
  const [download] = await Promise.all([popup.waitForEvent('download'), popup.getByRole('button', { name: 'CSV per Excel' }).click()]);
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv).toContain('Macchina da corsa LEGO');
  expect(csv).toContain('https://www.amazon.it/dp/B0DHS9Y433');
  expect(csv).not.toContain('29,99');
  const list = await context.newPage();
  await list.goto(`chrome-extension://${extensionId}/collection/collection.html`);
  await expect(list.locator('.idea-card')).toHaveCount(1);
  await expect(list.locator('.idea-card img')).toBeVisible();
  await context.setOffline(true);
  await list.reload();
  await expect(list.locator('.idea-card img')).toHaveJSProperty('complete', true);
  await expect(list.locator('.idea-card img')).toHaveAttribute('src', /^data:image\/jpeg/);
  await context.setOffline(false);
  await list.evaluate(() => { window.print = () => { window.printRequested = true; }; });
  await list.getByRole('button', { name: 'Salva come PDF' }).click();
  await expect.poll(() => list.evaluate(() => window.printRequested)).toBe(true);
  await list.emulateMedia({ media: 'print' });
  await expect(list.locator('.export-actions')).toBeHidden();
  await list.pdf({ path: 'test-results/idee-regalo.pdf', format: 'A4', printBackground: true });
  await list.emulateMedia({ media: 'screen' });
  await list.getByRole('button', { name: 'Rimuovi Macchina da corsa LEGO' }).click();
  await expect(list.locator('.idea-card')).toHaveCount(0);
  await expect(popup.locator('#count')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('pages outside the supported shops are untouched', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('data:text/html,<main><span class="a-price">25,00 €</span></main>');
  await expect(page.locator('.a-price')).toBeVisible();
  expect(await page.locator('html').getAttribute('data-sorpresa')).toBeNull();
});

test('late split prices, shipping labels, percentage siblings and inserted totals stay distinct', async ({ context }) => {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('https://www.zalando.it/catalogo/');
  await page.evaluate(() => {
    document.documentElement.insertBefore(document.createTextNode('\n'), document.head);
    document.querySelector('#dynamic').innerHTML = `<article>
      <p><span id="late-currency">€</span><span id="late-amount"></span></p>
      <p><span class="a-price" id="adjacent-product">29,99 €</span><span>Consegna gratuita</span></p>
      <p><span id="split-currency">€</span><span id="split-amount">49,95</span><span id="split-discount">-25%</span></p>
      <p>Spedizione <span data-a-selector="price" id="selector-shipping">3,99 €</span></p>
      <p>€<span id="raw-currency-amount">59,95</span><span id="raw-currency-discount">-20%</span></p>
    </article>`;
  });
  await page.evaluate(() => { document.querySelector('#late-amount').textContent = '49,95'; });
  await page.evaluate(() => {
    const total = document.createElement('span');
    total.id = 'inserted-total';
    total.dataset.testid = 'subtotal';
    total.className = 'a-price';
    total.textContent = '99,99 €';
    document.querySelector('#dynamic').append(total);
    const fragment = document.createDocumentFragment();
    fragment.append(document.createComment('framework marker'));
    const article = document.createElement('article');
    article.innerHTML = '<span id="after-comment">79,95 €</span>';
    fragment.append(article);
    document.querySelector('#dynamic').append(fragment);
  });
  await expect.soft(page.locator('#late-amount')).toBeHidden();
  await expect.soft(page.locator('#adjacent-product')).toBeHidden();
  await expect.soft(page.locator('#split-currency')).toBeHidden();
  await expect.soft(page.locator('#split-amount')).toBeHidden();
  await expect.soft(page.locator('#split-discount')).toBeVisible();
  await expect.soft(page.locator('#selector-shipping')).toBeVisible();
  await expect.soft(page.locator('#inserted-total')).toBeVisible();
  await expect.soft(page.locator('#after-comment')).toBeHidden();
  await expect.soft(page.locator('#raw-currency-amount')).toBeHidden();
  await expect.soft(page.locator('#raw-currency-discount')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mixed price lines keep delivery text and all percentage discounts visible', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('https://www.zalando.it/catalogo/');
  await page.evaluate(() => {
    document.querySelector('#dynamic').innerHTML = `<article>
      <p id="mixed-line">29,99 € · Consegna gratuita</p>
      <p>Spedizione <span class="a-price"><span id="nested-shipping">3,99</span><span> €</span></span></p>
      <p><span>€</span> <span id="positive-amount">49,95</span> <span id="positive-discount">25%</span></p>
      <p class="a-price"><span>€</span><span>49,95</span><span id="known-discount">-25%</span></p>
    </article>`;
    const reference = document.createElement('p');
    reference.id = 'visual-reference';
    reference.innerHTML = '<span style="color:transparent">29,99 €</span> · Consegna gratuita';
    document.body.append(reference);
  });
  await expect.soft(page.locator('#nested-shipping')).toBeVisible();
  await expect.soft(page.locator('#positive-amount')).toBeHidden();
  await expect.soft(page.locator('#positive-discount')).toBeVisible();
  await expect.soft(page.locator('#known-discount')).toBeVisible();
  // Compare the painted result with an independent, literal visual reference.
  const actual = await page.locator('#mixed-line').screenshot();
  const reference = await page.locator('#visual-reference').screenshot();
  expect(actual.equals(reference)).toBe(true);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.getByRole('switch').uncheck();
  await expect(page.locator('#positive-amount')).toBeVisible();
  await page.locator('#visual-reference span').evaluate((span) => { span.style.color = ''; });
  expect((await page.locator('#mixed-line').screenshot()).equals(await page.locator('#visual-reference').screenshot())).toBe(true);
  await popup.getByRole('switch').check();
  await expect(page.locator('#positive-amount')).toBeHidden();
  await page.locator('#visual-reference span').evaluate((span) => { span.style.color = 'transparent'; });
  expect((await page.locator('#mixed-line').screenshot()).equals(await page.locator('#visual-reference').screenshot())).toBe(true);
});

for (const [shop, url] of [
  ['Amazon', 'https://www.amazon.it/dp/B0DHS9Y433'],
  ['Zalando', 'https://www.zalando.it/new-balance-sneakers-basse-beige-beige-ne242a0o4-b11.html'],
]) {
  test(`${shop} product detail: sticky prices, variants and offers outside the main content`, async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.locator('#product-price')).toBeHidden();
    await page.evaluate(() => {
      const floating = document.createElement('div');
      floating.id = 'detail-floating';
      floating.innerHTML = `<div><span id="sticky-price">112,54 €</span><button id="sticky-buy">Aggiungi</button></div>
        <div role="dialog"><p>Altre offerte <span id="other-offer">99,99 €</span></p>
          <button id="variant-button">Taglia 42 <span id="variant-price">119,95 €</span></button>
          <p>Spedizione <span id="floating-shipping">4,99 €</span></p>
          <p>Totale ordine <span id="floating-total">124,94 €</span></p>
          <p>Sconto <span id="floating-discount">-15%</span></p></div>`;
      document.body.append(floating);
    });
    await expect.soft(page.locator('#sticky-price')).toBeHidden();
    await expect.soft(page.locator('#other-offer')).toBeHidden();
    await expect.soft(page.locator('#variant-price')).toBeHidden();
    await expect(page.locator('#sticky-buy')).toBeVisible();
    await expect(page.locator('#variant-button')).toBeVisible();
    await expect(page.locator('#floating-shipping')).toBeVisible();
    await expect(page.locator('#floating-total')).toBeVisible();
    await expect(page.locator('#floating-discount')).toBeVisible();
    await page.evaluate(() => { document.querySelector('#variant-price').firstChild.data = '129,95 €'; });
    await expect.soft(page.locator('#variant-price')).toBeHidden();
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup.getByRole('switch').uncheck();
    await expect(page.locator('#sticky-price')).toBeVisible();
    await expect(page.locator('#variant-price')).toBeVisible();
    await popup.getByRole('switch').check();
    await expect.soft(page.locator('#sticky-price')).toBeHidden();
    await expect.soft(page.locator('#variant-price')).toBeHidden();
  });
}
