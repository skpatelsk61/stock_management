


import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleTheme } from '../../store/slices/themeSlice';
import ThemeToggle from '../../components/common/ThemeToggle';
import {
  ArrowRightIcon,
  SparklesIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  BookOpenIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  QrCodeIcon,
  TruckIcon,
  BellAlertIcon,
  ChartBarIcon,
  StarIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis } from 'recharts';

const Landing = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { isDarkMode } = useAppSelector((state) => state.theme);
  const [openFaq, setOpenFaq] = useState(0);

  const previewChartData = [
    { name: 'Mon', Sales: 12000 },
    { name: 'Tue', Sales: 19000 },
    { name: 'Wed', Sales: 17000 },
    { name: 'Thu', Sales: 24000 },
    { name: 'Fri', Sales: 22000 },
    { name: 'Sat', Sales: 30000 },
    { name: 'Sun', Sales: 52840 }
  ];

  const previewPieData = [
    { name: 'Groceries', value: 45, color: '#2563EB' },
    { name: 'Snacks', value: 25, color: '#4F46E5' },
    { name: 'Beverages', value: 15, color: '#0F172A' },
    { name: 'Others', value: 15, color: '#F59E0B' }
  ];

  const khataCustomers = [
    { name: 'Suresh Auto Works', due: 4250, status: 'due', last: '3 days ago' },
    { name: 'Meena Beauty Parlour', due: 1180, status: 'due', last: 'Today' },
    { name: 'Patel Tiffin Service', due: 0, status: 'clear', last: 'Yesterday' },
    { name: 'Rajesh (Flat 4B)', due: 620, status: 'due', last: '1 week ago' }
  ];

  const modules = [
    { icon: <QrCodeIcon className="w-5 h-5" />, label: 'POS Billing', desc: 'Barcode & weighing-scale ready' },
    { icon: <Squares2X2Icon className="w-5 h-5" />, label: 'Inventory', desc: 'Stock, batches & expiry dates' },
    { icon: <TruckIcon className="w-5 h-5" />, label: 'Purchases', desc: 'Supplier orders & payables' },
    { icon: <BookOpenIcon className="w-5 h-5" />, label: 'Credit Ledger', desc: 'Digital customer credit book' },
    { icon: <ChartBarIcon className="w-5 h-5" />, label: 'Reports', desc: 'GST-ready sales & profit' },
    { icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />, label: 'WhatsApp Alerts', desc: 'Bills, reminders, low stock' }
  ];

  const faqs = [
    { q: 'Will it work without the internet?', a: 'Yes. Billing and stock updates work offline, and your data syncs automatically when the connection is restored.' },
    { q: 'Is the app available in Hindi too?', a: 'Yes. The dashboard and billing screen can switch between Hindi and English with a single tap.' },
    { q: 'How much training will my staff need?', a: 'Very little. The POS billing screen is as simple as a calculator, so most store teams become comfortable within a day.' },
    { q: 'Can I import data from my old stock register?', a: 'Yes. You can import your current stock from Excel or CSV, and the onboarding team can help you set it up.' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-x-hidden transition-colors duration-300">

      {/* 1. Header Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 lg:px-10 py-3.5 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Stock Management Logo"
            className="h-9 w-auto object-contain bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">Stock Management</h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Enterprise Store OS</p>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
          <a href="#khata" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Credit Ledger</a>
          <a href="#modules" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Modules</a>
          <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            to="/register"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all"
          >
            <SparklesIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Register Store
          </Link>

          <Link
            to={isAuthenticated ? '/dashboard' : '/login'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Sign In <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 px-6 max-w-7xl mx-auto flex flex-col xl:flex-row gap-12 items-center">

        <div className="absolute top-12 left-1/4 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 translate-x-1/2 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 space-y-6 text-center xl:text-left z-10"
        >
          {/* Neutral SaaS Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            <SparklesIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Next-Gen Inventory & POS Operating System
          </div>

          {/* Dominant Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Manage Your Business <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
              Smarter, Faster, Better.
            </span>
          </h2>

          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto xl:mx-0 font-normal">
            Streamline inventory control, high-speed POS billing, digital customer credit, supplier purchases, and GST compliance in one unified cloud platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-3.5 justify-center xl:justify-start">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
            >
              Start Free Trial <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg text-sm font-semibold shadow-sm transition-all"
            >
              Sign In To Store <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center justify-center xl:justify-start gap-4 pt-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <StarIcon key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Trusted by <span className="font-bold text-slate-900 dark:text-white">5,000+ businesses</span> across India
            </p>
          </div>
        </motion.div>

        {/* Right Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-1 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden relative z-10"
        >
          <div className="w-full h-[410px] flex">

            {/* Dark Navy Sidebar */}
            <div className="w-[140px] sm:w-[170px] bg-[#0F172A] p-4 flex flex-col justify-between text-slate-300 select-none flex-shrink-0">
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    S
                  </div>
                  <span className="text-xs font-bold text-white truncate">Stock OS</span>
                </div>

                <div className="space-y-1">
                  {[
                    { label: 'Dashboard', active: true, icon: '📊' },
                    { label: 'POS Billing', active: false, icon: '🧾' },
                    { label: 'Inventory', active: false, icon: '📦' },
                    { label: 'Credit Ledger', active: false, icon: '📒' },
                    { label: 'Purchases', active: false, icon: '🚚' },
                    { label: 'Customers', active: false, icon: '👥' },
                    { label: 'Reports', active: false, icon: '📈' },
                    { label: 'Settings', active: false, icon: '⚙️' }
                  ].map((navItem) => (
                    <div
                      key={navItem.label}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                        navItem.active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-xs">{navItem.icon}</span>
                      <span className="truncate">{navItem.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-[8px] font-bold text-slate-300">
                  <span>PRO PLAN</span>
                  <span className="bg-emerald-500/20 text-emerald-400 px-1 rounded text-[7px]">Active</span>
                </div>
                <p className="text-[7px] text-slate-400 truncate">Sync: Realtime</p>
              </div>
            </div>

            {/* Main Mockup Area */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 overflow-hidden flex flex-col justify-between space-y-3">

              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Store Dashboard</h4>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">Overview for today</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded text-[9px] font-medium">
                    ● System Online
                  </span>
                  <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[9px] font-bold flex items-center justify-center text-slate-700 dark:text-slate-300">
                    AD
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg space-y-0.5 shadow-xs">
                  <p className="text-[8px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Products</p>
                  <p className="text-[11px] font-bold text-slate-900 dark:text-white">1,248</p>
                  <span className="inline-block px-1.5 py-0.2 rounded text-[7px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">In Stock</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg space-y-0.5 shadow-xs">
                  <p className="text-[8px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock Value</p>
                  <p className="text-[11px] font-bold text-slate-900 dark:text-white">₹8.42L</p>
                  <span className="inline-block px-1.5 py-0.2 rounded text-[7px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">Valuation</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg space-y-0.5 shadow-xs">
                  <p className="text-[8px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Low Stock</p>
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">24 Items</p>
                  <span className="inline-block px-1.5 py-0.2 rounded text-[7px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Needs Refill</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg space-y-0.5 shadow-xs">
                  <p className="text-[8px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Sales</p>
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">₹52,840</p>
                  <span className="inline-block px-1.5 py-0.2 rounded text-[7px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">+14.2%</span>
                </div>
              </div>

              {/* Chart & Category Distribution */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                <div className="sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[8px] font-semibold text-slate-600 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Weekly Sales Trend</span>
                    <span className="text-[7px] text-slate-400">₹52,840 Today</span>
                  </div>
                  <div className="h-24 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={previewChartData} margin={{ top: 2, right: 2, left: -32, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPreviewSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 6, fill: '#64748B' }} stroke="#E2E8F0" tickLine={false} />
                        <YAxis tick={{ fontSize: 6, fill: '#64748B' }} stroke="#E2E8F0" tickLine={false} axisLine={false} />
                        <Area type="monotone" dataKey="Sales" stroke="#2563EB" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPreviewSales)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg flex flex-col justify-between">
                  <div className="text-[8px] font-semibold text-slate-600 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Category Mix</span>
                  </div>
                  <div className="h-14 w-full flex items-center justify-center relative my-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={previewPieData} cx="50%" cy="50%" innerRadius={16} outerRadius={24} dataKey="value">
                          {previewPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-0.5 text-[6px] text-slate-500 font-medium">
                    {previewPieData.map(item => (
                      <div key={item.name} className="flex items-center gap-1 truncate">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. Feature cards */}
      <section id="features" className="py-16 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />, title: 'Real-time Inventory Control', desc: 'Track stock movement instantly across sales, purchases, and multi-location warehouses.' },
            { icon: <BellAlertIcon className="w-5 h-5 text-amber-500" />, title: 'Low Stock & Expiry Alerts', desc: 'Automated warnings before stockouts occur or products cross shelf life limits.' },
            { icon: <QrCodeIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />, title: 'High-Speed POS Billing', desc: 'Barcode scanner & weighing scale integration for instantaneous checkout.' },
            { icon: <BookOpenIcon className="w-5 h-5 text-rose-500" />, title: 'Digital Credit Ledger', desc: 'Manage customer credit balances with automated WhatsApp payment reminders.' },
            { icon: <ChartBarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />, title: 'GST-Ready Financial Reports', desc: 'Generate GSTR-1, sales summaries, and profit analytics in one click.' },
            { icon: <GlobeAltIcon className="w-5 h-5 text-sky-500" />, title: 'Multilingual & Offline Mode', desc: 'Seamlessly switch between Hindi & English with full offline capability.' }
          ].map((f, idx) => (
            <div key={idx} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all space-y-2">
              <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
                {f.icon}
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{f.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Digital Khata signature section */}
      <section id="khata" className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-5"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <BookOpenIcon className="w-3.5 h-3.5" /> Customer Credit Ledger
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
            Every rupee owed, <br />
            tracked accurately without paper.
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md font-normal">
            Eliminate traditional paper registers. Maintain exact running balances, send instant WhatsApp reminder links, and reconcile accounts in real time.
          </p>
          <ul className="space-y-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Automated WhatsApp payment payment links</li>
            <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Complete transaction audit log per customer</li>
            <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Instant offline logging with auto-cloud sync</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Active Credit Accounts</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Gupta Kirana Store</p>
            </div>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-full">
              ₹6,050 total due
            </span>
          </div>

          <div className="space-y-3">
            {khataCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{c.last}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${c.status === 'clear' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                    {c.status === 'clear' ? 'Cleared' : `₹${c.due.toLocaleString()}`}
                  </span>
                  {c.status === 'due' && (
                    <button className="text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded transition-all flex items-center gap-1">
                      <ChatBubbleLeftRightIcon className="w-3 h-3" /> Remind
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 5. How it works */}
      <section className="py-16 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-2 mb-12">
            <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Quick Onboarding</h3>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Up and running in 15 minutes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Import Catalog & Stock', desc: 'Bulk import products via CSV/Excel or add items on the fly.' },
              { step: '02', title: 'Checkout & Credit Sync', desc: 'Process POS billing at lightning speed and record customer credit.' },
              { step: '03', title: 'Monitor & Automate', desc: 'Track profit margins, automated reorder points, and tax reports.' }
            ].map((s, i) => (
              <div key={i} className="relative p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <span className="text-3xl font-extrabold text-blue-600/20 dark:text-blue-400/20">{s.step}</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{s.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-normal">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Modules grid */}
      <section id="modules" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Complete Feature Suite</h3>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Modules tailored for high-volume retail</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {modules.map((m, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center hover:border-blue-500/50 hover:shadow-md transition-all">
              <div className="h-10 w-10 mx-auto rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                {m.icon}
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{m.label}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Trusted-by strip */}
      <section className="py-10 bg-slate-100/60 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 justify-center md:justify-start">
              Empowering <span className="text-blue-600 dark:text-blue-400">5,000+</span> stores nationwide
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Modern tech for traditional & modern retail</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-slate-400 dark:text-slate-500 font-bold text-xs select-none">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" /> More Megastore
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" /> Apna Bazar
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" /> Sahaj Kirana
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" /> Goyal Store
            </div>
          </div>
        </div>
      </section>

      {/* 8. Pricing */}
      <section id="pricing" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Simple & Transparent Pricing</h3>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Predictable plans for growing businesses</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { plan: 'Starter Pack', price: '₹800', features: ['Up to 500 Product Items', 'Single POS Cashier Counter', 'Basic Stock Alerts', 'Export CSV Reports'], recommend: false },
            { plan: 'Professional ERP', price: '₹999', features: ['Unlimited Product Catalog', 'Up to 3 Warehouse Locations', 'Digital Customer Credit Ledger', 'Roles & Access (Admin/Staff)', 'GST-ready Report Logs'], recommend: true },
            { plan: 'Enterprise Suite', price: 'Custom', features: ['Multi-store Syncing API', 'Automated Daily Backups', '24/7 Dedicated Support Hotline', 'Custom Integration Options'], recommend: false }
          ].map((pricing, idx) => (
            <div
              key={idx}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 space-y-5 relative flex flex-col justify-between shadow-xs transition-all ${
                pricing.recommend
                  ? 'border-blue-600 shadow-md ring-1 ring-blue-600/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {pricing.recommend && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{pricing.plan}</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{pricing.price}</span>
                  {pricing.price !== 'Custom' && <span className="text-xs text-slate-500">/ month</span>}
                </div>
                <ul className="space-y-2 pt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {pricing.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-blue-600 flex-shrink-0" /> {feat}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/login"
                className={`w-full py-2.5 rounded-lg text-xs font-semibold text-center transition-all ${
                  pricing.recommend
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Get Started Now
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 9. FAQ */}
      <section id="faq" className="py-20 px-6 max-w-3xl mx-auto">
        <div className="text-center space-y-2 mb-10">
          <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Frequently Asked Questions</h3>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Everything you need to know</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white pr-4">{f.q}</span>
                <ChevronDownIcon className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-xs text-slate-600 dark:text-slate-400 font-normal leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 10. Final CTA */}
      <section className="px-6 pb-12">
        <div className="max-w-7xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl px-8 py-12 text-center text-white relative overflow-hidden shadow-xl">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-3 relative">Ready to upgrade your store operations?</h2>
          <p className="text-sm font-medium text-blue-100 mb-6 max-w-xl mx-auto relative">
            Start your 7-day free trial today. No credit card required. Up and running in minutes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-bold shadow-md transition-all relative"
          >
            Start Free Demo <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-12 pb-8 px-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Stock Management Logo"
                className="h-8 w-auto object-contain bg-white px-2 py-0.5 rounded border border-slate-200"
              />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Stock Management</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
              Inventory, POS billing, and customer credit management engineered for modern retail businesses across India.
            </p>
            <div className="flex gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-medium text-slate-700 dark:text-slate-300">
                <DevicePhoneMobileIcon className="w-3.5 h-3.5" /> Mobile Web App
              </span>
            </div>
          </div>
          <div>
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Product</h5>
            <ul className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">Features</a></li>
              <li><a href="#modules" className="hover:text-blue-600 dark:hover:text-blue-400">Modules</a></li>
              <li><a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Company</h5>
            <ul className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">About Us</a></li>
              <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">Careers</a></li>
              <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">Contact</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Support</h5>
            <ul className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li><a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400">FAQ</a></li>
              <li className="flex items-center gap-1.5 text-slate-500"><ClockIcon className="w-3.5 h-3.5" /> Mon–Sat, 9am–8pm IST</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs font-normal text-slate-500">
          © 2026 Stock Management. All rights reserved. Encrypted and secured.
        </div>
      </footer>
    </div>
  );
};

export default Landing;

