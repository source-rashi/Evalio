const { scoreAnswer } = require('../utils/scoring');

function coerceScore(n, max = 5) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(max, Math.round(x)));
}

function buildPrompt(modelAnswer, studentAnswer, maxScore, keypoints) {
  const hasKP = Array.isArray(keypoints) && keypoints.length > 0;
  const kpText = hasKP
    ? `rubric_keypoints_with_weights (use to allocate partial credit proportionally; total weight may or may not sum to 1):\n${JSON.stringify(
        keypoints.map(k => ({ text: String(k.text || ''), weight: Number(k.weight || 1) })),
        null,
        2
      )}`
    : 'no_explicit_keypoints_provided: use model answer semantics';
  return `You are an exam evaluator. Grade based on semantic correctness and the rubric.
Return ONLY strict JSON with keys: score (0-${maxScore}) and feedback (concise, one sentence).

Grading rules:
- Respect the maximum score (${maxScore}).
- ${hasKP ? 'Use keypoints and their weights to allocate partial credit proportionally.' : 'If no keypoints, compare with model answer semantically.'}
- Penalize hallucinations or irrelevant content.

model_answer: """
${modelAnswer}
"""

${kpText}

student_answer: """
${studentAnswer}
"""

Respond as:
{"score": <number 0-${maxScore}>, "feedback": "..."}`;
}

async function callOpenAI({ apiKey, model, modelAnswer, studentAnswer, maxScore, keypoints }) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(modelAnswer, studentAnswer, maxScore, keypoints);
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

async function callGemini({ apiKey, model, modelAnswer, studentAnswer, maxScore, keypoints }) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = model || process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const gModel = genAI.getGenerativeModel({ model: m });
  const prompt = buildPrompt(modelAnswer, studentAnswer, maxScore, keypoints);
  const result = await gModel.generateContent(prompt);
  const text = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return text;
}

function parseJsonSafe(text) {
  try {
    // Extract JSON block if wrapped in code fences
  const match = String(text).match(/(?:\{|\[)[\s\S]*(?:\}|\])/); // matches JSON-like block
    const json = JSON.parse(match ? match[0] : text);
    return json;
  } catch {
    return null;
  }
}

function wtokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function weightedHeuristic(modelAnswer, studentAnswer, keypoints, maxScore = 5) {
  const sTokens = new Set(wtokenize(studentAnswer));
  const kps = Array.isArray(keypoints) ? keypoints : [];
  if (!kps.length) return scoreAnswer(modelAnswer || '', studentAnswer || '', maxScore);
  let totalW = 0;
  let gotW = 0;
  for (const kp of kps) {
    const w = Number(kp.weight || 1);
    totalW += w;
    const kpTokens = new Set(wtokenize(kp.text || ''));
    // Simple overlap heuristic: any shared token gives the credit for that keypoint
    const overlap = [...kpTokens].some(t => sTokens.has(t));
    if (overlap) gotW += w;
  }
  if (totalW <= 0) return scoreAnswer(modelAnswer || '', studentAnswer || '', maxScore);
  const coverage = Math.max(0, Math.min(1, gotW / totalW));
  const score = Math.round(coverage * maxScore);
  const feedback = score > maxScore / 2 ? 'Covered many rubric keypoints' : 'Missed several rubric keypoints';
  return { score, feedback };
}

async function gradeAnswer({ modelAnswer, studentAnswer, maxScore = 5, keypoints }) {
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
      raw = await callOpenAI({ apiKey: openaiKey, model: process.env.OPENAI_MODEL, modelAnswer, studentAnswer, maxScore, keypoints });
      const parsed = parseJsonSafe(raw);
      if (parsed) {
        return {
          score: coerceScore(parsed.score, maxScore),
          feedback: String(parsed.feedback || '').slice(0, 500),
          provider: 'openai',
        };
      }
    } else if (provider === 'gemini' && geminiKey) {
      raw = await callGemini({ apiKey: geminiKey, model: process.env.GEMINI_MODEL, modelAnswer, studentAnswer, maxScore, keypoints });
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
    // Swallow and fallback to heuristic
  }

  // Fallback to heuristic grading
  const h = weightedHeuristic(modelAnswer || '', studentAnswer || '', keypoints, maxScore);
  return { score: h.score, feedback: h.feedback + ' (heuristic)', provider: 'heuristic' };
}

module.exports = { gradeAnswer };
