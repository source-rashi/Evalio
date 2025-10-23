import React from 'react';
import { BookOpen, GraduationCap, LogOut, UserCircle2 } from 'lucide-react';

export default function Header({ token, onLogout }) {
  return (
    <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <GraduationCap size={18} />
          </div>
          <div className="font-heading font-bold text-lg text-text-primary tracking-wide">Evalio</div>
          <span className="text-text-secondary text-sm hidden sm:inline">AI-Powered Smart Evaluation</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" className="hidden sm:inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors">
            <BookOpen size={16} /> Docs
          </a>
          <div className="w-px h-6 bg-gray-200" />
          {token ? (
            <button onClick={onLogout} className="inline-flex items-center gap-1 text-sm text-white bg-primary hover:bg-indigo-600 px-3 py-2 rounded-lg">
              <LogOut size={16} /> Logout
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-text-secondary">
              <UserCircle2 size={18} /> Guest
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
