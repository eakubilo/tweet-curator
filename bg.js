// bg.js
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg.prompt) return;

  const { provider, model, apiKeys } = await chrome.storage.local.get([
    'provider',
    'model',
    'apiKeys'
  ]);
  const apiKey = apiKeys?.[provider];

  async function callProvider() {
    if (!apiKey) return 'No';
    if (provider === 'xai') {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
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
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
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
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
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
    return 'No';
  }

  let summary = 'No';
  try {
    summary = await callProvider();
  } catch (e) {
    console.error('Model call failed', e);
  }

  if (sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, {
      id: msg.id,
      summary
    });
  }
});
