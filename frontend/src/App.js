import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function App() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [questions, setQuestions] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [qText, setQText] = useState('');
  const [qMarks, setQMarks] = useState(5);
  const [qModelAns, setQModelAns] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

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

  async function addQuestion() {
    if (!selectedExam) return alert('Select exam');
    const payload = { text: qText, marks: Number(qMarks), modelAnswer: qModelAns, exam_id: selectedExam };
    const r = await fetch(`${API}/api/exam/question/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) return alert(j.error);
    setQText(''); setQMarks(5); setQModelAns('');
    await listExams();
  }

  async function createSubmission() {
    if (!selectedExam) return alert('Select exam');
    // minimal: one answer entry with extractedText from textarea
    const payload = { exam_id: selectedExam, answers: [{ extractedText: studentAnswer }] };
    const r = await fetch(`${API}/api/submission/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (j.ok) setSubmissionId(j.submission._id); else alert(j.error);
  }

  async function evaluateSubmission() {
    if (!submissionId) return alert('Create a submission first');
    const r = await fetch(`${API}/api/evaluate/${submissionId}`, { method: 'POST' });
    const j = await r.json();
    if (j.ok) setEvaluation(j.evaluation); else alert(j.error);
  }

  useEffect(() => { if (token) listExams(); }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold">Evalio</h1>

      <section className="mt-4">
        <h2 className="font-bold">Auth</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={register}>Register</button>
          <button onClick={login}>Login</button>
          {token && <span>Logged in</span>}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="font-bold">Exams</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Exam title" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
          <button onClick={createExam} disabled={!token}>Create Exam</button>
          <button onClick={listExams} disabled={!token}>Refresh</button>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
          </select>
        </div>
        <div className="mt-2">
          <h3>Questions</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Question text" value={qText} onChange={e => setQText(e.target.value)} />
            <input placeholder="Marks" type="number" value={qMarks} onChange={e => setQMarks(e.target.value)} />
            <input placeholder="Model answer" value={qModelAns} onChange={e => setQModelAns(e.target.value)} />
            <button onClick={addQuestion} disabled={!token || !selectedExam}>Add Question</button>
          </div>
          <ul>
            {exams.find(x => x._id === selectedExam)?.questions?.map(q => (
              <li key={q._id}>{q.text} (marks: {q.marks})</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="font-bold">Submission & Evaluation</h2>
        <textarea placeholder="Student answer (extracted text)" value={studentAnswer} onChange={e => setStudentAnswer(e.target.value)} rows={4} style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button onClick={createSubmission} disabled={!selectedExam}>Create Submission</button>
          <span>Submission ID: {submissionId}</span>
          <button onClick={evaluateSubmission} disabled={!submissionId}>Evaluate</button>
        </div>
        {evaluation && (
          <pre style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, marginTop: 8 }}>
            {JSON.stringify(evaluation, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
