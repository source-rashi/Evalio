import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BarChart3, LogOut, HelpCircle, Plus, Eye, Trash2, Edit, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const [token] = useState(localStorage.getItem('token') || '');
  
  // Exam state
  const [examTitle, setExamTitle] = useState('');
  const [examSubject, setExamSubject] = useState('Physics');
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  
  // Question state
  const [qText, setQText] = useState('');
  const [qMarks, setQMarks] = useState(5);
  const [qModelAns, setQModelAns] = useState('');
  const [qKeypoints, setQKeypoints] = useState([{ text: '', weight: 1 }]);
  const [qAnswerSheetFile, setQAnswerSheetFile] = useState(null);
  const [uploadingAnswerSheet, setUploadingAnswerSheet] = useState(false);
  
  // Submissions state
  const [submissionsList, setSubmissionsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(null);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // Load exams on mount
  useEffect(() => {
    if (token) listExams();
  }, [token]);

  // Load submissions when exam selected
  useEffect(() => {
    if (selectedExam && token) loadSubmissions();
  }, [selectedExam, token]);

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  async function listExams() {
    try {
      const r = await fetch(`${API}/api/exam/list`, { headers: { ...authHeader } });
      const j = await r.json();
      if (j.ok) setExams(j.exams);
      else alert(j.error);
    } catch (e) {
      console.error('Error listing exams:', e);
    }
  }

  async function createExam() {
    if (!examTitle.trim()) return alert('Enter exam title');
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/exam/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ title: examTitle, subject: examSubject }),
      });
      const j = await r.json();
      if (j.ok) {
        setExamTitle('');
        setExamSubject('Physics');
        await listExams();
        alert('Exam created successfully!');
      } else {
        alert(j.error);
      }
    } catch (e) {
      alert('Error creating exam');
    } finally {
      setLoading(false);
    }
  }

  function normalizeKeypoints(arr) {
    return (arr || [])
      .map(k => ({ text: (k.text || '').trim(), weight: Number(k.weight || 1) }))
      .filter(k => k.text);
  }

  async function uploadAnswerSheet() {
    if (!qAnswerSheetFile) return;
    
    setUploadingAnswerSheet(true);
    try {
      const formData = new FormData();
      formData.append('file', qAnswerSheetFile);
      
      const r = await fetch(`${API}/api/ocr/extract`, {
        method: 'POST',
        body: formData,
      });
      const j = await r.json();
      
      if (j.ok) {
        setQModelAns(j.text || '');
        alert('Answer sheet uploaded and text extracted!');
      } else {
        alert(j.error || 'Failed to extract text from answer sheet');
      }
    } catch (e) {
      alert('Error uploading answer sheet');
    } finally {
      setUploadingAnswerSheet(false);
      setQAnswerSheetFile(null);
    }
  }

  async function addQuestion() {
    if (!selectedExam) return alert('Select an exam first');
    if (!qText.trim()) return alert('Enter question text');
    
    setLoading(true);
    try {
      const payload = {
        text: qText,
        marks: Number(qMarks),
        modelAnswer: qModelAns,
        keypoints: normalizeKeypoints(qKeypoints),
        exam_id: selectedExam,
      };
      
      const r = await fetch(`${API}/api/exam/question/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      
      if (j.ok) {
        setQText('');
        setQMarks(5);
        setQModelAns('');
        setQKeypoints([{ text: '', weight: 1 }]);
        setQAnswerSheetFile(null);
        await listExams();
        alert('Question added successfully!');
      } else {
        alert(j.error);
      }
    } catch (e) {
      alert('Error adding question');
    } finally {
      setLoading(false);
    }
  }

  async function evaluateSubmission(submissionId) {
    if (!submissionId) return;
    
    setEvaluating(submissionId);
    try {
      const r = await fetch(`${API}/api/evaluate/${submissionId}`, {
        method: 'POST',
      });
      const j = await r.json();
      
      if (j.ok) {
        alert(`Evaluation complete! Total Score: ${j.evaluation.totalScore}/${j.evaluation.maxScore}`);
        await loadSubmissions(); // Refresh submissions
      } else {
        alert(j.error || 'Evaluation failed');
      }
    } catch (e) {
      alert('Error during evaluation');
    } finally {
      setEvaluating(null);
    }
  }

  async function loadSubmissions() {
    if (!selectedExam || !token) return;
    try {
      const r = await fetch(`${API}/api/teacher/submissions?examId=${selectedExam}`, {
        headers: { ...authHeader },
      });
      const j = await r.json();
      if (j.ok) setSubmissionsList(j.submissions);
      else alert(j.error);
    } catch (e) {
      console.error('Error loading submissions:', e);
    }
  }

  function selectedExamObj() {
    return exams.find(e => e._id === selectedExam);
  }

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create', label: 'Create Exam', icon: FileText },
    { id: 'submissions', label: 'Submissions', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="font-heading font-bold text-lg text-text-primary">Evalio</div>
          <div className="text-text-secondary text-sm">Teacher Portal</div>
        </div>
        <nav className="flex-1 p-3">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-gray-50'
              }`}
            >
              <item.icon size={18} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-text-secondary hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-heading font-semibold text-xl text-text-primary">
              Welcome back, Teacher!
            </h1>
            <p className="text-text-secondary text-sm">
              Manage your exams, submissions, and analytics
            </p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-text-secondary hover:bg-gray-50 transition-colors">
            <HelpCircle size={18} />
            Help
          </button>
        </header>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Plus size={24} />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-heading font-semibold text-lg text-text-primary">
                        Create New Exam
                      </h2>
                      <p className="text-text-secondary text-sm mt-1">
                        Define subject, add questions, and upload model answers.
                      </p>
                      <button
                        onClick={() => setActiveTab('create')}
                        className="mt-4 bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Open Create Exam Form
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-lg bg-secondary/10 text-secondary">
                      <Eye size={24} />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-heading font-semibold text-lg text-text-primary">
                        View Submissions
                      </h2>
                      <p className="text-text-secondary text-sm mt-1">
                        See student submissions, check AI evaluations, and provide manual feedback.
                      </p>
                      <button
                        onClick={() => setActiveTab('submissions')}
                        className="mt-4 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Open Submissions Table
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h2 className="font-heading font-semibold text-lg text-text-primary mb-4">
                  Quick Stats
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Total Exams</div>
                    <div className="text-2xl font-bold text-primary">{exams.length}</div>
                  </div>
                  <div className="p-4 bg-secondary/5 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Total Questions</div>
                    <div className="text-2xl font-bold text-secondary">
                      {exams.reduce((sum, e) => sum + (e.questions?.length || 0), 0)}
                    </div>
                  </div>
                  <div className="p-4 bg-accent/5 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Submissions</div>
                    <div className="text-2xl font-bold text-accent">{submissionsList.length}</div>
                  </div>
                </div>
              </div>

              {/* Recent Exams */}
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h2 className="font-heading font-semibold text-lg text-text-primary mb-4">
                  Your Exams
                </h2>
                {exams.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary">
                    <FileText className="mx-auto mb-3 text-gray-300" size={48} />
                    <p>No exams yet. Create your first exam to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exams.map(exam => (
                      <div
                        key={exam._id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedExam(exam._id);
                          setActiveTab('create');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-text-primary">{exam.title}</h3>
                            <p className="text-sm text-text-secondary">
                              {exam.questions?.length || 0} questions
                            </p>
                          </div>
                          <CheckCircle className="text-secondary" size={20} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create Exam Tab */}
          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* Create New Exam */}
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h2 className="font-heading font-semibold text-xl text-text-primary mb-4">
                  Create New Exam
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Exam Title *
                    </label>
                    <input
                      className="border rounded-lg px-3 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. Physics Midterm 2025"
                      value={examTitle}
                      onChange={e => setExamTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Subject
                    </label>
                    <select
                      className="border rounded-lg px-3 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary"
                      value={examSubject}
                      onChange={e => setExamSubject(e.target.value)}
                    >
                      <option>Physics</option>
                      <option>Chemistry</option>
                      <option>Mathematics</option>
                      <option>Biology</option>
                      <option>Computer Science</option>
                      <option>English</option>
                      <option>History</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={createExam}
                  disabled={!examTitle.trim() || loading}
                  className="mt-4 bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Exam'}
                </button>
              </div>

              {/* Select Exam for Questions */}
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h2 className="font-heading font-semibold text-xl text-text-primary mb-4">
                  Add Questions to Exam
                </h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Select Exam
                  </label>
                  <select
                    className="border rounded-lg px-3 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary"
                    value={selectedExam}
                    onChange={e => setSelectedExam(e.target.value)}
                  >
                    <option value="">-- Select an exam --</option>
                    {exams.map(e => (
                      <option key={e._id} value={e._id}>
                        {e.title} ({e.questions?.length || 0} questions)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedExam && (
                  <div className="border-t pt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Question Text *
                      </label>
                      <textarea
                        className="border rounded-lg px-3 py-2 w-full min-h-24 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter the question..."
                        value={qText}
                        onChange={e => setQText(e.target.value)}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Marks
                        </label>
                        <input
                          type="number"
                          className="border rounded-lg px-3 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="5"
                          min="1"
                          value={qMarks}
                          onChange={e => setQMarks(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Upload Model Answer Sheet
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={e => setQAnswerSheetFile(e.target.files?.[0] || null)}
                            className="border rounded-lg px-3 h-10 w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                          {qAnswerSheetFile && (
                            <button
                              onClick={uploadAnswerSheet}
                              disabled={uploadingAnswerSheet}
                              className="bg-accent hover:bg-amber-600 text-white px-3 py-2 rounded-lg whitespace-nowrap disabled:opacity-50 transition-colors"
                            >
                              {uploadingAnswerSheet ? 'Extracting...' : 'Extract Text'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Model Answer (Optional - or extracted from upload)
                      </label>
                      <textarea
                        className="border rounded-lg px-3 py-2 w-full min-h-20 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Type the expected answer or upload an answer sheet above to extract text automatically..."
                        value={qModelAns}
                        onChange={e => setQModelAns(e.target.value)}
                      />
                    </div>

                    {/* Keypoints */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-text-primary">
                          Keypoints (Optional - for AI grading)
                        </label>
                        <button
                          type="button"
                          onClick={() => setQKeypoints(prev => [...prev, { text: '', weight: 1 }])}
                          className="text-sm text-primary hover:underline"
                        >
                          + Add keypoint
                        </button>
                      </div>
                      <div className="space-y-2">
                        {qKeypoints.map((kp, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              className="border rounded-lg px-3 h-10 flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder={`Keypoint #${idx + 1}`}
                              value={kp.text}
                              onChange={e =>
                                setQKeypoints(prev =>
                                  prev.map((k, i) => (i === idx ? { ...k, text: e.target.value } : k))
                                )
                              }
                            />
                            <input
                              className="border rounded-lg px-3 h-10 w-28 focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Weight"
                              type="number"
                              min="0"
                              step="0.1"
                              value={kp.weight}
                              onChange={e =>
                                setQKeypoints(prev =>
                                  prev.map((k, i) =>
                                    i === idx ? { ...k, weight: e.target.value } : k
                                  )
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQKeypoints(prev => prev.filter((_, i) => i !== idx))
                              }
                              disabled={qKeypoints.length === 1}
                              className="p-2 border rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Trash2 size={18} className="text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-text-secondary mt-2">
                        💡 Keypoints help AI evaluate answers more accurately. Higher weight = more important.
                      </p>
                    </div>

                    <button
                      onClick={addQuestion}
                      disabled={!qText.trim() || loading}
                      className="bg-secondary hover:bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Adding...' : 'Add Question'}
                    </button>
                  </div>
                )}
              </div>

              {/* Display Questions */}
              {selectedExam && selectedExamObj() && (
                <div className="bg-white rounded-xl border p-6 shadow-sm">
                  <h2 className="font-heading font-semibold text-xl text-text-primary mb-4">
                    Questions in "{selectedExamObj().title}"
                  </h2>
                  {selectedExamObj().questions?.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">
                      <p>No questions yet. Add your first question above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedExamObj().questions?.map((q, idx) => (
                        <div key={q._id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                                  Q{idx + 1}
                                </span>
                                <span className="text-xs text-text-secondary">
                                  {q.marks} marks
                                </span>
                              </div>
                              <p className="font-medium text-text-primary mb-2">{q.text}</p>
                              {q.modelAnswer && (
                                <p className="text-sm text-text-secondary mb-2">
                                  <span className="font-semibold">Model Answer:</span> {q.modelAnswer}
                                </p>
                              )}
                              {Array.isArray(q.keypoints) && q.keypoints.length > 0 && (
                                <div className="text-sm text-text-secondary">
                                  <span className="font-semibold">Keypoints:</span>{' '}
                                  {q.keypoints.map(kp => `${kp.text} (${kp.weight ?? 1})`).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submissions Tab */}
          {activeTab === 'submissions' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-text-primary">
                      Submissions
                    </h2>
                    <p className="text-text-secondary text-sm">
                      Student submissions with AI scores and feedback
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="border rounded-lg px-3 h-10 focus:outline-none focus:ring-2 focus:ring-primary"
                      value={selectedExam}
                      onChange={e => setSelectedExam(e.target.value)}
                    >
                      <option value="">All Exams</option>
                      {exams.map(e => (
                        <option key={e._id} value={e._id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={loadSubmissions}
                      disabled={!selectedExam}
                      className="border px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Submission ID
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Answers
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Total Score
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-text-secondary">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissionsList.length === 0 ? (
                        <tr className="border-b">
                          <td colSpan={7} className="px-6 py-8 text-center text-text-secondary text-sm">
                            {selectedExam
                              ? 'No submissions yet for this exam.'
                              : 'Select an exam to view submissions.'}
                          </td>
                        </tr>
                      ) : (
                        submissionsList.map(s => (
                          <tr key={s.id} className="border-b hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-text-primary">{s.studentName || 'Anonymous'}</div>
                                {s.studentEmail && (
                                  <div className="text-xs text-text-secondary">{s.studentEmail}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm">{s.id?.slice(0, 8)}...</td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  s.status === 'finalized'
                                    ? 'bg-green-100 text-green-800'
                                    : s.status === 'evaluated'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">{s.answersCount || 0}</td>
                            <td className="px-6 py-4 text-sm font-semibold">
                              {s.totalScore !== null && s.totalScore !== undefined
                                ? `${s.totalScore}/${s.maxScore || '?'}`
                                : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-text-secondary">
                              {new Date(s.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button className="text-primary hover:underline text-sm">
                                  View Details
                                </button>
                                {s.status === 'finalized' && (
                                  <button
                                    onClick={() => evaluateSubmission(s.id)}
                                    disabled={evaluating === s.id}
                                    className="bg-secondary hover:bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                                  >
                                    {evaluating === s.id ? 'Evaluating...' : 'Evaluate'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="font-heading font-semibold text-xl text-text-primary mb-4">
                Analytics
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                Charts and performance metrics will appear here once you have evaluations.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 border rounded-lg bg-gray-50 text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="font-semibold text-text-primary">Average Score</div>
                  <div className="text-sm text-text-secondary mt-1">Per Exam breakdown</div>
                </div>
                <div className="p-6 border rounded-lg bg-gray-50 text-center">
                  <div className="text-3xl mb-2">🤖</div>
                  <div className="font-semibold text-text-primary">AI vs Manual</div>
                  <div className="text-sm text-text-secondary mt-1">Evaluation comparison</div>
                </div>
                <div className="p-6 border rounded-lg bg-gray-50 text-center">
                  <div className="text-3xl mb-2">📈</div>
                  <div className="font-semibold text-text-primary">Student Progress</div>
                  <div className="text-sm text-text-secondary mt-1">Track improvement</div>
                </div>
              </div>
              <div className="mt-6 p-4 border rounded-lg bg-blue-50">
                <p className="text-sm text-blue-900">
                  💡 <strong>Coming soon:</strong> Interactive charts with Recharts showing detailed
                  analytics and insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
