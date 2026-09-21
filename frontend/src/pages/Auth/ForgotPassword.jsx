import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { authAPI } from '../../services/api';
import { validateEmailField } from '../../utils/validators';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [simulatedToken, setSimulatedToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateEmailField(email, true);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await authAPI.forgotPassword({ email });
      if (data.success) {
        setSuccess(true);
        setSimulatedToken(data.resetToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Email address not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 font-sans select-none overflow-hidden relative transition-colors duration-300">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[140px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl relative z-10"
      >
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Login
          </Link>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Recover Password</h2>
          <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-2">
            Enter your email address to receive password reset instructions
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {success ? (
          <div className="space-y-5">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-lg space-y-1">
              <p className="font-semibold">✓ Reset code generated successfully!</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Use the security token below to proceed with resetting your password.</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Reset Token:</p>
              <p className="text-[10px] font-mono break-all text-blue-600 dark:text-blue-400 mt-1 select-text bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">{simulatedToken}</p>
            </div>

            <button
              onClick={() => navigate('/reset-password', { state: { token: simulatedToken } })}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Go to Reset Password Screen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Registered Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <EnvelopeIcon className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kiranamart.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Generating Code...' : 'Request Reset Code'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

