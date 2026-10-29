import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle2, Lock, Mail, Phone, User, Eye, EyeOff, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'hi'>('en');
  const [role, setRole] = useState<string>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Password strength calculator
  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 12) strength += 1;
    if (pwd.length >= 16) strength += 1;
    if (/[A-Z]/.test(pwd)) strength += 1;
    if (/[a-z]/.test(pwd)) strength += 1;
    if (/[0-9]/.test(pwd)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 4 ? 'Medium' : 'Strong';
  const strengthColor = passwordStrength <= 2 ? 'bg-rose-500' : passwordStrength <= 4 ? 'bg-amber-500' : 'bg-green-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res: any = await api.post('/auth/signup', {
        name,
        email,
        phone,
        password,
        preferredLanguage,
        role,
      });

      if (res.success) {
        // Direct user to email verification demo page with token
        navigate(`/verify-email?token=${res.verificationToken}&email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-purple-50 via-white to-indigo-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-20 right-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }}></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-2"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: -5 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 text-white flex items-center justify-center mx-auto shadow-xl shadow-purple-500/30"
            >
              <Activity className="w-9 h-9" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Account</h1>
            <p className="text-sm text-slate-500">
              Join Swasthya AI to manage your healthcare journey
            </p>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
              <div className="relative">
                <User className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${nameFocused ? 'text-indigo-600' : 'text-slate-400'}`} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="e.g. Ramesh Kumar"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 text-sm outline-none font-medium transition-all ${nameFocused ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 focus:border-indigo-500'}`}
                />
                {name && name.length >= 2 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </motion.div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${emailFocused ? 'text-indigo-600' : 'text-slate-400'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="ramesh@example.com"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 text-sm outline-none font-medium transition-all ${emailFocused ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 focus:border-indigo-500'}`}
                />
                {email && email.includes('@') && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </motion.div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-bold text-slate-700 mb-2">Mobile Phone (Optional)</label>
              <div className="relative">
                <Phone className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${phoneFocused ? 'text-indigo-600' : 'text-slate-400'}`} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  placeholder="+91 98260 00000"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 text-sm outline-none font-medium transition-all ${phoneFocused ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 focus:border-indigo-500'}`}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <Lock className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${passwordFocused ? 'text-indigo-600' : 'text-slate-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  className={`w-full pl-12 pr-12 py-3.5 rounded-xl border-2 text-sm outline-none font-medium transition-all ${passwordFocused ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 focus:border-indigo-500'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">Password Strength:</span>
                    <span className={`text-xs font-bold ${passwordStrength <= 2 ? 'text-rose-600' : passwordStrength <= 4 ? 'text-amber-600' : 'text-green-600'}`}>
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(passwordStrength / 6) * 100}%` }}
                      className={`h-full ${strengthColor} transition-all`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <div className={password.length >= 12 ? 'text-green-600' : ''}>• Min 12 characters</div>
                    <div className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>• Uppercase letter</div>
                    <div className={/[0-9]/.test(password) ? 'text-green-600' : ''}>• Number</div>
                    <div className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>• Special character</div>
                  </div>
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-sm font-bold text-slate-700 mb-2">Account Role (dev/demo)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-sm outline-none font-medium bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              >
                <option value="patient">Patient</option>
                <option value="hospital_doctor">Hospital Doctor</option>
                <option value="private_doctor">Private Doctor</option>
                <option value="homeopathy_doctor">Homeopathy Doctor</option>
                <option value="hospital_admin">Hospital Admin</option>
                <option value="hospital_receptionist">Receptionist</option>
                <option value="medical_store_owner">Pharmacy Owner</option>
                <option value="lab_admin">Lab Admin</option>
                <option value="nurse">Nurse</option>
                <option value="bed_manager">Bed Manager</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Role selection works in development/demo mode only.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 }}
            >
              <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Language</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    checked={preferredLanguage === 'en'}
                    onChange={() => setPreferredLanguage('en')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  English
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    checked={preferredLanguage === 'hi'}
                    onChange={() => setPreferredLanguage('hi')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  हिंदी (Hindi)
                </label>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Activity className="w-5 h-5" />
                  </motion.div>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </motion.button>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-sm text-slate-500 pt-4 border-t border-slate-100"
          >
            Already registered?{' '}
            <Link to="/login" className="font-bold text-purple-600 hover:text-purple-700 transition-colors">
              Sign In
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
