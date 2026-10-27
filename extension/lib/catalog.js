export function canonicalProductUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Il link del prodotto non è valido.');
  }
  if (/^(www\.)?amazon\.it$/.test(url.hostname)) {
    const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
    if (asin) return `https://www.amazon.it/dp/${asin.toUpperCase()}`;
  }
  if (/^(www\.)?zalando\.it$/.test(url.hostname) && /^\/[\w-]+-[\w]+-[\w]+\.html$/.test(url.pathname)) {
    return `https://www.zalando.it${url.pathname}`;
  }
  throw new Error('Apri la pagina di un prodotto su Amazon.it o Zalando.it.');
}

export function safeImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    return /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|ztat\.net)$/.test(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeProduct(raw) {
  const url = canonicalProductUrl(raw?.url);
  const title = String(raw?.title || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!title) throw new Error('Il nome del prodotto non è ancora disponibile. Riprova fra un momento.');
  return { url, title, imageUrl: safeImageUrl(raw?.imageUrl), store: url.includes('amazon.it') ? 'Amazon' : 'Zalando' };
}

export function toCsv(items) {
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [['Prodotto', 'Negozio', 'Link', 'Immagine'], ...items.map((item) => [item.title, item.store, item.url, item.imageUrl])];
  return '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
