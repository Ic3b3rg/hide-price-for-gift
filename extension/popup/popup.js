import { canonicalProductUrl } from '../lib/catalog.js';
import { command, productImage, productLink, downloadCsv } from '../lib/ui.js';

const $ = (selector) => document.querySelector(selector);
let items = [];
let currentProduct = null;
let saving = false;

function showStatus(message, error = false) {
  $('#status').textContent = message;
  $('#status').classList.toggle('is-error', error);
}

function renderMode(enabled) {
  $('#enabled').checked = enabled;
  $('#enabled').disabled = false;
  $('#mode-description').textContent = enabled ? 'Prezzi nascosti, scegli con tranquillità.' : 'Prezzi visibili sui due negozi.';
  document.body.classList.toggle('mode-off', !enabled);
}

function updateSaveButton() {
  const isSaved = currentProduct && items.some((item) => item.url === currentProduct.url);
  const button = $('#save-product');
  button.disabled = !currentProduct || isSaved || saving;
  if (saving) button.textContent = 'Salvataggio…';
  else if (isSaved) button.textContent = 'Già nella tua lista ✓';
  else button.textContent = 'Salva questo prodotto';
}

function createProductRow(item) {
  const row = document.createElement('li');
  row.className = 'product-row';
  const info = document.createElement('div');
  info.className = 'product-info';
  const store = document.createElement('span');
  store.className = 'store';
  store.textContent = item.store;
  info.append(store, productLink(item));
  const remove = document.createElement('button');
  remove.className = 'remove-button';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Rimuovi ${item.title}`);
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    try {
      await command('REMOVE_PRODUCT', { url: item.url });
      showStatus('Idea rimossa dalla lista.');
    } catch (error) {
      remove.disabled = false;
      showStatus(error.message, true);
    }
  });
  row.append(productImage(item), info, remove);
  return row;
}

function renderItems() {
  $('#count').textContent = items.length;
  $('#empty').hidden = items.length > 0;
  $('#export-pdf').disabled = !items.length;
  $('#export-csv').disabled = !items.length;
  $('#items').replaceChildren(...items.map(createProductRow));
  updateSaveButton();
}

async function loadCurrentProduct() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(?:www\.)?(?:amazon|zalando)\.it\//.test(tab.url || '')) {
      $('#page-hint').textContent = 'Apri un prodotto su Amazon.it o Zalando.it per salvarlo.';
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT' }, { frameId: 0 });
    if (!response?.ok) throw new Error(response?.error || 'Prodotto non disponibile.');
    currentProduct = { ...response.product, url: canonicalProductUrl(response.product.url) };
    const name = document.createElement('p');
    name.textContent = currentProduct.title;
    $('#current-product').append(productImage(currentProduct), name);
    $('#current-product').hidden = false;
    $('#page-hint').textContent = 'Salvi foto e link. Nessun prezzo nella lista.';
    updateSaveButton();
  } catch (error) {
    $('#page-hint').textContent = /Receiving end|Could not establish/i.test(error.message)
      ? 'Ricarica la pagina una volta dopo aver installato l’estensione.'
      : error.message;
  }
}

async function openList() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('collection/collection.html') });
  } catch (error) {
    showStatus(error.message, true);
  }
}

$('#enabled').addEventListener('change', async (event) => {
  const value = event.target.checked;
  event.target.disabled = true;
  try {
    await command('SET_ENABLED', { enabled: value });
    renderMode(value);
    showStatus(value ? 'Modalità regalo attiva in tutte le schede dei due negozi.' : 'I prezzi sono di nuovo visibili.');
  } catch (error) {
    renderMode(!value);
    showStatus(error.message, true);
  }
});

$('#save-product').addEventListener('click', async () => {
  if (!currentProduct || saving) return;
  saving = true;
  updateSaveButton();
  showStatus('Salvo il prodotto e la sua foto…');
  try {
    const result = await command('SAVE_PRODUCT', { product: currentProduct });
    if (result.duplicate) showStatus('Questo prodotto è già nella lista.');
    else if (result.imageSaved) showStatus('Idea salvata, con la foto disponibile anche offline.');
    else showStatus('Idea salvata. Non è stato possibile scaricare la foto: resta il link all’immagine.');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    saving = false;
    updateSaveButton();
  }
});

$('#open-list').addEventListener('click', openList);
$('#export-pdf').addEventListener('click', openList);
$('#export-csv').addEventListener('click', () => downloadCsv(items));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.items) {
    items = changes.items.newValue || [];
    renderItems();
  }
  if (changes.enabled) renderMode(changes.enabled.newValue !== false);
});

try {
  const state = await chrome.storage.local.get({ enabled: true, items: [] });
  items = state.items;
  renderMode(state.enabled);
  renderItems();
  await loadCurrentProduct();
} catch (error) {
  showStatus(`Impossibile leggere la lista: ${error.message}`, true);
}
