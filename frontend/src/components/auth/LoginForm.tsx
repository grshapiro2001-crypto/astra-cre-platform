import { useState, useId, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authSlice';

export const LoginForm = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const id = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // Error handled by store
    }
  };

  const handleGoogleSignIn = () => {
    // Google Sign-In will be wired to backend OAuth endpoint
    // For now, show that the flow is ready for integration
    alert('Google Sign-In requires backend OAuth setup. Use email/password for now.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#060608' }}>
      {/* Subtle radial glow */}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 40%, rgba(255,255,255,0.02) 0%, transparent 70%)' }} />

      <div className="w-full max-w-[400px] rounded-2xl border border-white/[0.04] bg-[#0c0c0f] p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5" />
              <circle cx="12" cy="12" r="2" fill="#ffffff" stroke="none" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight text-ivory">Welcome back</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Enter your credentials to sign in.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 mb-5">
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={`${id}-email`} className="text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                id={`${id}-email`}
                type="email"
                placeholder="you@yourfirm.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-ivory shadow-sm placeholder:text-zinc-700 focus:border-white/15 focus:outline-none focus:ring-[3px] focus:ring-white/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-password`} className="text-sm font-medium text-zinc-300">
                Password
              </label>
              <input
                id={`${id}-password`}
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-ivory shadow-sm placeholder:text-zinc-700 focus:border-white/15 focus:outline-none focus:ring-[3px] focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="size-4 rounded border border-white/10 bg-white/[0.03] accent-white" />
              <span className="text-sm text-zinc-500">Remember me</span>
            </label>
            <a href="#" className="text-sm text-zinc-500 underline hover:no-underline hover:text-zinc-300 transition-colors">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-9 rounded-lg bg-white text-[#060608] text-sm font-semibold shadow-sm hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 transition-all"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-xs text-zinc-600">Or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm font-medium text-zinc-300 shadow-sm hover:bg-white/[0.06] hover:text-ivory transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Login with Google
        </button>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-zinc-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-zinc-400 underline hover:no-underline hover:text-ivory transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};
