import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    try {
      setLoading(true);
      const endpoint = role === 'teacher' ? '/api/teacher/login' : '/api/student/login';
      const r = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!j.ok || !j.token) return alert(j.error || 'Login failed');
      localStorage.setItem('token', j.token);
      localStorage.setItem('role', role);
      localStorage.setItem('userId', j[role]?.id || ''); // Store user ID
      // Route based on role
      navigate(role === 'teacher' ? '/teacher' : '/student');
    } catch (e) {
      alert('Network error while logging in');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm w-full max-w-md">
        <h1 className="font-heading font-semibold text-text-primary text-xl">Log in</h1>
        <p className="text-text-secondary text-sm mb-4">Welcome back to Evalio</p>
        <div className="flex flex-col gap-2">
          <select className="border rounded-lg px-3 h-10" value={role} onChange={e => setRole(e.target.value)}>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
          <input className="border rounded-lg px-3 h-10" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="border rounded-lg px-3 h-10" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={handleLogin} disabled={!email || !password || loading}>{loading ? 'Signing in…' : 'Login'}</button>
        </div>
        <div className="text-sm text-text-secondary mt-3">No account? <Link className="text-primary" to="/signup">Sign up</Link></div>
      </div>
    </div>
  );
}
