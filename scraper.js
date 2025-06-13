// scraper.js
(function () {
  const CHECKED_ATTR = 'data-tc-checked';
  let observer;
  let filters = [];
  let apiKeys = {};
  let provider = 'grok';
  let model = 'grok-3-latest';
  let filterAds = true;

  async function loadConfig() {
    const cfg = await chrome.storage.local.get([
      'filters',
      'apiKeys',
      'provider',
      'model',
      'filterAds'
    ]);
    filters = cfg.filters || [];
    apiKeys = cfg.apiKeys || {};
    provider = cfg.provider || 'grok';
    model = cfg.model || 'grok-3-latest';
    filterAds = cfg.filterAds !== false;
  }

  const BATCH_SIZE = 5;
  const queue = [];
  const cellMap = new Map();
  let sending = false;

  async function maybeSendBatch(force = false) {
    if (sending) return;
    if (!force && queue.length < BATCH_SIZE) return;
    if (queue.length === 0) return;
    sending = true;
    const batch = queue.splice(0, BATCH_SIZE);
    const ids = batch.map(b => b.id);
    const tweets = batch.map(b => b.text);
    chrome.runtime.sendMessage({ tweets, ids, filters });
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (Array.isArray(msg.ids) && Array.isArray(msg.summaries)) {
      msg.ids.forEach((id, idx) => {
        const cell = cellMap.get(id);
        if (!cell) return;
        const verdict = (msg.summaries[idx] || '').trim();
        if (/^no$/i.test(verdict)) {
          cell.style.height = '0px';
          cell.style.overflow = 'hidden';
        }
        cellMap.delete(id);
      });
      sending = false;
      maybeSendBatch(true);
    }
  });

  function processCell(cell) {
    if (cell.hasAttribute(CHECKED_ATTR)) return;
    cell.setAttribute(CHECKED_ATTR, 'true');

    // stop at “Discover more”
    if ([...cell.querySelectorAll('span.css-1jxf684')]
          .some(s => s.textContent.trim() === 'Discover more')) {
      stop();
      return;
    }
    // hide ads
    if (filterAds && [...cell.querySelectorAll('span.css-1jxf684')]
          .some(s => s.textContent.trim() === 'Ad')) {
      cell.style.height   = '0px';
      cell.style.overflow = 'hidden';
      return;
    }
    if (!filters.length) return;
    if (!apiKeys[provider]) return;

    const textNode = cell.querySelector('[data-testid="tweetText"]');
    if (!textNode) return;
    const text = textNode.innerText.trim();
    if (!text) return;

    const id = crypto.randomUUID();
    queue.push({ id, text });
    cellMap.set(id, cell);
    maybeSendBatch();
  }

  async function scan() {
    await loadConfig();
    const cells = [...document.querySelectorAll('[data-testid="cellInnerDiv"]')];
    for (const c of cells) {
      processCell(c);
    }
    maybeSendBatch(true);
  }

  function start() {
    if (observer) return;
    scan();
    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if ('checking' in changes) {
        changes.checking.newValue ? start() : stop();
      }
      if (
        'filters' in changes ||
        'apiKeys' in changes ||
        'provider' in changes ||
        'model' in changes ||
        'filterAds' in changes
      ) {
        loadConfig();
      }
    }
  });

  chrome.storage.local.get('checking').then(({ checking }) => {
    if (checking) start();
  });
})();
