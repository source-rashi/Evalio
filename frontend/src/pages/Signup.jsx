import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSignup() {
    try {
      setLoading(true);
      const endpoint = role === 'teacher' ? '/api/teacher/register' : '/api/student/register';
      const r = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const j = await r.json();
      if (!j.ok) return alert(j.error || 'Signup failed');
      alert(`${role === 'teacher' ? 'Teacher' : 'Student'} account created successfully! Please log in.`);
      navigate('/login');
    } catch (e) {
      alert('Network error while signing up');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm w-full max-w-md">
        <h1 className="font-heading font-semibold text-text-primary text-xl">Sign up</h1>
        <p className="text-text-secondary text-sm mb-4">Create your Evalio account</p>
        <div className="flex flex-col gap-2">
          <input className="border rounded-lg px-3 h-10" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="border rounded-lg px-3 h-10" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="border rounded-lg px-3 h-10" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <select className="border rounded-lg px-3 h-10" value={role} onChange={e => setRole(e.target.value)}>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
          <button className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg" onClick={handleSignup} disabled={!name || !email || !password || loading}>{loading ? 'Creating…' : 'Create account'}</button>
        </div>
        <div className="text-sm text-text-secondary mt-3">Already have an account? <Link className="text-primary" to="/login">Log in</Link></div>
      </div>
    </div>
  );
}
