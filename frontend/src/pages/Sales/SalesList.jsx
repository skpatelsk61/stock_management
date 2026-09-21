import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PrinterIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  BriefcaseIcon,
  ArrowTrendingUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsUpDownIcon,
  FunnelIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import Modal from '../../components/common/Modal';
import SalesForm from '../../components/forms/SalesForm';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatsCard from '../../components/common/StatsCard';
import { salesAPI, settingsAPI } from '../../services/api';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchStockSummary, fetchStockAlerts } from '../../store/slices/stockSlice';

// Helper to get local YYYY-MM-DD string
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SalesList = () => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const isReadOnly = user?.role === 'Super Admin';

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPOSMode, setIsPOSMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [dbOffline, setDbOffline] = useState(false);
  const [viewingSale, setViewingSale] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Sorting & Pagination State
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'highestTotal', 'lowestTotal', 'invoiceNo'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filter conditions search matrix state engine
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [dateRangeFilter, setDateRangeFilter] = useState('All'); // 'All', 'Today', 'Yesterday', '7days', 'thisMonth'

  const [storeSettings, setStoreSettings] = useState({
    storeName: user?.store_name || user?.name || 'Kirana Store ERP',
    storeAddress: user?.address || 'Main Market Road',
    storePhone: user?.phone || user?.contact || 'N/A',
    storeEmail: user?.email || 'N/A',
    gstin: user?.gstin || 'N/A',
    shopRegNo: user?.tenant_id ? `REG-${user.tenant_id}` : 'N/A',
    storeLogo: user?.logo_url || null
  });

  const fetchStoreSettings = useCallback(async () => {
    try {
      const res = await settingsAPI.getAll();
      if (res.success && res.settings) {
        const isDummyPhone = (p) => !p || p === '0000000000' || p === '00000000' || String(p).trim() === '' || String(p).includes('00000000');
        const phoneToUse = !isDummyPhone(res.settings.store_phone)
          ? res.settings.store_phone
          : (!isDummyPhone(user?.phone) ? user.phone : (!isDummyPhone(user?.contact) ? user.contact : 'N/A'));

        setStoreSettings({
          storeName: res.settings.store_name || user?.store_name || user?.name || 'Kirana Store ERP',
          storeAddress: res.settings.store_address || user?.address || 'Main Market Road',
          storePhone: phoneToUse,
          storeEmail: res.settings.store_email || user?.email || 'N/A',
          gstin: res.settings.gstin || user?.gstin || 'N/A',
          shopRegNo: res.settings.shop_reg_no || (user?.tenant_id ? `REG-${user.tenant_id}` : 'N/A'),
          storeLogo: res.settings.logo_url || res.settings.store_logo || user?.logo_url || null
        });
      }
    } catch (err) {
      console.warn('Failed to load store settings', err);
    }
  }, [user]);

  // Robust Sales fetcher with silent background mode to eliminate UI freezing
  const fetchSales = useCallback(async (isSilent = false) => {
    if (!isSilent && sales.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const data = await salesAPI.getAll({ limit: 1000 });
      if (data.success && Array.isArray(data.sales)) {
        const mapped = data.sales.map((s) => ({
          id: s.id,
          invoiceNo: s.invoiceNo || s.invoice_no || '',
          date: s.date ? String(s.date).slice(0, 10) : '',
          customerName: s.customerName || s.customer_name || 'Walk-in Customer',
          customerPhone: s.customerPhone || s.customer_phone || '',
          productsSummary: s.productSummary || s.product_summary || 'General items checkout',
          quantity: Number(s.totalItems || s.total_items || 1),
          subtotal: Number(s.subtotal || 0),
          gst: Number(s.gstAmount || s.gst_amount || 0),
          discount: Number(s.discount || 0),
          total: Number(s.total || 0),
          amountPaid: Number(s.amountPaid || s.amount_paid || 0),
          dueAmount: Number(s.dueAmount || s.due_amount || 0),
          paymentMethod: s.paymentMethod || s.payment_method || 'Cash',
          paymentStatus: s.paymentStatus || s.payment_status || 'Paid',
          payments: s.payments || [],
          status: 'Completed',
          warehouseName: s.warehouseName || s.warehouse_name || 'Retail Shelf',
          createdAt: s.createdAt || s.created_at,
          time: s.createdAt
            ? new Date(s.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : ''
        }));
        setSales(mapped);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Sales API error:', err);
      if (!isSilent) setDbOffline(true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [sales.length]);

  // Real-Time Event Listeners & Live Polling (Every 8 seconds)
  useEffect(() => {
    fetchSales(false);
    fetchStoreSettings();

    const handleEventUpdate = () => {
      fetchSales(true);
      fetchStoreSettings();
    };

    window.addEventListener('focus', handleEventUpdate);
    window.addEventListener('sales-updated', handleEventUpdate);
    window.addEventListener('stock-changed', handleEventUpdate);
    window.addEventListener('inventory-updated', handleEventUpdate);
    window.addEventListener('storage', handleEventUpdate);

    // Live real-time polling interval: every 8 seconds
    const interval = setInterval(() => {
      fetchSales(true);
    }, 8000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleEventUpdate);
      window.removeEventListener('sales-updated', handleEventUpdate);
      window.removeEventListener('stock-changed', handleEventUpdate);
      window.removeEventListener('inventory-updated', handleEventUpdate);
      window.removeEventListener('storage', handleEventUpdate);
    };
  }, [fetchSales, fetchStoreSettings]);

  // Extract unique customers
  const uniqueCustomers = useMemo(() => {
    return ['All', ...new Set(sales.map((s) => s.customerName).filter(Boolean))];
  }, [sales]);

  // Dynamic Tally stats for cards (Real-time live calculated)
  const statsSummary = useMemo(() => {
    const todayStr = getLocalDateString();
    const todaySales = sales.filter((s) => s.date === todayStr);
    const todayVolume = todaySales.reduce((sum, s) => sum + s.total, 0);
    const todayTransactions = todaySales.length;

    const totalVolume = sales.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = sales.length;
    const unpaidCount = sales.filter((s) => s.paymentStatus !== 'Paid').length;
    const unpaidAmount = sales.filter((s) => s.paymentStatus !== 'Paid').reduce((sum, s) => sum + (s.dueAmount || s.total), 0);
    const avgTicket = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

    return {
      volume: totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      transactions: totalTransactions,
      todayVolume: todayVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      todayTransactions,
      unpaid: unpaidCount,
      unpaidAmount: unpaidAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      avgInvoice: avgTicket.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    };
  }, [sales]);

  // Comprehensive Filtering & Sorting Matrix — Defaults to NEWEST FIRST
  const processedSales = useMemo(() => {
    const todayStr = getLocalDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterdayDate);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const currentYearMonth = todayStr.slice(0, 7);

    const filtered = sales.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.invoiceNo || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.customerPhone || '').includes(q) ||
        (s.productsSummary || '').toLowerCase().includes(q);

      const matchCust = customerFilter === 'All' || s.customerName === customerFilter;
      const matchPayment = paymentStatusFilter === 'All' || s.paymentStatus === paymentStatusFilter;

      let matchDate = true;
      if (dateRangeFilter === 'Today') {
        matchDate = s.date === todayStr;
      } else if (dateRangeFilter === 'Yesterday') {
        matchDate = s.date === yesterdayStr;
      } else if (dateRangeFilter === '7days') {
        matchDate = s.date && new Date(s.date) >= sevenDaysAgo;
      } else if (dateRangeFilter === 'thisMonth') {
        matchDate = s.date && s.date.startsWith(currentYearMonth);
      }

      return matchSearch && matchCust && matchPayment && matchDate;
    });

    // Sort order logic: Default is 'newest' (Most recent first)
    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '');
        return (b.id || 0) - (a.id || 0);
      }
      if (sortBy === 'oldest') {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.id || 0) - (b.id || 0);
      }
      if (sortBy === 'highestTotal') {
        return b.total - a.total;
      }
      if (sortBy === 'lowestTotal') {
        return a.total - b.total;
      }
      if (sortBy === 'invoiceNo') {
        return (b.invoiceNo || '').localeCompare(a.invoiceNo || '');
      }
      return (b.id || 0) - (a.id || 0);
    });
  }, [sales, searchQuery, customerFilter, paymentStatusFilter, dateRangeFilter, sortBy]);

  // Reset page when filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, customerFilter, paymentStatusFilter, dateRangeFilter, sortBy, pageSize]);

  // Paginated records
  const totalPages = Math.ceil(processedSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedSales.slice(start, start + pageSize);
  }, [processedSales, currentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setCustomerFilter('All');
    setPaymentStatusFilter('All');
    setDateRangeFilter('All');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleAddSaleClick = () => {
    setIsPOSMode(true);
  };

  const handleOpenDeleteConfirm = (id) => {
    setDeleteConfirm({ open: true, id });
  };

  const executeSaleDeletion = async () => {
    try {
      const res = await salesAPI.delete(deleteConfirm.id);
      if (res && res.success) {
        toast.success(res.message || 'Sales invoice voided and stock restored successfully!');
        setSales((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
        await fetchSales(true);
        dispatch(fetchStockSummary());
        dispatch(fetchStockAlerts());
        window.dispatchEvent(new CustomEvent('sales-updated'));
        window.dispatchEvent(new CustomEvent('inventory-updated'));
        window.dispatchEvent(new CustomEvent('stock-changed'));
      } else {
        toast.error(res?.message || 'Voiding invoice failed.');
      }
    } catch (err) {
      console.error('Failed to cancel sales invoice:', err);
      toast.error(err.response?.data?.message || 'Cancellation failed');
    } finally {
      setDeleteConfirm({ open: false, id: null });
    }
  };

  // Immediate Optimistic Real-Time Checkout Submission
  const handleFormSubmission = async (formData) => {
    try {
      const itemsMapped = (formData.items || []).map((item) => ({
        productId: Number(item.productId || item.product_id || 1),
        quantity: Number(item.quantity) || 1,
        sellingPrice: Number(item.price || item.sellingPrice || item.selling_price || 0),
        mrp: Number(item.mrp || 0),
        batchNumber: item.batchNumber || item.batch_number || '',
        gst: Number(item.gst || 0),
        total: Number(item.total || 0)
      }));

      const payload = {
        invoiceNo: formData.invoiceNo || '',
        customerId: Number(formData.customerId || 1),
        customerType: formData.customerType || 'Walk-in',
        customerName: formData.customerName || '',
        customerPhone: formData.customerPhone || '',
        dueDate: formData.dueDate || null,
        amountPaid: Number(formData.amountPaid) || 0,
        dueAmount: Number(formData.dueAmount) || 0,
        warehouseId: Number(formData.warehouseId || 1),
        date: formData.date || getLocalDateString(),
        subtotal: Number(formData.subtotal) || 0,
        discount: Number(formData.discount) || 0,
        gstAmount: Number(formData.gstAmount || 0),
        total: Number(formData.total) || 0,
        paymentStatus: formData.paymentStatus || 'Paid',
        paymentMethod: formData.paymentMethod || 'Cash',
        payments: formData.payments || [],
        notes: formData.notes || '',
        items: itemsMapped
      };

      const res = await salesAPI.create(payload);
      if (res && res.success) {
        toast.success(`Sales Invoice ${res.invoiceNo || payload.invoiceNo} created successfully!`, {
          duration: 4000
        });

        // 1. Optimistic real-time insertion at row #1
        const optimisticSale = {
          id: res.saleId || Date.now(),
          invoiceNo: res.invoiceNo || payload.invoiceNo,
          date: payload.date,
          customerName: payload.customerName || 'Walk-in Customer',
          customerPhone: payload.customerPhone || '',
          productsSummary:
            (formData.items || []).map((i) => `${i.name || i.productName || 'Item'} (x${i.quantity})`).join(', ') ||
            'General items checkout',
          quantity: (formData.items || []).reduce((sum, i) => sum + Number(i.quantity || 1), 0),
          subtotal: payload.subtotal,
          gst: payload.gstAmount,
          discount: payload.discount,
          total: payload.total,
          amountPaid: payload.amountPaid,
          dueAmount: payload.dueAmount,
          paymentMethod: payload.paymentMethod,
          paymentStatus: payload.paymentStatus,
          payments: payload.payments,
          status: 'Completed',
          warehouseName: 'Retail Shelf',
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString()
        };

        setSales((prev) => [optimisticSale, ...prev.filter((s) => s.invoiceNo !== optimisticSale.invoiceNo)]);
        setIsPOSMode(false);
        handleResetFilters();

        // 2. Await verified sync from DB
        await fetchSales(true);

        // 3. Immediately refresh stock views & dispatch system-wide events
        dispatch(fetchStockSummary());
        dispatch(fetchStockAlerts());
        window.dispatchEvent(new CustomEvent('sales-updated'));
        window.dispatchEvent(new CustomEvent('inventory-updated'));
        window.dispatchEvent(new CustomEvent('stock-changed'));
        window.dispatchEvent(new CustomEvent('borrow-updated', { detail: { customer: res.customer, customerId: payload.customerId } }));
        window.dispatchEvent(new CustomEvent('customer-updated', { detail: { customer: res.customer, customerId: payload.customerId } }));
        try {
          localStorage.setItem('sales_sync_signal', Date.now().toString());
        } catch (e) {
          // ignore localStorage quota errors
        }
      } else {
        toast.error(res?.message || 'Error processing sales checkout');
      }
    } catch (err) {
      console.error('Error saving sales checkout:', err);
      toast.error(err.response?.data?.message || 'Error processing sales checkout');
    }
  };

  const handlePrintPastSale = () => {
    if (!viewingSale) return;
    const win = window.open('', '_blank');
    const itemsHtml = (viewingSale.items || []).map((item, idx) => `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">
          <div style="font-weight: bold;">${item.productName || item.name || item.product_name}</div>
          ${item.barcode ? `<div style="font-size: 8px; color: #64748b; font-family: monospace;">${item.barcode}</div>` : ''}
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${item.quantity} ${item.unit || 'Pcs'}</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">₹${Number(item.sellingPrice || item.price || item.selling_price || 0).toFixed(2)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${item.gst || 0}%</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">₹${Number(item.total || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html>
      <head>
        <title>Sales Invoice – ${viewingSale.invoiceNo || viewingSale.invoice_no}</title>
        <style>
          @page { size: A4 portrait; margin: 0.4in; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; background: #fff; font-size: 11px; }
          .container { width: 100%; max-width: 800px; margin: 0 auto; padding: 10px; }
          .store-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
          .store-name { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; color: #1B6E4C; margin: 0; }
          .store-details { font-size: 10px; color: #475569; margin: 2px 0; }
          
          .invoice-banner { background: #1B6E4C; color: #fff; padding: 12px 18px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .invoice-title { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: 0.5px; }
          .invoice-meta { text-align: right; font-size: 10px; }
          
          .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .details-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
          .details-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #1B6E4C; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; letter-spacing: 0.5px; }
          .details-row { margin: 4px 0; font-weight: 600; color: #334155; }
          .details-row span { color: #0f172a; font-weight: 700; }
          
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
          .items-table th { background: #EAF3EE; border: 1px solid #cbd5e1; color: #1B6E4C; font-weight: 800; text-transform: uppercase; font-size: 8px; padding: 8px 6px; text-align: center; }
          
          .summary-container { display: flex; justify-content: space-between; align-items: flex-start; }
          .greetings-box { width: 55%; font-size: 9.5px; color: #475569; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; }
          .summary-box { width: 40%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; font-size: 11px; }
          .summary-row { display: flex; justify-content: space-between; margin: 4px 0; font-weight: 650; }
          .summary-row.grand { border-top: 1.5px solid #cbd5e1; padding-top: 6px; margin-top: 6px; font-weight: 800; font-size: 14px; color: #1B6E4C; }
          
          .footer { text-align: center; margin-top: 50px; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="store-header">
            ${storeSettings.storeLogo ? `<img src="${storeSettings.storeLogo}" style="max-height: 50px; object-fit: contain; margin-bottom: 6px;" />` : ''}
            <h1 class="store-name">${storeSettings.storeName}</h1>
            <p class="store-details">${storeSettings.storeAddress} | Ph: ${storeSettings.storePhone} | Email: ${storeSettings.storeEmail}</p>
            <p class="store-details"><strong>GSTIN:</strong> ${storeSettings.gstin} | <strong>Shop Reg No:</strong> ${storeSettings.shopRegNo}</p>
          </div>
          
          <div class="invoice-banner">
            <div>
              <h2 class="invoice-title">TAX INVOICE</h2>
            </div>
            <div class="invoice-meta">
              <div><strong>Invoice No:</strong> ${viewingSale.invoiceNo || viewingSale.invoice_no}</div>
              <div><strong>Date:</strong> ${viewingSale.date}</div>
              <div><strong>Fulfillment:</strong> ${viewingSale.warehouseName || 'Retail Desk'}</div>
            </div>
          </div>
          
          <div class="details-section">
            <div class="details-box">
              <div class="details-title">Customer details</div>
              <div class="details-row">Name: <span>${viewingSale.customerName || 'Walk-in Customer'}</span></div>
              <div class="details-row">Mobile: <span>${viewingSale.customerPhone || '—'}</span></div>
              <div class="details-row">Email: <span>${viewingSale.customerEmail || '—'}</span></div>
              <div class="details-row">Address: <span>${viewingSale.customerAddress || '—'}</span></div>
            </div>
            <div class="details-box">
              <div class="details-title">Payment Breakdown</div>
              ${viewingSale.payments && viewingSale.payments.length > 0 
                ? viewingSale.payments.map(p => `<div class="details-row">${p.paymentMethod}${p.referenceNo ? ` (${p.referenceNo})` : ''}: <span>₹${Number(p.amount || 0).toFixed(2)}</span></div>`).join('')
                : `<div class="details-row">Method: <span>${viewingSale.paymentMethod || 'Cash'}</span></div>`
              }
              <div class="details-row">Status: <span style="color: ${viewingSale.paymentStatus === 'Paid' ? '#1b6e4c' : '#b45309'};">${viewingSale.paymentStatus}</span></div>
              <div class="details-row">Settled Amount: <span>₹${Number(viewingSale.amountPaid || viewingSale.total || 0).toFixed(2)}</span></div>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%; text-align: left;">Product Description</th>
                <th style="width: 12%;">Qty</th>
                <th style="width: 13%;">Rate</th>
                <th style="width: 10%;">GST</th>
                <th style="width: 15%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="summary-container">
            <div class="greetings-box">
              <strong>Thank you for shopping with us!</strong>
              <div style="margin-top: 4px;">1. Goods once sold cannot be taken back or exchanged.</div>
              <div>2. This is a computer generated invoice and requires no physical signature.</div>
            </div>
            <div class="summary-box">
              <div class="summary-row"><span>Subtotal:</span><span>₹${Number(viewingSale.subtotal || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>Discounts:</span><span>-₹${Number(viewingSale.discount || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>Tax (GST):</span><span>+₹${Number(viewingSale.gstAmount || viewingSale.gst_amount || 0).toFixed(2)}</span></div>
              <div class="summary-row grand"><span>Grand Total:</span><span>₹${Number(viewingSale.total || 0).toFixed(2)}</span></div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is a system-generated Invoice.</p>
            <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 450);
  };

  const fetchStatusStyle = (val) => {
    switch (val) {
      case 'Paid':
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
      case 'Pending':
      case 'Partial':
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
      case 'Cancelled':
      case 'Voided':
        return 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  if (isPOSMode) {
    return (
      <SalesForm
        onSubmit={handleFormSubmission}
        onCancel={() => setIsPOSMode(false)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12 select-none font-sans">
      {/* PAGE HEADER BAR SECTION CONTAINER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Sales Panel</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time retail billing ledger, POS checkouts, and sales transactions
            {lastSyncTime && (
              <span className="ml-2 text-[10px] text-slate-400 font-mono">
                • Last updated: {lastSyncTime.toLocaleTimeString('en-IN')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => fetchSales(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Refresh sales ledger"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/dashboard/sales/returns"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-amber-600 dark:bg-amber-600 text-white rounded-xl shadow-md hover:bg-amber-700 dark:hover:bg-amber-500 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowPathIcon className="w-4 h-4 stroke-[2.5]" /> Sales Returns
          </Link>

          {!isReadOnly && (
            <button
              onClick={handleAddSaleClick}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              <PlusIcon className="w-4 h-4 stroke-[3]" /> POS Checkouts Billing
            </button>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW CARDS (Real-Time Live Numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Sales"
          value={`₹${statsSummary.todayVolume}`}
          icon={BanknotesIcon}
          subtext={`${statsSummary.todayTransactions} receipts billed today`}
          color="green"
        />
        <StatsCard
          title="Total Volume"
          value={`₹${statsSummary.volume}`}
          icon={ArrowTrendingUpIcon}
          subtext={`${statsSummary.transactions} total invoices recorded`}
          color="blue"
        />
        <StatsCard
          title="Unpaid / Udhaar"
          value={`₹${statsSummary.unpaidAmount}`}
          icon={ClockIcon}
          subtext={`${statsSummary.unpaid} pending credit invoices`}
          color="orange"
        />
        <StatsCard
          title="Average Ticket"
          value={`₹${statsSummary.avgInvoice}`}
          icon={ReceiptPercentIcon}
          subtext="Avg billing ticket value"
          color="purple"
        />
      </div>

      {/* SALES HISTORY GRID */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        {/* Filters Matrix Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice number, customer name, mobile, or items..."
              className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-emerald-500 font-medium text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Customer Filter */}
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-bold"
            >
              <option value="All">All Customers</option>
              {uniqueCustomers
                .filter((c) => c !== 'All')
                .map((cust) => (
                  <option key={cust} value={cust}>
                    {cust}
                  </option>
                ))}
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-bold"
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending / Udhaar</option>
            </select>

            {/* Date Range Filter */}
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-bold"
            >
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="thisMonth">This Month</option>
            </select>

            {/* Sort Order Selector (Defaults to Newest First) */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-bold"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="highestTotal">Sort: Highest Total</option>
              <option value="lowestTotal">Sort: Lowest Total</option>
              <option value="invoiceNo">Sort: Invoice No</option>
            </select>

            {/* Clear Filters */}
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <FunnelIcon className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Ledger Content Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-slate-400 animate-pulse">Loading real-time billing ledger...</span>
          </div>
        ) : processedSales.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <BriefcaseIcon className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">No Sales Records Found</h3>
              <p className="text-xs text-slate-400 font-medium mt-1 max-w-xs">
                {dateRangeFilter !== 'All'
                  ? `No invoices matched the selected ${dateRangeFilter} filter. Try switching to 'All Dates'.`
                  : 'No invoices match the selected criteria. Try adjusting your search query or filters.'}
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table wrapper — comfortable height without squishing */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10 shadow-xs backdrop-blur-xs">
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center">#</th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-emerald-600" onClick={() => setSortBy(sortBy === 'invoiceNo' ? 'newest' : 'invoiceNo')}>
                      <div className="flex items-center gap-1">
                        <span>Invoice No.</span>
                        <ArrowsUpDownIcon className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Customer Details</th>
                    <th className="py-3.5 px-4">Warehouse</th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-emerald-600" onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}>
                      <div className="flex items-center gap-1">
                        <span>Date & Time</span>
                        <ArrowsUpDownIcon className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Product Summary</th>
                    <th className="py-3.5 px-4 text-center">Items</th>
                    <th className="py-3.5 px-4 text-right cursor-pointer hover:text-emerald-600" onClick={() => setSortBy(sortBy === 'highestTotal' ? 'lowestTotal' : 'highestTotal')}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Grand Total</span>
                        <ArrowsUpDownIcon className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-center">Method</th>
                    <th className="py-3.5 px-4 text-center">Payment Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-650 dark:text-slate-300">
                  {paginatedSales.map((sale, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={`sale-${sale.id}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[10px] text-center">{rowNumber}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-950 dark:text-white">
                          <span className="hover:underline cursor-pointer" onClick={() => setViewingSale(sale)}>
                            {sale.invoiceNo}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{sale.customerName}</div>
                          {sale.customerPhone && (
                            <div className="text-[10px] font-mono text-slate-400">{sale.customerPhone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-semibold">{sale.warehouseName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <span>{sale.date}</span>
                          {sale.time && (
                            <span className="text-[10px] ml-1.5 text-slate-400 font-mono">({sale.time})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[220px] truncate text-slate-500 dark:text-slate-400" title={sale.productsSummary}>
                          {sale.productsSummary}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">{sale.quantity}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white tabular-nums">
                          ₹{Number(sale.total || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${fetchStatusStyle(sale.paymentStatus)}`}>
                            {sale.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await salesAPI.getById(sale.id);
                                  if (res.success && res.sale) {
                                    setViewingSale(res.sale);
                                  }
                                } catch {
                                  setViewingSale({
                                    ...sale,
                                    items: [
                                      {
                                        productName: sale.productsSummary || 'General Grocery Item',
                                        quantity: sale.quantity,
                                        sellingPrice: sale.total / sale.quantity,
                                        gst: 18,
                                        total: sale.total
                                      }
                                    ]
                                  });
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-md text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800 transition-colors cursor-pointer"
                            >
                              View Invoice
                            </button>
                            {!isReadOnly && (
                              <Link
                                to={`/dashboard/sales/returns?invoiceNo=${encodeURIComponent(sale.invoiceNo)}`}
                                className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-md text-[10px] font-bold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <ArrowPathIcon className="w-3 h-3 stroke-[2.5]" /> Return
                              </Link>
                            )}
                            {!isReadOnly ? (
                              <button
                                onClick={() => handleOpenDeleteConfirm(sale.id)}
                                className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-md text-[10px] font-bold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                              >
                                Void
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 self-center">Locked</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls & Total Records Display */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-medium">
                Showing{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {processedSales.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, processedSales.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800 dark:text-slate-200">{processedSales.length}</span> entries
                {processedSales.length !== sales.length && (
                  <span className="text-slate-400 ml-1">({sales.length} total in ledger)</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-bold text-xs text-slate-700 dark:text-slate-300 font-mono">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Voiding Invoice */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="Void Sales Invoice"
        message="Are you sure you want to void this sales receipt? This will automatically reverse the sold quantities back to warehouse inventory stocks and recalculate customer balance."
        confirmLabel="Void Receipt"
        cancelLabel="Cancel"
        type="danger"
        onConfirm={executeSaleDeletion}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

      {/* GREEN-THEMED PAST INVOICE DETAIL MODAL */}
      {viewingSale && (
        <Modal
          isOpen={!!viewingSale}
          onClose={() => setViewingSale(null)}
          title="Tax Invoice details"
          size="2xl"
          noPadding={true}
          showCloseButton={true}
        >
          <div className="bg-slate-50 dark:bg-slate-900 flex flex-col max-h-[85vh] overflow-y-auto font-sans select-none text-slate-800 dark:text-slate-100">
            {/* Header section (Gradient green) */}
            <div className="bg-gradient-to-r from-emerald-800 to-green-700 text-white p-6 flex justify-between items-center relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">{storeSettings.storeName}</h2>
                  <p className="text-xs text-emerald-100/90 font-semibold mt-0.5">Tax Invoice Statement Summary</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="text-xs font-black bg-white/15 text-white border border-white/25 px-3.5 py-1.5 rounded-xl">
                  #{viewingSale.invoiceNo || viewingSale.invoice_no}
                </span>
              </div>
            </div>

            {/* Store Information Overview */}
            <div className="bg-white dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <div>
                <p className="text-slate-900 dark:text-white font-bold uppercase text-[9px] tracking-wider mb-1">Store Location & Contact</p>
                <p>{storeSettings.storeAddress}</p>
                <p>Phone: {storeSettings.storePhone} | Email: {storeSettings.storeEmail}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-slate-900 dark:text-white font-bold uppercase text-[9px] tracking-wider mb-1">Registration details</p>
                <p>GSTIN: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{storeSettings.gstin}</span></p>
                <p>Shop Reg No: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{storeSettings.shopRegNo}</span></p>
              </div>
            </div>

            {/* Content Body Metadata Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN: Customer Card & Payment Details */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2">
                  <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-1.5">Billed To (Customer Details)</h4>
                  <div className="text-xs font-semibold space-y-1">
                    <div>Name: <span className="text-slate-900 dark:text-white font-bold">{viewingSale.customerName || 'Walk-in Customer'}</span></div>
                    <div>Mobile: <span className="text-slate-900 dark:text-white font-mono">{viewingSale.customerPhone || '—'}</span></div>
                    <div>Email: <span className="text-slate-900 dark:text-white">{viewingSale.customerEmail || '—'}</span></div>
                    <div>Address: <span className="text-slate-900 dark:text-white">{viewingSale.customerAddress || '—'}</span></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2">
                  <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-1.5">Fulfillment & Time</h4>
                  <div className="text-xs font-semibold space-y-1">
                    <div>Warehouse: <span className="text-slate-900 dark:text-white font-bold">{viewingSale.warehouseName || 'Retail Shelf'}</span></div>
                    <div>Fulfillment Date: <span className="text-slate-900 dark:text-white font-mono">{viewingSale.date}</span></div>
                    {viewingSale.createdAt && <div>Transaction Time: <span className="text-slate-900 dark:text-white font-mono">{new Date(viewingSale.createdAt).toLocaleTimeString()}</span></div>}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Payments & Calculations */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Subtotal:</span>
                  <span className="font-mono text-xs font-black text-slate-800 dark:text-white">₹{Number(viewingSale.subtotal || 0).toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Discount:</span>
                  <span className="font-mono text-xs font-black text-rose-600">- ₹{Number(viewingSale.discount || 0).toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">GST Amount:</span>
                  <span className="font-mono text-xs font-black text-slate-800 dark:text-white">₹{Number(viewingSale.gstAmount || viewingSale.gst_amount || 0).toFixed(2)}</span>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200">Grand Total</h3>
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">Inclusive of all taxes</p>
                  </div>
                  <span className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-300">
                    ₹{Number(viewingSale.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-1.5">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Payment Breakdown & Modes</div>
                  {viewingSale.payments && viewingSale.payments.length > 0 ? (
                    viewingSale.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">{p.paymentMethod}{p.referenceNo ? ` (${p.referenceNo})` : ''}:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(p.amount || 0).toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{viewingSale.paymentMethod || 'Cash'}:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(viewingSale.amountPaid || viewingSale.total || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Payment Status:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${fetchStatusStyle(viewingSale.paymentStatus)}`}>
                    {viewingSale.paymentStatus}
                  </span>
                </div>

                {viewingSale.paymentStatus !== 'Paid' && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Amount Paid:</span>
                      <span className="font-mono text-xs font-black text-emerald-600">₹{Number(viewingSale.amountPaid || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Due / Udhaar Amount:</span>
                      <span className="font-mono text-xs font-black text-rose-600">₹{Number(viewingSale.dueAmount || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Products Table */}
            <div className="px-6 pb-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-750 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Itemized Products Table</h3>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {viewingSale.items?.length || 0} Items
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-750 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                        <th className="py-2.5 px-4 text-center">#</th>
                        <th className="py-2.5 px-4">Product Name</th>
                        <th className="py-2.5 px-4 text-center">Batch No</th>
                        <th className="py-2.5 px-4 text-right">MRP</th>
                        <th className="py-2.5 px-4 text-center">Qty</th>
                        <th className="py-2.5 px-4 text-right">Selling Price</th>
                        <th className="py-2.5 px-4 text-center">GST %</th>
                        <th className="py-2.5 px-4 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                      {(viewingSale.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-750">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900 dark:text-white block">{item.productName || item.name || item.product_name}</span>
                            {item.barcode && <span className="text-[9px] font-mono text-slate-400 block">{item.barcode}</span>}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded font-mono font-bold text-[10px] border border-emerald-200/60 dark:border-emerald-800">
                              {item.batchNumber || item.batch_number || 'DEFAULT'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            ₹{Number(item.mrp || item.sellingPrice || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-center tabular-nums">{item.quantity} {item.unit || 'Pcs'}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">₹{Number(item.sellingPrice || item.price || item.selling_price || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-center tabular-nums text-slate-500">{item.gst || 0}%</td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white tabular-nums">₹{Number(item.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Footer Action Bar */}
            <div className="bg-emerald-50/25 dark:bg-slate-850 px-6 py-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Billed under store counter POS system.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPastSale}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 active:scale-95 transition-all cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4 text-emerald-100 stroke-[2.5]" />
                  Print Invoice
                </button>
                <button
                  onClick={() => setViewingSale(null)}
                  className="px-5 py-2.5 bg-slate-950 dark:bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SalesList;
