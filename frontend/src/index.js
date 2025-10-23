import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<Landing />} />
			<Route path="/login" element={<Login />} />
			<Route path="/signup" element={<Signup />} />
			<Route path="/teacher" element={<TeacherDashboard />} />
			<Route path="/student" element={<StudentDashboard />} />
			<Route path="/app" element={<App />} />
		</Routes>
	</BrowserRouter>
);
