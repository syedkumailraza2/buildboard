const difficultyInput = document.getElementById('difficulty');
const generateBtn = document.getElementById('generate');
const loadingEl = document.getElementById('loader');
const resultEl = document.getElementById('result');

function showLoading(show){ loadingEl.hidden = !show }
function showResult(text){ 
    // Beautify response
    const ideaTitle = text.idea.title || "Project Idea";
    const description = text.idea.description || "No description provided.";
    const tags = text.idea.tags || ["Innovation", "Technology"];

    resultEl.innerHTML = `
      <h3 class="result-title">${ideaTitle}</h3>
      <p class="result-description">${description}</p>
      <div class="result-tags">
        ${tags.map(tag => `<span class="result-tag">${tag}</span>`).join("")}
      </div>
    `;
    resultEl.hidden = false; 
}

// Build the prompt to ask Gemini
function buildPrompt(difficulty) {
  return `You are BuildBoard — an AI that gives a single project idea based on difficulty level: ${difficulty}.
Return the response ONLY in JSON format:

{
  "idea": {
    "title": "AI-powered Fitness Coach",
    "description": "Create a virtual fitness coach app that analyzes user's movements using their phone camera and provides real-time feedback to improve form and prevent injuries.",
    "tags": ["AI", "Health", "Mobile App", "Beginner Friendly"]
  }
}`;
}

// helper: safely extract and parse JSON from model text
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // 1) strip leading/trailing triple backticks and optional "json" tag
  text = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // 2) find the first '{'
  const start = text.indexOf('{');
  if (start === -1) {
    // nothing that looks like JSON
    try { return JSON.parse(text); } catch { return null; }
  }

  // 3) scan forward to find the matching closing brace, respecting string escapes
  let depth = 0;
  let inString = false;
  let prev = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && prev !== '\\') inString = !inString;
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch (e) {
          // if parsing fails, break out to fallback below
          break;
        }
      }
    }
    prev = ch;
  }

  // fallback: try parsing the whole cleaned text
  try { return JSON.parse(text); } catch (e) { return null; }
}


// Recommended: call your server which proxies to Gemini (server sample included in repo)
async function callServer(prompt){
  // Replace with your deployed server URL
  const serverUrl = 'https://buildboard-ten.vercel.app/generate';
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

generateBtn.addEventListener('click', async () => {
  const difficulty = difficultyInput.value.trim() || 'easy';
  const prompt = buildPrompt(difficulty);
  if (typeof showLoading === 'function') showLoading(true);
  resultEl.hidden = true;

  try {
    const raw = await callServer(prompt); // server returns a string (AI text)
    // If server already returned an object, keep it
    const parsedFromServer = (typeof raw === 'object') ? raw : extractJSON(String(raw));

    if (!parsedFromServer) {
      // show raw text so user sees what went wrong
      resultEl.innerHTML = `<pre class="result-description" style="color:#b91c1c;">❌ AI returned invalid JSON — see raw output below:\n\n${escapeHtml(String(raw)).slice(0, 2000)}</pre>`;
      resultEl.hidden = false;
      return;
    }

    // If model returned wrapper { idea: {...} } then pass that, else adapt
    const ideaObj = parsedFromServer.idea ? parsedFromServer : { idea: parsedFromServer };

    showResult(ideaObj);

  } catch (err) {
    resultEl.innerHTML = `<p style="color:red;">⚠️ ${escapeHtml(err.message)}</p>`;
    resultEl.hidden = false;
  } finally {
    if (typeof showLoading === 'function') showLoading(false);
  }
});

// small utility to avoid injecting raw HTML (useful in error display)
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}