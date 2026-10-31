import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ExclamationCircleIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  BanknotesIcon,
  EyeIcon,
  ArrowLeftIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import StatsCard from '../../components/common/StatsCard';
import CustomSelect from '../../components/common/CustomSelect';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import { useAppSelector } from '../../store/hooks';
import { vendorsAPI, vendorReturnsAPI } from '../../services/api';

const VendorReturnManagement = ({ onStockChanged, initialVendor = null, initialTab = 'process', showBackBtn = false, onBack }) => {
  const { user } = useAppSelector((state) => state.auth);
  const isReadOnly = user?.role === 'Super Admin';
  const [activeTab, setActiveTab] = useState(initialTab || 'process'); // 'process', 'notes', 'profiles'
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Core Data State
  const [vendors, setVendors] = useState([]);
  const [returns, setReturns] = useState([]);
  
  // Staged Multi-Product Return Items (Return Cart)
  const [returnItems, setReturnItems] = useState([]);

  // Searchable selections
  const [searchSupplier, setSearchSupplier] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const [vendorProducts, setVendorProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Tree Dropdown state
  const productDropdownRef = useRef(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [productSearch, setProductSearch] = useState('');

  const [purchasesForProduct, setPurchasesForProduct] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [currentStock, setCurrentStock] = useState(0);

  // Line item builder inputs
  const [returnQty, setReturnQty] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged');
  const [returnType, setReturnType] = useState('Refund'); // Refund, Replacement
  const [remarks, setRemarks] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [formVendorAnalytics, setFormVendorAnalytics] = useState(null);

  const storeSettings = useMemo(() => ({
    storeName: user?.store_name || user?.name || 'Kirana Store ERP',
    storeAddress: user?.address || 'Main Market Road',
    storePhone: user?.phone || user?.contact || 'N/A',
    storeEmail: user?.email || 'N/A',
    gstin: user?.gstin || 'N/A',
    shopRegNo: user?.tenant_id ? `TN-${user.tenant_id}` : 'N/A'
  }), [user]);

  // Filtering states for Notes & Stats Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Selected ledger details for Supplier Ledgers Tab
  const [selectedLedgerVendor, setSelectedLedgerVendor] = useState(null);
  const [ledgerAnalytics, setLedgerAnalytics] = useState(null);
  const [ledgerHistory, setLedgerHistory] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Modal triggers
  const [viewingNote, setViewingNote] = useState(null);
  const [updatingStatusNote, setUpdatingStatusNote] = useState(null);
  const [statusUpdateVal, setStatusUpdateVal] = useState('Pending');
  const [statusUpdateNotes, setStatusUpdateNotes] = useState('');

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Sent to Vendor':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Vendor Accepted':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Replacement Received':
        return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'Refund Received':
        return 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'Closed':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      case 'Pending':
      default:
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  const notifyRealtimeUpdates = () => {
    window.dispatchEvent(new CustomEvent('stock-changed'));
    window.dispatchEvent(new CustomEvent('vendor-updated'));
    window.dispatchEvent(new CustomEvent('inventory-updated'));
    window.dispatchEvent(new CustomEvent('purchase-updated'));
    if (typeof onStockChanged === 'function') onStockChanged();
  };

  useEffect(() => {
    if (initialVendor) {
      setSelectedVendor(initialVendor);
      if (initialVendor.company_name || initialVendor.name) {
        setSearchSupplier(initialVendor.company_name || initialVendor.name);
      }
    }
  }, [initialVendor]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const vendRes = await vendorsAPI.getAll();
      if (vendRes.success) setVendors(vendRes.vendors);
      await fetchReturnNotes();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnNotes = async () => {
    try {
      const res = await vendorReturnsAPI.getAll();
      if (res.success) {
        setReturns(res.returns || []);
      }
    } catch (err) {
      console.error('Failed to fetch returns history:', err);
    }
  };

  const silentRefreshData = async () => {
    try {
      const vendRes = await vendorsAPI.getAll();
      if (vendRes.success) setVendors(vendRes.vendors);
      await fetchReturnNotes();
    } catch (err) {
      console.error('Failed to refresh returns data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    const handleEventUpdate = () => {
      silentRefreshData();
    };
    window.addEventListener('focus', handleEventUpdate);
    window.addEventListener('vendor-updated', handleEventUpdate);
    window.addEventListener('purchase-updated', handleEventUpdate);
    window.addEventListener('stock-changed', handleEventUpdate);
    window.addEventListener('inventory-updated', handleEventUpdate);
    return () => {
      window.removeEventListener('focus', handleEventUpdate);
      window.removeEventListener('vendor-updated', handleEventUpdate);
      window.removeEventListener('purchase-updated', handleEventUpdate);
      window.removeEventListener('stock-changed', handleEventUpdate);
      window.removeEventListener('inventory-updated', handleEventUpdate);
    };
  }, []);

  // Close product dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch products purchased from selected vendor
  useEffect(() => {
    const fetchVendorProductsList = async () => {
      if (!selectedVendor) {
        setVendorProducts([]);
        setSelectedProduct(null);
        setProductSearch('');
        return;
      }
      try {
        const res = await vendorReturnsAPI.getProductsPurchased(selectedVendor.id);
        if (res.success) {
          setVendorProducts(res.products || []);
        }
      } catch (err) {
        console.error('Failed to load vendor products:', err);
      }
    };
    fetchVendorProductsList();
  }, [selectedVendor]);

  // Group vendor products into Tree structure (Product Name (Brand) -> Variants)
  const groupedVendorProducts = useMemo(() => {
    const groups = {};
    (vendorProducts || []).forEach((p) => {
      const brandStr = (p.brand || '').trim();
      const nameStr = (p.name || '').trim();
      const grpKey = `${nameStr.toLowerCase()}__${brandStr.toLowerCase()}`;
      const displayName = brandStr ? `${nameStr} (${brandStr})` : nameStr;

      if (!groups[grpKey]) {
        groups[grpKey] = {
          key: grpKey,
          name: nameStr,
          brand: brandStr,
          displayName,
          variants: []
        };
      }
      groups[grpKey].variants.push(p);
    });

    // Sort variants inside each group cleanly by weight/measurement
    Object.values(groups).forEach((grp) => {
      grp.variants.sort((a, b) => {
        const numA = parseFloat(a.measurement_value) || 0;
        const numB = parseFloat(b.measurement_value) || 0;
        if (numA !== numB) return numA - numB;
        return (a.measurement_value || '').localeCompare(b.measurement_value || '');
      });
    });

    return Object.values(groups);
  }, [vendorProducts]);

  // Search filtered product groups
  const searchedGroupedProducts = useMemo(() => {
    if (!productSearch.trim()) return groupedVendorProducts;
    const q = productSearch.toLowerCase().trim();
    return groupedVendorProducts.filter((grp) => {
      const matchGroup = grp.displayName.toLowerCase().includes(q);
      const matchVariant = grp.variants.some(
        (v) =>
          (v.measurement_value && v.measurement_value.toLowerCase().includes(q)) ||
          (v.barcode && v.barcode.toLowerCase().includes(q)) ||
          (v.sku && v.sku.toLowerCase().includes(q)) ||
          v.name.toLowerCase().includes(q)
      );
      return matchGroup || matchVariant;
    });
  }, [groupedVendorProducts, productSearch]);

  const toggleGroupCollapse = (key, e) => {
    if (e) e.stopPropagation();
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleAllGroups = () => {
    const allCollapsed = groupedVendorProducts.every((g) => collapsedGroups[g.key]);
    if (allCollapsed) {
      setCollapsedGroups({});
    } else {
      const all = {};
      groupedVendorProducts.forEach((g) => { all[g.key] = true; });
      setCollapsedGroups(all);
    }
  };

  // Product selection & unselection
  const handleSelectProduct = (prod) => {
    if (!prod || (selectedProduct && String(selectedProduct.id) === String(prod.id))) {
      setSelectedProduct(null);
      setPurchasesForProduct([]);
      setSelectedPurchase(null);
      setCurrentStock(0);
      setReturnQty('');
      return;
    }
    setSelectedProduct(prod);
    setIsProductDropdownOpen(false);
    setReturnQty('');
  };

  // Supplier selection safety (confirm clearing staged cart if switching supplier)
  const handleSelectSupplier = (v) => {
    if (selectedVendor && v && selectedVendor.id !== v.id && returnItems.length > 0) {
      if (!window.confirm('Selecting a different supplier will clear your currently staged return items. Continue?')) {
        setShowSupplierDropdown(false);
        return;
      }
    }
    setSelectedVendor(v);
    setReturnItems([]);
    setSelectedProduct(null);
    setSelectedPurchase(null);
    setPurchasesForProduct([]);
    setCurrentStock(0);
    setReturnQty('');
    setProductSearch('');
    setShowSupplierDropdown(false);
  };

  // Fetch selected vendor ledger analytics for form metadata preview
  useEffect(() => {
    const fetchFormVendorAnalytics = async () => {
      if (!selectedVendor) {
        setFormVendorAnalytics(null);
        return;
      }
      try {
        const res = await vendorReturnsAPI.getLedger(selectedVendor.id);
        if (res.success) {
          setFormVendorAnalytics(res.analytics);
        }
      } catch (err) {
        console.error('Failed to load selected vendor analytics:', err);
      }
    };
    fetchFormVendorAnalytics();
  }, [selectedVendor]);

  // Fetch purchase details once product is selected
  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      if (!selectedVendor || !selectedProduct) {
        setPurchasesForProduct([]);
        setSelectedPurchase(null);
        setCurrentStock(0);
        return;
      }
      try {
        const res = await vendorReturnsAPI.getPurchasesByProduct(selectedVendor.id, selectedProduct.id);
        if (res.success) {
          setPurchasesForProduct(res.purchases || []);
          setCurrentStock(res.currentStock || 0);
          if (res.purchases?.length > 0) {
            setSelectedPurchase(res.purchases[0]); // Select most recent purchase by default
          }
        }
      } catch (err) {
        console.error('Failed to load purchase records for product:', err);
      }
    };
    fetchPurchaseDetails();
  }, [selectedVendor, selectedProduct]);

  // Fetch Supplier Ledger analytics
  useEffect(() => {
    const fetchLedger = async () => {
      if (!selectedLedgerVendor) {
        setLedgerAnalytics(null);
        setLedgerHistory([]);
        return;
      }
      setLoadingLedger(true);
      try {
        const res = await vendorReturnsAPI.getLedger(selectedLedgerVendor.id);
        if (res.success) {
          setLedgerAnalytics(res.analytics);
          setLedgerHistory(res.history || []);
        }
      } catch (err) {
        console.error('Failed to load supplier ledger analytics:', err);
      } finally {
        setLoadingLedger(false);
      }
    };
    fetchLedger();
  }, [selectedLedgerVendor]);

  // Calculate live summary for current line builder item
  const liveSummary = useMemo(() => {
    if (!selectedProduct || !selectedPurchase || !returnQty) {
      return {
        purchaseRate: 0,
        gstRate: 0,
        returnValue: 0,
        gstAmount: 0,
        totalRefund: 0,
        remainingQty: 0
      };
    }
    const qty = Number(returnQty) || 0;
    const rate = Number(selectedPurchase.purchasePrice || 0);
    const gstPct = Number(selectedPurchase.gst || 0);
    const val = rate * qty;
    const gst = val * (gstPct / 100);

    return {
      purchaseRate: rate,
      gstRate: gstPct,
      returnValue: val,
      gstAmount: gst,
      totalRefund: val + gst,
      remainingQty: Math.max(0, Number(selectedPurchase.availableReturnQuantity || 0) - qty)
    };
  }, [selectedProduct, selectedPurchase, returnQty]);

  // Add Item to Staged Return List (Return Cart)
  const handleAddItem = (e) => {
    if (e) e.preventDefault();
    if (!selectedVendor) {
      alert('Please select a supplier first.');
      return;
    }
    if (!selectedProduct) {
      alert('Please select a purchased product from the dropdown.');
      return;
    }
    if (!selectedPurchase) {
      alert('No purchase invoice record found for this product.');
      return;
    }
    const qty = Number(returnQty);
    if (!qty || qty <= 0) {
      alert('Please enter a valid return quantity greater than 0.');
      return;
    }
    const availableLimit = Number(selectedPurchase.availableReturnQuantity || 0);
    if (qty > availableLimit) {
      alert(`Validation Error: Return quantity (${qty}) exceeds the available return limit (${availableLimit} Units) for invoice ${selectedPurchase.purchaseNo}.`);
      return;
    }
    if (qty > currentStock) {
      alert(`Validation Error: Return quantity (${qty}) exceeds physical stock in hand (${currentStock} Units).`);
      return;
    }

    const alreadyIdx = returnItems.findIndex(
      (item) => item.product_id === selectedProduct.id && item.purchase_id === selectedPurchase.purchaseId
    );
    if (alreadyIdx !== -1) {
      alert(`Product "${selectedProduct.name}" from invoice ${selectedPurchase.purchaseNo} is already in the return list. If you need to change quantity, please remove it from the table below and re-add.`);
      return;
    }

    const rate = Number(selectedPurchase.purchasePrice || 0);
    const gstPct = Number(selectedPurchase.gst || 0);
    const lineTotal = rate * qty;
    const lineGst = lineTotal * (gstPct / 100);
    const totalAmount = lineTotal + lineGst;

    const newItem = {
      tempId: `${selectedProduct.id}_${selectedPurchase.purchaseId || Date.now()}_${Math.random()}`,
      product_id: Number(selectedProduct.id),
      product_name: selectedProduct.name,
      brand: selectedProduct.brand || '',
      measurement_value: selectedProduct.measurement_value || selectedProduct.unit || '',
      sku: selectedProduct.sku || '',
      barcode: selectedProduct.barcode || '',
      purchase_id: selectedPurchase.purchaseId,
      purchase_no: selectedPurchase.purchaseNo,
      purchase_date: selectedPurchase.purchaseDate,
      batch_number: selectedPurchase.batchNo || selectedPurchase.batch_no || selectedPurchase.purchaseNo || '—',
      expiry_date: selectedPurchase.expiryDate || null,
      quantity: qty,
      return_price: rate,
      gst: gstPct,
      line_total: lineTotal,
      gst_amount: lineGst,
      total_amount: totalAmount,
      reason: returnReason,
      return_type: returnType,
      available_limit: availableLimit,
      current_stock: currentStock
    };

    setReturnItems((prev) => [...prev, newItem]);
    // Reset product selection for next item
    setSelectedProduct(null);
    setSelectedPurchase(null);
    setPurchasesForProduct([]);
    setReturnQty('');
    setCurrentStock(0);
    setProductSearch('');
  };

  const handleRemoveItem = (tempId) => {
    setReturnItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  // Aggregate Staged Summary across all items in Return Note
  const stagedSummary = useMemo(() => {
    const totalUnits = returnItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    const subtotal = returnItems.reduce((acc, item) => acc + Number(item.line_total || 0), 0);
    const totalGst = returnItems.reduce((acc, item) => acc + Number(item.gst_amount || 0), 0);
    const grandTotal = returnItems.reduce((acc, item) => acc + Number(item.total_amount || 0), 0);
    return {
      itemCount: returnItems.length,
      totalUnits,
      subtotal,
      totalGst,
      grandTotal
    };
  }, [returnItems]);

  // Submit Multi-Product Vendor Return Note
  const handleSubmitReturn = async (e) => {
    if (e) e.preventDefault();
    if (!selectedVendor) {
      alert('Please select a supplier first.');
      return;
    }

    let itemsToSubmit = [...returnItems];

    // If user filled the line builder but forgot to click "+ Add Item", auto-stage if valid:
    if (itemsToSubmit.length === 0 && selectedProduct && returnQty) {
      const qty = Number(returnQty);
      const availableLimit = Number(selectedPurchase?.availableReturnQuantity || 0);
      if (qty > 0 && qty <= availableLimit && qty <= currentStock) {
        const rate = Number(selectedPurchase?.purchasePrice || 0);
        const gstPct = Number(selectedPurchase?.gst || 0);
        const lineTotal = rate * qty;
        const lineGst = lineTotal * (gstPct / 100);
        itemsToSubmit.push({
          product_id: Number(selectedProduct.id),
          quantity: qty,
          return_price: rate,
          purchase_id: selectedPurchase?.purchaseId || null,
          purchase_no: selectedPurchase?.purchaseNo || null,
          batch_number: selectedPurchase?.batchNo || selectedPurchase?.purchaseNo || '—',
          expiry_date: selectedPurchase?.expiryDate || null,
          reason: returnReason,
          return_type: returnType,
          line_total: lineTotal,
          gst_amount: lineGst,
          total_amount: lineTotal + lineGst
        });
      }
    }

    if (itemsToSubmit.length === 0) {
      alert('Please add at least one product using "＋ Add Item to Return Note" before recording the return.');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        vendor_id: Number(selectedVendor.id),
        items: itemsToSubmit.map((i) => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
          return_price: Number(i.return_price),
          purchase_id: i.purchase_id || null,
          purchase_no: i.purchase_no || null,
          batch_number: i.batch_number || null,
          expiry_date: i.expiry_date || null,
          reason: i.reason || returnReason,
          return_type: i.return_type || returnType
        })),
        reason: itemsToSubmit[0]?.reason || returnReason,
        return_type: itemsToSubmit[0]?.return_type || returnType,
        remarks,
        image_url: imageUrl
      };

      console.log('[VendorReturn] Submitting multi-product payload:', payload);

      const res = await vendorReturnsAPI.create(payload);
      if (res.success) {
        alert(`✅ Multi-Product Vendor Return Note recorded successfully!\n\nVRN No: ${res.vrn}\nTotal Products: ${itemsToSubmit.length}\nTotal Units: ${itemsToSubmit.reduce((acc, i) => acc + Number(i.quantity), 0)}\nTotal Refund: ₹${Number(res.totalAmount || 0).toFixed(2)}`);
        // Reset state
        setReturnItems([]);
        setSelectedProduct(null);
        setSelectedPurchase(null);
        setPurchasesForProduct([]);
        setReturnQty('');
        setRemarks('');
        setImageUrl('');
        setProductSearch('');
        // Reload history
        await fetchReturnNotes();
        const vendRes = await vendorsAPI.getAll();
        if (vendRes.success) setVendors(vendRes.vendors);
        notifyRealtimeUpdates();
      } else {
        const serverMsg = res.message || 'Vendor return processing failed. Please try again.';
        console.error('[VendorReturn] Server returned failure:', res);
        alert(`❌ Return Failed:\n${serverMsg}`);
      }
    } catch (err) {
      const serverError =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'An unexpected error occurred while processing the supplier return.';
      console.error('[VendorReturn] Error details:', err);
      alert(`❌ Error processing supplier return note:\n\n${serverError}`);
    } finally {
      setProcessing(false);
    }
  };

  // Update Status Workflow
  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!updatingStatusNote) return;
    try {
      const res = await vendorReturnsAPI.updateStatus(updatingStatusNote.id, statusUpdateVal, statusUpdateNotes);
      if (res.success) {
        alert('✅ Workflow status updated successfully.');
        setUpdatingStatusNote(null);
        setStatusUpdateNotes('');
        await fetchReturnNotes();
        notifyRealtimeUpdates();
      } else {
        alert(`❌ Status update failed:\n${res.message || 'Unknown error'}`);
      }
    } catch (err) {
      const serverError = err?.response?.data?.message || err?.message || 'Failed to update status workflow';
      console.error('[VendorReturn] Status update error:', err?.response?.data || err);
      alert(`❌ Status update failed:\n${serverError}`);
    }
  };

  // Void Return Note
  const handleDeleteReturn = async (id) => {
    if (window.confirm('Are you sure you want to void this Return Note? This will restore stock levels and add the balance back to supplier outstandings.')) {
      try {
        const res = await vendorReturnsAPI.delete(id);
        if (res.success) {
          alert(`✅ ${res.message || 'Return note voided successfully.'}`);
          await fetchReturnNotes();
          notifyRealtimeUpdates();
        } else {
          alert(`❌ Void failed:\n${res.message || 'Unknown error'}`);
        }
      } catch (err) {
        const serverError = err?.response?.data?.message || err?.message || 'Voiding return note failed';
        console.error('[VendorReturn] Delete error:', err?.response?.data || err);
        alert(`❌ Void failed:\n${serverError}`);
      }
    }
  };

  // Print Return Note Layout
  const handlePrintReturnNote = (note) => {
    const win = window.open('', '_blank');
    const printItems = note.items && note.items.length > 0
      ? note.items
      : ((returns || []).filter((r) => r.return_no === note.return_no) || [note]);

    const itemsValue = printItems.reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.return_price || 0)), 0);
    const gstPct = note.gst || 18;
    const gstAmount = printItems.reduce((acc, it) => acc + ((Number(it.quantity || 0) * Number(it.return_price || 0)) * ((it.gst || gstPct) / 100)), 0);
    const grandTotal = Number(note.total_amount || (itemsValue + gstAmount));

    win.document.write(`
      <html>
      <head>
        <title>Vendor Return Note - ${note.return_no}</title>
        <style>
          @page { size: A4 portrait; margin: 0.4in; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; background: #fff; font-size: 11px; }
          .container { width: 100%; max-width: 800px; margin: 0 auto; padding: 10px; }
          .header-grid { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 20px; }
          .store-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
          .store-meta { font-size: 10px; color: #64748b; margin-top: 3px; }
          .doc-type { text-align: right; }
          .doc-title { font-size: 22px; font-weight: 900; color: #065f46; margin: 0; letter-spacing: 0.5px; }
          
          .banner { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .banner-col { display: flex; flex-direction: column; }
          .banner-lbl { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .banner-val { font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          
          .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .details-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fff; }
          .details-title { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #065f46; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; letter-spacing: 0.5px; }
          .details-row { margin: 4px 0; font-weight: 600; color: #475569; }
          .details-row span { color: #0f172a; font-weight: 700; }
          
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
          .items-table th { background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 8px; padding: 8px 6px; }
          .items-table td { border: 1px solid #cbd5e1; padding: 8px 6px; }
          
          .summary-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 20px; margin-bottom: 20px; align-items: start; }
          .notes-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fff; color: #64748b; font-size: 9.5px; }
          .notes-title { font-weight: 800; color: #065f46; margin-bottom: 6px; text-transform: uppercase; font-size: 8px; }
          .totals-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #065f46; color: #fff; }
          .total-row { display: flex; justify-content: space-between; margin: 4px 0; font-weight: 600; }
          .total-row.grand { border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px; margin-top: 6px; font-weight: 950; font-size: 13px; color: #a7f3d0; }
          
          .sig-seal-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
          .signatures-grid { width: 70%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
          .sig-line { border-top: 1px solid #cbd5e1; padding-top: 4px; font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .sig-value { font-weight: 700; color: #0f172a; margin-bottom: 30px; font-size: 11px; }
          .seal-box { width: 25%; display: flex; flex-direction: column; align-items: center; }
          .seal-ring { border: 2px dashed #cbd5e1; width: 65px; height: 65px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 8px; font-weight: 900; color: #cbd5e1; text-transform: uppercase; text-align: center; line-height: 10px; }
          .seal-title { font-size: 8px; font-weight: 850; color: #64748b; text-transform: uppercase; margin-top: 6px; }
          
          .footer { text-align: center; margin-top: 40px; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-grid">
            <div>
              <h1 class="store-title">${storeSettings.storeName}</h1>
              <div class="store-meta">${storeSettings.storeAddress}</div>
              <div class="store-meta">📞 Ph: ${storeSettings.storePhone} | ✉ Email: ${storeSettings.storeEmail}</div>
            </div>
            <div class="doc-type">
              <h2 class="doc-title">VENDOR RETURN NOTE</h2>
              <div class="store-meta">GSTIN: <strong>${storeSettings.gstin}</strong> | Reg No: <strong>${storeSettings.shopRegNo}</strong></div>
            </div>
          </div>
          
          <div class="banner">
            <div class="banner-col">
              <span class="banner-lbl">Return Number (VRN)</span>
              <span class="banner-val" style="font-family: monospace;">${note.return_no}</span>
            </div>
            <div class="banner-col">
              <span class="banner-lbl">Return Date</span>
              <span class="banner-val">${new Date(note.created_at).toLocaleDateString('en-IN')}</span>
            </div>
            <div class="banner-col">
              <span class="banner-lbl">Total Items Returned</span>
              <span class="banner-val">${printItems.length} Products (${printItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0)} Units)</span>
            </div>
            <div class="banner-col">
              <span class="banner-lbl">Workflow Status</span>
              <span class="banner-val" style="color: #d97706;">${note.status || 'Pending'}</span>
            </div>
          </div>
          
          <div class="details-section">
            <div class="details-box">
              <div class="details-title">Vendor / Supplier Details</div>
              <div class="details-row">Company Name: <span>${note.vendor_company_name || note.vendor_name || 'Vendor Company'}</span></div>
              <div class="details-row">Contact Person: <span>${note.vendor_name || '—'}</span></div>
              <div class="details-row">Mobile Number: <span>${note.vendor_phone || '—'}</span></div>
              <div class="details-row">GSTIN: <span>${note.vendor_gstin || '—'}</span></div>
              <div class="details-row">Address: <span>${note.vendor_address || '—'}</span></div>
            </div>
            <div class="details-box">
              <div class="details-title">Return Parameters</div>
              <div class="details-row">Settlement Type: <span>${note.return_type || 'Refund'}</span></div>
              <div class="details-row">Primary Reason: <span style="color: #b45309;">${note.reason}</span></div>
              <div class="details-row">Purchase Invoice: <span>${note.purchase_no || 'Multi-Invoice'}</span></div>
              <div class="details-row">Batch Number: <span>${note.batch_number || note.batch_no || '—'}</span></div>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">Sr. No.</th>
                <th style="width: 45%; text-align: left;">Product Description</th>
                <th style="width: 15%; text-align: left;">Invoice / Batch</th>
                <th style="width: 10%; text-align: center;">Returned Qty</th>
                <th style="width: 12%; text-align: right;">Unit Rate</th>
                <th style="width: 13%; text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${printItems.map((item, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td>
                    <div style="font-weight: bold; color: #0f172a;">${item.product_name}</div>
                    ${item.barcode ? `<div style="font-size: 8px; color: #64748b; font-family: monospace;">Barcode: ${item.barcode}</div>` : ''}
                    <div style="font-size: 8px; color: #b45309;">Reason: ${item.reason} (${item.return_type || 'Refund'})</div>
                  </td>
                  <td>
                    <div style="font-family: monospace; font-weight: 600;">${item.purchase_no || '—'}</div>
                    <div style="font-size: 8px; color: #64748b; font-family: monospace;">Batch: ${item.batch_number || item.batch_no || '—'}</div>
                  </td>
                  <td style="text-align: center; font-weight: 700;">${item.quantity} Pcs</td>
                  <td style="text-align: right;">₹${Number(item.return_price).toFixed(2)}</td>
                  <td style="text-align: right; font-weight: 900; color: #0f172a;">₹${Number(item.total_amount).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-grid">
            <div class="notes-box">
              <div class="notes-title">Terms & Internal Notes</div>
              <div style="margin-bottom: 4px;">1. Remarks: ${note.remarks || 'No remarks provided.'}</div>
              <div style="margin-bottom: 4px;">2. This return note decreases store inventory count and updates supplier ledger balances dynamically.</div>
              <div>3. Damaged goods must be retained for audits until vendor acknowledgement.</div>
            </div>
            <div class="totals-box">
              <div class="total-row"><span>Returned Value:</span><span>₹${itemsValue.toFixed(2)}</span></div>
              <div class="total-row"><span>Estimated GST (${gstPct}%):</span><span>+₹${gstAmount.toFixed(2)}</span></div>
              <div class="total-row grand"><span>Total Refund Value:</span><span>₹${grandTotal.toFixed(2)}</span></div>
            </div>
          </div>
          
          <div class="sig-seal-section">
            <div class="signatures-grid">
              <div>
                <div class="sig-value">${note.user_name || 'System'}</div>
                <div class="sig-line">Prepared By</div>
              </div>
              <div>
                <div class="sig-value" style="height: 18px;"></div>
                <div class="sig-line">Authorized Signatory</div>
              </div>
              <div>
                <div class="sig-value" style="height: 18px;"></div>
                <div class="sig-line">Vendor Signature</div>
              </div>
            </div>
            <div class="seal-box">
              <div class="seal-ring">Company Seal</div>
              <div class="seal-title">Official Seal</div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an official system-generated Vendor Return Note (VRN).</p>
            <p>Printed on: ${new Date().toLocaleString('en-IN')}</p>
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

  // Export to Excel (CSV)
  const handleExportExcel = () => {
    if (processedReturnsHistory.length === 0) {
      alert('No returns available to export.');
      return;
    }
    const headers = ['Return Number', 'Date', 'Supplier', 'Invoice Ref', 'Product', 'Batch Number', 'Qty', 'Unit Cost', 'Refund Amt', 'Reason', 'Type', 'Status'];
    const rows = processedReturnsHistory.map(r => [
      r.return_no,
      new Date(r.created_at).toLocaleDateString('en-IN'),
      r.vendor_company_name || r.vendor_name,
      r.purchase_no || 'N/A',
      r.product_name,
      r.batch_number || r.batch_no || r.purchase_no || '—',
      r.quantity,
      Number(r.return_price).toFixed(2),
      Number(r.total_amount).toFixed(2),
      r.reason,
      r.return_type || 'Refund',
      r.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Vendor_Returns_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (processedReturnsHistory.length === 0) {
      alert('No returns available to export.');
      return;
    }
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head>
        <title>Vendor Returns Report</title>
        <style>
          @page { size: A4 landscape; margin: 0.4in; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; font-size: 10px; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin: 0; }
          .subtitle { font-size: 10px; color: #64748b; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 800; text-transform: uppercase; font-size: 8px; padding: 6px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 6px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .total-row { font-weight: bold; background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Vendor Stock Returns Report</h1>
          <div class="subtitle">Generated on: ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Return No.</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Invoice No.</th>
              <th>Product</th>
              <th>Batch No.</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Unit Rate</th>
              <th class="text-right">Refund Total</th>
              <th>Reason</th>
              <th>Type</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${processedReturnsHistory.map(r => `
              <tr>
                <td>${r.return_no}</td>
                <td>${new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                <td>${r.vendor_company_name || r.vendor_name}</td>
                <td>${r.purchase_no || '—'}</td>
                <td>${r.product_name}</td>
                <td>${r.batch_number || r.batch_no || r.purchase_no || '—'}</td>
                <td class="text-center">${r.quantity}</td>
                <td class="text-right">₹${Number(r.return_price).toFixed(2)}</td>
                <td class="text-right">₹${Number(r.total_amount).toFixed(2)}</td>
                <td>${r.reason}</td>
                <td>${r.return_type || 'Refund'}</td>
                <td class="text-center">${r.status}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="6" class="text-right">Total:</td>
              <td class="text-center">${processedReturnsHistory.reduce((sum, r) => sum + Number(r.quantity), 0)}</td>
              <td></td>
              <td class="text-right">₹${processedReturnsHistory.reduce((sum, r) => sum + Number(r.total_amount), 0).toFixed(2)}</td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>
        <script>
          window.print();
          setTimeout(() => window.close(), 500);
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Search filter for Supplier Select box in form
  const filteredSuppliersForForm = useMemo(() => {
    if (!searchSupplier.trim()) return vendors;
    return vendors.filter(v =>
      v.company_name?.toLowerCase().includes(searchSupplier.toLowerCase()) ||
      v.name?.toLowerCase().includes(searchSupplier.toLowerCase())
    );
  }, [vendors, searchSupplier]);



  // Unified Dashboard Metrics (Task-2 summary cards)
  const dashboardStats = useMemo(() => {
    const validReturns = returns.filter(r => r.status !== 'Rejected' && r.status !== 'Void');
    const totalReturns = validReturns.length;
    const refundedValue = validReturns
      .filter(r => !r.return_type || r.return_type === 'Refund' || r.return_type === 'Refund / Store Credit' || r.status !== 'Rejected')
      .reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const totalReturnedUnits = validReturns.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const returnValSum = validReturns.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    return {
      totalReturns,
      refundedValue: refundedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      totalReturnedUnits,
      returnValSum: returnValSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    };
  }, [returns]);

  // Tab 2 History Filtering
  const processedReturnsHistory = useMemo(() => {
    return returns.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' ||
        r.return_no?.toLowerCase().includes(q) ||
        r.product_name?.toLowerCase().includes(q) ||
        r.vendor_company_name?.toLowerCase().includes(q) ||
        r.vendor_name?.toLowerCase().includes(q) ||
        (r.items && r.items.some(it => it.product_name?.toLowerCase().includes(q)));
      
      const matchSupplier = filterSupplier === 'All' || String(r.vendor_id) === filterSupplier;
      const matchStatus = filterStatus === 'All' || r.status === filterStatus;
      
      let matchDate = true;
      if (filterDateFrom) matchDate = matchDate && new Date(r.created_at) >= new Date(filterDateFrom);
      if (filterDateTo) matchDate = matchDate && new Date(r.created_at) <= new Date(filterDateTo + 'T23:59:59');

      return matchSearch && matchSupplier && matchStatus && matchDate;
    });
  }, [returns, searchQuery, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader size="lg" />
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading Supplier Returns Portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 select-none font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            {showBackBtn && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-300/60 dark:border-slate-700"
              >
                <ArrowLeftIcon className="w-4 h-4 stroke-[2.5]" />
                Back to Supplier Master
              </button>
            )}
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              ↩️ Vendor & Stock Return Management
            </h1>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Return defective products, track vendor credits, replacements, and status workflows</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('process')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'process' 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Process Return
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'notes' 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Return Notes & Stats
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'profiles' 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Supplier Ledgers
          </button>
        </div>
      </div>

      {/* TOP DASHBOARD METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total Returns" value={dashboardStats.totalReturns} icon={ArrowUturnLeftIcon} color="blue" />
        <StatsCard title="Refunded Amt" value={`₹${dashboardStats.refundedValue}`} icon={CheckCircleIcon} color="green" />
        <StatsCard title="Returned Units" value={dashboardStats.totalReturnedUnits} icon={DocumentTextIcon} color="purple" />
        <StatsCard title="Total Return Value" value={`₹${dashboardStats.returnValSum}`} icon={BanknotesIcon} color="orange" />
      </div>

      {/* RENDER ACTIVE TAB */}
      
      {activeTab === 'process' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN FORM & STAGING CONTAINER (LEFT) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>↩️</span> Multi-Product Vendor Return Note
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Select supplier, add multiple purchased products to the return list, and record in a single return note.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <span>{returnItems.length}</span> Products Staged
                </span>
              </div>
            </div>

            {/* SUPPLIER SELECTOR */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                1. Select Supplier <span className="text-rose-500">*</span>
              </label>
              <div
                className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold cursor-pointer text-slate-900 dark:text-white hover:border-indigo-400 transition-colors"
                onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
              >
                <span>{selectedVendor ? `${selectedVendor.company_name} (${selectedVendor.name})` : '-- Select Supplier to Begin --'}</span>
                <ChevronDownIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>

              {showSupplierDropdown && (
                <div className="absolute z-30 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl mt-1.5 p-2 space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                  <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-750 rounded-lg px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800">
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchSupplier}
                      onChange={(e) => setSearchSupplier(e.target.value)}
                      placeholder="Search supplier by name or company..."
                      className="w-full bg-transparent border-none text-xs focus:outline-none font-semibold text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    {searchSupplier && (
                      <button
                        type="button"
                        onClick={() => setSearchSupplier('')}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {filteredSuppliersForForm.map((v, idx) => (
                      <div
                        key={`v-form-${v.id}-${idx}`}
                        onClick={() => handleSelectSupplier(v)}
                        className={`text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-slate-800 p-2.5 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                          selectedVendor?.id === v.id ? 'bg-indigo-50/80 dark:bg-slate-800 text-indigo-900 dark:text-indigo-200 font-bold' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div>
                          <span className="font-bold">{v.company_name}</span>
                          <span className="text-[11px] text-slate-400 ml-1.5">({v.name})</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300">
                          Bal: ₹{Number(v.outstanding_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Vendor Information Preview */}
              {selectedVendor && (
                <div className="mt-2.5 bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-750 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">GSTIN</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedVendor.gstin || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Phone</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedVendor.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Outstanding</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">₹{Number(selectedVendor.outstanding_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Purchases</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">₹{Number(formVendorAnalytics?.totalPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* PRODUCT LINE BUILDER BOX */}
            <div className={`border rounded-2xl p-5 space-y-4 transition-all ${
              selectedVendor
                ? 'bg-slate-50/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                : 'opacity-60 pointer-events-none bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
                <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                  <span>🛒</span> 2. Select & Configure Return Item (Purchased From {selectedVendor ? selectedVendor.company_name : 'Supplier'})
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {vendorProducts.length} Returnable Products Available
                </span>
              </div>

              {/* Searchable Product Tree Dropdown */}
              <div className="relative" ref={productDropdownRef}>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Product Tree Selection <span className="text-rose-500">*</span>
                </label>

                {/* Tree Dropdown Trigger Button */}
                <div
                  onClick={() => selectedVendor && setIsProductDropdownOpen(!isProductDropdownOpen)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    selectedVendor
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xs hover:border-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedProduct ? (
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-300 truncate">
                        {selectedProduct.name} {selectedProduct.brand ? `(${selectedProduct.brand})` : ''} - {selectedProduct.measurement_value || selectedProduct.unit}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold">
                        -- Select Purchased Product (Tree View) --
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {selectedProduct && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(null);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Unselect Product"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </span>
                    )}
                    <ChevronDownIcon
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isProductDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Tree Dropdown Popover */}
                {isProductDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                    {/* Search & Collapse Controls */}
                    <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 space-y-2">
                      <div className="relative">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Search product name, brand or weight..."
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-lg pl-8 pr-8 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                        {productSearch && (
                          <button
                            type="button"
                            onClick={() => setProductSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                        <span>
                          {searchedGroupedProducts.length} Product Group{searchedGroupedProducts.length === 1 ? '' : 's'} Purchased
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleAllGroups}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                        >
                          {groupedVendorProducts.every((g) => collapsedGroups[g.key]) ? 'Expand All' : 'Collapse All'}
                        </button>
                      </div>
                    </div>

                    {/* Selected Product Banner with Unselect Action */}
                    {selectedProduct && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] uppercase font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded shrink-0">
                            Selected
                          </span>
                          <span className="font-extrabold text-indigo-950 dark:text-indigo-100 truncate">
                            {selectedProduct.name} {selectedProduct.brand ? `(${selectedProduct.brand})` : ''} - {selectedProduct.measurement_value || selectedProduct.unit}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectProduct(null)}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-600 hover:text-rose-800 dark:text-rose-300 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md cursor-pointer transition-colors shrink-0 ml-2"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                          Unselect
                        </button>
                      </div>
                    )}

                    {/* Scrollable Tree List with scrollbar */}
                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                      {searchedGroupedProducts.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium text-xs">
                          {vendorProducts.length === 0
                            ? 'No products have been purchased from this supplier yet.'
                            : 'No matching products found.'}
                        </div>
                      ) : (
                        searchedGroupedProducts.map((grp) => {
                          const isCollapsed = Boolean(collapsedGroups[grp.key]);
                          const hasSelectedVariant = grp.variants.some((v) => String(v.id) === String(selectedProduct?.id));

                          return (
                            <div
                              key={grp.key}
                              className={`border rounded-xl overflow-hidden transition-colors ${
                                hasSelectedVariant
                                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                                  : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs'
                              }`}
                            >
                              {/* Parent Product Group Header (Clickable open/close toggle) */}
                              <div
                                onClick={(e) => toggleGroupCollapse(grp.key, e)}
                                className={`flex items-center justify-between px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                                  isCollapsed
                                    ? 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200'
                                    : 'bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50/70 text-indigo-950 dark:text-indigo-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleGroupCollapse(grp.key, e)}
                                    className="p-1 rounded-md text-slate-500 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 transition-colors"
                                    title={isCollapsed ? 'Open (Expand)' : 'Close (Collapse)'}
                                  >
                                    {isCollapsed ? (
                                      <ChevronRightIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                    ) : (
                                      <ChevronDownIcon className="w-3.5 h-3.5 stroke-[2.5] text-indigo-600 dark:text-indigo-400" />
                                    )}
                                  </button>

                                  <span className="font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                                    {grp.displayName}
                                  </span>

                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                    {grp.variants.length} {grp.variants.length === 1 ? 'Weight' : 'Weights'}
                                  </span>

                                  {hasSelectedVariant && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                                      Selected
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                  <span>{isCollapsed ? 'Open' : 'Close'}</span>
                                </div>
                              </div>

                              {/* Child Variants */}
                              {!isCollapsed && (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                  {grp.variants.map((v) => {
                                    const isSelected = String(selectedProduct?.id) === String(v.id);
                                    const stockQty = Number(v.current_stock || 0);
                                    const purchasedQty = Number(v.total_purchased_from_vendor || 0);

                                    return (
                                      <div
                                        key={v.id}
                                        onClick={() => handleSelectProduct(v)}
                                        className={`flex items-center justify-between px-3 py-2 pl-7 text-xs font-semibold cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white font-bold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-400 font-mono text-xs select-none">↳</span>
                                          <span className="font-bold">
                                            {grp.name} {grp.brand ? `(${grp.brand})` : ''} - {v.measurement_value || v.unit || 'Standard'}
                                          </span>
                                          {v.sku && (
                                            <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                              ({v.sku})
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px]">
                                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                            stockQty > 0
                                              ? isSelected ? 'bg-indigo-700 text-white' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                              : isSelected ? 'bg-rose-700 text-white' : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                          }`}>
                                            Stock: {stockQty} Pcs
                                          </span>
                                          <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                            Bought: {purchasedQty}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Purchase Invoice Reference Details (When product selected) */}
              {selectedProduct && (
                <div className="space-y-3">
                  {purchasesForProduct.length > 1 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Select Purchase Invoice Reference ({purchasesForProduct.length} Available)
                      </label>
                      <CustomSelect
                        value={selectedPurchase?.purchaseId || ''}
                        onChange={(val) => {
                          const found = purchasesForProduct.find((p) => p.purchaseId === Number(val));
                          if (found) setSelectedPurchase(found);
                        }}
                        color="blue"
                        options={purchasesForProduct.map((p, idx) => ({
                          value: p.purchaseId,
                          label: `${p.purchaseNo} (${new Date(p.purchaseDate).toLocaleDateString('en-IN')}) • Qty: ${p.purchaseQuantity} • Avail Return: ${p.availableReturnQuantity} Pcs`
                        }))}
                      />
                    </div>
                  )}

                  {selectedPurchase ? (
                    <div className="bg-indigo-50/70 dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700 rounded-xl p-3 text-xs text-indigo-950 dark:text-indigo-200 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Invoice Number</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedPurchase.purchaseNo}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Batch Number</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedPurchase.batchNo || selectedPurchase.batch_no || selectedPurchase.purchaseNo || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Purchase Date</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{new Date(selectedPurchase.purchaseDate).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Purchase Rate</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(selectedPurchase.purchasePrice || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Purchased Qty</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{selectedPurchase.purchaseQuantity} Pcs</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Already Returned</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{selectedPurchase.returnedQuantity || 0} Pcs</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Avail Return Limit</span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">{selectedPurchase.availableReturnQuantity} Pcs</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block">Current Shop Stock</span>
                        <span className="font-black text-amber-700 dark:text-amber-300 font-mono">{currentStock} Pcs</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200">
                      No purchase records found for this product under the selected supplier.
                    </div>
                  )}
                </div>
              )}

              {/* Line Configuration Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Return Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedPurchase?.availableReturnQuantity || currentStock || 99999}
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Reason for Return
                  </label>
                  <CustomSelect
                    value={returnReason}
                    onChange={setReturnReason}
                    color="blue"
                    options={[
                      { value: 'Damaged', label: 'Damaged Batch' },
                      { value: 'Expired', label: 'Expired Stock' },
                      { value: 'Defective', label: 'Defective Product' },
                      { value: 'Overstock', label: 'Overstock Return' },
                      { value: 'Wrong Item', label: 'Wrong Items Delivered' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Settlement Type
                  </label>
                  <CustomSelect
                    value={returnType}
                    onChange={setReturnType}
                    color="blue"
                    options={[
                      { value: 'Refund', label: 'Refund / Store Credit' },
                      { value: 'Replacement', label: 'Replacement Pending' }
                    ]}
                  />
                </div>
              </div>

              {/* Line Add Action Button */}
              <div className="flex justify-between items-center pt-2">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedProduct && selectedPurchase && returnQty && Number(returnQty) > 0 ? (
                    <span>
                      Item Refund: <strong className="text-slate-900 dark:text-white font-mono">₹{liveSummary.totalRefund.toFixed(2)}</strong> (Rate: ₹{liveSummary.purchaseRate.toFixed(2)} × {returnQty})
                    </span>
                  ) : (
                    <span>Choose product & quantity to add into the return note</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProduct || !selectedPurchase || !returnQty || Number(returnQty) <= 0 || Number(returnQty) > Number(selectedPurchase?.availableReturnQuantity || 0)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 cursor-pointer"
                >
                  <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                  Add Item to Return Note
                </button>
              </div>
            </div>

            {/* STAGED PRODUCTS TABLE (RETURN CART) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                  <span>📋</span> 3. Staged Products in this Return Note ({returnItems.length})
                </h3>
                {returnItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all staged products from this return note?')) {
                        setReturnItems([]);
                      }
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer hover:underline"
                  >
                    Clear All Items
                  </button>
                )}
              </div>

              {returnItems.length === 0 ? (
                <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-950/20">
                  <DocumentTextIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No products added to return note yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Select any purchased product above, enter return quantity, and click <strong>&quot;Add Item to Return Note&quot;</strong>. You can return multiple products together in one note.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full min-w-[750px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3 whitespace-nowrap">#</th>
                        <th className="py-2.5 px-3 whitespace-nowrap min-w-[200px]">Product Name (Brand) - Weight</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Invoice & Batch</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Reason / Type</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Qty</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Line Refund</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {returnItems.map((item, idx) => (
                        <tr key={item.tempId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {item.product_name} {item.brand ? `(${item.brand})` : ''} - {item.measurement_value}
                            </div>
                            {item.sku && (
                              <div className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono text-slate-800 dark:text-slate-200">{item.purchase_no}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Batch: {item.batch_number}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-amber-700 dark:text-amber-400 block">{item.reason}</span>
                            <span className="text-[10px] text-slate-400">{item.return_type}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white whitespace-nowrap">
                            {item.quantity} Pcs
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            ₹{Number(item.return_price).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            ₹{Number(item.total_amount).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.tempId)}
                              className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Remove item from return note"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RETURN NOTE GLOBAL AUDIT REMARKS & IMAGE URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Upload Damaged Product Image (URL)
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste image URL (Optional)..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Return Note Remarks / Internal Audit Notes
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Explain return reason or agreement with vendor..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC RETURN SUMMARY CARD (RIGHT) */}
          <div className="space-y-4 h-fit">
            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-900/40 text-white rounded-2xl p-6 space-y-5 shadow-xl">
              <div>
                <h3 className="text-sm font-extrabold tracking-wider text-indigo-300 uppercase flex items-center justify-between">
                  <span>Grand Return Note Summary</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-800/80 font-mono">
                    PRN
                  </span>
                </h3>
                <p className="text-[10px] text-indigo-200/80 mt-0.5">Aggregates all products added into this return note</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-indigo-900/60 pb-2">
                  <span className="text-indigo-300">Supplier:</span>
                  <span className="font-bold text-right truncate max-w-[180px]">
                    {selectedVendor ? selectedVendor.company_name : 'None Selected'}
                  </span>
                </div>

                <div className="flex justify-between border-b border-indigo-900/60 pb-2">
                  <span className="text-indigo-300">Products in Return Note:</span>
                  <span className="font-mono font-black text-amber-300">
                    {stagedSummary.itemCount} Distinct Item{stagedSummary.itemCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="flex justify-between border-b border-indigo-900/60 pb-2">
                  <span className="text-indigo-300">Total Units to Return:</span>
                  <span className="font-mono font-black text-white">
                    {stagedSummary.totalUnits} Pcs
                  </span>
                </div>

                <div className="flex justify-between border-b border-indigo-900/60 pb-2">
                  <span className="text-indigo-300">Return Subtotal:</span>
                  <span className="font-mono font-bold">
                    ₹{stagedSummary.subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between border-b border-indigo-900/60 pb-2">
                  <span className="text-indigo-300">Estimated GST Credit:</span>
                  <span className="font-mono font-bold text-emerald-300">
                    ₹{stagedSummary.totalGst.toFixed(2)}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center text-sm font-black border-t border-indigo-800/80 text-emerald-300">
                  <span className="uppercase text-xs tracking-wider">Total Refund Amount:</span>
                  <span className="font-mono text-lg text-white font-black">
                    ₹{stagedSummary.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Final Submit Button */}
              <button
                type="button"
                onClick={handleSubmitReturn}
                disabled={processing || isReadOnly || !selectedVendor || (returnItems.length === 0 && (!selectedProduct || !returnQty))}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none cursor-pointer text-center"
              >
                {processing
                  ? 'Processing Return Note...'
                  : returnItems.length > 0
                  ? `Record Vendor Return Note (${returnItems.length} Products)`
                  : 'Add Items & Record Return'}
              </button>
            </div>

            {/* Current Active Item Card (if user is currently configuring an item) */}
            {selectedProduct && selectedPurchase && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-2 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                  Active Item Preview
                </span>
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {selectedProduct.name} - {selectedProduct.measurement_value || selectedProduct.unit}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Invoice: <span className="font-mono text-slate-800 dark:text-slate-200">{selectedPurchase.purchaseNo}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span>Return Qty: <strong className="font-mono">{returnQty || 0} Pcs</strong></span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    ₹{liveSummary.totalRefund.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          
          {/* Filters Area */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="relative flex items-center col-span-1 lg:col-span-2">
                <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by VRN or product..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
              
              <CustomSelect
                value={filterSupplier}
                onChange={setFilterSupplier}
                color="blue"
                className="min-w-[170px]"
                options={[
                  { value: 'All', label: 'All Suppliers' },
                  ...vendors.map((v) => ({
                    value: v.id,
                    label: v.company_name || v.name
                  }))
                ]}
              />

              <CustomSelect
                value={filterStatus}
                onChange={setFilterStatus}
                color="blue"
                className="min-w-[170px]"
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Sent to Vendor', label: 'Sent to Vendor' },
                  { value: 'Vendor Accepted', label: 'Vendor Accepted' },
                  { value: 'Replacement Received', label: 'Replacement Received' },
                  { value: 'Refund Received', label: 'Refund Received' },
                  { value: 'Closed', label: 'Closed' }
                ]}
              />

              <div className="flex items-center gap-1.5 min-w-[170px]">
                <span className="text-[9px] font-extrabold text-slate-450 dark:text-slate-400 uppercase">From</span>
                <CustomDatePicker
                  value={filterDateFrom}
                  onChange={setFilterDateFrom}
                  placeholder="dd-mm-yyyy"
                  color="blue"
                />
              </div>

              <div className="flex items-center gap-1.5 min-w-[170px]">
                <span className="text-[9px] font-extrabold text-slate-450 dark:text-slate-400 uppercase">To</span>
                <CustomDatePicker
                  value={filterDateTo}
                  onChange={setFilterDateTo}
                  placeholder="dd-mm-yyyy"
                  color="blue"
                />
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> Export Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-all border border-rose-200 dark:border-rose-800 cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4" /> Export PDF
                </button>
              </div>

              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterSupplier('All');
                  setFilterStatus('All');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="px-4 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <table className="w-full min-w-[1360px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider bg-slate-50/70 dark:bg-slate-800/60">
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[140px]">Return Number</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[110px]">Return Date</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[160px]">Supplier</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[170px]">Purchase Invoice Number</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[220px]">Product</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[120px]">Batch Number</th>
                  <th className="py-3.5 px-3.5 text-center whitespace-nowrap min-w-[130px]">Returned Quantity</th>
                  <th className="py-3.5 px-3.5 text-right whitespace-nowrap min-w-[130px]">Return Amount</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[130px]">Return Reason</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap min-w-[110px]">Return Type</th>
                  <th className="py-3.5 px-3.5 text-center whitespace-nowrap min-w-[150px]">Status</th>
                  <th className="py-3.5 px-3.5 text-center whitespace-nowrap min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-650 dark:text-slate-300">
                {processedReturnsHistory.map((item, idx) => (
                  <tr key={`ret-row-${item.id || item.return_no}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-950 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span>{item.return_no}</span>
                        {item.item_count > 1 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                            {item.item_count} Items
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">{item.vendor_company_name || item.vendor_name}</td>
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200" title={item.purchase_no || '—'}>
                      {(() => {
                        const invList = Array.isArray(item.purchase_invoices) && item.purchase_invoices.length > 0
                          ? item.purchase_invoices
                          : (item.purchase_no ? item.purchase_no.split(',').map((s) => s.trim()).filter(Boolean) : []);

                        if (invList.length === 0 || (invList.length === 1 && invList[0] === '—')) {
                          return <span className="text-slate-400">—</span>;
                        }

                        if (invList.length === 1) {
                          return <span className="whitespace-nowrap">{invList[0]}</span>;
                        }

                        return (
                          <div className="flex flex-col gap-0.5">
                            {invList.map((invNo, i) => (
                              <span key={i} className="whitespace-nowrap">
                                {invNo}{i < invList.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {item.items && item.items.length > 0 ? (
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                            <span>{item.items[0].product_name}</span>
                            {item.items[0].measurement_value && (
                              <span className="text-[10px] text-slate-400 font-normal">({item.items[0].measurement_value})</span>
                            )}
                            {item.items.length > 1 && (
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-slate-700 whitespace-nowrap">
                                +{item.items.length - 1} more
                              </span>
                            )}
                          </div>
                          {item.items.length > 1 ? (
                            <div className="text-[10px] text-slate-400 whitespace-nowrap truncate max-w-[260px]" title={item.items.map(it => `${it.product_name} (${it.quantity} Pcs)`).join(', ')}>
                              {item.items.map(it => `${it.product_name} (${it.quantity})`).join(', ')}
                            </div>
                          ) : (
                            item.items[0].sku ? <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">SKU: {item.items[0].sku}</span> : null
                          )}
                        </div>
                      ) : (
                        <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{item.product_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{item.batch_number || item.batch_no || item.purchase_no || '—'}</td>
                    <td className="py-3 px-3.5 text-center tabular-nums font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{item.quantity} Pcs</td>
                    <td className="py-3 px-3.5 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">₹{Number(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-3.5 font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{item.reason}</td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`whitespace-nowrap px-2 py-0.5 rounded text-[9px] font-bold border ${item.return_type === 'Replacement' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'}`}>
                        {item.return_type || 'Refund'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span className={`whitespace-nowrap inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-bold border ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        {/* View VRN */}
                        <button
                          onClick={() => setViewingNote(item)}
                          title="View Return Note Invoice"
                          className="p-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg transition-all cursor-pointer border border-indigo-150 dark:border-indigo-800"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                        </button>
                        {/* Print Return Note */}
                        <button
                          onClick={() => handlePrintReturnNote(item)}
                          title="Print Return Note Invoice"
                          className="p-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          <PrinterIcon className="w-3.5 h-3.5" />
                        </button>
                        {/* Download PDF (Triggers Print to PDF) */}
                        <button
                          onClick={() => handlePrintReturnNote(item)}
                          title="Download Invoice PDF"
                          className="p-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        </button>
                        {/* Update Workflow Status */}
                        <button
                          onClick={() => {
                            setUpdatingStatusNote(item);
                            setStatusUpdateVal(item.status);
                          }}
                          title="Change Workflow Status"
                          className="px-2 py-1 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-lg text-[9px] font-bold cursor-pointer whitespace-nowrap"
                        >
                          Status
                        </button>
                        {/* Delete/Void Return Note */}
                        {!isReadOnly && (
                          <button
                            onClick={() => handleDeleteReturn(item.return_no || item.id)}
                            title="Void Return Note Invoice"
                            className="p-1 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-lg transition-all cursor-pointer border border-rose-250 dark:border-rose-800"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'profiles' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Suppliers list sidebar (Left 1/4) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Active Suppliers</h3>
            <div className="space-y-1 max-h-[450px] overflow-y-auto">
              {vendors.map((v, idx) => (
                <div
                  key={`prof-v-${v.id}-${idx}`}
                  onClick={() => setSelectedLedgerVendor(v)}
                  className={`p-3 rounded-xl cursor-pointer text-xs font-bold transition-all ${selectedLedgerVendor?.id === v.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                  <div>{v.company_name || 'Individual Supplier'}</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${selectedLedgerVendor?.id === v.id ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-400'}`}>Contact: {v.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier Ledger Analytics View (Right 3/4) */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[400px]">
            {loadingLedger ? (
              <div className="flex h-full items-center justify-center py-16 text-xs text-slate-400 dark:text-slate-500">Loading ledger data...</div>
            ) : !ledgerAnalytics ? (
              <div className="flex h-full items-center justify-center py-16 text-xs text-slate-400 dark:text-slate-500">Select a Supplier to load the Return Settlement Ledger</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{ledgerAnalytics.companyName}</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">GSTIN: <span className="font-mono font-bold text-slate-750 dark:text-slate-200">{ledgerAnalytics.gstin || '—'}</span> | Phone: <span className="dark:text-slate-200">{ledgerAnalytics.phone}</span></p>
                </div>

                 {/* Ledger Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Purchases</span>
                    <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-white block mt-1">₹{Number(ledgerAnalytics?.totalPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Returns</span>
                    <span className="font-mono text-xs font-extrabold text-indigo-700 dark:text-indigo-400 block mt-1">{ledgerAnalytics?.totalReturns || 0} Notes</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Return Value</span>
                    <span className="font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400 block mt-1">₹{Number(ledgerAnalytics?.totalReturnPriceValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Refund Received</span>
                    <span className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">₹{Number(ledgerAnalytics?.totalRefundReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Replacement Pending</span>
                    <span className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400 block mt-1">{ledgerAnalytics?.replacementPendingCount || 0} Notes</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Replacement Value</span>
                    <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-white block mt-1">₹{Number(ledgerAnalytics?.replacementPendingValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
                    <span className="font-mono text-xs font-extrabold text-red-600 dark:text-red-400 block mt-1">₹{Number(ledgerAnalytics?.outstandingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-150 dark:border-slate-700/60 shadow-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Last Return Date</span>
                    <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-white block mt-1">
                      {ledgerAnalytics?.lastReturnDate 
                        ? new Date(ledgerAnalytics.lastReturnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Return Note History List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Returns Settlement History</h3>
                  <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                    <table className="w-full min-w-[650px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50">
                          <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Note Number</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Product</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Returned Qty</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Refund Amount</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {ledgerHistory.map((h, idx) => (
                          <tr key={`lh-row-${h.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-2.5 px-3 text-slate-405 dark:text-slate-400 whitespace-nowrap">{new Date(h.created_at).toLocaleDateString('en-IN')}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-850 dark:text-white font-bold whitespace-nowrap">{h.return_no}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{h.product_name || h.productName || '—'}</td>
                            <td className="py-2.5 px-3 text-center text-slate-800 dark:text-slate-200 whitespace-nowrap">{h.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-rose-500 dark:text-rose-400 whitespace-nowrap">₹{Number(h.total_amount).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className={`whitespace-nowrap px-2 py-0.5 rounded text-[9px] font-bold border ${getStatusBadgeClass(h.status)}`}>{h.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW VRN DETAIL MODAL */}
      {viewingNote && (
        <Modal
          isOpen={!!viewingNote}
          onClose={() => setViewingNote(null)}
          title="Vendor Return Note (VRN) Details"
          size="xl"
          noPadding={true}
        >
          <div className="flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 select-none max-h-[80vh] overflow-y-auto font-sans p-6 space-y-4">
            <div className="bg-amber-700 text-white rounded-xl p-5 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">Return Statement</p>
                <h1 className="text-lg font-black tracking-tight">{viewingNote.vendor_company_name || viewingNote.vendor_name}</h1>
                <p className="text-[10px] text-amber-100 mt-0.5">Supplier Refund Settlement Ledger</p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-white/20 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider mb-1.5">
                  {viewingNote.status.toUpperCase()}
                </span>
                <p className="text-xs font-bold text-white">#{viewingNote.return_no}</p>
                <p className="text-[10px] text-amber-100 mt-0.5">Date: {new Date(viewingNote.created_at).toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {(() => {
              const displayItems = viewingNote.items && viewingNote.items.length > 0 
                ? viewingNote.items 
                : ((returns || []).filter((r) => r.return_no === viewingNote.return_no) || [viewingNote]);
              const grossVal = displayItems.reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.return_price || 0)), 0);
              const totalRefund = Number(viewingNote.total_amount || displayItems.reduce((acc, it) => acc + Number(it.total_amount || 0), 0));
              const gstAdj = Math.max(0, totalRefund - grossVal);
              const totalUnits = displayItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0);

              return (
                <>
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Return Invoice Details</span>
                      <div>Supplier: <span className="text-slate-900 dark:text-white font-bold">{viewingNote.vendor_company_name || viewingNote.vendor_name}</span></div>
                      <div>Total Products: <span className="text-slate-900 dark:text-white font-bold">{displayItems.length} Distinct Products</span></div>
                      <div>Total Returned Units: <span className="text-slate-900 dark:text-white font-bold">{totalUnits} Pcs</span></div>
                      <div>Settlement Type: <span className="text-slate-900 dark:text-white font-bold">{viewingNote.return_type || 'Refund'}</span></div>
                      <div>Purchase Ref: <span className="text-slate-900 dark:text-white font-mono font-bold">{viewingNote.purchase_no || '—'}</span></div>
                      <div>Primary Reason: <span className="text-amber-600 dark:text-amber-400 font-bold">{viewingNote.reason}</span></div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Financial Settlement Summary</span>
                      <div>Gross Return Value: <span className="text-slate-900 dark:text-slate-200 font-mono">₹{grossVal.toFixed(2)}</span></div>
                      <div>Estimated GST Credit: <span className="text-slate-900 dark:text-slate-200 font-mono">₹{gstAdj.toFixed(2)}</span></div>
                      <div className="border-t border-slate-100 dark:border-slate-700 pt-2 mt-2 flex justify-between font-black text-rose-600 dark:text-rose-400 text-sm">
                        <span>Total Refund Deducted:</span>
                        <span className="font-mono">₹{totalRefund.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Item Breakdown Table */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Itemized Products in this Return Note ({displayItems.length})
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Total Units: {totalUnits} Pcs • Total: ₹{totalRefund.toFixed(2)}
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-[220px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                            <th className="py-1.5 px-2">#</th>
                            <th className="py-1.5 px-2">Product Description</th>
                            <th className="py-1.5 px-2">Invoice / Batch</th>
                            <th className="py-1.5 px-2 text-center">Qty</th>
                            <th className="py-1.5 px-2 text-right">Rate</th>
                            <th className="py-1.5 px-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {displayItems.map((it, idx) => (
                            <tr key={it.id || idx}>
                              <td className="py-2 px-2 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-2">
                                <div className="font-bold text-slate-800 dark:text-white">
                                  {it.product_name} {it.measurement_value ? `- ${it.measurement_value}` : ''}
                                </div>
                                <span className="block text-[10px] text-amber-600 font-normal">{it.reason} ({it.return_type || 'Refund'})</span>
                              </td>
                              <td className="py-2 px-2 font-mono text-slate-500">
                                <div>{it.purchase_no || '—'}</div>
                                <div className="text-[10px] text-slate-400">{it.batch_number || it.batch_no || '—'}</div>
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200">{it.quantity} Pcs</td>
                              <td className="py-2 px-2 text-right font-mono">₹{Number(it.return_price).toFixed(2)}</td>
                              <td className="py-2 px-2 text-right font-black font-mono text-rose-600 dark:text-rose-400">₹{Number(it.total_amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Remarks & Image */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-700 pb-1">Internal Remarks & Evidence</span>
              <p className="text-xs font-semibold text-slate-650 dark:text-slate-300">{viewingNote.remarks || 'No audit remarks provided.'}</p>
              {viewingNote.image_url && (
                <div className="mt-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Damaged Product Evidence</span>
                  <img src={viewingNote.image_url} alt="Damaged Product Evidence" className="max-h-[160px] object-contain rounded-lg border border-slate-200 dark:border-slate-700" />
                </div>
              )}
            </div>

            {/* Status workflow history tracker */}
            {viewingNote.statusHistory && viewingNote.statusHistory.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-2.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-700 pb-1">Workflow Status Audit Logs</span>
                <div className="space-y-2">
                  {viewingNote.statusHistory.map(h => (
                    <div key={h.id} className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <div>
                        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-[8px] uppercase">{h.status}</span>
                        <span className="ml-2 font-medium text-slate-800 dark:text-slate-200">{h.notes || 'Status updated'}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-400">By: {h.user_name} • {new Date(h.created_at).toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => handlePrintReturnNote(viewingNote)}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold active:scale-95"
              >
                Print Note
              </button>
              <button
                onClick={() => setViewingNote(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* UPDATE STATUS WORKFLOW MODAL */}
      {updatingStatusNote && (
        <Modal
          isOpen={!!updatingStatusNote}
          onClose={() => setUpdatingStatusNote(null)}
          title="Advance Status Workflow"
          size="sm"
        >
          <form onSubmit={handleUpdateStatusSubmit} className="p-4 space-y-4 font-sans text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Select Workflow Status</label>
              <CustomSelect
                value={statusUpdateVal}
                onChange={setStatusUpdateVal}
                color="blue"
                options={[
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Sent to Vendor', label: 'Sent to Vendor' },
                  { value: 'Vendor Accepted', label: 'Vendor Accepted' },
                  { value: 'Replacement Received', label: 'Replacement Received' },
                  { value: 'Refund Received', label: 'Refund Received' }
                ]}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Status Notes / Action Remarks</label>
              <textarea
                rows="2"
                required
                value={statusUpdateNotes}
                onChange={(e) => setStatusUpdateNotes(e.target.value)}
                placeholder="e.g. Shipment dispatched to vendor counter..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUpdatingStatusNote(null)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-lg"
              >
                Save status
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default VendorReturnManagement;
