import { normalizeProduct, safeImageUrl } from './lib/catalog.js';

let writes = Promise.resolve();
const serialize = (task) => {
  const result = writes.then(task);
  writes = result.catch(() => {});
  return result;
};

async function thumbnail(value) {
  const url = safeImageUrl(value);
  if (!url) return '';
  try {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return '';
    const blob = await response.blob();
    if (blob.size > 8_000_000) return '';
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * ratio)), Math.max(1, Math.round(bitmap.height * ratio)));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const result = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.76 });
    const bytes = new Uint8Array(await result.arrayBuffer());
    if (bytes.length > 45_000) return '';
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } catch {
    return '';
  }
}

async function handle(message) {
  if (message.type === 'SET_ENABLED') {
    await chrome.storage.local.set({ enabled: Boolean(message.enabled) });
    await updateBadge(Boolean(message.enabled));
    return {};
  }
  const { items } = await chrome.storage.local.get({ items: [] });
  if (message.type === 'REMOVE_PRODUCT') {
    await chrome.storage.local.set({ items: items.filter((item) => item.url !== message.url) });
    return {};
  }
  if (message.type === 'SAVE_PRODUCT') {
    const product = normalizeProduct(message.product);
    if (items.some((item) => item.url === product.url)) return { duplicate: true };
    if (items.length >= 150) throw new Error('La lista contiene già 150 idee. Esportala e rimuovi qualche prodotto.');
    const imageData = await thumbnail(product.imageUrl);
    await chrome.storage.local.set({ items: [{ ...product, imageData, savedAt: new Date().toISOString() }, ...items] });
    return { imageSaved: Boolean(imageData) };
  }
  throw new Error('Operazione non riconosciuta.');
}

async function updateBadge(enabled) {
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? '#365647' : '#716e69' });
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mutating operations are restricted to our popup/collection, never merchant pages.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  // The switch must respond immediately, even while a photo is downloading.
  const result = message.type === 'SET_ENABLED' ? handle(message) : serialize(() => handle(message));
  result.then(
    (result) => sendResponse({ ok: true, ...result }),
    (error) => sendResponse({ ok: false, error: error.message || 'Impossibile salvare. Riprova.' }),
  );
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  await updateBadge(enabled);
});
chrome.runtime.onStartup.addListener(async () => {
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  await updateBadge(enabled);
});
