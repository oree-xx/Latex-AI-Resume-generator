import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Flash models are fast and cheap and totally sufficient for rewriting a
// paragraph into bullets. (The 1.5 and 2.0 lines have no free-tier quota on new
// keys; the 2.5 'lite' model is the current low-latency free-tier default.)
const MODEL = 'gemini-2.5-flash-lite';

const SYSTEM_INSTRUCTION = `You rewrite raw student notes into strong resume bullet points.

Rules:
- Output 2 to 4 bullets per answer, one per line.
- Each bullet starts with a strong past-tense action verb (Built, Led, Designed, Reduced, Increased, Coordinated, Analyzed, Created, Implemented, etc.).
- Quantify impact when the student mentions numbers or scope; do not invent statistics.
- Keep each bullet under ~25 words.
- No first-person pronouns ("I", "me", "my").
- No headers, no labels, no introductions — only the bullets themselves.
- Prefix every bullet with "- " (dash, space).
- If the input is genuinely empty or off-topic, return a single bullet that summarizes what the student said as-is.`;

export async function polishHandler(req, res, next) {
  try {
    const { rawText, kind, context } = req.body || {};
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).send("Missing 'rawText'.");
    }

    // No API key? Pass through as a single bullet so the app still works.
    if (!client) {
      return res.json({ bullets: [rawText.trim()], polished: false });
    }

    const prompt = [
      `Context: ${kind || 'experience'} entry. ${context || ''}`.trim(),
      ``,
      `Student wrote:`,
      `"""${rawText.trim()}"""`,
      ``,
      `Rewrite as resume bullets.`,
    ].join('\n');

    const model = client.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const bullets = parseBullets(text);
    res.json({ bullets, polished: true });
  } catch (err) {
    next(err);
  }
}

function parseBullets(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const bullets = [];
  for (const line of lines) {
    // Accept any leading bullet character or numbered list.
    const cleaned = line.replace(/^[-*•·]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
    if (cleaned) bullets.push(cleaned);
  }
  // Cap at 4 bullets just in case.
  return bullets.slice(0, 4);
}
