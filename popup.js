// popup.js
const btn    = document.getElementById('go');
const input  = document.getElementById('filter');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  const filter = input.value.trim();
  if (!filter) {
    status.textContent = 'Please enter a filter phrase.';
    return;
  }

  btn.disabled    = true;
  status.textContent = 'Running…';

  // store filter for scraper.js
  await chrome.storage.local.set({ filter });

  // inject scraper into the current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['scraper.js']
  });

  // wait for done ping
  chrome.runtime.onMessage.addListener(function listener(msg, sender) {
    if (msg.done && sender.tab.id === tab.id) {
      status.textContent = 'Finished.';
      btn.disabled      = false;
      chrome.runtime.onMessage.removeListener(listener);
    }
  });
});
