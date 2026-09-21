import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BuildingStorefrontIcon, 
  UserIcon, 
  EnvelopeIcon, 
  LockClosedIcon, 
  PhoneIcon, 
  MapPinIcon, 
  SparklesIcon, 
  CheckCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { authAPI } from '../../services/api';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/slices/authSlice';
import ThemeToggle from '../../components/common/ThemeToggle';
import { validateEmailField } from '../../utils/validators';

const Register = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [form, setForm] = useState({
    store_name: '',
    owner_name: '',
    email: '',
    password: '',
    phone: '',
    address: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    let val = e.target.value;
    if (e.target.name === 'phone') {
      val = val.replace(/\D/g, '').slice(0, 10);
    }
    setForm({ ...form, [e.target.name]: val });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.store_name.trim() || !form.owner_name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Please fill in all required fields (Store Name, Owner Name, Email, Password).');
      return;
    }

    const emailErr = validateEmailField(form.email, true);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.phone && form.phone.replace(/\D/g, '').length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authAPI.registerStore(form);
      if (res.success && res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        dispatch(setCredentials({ token: res.token, user: res.user }));
        navigate('/dashboard', { replace: true });
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Server error during store registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 font-sans select-none overflow-y-auto relative transition-colors duration-300">
      
      {/* Floating Theme Toggle */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>
      
      {/* Decorative backdrop ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 my-6"
      >
        {/* LEFT BRANDING PANEL */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-100 border border-white/20 text-xs font-semibold uppercase tracking-wider">
              <SparklesIcon className="w-4 h-4 text-white" />
              7-Day Free Trial Included
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white">
                Start Your Store Today
              </h2>
              <p className="text-xs text-blue-100 font-normal mt-2 leading-relaxed">
                Join thousands of merchants automating POS billing, inventory, and customer credit ledgers.
              </p>
            </div>

            {/* FEATURES BULLETS */}
            <div className="space-y-3 pt-2">
              {[
                'Dedicated Multi-Tenant Database',
                'POS Billing & Thermal Receipts',
                'Customer Udhaar & Ledger Sync',
                'Real-Time Stock Alerts & Reports'
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs font-medium text-white">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {feat}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/20 mt-8">
            <p className="text-xs text-blue-100 font-normal">
              Already registered your store?
            </p>
            <Link 
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:underline mt-1 cursor-pointer"
            >
              Sign In To Merchant Portal <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RIGHT REGISTRATION FORM */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create Merchant Store Account
            </h3>
            <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">
              Set up your store operations &mdash; No credit card required.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Store Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Store Name *
                </label>
                <div className="relative">
                  <BuildingStorefrontIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="store_name"
                    value={form.store_name}
                    onChange={handleChange}
                    autoComplete="organization"
                    placeholder="Enter store name"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Owner Full Name *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="owner_name"
                    value={form.owner_name}
                    onChange={handleChange}
                    autoComplete="name"
                    placeholder="Enter owner full name"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Admin Email Address *
                </label>
                <div className="relative">
                  <EnvelopeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    placeholder="Email"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <LockClosedIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="Password"
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <PhoneIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    autoComplete="off"
                    placeholder="Contact No."
                    maxLength={10}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Store Address
                </label>
                <div className="relative">
                  <MapPinIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    autoComplete="off"
                    placeholder="Address"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up store...
                </>
              ) : (
                <>
                  Register Store & Start Free Trial <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;

