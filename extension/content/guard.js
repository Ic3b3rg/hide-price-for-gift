(() => {
  const PRICE = '.a-price,.a-text-price,.priceToPay,.sc-product-price,[data-a-selector="price"],[itemprop="price"],[data-testid="product-price"],[data-testid="price"],[id^="priceblock_"]';
  const PRODUCT = '[data-asin],article,[data-testid*="product"],[data-testid*="pdp"],[itemtype*="Product"],#dp,#ppd,#centerCol,#rightCol,#buybox';
  const EXCLUDED = 'script,style,noscript,template,textarea,input,select,nav,footer,[role="banner"],[contenteditable="true"],#nav-main,#nav-belt,#sc-subtotal-amount-activecart,#sc-subtotal-amount-buybox,#subtotals-marketplace-table,[data-testid*="subtotal"],[data-testid*="shipping"],[data-testid*="delivery"],[data-testid*="order-total"],[id*="delivery" i],[id*="shipping" i]';
  const NUMBER = '(?:\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
  const MONEY = new RegExp(`(?:€|EUR|£|\\$)\\s*${NUMBER}|${NUMBER}\\s*(?:€|EUR|£|\\$)`, 'i');
  const OTHER_AMOUNT = /\b(?:spedizion\w*|consegna|delivery|shipping|totale|totali|total|subtotal|subtotale|ordini|orders)\b/i;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
  const highlights = new Highlight();
  const maskedRanges = new Map();
  CSS.highlights.set('sorpresa-prices', highlights);
  let enabled = true;

  function excluded(element) {
    if (element.closest(EXCLUDED)) return true;
    const ownAmount = element.textContent.match(MONEY);
    if (ownAmount && OTHER_AMOUNT.test(element.textContent.slice(0, ownAmount.index))) return true;
    // A label belongs to the following amount. A delivery label AFTER a product
    // price must never exempt that price, even when both share a paragraph.
    let current = element;
    for (let depth = 0; current && depth < 3; depth++, current = current.parentElement) {
      let previous = current.previousSibling;
      while (previous && !previous.textContent?.trim()) previous = previous.previousSibling;
      if (previous) return previous.textContent.length < 100 && OTHER_AMOUNT.test(previous.textContent) && !MONEY.test(previous.textContent);
      if (current.parentElement?.children.length !== 1) break;
    }
    return false;
  }

  function inProduct(element) {
    return Boolean(element.closest(PRODUCT)) || (/\.html$/.test(location.pathname) && Boolean(element.closest('main')));
  }

  function markText(node) {
    if (!/[€£$]|EUR/i.test(node.textContent)) return;
    let element = node.parentElement;
    if (!element || excluded(element)) return;
    const known = element.closest(PRICE);
    if (known) return; // Classified separately, including shipping and mixed labels.
    // The currency symbol and digits can be in different sibling spans.
    for (let depth = 0; element && depth < 3; depth++, element = element.parentElement) {
      const text = element.textContent;
      if (text.length > 180 || element.matches('a:has(img),article,main,body,html') || element.querySelector('img,input,select,button')) return;
      if (!MONEY.test(text)) continue;
      if (inProduct(element)) {
        markAmounts(element, [...text.matchAll(new RegExp(MONEY.source, 'gi'))]);
      }
      return;
    }
  }

  function markAmounts(container, matches) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const targets = new Set();
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const end = offset + node.length;
      if (node.textContent.trim() && matches.some((match) => offset < match.index + match[0].length && end > match.index)) {
        if (!excluded(node.parentElement)) {
          if ((node.parentElement === container && container.children.length) || OTHER_AMOUNT.test(node.textContent) || node.textContent.includes('%')) {
            for (const match of matches) {
              const start = Math.max(0, match.index - offset);
              const finish = Math.min(node.length, match.index + match[0].length - offset);
              if (start < finish) maskTextRange(node, start, finish);
            }
          } else {
            targets.add(node.parentElement);
          }
        }
      }
      offset = end;
    }
    for (const element of targets) element.setAttribute('data-sorpresa-price', '');
  }

  function maskTextRange(node, start, end) {
    for (const [range, owner] of maskedRanges) {
      if (owner === node && range.startOffset === start && range.endOffset === end) return;
    }
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    highlights.add(range);
    maskedRanges.set(range, node);
    node.parentElement.setAttribute('data-sorpresa-text', '');
  }

  function scan(root) {
    if (!enabled || !root?.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) {
      root = root.parentElement;
    }
    if (root?.nodeType !== Node.ELEMENT_NODE) return;
    root = root?.closest?.('[data-sorpresa-price]') || root;
    if (SKIP.has(root.tagName)) return;
    for (const [range, node] of maskedRanges) {
      if (!node.isConnected || root.contains(node)) {
        highlights.delete(range);
        maskedRanges.delete(range);
      }
    }
    const marked = [...(root.matches?.('[data-sorpresa-price],[data-sorpresa-text]') ? [root] : []), ...root.querySelectorAll('[data-sorpresa-price],[data-sorpresa-text]')];
    for (const element of marked) {
      element.removeAttribute('data-sorpresa-price');
      element.removeAttribute('data-sorpresa-text');
    }
    const known = [...(root.matches?.(PRICE) ? [root] : []), ...root.querySelectorAll(PRICE)];
    for (const element of known) {
      const ignore = excluded(element) || Boolean(element.parentElement?.closest('[data-sorpresa-ignore]'));
      const mixed = element.textContent.includes('%') || OTHER_AMOUNT.test(element.textContent);
      element.toggleAttribute('data-sorpresa-ignore', ignore);
      element.toggleAttribute('data-sorpresa-preserve', ignore || mixed);
      if (!ignore && mixed) markAmounts(element, [...element.textContent.matchAll(new RegExp(MONEY.source, 'gi'))]);
    }
    if (root.closest(EXCLUDED)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return SKIP.has(node.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) markText(walker.currentNode);
  }

  function apply(value) {
    enabled = value !== false;
    document.documentElement?.setAttribute('data-sorpresa', enabled ? 'on' : 'off');
    if (enabled) scan(document.documentElement);
    else {
      highlights.clear();
      maskedRanges.clear();
    }
  }

  const observer = new MutationObserver((records) => {
    if (!enabled) return;
    const roots = new Set();
    for (const record of records) {
      const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      // Include currency siblings when just the numeric part of a price changes.
      if (element) roots.add(element.parentElement || element);
    }
    // MutationObserver runs before rendering. Avoid timers that expose a frame of prices.
    for (const root of roots) {
      let parent = root.parentNode;
      while (parent && !roots.has(parent)) parent = parent.parentNode;
      if (!parent) scan(root);
    }
  });
  observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'id', 'data-testid'] });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) apply(changes.enabled.newValue);
  });
  chrome.storage.local.get({ enabled: true }).then(({ enabled: value }) => apply(value)).catch(() => apply(true));
  document.addEventListener('DOMContentLoaded', () => apply(enabled), { once: true });
  window.addEventListener('pageshow', () => {
    chrome.storage.local.get({ enabled: true }).then(({ enabled: value }) => apply(value)).catch(() => {});
  });
})();
