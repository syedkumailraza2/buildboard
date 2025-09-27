# BuildBoard Chrome Extension

A simple Chrome extension (Manifest V3) that opens a popup where the user enters a single parameter `difficulty` and receives a project idea/problem statement fetched from Gemini. The extension supports two integration patterns:

1. **Prototyping (client-side API key)** — quick prototype where you paste a Gemini API key into the popup. *Not recommended for production* because it exposes your key.
2. **Production (server proxy)** — recommended: run a small server that holds your Gemini API key and proxy requests from the extension to Gemini.

---

## Files

### `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "BuildBoard",
  "version": "1.0",
  "description": "Get project ideas (web, CLI, chrome extension, VS Code extension, tools, etc.) based on a difficulty parameter using Gemini.",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "BuildBoard"
  }
}
```

### `popup.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>BuildBoard</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div class="container">
      <h1>BuildBoard</h1>
      <label for="difficulty">Difficulty (e.g. easy, medium, hard, expert)</label>
      <input id="difficulty" placeholder="easy / medium / hard / expert" />

      <div class="row">
        <label for="apiKey">Gemini API Key (optional for prototyping)</label>
        <input id="apiKey" placeholder="Paste API key (for prototype)" />
      </div>

      <div class="row buttons">
        <button id="generate">Generate Idea</button>
        <button id="useServer">Use server (recommended)</button>
      </div>

      <div id="loading" hidden>Generating…</div>
      <div id="result" class="result" hidden></div>
      <div class="note">Tip: For production, run the provided server proxy and click "Use server".</div>
    </div>

    <script src="popup.js"></script>
  </body>
</html>
```

### `popup.css`

```css
:root{font-family:Inter,system-ui,Segoe UI,Roboto,Arial}
body{margin:0;padding:12px;width:360px}
.container{display:flex;flex-direction:column;gap:8px}
input{padding:8px;border-radius:6px;border:1px solid #ddd;width:100%}
button{padding:8px;border-radius:6px;border:none;cursor:pointer}
.row{display:flex;flex-direction:column}
.buttons{display:flex;gap:8px}
.result{white-space:pre-wrap;border:1px solid #eee;padding:10px;border-radius:6px;background:#fafafa}
.note{font-size:12px;color:#666}
```

### `popup.js`

```javascript
const difficultyInput = document.getElementById('difficulty');
const apiKeyInput = document.getElementById('apiKey');
const generateBtn = document.getElementById('generate');
const useServerBtn = document.getElementById('useServer');
const loadingEl = document.getElementById('loading');
const resultEl = document.getElementById('result');

function showLoading(show){ loadingEl.hidden = !show }
function showResult(text){ resultEl.hidden = false; resultEl.textContent = text }

// Build the prompt to ask Gemini
function buildPrompt(difficulty){
  return `You are BuildBoard — an AI that gives a single project idea with a clear problem statement and a short description of how to build it. The project can be any category (web app, mobile app, CLI tool, chrome extension, VS Code extension, desktop app, embedded, data science project, etc.).

Respond with:
- Title (one sentence)
- One-line category tag
- Problem statement (2-3 sentences)
- Short implementation outline (3-6 bullet points)
- Suggested tech stack (brief)

Difficulty: ${difficulty}

Give only the content in plain text.`
}

// Client-side prototyping call (not for production)
async function callGeminiClient(apiKey, prompt){
  // NOTE: This endpoint and path follow Google's Gen AI patterns for prototyping web apps.
  // For production use, proxy via server. See README in the package.
  const url = 'https://api.generativeai.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);

  const body = {
    "text": prompt
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if(!res.ok){
    const text = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${text}`);
  }
  const data = await res.json();
  // Structure differs by API version; try to extract a likely text field
  const text = (data?.candidates?.[0]?.output || data?.outputs?.[0]?.content || data?.text || JSON.stringify(data, null, 2));
  return text;
}

// Recommended: call your server which proxies to Gemini (server sample included in repo)
async function callServer(prompt){
  // Replace with your deployed server URL
  const serverUrl = 'http://localhost:3000/generate';
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ prompt })
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error('Server error: ' + t);
  }
  const j = await res.json();
  return j.text || j.output || JSON.stringify(j, null, 2);
}

generateBtn.addEventListener('click', async ()=>{
  const difficulty = difficultyInput.value.trim() || 'easy';
  const prompt = buildPrompt(difficulty);
  showLoading(true);
  resultEl.hidden = true;
  try{
    const apiKey = apiKeyInput.value.trim();
    let text;
    if(apiKey){
      text = await callGeminiClient(apiKey, prompt);
    } else {
      text = await callServer(prompt);
    }
    showResult(text);
  }catch(err){
    showResult('Error: ' + err.message);
  }finally{
    showLoading(false);
  }
});

useServerBtn.addEventListener('click', ()=>{
  apiKeyInput.value = ''; // encourage server usage
  alert('Make sure your proxy server is running (see README).');
});
```

### `server-sample/server.js` (Node/Express proxy)

```javascript
// WARNING: This server holds your Gemini API key. Keep it private.
// Run: npm init -y && npm i express node-fetch dotenv

const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();
app.use(express.json());

const GEMINI_KEY = process.env.GEMINI_API_KEY; // get from .env
if(!GEMINI_KEY) console.warn('Set GEMINI_API_KEY in .env');

app.post('/generate', async (req, res) =>{
  try{
    const { prompt } = req.body;
    if(!prompt) return res.status(400).json({error:'missing prompt'});

    const url = 'https://api.generativeai.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY;
    const body = { contents: [{ parts: [{ text: prompt }] }] };

    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await r.json();
    // Simplified extraction
    const text = data?.candidates?.[0]?.output || data?.outputs?.[0]?.content || JSON.stringify(data);
    res.json({ text });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, ()=> console.log('Server listening on http://localhost:3000'));
```

---

## README / Notes

- **Security:** Do not embed your Gemini API key in a public extension; users can inspect extension files and steal keys. Instead run the `server-sample` or use Firebase AI Logic / Cloud proxy in production.
- **Models & endpoints:** The exact model id and REST path may change; docs show `generateContent` and `streamGenerateContent` as the main endpoints and models like `gemini-2.5-flash` or `gemini-2.5-pro`. When prototyping you can create an API key from Google AI Studio. See official Gemini docs for exact request shapes.

---

## LICENSE

MIT


<!-- End of BuildBoard bundle -->
