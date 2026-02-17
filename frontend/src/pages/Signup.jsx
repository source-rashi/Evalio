import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Users } from 'lucide-react';

export default function Signup() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border p-8 shadow-sm w-full max-w-md">
        <h1 className="font-heading font-semibold text-text-primary text-2xl text-center mb-2">Sign up for Evalio</h1>
        <p className="text-text-secondary text-sm text-center mb-8">Choose your account type to get started</p>
        
        <div className="flex flex-col gap-4">
          <Link 
            to="/signup/teacher" 
            className="flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <GraduationCap size={28} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-text-primary text-lg">Teacher Account</div>
              <div className="text-text-secondary text-sm">Create and evaluate exams</div>
            </div>
          </Link>
          
          <Link 
            to="/signup/student" 
            className="flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Users size={28} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-text-primary text-lg">Student Account</div>
              <div className="text-text-secondary text-sm">Take exams and view results</div>
            </div>
          </Link>
        </div>
        
        <div className="text-sm text-text-secondary text-center mt-6">
          Already have an account? <Link className="text-primary hover:underline" to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
