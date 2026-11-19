import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { apiFetch, setStoredToken } from '../lib/api';
import type { UserAccount, UserRole } from '../types';

interface AuthGateProps {
  onAuthenticated: (user: UserAccount) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('alex@tkdhub.com');
  const [password, setPassword] = useState('Student2026!');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email: email.trim(), password }
          : { name: name.trim(), email: email.trim(), password, role, phone: phone.trim(), emergencyContact: emergencyContact.trim() };

      const res = await apiFetch<{ token: string; user: UserAccount }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (demoRole: UserRole) => {
    setMode('login');
    setError('');
    const creds =
      demoRole === 'student'
        ? { email: 'alex@tkdhub.com', password: 'Student2026!' }
        : demoRole === 'instructor'
          ? { email: 'elena@tkdhub.com', password: 'Instructor2026!' }
          : { email: 'admin@tkdhub.com', password: 'TkdAdmin2026!' };

    setEmail(creds.email);
    setPassword(creds.password);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(creds),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with demo account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0F12] text-white flex flex-col lg:grid lg:grid-cols-12">
      {/* Left Hero Column */}
      <div className="lg:col-span-7 relative flex flex-col justify-between p-8 lg:p-14 overflow-hidden border-b lg:border-b-0 lg:border-r border-[#23262E]">
        {!heroImgFailed && (
          <img
            src="/src/assets/images/hero_dojang_training_1795076516695.jpg"
            alt="Taekwondo athletes training inside the TKD Training Hub dojang"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-45"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0D0F12] via-[#0D0F12]/70 to-[#0D0F12]/50"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#C81E2B] flex items-center justify-center font-display font-bold text-sm tracking-tight text-white">
              태권
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap">
              TKD Training Hub
            </span>
          </div>
          <span className="text-xs font-mono text-[#C59B27] tracking-wide">Kukkiwon Curriculum</span>
        </div>

        <div className="relative z-10 max-w-2xl py-10 lg:py-0">
          <p className="text-xs font-medium text-[#C59B27] mb-3 tracking-wide">
            Dojang Training & Progression System
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-white [text-wrap:balance]">
            Discipline, technique, and measurable progression on every mat.
          </h1>
          <p className="mt-5 text-base text-[#D1D5DB] leading-relaxed max-w-xl">
            Manage Taekwondo curricula from White Belt fundamentals through Black Belt Poomsae, coordinate training sessions, record attendance, and track physical conditioning across your entire academy.
          </p>

          <div className="mt-8 pt-8 border-t border-white/15 grid grid-cols-3 gap-6">
            <div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-white">23</div>
              <div className="text-xs text-[#9CA3AF] mt-1">Structured Drills</div>
            </div>
            <div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-white">6 Ranks</div>
              <div className="text-xs text-[#9CA3AF] mt-1">White to Black Belt</div>
            </div>
            <div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-white">3 Roles</div>
              <div className="text-xs text-[#9CA3AF] mt-1">Student · Coach · Admin</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-[#9CA3AF] flex flex-wrap items-center gap-3">
          <span>Respect</span>
          <span aria-hidden="true">·</span>
          <span>Perseverance</span>
          <span aria-hidden="true">·</span>
          <span>Self-Control</span>
          <span aria-hidden="true">·</span>
          <span>Indomitable Spirit</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:col-span-5 bg-white text-[#111317] flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#111317]">
              {mode === 'login' ? 'Academy Sign In' : 'Create Academy Account'}
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">
              {mode === 'login'
                ? 'Access your training dashboard, schedule, and belt progress.'
                : 'Register as a Taekwondo student or instructor.'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 p-1 bg-[#F3F4F6] rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280] hover:text-[#111317]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280] hover:text-[#111317]'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="auth-name">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Jordan Lee"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C81E2B]/25 focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#374151] mb-1.5">Account Role</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                        role === 'student'
                          ? 'border-[#C81E2B] bg-[#C81E2B]/5 text-[#C81E2B]'
                          : 'border-[#E5E7EB] text-[#4B5563] hover:border-[#D1D5DB]'
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('instructor')}
                      className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                        role === 'instructor'
                          ? 'border-[#C81E2B] bg-[#C81E2B]/5 text-[#C81E2B]'
                          : 'border-[#E5E7EB] text-[#4B5563] hover:border-[#D1D5DB]'
                      }`}
                    >
                      Instructor
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="auth-email">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@tkdhub.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C81E2B]/25 focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="auth-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C81E2B]/25 focus:border-[#C81E2B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-[#111317]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="auth-phone">
                    Phone Number
                  </label>
                  <input
                    id="auth-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(415) 555-0190"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C81E2B]/25 focus:border-[#C81E2B]"
                  />
                </div>
                {role === 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="auth-emergency">
                      Emergency Contact
                    </label>
                    <input
                      id="auth-emergency"
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="Name · Phone"
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C81E2B]/25 focus:border-[#C81E2B]"
                    />
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#C81E2B] hover:bg-[#A61722] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{submitting ? 'Please wait...' : mode === 'login' ? 'Sign In to Dojang' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode === 'login' && (
            <div className="pt-5 border-t border-[#E5E7EB] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#111317]">One-Click Demo Accounts</p>
                <span className="text-[11px] text-[#6B7280]">Instant sign-in</span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoSignIn('student')}
                  className="w-full px-3.5 py-2.5 text-left border border-[#E5E7EB] rounded-lg hover:border-[#C81E2B] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between gap-3 cursor-pointer disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#111317]">Student Demo · Alex Rivera (Blue Belt)</div>
                    <div className="text-[11px] font-mono text-[#6B7280] truncate">alex@tkdhub.com · Student2026!</div>
                  </div>
                  <span className="text-xs font-semibold text-[#C81E2B] whitespace-nowrap shrink-0">Sign In</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoSignIn('instructor')}
                  className="w-full px-3.5 py-2.5 text-left border border-[#E5E7EB] rounded-lg hover:border-[#C81E2B] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between gap-3 cursor-pointer disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#111317]">Instructor Demo · Sabumnim Elena Vance</div>
                    <div className="text-[11px] font-mono text-[#6B7280] truncate">elena@tkdhub.com · Instructor2026!</div>
                  </div>
                  <span className="text-xs font-semibold text-[#C81E2B] whitespace-nowrap shrink-0">Sign In</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoSignIn('admin')}
                  className="w-full px-3.5 py-2.5 text-left border border-[#E5E7EB] rounded-lg hover:border-[#C81E2B] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between gap-3 cursor-pointer disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#111317]">Admin Demo · Master Min-ho Park</div>
                    <div className="text-[11px] font-mono text-[#6B7280] truncate">admin@tkdhub.com · TkdAdmin2026!</div>
                  </div>
                  <span className="text-xs font-semibold text-[#C81E2B] whitespace-nowrap shrink-0">Sign In</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
