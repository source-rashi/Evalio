import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, MessageSquare, LogOut, Upload, FileText, CheckCircle, Clock, Save } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();
  
  // User state
  const [studentId] = useState(localStorage.getItem('userId') || '');
  
  // Exam state
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  
  // Answer state
  const [answersByQid, setAnswersByQid] = useState({});
  const [saveStatusByQid, setSaveStatusByQid] = useState({});
  const [ocrLoading, setOcrLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  
  // Evaluation state
  const [evaluation, setEvaluation] = useState(null);
  
  // Autosave timers
  const saveTimersRef = useRef({});

  useEffect(() => {
    listExams();
    return () => {
      const timers = saveTimersRef.current;
      Object.values(timers).forEach(t => clearTimeout(t));
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  async function listExams() {
    try {
      const url = studentId 
        ? `${API}/api/exam/student/list?studentId=${studentId}`
        : `${API}/api/exam/student/list`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.ok) setExams(j.exams);
    } catch (e) {
      console.error('Error listing exams:', e);
    }
  }

  function selectedExamObj() {
    return exams.find(e => e._id === selectedExam);
  }

  async function startDraft() {
    if (!selectedExam) return alert('Select an exam first');
    try {
      const r = await fetch(`${API}/api/draft/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: selectedExam, student_id: studentId }),
      });
      const j = await r.json();
      if (j.ok) {
        setSubmissionId(j.submission._id);
        setSubmissionStatus(j.submission.status);
        alert('Draft started! You can now add answers.');
      } else {
        alert(j.error);
      }
    } catch (e) {
      alert('Error starting draft');
    }
  }

  async function ensureDraft() {
    if (!submissionId) {
      await startDraft();
    }
  }

  async function ocrUpload(e, qid) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setOcrLoading(true);
    try {
      await ensureDraft();
      const formData = new FormData();
      formData.append('file', file);
      
      const r = await fetch(`${API}/api/ocr/extract`, {
        method: 'POST',
        body: formData,
      });
      const j = await r.json();
      
      if (j.ok) {
        setAnswersByQid(prev => ({
          ...prev,
          [qid]: { ...(prev[qid] || {}), extractedText: j.text, imageUrl: j.imageUrl },
        }));
        scheduleSave(qid);
        alert('Text extracted from image!');
      } else {
        alert(j.error || 'OCR extraction failed');
      }
    } catch (e) {
      alert('Error uploading image');
    } finally {
      setOcrLoading(false);
    }
  }

  async function saveAnswer(qid) {
    if (!submissionId) return;
    
    const entry = answersByQid[qid] || {};
    const payload = {
      questionId: qid,
      extractedText: entry.extractedText || '',
      answerImage: entry.imageUrl || '',
    };
    
    setSaveStatusByQid(prev => ({ ...prev, [qid]: 'saving' }));
    try {
      const r = await fetch(`${API}/api/draft/${submissionId}/answer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      
      if (j.ok) {
        setSubmissionStatus(j.submission.status);
        setSaveStatusByQid(prev => ({ ...prev, [qid]: 'saved' }));
      } else {
        setSaveStatusByQid(prev => ({ ...prev, [qid]: 'error' }));
        alert(j.error);
      }
    } catch (e) {
      setSaveStatusByQid(prev => ({ ...prev, [qid]: 'error' }));
    }
  }

  function scheduleSave(qid) {
    if (submissionStatus !== 'draft') return;
    
    const timers = saveTimersRef.current;
    if (timers[qid]) clearTimeout(timers[qid]);
    
    setSaveStatusByQid(prev => ({ ...prev, [qid]: 'saving' }));
    timers[qid] = setTimeout(async () => {
      await ensureDraft();
      await saveAnswer(qid);
    }, 1000);
  }

  async function finalizeDraft() {
    if (!submissionId) return alert('Start a draft first');
    
    setFinalizing(true);
    try {
      const r = await fetch(`${API}/api/draft/${submissionId}/finalize`, {
        method: 'POST',
      });
      const j = await r.json();
      
      if (j.ok) {
        setSubmissionStatus(j.submission.status);
        alert('Submission finalized! Your teacher can now evaluate it.');
        setActiveTab('results');
      } else {
        alert(j.error);
      }
    } catch (e) {
      alert('Error finalizing submission');
    } finally {
      setFinalizing(false);
    }
  }

  async function evaluateSubmission() {
    if (!submissionId) return alert('Create a submission first');
    
    try {
      const r = await fetch(`${API}/api/evaluate/${submissionId}`, {
        method: 'POST',
      });
      const j = await r.json();
      
      if (j.ok) {
        setEvaluation(j.evaluation);
        alert(`Evaluation complete! Score: ${j.evaluation.totalScore}/${j.evaluation.maxScore}`);
      } else {
        alert(j.error);
      }
    } catch (e) {
      alert('Error during evaluation');
    }
  }

  const sidebarItems = [
    { id: 'home', label: 'My Exams', icon: BookOpen },
    { id: 'results', label: 'Results', icon: TrendingUp },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="font-heading font-bold text-lg text-text-primary">Evalio</div>
          <div className="text-text-secondary text-sm">Student Portal</div>
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
        <header className="bg-white border-b px-6 py-4">
          <h1 className="font-heading font-semibold text-xl text-text-primary">
            Welcome to Evalio
          </h1>
          <p className="text-text-secondary text-sm">
            View assigned exams, submit answers, and get AI-powered feedback
          </p>
        </header>

        <div className="p-6">
          {/* My Exams Tab */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Welcome Section */}
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-6 flex items-center gap-4">
                <div className="text-6xl">🤖</div>
                <div className="flex-1">
                  <h2 className="font-heading font-semibold text-lg text-text-primary">
                    Here you can view assigned exams, submit answers, and get AI-powered feedback.
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Our AI robot will help you evaluate your answers and provide insights for improvement!
                  </p>
                </div>
              </div>

              {/* Select Exam */}
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h2 className="font-heading font-semibold text-lg text-text-primary mb-4">
                  Select Exam
                </h2>
                <div className="flex gap-3">
                  <select
                    className="border rounded-lg px-3 h-10 flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={selectedExam}
                    onChange={e => setSelectedExam(e.target.value)}
                  >
                    <option value="">-- Choose an exam --</option>
                    {exams.map(e => (
                      <option key={e._id} value={e._id}>
                        {e.title} ({e.questions?.length || 0} questions)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={startDraft}
                    disabled={!selectedExam || submissionId}
                    className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submissionId ? 'Draft Started' : 'Start Answering'}
                  </button>
                </div>
                {submissionId && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Draft created! Submission ID: <span className="font-mono">{submissionId.slice(0, 12)}...</span>
                      <span className="ml-2 px-2 py-0.5 bg-green-200 rounded text-xs">{submissionStatus}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Answer Questions */}
              {selectedExam && selectedExamObj() && (
                <div className="bg-white rounded-xl border p-6 shadow-sm">
                  <h2 className="font-heading font-semibold text-lg text-text-primary mb-4">
                    Answer Questions for "{selectedExamObj().title}"
                  </h2>
                  
                  {selectedExamObj().questions?.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">
                      <p>No questions in this exam yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {selectedExamObj().questions?.map((q, idx) => (
                        <div key={q._id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                              Q{idx + 1}
                            </span>
                            <span className="text-sm font-medium text-text-primary">{q.text}</span>
                            <span className="ml-auto text-xs text-text-secondary">{q.marks} marks</span>
                          </div>

                          {/* Question Paper Image (if available) */}
                          {q.qPaperUrl && (
                            <div className="mb-3 p-3 bg-white rounded-lg border">
                              <p className="text-xs font-medium text-text-primary mb-2">📄 Question Paper:</p>
                              <img 
                                src={q.qPaperUrl} 
                                alt="Question Paper" 
                                className="max-w-full h-auto rounded border"
                                style={{ maxHeight: '400px' }}
                              />
                              <a 
                                href={q.qPaperUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline mt-2 inline-block"
                              >
                                View Full Size →
                              </a>
                            </div>
                          )}

                          {/* Upload Answer Sheet */}
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-text-primary mb-2">
                              Upload Answer Sheet (Optional)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => ocrUpload(e, q._id)}
                              disabled={ocrLoading || submissionStatus !== 'draft'}
                              className="border rounded-lg px-3 h-10 w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-accent/10 file:text-accent hover:file:bg-accent/20 disabled:opacity-50"
                            />
                            {ocrLoading && (
                              <p className="text-xs text-amber-600 mt-1">⏳ Extracting text from image...</p>
                            )}
                          </div>

                          {/* Type Answer */}
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-text-primary mb-2">
                              Your Answer
                            </label>
                            <textarea
                              className="border rounded-lg px-3 py-2 w-full min-h-32 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:bg-gray-100"
                              placeholder="Type your answer here or upload an image above to extract text automatically..."
                              value={answersByQid[q._id]?.extractedText || ''}
                              onChange={e => {
                                setAnswersByQid(prev => ({
                                  ...prev,
                                  [q._id]: { ...(prev[q._id] || {}), extractedText: e.target.value },
                                }));
                                scheduleSave(q._id);
                              }}
                              disabled={submissionStatus !== 'draft'}
                            />
                            {answersByQid[q._id]?.imageUrl && (
                              <p className="text-xs text-text-secondary mt-1">
                                📎 Image: {answersByQid[q._id].imageUrl}
                              </p>
                            )}
                          </div>

                          {/* Save Status */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveAnswer(q._id)}
                              disabled={!submissionId || submissionStatus !== 'draft'}
                              className="bg-secondary hover:bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                            >
                              <Save size={14} className="inline mr-1" />
                              Save Answer
                            </button>
                            {saveStatusByQid[q._id] === 'saving' && (
                              <span className="text-xs text-amber-600">⏳ Saving...</span>
                            )}
                            {saveStatusByQid[q._id] === 'saved' && (
                              <span className="text-xs text-green-600">✓ Saved</span>
                            )}
                            {saveStatusByQid[q._id] === 'error' && (
                              <span className="text-xs text-red-600">✗ Error</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {selectedExamObj().questions?.length > 0 && (
                    <div className="mt-6 flex gap-3 justify-end border-t pt-4">
                      <button
                        onClick={finalizeDraft}
                        disabled={!submissionId || submissionStatus !== 'draft' || finalizing}
                        className="bg-amber-400 hover:bg-amber-500 text-black px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {finalizing ? 'Finalizing...' : 'Finalize Submission'}
                      </button>
                      <button
                        onClick={evaluateSubmission}
                        disabled={!submissionId || submissionStatus !== 'finalized'}
                        className="bg-secondary hover:bg-green-600 text-white px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        Evaluate Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h2 className="font-heading font-semibold text-xl text-text-primary mb-2">
                  Your Results
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                  View scores and detailed feedback for each submission
                </p>

                {evaluation ? (
                  <div className="border rounded-lg p-6 bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">Latest Evaluation</h3>
                      <div className="text-3xl font-bold text-primary">
                        {evaluation.totalScore}/{evaluation.maxScore}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {evaluation.questionScores?.map((qs, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Question {idx + 1}</span>
                            <span className="font-bold text-primary">
                              {qs.score}/{qs.maxScore}
                            </span>
                          </div>
                          {qs.feedback && (
                            <p className="text-sm text-text-secondary">{qs.feedback}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-text-secondary">
                    <TrendingUp className="mx-auto mb-3 text-gray-300" size={48} />
                    <p>No evaluation yet. Complete and evaluate a submission to see results here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="p-6 border-b">
                <h2 className="font-heading font-semibold text-xl text-text-primary">
                  AI Feedback & Comments
                </h2>
                <p className="text-text-secondary text-sm">
                  Detailed feedback from AI evaluation and teacher comments
                </p>
              </div>
              <div className="p-6">
                {evaluation ? (
                  <div className="space-y-4">
                    {evaluation.questionScores?.map((qs, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Question {idx + 1}</h3>
                        <p className="text-sm text-text-secondary mb-2">
                          <span className="font-medium">Score:</span> {qs.score}/{qs.maxScore}
                        </p>
                        {qs.feedback && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-sm text-blue-900">
                              <strong>AI Feedback:</strong> {qs.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-text-secondary">
                    <MessageSquare className="mx-auto mb-3 text-gray-300" size={48} />
                    <p>No feedback available yet. Submit an answer to receive AI-powered insights!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
