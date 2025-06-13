// scraper.js
(async () => {
  // 1) pull in the filter phrase
  const { filter } = await new Promise(res =>
    chrome.storage.local.get('filter', res)
  );
  if (!filter) {
    console.warn('No filter set.');
    chrome.runtime.sendMessage({ done: true });
    return;
  }

  // walk each tweet cell
  const cells = [...document.querySelectorAll('[data-testid="cellInnerDiv"]')];
  for (const cell of cells) {
    // stop at “Discover more”
    if ([...cell.querySelectorAll('span.css-1jxf684')]
         .some(s => s.textContent.trim() === 'Discover more')) {
      break;
    }
    // skip ads
    if ([...cell.querySelectorAll('span.css-1jxf684')]
         .some(s => s.textContent.trim() === 'Ad')) {
      continue;
    }

    // get its text node
    const textNode = cell.querySelector('[data-testid="tweetText"]');
    if (!textNode) continue;
    const text = textNode.innerText.trim();

    // build the Grok prompt
    const prompt = `
Does this tweet match the filter phrase "${filter}"?
Reply “Yes” or “No” only.

Tweet:
"${text}"
`.trim();

    // send to Grok via bg.js
    const id = crypto.randomUUID();
    chrome.runtime.sendMessage({ grokPrompt: prompt, id });

    // await verdict
    const verdict = await new Promise(res => {
      chrome.runtime.onMessage.addListener(function cb(msg) {
        if (msg.id === id) {
          chrome.runtime.onMessage.removeListener(cb);
          res((msg.summary || '').trim());
        }
      });
    });

    // if it’s a “No”, collapse the tweet
    if (/^no$/i.test(verdict)) {
      cell.style.height   = '0px';
      cell.style.overflow = 'hidden';
    }
  }

  // signal done
  chrome.runtime.sendMessage({ done: true });
})();
