import React, { useEffect } from 'react';
import { SignUp, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function Signup() {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && user) {
      // Check user's role from metadata and redirect accordingly
      const role = user.publicMetadata?.role || 'student';
      localStorage.setItem('role', role);
      navigate(role === 'teacher' ? '/teacher' : '/student');
    }
  }, [isSignedIn, user, navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <SignUp 
          routing="path" 
          path="/signup"
          signInUrl="/login"
          afterSignUpUrl="/teacher"
        />
      </div>
    </div>
  );
}
