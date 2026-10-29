import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

/**
 * Requests a password reset link.
 *
 * The API answers identically whether or not the address exists, so this page
 * never reveals account existence. When email delivery is not configured the
 * API reports that truthfully instead of pretending a mail was sent.
 */
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const [demoResetLink, setDemoResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setDeliveryNotice(null);
    setDemoResetLink(null);

    try {
      // `unwrap` returns the envelope's `data` payload directly.
      const res: any = await api.post('/auth/forgot-password', { email }, { auth: false, unwrap: true });
      setSent(true);

      const delivery = res?.delivery;
      if (delivery?.status === 'not_configured') {
        setDeliveryNotice(
          'Email delivery is not configured on this deployment, so no message was sent.'
        );
        // The API only exposes this outside production, for local testing.
        if (delivery.demoResetLink) setDemoResetLink(delivery.demoResetLink);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to process the request right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reset your password</h1>
          <p className="text-xs text-slate-500">
            Enter the email on your account and we will send a reset link if it exists.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                If an account exists for <strong>{email}</strong>, a reset link has been generated. The link
                expires in one hour.
              </span>
            </div>

            {deliveryNotice && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <p className="font-semibold mb-1">Not configured</p>
                <p>{deliveryNotice}</p>
                {demoResetLink && (
                  <p className="mt-2 break-all">
                    Local test link:{' '}
                    <Link to={demoResetLink} className="font-mono text-[11px] underline text-amber-800">
                      {demoResetLink}
                    </Link>
                  </p>
                )}
              </div>
            )}

            <Link
              to="/login"
              className="block w-full py-3 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Send reset link'}
            </button>

            <div className="text-center text-xs text-slate-500">
              <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 underline">
                Return to sign in
              </Link>
            </div>
          </form>
        )}

        <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
          <Activity className="w-3.5 h-3.5" />
          <span>Swasthya AI account security</span>
        </div>
      </div>
    </div>
  );
};
