import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(
  cors({
    origin: '*', // Replace '*' with your frontend URL for security
  })
);
app.use(express.json());

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) console.warn('⚠️ Set GEMINI_API_KEY in .env');

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'missing prompt' });

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const body = { contents: [{ parts: [{ text: prompt }] }] };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      JSON.stringify(data);

    res.json({ text });
  } catch (e) {
    console.error('❌ Error in /generate:', e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () =>
  console.log('✅ Server listening on http://localhost:3000')
);
