// popup.js
const btn      = document.getElementById('go');
const input    = document.getElementById('filter');
const keyInput = document.getElementById('grokKey');
const status   = document.getElementById('status');

async function updateUI() {
  const { checking, filter, grokKey } = await chrome.storage.local.get([
    'checking',
    'filter',
    'grokKey'
  ]);
  input.value = filter || '';
  keyInput.value = grokKey || '';
  btn.textContent = checking ? 'Stop Checking' : 'Check Tweets';
  status.textContent = checking ? 'Checking tweets…' : '';
}

updateUI();

btn.addEventListener('click', async () => {
  let { checking } = await chrome.storage.local.get('checking');
  checking = !checking;

  if (checking) {
    const filter = input.value.trim();
    const grokKey = keyInput.value.trim();
    if (!filter || !grokKey) {
      status.textContent = 'Please enter both a filter phrase and API key.';
      return;
    }
    await chrome.storage.local.set({ filter, grokKey, checking: true });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scraper.js']
    });
    status.textContent = 'Checking tweets…';
  } else {
    await chrome.storage.local.set({ checking: false });
    status.textContent = 'Paused.';
  }

  btn.textContent = checking ? 'Stop Checking' : 'Check Tweets';
});

