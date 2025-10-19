// Tiny heuristic scorer: matches keyword overlap between modelAnswer and extractedText
function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreAnswer(modelAnswer, studentAnswer, max = 5) {
  const m = new Set(tokenize(modelAnswer));
  const s = tokenize(studentAnswer);
  if (m.size === 0) return { score: 0, feedback: 'No model answer provided' };
  let hits = 0;
  for (const t of s) if (m.has(t)) hits++;
  const coverage = Math.min(1, hits / Math.max(5, Math.floor(m.size * 0.6)));
  const score = Math.round(coverage * max);
  const feedback = score > max / 2 ? 'Good coverage of key points' : 'Needs more key points from the model answer';
  return { score, feedback };
}

module.exports = { scoreAnswer };
