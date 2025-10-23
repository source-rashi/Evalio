import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Brain, Eye, BarChart3, Shield, GraduationCap } from 'lucide-react';

export default function Landing() {
  const features = [
    { icon: Brain, title: 'Auto grading using AI and NLP', desc: 'Semantic comparison with model answers and keypoints using advanced NLP.' },
    { icon: Eye, title: 'Handwriting recognition using Vision AI', desc: 'Reads handwritten or typed answers from scanned images and PDFs.' },
    { icon: BarChart3, title: 'Instant feedback and performance reports', desc: 'Get detailed feedback, score breakdowns, and actionable insights.' },
    { icon: Shield, title: 'Secure cloud-based evaluation', desc: 'Your data is encrypted and stored securely with enterprise-grade protection.' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      {/* Header/Nav */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-primary" size={24} />
            <span className="font-heading font-bold text-lg">Evalio</span>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-sm text-text-secondary">
            <a href="#features" className="hover:text-text-primary">Features</a>
            <a href="#docs" className="hover:text-text-primary">Docs</a>
            <Link to="/login" className="bg-primary hover:bg-indigo-600 text-white px-3 py-2 rounded-lg">Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles size={16} /> AI-Powered Smart Exam Evaluation
        </div>
        <h1 className="font-heading font-bold text-4xl md:text-6xl text-text-primary leading-tight">
          Upload answer sheets.<br />Let AI grade and give feedback instantly.
        </h1>
        <p className="text-text-secondary mt-4 max-w-2xl mx-auto text-lg">
          Evalio automates exam evaluation with AI-powered grading, handwriting recognition, and detailed performance analytics — saving you hours and improving learning outcomes.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link className="bg-primary hover:bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow" to="/signup">
            Get Started (for Teachers)
          </Link>
          <Link className="border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50" to="/demo">
            Explore Demo (for Students)
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="font-heading font-bold text-3xl text-text-primary text-center mb-8">Why choose Evalio?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <f.icon size={24} />
                </div>
                <div>
                  <div className="font-semibold text-text-primary">{f.title}</div>
                  <div className="text-text-secondary text-sm mt-1">{f.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-text-secondary text-sm">
          <div className="flex items-center justify-center gap-4 mb-2">
            <a href="#docs" className="hover:text-text-primary">Docs</a>
            <a href="#contact" className="hover:text-text-primary">Contact</a>
            <a href="#credits" className="hover:text-text-primary">Credits</a>
          </div>
          <p>© 2025 Evalio. AI-Powered Smart Exam Evaluation.</p>
        </div>
      </footer>
    </div>
  );
}
