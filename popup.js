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
const modelClaude     = document.getElementById('modelClaude');
const modelGpt        = document.getElementById('modelGpt');
const modelGrok       = document.getElementById('modelGrok');

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
  const models = [];
  if (modelClaude.checked) models.push('claude');
  if (modelGpt.checked)    models.push('gpt');
  if (modelGrok.checked)   models.push('grok');
  return models;
}

function saveModels() {
  chrome.storage.local.set({ models: getSelectedModels() });
}

modelClaude.addEventListener('change', saveModels);
modelGpt.addEventListener('change', saveModels);
modelGrok.addEventListener('change', saveModels);

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
  modelClaude.checked = m.has('claude');
  modelGpt.checked    = m.has('gpt');
  modelGrok.checked   = m.has('grok');
}

updateUI();

btn.addEventListener('click', async () => {
  let { checking } = await chrome.storage.local.get('checking');
  checking = !checking;

  if (checking) {
    const filter = input.value.trim();
    const grokKey = keyInput.value.trim();
    const gptKey = gptKeyInput.value.trim();
    const claudeKey = claudeKeyInput.value.trim();
    const models = getSelectedModels();
    if (!filter ||
        (models.includes('grok') && !grokKey) ||
        (models.includes('gpt') && !gptKey) ||
        (models.includes('claude') && !claudeKey)) {
      status.textContent = 'Please enter a filter phrase and required API keys.';
      return;
    }
    await chrome.storage.local.set({
      filter,
      grokKey,
      gptKey,
      claudeKey,
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
