import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BellIcon,
  Bars3Icon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  PlusCircleIcon,
  ReceiptPercentIcon,
  CreditCardIcon,
  ClockIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  LockClosedIcon,
  CheckCircleIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';
import ThemeToggle from '../common/ThemeToggle';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';
import { toggleSidebar } from '../../store/slices/sidebarSlice';
import { 
  fetchNotifications as fetchNotificationsThunk, 
  markNotificationRead, 
  markAllNotificationsRead 
} from '../../store/slices/notificationSlice';
import { authAPI } from '../../services/api';
import Modal from '../common/Modal';

// ──────────────────────────────────────────────
const ProfileModal = ({ onClose }) => {
  const { user } = useAppSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: '',
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const displayData = profile || user;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authAPI.getProfile();
        if (res.success) {
          setProfile(res.user);
          setForm({
            name: res.user.name || '',
          });
        }
      } catch {
        setProfile(user);
        setForm({ name: user?.name || '' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { 
        name: form.name, 
      };
      const res = await authAPI.updateProfile(payload);
      if (res.success) {
        setProfile(prev => ({ 
          ...prev, 
          name: form.name, 
        }));
        showToast('Profile updated successfully.');
        setEditMode(false);
      } else {
        showToast(res.message || 'Update failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerForgot = async () => {
    const email = displayData?.email;
    if (!email) return;
    try {
      const res = await authAPI.forgotPassword({ email });
      if (res.success) {
        showToast('Password reset link sent to email!', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Password reset request failed', 'error');
    }
  };

  const getRoleBadgeColor = (role) => {
    const map = {
      'Super Admin': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      'Admin': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      'Sales Manager': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      'Purchase Manager': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
      'Employee': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    };
    return map[role] || 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="User Profile"
      size="sm"
    >
      <div className="relative p-5 space-y-4">
        {toast && (
          <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md border ${
            toast.type === 'error' 
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
          }`}>
            {toast.type === 'error' ? <XCircleIcon className="w-4 h-4 text-red-500" /> : <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
            {toast.msg}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">Loading details...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl uppercase shadow-sm">
                  {(displayData?.name || displayData?.email || 'U').charAt(0)}
                </div>
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">{displayData?.name || 'User'}</h3>
                <span className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${getRoleBadgeColor(displayData?.role)}`}>
                  {displayData?.role || 'Staff'}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Employee ID</label>
                <div className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-mono">
                  {displayData?.id ? `#${displayData.id}` : '—'}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <div className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 truncate">
                  {displayData?.email || '—'}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                {editMode ? (
                  <form onSubmit={handleSave} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ name: e.target.value })}
                      className="flex-1 px-3 py-2 text-xs border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                      placeholder="Enter Full Name"
                      required
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold">
                    <span>{displayData?.name || '—'}</span>
                    <button 
                      onClick={() => setEditMode(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleTriggerForgot}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <LockClosedIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Forgot Password / Reset
              </button>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button 
                type="button"
                onClick={onClose} 
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ──────────────────────────────────────────────
   MAIN HEADER COMPONENT
   ────────────────────────────────────────────── */
const Header = ({ onOpenShortcuts }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const { notifications = [], unreadCount = 0 } = useAppSelector((state) => state.notifications);

  useEffect(() => {
    dispatch(fetchNotificationsThunk({ limit: 50 }));
    const interval = setInterval(() => {
      dispatch(fetchNotificationsThunk({ limit: 50 }));
    }, 15000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const handleMarkRead = (id) => {
    dispatch(markNotificationRead(id));
  };

  const handleClearAll = () => {
    dispatch(markAllNotificationsRead());
  };

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getNotificationConfig = (module, type) => {
    const lt = (type || '').toLowerCase();
    const lm = (module || '').toLowerCase();
    if (lt === 'out of stock' || lt === 'failed login') return { icon: XCircleIcon, iconBg: 'bg-red-50 text-red-600 border border-red-200' };
    if (lt === 'low stock') return { icon: ExclamationTriangleIcon, iconBg: 'bg-amber-50 text-amber-600 border border-amber-200' };
    if (lm === 'sales') return { icon: ReceiptPercentIcon, iconBg: 'bg-blue-50 text-blue-600 border border-blue-200' };
    if (lm === 'purchases') return { icon: PlusCircleIcon, iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
    if (lm === 'billing') return { icon: CreditCardIcon, iconBg: 'bg-purple-50 text-purple-600 border border-purple-200' };
    if (lm === 'auth') return { icon: UserIcon, iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200' };
    return { icon: BellIcon, iconBg: 'bg-slate-50 text-slate-600 border border-slate-200' };
  };

  const handleNotificationClick = (notif) => {
    handleMarkRead(notif.id);
    setShowNotifications(false);
    
    const mod = (notif.related_module || '').toLowerCase();
    const type = (notif.type || '').toLowerCase();
    
    if (mod === 'sales' || type.includes('sale')) {
      navigate('/dashboard/sales');
    } else if (mod === 'purchases' || type.includes('purchase')) {
      navigate('/dashboard/purchase');
    } else if (mod === 'inventory' || mod === 'stock' || type.includes('stock')) {
      navigate('/dashboard/products');
    } else if (mod === 'billing') {
      navigate('/dashboard/billing');
    } else if (mod === 'auth') {
      navigate('/dashboard/staff');
    } else {
      navigate('/dashboard/notifications');
    }
  };
  const monitoredTenantStr = localStorage.getItem('monitoredTenant');
  const monitoredTenant = monitoredTenantStr ? JSON.parse(monitoredTenantStr) : null;

  const handleExitMonitor = () => {
    localStorage.removeItem('monitoredTenant');
    navigate('/superadmin');
  };

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now);
      const h = now.getHours();
      setGreeting(h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setShowProfileMenu(false);
      if (showNotifications && notificationsRef.current && !notificationsRef.current.contains(e.target)) setShowNotifications(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { setShowProfileMenu(false); setShowNotifications(false); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleKeyDown); };
  }, [showProfileMenu, showNotifications]);

  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <>
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}

      <div className="w-full flex flex-col sticky top-0 z-30">
        {monitoredTenant && (
          <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-xs flex flex-col sm:flex-row gap-2 items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span><strong>MONITORING MODE:</strong> Viewing <strong>{monitoredTenant.name}</strong> ERP in real-time read-only mode.</span>
            </div>
            <button onClick={handleExitMonitor} className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold shadow-xs">
              Exit Monitoring Panel
            </button>
          </div>
        )}

        <header className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 h-[75px] flex items-center transition-all">
          <div className="flex items-center justify-between w-full px-4 sm:px-6">

            {/* LEFT */}
            <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
              <button onClick={() => dispatch(toggleSidebar())} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg md:hidden transition-all border border-slate-200 dark:border-slate-800">
                <Bars3Icon className="w-5 h-5" />
              </button>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  {greeting}, <span className="text-blue-600 dark:text-blue-400">{user?.name?.split(' ')[0] || 'User'}</span>
                </h1>
                <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">Stock Management Operations</p>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-3 sm:gap-4 ml-auto flex-shrink-0">

              {/* Clock */}
              <div className="hidden lg:flex flex-col items-end pr-3 border-r border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <ClockIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="tabular-nums uppercase">{timeStr}</span>
                </div>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">{dateStr}</span>
              </div>

              {/* Subscription Plan Status Badge */}
              {user?.role !== 'Super Admin' && (
                <button
                  onClick={() => navigate('/dashboard/billing')}
                  title="Manage Store Subscription Plan"
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border shadow-xs cursor-pointer ${
                    user?.subscription_status === 'Expired'
                      ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 animate-pulse'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  <CreditCardIcon className="w-4 h-4" />
                  <span>{user?.subscription_status === 'Expired' ? 'Expired — Upgrade Plan' : 'Subscription Plan'}</span>
                </button>
              )}

              {/* Keyboard Shortcuts Trigger */}
              <button
                onClick={onOpenShortcuts}
                title="Keyboard Shortcuts (F1, Alt + K, Shift + ?)"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-all border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
              >
                <CommandLineIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-mono text-[10px] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold">Shortcuts</span>
              </button>

              <ThemeToggle />

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => {
                    const nextShow = !showNotifications;
                    setShowNotifications(nextShow);
                    setShowProfileMenu(false);
                    if (nextShow) {
                      dispatch(fetchNotificationsThunk({ limit: 50 }));
                    }
                  }}
                  className={`relative p-2 rounded-lg transition-all border ${showNotifications ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100'}`}
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
                    <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-xs">Notifications</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">System activity alerts</p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">{unreadCount} Unread</span>
                      )}
                    </div>
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">No notifications available</div>
                      ) : (
                        notifications.map((notif) => {
                          const moduleVal = notif.module || notif.related_module || 'General';
                          const { icon: NotifIcon, iconBg } = getNotificationConfig(moduleVal, notif.type);
                          const actorDisplay = notif.actor_name || notif.related_user || 'System';
                          const roleDisplay = notif.actor_role ? ` (${notif.actor_role})` : '';
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-3 flex gap-3 cursor-pointer transition-colors ${
                                !notif.is_read 
                                  ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/40' 
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                                <NotifIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{notif.title}</p>
                                  {!notif.is_read && <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />}
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug font-normal">{notif.message}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-medium">
                                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300 font-medium">{moduleVal}</span>
                                  <span>•</span>
                                  <span>By {actorDisplay}{roleDisplay}</span>
                                  <span>•</span>
                                  <span>{timeAgo(notif.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button onClick={handleClearAll} disabled={unreadCount === 0} className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 flex-1 py-1 text-center">
                        Mark all read
                      </button>
                      <span className="text-slate-200 dark:text-slate-800">|</span>
                      <button onClick={() => { setShowNotifications(false); navigate('/dashboard/notifications'); }} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex-1 py-1 text-center">
                        View all alerts
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                      {(user?.email || user?.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{user?.name || 'Admin User'}</p>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">{user?.role || 'Administrator'}</p>
                  </div>
                  <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 z-50 py-1 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name || 'Admin User'}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => { setShowProfileMenu(false); setShowProfileModal(true); }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Profile
                      </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                    <div className="py-1">
                      <button
                        onClick={async () => { await dispatch(logoutUser()); navigate('/login'); }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                      >
                        <ArrowLeftOnRectangleIcon className="w-4 h-4 text-red-500" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </header>
      </div>
    </>
  );
};

export default Header;