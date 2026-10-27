import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalProductUrl, safeImageUrl, toCsv } from '../extension/lib/catalog.js';

test('the same Amazon product has one identity, without referral parameters', () => {
  assert.equal(canonicalProductUrl('https://www.amazon.it/a-title/dp/B0DHS9Y433/ref=sr_1?tag=abc'), 'https://www.amazon.it/dp/B0DHS9Y433');
  assert.equal(canonicalProductUrl('https://amazon.it/gp/product/B0DHS9Y433?th=1'), 'https://www.amazon.it/dp/B0DHS9Y433');
});

test('Zalando links retain their product and reject arbitrary or unsafe sites', () => {
  assert.equal(canonicalProductUrl('https://www.zalando.it/nike-scarpe-ni112n022-a11.html?size=42'), 'https://www.zalando.it/nike-scarpe-ni112n022-a11.html');
  for (const url of ['https://www.amazon.it/s?k=scarpe', 'https://www.zalando.it/catalogo/', 'https://amazon.it.evil.test/dp/B0DHS9Y433', 'javascript:alert(1)']) {
    assert.throws(() => canonicalProductUrl(url));
  }
});

test('images can only come from the stores image hosts', () => {
  assert.equal(safeImageUrl('https://img01.ztat.net/article/shoe.jpg'), 'https://img01.ztat.net/article/shoe.jpg');
  assert.equal(safeImageUrl('https://m.media-amazon.com/images/a.jpg'), 'https://m.media-amazon.com/images/a.jpg');
  assert.equal(safeImageUrl('https://evil.test/image.jpg'), '');
  assert.equal(safeImageUrl('https://img01.ztat.net@evil.test/image.jpg'), '');
});

test('Excel CSV preserves accents, quotes and line breaks without executing formulas', () => {
  const csv = toCsv([{ title: '=HYPERLINK("evil")', store: 'Zalando', url: 'https://www.zalando.it/shoe.html', imageUrl: '' }]);
  assert.ok(csv.startsWith('\uFEFF"Prodotto";"Negozio";"Link";"Immagine"\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(toCsv([{title:'Caffè, "regalo"\nblu',store:'Amazon',url:'https://www.amazon.it/dp/B0DHS9Y433',imageUrl:''}]).includes('"Caffè, ""regalo""\nblu"'));
});
