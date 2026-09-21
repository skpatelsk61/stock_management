import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpenIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  UserGroupIcon, 
  PlusIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  PrinterIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import API, { settingsAPI } from '../../services/api';
import Loader from '../../components/common/Loader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { showToast } from '../../store/slices/notificationSlice';

// Helper to get local YYYY-MM-DD
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const BorrowLedger = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const isReadOnly = user?.role === 'Viewer' || user?.role === 'Super Admin' || !!localStorage.getItem('monitoredTenant');

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({ total_pending: 0, total_debtors: 0, total_advance_credit: 0, total_settled: 0 });
  const [history, setHistory] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Store branding for statement print
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'Kirana Store ERP',
    storePhone: '',
    storeEmail: '',
    storeAddress: '',
    gstin: ''
  });

  // Modal states
  const [showTxModal, setShowTxModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Search & Filter Tabs
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'due', 'advance', 'settled'
  const [sortBy, setSortBy] = useState('dueDesc'); // 'dueDesc', 'advanceDesc', 'nameAsc'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Confirmation states
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [deletingId, setDeletingId] = useState(null);

  // Universal Transaction Form
  const [txForm, setTxForm] = useState({
    customer_id: '',
    amount: '',
    entry_type: 'PAYBACK', // 'PAYBACK', 'ADVANCE', 'BORROW', 'REFUND'
    date: getLocalDateString(),
    due_date: getLocalDateString(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
    notes: ''
  });

  // Fetch Store settings for print
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetchFn = settingsAPI.getAll || settingsAPI.get;
        const res = typeof fetchFn === 'function' ? await fetchFn() : null;
        if (res?.success && res.settings) {
          setStoreSettings({
            storeName: res.settings.store_name || res.settings.storeName || 'Kirana Store ERP',
            storePhone: res.settings.store_phone || res.settings.phone || '',
            storeEmail: res.settings.store_email || res.settings.email || '',
            storeAddress: [
              res.settings.store_address || res.settings.address,
              res.settings.city,
              res.settings.state,
              res.settings.pincode
            ].filter(Boolean).join(', '),
            gstin: res.settings.gstin || ''
          });
        }
      } catch (e) {
        console.warn('Could not load store branding for ledger print:', e.message);
      }
    };
    fetchSettings();
  }, []);

  // Keyboard escape handler for modals
  useEffect(() => {
    if (!showTxModal && !showHistoryModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowTxModal(false);
        setShowHistoryModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTxModal, showHistoryModal]);

  // Load summary
  const loadSummary = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const res = await API.get('/borrow');
      if (res.data?.success) {
        setSummary(res.data.summary || []);
        if (res.data.summaryTotals) {
          setSummaryTotals(res.data.summaryTotals);
        }
        setLastSyncTime(new Date());
        setSelectedCustomer((prev) => {
          if (!prev) return null;
          const match = (res.data.summary || []).find((c) => String(c.id) === String(prev.id));
          return match || prev;
        });
      }
    } catch (err) {
      console.error('Failed to load borrow summary', err);
    } finally {
      if (!isSilent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load customer statement history
  const loadHistory = async (customerId) => {
    try {
      const res = await API.get(`/borrow/history?customerId=${customerId}`);
      if (res.data?.success) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      console.error('Failed to load customer statement history', err);
    }
  };

  // Real-time Event Listeners & Silent Polling
  useEffect(() => {
    loadSummary();

    const handleEventUpdate = () => {
      loadSummary(true);
    };

    window.addEventListener('focus', handleEventUpdate);
    window.addEventListener('sales-updated', handleEventUpdate);
    window.addEventListener('borrow-updated', handleEventUpdate);
    window.addEventListener('customer-updated', handleEventUpdate);
    window.addEventListener('stock-changed', handleEventUpdate);
    window.addEventListener('inventory-updated', handleEventUpdate);

    const handleStorage = (e) => {
      if (e.key === 'sales_sync_signal') {
        loadSummary(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadSummary(true);
      }
    }, 8000);

    return () => {
      window.removeEventListener('focus', handleEventUpdate);
      window.removeEventListener('sales-updated', handleEventUpdate);
      window.removeEventListener('borrow-updated', handleEventUpdate);
      window.removeEventListener('customer-updated', handleEventUpdate);
      window.removeEventListener('stock-changed', handleEventUpdate);
      window.removeEventListener('inventory-updated', handleEventUpdate);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Open transaction modal for specific customer
  const handleOpenTx = (customer = null, defaultType = 'PAYBACK') => {
    setSelectedCustomer(customer);
    setTxForm({
      customer_id: customer ? customer.id : (summary[0]?.id || ''),
      amount: '',
      entry_type: defaultType,
      date: getLocalDateString(),
      due_date: getLocalDateString(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
      notes: ''
    });
    setShowTxModal(true);
  };

  // Open statement history modal
  const handleOpenHistory = async (customer) => {
    setSelectedCustomer(customer);
    setHistory([]);
    setShowHistoryModal(true);
    await loadHistory(customer.id);
  };

  // Handle transaction form submit
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const targetCustId = selectedCustomer ? selectedCustomer.id : txForm.customer_id;
    if (!targetCustId) {
      toast.error('Please select a customer');
      return;
    }

    if (!txForm.amount || Number(txForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const isBorrow = txForm.entry_type === 'BORROW';
      const endpoint = isBorrow ? '/borrow/transactions' : '/borrow/payback';
      const payload = {
        customer_id: Number(targetCustId),
        amount: Number(txForm.amount),
        total_amount: Number(txForm.amount),
        entry_type: txForm.entry_type || 'PAYBACK',
        date: txForm.date,
        borrow_date: txForm.date,
        due_date: isBorrow ? (txForm.due_date || txForm.date) : undefined,
        remarks: txForm.notes || (isBorrow ? 'Manual Udhaar Entry' : '')
      };

      const res = await API.post(endpoint, payload);

      if (res.data?.success) {
        toast.success(res.data?.message || 'Transaction recorded successfully');
        setShowTxModal(false);

        // Notify entire app of borrow & customer update
        window.dispatchEvent(new CustomEvent('borrow-updated', { detail: { customerId: targetCustId } }));
        window.dispatchEvent(new CustomEvent('customer-updated', { detail: { customerId: targetCustId } }));
        try {
          localStorage.setItem('sales_sync_signal', Date.now().toString());
        } catch (err) {}

        if (res.data?.customer) {
          const newDue = Number(res.data.customer.outstanding_balance ?? res.data.customer.balance ?? 0);
          const newAdv = Number(res.data.customer.advance_balance ?? 0);
          setSummary((prev) =>
            prev.map((c) =>
              String(c.id) === String(targetCustId)
                ? { ...c, balance: newDue, outstanding_balance: newDue, advance_balance: newAdv }
                : c
            )
          );
        }
        await loadSummary(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record transaction');
    }
  };

  // Trigger void confirmation
  const triggerDeleteEntry = (id) => {
    setDeleteConfirm({ open: true, id });
  };

  // Confirm void entry
  const confirmDeleteEntry = async () => {
    const targetId = deleteConfirm.id;
    if (!targetId || deletingId) return;

    setDeletingId(targetId);
    try {
      const res = await API.delete(`/borrow/${targetId}`);
      if (res.data?.success) {
        setHistory((prev) => prev.filter((h) => h.id !== targetId));
        if (selectedCustomer) {
          await loadHistory(selectedCustomer.id);
        }
        if (res.data?.customer && selectedCustomer) {
          const newDue = Number(res.data.customer.outstanding_balance ?? res.data.customer.balance ?? 0);
          const newAdv = Number(res.data.customer.advance_balance ?? 0);
          setSummary((prev) =>
            prev.map((c) =>
              String(c.id) === String(selectedCustomer.id)
                ? { ...c, balance: newDue, outstanding_balance: newDue, advance_balance: newAdv }
                : c
            )
          );
          setSelectedCustomer((prev) =>
            prev ? { ...prev, balance: newDue, outstanding_balance: newDue, advance_balance: newAdv } : null
          );
        }

        window.dispatchEvent(new CustomEvent('borrow-updated', { detail: { customerId: selectedCustomer?.id } }));
        window.dispatchEvent(new CustomEvent('customer-updated', { detail: { customerId: selectedCustomer?.id } }));
        await loadSummary(true);
        dispatch(showToast({ msg: 'Transaction entry voided successfully', type: 'success' }));
      } else {
        dispatch(showToast({ msg: res.data?.message || 'Failed to void transaction', type: 'error' }));
      }
    } catch (err) {
      dispatch(showToast({ msg: err.response?.data?.message || 'Failed to void transaction', type: 'error' }));
    } finally {
      setDeletingId(null);
      setDeleteConfirm({ open: false, id: null });
    }
  };

  // Statement calculations with running balance
  const statementRecords = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    // Sort chronological ascending to calculate running balance
    const chrono = [...history].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id);
    let currentBal = 0; // Negative means customer owes, Positive means customer has advance
    
    const enriched = chrono.map((item) => {
      const amt = Number(item.amount || 0);
      let debit = 0;
      let credit = 0;

      if (item.type === 'Borrow' || item.type === 'Advance Redemption') {
        debit = amt;
        currentBal -= amt;
      } else if (item.type === 'Payback' || item.type === 'Advance Deposit' || item.type === 'Return') {
        credit = amt;
        currentBal += amt;
      } else if (item.type === 'Refund' || item.type === 'Cash Refund') {
        debit = amt;
        currentBal -= amt;
      }

      return {
        ...item,
        debit,
        credit,
        runningBalance: currentBal
      };
    });

    // Return descending (newest first) for UI presentation
    return enriched.reverse();
  }, [history]);

  // Print Statement Handler
  const handlePrintStatement = () => {
    if (!selectedCustomer) return;
    const printWin = window.open('', '_blank', 'width=850,height=900');
    if (!printWin) {
      toast.error('Pop-up blocked. Please allow popups to print statement.');
      return;
    }

    const totalDebits = statementRecords.reduce((sum, r) => sum + r.debit, 0);
    const totalCredits = statementRecords.reduce((sum, r) => sum + r.credit, 0);
    const netOutstanding = Number(selectedCustomer.outstanding_balance ?? selectedCustomer.balance ?? 0);
    const netAdvance = Number(selectedCustomer.advance_balance ?? 0);

    const rowsHtml = statementRecords
      .map(
        (r, idx) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">${new Date(r.date).toLocaleDateString('en-IN')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">
            <div style="font-weight: bold;">${r.type}</div>
            <div style="font-size: 9px; color: #64748b;">${r.notes || '—'}</div>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #dc2626; font-weight: bold;">
            ${r.debit > 0 ? `₹${r.debit.toFixed(2)}` : '—'}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #16a34a; font-weight: bold;">
            ${r.credit > 0 ? `₹${r.credit.toFixed(2)}` : '—'}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-family: monospace;">
            ${r.runningBalance < 0 
              ? `<span style="color: #dc2626;">₹${Math.abs(r.runningBalance).toFixed(2)} Due</span>` 
              : r.runningBalance > 0 
              ? `<span style="color: #16a34a;">₹${r.runningBalance.toFixed(2)} Jama</span>` 
              : '₹0.00 Settled'}
          </td>
        </tr>`
      )
      .join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Khata Statement – ${selectedCustomer.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #0f172a; font-size: 11px; }
          .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 15px; }
          .store-name { font-size: 18px; font-weight: 800; color: #0f766e; text-transform: uppercase; margin: 0; }
          .store-info { font-size: 10px; color: #475569; margin-top: 4px; }
          .cust-card { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; margin-bottom: 15px; }
          .balance-card { display: flex; gap: 15px; }
          .bal-item { text-align: right; }
          .bal-item span { display: block; font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .bal-item strong { font-size: 14px; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; text-transform: uppercase; }
          .summary-box { display: flex; justify-content: flex-end; gap: 20px; border-top: 2px solid #cbd5e1; padding-top: 10px; font-size: 12px; font-weight: bold; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="store-name">${storeSettings.storeName}</h1>
          <div class="store-info">${storeSettings.storeAddress} ${storeSettings.storePhone ? `| Ph: ${storeSettings.storePhone}` : ''} ${storeSettings.gstin ? `| GSTIN: ${storeSettings.gstin}` : ''}</div>
          <div style="font-size: 13px; font-weight: 800; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a;">Customer Khata / Account Statement</div>
        </div>

        <div class="cust-card">
          <div>
            <div style="font-size: 13px; font-weight: 800;">${selectedCustomer.name} (${selectedCustomer.customer_code || 'CUST'})${selectedCustomer.customer_type ? ` • ${selectedCustomer.customer_type}` : ''}</div>
            <div style="color: #475569; margin-top: 2px;">Phone: ${selectedCustomer.phone || '—'} | Address: ${selectedCustomer.address || 'Local Counter'}</div>
          </div>
          <div class="balance-card">
            <div class="bal-item">
              <span>Advance Jama</span>
              <strong style="color: #16a34a;">₹${netAdvance.toFixed(2)}</strong>
            </div>
            <div class="bal-item">
              <span>Net Bakaya Due</span>
              <strong style="color: #dc2626;">₹${netOutstanding.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 85px;">Date</th>
              <th>Transaction / Particulars</th>
              <th style="width: 100px; text-align: right;">Debit (उधार)</th>
              <th style="width: 100px; text-align: right;">Credit (जमा)</th>
              <th style="width: 120px; text-align: right;">Balance (शेष)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <div>Total Debits: <span style="color: #dc2626;">₹${totalDebits.toFixed(2)}</span></div>
          <div>Total Credits: <span style="color: #16a34a;">₹${totalCredits.toFixed(2)}</span></div>
          <div>Net Balance: ${netOutstanding > 0 ? `<span style="color: #dc2626;">₹${netOutstanding.toFixed(2)} Due</span>` : `<span style="color: #16a34a;">₹${netAdvance.toFixed(2)} Advance</span>`}</div>
        </div>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
          <div>Generated on: ${new Date().toLocaleString('en-IN')}</div>
          <div>Authorized Signatory</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // Filter & Sort Logic
  const filteredAndSortedSummary = useMemo(() => {
    let result = [...summary];

    // 1. Tab Filter
    if (activeTab === 'due') {
      result = result.filter((item) => Number(item.balance ?? item.outstanding_balance ?? 0) > 0);
    } else if (activeTab === 'advance') {
      result = result.filter((item) => Number(item.advance_balance ?? 0) > 0);
    } else if (activeTab === 'settled') {
      result = result.filter(
        (item) =>
          Number(item.balance ?? item.outstanding_balance ?? 0) === 0 &&
          Number(item.advance_balance ?? 0) === 0
      );
    }

    // 2. Search query
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.phone && item.phone.includes(q)) ||
          (item.customer_code && item.customer_code.toLowerCase().includes(q))
      );
    }

    // 3. Sorting
    if (sortBy === 'dueDesc') {
      result.sort((a, b) => Number(b.balance ?? b.outstanding_balance ?? 0) - Number(a.balance ?? a.outstanding_balance ?? 0));
    } else if (sortBy === 'advanceDesc') {
      result.sort((a, b) => Number(b.advance_balance ?? 0) - Number(a.advance_balance ?? 0));
    } else if (sortBy === 'nameAsc') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return result;
  }, [summary, activeTab, searchTerm, sortBy]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: summary.length,
      due: summary.filter((item) => Number(item.balance ?? item.outstanding_balance ?? 0) > 0).length,
      advance: summary.filter((item) => Number(item.advance_balance ?? 0) > 0).length,
      settled: summary.filter(
        (item) =>
          Number(item.balance ?? item.outstanding_balance ?? 0) === 0 &&
          Number(item.advance_balance ?? 0) === 0
      ).length
    };
  }, [summary]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedSummary.length / pageSize));
  const paginatedSummary = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedSummary.slice(start, start + pageSize);
  }, [filteredAndSortedSummary, currentPage, pageSize]);

  // Accurate KPI Cards calculations
  const totalOutstanding = Number(summaryTotals.total_pending || summary.reduce((sum, item) => sum + Number(item.balance ?? item.outstanding_balance ?? 0), 0));
  const totalAdvanceCredit = Number(summaryTotals.total_advance_credit || summary.reduce((sum, item) => sum + Number(item.advance_balance ?? 0), 0));
  const debtorCount = tabCounts.due;

  // Selected customer for modal live preview
  const currentModalCustomer = useMemo(() => {
    if (selectedCustomer) return selectedCustomer;
    return summary.find((c) => String(c.id) === String(txForm.customer_id)) || null;
  }, [selectedCustomer, summary, txForm.customer_id]);

  return (
    <div className="space-y-6 select-none font-sans pb-12">
      {/* CONFIRM VOID / DELETE DIALOG */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        type="danger"
        title="Void Transaction Record"
        message="Are you sure you want to permanently void this ledger entry? Reverting this transaction will automatically recalibrate customer balances."
        confirmLabel={deletingId ? "Voiding..." : "Void Entry"}
        cancelLabel="Cancel"
        onConfirm={confirmDeleteEntry}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

      {/* ─── PAGE HEADER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Customer Borrow & Udhaar Ledger
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Credit receivables, customer advance wallet balances, statements, and paybacks
            {lastSyncTime && (
              <span className="ml-2 text-[10px] text-slate-400 font-mono">
                • Last synced: {lastSyncTime.toLocaleTimeString('en-IN')}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadSummary(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh Ledger"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Sync</span>
          </button>

          {!isReadOnly && (
            <>
              

              <button
                onClick={() => handleOpenTx(null, 'PAYBACK')}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0c3e2f] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all cursor-pointer active:scale-95"
              >
                <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                 Record Payment / Deposit
              </button>
            </>
          )}
        </div>
      </div>


      {/* ─── METRIC KPI CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Dues */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Outstanding Due</span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
              Active credit to recover ({debtorCount} customers)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50">
            <ArrowTrendingUpIcon className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Total Customer Advance Jama */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Advance Jama</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{totalAdvanceCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
              Prepaid wallets & return credits ({tabCounts.advance} accounts)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <ArrowTrendingDownIcon className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Active Borrowers (सक्रिय उधार खाते) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Borrowers</span>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {debtorCount} <span className="text-xs font-semibold text-slate-400">/ {tabCounts.all}</span>
            </p>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
              Customers with active Udhaar balance
            </span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
            <UserGroupIcon className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Clear / Settled Accounts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settled (Zero Dues)</span>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {tabCounts.settled} <span className="text-xs font-semibold text-slate-400">/ {tabCounts.all}</span>
            </p>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
              Clear account standing
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <CheckCircleIcon className="w-6 h-6 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* ─── CONTROLS: FILTER TABS, SEARCH, AND SORT ─── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Accounts', count: tabCounts.all },
            { id: 'due', label: 'Udhaar (Bakaya)', count: tabCounts.due, color: 'text-rose-600 dark:text-rose-400' },
            { id: 'advance', label: 'Advance (Jama)', count: tabCounts.advance, color: 'text-emerald-600 dark:text-emerald-400' },
            { id: 'settled', label: 'Settled / Clear', count: tabCounts.settled }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#0F4C3A] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer by name, mobile, or customer code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-semibold"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
            >
              <option value="dueDesc">Highest Dues First</option>
              <option value="advanceDesc">Highest Advance Jama First</option>
              <option value="nameAsc">Customer Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── MAIN DATA LEDGER TABLE ─── */}
      {loading ? (
        <div className="flex justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Loader size="md" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">Mobile & Address</th>
                  <th className="py-3.5 px-4 text-right">Account Balance Status</th>
                  <th className="py-3.5 px-4 text-center">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedSummary.map((customer) => {
                  const due = Number(customer.balance ?? customer.outstanding_balance ?? 0);
                  const advance = Number(customer.advance_balance ?? 0);

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                            {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{customer.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">
                                {customer.customer_code || 'CUST'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {customer.customer_type || 'Borrow'} Customer
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                          {customer.phone || '—'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">
                          {customer.address || 'Retail Desk'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {due > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                              ₹{due.toFixed(2)} Due (Bakaya)
                            </span>
                          )}

                          {advance > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              ₹{advance.toFixed(2)} Advance (Jama)
                            </span>
                          )}

                          {due === 0 && advance === 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              ✓ ₹0.00 Settled
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {!isReadOnly && (
                            <button
                              onClick={() => handleOpenTx(customer, due > 0 ? 'PAYBACK' : 'ADVANCE')}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-[#0F4C3A] dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl font-bold transition-all border border-emerald-200 dark:border-emerald-800/60 cursor-pointer shadow-xs active:scale-95 text-xs"
                            >
                              <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                              {due > 0 ? 'Payback' : 'Deposit'}
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenHistory(customer)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer text-xs active:scale-95"
                          >
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            Statement
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedSummary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium">
                      No customer ledger accounts matched the active filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedSummary.length)} of {filteredAndSortedSummary.length} accounts
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeftIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRightIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── UNIVERSAL TRANSACTION MODAL (PAYBACK / ADVANCE / BORROW / REFUND) ─── */}
      <AnimatePresence>
        {showTxModal && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTxModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400">
                    Record Customer Ledger Transaction
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {currentModalCustomer ? `Profile: ${currentModalCustomer.name} (${currentModalCustomer.phone || 'No Mobile'})` : 'Select customer profile below'}
                  </p>
                </div>
                <button
                  onClick={() => setShowTxModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTxSubmit} className="p-6 space-y-4">
                {/* Customer Picker if opened generally */}
                {!selectedCustomer && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Select Customer *
                    </label>
                    <select
                      value={txForm.customer_id}
                      onChange={(e) => setTxForm({ ...txForm, customer_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-emerald-600"
                    >
                      <option value="">Select customer account...</option>
                      {summary.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || 'No Mobile'}) — Due: ₹{Number(c.outstanding_balance || c.balance || 0).toFixed(2)} | Jama: ₹{Number(c.advance_balance || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Active Customer Status Card */}
                {currentModalCustomer && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Current Account Balance</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{currentModalCustomer.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                        Due: ₹{Number(currentModalCustomer.outstanding_balance ?? currentModalCustomer.balance ?? 0).toFixed(2)}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        Jama: ₹{Number(currentModalCustomer.advance_balance ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Transaction Type Tabs */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Transaction Type *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'PAYBACK', label: '💳 Payback (बकाया)', desc: 'Pays off dues' },
                      { id: 'ADVANCE', label: '💰 Jama (अग्रिम)', desc: 'Adds to advance' },
                      { id: 'BORROW', label: '🤝 Udhaar (उधार)', desc: 'New credit bill' },
                      { id: 'REFUND', label: '↩️ Refund (वापसी)', desc: 'Cash refund' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTxForm({ ...txForm, entry_type: t.id })}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          txForm.entry_type === t.id
                            ? 'bg-[#0F4C3A] text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="block text-xs font-black">{t.label}</span>
                        <span className={`block text-[9px] mt-0.5 ${txForm.entry_type === t.id ? 'text-emerald-200' : 'text-slate-400'}`}>
                          {t.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Amount (₹) *
                  </label>
                  <div className="relative">
                    <CurrencyRupeeIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Live Preview of Net Balance Outcome */}
                {currentModalCustomer && (
                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      Expected Balance After Entry:
                    </span>
                    {(() => {
                      const curDue = Number(currentModalCustomer.outstanding_balance ?? currentModalCustomer.balance ?? 0);
                      const curAdv = Number(currentModalCustomer.advance_balance ?? 0);
                      const amt = Number(txForm.amount || 0);

                      let expectedDue = curDue;
                      let expectedAdv = curAdv;

                      if (txForm.entry_type === 'PAYBACK') {
                        const paidDues = Math.min(curDue, amt);
                        expectedDue = Math.max(0, curDue - paidDues);
                        const excess = Math.max(0, amt - paidDues);
                        expectedAdv = curAdv + excess;
                      } else if (txForm.entry_type === 'ADVANCE') {
                        expectedAdv = curAdv + amt;
                      } else if (txForm.entry_type === 'BORROW') {
                        const fromAdv = Math.min(curAdv, amt);
                        expectedAdv = Math.max(0, curAdv - fromAdv);
                        const remainder = Math.max(0, amt - fromAdv);
                        expectedDue = curDue + remainder;
                      } else if (txForm.entry_type === 'REFUND') {
                        expectedAdv = Math.max(0, curAdv - amt);
                      }

                      return (
                        <div className="flex gap-2">
                          <span className={`font-mono font-bold ${expectedDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                            Due: ₹{expectedDue.toFixed(2)}
                          </span>
                          <span className={`font-mono font-bold ${expectedAdv > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            Jama: ₹{expectedAdv.toFixed(2)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Date Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Transaction Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={txForm.date}
                      onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {txForm.entry_type === 'BORROW' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Due Date (बकाया तिथि) *
                      </label>
                      <input
                        type="date"
                        required
                        value={txForm.due_date}
                        onChange={(e) => setTxForm({ ...txForm, due_date: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Remarks / Transaction Note
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., Cash collected, Online UPI reference, Advance deposit..."
                    value={txForm.notes}
                    onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowTxModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0F4C3A] hover:bg-[#0c3e2f] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/30 cursor-pointer active:scale-95"
                  >
                    Confirm & Record Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── CUSTOMER STATEMENT HISTORY SHEET MODAL ─── */}
      <AnimatePresence>
        {showHistoryModal && selectedCustomer && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowHistoryModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8"
            >
              {/* Statement Header */}
              <div className="bg-slate-950 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                      Customer Account Statement (खाता बही)
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300">
                      {selectedCustomer.customer_code || 'CUST'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-bold mt-0.5">
                    {selectedCustomer.name} • {selectedCustomer.phone || 'No Mobile'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] text-emerald-400 uppercase font-black tracking-wider block">Advance Jama</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      ₹{Number(selectedCustomer.advance_balance ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-3">
                    <span className="text-[9px] text-rose-400 uppercase font-black tracking-wider block">Outstanding Due</span>
                    <span className="text-sm font-black text-rose-400 font-mono">
                      ₹{Number(selectedCustomer.balance ?? selectedCustomer.outstanding_balance ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer ml-2"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Statement Content */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Showing {statementRecords.length} historical ledger movements
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintStatement}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[#0F4C3A] dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 transition-all cursor-pointer active:scale-95"
                    >
                      <PrinterIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                      Print Statement
                    </button>
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          setShowHistoryModal(false);
                          handleOpenTx(selectedCustomer, 'PAYBACK');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4C3A] hover:bg-[#0c3e2f] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                        + Record Payment
                      </button>
                    )}
                  </div>
                </div>

                {/* Statement Table */}
                <div className="max-h-[380px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs font-semibold">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Particulars / Notes</th>
                        <th className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">Debit (उधार)</th>
                        <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">Credit (जमा)</th>
                        <th className="py-2.5 px-3 text-right">Net Balance</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {statementRecords.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                log.type === 'Borrow'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                  : log.type === 'Advance Redemption'
                                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60'
                                  : log.type === 'Advance Deposit'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                  : log.type === 'Payback'
                                  ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800/60'
                                  : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                              }`}
                            >
                              {log.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {log.notes || 'Counter Ledger Entry'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {log.debit > 0 ? `₹${log.debit.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {log.credit > 0 ? `₹${log.credit.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold whitespace-nowrap">
                            {log.runningBalance < 0 ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                ₹{Math.abs(log.runningBalance).toFixed(2)} Due
                              </span>
                            ) : log.runningBalance > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ₹{log.runningBalance.toFixed(2)} Jama
                              </span>
                            ) : (
                              <span className="text-slate-400">₹0.00 Settled</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {!isReadOnly && (
                              <button
                                onClick={() => triggerDeleteEntry(log.id)}
                                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Void
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}

                      {statementRecords.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                            No ledger history entries found for this customer.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Net Balance: <strong className="text-slate-800 dark:text-slate-100 font-mono">
                      {Number(selectedCustomer.outstanding_balance ?? selectedCustomer.balance ?? 0) > 0 
                        ? `₹${Number(selectedCustomer.outstanding_balance ?? selectedCustomer.balance ?? 0).toFixed(2)} Due (Bakaya)`
                        : `₹${Number(selectedCustomer.advance_balance ?? 0).toFixed(2)} Advance Jama`}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(false)}
                    className="px-5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Close Sheet
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BorrowLedger;
