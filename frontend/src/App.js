import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [qText, setQText] = useState('');
  const [qMarks, setQMarks] = useState(5);
  const [qModelAns, setQModelAns] = useState('');
  const [qKeypoints, setQKeypoints] = useState([{ text: '', weight: 1 }]);
  const [submissionId, setSubmissionId] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  // Per-question answers: { [questionId]: { extractedText, imageUrl } }
  const [answersByQid, setAnswersByQid] = useState({});
  // Per-question save status: idle|saving|saved|error
  const [saveStatusByQid, setSaveStatusByQid] = useState({});
  const [evaluation, setEvaluation] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const saveTimersRef = useRef({});
  const [submissionsList, setSubmissionsList] = useState([]);

  async function loadSubmissions() {
    if (!selectedExam || !token) return;
    const r = await fetch(`${API}/api/teacher/submissions?examId=${selectedExam}`, { headers: { ...authHeader } });
    const j = await r.json();
    if (j.ok) setSubmissionsList(j.submissions); else alert(j.error);
  }

  function selectedExamObj() {
    return exams.find(e => e._id === selectedExam);
  }

  async function ocrUpload(e, qid) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      await ensureDraft();
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`${API}/api/ocr/extract`, { method: 'POST', body: form });
      const j = await r.json();
      if (j.ok) {
        setAnswersByQid(prev => ({
          ...prev,
          [qid]: { ...(prev[qid] || {}), extractedText: j.text, imageUrl: j.imageUrl },
        }));
        scheduleSave(qid);
      } else alert(j.error);
    } finally {
      setOcrLoading(false);
    }
  }

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (token) localStorage.setItem('token', token); else localStorage.removeItem('token');
  }, [token]);

  function logout() {
    setToken('');
  }

  async function register() {
    const r = await fetch(`${API}/api/teacher/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    const j = await r.json();
    alert(j.ok ? 'Registered' : j.error);
  }

  async function login() {
    const r = await fetch(`${API}/api/teacher/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if (j.ok) setToken(j.token); else alert(j.error || 'Login failed');
  }

  async function createExam() {
    const r = await fetch(`${API}/api/exam/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ title: examTitle }) });
    const j = await r.json();
    if (j.ok) { setExamTitle(''); await listExams(); } else alert(j.error);
  }

  async function listExams() {
    const r = await fetch(`${API}/api/exam/list`, { headers: { ...authHeader } });
    const j = await r.json();
    if (j.ok) setExams(j.exams); else alert(j.error);
  }

  function normalizeKeypoints(arr) {
    return (arr || [])
      .map(k => ({ text: (k.text || '').trim(), weight: Number(k.weight || 1) }))
      .filter(k => k.text);
  }

  async function addQuestion() {
    if (!selectedExam) return alert('Select exam');
    const payload = { text: qText, marks: Number(qMarks), modelAnswer: qModelAns, keypoints: normalizeKeypoints(qKeypoints), exam_id: selectedExam };
    const r = await fetch(`${API}/api/exam/question/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) return alert(j.error);
    setQText(''); setQMarks(5); setQModelAns(''); setQKeypoints([{ text: '', weight: 1 }]);
    await listExams();
  }

  async function startDraft() {
    if (!selectedExam) return alert('Select exam');
    const r = await fetch(`${API}/api/draft/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exam_id: selectedExam }) });
    const j = await r.json();
    if (j.ok) { setSubmissionId(j.submission._id); setSubmissionStatus(j.submission.status); } else alert(j.error);
  }

  async function ensureDraft() {
    if (!submissionId) {
      await startDraft();
    }
  }

  async function saveAnswer(qid) {
    if (!submissionId) return alert('Start a draft first');
    const entry = answersByQid[qid] || {};
    const payload = { questionId: qid, extractedText: entry.extractedText || '', answerImage: entry.imageUrl || '' };
    setSaveStatusByQid(prev => ({ ...prev, [qid]: 'saving' }));
    const r = await fetch(`${API}/api/draft/${submissionId}/answer`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (j.ok) {
      setSubmissionStatus(j.submission.status);
      setSaveStatusByQid(prev => ({ ...prev, [qid]: 'saved' }));
    } else {
      setSaveStatusByQid(prev => ({ ...prev, [qid]: 'error' }));
      alert(j.error);
    }
  }

  async function finalizeDraft() {
    if (!submissionId) return alert('Start a draft first');
    const r = await fetch(`${API}/api/draft/${submissionId}/finalize`, { method: 'POST' });
    const j = await r.json();
    if (j.ok) { setSubmissionStatus(j.submission.status); } else alert(j.error);
  }

  function scheduleSave(qid) {
    if (submissionStatus !== 'draft') return; // don't autosave if finalized
    // clear previous timer
    const timers = saveTimersRef.current;
    if (timers[qid]) clearTimeout(timers[qid]);
    setSaveStatusByQid(prev => ({ ...prev, [qid]: 'saving' }));
    timers[qid] = setTimeout(async () => {
      await ensureDraft();
      await saveAnswer(qid);
    }, 700);
  }

  useEffect(() => {
    return () => {
      const timers = saveTimersRef.current;
      Object.values(timers).forEach(t => clearTimeout(t));
    };
  }, []);

  async function evaluateSubmission() {
    if (!submissionId) return alert('Create a submission first');
    const r = await fetch(`${API}/api/evaluate/${submissionId}`, { method: 'POST' });
    const j = await r.json();
    if (j.ok) setEvaluation(j.evaluation); else alert(j.error);
  }

  useEffect(() => { if (token) listExams(); }, [token]);
  useEffect(() => { loadSubmissions(); }, [token, selectedExam]);

  return (
    <div className="min-h-screen bg-bg">
      <Header token={token} onLogout={logout} />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Auth */}
        <section className="bg-white rounded-xl border p-4 shadow-sm">
          <h2 className="font-heading font-semibold text-text-primary mb-2">Authentication</h2>
          <div className="flex flex-wrap gap-2">
            <input className="border rounded-lg px-3 h-10" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <input className="border rounded-lg px-3 h-10" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="border rounded-lg px-3 h-10" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={register}>Register</button>
            <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={login} disabled={!email || !password}>Login</button>
            {token ? (<span className="badge">Logged in</span>) : null}
          </div>
        </section>

        {/* Exams */}
        <section className="bg-white rounded-xl border p-4 shadow-sm">
          <h2 className="font-heading font-semibold text-text-primary mb-2">Exams</h2>
          <div className="flex flex-wrap gap-2">
            <input className="border rounded-lg px-3 h-10" placeholder="Exam title" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
            <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={createExam} disabled={!token}>Create Exam</button>
            <button className="border px-3 py-2 rounded-lg" onClick={listExams} disabled={!token}>Refresh</button>
            <select className="border rounded-lg px-3 h-10" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
              <option value="">Select exam</option>
              {exams.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
          </div>
          <div className="stack">
            <div className="label">Add question</div>
            <div className="row">
              <input className="input" placeholder="Question text" value={qText} onChange={e => setQText(e.target.value)} style={{ flex: 1 }} />
              <input className="input" placeholder="Marks" type="number" value={qMarks} onChange={e => setQMarks(e.target.value)} style={{ width: 120 }} />
              <input className="input" placeholder="Model answer" value={qModelAns} onChange={e => setQModelAns(e.target.value)} style={{ flex: 1 }} />
            </div>
            <div className="mt-2">
              <div className="text-sm text-text-secondary">Keypoints (optional)</div>
              <div className="flex flex-col gap-2">
                {qKeypoints.map((kp, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input className="border rounded-lg px-3 h-10 flex-1" placeholder={`Keypoint #${idx + 1}`} value={kp.text} onChange={e => setQKeypoints(prev => prev.map((k, i) => i === idx ? { ...k, text: e.target.value } : k))} />
                    <input className="border rounded-lg px-3 h-10 w-28" placeholder="Weight" type="number" value={kp.weight} min={0} onChange={e => setQKeypoints(prev => prev.map((k, i) => i === idx ? { ...k, weight: e.target.value } : k))} />
                    <button className="border px-3 py-2 rounded-lg" type="button" onClick={() => setQKeypoints(prev => prev.filter((_, i) => i !== idx))} disabled={qKeypoints.length === 1}>Remove</button>
                  </div>
                ))}
                <button className="border px-3 py-2 rounded-lg" type="button" onClick={() => setQKeypoints(prev => [...prev, { text: '', weight: 1 }])}>+ Add keypoint</button>
              </div>
            </div>
            <div className="actions">
              <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={addQuestion} disabled={!token || !selectedExam}>Add Question</button>
            </div>
            <div className="stack">
              {exams.find(x => x._id === selectedExam)?.questions?.map(q => (
                <div key={q._id} className="border rounded-lg p-3 bg-white">
                  <div className="font-semibold text-text-primary">{q.text} <span className="muted">(marks: {q.marks})</span></div>
                  {Array.isArray(q.keypoints) && q.keypoints.length > 0 && (
                    <div className="muted mt-1">
                      Keypoints: {q.keypoints.map(kp => `${kp.text}(${kp.weight ?? 1})`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Teacher submissions */}
        <section className="bg-white rounded-xl border p-4 shadow-sm lg:col-span-2">
          <h2>Teacher: Submissions</h2>
          <div className="flex items-center gap-2 mb-2">
            <button className="border px-3 py-2 rounded-lg" onClick={loadSubmissions} disabled={!selectedExam || !token}>Refresh Submissions</button>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-text-secondary font-semibold">ID</th>
                <th className="text-left text-text-secondary font-semibold">Status</th>
                <th className="text-left text-text-secondary font-semibold">Answers</th>
                <th className="text-left text-text-secondary font-semibold">Total Score</th>
                <th className="text-left text-text-secondary font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {submissionsList.map(s => (
                <tr key={s.id}>
                  <td className="font-mono">{s.id}</td>
                  <td>{s.status}</td>
                  <td>{s.answersCount}</td>
                  <td>{s.totalScore ?? '-'}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Submission & Evaluation */}
        <section className="bg-white rounded-xl border p-4 shadow-sm lg:col-span-2">
          <h2>Submission & Evaluation</h2>
          {selectedExamObj()?.questions?.length ? (
            <div className="flex flex-col gap-2">
              {selectedExamObj().questions.map(q => (
                <div key={q._id} className="border rounded-lg p-3 bg-white">
                  <div className="font-semibold text-text-primary">{q.text} <span className="muted">(marks: {q.marks})</span></div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="file" accept="image/*" onChange={(e) => ocrUpload(e, q._id)} />
                    {ocrLoading && <span className="status">OCR extracting…</span>}
                  </div>
                  <textarea
                    className="border rounded-lg p-3 w-full min-h-[120px]"
                    placeholder="Extracted text or type manually"
                    rows={4}
                    value={answersByQid[q._id]?.extractedText || ''}
                    onChange={(e) => {
                      setAnswersByQid(prev => ({ ...prev, [q._id]: { ...(prev[q._id] || {}), extractedText: e.target.value } }));
                      scheduleSave(q._id);
                    }}
                  />
                  {answersByQid[q._id]?.imageUrl && (
                    <div className="muted mt-1">Image: {answersByQid[q._id].imageUrl}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={() => saveAnswer(q._id)} disabled={!submissionId}>Save Answer</button>
                    <span className="status">
                      {saveStatusByQid[q._id] === 'saving' && 'Saving…'}
                      {saveStatusByQid[q._id] === 'saved' && 'Saved'}
                      {saveStatusByQid[q._id] === 'error' && 'Error saving'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">Select an exam with questions to add answers.</div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={startDraft} disabled={!selectedExam || submissionId}>Start Draft</button>
            <span className="status">Submission ID: {submissionId} ({submissionStatus})</span>
            <button className="bg-amber-400 hover:bg-amber-500 text-black px-3 py-2 rounded-lg" onClick={finalizeDraft} disabled={!submissionId || submissionStatus !== 'draft'}>Finalize</button>
            <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg" onClick={evaluateSubmission} disabled={!submissionId || submissionStatus !== 'finalized'}>Evaluate</button>
          </div>
          {evaluation && (<pre className="code mt-2">{JSON.stringify(evaluation, null, 2)}</pre>)}
        </section>
      </main>
    </div>
  );
}
