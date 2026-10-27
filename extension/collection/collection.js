import { toCsv } from '../lib/catalog.js';
import { command, productImage, productLink, downloadCsv } from '../lib/ui.js';

const $ = (selector) => document.querySelector(selector);
let items = [];

function render() {
  $('#summary').textContent = `${items.length} ${items.length === 1 ? 'idea da tenere a mente' : 'idee da tenere a mente'}.`;
  $('#empty').hidden = items.length > 0;
  $('#print').disabled = !items.length;
  $('#export-csv').disabled = !items.length;
  $('#collection-items').replaceChildren(...items.map((item, index) => {
    const card = document.createElement('li');
    card.className = 'idea-card';
    const image = productImage(item);
    const info = document.createElement('div');
    info.className = 'idea-info';
    const store = document.createElement('p');
    store.className = 'store';
    store.textContent = `${String(index + 1).padStart(2, '0')} / ${item.store}`;
    const heading = document.createElement('h2');
    heading.append(productLink(item));
    const url = document.createElement('a');
    url.className = 'product-url';
    url.href = item.url;
    url.target = '_blank';
    url.rel = 'noopener noreferrer';
    url.textContent = item.url;
    const remove = document.createElement('button');
    remove.className = 'text-button remove-idea';
    remove.textContent = 'Rimuovi';
    remove.setAttribute('aria-label', `Rimuovi ${item.title}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await command('REMOVE_PRODUCT', { url: item.url });
        $('#status').textContent = 'Idea rimossa.';
      } catch (error) {
        remove.disabled = false;
        $('#status').textContent = error.message;
      }
    });
    info.append(store, heading, url, remove);
    card.append(image, info);
    return card;
  }));
}

$('#export-csv').addEventListener('click', () => downloadCsv(items, toCsv));
$('#print').addEventListener('click', async () => {
  const button = $('#print');
  button.disabled = true;
  try {
    // Images downloaded when saving are data URLs and also print without a network.
    await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => {})));
    window.print();
  } finally {
    button.disabled = !items.length;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.items) {
    items = changes.items.newValue || [];
    render();
  }
});

try {
  ({ items } = await chrome.storage.local.get({ items: [] }));
  render();
} catch (error) {
  $('#summary').textContent = 'Impossibile caricare la lista.';
  $('#status').textContent = error.message;
}
