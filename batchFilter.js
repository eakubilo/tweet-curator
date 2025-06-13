#!/usr/bin/env node
// batchFilter.js - filter tweets from a file using the same LLM calls

const fs = require('fs').promises;

const [,, filterPhrase, filePath] = process.argv;
if (!filterPhrase || !filePath) {
  console.error('Usage: node batchFilter.js "filter phrase" tweets.txt');
  process.exit(1);
}

const grokKey = process.env.GROK_KEY || '';
const gptKey = process.env.GPT_KEY || '';
const claudeKey = process.env.CLAUDE_KEY || '';
const models = (process.env.MODELS || 'grok').split(',').map(m => m.trim());

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

async function classify(text) {
  const prompt = `Does this tweet match the filter phrase "${filterPhrase}"?\nReply “Yes” or “No” only.\n\nTweet:\n"${text}"`;
  const calls = [];
  if (models.includes('grok') && grokKey) calls.push(callGrok(prompt));
  if (models.includes('gpt') && gptKey) calls.push(callGpt(prompt));
  if (models.includes('claude') && claudeKey) calls.push(callClaude(prompt));

  let summary = 'No';
  for (const c of calls) {
    try {
      summary = await c;
      if (/^yes$/i.test(summary)) break;
    } catch (e) {
      console.error('Model call failed', e);
    }
  }
  return summary;
}

async function main() {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const verdict = await classify(line);
    if (/^yes$/i.test(verdict)) {
      console.log(line);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
