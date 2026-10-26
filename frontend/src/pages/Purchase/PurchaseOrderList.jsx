import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  DocumentPlusIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  ArchiveBoxIcon,
  CurrencyRupeeIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  InboxArrowDownIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { purchaseOrdersAPI, purchasesAPI, settingsAPI } from '../../services/api';
import PurchaseOrderForm from '../../components/forms/PurchaseOrderForm';
import GRNForm from '../../components/forms/GRNForm';
import PurchaseForm from '../../components/forms/PurchaseForm';
import Modal from '../../components/common/Modal';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { showToast } from '../../store/slices/notificationSlice';

const PurchaseOrderList = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const isReadOnly = user?.role === 'Super Admin';
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal triggers
  const [showPOForm, setShowPOForm] = useState(false);
  const [showGRNForm, setShowGRNForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [viewingPO, setViewingPO] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Tarika 2 Finalize PO Modal State
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizePOData, setFinalizePOData] = useState(null);
  const [finalizeSettlementChoice, setFinalizeSettlementChoice] = useState('FULL_ORDER');
  const [finalizeCustomAmt, setFinalizeCustomAmt] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
    storeName: user?.store_name || 'Store',
    storeAddress: user?.address || '',
    storePhone: user?.phone || '',
    storeEmail: user?.email || '',
    gstin: user?.gstin || '',
    shopRegNo: ''
  });

  const fetchStoreSettings = async () => {
    try {
      const res = await settingsAPI.getAll();
      if (res.success && res.settings) {
        const isDummyAddress = (addr) => !addr || String(addr).toLowerCase().includes('enter store address') || String(addr).toLowerCase().includes('main market, city center') || String(addr).toLowerCase().includes('malviya nagar');
        const isDummyPhone = (p) => !p || p === '0000000000' || p === '00000000' || String(p).trim() === '' || String(p).includes('00000000') || String(p).includes('98765-43210') || String(p).includes('98765 43210');
        const isDummyGstin = (g) => !g || g === '07AAAAA1111A1Z1' || g === '07BBBCC2222B2Z2';

        const phoneToUse = !isDummyPhone(res.settings.store_phone)
          ? res.settings.store_phone
          : (!isDummyPhone(user?.phone) ? user.phone : (!isDummyPhone(user?.contact) ? user.contact : ''));

        setStoreSettings({
          storeName: res.settings.store_name && res.settings.store_name !== 'KIRANA MART ERP' && res.settings.store_name !== 'Kirana Mart Enterprise' ? res.settings.store_name : (user?.store_name || 'Store'),
          storeAddress: !isDummyAddress(res.settings.store_address) ? res.settings.store_address : (user?.address || ''),
          storePhone: phoneToUse,
          storeEmail: (res.settings.store_email && !res.settings.store_email.includes('kiranamart.com')) ? res.settings.store_email : (user?.email || ''),
          gstin: !isDummyGstin(res.settings.gstin) ? res.settings.gstin : (user?.gstin || ''),
          shopRegNo: res.settings.shop_reg_no || ''
        });
      }
    } catch (err) {
      console.warn('Failed to load store settings', err);
    }
  };

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const res = await purchaseOrdersAPI.getAll();
      if (res.success) {
        setPurchaseOrders(res.purchaseOrders);
      }
    } catch (err) {
      console.error('Failed to load purchase orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
    fetchStoreSettings();
  }, []);

  const handleCreatePO = async (data) => {
    try {
      const res = await purchaseOrdersAPI.create(data);
      if (res.success) {
        setShowPOForm(false);
        fetchPurchaseOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGRN = async (data) => {
    try {
      const res = await purchaseOrdersAPI.createGRN(selectedPO.id, data);
      if (res.success) {
        toast.success(res.message || 'GRN saved successfully!');
        const updatedPoId = selectedPO?.id;
        const newStatus = res.poStatus;
        if (updatedPoId) {
          setPurchaseOrders((prev) =>
            prev.map((p) =>
              p.id === updatedPoId
                ? {
                    ...p,
                    status: newStatus || p.status,
                    total: res.poTotal !== undefined ? res.poTotal : p.total,
                    subtotal: res.poSubtotal !== undefined ? res.poSubtotal : p.subtotal,
                    gst_amount: res.poGstAmount !== undefined ? res.poGstAmount : p.gst_amount
                  }
                : p
            )
          );
        }
        setShowGRNForm(false);
        setSelectedPO(null);
        await fetchPurchaseOrders();
        window.dispatchEvent(new CustomEvent('inventory-updated'));
        window.dispatchEvent(new CustomEvent('stock-changed'));
        window.dispatchEvent(new CustomEvent('purchases-updated'));
        window.dispatchEvent(new CustomEvent('products-updated'));
        window.dispatchEvent(new CustomEvent('vendor-balance-updated'));
      } else {
        toast.error(res.message || 'Error creating GRN');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Error creating GRN');
    }
  };

  const handleCreateInvoice = async (data) => {
    try {
      const itemsMapped = (data.items || []).map(item => ({
        product_id: Number(item.productId || item.product_id || item.id),
        quantity: Number(item.quantity) || 1,
        purchase_price: Number(item.price ?? item.purchase_price ?? item.purchasePrice ?? 0),
        mrp: Number(item.mrp) || 0,
        gst: Number(item.gstPercent ?? item.gst ?? 0),
        total: Number(item.total) || 0
      }));

      const payload = {
        vendor_id: Number(data.vendorId || selectedPO?.vendor_id || selectedPO?.vendorId || 1),
        warehouse_id: Number(data.warehouseId || selectedPO?.warehouse_id || selectedPO?.warehouseId || 1),
        date: data.purchaseDate || new Date().toISOString().split('T')[0],
        subtotal: Number(data.subtotal) || 0,
        discount: Number(data.discountAmount) || 0,
        gst_amount: Number(data.tax) || 0,
        total: Number(data.total) || 0,
        paid_amount: Number(data.paid_amount || 0),
        credit_damaged_advance: Boolean(data.credit_damaged_advance),
        damaged_advance_amount: Number(data.damaged_advance_amount || 0),
        total_damaged_units: Number(data.total_damaged_units || 0),
        payment_status: data.paymentStatus || 'Pending',
        delivery_status: data.deliveryStatus || 'Received',
        payment_method: data.paymentMode || 'Cash',
        purchase_order_id: selectedPO?.id || null,
        items: itemsMapped
      };

      const res = await purchasesAPI.create(payload);
      if (res.success) {
        if (selectedPO?.id) {
          try {
            const targetStatus = data.finalize_po !== false ? 'Completed' : 'Partially Pending';
            await purchaseOrdersAPI.updateStatus(selectedPO.id, {
              status: targetStatus,
              force: data.finalize_po === true
            });
          } catch (statusErr) {
            console.warn('PO status update notice:', statusErr);
          }
        }
        toast.success('Purchase invoice created successfully!');
        setShowInvoiceForm(false);
        setSelectedPO(null);
        fetchPurchaseOrders();
        // Notify Dashboard that purchase/inventory data changed
        window.dispatchEvent(new CustomEvent('inventory-updated'));
        window.dispatchEvent(new CustomEvent('stock-changed'));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Error creating purchase invoice');
    }
  };

  const handleCancelPO = async (id) => {
    if (window.confirm('Are you sure you want to cancel this Purchase Order?')) {
      try {
        const res = await purchaseOrdersAPI.updateStatus(id, { status: 'Cancelled' });
        if (res.success) {
          fetchPurchaseOrders();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeletePO = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this Purchase Order?')) {
      try {
        const res = await purchaseOrdersAPI.delete(id);
        if (res.success) {
          fetchPurchaseOrders();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenGRN = async (po) => {
    if (loadingDetails) return;
    setLoadingDetails(true);
    try {
      const res = await purchaseOrdersAPI.getById(po.id);
      if (res.success && res.order) {
        setSelectedPO(res.order);
        setShowGRNForm(true);
      } else {
        dispatch(showToast({ msg: res.message || 'Failed to load purchase order details.', type: 'error' }));
      }
    } catch (err) {
      console.error(err);
      dispatch(showToast({ msg: 'An error occurred while fetching purchase order details.', type: 'error' }));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenInvoice = async (po) => {
    if (loadingDetails) return;
    setLoadingDetails(true);
    try {
      const res = await purchaseOrdersAPI.getById(po.id);
      if (res.success && res.order) {
        setSelectedPO(res.order);
        setShowInvoiceForm(true);
      } else {
        dispatch(showToast({ msg: res.message || 'Failed to load purchase order details.', type: 'error' }));
      }
    } catch (err) {
      console.error(err);
      dispatch(showToast({ msg: 'An error occurred while fetching purchase order details.', type: 'error' }));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenFinalizeModal = async (po) => {
    if (loadingDetails) return;
    setLoadingDetails(true);
    try {
      const res = await purchaseOrdersAPI.getById(po.id);
      if (res.success && res.order) {
        setFinalizePOData(res.order);
        setFinalizeSettlementChoice('FULL_ORDER');
        setFinalizeCustomAmt('');
        setShowFinalizeModal(true);
      } else {
        dispatch(showToast({ msg: res.message || 'Failed to load purchase order details.', type: 'error' }));
      }
    } catch (err) {
      console.error(err);
      dispatch(showToast({ msg: 'An error occurred while fetching purchase order details.', type: 'error' }));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirmFinalize = async () => {
    if (!finalizePOData || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const ordQty = Number(finalizePOData.total_ordered_quantity || 0);
      const delQty = Number(finalizePOData.total_delivered_quantity || 0);
      const damQty = Number(finalizePOData.total_damaged_quantity || 0);
      const undelQty = Math.max(0, ordQty - delQty);
      const damVal = Number(finalizePOData.total_damaged_deduction || 0);

      let undelVal = 0;
      (finalizePOData.items || []).forEach(it => {
        const o = Number(it.quantity || 0);
        const d = Number(it.total_delivered ?? it.delivered_quantity ?? 0);
        const u = Math.max(0, o - d);
        const p = Number(it.purchase_price || 0);
        const gst = Number(it.gst || 0);
        undelVal += u * p * (1 + gst / 100);
      });

      let advanceAmount = 0;
      let cancelledUnits = 0;
      let reason = '';

      if (finalizeSettlementChoice === 'FULL_ORDER') {
        advanceAmount = Number((damVal + undelVal).toFixed(2));
        cancelledUnits = damQty + undelQty;
        reason = `Tarika 2: Paid for all ${ordQty} ordered items; credited ${damQty} damaged (₹${damVal.toFixed(2)}) + ${undelQty} cancelled undelivered (₹${undelVal.toFixed(2)}) as Advance Jama`;
      } else if (finalizeSettlementChoice === 'DELIVERED') {
        advanceAmount = Number(damVal.toFixed(2));
        cancelledUnits = damQty;
        reason = `Tarika 2: Paid for ${delQty} delivered items; credited ${damQty} damaged (₹${damVal.toFixed(2)}) as Advance Jama`;
      } else if (finalizeSettlementChoice === 'UNDELIVERED_ONLY') {
        advanceAmount = Number(undelVal.toFixed(2));
        cancelledUnits = undelQty;
        reason = `Tarika 2: Credited ${undelQty} cancelled undelivered items (₹${undelVal.toFixed(2)}) as Advance Jama`;
      } else if (finalizeSettlementChoice === 'CUSTOM') {
        advanceAmount = Number(finalizeCustomAmt) || 0;
        cancelledUnits = undelQty + damQty;
        reason = `Tarika 2: Custom payment adjustment credited as Advance Jama`;
      }

      const res = await purchaseOrdersAPI.finalizeWithAdvance(finalizePOData.id, {
        advance_amount: advanceAmount,
        cancelled_units: cancelledUnits,
        reason
      });

      if (res.success) {
        toast.success(res.message || 'PO finalized and Advance Jama updated!');
        setShowFinalizeModal(false);
        setFinalizePOData(null);
        fetchPurchaseOrders();
        window.dispatchEvent(new CustomEvent('vendor-updated'));
        window.dispatchEvent(new CustomEvent('inventory-updated'));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to finalize purchase order');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleViewDetails = async (po) => {
    if (loadingDetails) return;
    setLoadingDetails(true);
    try {
      const res = await purchaseOrdersAPI.getById(po.id);
      if (res.success && res.order) {
        setViewingPO(res.order);
      } else {
        dispatch(showToast({ msg: res.message || 'Failed to load purchase order details.', type: 'error' }));
      }
    } catch (err) {
      console.error(err);
      dispatch(showToast({ msg: 'An error occurred while fetching purchase order details.', type: 'error' }));
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return purchaseOrders.map(p => ({
      ...p,
      status: p.status === 'Partially Received' ? 'Partially Pending' : p.status
    })).filter((po) => {
      const poNo = String(po?.purchase_order_no || '').toLowerCase();
      const vName = String(po?.vendor_name || '').toLowerCase();
      const q = (searchQuery || '').toLowerCase();
      const matchSearch = poNo.includes(q) || vName.includes(q);
      const matchStatus =
        statusFilter === 'all' ||
        po.status === statusFilter ||
        (statusFilter === 'Partially Pending' && (po.status === 'Partially Pending' || po.status === 'Partially Received')) ||
        (statusFilter === 'Pending' && (po.status === 'Pending' || po.status === 'Draft'));
      return matchSearch && matchStatus;
    });
  }, [purchaseOrders, searchQuery, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'Pending':
        return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      case 'Sent':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Confirmed':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Partially Pending':
      case 'Partially Received':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const handlePrintPO = (po) => {
    const win = window.open('', '_blank');
    const subtotal = Number(po.subtotal || 0);
    const gstAmount = Number(po.gst_amount || 0);
    const discount = Number(po.discount || 0);
    const total = Number(po.total || 0);
    
    const itemsHtml = po.items.map((item, idx) => {
      const isPendingRate = Number(item.purchase_price || 0) === 0;
      return `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${item.product_name || 'Product'}${item.measurement_value ? ` <span style="font-size: 9px; color: #b45309; font-weight: bold;">(${item.measurement_value})</span>` : ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-family: monospace; font-size: 9px;">${item.barcode || '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${item.category || 'General'}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${item.quantity}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${item.unit || 'Pcs'}</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${isPendingRate ? 'Rate on Delivery' : '₹' + Number(item.purchase_price).toFixed(2)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${isPendingRate ? 'On Delivery' : (item.gst || 0) + '%'}</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">₹0.00</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${isPendingRate ? '—' : '₹' + Number(item.total || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #64748b; font-size: 9px;">${item.remarks || '—'}</td>
      </tr>
    `;
    }).join('');

    win.document.write(`
      <html>
      <head>
        <title>Purchase Order - ${po.purchase_order_no}</title>
        <style>
          @page { size: A4 portrait; margin: 0.4in; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; background: #fff; font-size: 10px; }
          .container { width: 100%; max-width: 800px; margin: 0 auto; padding: 10px; }
          
          .header-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 20px; border-bottom: 2px solid #1B6E4C; padding-bottom: 15px; margin-bottom: 20px; }
          .logo-container { display: flex; align-items: center; gap: 12px; }
          .store-name { font-size: 20px; font-weight: 900; text-transform: uppercase; color: #1B6E4C; margin: 0; letter-spacing: -0.5px; }
          .store-details { font-size: 9.5px; color: #475569; margin: 3px 0 0 0; line-height: 1.3; }
          .document-title-block { text-align: right; }
          .document-title { font-size: 24px; font-weight: 900; color: #1B6E4C; margin: 0; letter-spacing: 0.5px; }
          .document-no { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 5px; font-family: monospace; }
          
          .po-meta-banner { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 15px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
          .meta-item { font-size: 10px; font-weight: 600; color: #475569; }
          .meta-item span { display: block; font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          .meta-item .status-badge { display: inline-block; background: #EAF3EE; color: #1B6E4C; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; border: 1px solid #cbd5e1; margin-top: 2px; text-transform: uppercase; }
          
          .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff; }
          .info-title { font-size: 9px; font-weight: 850; text-transform: uppercase; color: #1B6E4C; margin-bottom: 8px; border-bottom: 1.5px solid #1B6E4C; padding-bottom: 4px; letter-spacing: 0.5px; }
          .info-row { margin: 4px 0; font-weight: 600; color: #475569; font-size: 9.5px; }
          .info-row span { color: #0f172a; font-weight: 700; }
          
          .product-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9.5px; }
          .product-table th { background: #EAF3EE; border: 1px solid #cbd5e1; color: #1B6E4C; font-weight: 850; text-transform: uppercase; font-size: 8px; padding: 8px 5px; text-align: center; }
          .product-table td { padding: 6px 5px; border: 1px solid #cbd5e1; }
          
          .totals-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; gap: 20px; }
          .terms-box { width: 58%; font-size: 9px; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
          .terms-title { font-weight: 850; text-transform: uppercase; color: #1B6E4C; font-size: 9px; margin-bottom: 6px; letter-spacing: 0.5px; }
          .totals-box { width: 38%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; font-size: 10.5px; }
          .total-row { display: flex; justify-content: space-between; margin: 4px 0; font-weight: 650; }
          .total-row.grand { border-top: 1.5px solid #cbd5e1; padding-top: 6px; margin-top: 6px; font-weight: 850; font-size: 13px; color: #1B6E4C; }
          
          .sig-seal-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 45px; }
          .signatures-grid { width: 72%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
          .sig-line { border-top: 1px solid #cbd5e1; padding-top: 6px; font-weight: 700; font-size: 8.5px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
          .sig-value { font-weight: 800; font-size: 9.5px; color: #0f172a; margin-bottom: 35px; }
          .seal-box { width: 25%; text-align: center; }
          .seal-ring { border: 1.5px dashed #cbd5e1; border-radius: 50%; width: 68px; height: 68px; margin: 0 auto 8px auto; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 850; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; }
          .seal-title { font-weight: 700; font-size: 8.5px; color: #475569; text-transform: uppercase; }
          
          .footer { text-align: center; margin-top: 35px; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-grid">
            <div class="logo-container">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1B6E4C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <div>
                <h1 class="store-name">${storeSettings.storeName}</h1>
                <div class="store-details">${storeSettings.storeAddress}</div>
                <div class="store-details">📞 Ph: ${storeSettings.storePhone} | ✉ Email: ${storeSettings.storeEmail}</div>
              </div>
            </div>
            <div class="document-title-block">
              <h2 class="document-title">PURCHASE ORDER</h2>
              <div class="document-no">No: ${po.purchase_order_no}</div>
              <div class="store-details" style="margin-top: 5px;"><strong>GSTIN:</strong> ${storeSettings.gstin} | <strong>Reg No:</strong> ${storeSettings.shopRegNo}</div>
            </div>
          </div>
          
          <div class="po-meta-banner">
            <div class="meta-item">Order Date <span>${new Date(po.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            <div class="meta-item">Expected Delivery <span>${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Immediate'}</span></div>
            <div class="meta-item">Prepared By <span>${po.prepared_by || 'Admin'}</span></div>
            <div class="meta-item">Order Status <span class="status-badge">${po.status}</span></div>
          </div>
          
          <div class="info-section">
            <div class="info-box">
              <div class="info-title">Vendor Information</div>
              <div class="info-row">Company Name: <span>${po.vendor_name || 'Vendor Company'}</span></div>
              <div class="info-row">Contact Person: <span>${po.vendor_name || '—'}</span></div>
              <div class="info-row">Mobile Number: <span>${po.vendor_phone || '—'}</span></div>
              <div class="info-row">Email Address: <span>${po.vendor_email || '—'}</span></div>
              <div class="info-row">GST Number: <span>${po.vendor_gstin || '—'}</span></div>
              <div class="info-row">Complete Address: <span>${po.vendor_address || '—'}</span></div>
              <div class="info-row">Payment Terms: <span>Net 30 days</span></div>
            </div>
            <div class="info-box">
              <div class="info-title">Delivery Details</div>
              <div class="info-row">Delivery Address: <span>${storeSettings.storeAddress}</span></div>
              <div class="info-row">Delivery Contact Person: <span>Store Manager</span></div>
              <div class="info-row">Special Instructions: <span>${po.notes || 'Please deliver during business hours. Verify items count.'}</span></div>
            </div>
          </div>
          
          <table class="product-table">
            <thead>
              <tr>
                <th style="width: 5%;">Sr. No.</th>
                <th style="width: 25%; text-align: left;">Product Name</th>
                <th style="width: 13%;">SKU/Barcode</th>
                <th style="width: 10%;">Category</th>
                <th style="width: 7%;">Qty</th>
                <th style="width: 6%;">Unit</th>
                <th style="width: 9%;">Rate</th>
                <th style="width: 6%;">GST %</th>
                <th style="width: 8%;">Discount</th>
                <th style="width: 11%;">Total Amount</th>
                <th style="width: 10%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="totals-section">
            <div class="terms-box">
              <div class="terms-title">Terms & Conditions</div>
              <div style="margin-bottom: 3.5px;">1. Please reference the PO number on all invoices and packaging slips.</div>
              <div style="margin-bottom: 3.5px;">2. Deliveries must contain precise count of items listed above.</div>
              <div style="margin-bottom: 3.5px;">3. Notify the store immediately if any items are out of stock or delayed.</div>
              <div>4. Damaged or sub-standard goods will be returned at the vendor's cost.</div>
            </div>
            <div class="totals-box">
              <div class="total-row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
              <div class="total-row"><span>GST Amount:</span><span>₹${gstAmount.toFixed(2)}</span></div>
              <div class="total-row"><span>Discount Amount:</span><span>-₹${discount.toFixed(2)}</span></div>
              <div class="total-row grand"><span>Grand Total:</span><span>₹${total.toFixed(2)}</span></div>
            </div>
          </div>
          
          <div class="sig-seal-section">
            <div class="signatures-grid">
              <div>
                <div class="sig-value">${po.prepared_by || 'Admin'}</div>
                <div class="sig-line">Prepared By</div>
              </div>
              <div>
                <div class="sig-value" style="height: 35px;"></div>
                <div class="sig-line">Authorized Signatory</div>
              </div>
              <div>
                <div class="sig-value" style="height: 35px;"></div>
                <div class="sig-line">Vendor Signature</div>
              </div>
            </div>
            <div class="seal-box">
              <div class="seal-ring">Company Seal</div>
              <div class="seal-title">Official Seal</div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an official system-generated Purchase Order.</p>
            <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 450);
  };

  return (
    <div className="space-y-5 select-none">
      
      {/* 1. Header Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <DocumentPlusIcon className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Purchase Orders (PO)</h2>
            <p className="text-[10px] font-semibold text-slate-500">Draft or place stock requests to supplier catalog lines</p>
          </div>
        </div>
        
        {!isReadOnly && (
          <button
            onClick={() => {
              setSelectedPO(null);
              setShowPOForm(true);
            }}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 active:scale-95 transition-all cursor-pointer"
          >
            <PlusIcon className="w-5 h-5 stroke-[2.5]" />
            Create Purchase Order
          </button>
        )}
      </div>

      {/* 2. Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative flex items-center col-span-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO number or vendor..."
            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-bold"
        >
          <option value="all">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Partially Pending">Partially Pending</option>
          <option value="Completed">Completed</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* 3. Orders List Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        {loading ? (
          <div className="py-12 flex justify-center">
            <span className="text-sm font-semibold text-slate-500 animate-pulse">Loading orders...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-450 font-bold text-xs">
            No purchase orders found matching filters.
          </div>
        ) : (
          <div 
            className="overflow-x-auto max-h-[295px] overflow-y-auto custom-scrollbar border border-slate-200/80 rounded-xl shadow-2xs"
            style={{ maxHeight: '295px' }}
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-xs">
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800">
                  <th className="py-3 px-4 whitespace-nowrap">PO Number</th>
                  <th className="py-3 px-4 whitespace-nowrap">Vendor</th>
                  <th className="py-3 px-4 whitespace-nowrap">Order Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Expected Delivery</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Total Amount</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-950 whitespace-nowrap">
                      <button onClick={() => handleViewDetails(po)} className="hover:text-indigo-650 hover:underline">
                        {po.purchase_order_no}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">{po.vendor_name}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{new Date(po.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {po.expected_delivery_date 
                        ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-950 tabular-nums whitespace-nowrap">
                      {Number(po.total) === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 whitespace-nowrap">
                          Pending Bill Verification
                        </span>
                      ) : (
                        `₹${Number(po.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${getStatusBadge(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Details */}
                        <button
                          onClick={() => handleViewDetails(po)}
                          title="View Details"
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg active:scale-90 transition-all cursor-pointer"
                        >
                          <EyeIcon className="w-4 h-4 stroke-[2]" />
                        </button>

                        {/* GRN goods inward */}
                        {!isReadOnly && ['Draft', 'Pending', 'Sent', 'Confirmed', 'Partially Pending', 'Partially Received'].includes(po.status) && (
                          <button
                            onClick={() => handleOpenGRN(po)}
                            title={['Partially Pending', 'Partially Received'].includes(po.status) ? "Receive Remaining Stock (GRN)" : "Receive Shipment (GRN)"}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg active:scale-90 transition-all cursor-pointer"
                          >
                            <InboxArrowDownIcon className="w-4 h-4 stroke-[2]" />
                          </button>
                        )}

                        {/* Invoice conversion - Available on active PO statuses */}
                        {!isReadOnly && ['Draft', 'Pending', 'Sent', 'Confirmed', 'Partially Pending', 'Partially Received'].includes(po.status) && (
                          <button
                            onClick={() => handleOpenInvoice(po)}
                            title="Create Invoice (PI) - Update Supplier Balance & Stock"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg active:scale-90 transition-all cursor-pointer"
                          >
                            <CurrencyRupeeIcon className="w-4 h-4 stroke-[2]" />
                          </button>
                        )}

                        {/* Tarika 2: Finalize PO & Credit Advance Jama */}
                        {!isReadOnly && ['Partially Pending', 'Partially Received', 'Confirmed'].includes(po.status) && (
                          <button
                            onClick={() => handleOpenFinalizeModal(po)}
                            title="Finalize PO & Credit Remaining as Advance Jama (Tarika 2)"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg active:scale-90 transition-all cursor-pointer"
                          >
                            <ShieldCheckIcon className="w-4 h-4 stroke-[2]" />
                          </button>
                        )}

                        {/* Cancel order */}
                        {!isReadOnly && ['Draft', 'Pending', 'Sent', 'Confirmed'].includes(po.status) && (
                          <button
                            onClick={() => handleCancelPO(po.id)}
                            title="Cancel Order"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg active:scale-90 transition-all cursor-pointer"
                          >
                            <XCircleIcon className="w-4 h-4 stroke-[2]" />
                          </button>
                        )}

                        {/* Delete PO */}
                        {!isReadOnly && ['Draft', 'Pending', 'Cancelled'].includes(po.status) && (
                          <button
                            onClick={() => handleDeletePO(po.id)}
                            title="Delete Permanently"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg active:scale-90 transition-all cursor-pointer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* MODAL 1: CREATE PO FORM */}
      <Modal
        isOpen={showPOForm}
        onClose={() => setShowPOForm(false)}
        title="Draft New Purchase Order Request"
        size="4xl"
        noPadding={true}
      >
        <div className="p-6 overflow-hidden flex flex-col min-h-0 flex-1">
          <PurchaseOrderForm
            onSubmit={handleCreatePO}
            onCancel={() => setShowPOForm(false)}
          />
        </div>
      </Modal>

      {/* MODAL 2: GRN GOODS RECEIVING FORM */}
      <Modal
        isOpen={showGRNForm && !!selectedPO}
        onClose={() => {
          setShowGRNForm(false);
          setSelectedPO(null);
        }}
        title="Verify Supplier Shipment - Goods Received Note (GRN)"
        size="4xl"
        noPadding={true}
      >
        <div className="p-6 overflow-hidden flex flex-col min-h-0 flex-1">
          <GRNForm
            purchaseOrder={selectedPO}
            onSubmit={handleCreateGRN}
            onCancel={() => {
              setShowGRNForm(false);
              setSelectedPO(null);
            }}
          />
        </div>
      </Modal>

      {/* MODAL 3: INVOICE GENERATION FORM */}
      <Modal
        isOpen={showInvoiceForm && !!selectedPO}
        onClose={() => {
          setShowInvoiceForm(false);
          setSelectedPO(null);
        }}
        title={`Record Purchase Invoice from Order #${selectedPO?.purchase_order_no}`}
        size="4xl"
        noPadding={true}
      >
        <PurchaseForm
          purchaseOrder={selectedPO}
          onSubmit={handleCreateInvoice}
          onCancel={() => {
            setShowInvoiceForm(false);
            setSelectedPO(null);
          }}
        />
      </Modal>

      {/* MODAL 5: FINALIZE PO & APPLY TARIKA 2 ADVANCE CREDIT */}
      {showFinalizeModal && finalizePOData && (() => {
        const ordQty = Number(finalizePOData.total_ordered_quantity || 0);
        const delQty = Number(finalizePOData.total_delivered_quantity || 0);
        const damQty = Number(finalizePOData.total_damaged_quantity || 0);
        const accQty = Number(finalizePOData.total_accepted_quantity || 0);
        const undelQty = Math.max(0, ordQty - delQty);
        const damVal = Number(finalizePOData.total_damaged_deduction || 0);

        let undelVal = 0;
        let ordVal = 0;
        let delVal = 0;
        let accVal = 0;
        (finalizePOData.items || []).forEach(it => {
          const o = Number(it.quantity || 0);
          const d = Number(it.total_delivered ?? it.delivered_quantity ?? 0);
          const dm = Number(it.total_damaged ?? it.damaged_quantity ?? 0);
          const a = Math.max(0, d - dm);
          const u = Math.max(0, o - d);
          const p = Number(it.purchase_price || 0);
          const gst = Number(it.gst || 0);
          const unitRate = p * (1 + gst / 100);
          undelVal += u * unitRate;
          ordVal += o * unitRate;
          delVal += d * unitRate;
          accVal += a * unitRate;
        });

        const fullAdvance = Number((damVal + undelVal).toFixed(2));

        return (
          <Modal
            isOpen={showFinalizeModal}
            onClose={() => !isFinalizing && setShowFinalizeModal(false)}
            title={`Tarika 2: Finalize PO #${finalizePOData.purchase_order_no}`}
            size="2xl"
          >
            <div className="p-6 space-y-5">
              {/* Header Box */}
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/70 dark:from-amber-950/40 dark:to-slate-900 border-2 border-amber-300 dark:border-amber-700 rounded-2xl shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none mt-0.5">🛡️</span>
                  <div>
                    <h3 className="text-sm font-black text-amber-950 dark:text-amber-100 uppercase tracking-wider">
                      PO Finalize &amp; Advance Jama Settlement (तरीका 2)
                    </h3>
                    <p className="text-xs text-amber-900 dark:text-amber-300 mt-1 leading-relaxed">
                      Supplier: <strong className="font-bold text-slate-900 dark:text-white">{finalizePOData.vendor_name}</strong> | PO #{finalizePOData.purchase_order_no}
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5">
                      Agar purchase invoice pehle save ho chuki hai aur bache huye packets ab nahi mangwane, to unka paisa Supplier ke <strong>Advance Balance (जमा)</strong> me transfer ho jayega.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Ordered</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{ordQty} units</span>
                  <span className="block text-[10px] text-slate-400 font-mono">₹{ordVal.toFixed(2)}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Accepted / Stock</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{accQty} units</span>
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">₹{accVal.toFixed(2)}</span>
                </div>
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                  <span className="block text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">Damaged</span>
                  <span className="text-base font-black text-rose-700 dark:text-rose-300">{damQty} units</span>
                  <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-mono">₹{damVal.toFixed(2)}</span>
                </div>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Undelivered</span>
                  <span className="text-base font-black text-amber-700 dark:text-amber-300">{undelQty} units</span>
                  <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-mono">₹{undelVal.toFixed(2)}</span>
                </div>
              </div>

              {/* Settlement Choice Radios */}
              <div className="space-y-2.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Payment Done to Supplier:
                </label>

                {/* Option 1: Full Order Paid (e.g. 20 packets) */}
                {undelQty > 0 && (
                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    finalizeSettlementChoice === 'FULL_ORDER'
                      ? 'bg-amber-100/90 dark:bg-amber-900/50 border-amber-400 dark:border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="finalizeSettlementChoice"
                      value="FULL_ORDER"
                      checked={finalizeSettlementChoice === 'FULL_ORDER'}
                      onChange={() => setFinalizeSettlementChoice('FULL_ORDER')}
                      className="mt-0.5 w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-slate-900 dark:text-white">
                          Full Order ({ordQty} units) Payment Done (₹{ordVal.toFixed(2)})
                        </span>
                        <span className="font-mono font-black text-amber-800 dark:text-amber-300 text-xs bg-amber-200/80 dark:bg-amber-900 px-2 py-0.5 rounded">
                          +₹{fullAdvance.toFixed(2)} Advance Jama
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Aapne pure {ordQty} units ka payment kar diya tha. Accepted bill: {accQty} units (₹{accVal.toFixed(2)}) ban chuka hai. Baaki <strong>{damQty + undelQty} units ({damQty} damaged + {undelQty} undelivered) ka ₹{fullAdvance.toFixed(2)}</strong> Supplier ke <strong>Advance Balance (जमा)</strong> me credit ho jayega.
                      </p>
                    </div>
                  </label>
                )}

                {/* Option 2: Delivered items paid (e.g. 15 packets) */}
                {damQty > 0 && (
                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    finalizeSettlementChoice === 'DELIVERED'
                      ? 'bg-amber-100/90 dark:bg-amber-900/50 border-amber-400 dark:border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="finalizeSettlementChoice"
                      value="DELIVERED"
                      checked={finalizeSettlementChoice === 'DELIVERED'}
                      onChange={() => setFinalizeSettlementChoice('DELIVERED')}
                      className="mt-0.5 w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-slate-900 dark:text-white">
                          Only Delivered Items ({delQty} units) Payment Done (₹{delVal.toFixed(2)})
                        </span>
                        <span className="font-mono font-black text-amber-800 dark:text-amber-300 text-xs bg-amber-200/80 dark:bg-amber-900 px-2 py-0.5 rounded">
                          +₹{damVal.toFixed(2)} Advance Jama
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Keval {delQty} delivered units ka payment hua tha. Unme se <strong>{damQty} damaged units ka ₹{damVal.toFixed(2)}</strong> Supplier ke Advance Balance (जमा) me credit ho jayega.
                      </p>
                    </div>
                  </label>
                )}

                {/* Option 3: Custom Amount */}
                <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  finalizeSettlementChoice === 'CUSTOM'
                    ? 'bg-amber-100/90 dark:bg-amber-900/50 border-amber-400 dark:border-amber-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="finalizeSettlementChoice"
                    value="CUSTOM"
                    checked={finalizeSettlementChoice === 'CUSTOM'}
                    onChange={() => setFinalizeSettlementChoice('CUSTOM')}
                    className="mt-0.5 w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">Custom Advance Jama Amount</span>
                    {finalizeSettlementChoice === 'CUSTOM' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-bold text-slate-600 dark:text-slate-400">₹</span>
                        <input
                          type="number"
                          value={finalizeCustomAmt}
                          onChange={(e) => setFinalizeCustomAmt(e.target.value)}
                          placeholder="Enter amount to credit"
                          className="px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white w-48"
                        />
                      </div>
                    )}
                  </div>
                </label>

                {/* Option 4: Close without advance */}
                <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  finalizeSettlementChoice === 'NONE'
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="finalizeSettlementChoice"
                    value="NONE"
                    checked={finalizeSettlementChoice === 'NONE'}
                    onChange={() => setFinalizeSettlementChoice('NONE')}
                    className="mt-0.5 w-4 h-4 text-slate-600 focus:ring-slate-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">No Advance Credit / Only Close PO</span>
                    <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                      Koi advance payment nahi hua tha, keval order ko Completed/Locked mark karna hai.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(false)}
                  disabled={isFinalizing}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFinalize}
                  disabled={isFinalizing}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 rounded-xl shadow-lg shadow-amber-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <LockClosedIcon className="w-4 h-4 stroke-[2.2]" />
                  {isFinalizing ? 'Finalizing...' : 'Confirm & Credit Advance Jama'}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL 4: VIEW PO SUMMARY SHEET */}
      <Modal
        isOpen={!!viewingPO}
        onClose={() => setViewingPO(null)}
        title="Official Purchase Order Document"
        size="3xl"
        noPadding={true}
      >
        {viewingPO && (
          <div className="flex flex-col max-h-[85vh] overflow-y-auto bg-slate-100 font-sans select-none text-slate-800">
            
            {/* Document Container */}
            <div className="bg-white m-6 p-8 border border-slate-200 rounded-2xl shadow-sm space-y-6">
              
              {/* store details logo grid */}
              <div className="flex justify-between items-start gap-4 pb-4 border-b-2 border-emerald-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{storeSettings.storeName}</h2>
                    {storeSettings.storeAddress && (
                      <p className="text-xs font-semibold text-slate-500 max-w-sm mt-0.5">{storeSettings.storeAddress}</p>
                    )}
                    {(storeSettings.storePhone || storeSettings.storeEmail) && (
                      <p className="text-[10px] font-bold text-slate-400 mt-1">
                        {storeSettings.storePhone ? `📞 Ph: ${storeSettings.storePhone}` : ''}
                        {storeSettings.storePhone && storeSettings.storeEmail ? ' | ' : ''}
                        {storeSettings.storeEmail ? `✉ ${storeSettings.storeEmail}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-black text-emerald-800 tracking-wider">PURCHASE ORDER</h1>
                  <p className="text-xs font-mono font-bold text-slate-500 mt-1">Order ID: #{viewingPO.purchase_order_no}</p>
                  {(storeSettings.gstin || storeSettings.shopRegNo) && (
                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                      {storeSettings.gstin ? `GSTIN: ${storeSettings.gstin}` : ''}
                      {storeSettings.gstin && storeSettings.shopRegNo ? ' | ' : ''}
                      {storeSettings.shopRegNo ? `Reg: ${storeSettings.shopRegNo}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* PO metadata columns */}
              <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 border border-slate-200/80 rounded-xl">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Order Date</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">{new Date(viewingPO.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Expected Delivery</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">{viewingPO.expected_delivery_date ? new Date(viewingPO.expected_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Immediate'}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Prepared By</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">{viewingPO.prepared_by || 'Admin'}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Order Status</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${getStatusBadge(viewingPO.status)}`}>
                    {viewingPO.status}
                  </span>
                </div>
              </div>

              {['Partially Pending', 'Partially Received'].includes(viewingPO.status) && (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="block font-black text-amber-950">Shipment Partially Pending — Missing Items Pending Delivery</span>
                    <span className="text-[11px] font-semibold text-amber-700">This Purchase Order stays open in &quot;Partially Pending&quot; status. Full stock has not arrived yet. You can click &quot;Receive Remaining Stock (GRN)&quot; when the supplier delivers the remaining goods.</span>
                  </div>
                </div>
              )}

              {/* info billing columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-[10px] font-black text-emerald-850 uppercase tracking-widest border-b border-slate-100 pb-1.5">Vendor Information</h4>
                  <div className="text-xs font-semibold text-slate-650 space-y-1">
                    <div>Vendor Name: <span className="text-slate-900 font-bold">{viewingPO.vendor_name || 'Vendor Company'}</span></div>
                    <div>Contact Person: <span className="text-slate-900">{viewingPO.vendor_name || '—'}</span></div>
                    <div>Mobile Number: <span className="text-slate-900 font-mono">{viewingPO.vendor_phone || '—'}</span></div>
                    <div>Email Address: <span className="text-slate-900">{viewingPO.vendor_email || '—'}</span></div>
                    <div>GST Number: <span className="text-slate-900 font-mono">{viewingPO.vendor_gstin || '—'}</span></div>
                    <div>Complete Address: <span className="text-slate-900">{viewingPO.vendor_address || '—'}</span></div>
                    <div>Payment Terms: <span className="text-slate-900">Net 30 days</span></div>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-[10px] font-black text-emerald-850 uppercase tracking-widest border-b border-slate-100 pb-1.5">Delivery Details</h4>
                  <div className="text-xs font-semibold text-slate-650 space-y-1">
                    <div>Delivery Address: <span className="text-slate-900">{storeSettings.storeAddress}</span></div>
                    <div>Delivery Contact Person: <span className="text-slate-900 font-bold">Store Manager</span></div>
                    <div>Special Instructions: <span className="text-slate-900 italic">{viewingPO.notes || 'Please deliver during business hours. Verify items count.'}</span></div>
                  </div>
                </div>
              </div>

              {/* products table layout */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-450 uppercase border-b border-slate-200">
                      <th className="py-2.5 px-4 text-center">Sr. No.</th>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4 text-center">SKU/Barcode</th>
                      <th className="py-2.5 px-4 text-center">Category</th>
                      <th className="py-2.5 px-4 text-center">Ordered Qty</th>
                      <th className="py-2.5 px-4 text-center">Unit</th>
                      <th className="py-2.5 px-4 text-right">Purchase Rate</th>
                      <th className="py-2.5 px-4 text-center">GST %</th>
                      <th className="py-2.5 px-4 text-right">Discount</th>
                      <th className="py-2.5 px-4 text-right">Total Amount</th>
                      <th className="py-2.5 px-4 text-center">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {viewingPO.items.map((item, index) => {
                      const isPendingRate = Number(item.purchase_price || 0) === 0;
                      return (
                        <tr key={index} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">{index + 1}</td>
                          <td className="py-2.5 px-4 text-slate-900 font-bold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.product_name}</span>
                              {item.brand && (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.brand}
                                </span>
                              )}
                              {item.measurement_value && (
                                <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                  ⚖️ {item.measurement_value}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-500 font-mono">{item.barcode || '—'}</td>
                          <td className="py-2.5 px-4 text-center text-slate-500">{item.category || 'General'}</td>
                          <td className="py-2.5 px-4 text-center tabular-nums">
                            <span className="font-bold text-slate-900">{item.quantity}</span>
                            {['Partially Pending', 'Partially Received'].includes(viewingPO.status) && (
                              <div className="text-[9px] font-bold mt-0.5">
                                {Number(item.received_quantity || 0) < Number(item.quantity) ? (
                                  <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                                    In: {Number(item.received_quantity || 0)} | Short: {Number(item.quantity) - Number(item.received_quantity || 0)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 inline-block">
                                    100% Inwarded
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-450">{item.unit || 'Pcs'}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {isPendingRate ? (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold">Rate on Delivery</span>
                            ) : (
                              `₹${Number(item.purchase_price).toFixed(2)}`
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center tabular-nums text-slate-500">
                            {isPendingRate ? 'On Delivery' : `${item.gst || 0}%`}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-rose-500">₹0.00</td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900 tabular-nums">
                            {isPendingRate ? '—' : `₹${Number(item.total).toFixed(2)}`}
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 italic text-[11px]">{item.remarks || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* STOCK DELIVERY INSTALLMENTS BREAKDOWN */}
              {Array.isArray(viewingPO.shipments) && viewingPO.shipments.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📦</span>
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Stock Delivery &amp; Intake Installments (माल प्राप्ति किश्त विवरण)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded">
                      Total {viewingPO.shipments.length} Delivery Installment{viewingPO.shipments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                        <th className="py-2 px-3 text-center w-12">Installment</th>
                        <th className="py-2 px-3">GRN Number</th>
                        <th className="py-2 px-3">Intake Date</th>
                        <th className="py-2 px-3 text-center">Delivered Qty</th>
                        <th className="py-2 px-3 text-center">Damaged / Rejected</th>
                        <th className="py-2 px-3 text-center font-bold text-emerald-800">Accepted Inward</th>
                        <th className="py-2 px-3 text-right font-black">Shipment Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {viewingPO.shipments.map((ship, sIdx) => {
                        const sDate = ship.date ? new Date(ship.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                        const recQty = Number(ship.total_received || 0);
                        const damQty = Number(ship.total_damaged || 0) + Number(ship.total_rejected || 0);
                        const accQty = Number(ship.total_accepted || Math.max(0, recQty - damQty));
                        const shipAmt = Number(ship.amount || 0);

                        return (
                          <tr key={sIdx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-center font-bold text-slate-500 text-[10px]">
                              #{ship.installment_no || sIdx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {ship.grn_no || `GRN-${ship.id}`}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{sDate}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900">{recQty}</td>
                            <td className="py-2 px-3 text-center">
                              {damQty > 0 ? (
                                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {damQty} Damaged
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-700">{accQty}</td>
                            <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                              ₹{shipAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900 text-[11px]">
                        <td colSpan="3" className="py-2 px-3 uppercase tracking-wider text-slate-500">
                          Total Received Across Deliveries:
                        </td>
                        <td className="py-2 px-3 text-center font-black">
                          {viewingPO.shipments.reduce((sum, s) => sum + Number(s.total_received || 0), 0)}
                        </td>
                        <td className="py-2 px-3 text-center text-rose-700 font-black">
                          {viewingPO.shipments.reduce((sum, s) => sum + (Number(s.total_damaged || 0) + Number(s.total_rejected || 0)), 0)}
                        </td>
                        <td className="py-2 px-3 text-center text-emerald-700 font-black">
                          {viewingPO.shipments.reduce((sum, s) => sum + Number(s.total_accepted || 0), 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                          ₹{viewingPO.shipments.reduce((sum, s) => sum + Number(s.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* PAYMENT SETTLEMENT INSTALLMENTS */}
              {Array.isArray(viewingPO.payments) && viewingPO.payments.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💳</span>
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Supplier Payment Installments (भुगतान किश्त विवरण)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-200 bg-emerald-950 px-2 py-0.5 rounded">
                      Total {viewingPO.payments.length} Payment Installment{viewingPO.payments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-50/50 text-[10px] font-bold text-slate-600 uppercase border-b border-emerald-200">
                        <th className="py-2 px-3 text-center w-12">Payment</th>
                        <th className="py-2 px-3">Voucher No.</th>
                        <th className="py-2 px-3">Payment Date</th>
                        <th className="py-2 px-3 text-center">Payment Mode</th>
                        <th className="py-2 px-3">Invoice Ref</th>
                        <th className="py-2 px-3 text-right font-black">Amount Paid (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {viewingPO.payments.map((pay, pIdx) => {
                        const pDate = pay.payment_date ? new Date(pay.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                        const pAmt = Number(pay.amount || 0);

                        return (
                          <tr key={pIdx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-center font-bold text-slate-500 text-[10px]">
                              #{pay.installment_no || pIdx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {pay.payment_no || `VPAY-${pay.id}`}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{pDate}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px] text-slate-700 border border-slate-200">
                                {pay.payment_mode || 'Cash'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[11px] font-mono">
                              {pay.purchase_no || pay.reference_no || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">
                              ₹{pAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50/80 font-bold border-t border-emerald-200 text-slate-900 text-[11px]">
                        <td colSpan="5" className="py-2 px-3 uppercase tracking-wider text-slate-700 text-right">
                          Total Payments Settled:
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                          ₹{viewingPO.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* terms notes totals layout */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">
                <div className="md:col-span-3 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-500">
                  <h5 className="font-extrabold text-emerald-800 text-[10px] uppercase tracking-wider mb-1">Terms & Conditions</h5>
                  <div className="leading-relaxed">1. Please reference the PO number on all invoices and packaging slips.</div>
                  <div className="leading-relaxed">2. Deliveries must contain precise count of items listed above.</div>
                  <div className="leading-relaxed">3. Notify the store immediately if any items are out of stock or delayed.</div>
                  <div className="leading-relaxed">4. Damaged or sub-standard goods will be returned at the vendor's cost.</div>
                </div>

                <div className="md:col-span-2 bg-emerald-950 text-white rounded-xl p-4 shadow-sm space-y-2.5 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono text-slate-200">
                      {Number(viewingPO.total) === 0 ? 'Pending Delivery Bill' : `₹${Number(viewingPO.subtotal).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST Amount:</span>
                    <span className="font-mono text-slate-200">
                      {Number(viewingPO.total) === 0 ? 'On Delivery' : `₹${Number(viewingPO.gst_amount).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount Amount:</span>
                    <span className="font-mono text-rose-300">-₹{Number(viewingPO.discount || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-emerald-800/80 pt-2 flex justify-between items-center font-extrabold text-sm text-emerald-300">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base font-black">
                      {Number(viewingPO.total) === 0 ? (
                        <span className="text-amber-300 text-xs">Pending Bill Verification</span>
                      ) : (
                        `₹${Number(viewingPO.total).toFixed(2)}`
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* signature layout */}
              <div className="flex justify-between items-end pt-4">
                <div className="w-3/4 grid grid-cols-3 gap-4 text-center text-[10px] font-bold text-slate-400 uppercase">
                  <div>
                    <div className="text-slate-900 font-bold text-xs mb-8">{viewingPO.prepared_by || 'Admin'}</div>
                    <div className="border-t border-slate-200 pt-1.5">Prepared By</div>
                  </div>
                  <div>
                    <div className="h-10 mb-2"></div>
                    <div className="border-t border-slate-200 pt-1.5">Authorized Signatory</div>
                  </div>
                  <div>
                    <div className="h-10 mb-2"></div>
                    <div className="border-t border-slate-200 pt-1.5">Vendor Signature</div>
                  </div>
                </div>
                <div className="w-1/4 flex flex-col items-center">
                  <div className="border-2 border-dashed border-slate-200 rounded-full w-16 h-16 flex items-center justify-center text-[9px] font-black text-slate-350 uppercase text-center leading-3 select-none">Company<br/>Seal</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase mt-2">Official Seal</div>
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
                <span className="text-xs">💡</span>
                <span className="text-[11px] font-semibold text-indigo-900">
                  Purchase Order is an order request. Click <strong>Convert to Invoice</strong> to post bill &amp; update supplier balance.
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && ['Draft', 'Pending', 'Sent', 'Confirmed', 'Partially Pending', 'Partially Received'].includes(viewingPO.status) && (
                  <button
                    onClick={() => {
                      const poToConvert = viewingPO;
                      setViewingPO(null);
                      handleOpenInvoice(poToConvert);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <CurrencyRupeeIcon className="w-4 h-4 text-white stroke-[2.5]" /> Convert to Invoice (PI)
                  </button>
                )}
                <button
                  onClick={() => handlePrintPO(viewingPO)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4 text-white stroke-[2.5]" /> Print Order
                </button>
                <button
                  onClick={() => setViewingPO(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* LOADER OVERLAY FOR FETCHING DETAILS */}
      {loadingDetails && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center z-[99999] animate-fade-in animate-duration-200">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-100">
            <svg className="animate-spin h-5 w-5 text-indigo-650" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs font-bold text-slate-700">Loading purchase order details...</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseOrderList;
