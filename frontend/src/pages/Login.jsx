import React, { useEffect } from 'react';
import { SignIn, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && user) {
      // Check user's role from metadata and redirect accordingly
      // Try unsafeMetadata first (set during signup), then publicMetadata, then default to teacher
      const role = user.unsafeMetadata?.role || user.publicMetadata?.role || 'teacher';
      localStorage.setItem('role', role);
      navigate(role === 'teacher' ? '/teacher' : '/student');
    }
  }, [isSignedIn, user, navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Welcome back</h2>
          <p className="text-sm text-text-secondary mt-1">Sign in to your Evalio account</p>
        </div>
        <SignIn 
          routing="virtual"
          signUpUrl="/signup"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none'
            }
          }}
        />
      </div>
    </div>
  );
}
