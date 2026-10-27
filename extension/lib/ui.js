import { toCsv } from './catalog.js';

export async function command(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...data });
  if (!response?.ok) throw new Error(response?.error || 'Operazione non riuscita. Riprova.');
  return response;
}

export function productImage(item) {
  const image = document.createElement('img');
  image.src = item.imageData || item.imageUrl || '../icons/128.png';
  image.alt = item.title;
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    image.src = '../icons/128.png';
    image.alt = 'Foto non disponibile';
  }, { once: true });
  return image;
}

export function productLink(item) {
  const link = document.createElement('a');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = item.title;
  return link;
}

export function downloadCsv(items) {
  const blob = new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `idee-regalo-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
