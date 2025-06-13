// bg.js
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg.prompt) return;

  const { grokKey, gptKey, claudeKey, models } = await chrome.storage.local.get([
    'grokKey',
    'gptKey',
    'claudeKey',
    'models'
  ]);

  async function callGrok() {
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
          { role: 'user', content: msg.prompt }
        ],
        stream: false,
        temperature: 0
      })
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content.trim() || 'No';
  }

  async function callGpt() {
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
          { role: 'user', content: msg.prompt }
        ],
        temperature: 0
      })
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content.trim() || 'No';
  }

  async function callClaude() {
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
          { role: 'user', content: msg.prompt }
        ],
        temperature: 0
      })
    });
    const j = await r.json();
    return j.content?.[0]?.text?.trim() || 'No';
  }

  const calls = [];
  if (models?.includes('grok') && grokKey) calls.push(callGrok());
  if (models?.includes('gpt') && gptKey) calls.push(callGpt());
  if (models?.includes('claude') && claudeKey) calls.push(callClaude());

  let summary = 'No';
  for (const c of calls) {
    try {
      summary = await c;
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
});
