// scraper.js
(function () {
  const CHECKED_ATTR = 'data-tc-checked';
  let observer;
  let filter = '';
  let grokKey = '';

  async function loadConfig() {
    const cfg = await chrome.storage.local.get(['filter', 'grokKey']);
    filter = cfg.filter || '';
    grokKey = cfg.grokKey || '';
  }

  async function processCell(cell) {
    if (cell.hasAttribute(CHECKED_ATTR)) return;
    cell.setAttribute(CHECKED_ATTR, 'true');

    // stop at “Discover more”
    if ([...cell.querySelectorAll('span.css-1jxf684')]
          .some(s => s.textContent.trim() === 'Discover more')) {
      stop();
      return;
    }
    // skip ads
    if ([...cell.querySelectorAll('span.css-1jxf684')]
          .some(s => s.textContent.trim() === 'Ad')) {
      return;
    }

    const textNode = cell.querySelector('[data-testid="tweetText"]');
    if (!textNode) return;
    const text = textNode.innerText.trim();
    if (!text) return;

    const prompt = `
Does this tweet match the filter phrase "${filter}"?
Reply “Yes” or “No” only.

Tweet:
"${text}"
`.trim();

    const id = crypto.randomUUID();
    chrome.runtime.sendMessage({ grokPrompt: prompt, id });

    const verdict = await new Promise(res => {
      chrome.runtime.onMessage.addListener(function cb(msg) {
        if (msg.id === id) {
          chrome.runtime.onMessage.removeListener(cb);
          res((msg.summary || '').trim());
        }
      });
    });

    if (/^no$/i.test(verdict)) {
      cell.style.height   = '0px';
      cell.style.overflow = 'hidden';
    }
  }

  async function scan() {
    await loadConfig();
    if (!filter || !grokKey) return;
    const cells = [...document.querySelectorAll('[data-testid="cellInnerDiv"]')];
    for (const c of cells) {
      await processCell(c);
    }
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
      if ('filter' in changes || 'grokKey' in changes) {
        loadConfig();
      }
    }
  });

  chrome.storage.local.get('checking').then(({ checking }) => {
    if (checking) start();
  });
})();
