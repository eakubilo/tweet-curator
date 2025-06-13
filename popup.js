// popup.js
const btn        = document.getElementById('go');
const input      = document.getElementById('filter');
const providerSelect = document.getElementById('provider');
const modelSelect    = document.getElementById('model');
const keyInput       = document.getElementById('apiKey');
const status     = document.getElementById('status');
const filteringTabBtn = document.getElementById('filteringTabBtn');
const adBlockTabBtn   = document.getElementById('adBlockTabBtn');
const filteringTab    = document.getElementById('filteringTab');
const adBlockTab      = document.getElementById('adBlockTab');
const toggleAdsBtn    = document.getElementById('toggleAds');

const PROVIDERS = {
  openai: ['gpt-3.5-turbo', 'gpt-4o'],
  anthropic: ['claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
  xai: ['grok-3-latest']
};

function updateModelOptions() {
  const provider = providerSelect.value;
  const models = PROVIDERS[provider] || [];
  modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
}

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

providerSelect.addEventListener('change', async () => {
  updateModelOptions();
  const { apiKeys } = await chrome.storage.local.get('apiKeys');
  keyInput.value = (apiKeys && apiKeys[providerSelect.value]) || '';
});


toggleAdsBtn.addEventListener('click', async () => {
  let { filterAds } = await chrome.storage.local.get('filterAds');
  filterAds = !filterAds;
  await chrome.storage.local.set({ filterAds });
  toggleAdsBtn.textContent = filterAds ? 'Ad Filtering: On' : 'Ad Filtering: Off';
});

async function updateUI() {
  const { checking, filter, provider, model, apiKeys, filterAds } = await chrome.storage.local.get([
    'checking',
    'filter',
    'provider',
    'model',
    'apiKeys',
    'filterAds'
  ]);
  input.value = filter || '';
  providerSelect.value = provider || 'openai';
  updateModelOptions();
  modelSelect.value = model || modelSelect.querySelector('option')?.value || '';
  keyInput.value = (apiKeys && apiKeys[providerSelect.value]) || '';
  btn.textContent = checking ? 'Stop Checking' : 'Check Tweets';
  status.textContent = checking ? 'Checking tweets…' : '';
  toggleAdsBtn.textContent = filterAds ? 'Ad Filtering: On' : 'Ad Filtering: Off';
}

updateUI();

btn.addEventListener('click', async () => {
  let { checking, apiKeys } = await chrome.storage.local.get(['checking', 'apiKeys']);
  checking = !checking;

  if (checking) {
    const filter = input.value.trim();
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const key = keyInput.value.trim();
    if (!filter || !key) {
      status.textContent = 'Please enter a filter phrase and API key.';
      return;
    }
    apiKeys = apiKeys || {};
    apiKeys[provider] = key;
    await chrome.storage.local.set({
      filter,
      provider,
      model,
      apiKeys,
      checking: true
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
