// bg.js
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg.prompt && !Array.isArray(msg.tweets)) return;

  const { apiKeys = {}, provider = 'grok', model = 'grok-3' } = await chrome.storage.local.get([
    'apiKeys',
    'provider',
    'model'
  ]);

  let prompt = msg.prompt;
  const isBatch = Array.isArray(msg.tweets);
  const tweets = msg.tweets || [];
  if (isBatch) {
    const filtersText = (msg.filters || []).map((f, i) => `${i + 1}. "${f}"`).join('\n');
    prompt = [
      'Filter phrases:',
      filtersText,
      'For each tweet below, reply "Yes" if it matches ANY filter phrase, otherwise "No".',
      'Provide one answer per line in the same order.',
      '',
      tweets.map((t, i) => `Tweet ${i + 1}: ${t}`).join('\n')
    ].join('\n');
  }

  async function callGrok(key, model, prompt) {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a binary classifier. Answer “Yes” or “No” ONLY.' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0
      })
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content.trim() || 'No';
  }

  async function callGpt(key, model, prompt) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a binary classifier. Answer “Yes” or “No” ONLY.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0
      })
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content.trim() || 'No';
  }

  async function callClaude(key, model, prompt) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        system: 'You are a binary classifier. Answer “Yes” or “No” ONLY.',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0
      })
    });
    const j = await r.json();
    return j.content?.[0]?.text?.trim() || 'No';
  }

  let response = 'No';
  try {
    if (provider === 'grok' && apiKeys.grok) {
      response = await callGrok(apiKeys.grok, model, prompt);
    } else if (provider === 'gpt' && apiKeys.gpt) {
      response = await callGpt(apiKeys.gpt, model, prompt);
    } else if (provider === 'claude' && apiKeys.claude) {
      response = await callClaude(apiKeys.claude, model, prompt);
    }
  } catch (e) {
    console.error('Model call failed', e);
  }

  if (!isBatch) {
    let summary = response;

    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        id: msg.id,
        summary
      });
    }
  } else {
    const arr = response
      .split(/\r?\n|,/)
      .map(s => s.trim())
      .filter(Boolean);
    let summaries = Array(tweets.length).fill('No');
    for (let i = 0; i < summaries.length; i++) {
      if (/^yes$/i.test(arr[i] || 'No')) summaries[i] = 'Yes';
    }

    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        ids: msg.ids,
        summaries
      });
    }
  }
});
