import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, AlertCircle, Lock, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardPath } from '../config/roles';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      const redirect = searchParams.get('redirect');
      // Only honour same-app relative redirects, never an absolute URL.
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        navigate(redirect);
      } else {
        navigate(getDashboardPath(user.role));
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
            <Activity className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in to Swasthya AI</h1>
          <p className="text-xs text-slate-500">
            Access your patient records or authenticated healthcare workspace
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. patient@swasthya.demo"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Fast Fill Section */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Quick Fill Demo Accounts:
            </span>
            <span className="font-mono text-[10px] text-slate-400">Password123!</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-left">
            <button
              type="button"
              onClick={() => fillDemo('patient@swasthya.demo')}
              className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 border border-slate-200 transition-colors truncate"
            >
              Patient (Rahul)
            </button>
            <button
              type="button"
              onClick={() => fillDemo('doctor.sharma@swasthya.demo')}
              className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 border border-slate-200 transition-colors truncate"
            >
              Hospital Doctor
            </button>
            <button
              type="button"
              onClick={() => fillDemo('hospital.admin@swasthya.demo')}
              className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 border border-slate-200 transition-colors truncate"
            >
              Hospital Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemo('pharmacy.owner@swasthya.demo')}
              className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 border border-slate-200 transition-colors truncate"
            >
              Pharmacy Owner
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 pt-2 space-y-2">
          <div>
            <Link to="/forgot-password" className="font-semibold text-indigo-600 hover:text-indigo-700 underline">
              Forgot your password?
            </Link>
          </div>
          <div>
            New patient?{' '}
            <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-700 underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
