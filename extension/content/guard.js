(() => {
  // Keep these known-price selectors aligned with guard.css for first-paint masking.
  const PRICE_SELECTORS = [
    '.a-price', '.a-text-price', '.priceToPay', '.sc-product-price',
    '[data-a-selector="price"]', '[itemprop="price"]',
    '[data-testid="product-price"]', '[data-testid="price"]', '[id^="priceblock_"]',
  ].join(',');
  const PRODUCT_SELECTORS = [
    '[data-asin]', 'article', '[data-testid*="product"]', '[data-testid*="pdp"]',
    '[itemtype*="Product"]', '#dp', '#ppd', '#centerCol', '#rightCol', '#buybox',
  ].join(',');
  const EXCLUDED_SELECTORS = [
    'script', 'style', 'noscript', 'template', 'textarea', 'input', 'select',
    'nav', 'footer', '[role="banner"]', '[contenteditable="true"]', '#nav-main', '#nav-belt',
    '#sc-subtotal-amount-activecart', '#sc-subtotal-amount-buybox', '#subtotals-marketplace-table',
    '[data-testid*="subtotal"]', '[data-testid*="shipping"]', '[data-testid*="delivery"]',
    '[data-testid*="order-total"]', '[id*="delivery" i]', '[id*="shipping" i]',
  ].join(',');
  const NUMBER_PATTERN = '(?:\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
  const MONEY_PATTERN = new RegExp(`(?:€|EUR|£|\\$)\\s*${NUMBER_PATTERN}|${NUMBER_PATTERN}\\s*(?:€|EUR|£|\\$)`, 'i');
  const NON_PRODUCT_LABEL = /\b(?:spedizion\w*|consegna|delivery|shipping|totale|totali|total|subtotal|subtotale|ordini|orders)\b/i;
  const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
  const highlights = new Highlight();
  const maskedRanges = new Map();
  CSS.highlights.set('sorpresa-prices', highlights);
  let enabled = true;

  function isExcluded(element) {
    if (element.closest(EXCLUDED_SELECTORS)) return true;
    const firstAmount = element.textContent.match(MONEY_PATTERN);
    if (firstAmount && NON_PRODUCT_LABEL.test(element.textContent.slice(0, firstAmount.index))) return true;
    // A label belongs to the following amount. A delivery label AFTER a product
    // price must never exempt that price, even when both share a paragraph.
    let current = element;
    for (let depth = 0; current && depth < 3; depth++, current = current.parentElement) {
      let previous = current.previousSibling;
      while (previous && !previous.textContent?.trim()) previous = previous.previousSibling;
      if (previous) return previous.textContent.length < 100 && NON_PRODUCT_LABEL.test(previous.textContent) && !MONEY_PATTERN.test(previous.textContent);
      if (current.parentElement?.children.length !== 1) break;
    }
    return false;
  }

  function isProductContext(element) {
    const detailPage = /(^|\.)amazon\.it$/.test(location.hostname)
      ? /\/(?:dp|gp\/product)\/[a-z0-9]{10}(?:\/|$)/i.test(location.pathname)
      : /^\/[\w-]+-[\w]+-[\w]+\.html$/.test(location.pathname);
    // Detail-page prices also occur in sticky bars and dialogs mounted outside
    // main/#dp. Shipping and order totals still pass through isExcluded().
    return Boolean(element.closest(PRODUCT_SELECTORS)) || (detailPage && Boolean(element.closest('body')));
  }

  function maskUnclassifiedPrice(node) {
    if (!/[€£$]|EUR/i.test(node.textContent)) return;
    let element = node.parentElement;
    if (!element || isExcluded(element)) return;
    // Known price wrappers are classified separately, including shipping and mixed labels.
    if (element.closest(PRICE_SELECTORS)) return;
    // The currency symbol and digits can be in different sibling spans.
    for (let depth = 0; element && depth < 3; depth++, element = element.parentElement) {
      const text = element.textContent;
      if (text.length > 180 || element.matches('a:has(img),article,main,body,html') || element.querySelector('img,input,select,button')) return;
      if (!MONEY_PATTERN.test(text)) continue;
      if (isProductContext(element)) {
        maskAmounts(element);
      }
      return;
    }
  }

  function maskAmounts(container) {
    const matches = [...container.textContent.matchAll(new RegExp(MONEY_PATTERN.source, 'gi'))];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const targets = new Set();
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeStart = offset;
      offset += node.length;
      const overlapsPrice = matches.some((match) => nodeStart < match.index + match[0].length && offset > match.index);
      if (!node.textContent.trim() || !overlapsPrice || isExcluded(node.parentElement)) continue;

      const mixedText = (node.parentElement === container && container.children.length)
        || NON_PRODUCT_LABEL.test(node.textContent) || node.textContent.includes('%');
      if (!mixedText) {
        targets.add(node.parentElement);
        continue;
      }
      for (const match of matches) {
        const start = Math.max(0, match.index - nodeStart);
        const end = Math.min(node.length, match.index + match[0].length - nodeStart);
        if (start < end) maskTextRange(node, start, end);
      }
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

  function selfAndDescendants(root, selector) {
    const descendants = [...root.querySelectorAll(selector)];
    return root.matches(selector) ? [root, ...descendants] : descendants;
  }

  function clearMasks(root) {
    for (const [range, node] of maskedRanges) {
      if (!node.isConnected || root.contains(node)) {
        highlights.delete(range);
        maskedRanges.delete(range);
      }
    }
    for (const element of selfAndDescendants(root, '[data-sorpresa-price],[data-sorpresa-text]')) {
      element.removeAttribute('data-sorpresa-price');
      element.removeAttribute('data-sorpresa-text');
    }
  }

  function classifyKnownPrices(root) {
    for (const element of selfAndDescendants(root, PRICE_SELECTORS)) {
      const ignore = isExcluded(element) || Boolean(element.parentElement?.closest('[data-sorpresa-ignore]'));
      const mixed = element.textContent.includes('%') || NON_PRODUCT_LABEL.test(element.textContent);
      element.toggleAttribute('data-sorpresa-ignore', ignore);
      element.toggleAttribute('data-sorpresa-preserve', ignore || mixed);
      if (!ignore && mixed) maskAmounts(element);
    }
  }

  function scan(root) {
    if (!enabled || !root?.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (root?.nodeType !== Node.ELEMENT_NODE) return;
    root = root.closest('[data-sorpresa-price]') || root;
    if (SKIPPED_TAGS.has(root.tagName)) return;

    clearMasks(root);
    classifyKnownPrices(root);
    if (root.closest(EXCLUDED_SELECTORS)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return SKIPPED_TAGS.has(node.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) maskUnclassifiedPrice(walker.currentNode);
  }

  function setEnabled(value) {
    enabled = value !== false;
    document.documentElement?.setAttribute('data-sorpresa', enabled ? 'on' : 'off');
    if (enabled) scan(document.documentElement);
    else {
      highlights.clear();
      maskedRanges.clear();
    }
  }

  function scanMutations(records) {
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
  }

  const observer = new MutationObserver(scanMutations);
  observer.observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'id', 'data-testid'],
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) setEnabled(changes.enabled.newValue);
  });
  chrome.storage.local.get({ enabled: true }).then(({ enabled: value }) => setEnabled(value)).catch(() => setEnabled(true));
  document.addEventListener('DOMContentLoaded', () => setEnabled(enabled), { once: true });
  window.addEventListener('pageshow', () => {
    chrome.storage.local.get({ enabled: true }).then(({ enabled: value }) => setEnabled(value)).catch(() => {});
  });
})();
