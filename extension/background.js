import { normalizeProduct } from './lib/catalog.js';
import { createThumbnail } from './lib/thumbnail.js';

const MAX_ITEMS = 150;
let writeQueue = Promise.resolve();

function serializeWrite(task) {
  const result = writeQueue.then(task);
  // A failed save must not prevent the next queued operation from running.
  writeQueue = result.catch(() => {});
  return result;
}

async function handleCommand(message) {
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
    if (items.length >= MAX_ITEMS) throw new Error(`La lista contiene già ${MAX_ITEMS} idee. Esportala e rimuovi qualche prodotto.`);
    const imageData = await createThumbnail(product.imageUrl);
    const savedProduct = { ...product, imageData, savedAt: new Date().toISOString() };
    await chrome.storage.local.set({ items: [savedProduct, ...items] });
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
  const result = message.type === 'SET_ENABLED'
    ? handleCommand(message)
    : serializeWrite(() => handleCommand(message));
  result.then(
    (result) => sendResponse({ ok: true, ...result }),
    (error) => sendResponse({ ok: false, error: error.message || 'Impossibile salvare. Riprova.' }),
  );
  return true;
});

async function restoreBadge() {
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  await updateBadge(enabled);
}

chrome.runtime.onInstalled.addListener(restoreBadge);
chrome.runtime.onStartup.addListener(restoreBadge);
