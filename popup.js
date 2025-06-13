// popup.js
const btn = document.getElementById('go');
const apiKeyInput = document.getElementById('apiKey');
const providerSelect = document.getElementById('provider');
const modelSelect = document.getElementById('model');
const status = document.getElementById('status');
const filteringTabBtn = document.getElementById('filteringTabBtn');
const filtersTabBtn = document.getElementById('filtersTabBtn');
const adBlockTabBtn = document.getElementById('adBlockTabBtn');
const filteringTab = document.getElementById('filteringTab');
const filtersTab = document.getElementById('filtersTab');
const adBlockTab = document.getElementById('adBlockTab');
const toggleAdsBtn = document.getElementById('toggleAds');
const newFilterInput = document.getElementById('newFilter');
const addFilterBtn = document.getElementById('addFilter');
const filterList = document.getElementById('filterList');

const modelsByProvider = {
  grok: ['grok-3-latest'],
  gpt: ['gpt-3.5-turbo', 'gpt-4-turbo'],
  claude: ['claude-3-sonnet-20240229', 'claude-3-opus-20240229']
};

function showTab(which) {
  filteringTab.classList.remove('active');
  filtersTab.classList.remove('active');
  adBlockTab.classList.remove('active');
  filteringTabBtn.classList.remove('active');
  filtersTabBtn.classList.remove('active');
  adBlockTabBtn.classList.remove('active');
  if (which === 'ad') {
    adBlockTab.classList.add('active');
    adBlockTabBtn.classList.add('active');
  } else if (which === 'filters') {
    filtersTab.classList.add('active');
    filtersTabBtn.classList.add('active');
  } else {
    filteringTab.classList.add('active');
    filteringTabBtn.classList.add('active');
  }
}

filteringTabBtn.addEventListener('click', () => showTab('filter'));
filtersTabBtn.addEventListener('click', () => showTab('filters'));
adBlockTabBtn.addEventListener('click', () => showTab('ad'));

function populateModels(provider) {
  modelSelect.innerHTML = '';
  (modelsByProvider[provider] || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });
}

async function loadApiKey(provider) {
  const { apiKeys = {} } = await chrome.storage.local.get('apiKeys');
  apiKeyInput.value = apiKeys[provider] || '';
}

async function saveApiKey() {
  const provider = providerSelect.value;
  const { apiKeys = {} } = await chrome.storage.local.get('apiKeys');
  apiKeys[provider] = apiKeyInput.value.trim();
  await chrome.storage.local.set({ apiKeys });
}

apiKeyInput.addEventListener('input', saveApiKey);

async function saveProviderModel() {
  await chrome.storage.local.set({
    provider: providerSelect.value,
    model: modelSelect.value
  });
  loadApiKey(providerSelect.value);
}

providerSelect.addEventListener('change', () => {
  populateModels(providerSelect.value);
  saveProviderModel();
});

modelSelect.addEventListener('change', saveProviderModel);

toggleAdsBtn.addEventListener('click', async () => {
  let { filterAds } = await chrome.storage.local.get('filterAds');
  filterAds = !filterAds;
  await chrome.storage.local.set({ filterAds });
  toggleAdsBtn.textContent = filterAds ? 'Ad Filtering: On' : 'Ad Filtering: Off';
});

function renderFilters(filters) {
  filterList.innerHTML = '';
  filters.forEach((f, idx) => {
    const li = document.createElement('li');
    li.textContent = f;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.addEventListener('click', async () => {
      const { filters: arr = [] } = await chrome.storage.local.get('filters');
      arr.splice(idx, 1);
      await chrome.storage.local.set({ filters: arr });
      renderFilters(arr);
    });
    li.appendChild(btn);
    filterList.appendChild(li);
  });
}

addFilterBtn.addEventListener('click', async () => {
  const val = newFilterInput.value.trim();
  if (!val) return;
  const { filters = [] } = await chrome.storage.local.get('filters');
  filters.push(val);
  await chrome.storage.local.set({ filters });
  newFilterInput.value = '';
  renderFilters(filters);
});

async function updateUI() {
  const cfg = await chrome.storage.local.get([
    'checking',
    'provider',
    'model',
    'apiKeys',
    'filters',
    'filterAds'
  ]);

  const provider = cfg.provider || 'grok';
  const model = cfg.model || modelsByProvider[provider][0];
  providerSelect.value = provider;
  populateModels(provider);
  modelSelect.value = model;
  apiKeyInput.value = (cfg.apiKeys || {})[provider] || '';
  toggleAdsBtn.textContent = cfg.filterAds ? 'Ad Filtering: On' : 'Ad Filtering: Off';
  btn.textContent = cfg.checking ? 'Stop Checking' : 'Check Tweets';
  status.textContent = cfg.checking ? 'Checking tweets…' : '';
  renderFilters(cfg.filters || []);
}

updateUI();

btn.addEventListener('click', async () => {
  let { checking } = await chrome.storage.local.get('checking');
  checking = !checking;

  if (checking) {
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const { apiKeys = {}, filters = [] } = await chrome.storage.local.get([
      'apiKeys',
      'filters'
    ]);
    const key = apiKeys[provider];
    if (!filters.length) {
      status.textContent = 'Please add at least one filter.';
      return;
    }
    if (!key) {
      status.textContent = 'Please enter the API key.';
      return;
    }
    await chrome.storage.local.set({
      provider,
      model,
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
