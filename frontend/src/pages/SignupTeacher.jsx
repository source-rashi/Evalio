import React, { useEffect } from 'react';
import { SignUp, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function SignupTeacher() {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && user) {
      // Store role as teacher
      localStorage.setItem('role', 'teacher');
      // Redirect to teacher dashboard
      navigate('/teacher');
    }
  }, [isSignedIn, user, navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Sign up as Teacher</h2>
          <p className="text-sm text-text-secondary mt-1">Create your teacher account to start evaluating exams</p>
        </div>
        <SignUp 
          routing="path" 
          path="/signup/teacher"
          signInUrl="/login"
          afterSignUpUrl="/teacher"
          publicMetadata={{
            role: 'teacher'
          }}
        />
      </div>
    </div>
  );
}
