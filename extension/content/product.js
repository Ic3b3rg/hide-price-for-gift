(() => {
  // Only the extension can request this; no page scripts or window messages are used.
  if (window.top !== window) return;
  const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const meta = (property) => document.querySelector(`meta[property="${property}"]`)?.content;

  function extract() {
    const isAmazon = /(^|\.)amazon\.it$/.test(location.hostname);
    if (isAmazon ? !/\/(?:dp|gp\/product)\/[a-z0-9]{10}(?:\/|$)/i.test(location.pathname) : !/\.html$/.test(location.pathname)) {
      throw new Error('Apri la pagina di un singolo prodotto per salvarlo.');
    }
    const zalandoTitle = [text('[data-testid="product_title-brand-name"]'), text('[data-testid="product_title-product-name"]')].filter(Boolean).join(' ');
    const title = (isAmazon ? text('#productTitle') : zalandoTitle || text('h1')) || meta('og:title') || document.title;
    const image = isAmazon
      ? document.querySelector('#landingImage, #imgBlkFront, #main-image')
      : document.querySelector('[data-testid*="gallery"] img, main img');
    return {
      url: location.href,
      title: title.replace(/\s*[-|:]?\s*(?:Amazon|Zalando)\.it.*$/i, '').trim(),
      imageUrl: (isAmazon ? image?.currentSrc || image?.src : meta('og:image')) || image?.currentSrc || image?.src || meta('og:image') || '',
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'GET_PRODUCT') return;
    try {
      sendResponse({ ok: true, product: extract() });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  });
})();
