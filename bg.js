// bg.js
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg.prompt && !Array.isArray(msg.tweets)) return;

  const { grokKey, gptKey, claudeKey, models } = await chrome.storage.local.get([
    'grokKey',
    'gptKey',
    'claudeKey',
    'models'
  ]);

  let prompt = msg.prompt;
  const isBatch = Array.isArray(msg.tweets);
  const tweets = msg.tweets || [];
  if (isBatch) {
    prompt = [
      `Filter phrase: "${msg.filter}"`,
      'For each tweet below, reply "Yes" if it matches, otherwise "No".',
      'Provide one answer per line in the same order.',
      '',
      tweets.map((t, i) => `Tweet ${i + 1}: ${t}`).join('\n')
    ].join('\n');
  }

  async function callGrok(prompt) {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
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

  async function callGpt(prompt) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gptKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
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

  async function callClaude(prompt) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
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

  const calls = [];
  if (models?.includes('grok') && grokKey) calls.push(() => callGrok(prompt));
  if (models?.includes('gpt') && gptKey) calls.push(() => callGpt(prompt));
  if (models?.includes('claude') && claudeKey) calls.push(() => callClaude(prompt));

  if (!isBatch) {
    let summary = 'No';
    for (const fn of calls) {
      try {
        summary = await fn();
        if (/^yes$/i.test(summary)) break;
      } catch (e) {
        console.error('Model call failed', e);
      }
    }

    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        id: msg.id,
        summary
      });
    }
  } else {
    let summaries = Array(tweets.length).fill('No');
    for (const fn of calls) {
      try {
        const res = await fn();
        const arr = res.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < summaries.length; i++) {
          if (summaries[i] !== 'Yes' && /^yes$/i.test(arr[i] || 'No')) {
            summaries[i] = 'Yes';
          }
        }
        if (summaries.every(s => s === 'Yes')) break;
      } catch (e) {
        console.error('Model call failed', e);
      }
    }

    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        ids: msg.ids,
        summaries
      });
    }
  }
});
