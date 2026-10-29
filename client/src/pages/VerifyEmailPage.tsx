import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Mail, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleVerify = async () => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided in URL.');
      return;
    }

    try {
      setStatus('loading');
      const res: any = await api.post('/auth/verify-email', { token });
      if (res.success) {
        setStatus('success');
        setMessage(res.message || 'Email verified successfully!');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Verification failed. The token may be expired or invalid.');
    }
  };

  useEffect(() => {
    // If token exists in URL, prompt or auto-verify
    if (token) {
      handleVerify();
    }
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
        {status === 'success' ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Email Verified!</h1>
            <p className="text-sm text-slate-600">
              {message} Your account is verified. You can now log in to access your patient dashboard.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : status === 'error' ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verification Issue</h1>
            <p className="text-sm text-rose-700">{message}</p>
            <Link to="/login" className="text-xs font-bold text-indigo-600 hover:underline block pt-2">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <Mail className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verify Your Email</h1>
            <p className="text-sm text-slate-600">
              {email ? `Simulated verification link sent to ${email}.` : 'Click the button below to confirm your simulated email verification.'}
            </p>
            <button
              onClick={handleVerify}
              disabled={status === 'loading'}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all"
            >
              {status === 'loading' ? 'Verifying...' : 'Confirm Demo Email Verification'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
