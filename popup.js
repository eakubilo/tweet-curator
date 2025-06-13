// popup.js
const btn        = document.getElementById('go');
const input      = document.getElementById('filter');
const keyInput   = document.getElementById('grokKey');
const gptKeyInput    = document.getElementById('gptKey');
const claudeKeyInput = document.getElementById('claudeKey');
const status     = document.getElementById('status');
const filteringTabBtn = document.getElementById('filteringTabBtn');
const adBlockTabBtn   = document.getElementById('adBlockTabBtn');
const filteringTab    = document.getElementById('filteringTab');
const adBlockTab      = document.getElementById('adBlockTab');
const toggleAdsBtn    = document.getElementById('toggleAds');
const modelInputs = [...document.querySelectorAll('input[data-model]')];

function showTab(which) {
  filteringTab.classList.remove('active');
  adBlockTab.classList.remove('active');
  filteringTabBtn.classList.remove('active');
  adBlockTabBtn.classList.remove('active');
  if (which === 'ad') {
    adBlockTab.classList.add('active');
    adBlockTabBtn.classList.add('active');
  } else {
    filteringTab.classList.add('active');
    filteringTabBtn.classList.add('active');
  }
}

filteringTabBtn.addEventListener('click', () => showTab('filter'));
adBlockTabBtn.addEventListener('click', () => showTab('ad'));

function getSelectedModels() {
  return modelInputs
    .filter(i => i.checked)
    .map(i => i.dataset.model);
}

function saveModels() {
  chrome.storage.local.set({ models: getSelectedModels() });
}

modelInputs.forEach(i => i.addEventListener('change', saveModels));

toggleAdsBtn.addEventListener('click', async () => {
  let { filterAds } = await chrome.storage.local.get('filterAds');
  filterAds = !filterAds;
  await chrome.storage.local.set({ filterAds });
  toggleAdsBtn.textContent = filterAds ? 'Ad Filtering: On' : 'Ad Filtering: Off';
});

async function updateUI() {
  const { checking, filter, grokKey, gptKey, claudeKey, filterAds, models } = await chrome.storage.local.get([
    'checking',
    'filter',
    'grokKey',
    'gptKey',
    'claudeKey',
    'filterAds',
    'models'
  ]);
  input.value = filter || '';
  keyInput.value = grokKey || '';
  gptKeyInput.value = gptKey || '';
  claudeKeyInput.value = claudeKey || '';
  btn.textContent = checking ? 'Stop Checking' : 'Check Tweets';
  status.textContent = checking ? 'Checking tweets…' : '';
  toggleAdsBtn.textContent = filterAds ? 'Ad Filtering: On' : 'Ad Filtering: Off';
  const m = new Set(models || []);
  modelInputs.forEach(i => {
    i.checked = m.has(i.dataset.model);
  });
}

updateUI();

btn.addEventListener('click', async () => {
  let { checking } = await chrome.storage.local.get('checking');
  checking = !checking;

  if (checking) {
    const filter = input.value.trim();
    const keys = {
      grok: keyInput.value.trim(),
      gpt: gptKeyInput.value.trim(),
      claude: claudeKeyInput.value.trim()
    };
    const models = getSelectedModels();
    if (!filter) {
      status.textContent = 'Please enter a filter phrase.';
      return;
    }
    if (!models.length) {
      status.textContent = 'Please select at least one model.';
      return;
    }
    for (const m of models) {
      if (!keys[m]) {
        status.textContent = 'Please enter a filter phrase and required API keys.';
        return;
      }
    }
    await chrome.storage.local.set({
      filter,
      grokKey: keys.grok,
      gptKey: keys.gpt,
      claudeKey: keys.claude,
      checking: true,
      models
    });
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
