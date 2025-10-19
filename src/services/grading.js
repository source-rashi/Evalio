const { scoreAnswer } = require('../utils/scoring');

function coerceScore(n, max = 5) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(max, Math.round(x)));
}

function buildPrompt(modelAnswer, studentAnswer, maxScore) {
  return `You are an exam evaluator. Compare the student answer to the model answer semantically and grade fairly.
Return ONLY strict JSON with keys: score (0-${maxScore}) and feedback (concise, one sentence).

model_answer: """
${modelAnswer}
"""

student_answer: """
${studentAnswer}
"""

Respond as:
{"score": <number 0-${maxScore}>, "feedback": "..."}`;
}

async function callOpenAI({ apiKey, model, modelAnswer, studentAnswer, maxScore }) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(modelAnswer, studentAnswer, maxScore);
  const resp = await client.chat.completions.create({
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You return only valid JSON. No prose.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });
  const text = resp.choices?.[0]?.message?.content || '{}';
  return text;
}

async function callGemini({ apiKey, model, modelAnswer, studentAnswer, maxScore }) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = model || process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const gModel = genAI.getGenerativeModel({ model: m });
  const prompt = buildPrompt(modelAnswer, studentAnswer, maxScore);
  const result = await gModel.generateContent(prompt);
  const text = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return text;
}

function parseJsonSafe(text) {
  try {
    // Extract JSON block if wrapped in code fences
    const match = String(text).match(/[\{\[][\s\S]*[\}\]]/);
    const json = JSON.parse(match ? match[0] : text);
    return json;
  } catch {
    return null;
  }
}

async function gradeAnswer({ modelAnswer, studentAnswer, maxScore = 5 }) {
  const provider = (process.env.AI_PROVIDER || 'none').toLowerCase();
  const openaiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Short-circuit on empty answer
  if (!studentAnswer || !studentAnswer.trim()) {
    return { score: 0, feedback: 'No answer provided', provider: 'none' };
  }

  try {
    let raw = null;
    if (provider === 'openai' && openaiKey) {
      raw = await callOpenAI({ apiKey: openaiKey, model: process.env.OPENAI_MODEL, modelAnswer, studentAnswer, maxScore });
      const parsed = parseJsonSafe(raw);
      if (parsed) {
        return {
          score: coerceScore(parsed.score, maxScore),
          feedback: String(parsed.feedback || '').slice(0, 500),
          provider: 'openai',
        };
      }
    } else if (provider === 'gemini' && geminiKey) {
      raw = await callGemini({ apiKey: geminiKey, model: process.env.GEMINI_MODEL, modelAnswer, studentAnswer, maxScore });
      const parsed = parseJsonSafe(raw);
      if (parsed) {
        return {
          score: coerceScore(parsed.score, maxScore),
          feedback: String(parsed.feedback || '').slice(0, 500),
          provider: 'gemini',
        };
      }
    }
  } catch (err) {
    // Swallow and fallback
    // console.error('AI grading error:', err.message);
  }

  // Fallback heuristic
  const h = scoreAnswer(modelAnswer || '', studentAnswer || '', maxScore);
  return { score: h.score, feedback: h.feedback + ' (heuristic)', provider: 'heuristic' };
}

module.exports = { gradeAnswer };
