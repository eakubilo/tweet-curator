// bg.js
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg.grokPrompt) return;

  const API_URL  = 'https://api.x.ai/v1/chat/completions';
  const { grokKey, models } = await chrome.storage.local.get(['grokKey', 'models']);
  if (!models?.includes('grok')) return;
  if (!grokKey) {
    console.error('Grok API key not set.');
    return;
  }
  const GROK_KEY = grokKey;

  let summary = 'No';
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROK_KEY}`
      },
      body: JSON.stringify({
        model:       'grok-3-latest',
        messages: [
          { role: 'system', content: 'You are a binary classifier. Answer “Yes” or “No” ONLY.' },
          { role: 'user',   content: msg.grokPrompt }
        ],
        stream:      false,
        temperature: 0
      })
    });
    const j = await r.json();
    summary = j.choices?.[0]?.message?.content.trim() || 'No';
  } catch (e) {
    console.error('Grok call failed', e);
  }

  // reply back to the tab’s content script
  if (sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, {
      id:      msg.id,
      summary: summary
    });
  }
});
