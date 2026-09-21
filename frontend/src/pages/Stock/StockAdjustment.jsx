import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  productsAPI, 
  stockAPI 
} from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import {
  CubeIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  EyeIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  CalendarIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatsCard from '../../components/common/StatsCard';

const INCREASE_REASONS = [
  'Physical Count Difference',
  'Opening Correction',
  'Previous Entry Correction',
  'Found Stock',
  'Other'
];

const DECREASE_REASONS = [
  'Damaged',
  'Expired',
  'Lost',
  'Theft',
  'Wastage',
  'Physical Count Difference',
  'System Correction',
  'Other'
];

const ALL_REASONS = Array.from(new Set([...INCREASE_REASONS, ...DECREASE_REASONS]));

const checkIsIncrease = (r) => {
  if (!r) return true;
  if (r.adjustment_type) {
    return r.adjustment_type === 'Increase' || r.adjustment_type === 'add';
  }
  if (r.type) {
    return r.type === 'Increase' || r.type === 'add' || r.type === 'Stock In';
  }
  if (r.previous_quantity !== undefined && r.new_quantity !== undefined && r.previous_quantity !== null && r.new_quantity !== null) {
    return Number(r.new_quantity) >= Number(r.previous_quantity);
  }
  return Number(r.quantity) > 0;
};

const StockAdjustment = ({ onStockChanged }) => {
  const { user } = useAppSelector((state) => state.auth);
  const isReadOnly = user?.role === 'Super Admin';
  const isSuperAdmin = user?.role === 'Super Admin';

  // Master Data States
  const [productList, setProductList] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dbOffline, setDbOffline] = useState(false);

  // Searchable Product Dropdown States
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);

  // Batch & Pricing States
  const [productBatches, setProductBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchMode, setBatchMode] = useState('existing'); // 'existing' | 'new'

  // Form State
  const [formData, setFormData] = useState({
    productId: '',
    category: '',
    unit: 'Pieces',
    type: 'Increase', // Increase or Decrease
    quantity: '',
    costPrice: '',
    sellingPrice: '',
    mrp: '',
    reason: 'Physical Count Difference',
    remarks: '',
    batchId: '',
    batchNo: '',
    mfgDate: '',
    expDate: ''
  });

  // Filters & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterAdjustedBy, setFilterAdjustedBy] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // UI Interactive States
  const [selectedLogForView, setSelectedLogForView] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reversalConfirm, setReversalConfirm] = useState({ open: false, id: null, adjustmentNo: '' });
  const [toastAlert, setToastAlert] = useState({ show: false, message: '', type: 'success' });

  // Helper to parse notes structured string
  const parseNotes = (notesStr) => {
    const details = {
      reason: 'Physical Count Difference',
      remarks: '—',
      batchNo: 'N/A',
      mfgDate: 'N/A',
      expDate: 'N/A'
    };
    if (!notesStr) return details;
    
    const parts = notesStr.split('|').map(p => p.trim());
    parts.forEach(part => {
      const [key, ...valParts] = part.split(':');
      if (!key) return;
      const val = valParts.join(':').trim();
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === 'reason') details.reason = val;
      else if (lowerKey === 'remarks' || lowerKey === 'notes') details.remarks = val;
      else if (lowerKey === 'batch') details.batchNo = val;
      else if (lowerKey === 'mfg') details.mfgDate = val;
      else if (lowerKey === 'exp') details.expDate = val;
    });
    return details;
  };

  const fetchProductsAndLogs = async () => {
    setLoading(true);
    try {
      const prodRes = await productsAPI.getAll();
      if (prodRes.success) {
        setProductList(prodRes.products);
      }
      
      const adjRes = await stockAPI.getAdjustments();
      if (adjRes.success) {
        setRecords(adjRes.adjustments);
      } else {
        const logsRes = await stockAPI.getLogs({ type: 'Adjustment' });
        if (logsRes.success) setRecords(logsRes.logs);
      }
    } catch (err) {
      console.error('StockAdjustment API error:', err);
      setDbOffline(false);
      setProductList([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndLogs();
  }, []);

  const triggerToast = (message, type = 'success') => {
    setToastAlert({ show: true, message, type });
    setTimeout(() => {
      setToastAlert({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  // Determine if selected product has batch or expiry tracking enabled
  const hasExpiryTracking = useMemo(() => {
    if (!selectedProductDetails) return false;
    const cat = (selectedProductDetails.category || '').toLowerCase();
    return (
      selectedProductDetails.expiry_date || 
      cat === 'dairy' || 
      cat === 'grocery' || 
      cat === 'beverages' || 
      cat === 'snacks' || 
      cat === 'food'
    );
  }, [selectedProductDetails]);

  // Load batches for selected product
  const loadBatchesForProduct = async (productId, currentProd = null) => {
    if (!productId) {
      setProductBatches([]);
      return;
    }
    setLoadingBatches(true);
    try {
      const res = await stockAPI.getBatches(productId, { includeAll: true });
      if (res.success && Array.isArray(res.batches) && res.batches.length > 0) {
        setProductBatches(res.batches);
        setBatchMode('existing');
        const latestBatch = res.batches[0];
        setFormData(prev => ({
          ...prev,
          batchId: latestBatch.id,
          batchNo: latestBatch.batch_number || '',
          costPrice: latestBatch.purchase_price !== null && latestBatch.purchase_price !== undefined 
            ? String(latestBatch.purchase_price) 
            : (prev.costPrice || (currentProd?.purchase_price ? String(currentProd.purchase_price) : '')),
          sellingPrice: latestBatch.selling_price !== null && latestBatch.selling_price !== undefined 
            ? String(latestBatch.selling_price) 
            : (prev.sellingPrice || (currentProd?.selling_price ? String(currentProd.selling_price) : '')),
          mrp: latestBatch.mrp !== null && latestBatch.mrp !== undefined 
            ? String(latestBatch.mrp) 
            : (prev.mrp || (currentProd?.mrp ? String(currentProd.mrp) : '')),
          expDate: latestBatch.expiry_date ? latestBatch.expiry_date.split('T')[0] : prev.expDate
        }));
      } else {
        setProductBatches([]);
        setBatchMode('new');
      }
    } catch (err) {
      console.warn('Could not load batches for product:', err);
      setProductBatches([]);
      setBatchMode('new');
    } finally {
      setLoadingBatches(false);
    }
  };

  // Autocomplete Details when Product is Selected
  const handleSelectProduct = (prod) => {
    setSelectedProductDetails(prod);
    setSearchProductQuery(prod.name);
    setShowProductDropdown(false);

    const cp = prod.purchase_price ?? prod.purchasePrice ?? prod.cost_price ?? '';
    const sp = prod.selling_price ?? prod.sellingPrice ?? '';
    const mrp = prod.mrp ?? '';

    setFormData((prev) => ({
       ...prev,
       productId: prod.id,
       category: prod.category || 'General',
       unit: prod.unit || 'Pieces',
       costPrice: cp !== '' && cp !== null ? String(cp) : '',
       sellingPrice: sp !== '' && sp !== null ? String(sp) : '',
       mrp: mrp !== '' && mrp !== null ? String(mrp) : '',
       batchId: '',
       batchNo: '',
       mfgDate: prod.manufacturing_date ? prod.manufacturing_date.split('T')[0] : '',
       expDate: prod.expiry_date ? prod.expiry_date.split('T')[0] : ''
    }));

    loadBatchesForProduct(prod.id, prod);
  };

  // Handle Search Input Changes & Smart Sync
  const handleProductSearchChange = (val) => {
    setSearchProductQuery(val);
    setShowProductDropdown(true);

    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setSelectedProductDetails(null);
      setProductBatches([]);
      setFormData(prev => ({ 
        ...prev, 
        productId: '', 
        category: '', 
        unit: 'Pieces',
        costPrice: '',
        sellingPrice: '',
        mrp: '',
        batchId: '',
        batchNo: ''
      }));
      return;
    }

    // Auto match exact name, barcode, or SKU
    const exactMatch = productList.find(
      p => (p.name && p.name.toLowerCase() === trimmed) || 
           (p.barcode && p.barcode.toLowerCase() === trimmed) || 
           (p.sku && p.sku.toLowerCase() === trimmed)
    );

    if (exactMatch) {
      setSelectedProductDetails(exactMatch);
      const cp = exactMatch.purchase_price ?? exactMatch.purchasePrice ?? exactMatch.cost_price ?? '';
      const sp = exactMatch.selling_price ?? exactMatch.sellingPrice ?? '';
      const mrp = exactMatch.mrp ?? '';

      setFormData((prev) => ({
         ...prev,
         productId: exactMatch.id,
         category: exactMatch.category || 'General',
         unit: exactMatch.unit || 'Pieces',
         costPrice: cp !== '' && cp !== null ? String(cp) : prev.costPrice,
         sellingPrice: sp !== '' && sp !== null ? String(sp) : prev.sellingPrice,
         mrp: mrp !== '' && mrp !== null ? String(mrp) : prev.mrp,
         mfgDate: exactMatch.manufacturing_date ? exactMatch.manufacturing_date.split('T')[0] : prev.mfgDate,
         expDate: exactMatch.expiry_date ? exactMatch.expiry_date.split('T')[0] : prev.expDate
      }));

      loadBatchesForProduct(exactMatch.id, exactMatch);
    } else if (selectedProductDetails && selectedProductDetails.name.toLowerCase() !== trimmed) {
      setSelectedProductDetails(null);
      setProductBatches([]);
      setFormData(prev => ({ 
        ...prev, 
        productId: '', 
        costPrice: '', 
        sellingPrice: '', 
        mrp: '', 
        batchId: '', 
        batchNo: '' 
      }));
    }
  };

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'type') {
      const defaultReason = value === 'Increase' ? INCREASE_REASONS[0] : DECREASE_REASONS[0];
      setFormData((prev) => ({ ...prev, type: value, reason: defaultReason }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle Batch Selection Change
  const handleBatchSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'NEW_BATCH') {
      setBatchMode('new');
      setFormData(prev => ({
        ...prev,
        batchId: '',
        batchNo: '',
      }));
      return;
    }
    const found = productBatches.find(b => String(b.id) === String(val));
    if (found) {
      setBatchMode('existing');
      setFormData(prev => ({
        ...prev,
        batchId: found.id,
        batchNo: found.batch_number,
        costPrice: found.purchase_price !== null && found.purchase_price !== undefined ? String(found.purchase_price) : prev.costPrice,
        sellingPrice: found.selling_price !== null && found.selling_price !== undefined ? String(found.selling_price) : prev.sellingPrice,
        mrp: found.mrp !== null && found.mrp !== undefined ? String(found.mrp) : prev.mrp,
        expDate: found.expiry_date ? found.expiry_date.split('T')[0] : prev.expDate
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        batchId: '',
        batchNo: ''
      }));
    }
  };

  // Unit Cost & Adjustment Value Calculation
  const unitCost = useMemo(() => {
    if (formData.costPrice !== undefined && formData.costPrice !== '') {
      return parseFloat(formData.costPrice) || 0;
    }
    if (!selectedProductDetails) return 0;
    return Number(selectedProductDetails.purchase_price || selectedProductDetails.purchasePrice || selectedProductDetails.selling_price || selectedProductDetails.mrp || 0);
  }, [formData.costPrice, selectedProductDetails]);

  const calculatedAdjustmentValue = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    return Number((qty * unitCost).toFixed(2));
  }, [formData.quantity, unitCost]);

  // Margin & Profit Preview
  const marginInfo = useMemo(() => {
    const cp = parseFloat(formData.costPrice) || 0;
    const sp = parseFloat(formData.sellingPrice) || 0;
    const profit = sp - cp;
    const marginPct = sp > 0 ? ((profit / sp) * 100).toFixed(1) : '0.0';
    return { profit, marginPct };
  }, [formData.costPrice, formData.sellingPrice]);

  // Updated Stock Quantity Calculation
  const calculatedUpdatedStock = useMemo(() => {
    const current = selectedProductDetails ? Number(selectedProductDetails.stock || selectedProductDetails.total_stock || 0) : 0;
    const qty = parseFloat(formData.quantity) || 0;
    if (formData.type === 'Increase') {
      return current + qty;
    } else if (formData.type === 'Decrease') {
      return Math.max(0, current - qty);
    }
    return current;
  }, [selectedProductDetails, formData.quantity, formData.type]);

  // Submit Handler: Triggers Pre-Confirmation Modal
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.productId) {
      triggerToast('Please select a valid product from the dropdown list', 'error');
      return;
    }
    if (!formData.quantity) {
      triggerToast('Please enter an adjustment quantity', 'error');
      return;
    }

    const qty = Number(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      triggerToast('Quantity must be a positive number greater than 0', 'error');
      return;
    }
    
    const current = selectedProductDetails ? Number(selectedProductDetails.stock || selectedProductDetails.total_stock || 0) : 0;
    if (formData.type === 'Decrease' && qty > current) {
      triggerToast(`Validation Error: Decrease quantity (${qty}) cannot exceed current stock (${current}).`, 'error');
      return;
    }

    // MANDATORY COMMERCIAL PRICING VALIDATION
    if (formData.costPrice === '' || formData.costPrice === undefined || isNaN(Number(formData.costPrice)) || Number(formData.costPrice) < 0) {
      triggerToast('Basic Cost Price (Purchase Price) is mandatory and must be a valid number (>= 0).', 'error');
      return;
    }

    if (formData.sellingPrice === '' || formData.sellingPrice === undefined || isNaN(Number(formData.sellingPrice)) || Number(formData.sellingPrice) < 0) {
      triggerToast('Selling Price is mandatory and must be a valid number (>= 0).', 'error');
      return;
    }

    if (formData.mrp === '' || formData.mrp === undefined || isNaN(Number(formData.mrp)) || Number(formData.mrp) < 0) {
      triggerToast('MRP is mandatory and must be a valid number (>= 0).', 'error');
      return;
    }

    const sp = Number(formData.sellingPrice);
    const mrp = Number(formData.mrp);
    if (mrp > 0 && sp > mrp) {
      triggerToast(`Validation Error: Selling Price (₹${sp}) cannot exceed MRP (₹${mrp}).`, 'error');
      return;
    }

    // Open Pre-Confirmation Modal
    setShowConfirmModal(true);
  };

  // Execute Adjustment Transaction
  const executeSubmitAdjustment = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const qty = Number(formData.quantity);
      const cp = Number(formData.costPrice);
      const sp = Number(formData.sellingPrice);
      const mrp = Number(formData.mrp);

      const payload = {
        product_id: Number(formData.productId),
        warehouse_id: 1,
        type: formData.type,
        quantity: qty,
        unit_cost: cp,
        cost_price: cp,
        purchase_price: cp,
        selling_price: sp,
        mrp: mrp,
        reason: formData.reason,
        remarks: formData.remarks,
        batch_id: formData.batchId || null,
        batch_number: formData.batchNo || null,
        mfg_date: formData.mfgDate || null,
        exp_date: formData.expDate || null
      };

      if (!dbOffline) {
        const res = await stockAPI.adjust(payload);
        if (res.success) {
          triggerToast(`Stock adjustment ${res.adjustment_no || ''} recorded successfully!`, 'success');
          resetForm();
          await fetchProductsAndLogs();
          if (onStockChanged) onStockChanged();
        }
      } else {
        triggerToast('Stock adjustment simulated successfully in offline mode!', 'success');
        resetForm();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Error updating stock records', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      productId: '',
      category: '',
      unit: 'Pieces',
      type: 'Increase',
      quantity: '',
      costPrice: '',
      sellingPrice: '',
      mrp: '',
      reason: INCREASE_REASONS[0],
      remarks: '',
      batchId: '',
      batchNo: '',
      mfgDate: '',
      expDate: ''
    });
    setSearchProductQuery('');
    setSelectedProductDetails(null);
    setProductBatches([]);
    setBatchMode('existing');
  };

  const handleTriggerReversal = (record) => {
    if (isReadOnly) {
      triggerToast('Monitoring Mode: Reversal disabled', 'error');
      return;
    }
    setReversalConfirm({
      open: true,
      id: record.id,
      adjustmentNo: record.adjustment_no || `ADJ-${String(record.id).padStart(6, '0')}`
    });
  };

  const executeReversal = async () => {
    const { id } = reversalConfirm;
    setReversalConfirm({ open: false, id: null, adjustmentNo: '' });
    setSubmitting(true);
    try {
      const res = await stockAPI.reverseAdjustment(id, { reason: 'Controlled Reversal' });
      if (res.success) {
        triggerToast(res.message || 'Stock adjustment reversed successfully!', 'success');
        await fetchProductsAndLogs();
        if (onStockChanged) onStockChanged();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Failed to reverse stock adjustment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Printable receipt layout generator
  const handlePrintAdjustment = (item) => {
    const details = parseNotes(item.notes);
    const mfgText = details.mfgDate && details.mfgDate !== 'N/A' ? details.mfgDate : 'N/A';
    const expText = details.expDate && details.expDate !== 'N/A' ? details.expDate : 'N/A';
    const batchText = details.batchNo && details.batchNo !== 'N/A' ? details.batchNo : 'N/A';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Stock Adjustment Note - ADJ-${String(item.id).padStart(6, '0')}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h2 { margin: 0; font-size: 16px; }
            .header p { margin: 2px 0; font-size: 11px; }
            .section { margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
            .label { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <h2>KIRANA STORE ERP</h2>
            <p>STOCK ADJUSTMENT NOTE</p>
          </div>
          <div class="section">
            <div class="row"><span class="label">Adjustment No:</span><span>ADJ-${String(item.id).padStart(6, '0')}</span></div>
            <div class="row"><span class="label">Date & Time:</span><span>${new Date(item.created_at).toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Adjusted By:</span><span>${item.user_name || 'System Admin'}</span></div>
          </div>
          <div class="divider"></div>
          <div class="section">
            <div class="row"><span class="label">Product Name:</span><span>${item.product_name}</span></div>
            <div class="row"><span class="label">Category:</span><span>${item.category_name || 'General'}</span></div>
            <div class="row"><span class="label">Adjustment Type:</span><span>${checkIsIncrease(item) ? 'Increase (+)' : 'Decrease (-)'}</span></div>
            <div class="row"><span class="label">Adjusted Qty:</span><span>${checkIsIncrease(item) ? '+' : '-'}${Math.abs(item.quantity)} Pcs</span></div>
          </div>
          <div class="divider"></div>
          <div class="section">
            <div class="row"><span class="label">Previous Stock:</span><span>${item.previous_quantity ?? '—'} Pcs</span></div>
            <div class="row"><span class="label">New Stock Level:</span><span>${item.new_quantity ?? '—'} Pcs</span></div>
          </div>
          <div class="divider"></div>
          <div class="section">
            <div class="row"><span class="label">Cost Price:</span><span>₹${Number(item.unit_cost || 0).toFixed(2)}</span></div>
            <div class="row"><span class="label">Selling Price:</span><span>₹${Number(item.selling_price || 0).toFixed(2)}</span></div>
            <div class="row"><span class="label">MRP:</span><span>₹${Number(item.mrp || 0).toFixed(2)}</span></div>
          </div>
          <div class="divider"></div>
          <div class="section">
            <div class="row"><span class="label">Reason:</span><span>${details.reason}</span></div>
            <div class="row"><span class="label">Remarks:</span><span>${details.remarks}</span></div>
            <div class="row"><span class="label">Batch Number:</span><span>${batchText}</span></div>
            <div class="row"><span class="label">Mfg Date:</span><span>${mfgText}</span></div>
            <div class="row"><span class="label">Expiry Date:</span><span>${expText}</span></div>
          </div>
          <div class="footer">
            <p>Authorized Signatory</p>
            <p style="margin-top: 25px;">___________________</p>
            <p style="margin-top: 10px; font-size: 8px;">Generated via Kirana Store Inventory System</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // CSV Exporter
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Adjustment Number,Date & Time,Product Name,Category,Adjustment Type,Cost Price,Selling Price,MRP,Previous Stock,Adjusted Qty,New Stock,Reason,Remarks,Adjusted By\n";
    
    filteredRecords.forEach(r => {
      const details = parseNotes(r.notes);
      const isInc = checkIsIncrease(r);
      const row = [
        `"ADJ-${String(r.id).padStart(6, '0')}"`,
        `"${new Date(r.created_at).toLocaleString('en-IN')}"`,
        `"${(r.product_name || '').replace(/"/g, '""')}"`,
        `"${(r.category_name || 'General').replace(/"/g, '""')}"`,
        `"${isInc ? 'Increase' : 'Decrease'}"`,
        `"${r.unit_cost || 0}"`,
        `"${r.selling_price || 0}"`,
        `"${r.mrp || 0}"`,
        `"${r.previous_quantity ?? 0}"`,
        `"${isInc ? '+' : '-'}${Math.abs(r.quantity)}"`,
        `"${r.new_quantity ?? 0}"`,
        `"${details.reason}"`,
        `"${(details.remarks || '').replace(/"/g, '""')}"`,
        `"${r.user_name || 'Store Admin'}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_adjustments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Excel report exported successfully!', 'success');
  };

  // Print PDF Landscape Spooler
  const handleExportPDFList = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Stock Adjustment Report</title>
          <style>
            body { font-family: sans-serif; padding: 25px; font-size: 10px; }
            h1 { text-align: center; font-size: 16px; margin-bottom: 5px; }
            p { text-align: center; margin: 0 0 20px 0; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .badge { font-weight: bold; padding: 2px 5px; border-radius: 4px; }
            .increase { color: green; }
            .decrease { color: red; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <h1>Kirana Store ERP - Stock Adjustment Ledger Report</h1>
          <p>Generated Date: ${new Date().toLocaleString('en-IN')}</p>
          <table>
            <thead>
              <tr>
                <th>Adjustment Number</th>
                <th>Date & Time</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Adjustment Type</th>
                <th>Prev Stock</th>
                <th>Adj Qty</th>
                <th>New Stock</th>
                <th>Reason</th>
                <th>Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => {
                const details = parseNotes(r.notes);
                const isInc = checkIsIncrease(r);
                return `
                  <tr>
                    <td>ADJ-${String(r.id).padStart(6, '0')}</td>
                    <td>${new Date(r.created_at).toLocaleString('en-IN')}</td>
                    <td><b>${r.product_name}</b></td>
                    <td>${r.category_name || 'General'}</td>
                    <td><span class="badge ${isInc ? 'increase' : 'decrease'}">${isInc ? 'Increase' : 'Decrease'}</span></td>
                    <td>${r.previous_quantity ?? '—'}</td>
                    <td>${isInc ? '+' : '-'}${Math.abs(r.quantity)}</td>
                    <td>${r.new_quantity ?? '—'}</td>
                    <td>${details.reason}</td>
                    <td>${r.user_name || 'Store Admin'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Dynamic calculations for filters and metrics
  const uniqueUsers = useMemo(() => {
    const usersSet = new Set();
    records.forEach(r => {
      if (r.user_name) usersSet.add(r.user_name);
    });
    return Array.from(usersSet);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const parsed = parseNotes(r.notes);
      const matchesSearch = r.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesType = true;
      if (filterType) {
        const isInc = checkIsIncrease(r);
        if (filterType === 'Increase') {
          matchesType = isInc;
        } else if (filterType === 'Decrease') {
          matchesType = !isInc;
        }
      }

      let matchesReason = true;
      if (filterReason) {
        matchesReason = parsed.reason === filterReason;
      }

      let matchesUser = true;
      if (filterAdjustedBy) {
        matchesUser = r.user_name === filterAdjustedBy;
      }

      let matchesDate = true;
      if (filterDateFrom) {
        matchesDate = matchesDate && new Date(r.created_at) >= new Date(filterDateFrom);
      }
      if (filterDateTo) {
        matchesDate = matchesDate && new Date(r.created_at) <= new Date(filterDateTo + 'T23:59:59');
      }

      return matchesSearch && matchesType && matchesReason && matchesUser && matchesDate;
    });
  }, [records, searchTerm, filterType, filterReason, filterAdjustedBy, filterDateFrom, filterDateTo]);

  const adjustmentStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalIncreased = 0;
    let totalDecreased = 0;
    let todaysCount = 0;

    records.forEach(r => {
      const qty = Number(r.quantity) || 0;
      const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
      if (dateStr === todayStr) {
        todaysCount++;
      }

      const isInc = checkIsIncrease(r);
      if (isInc) {
        totalIncreased += Math.abs(qty);
      } else {
        totalDecreased += Math.abs(qty);
      }
    });

    return {
      totalAdjustments: records.length,
      totalIncreased,
      totalDecreased,
      todaysCount
    };
  }, [records]);

  return (
    <div className="space-y-6 pb-12 select-none font-sans bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl transition-all duration-300">
      
      {/* Toast alert display */}
      <AnimatePresence>
        {toastAlert.show && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg font-bold text-xs transition-all ${
              toastAlert.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <CheckCircleIcon className="w-4 h-4" />
            {toastAlert.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Stock Adjustment Panel</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Correct inventory counts, write off damaged products, and manage expiries</p>
        </div>
        {dbOffline && (
          <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 text-[10px] font-bold px-3 py-1 rounded-full">
            ⚠️ Offline Simulation Mode
          </span>
        )}
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Adjustments" value={adjustmentStats.totalAdjustments} icon={CubeIcon} subtext="Total entries logged" color="blue" />
        <StatsCard title="Total Stock Increased" value={`${adjustmentStats.totalIncreased} Pcs`} icon={CheckCircleIcon} subtext="Quantity added" color="green" />
        <StatsCard title="Total Stock Decreased" value={`${adjustmentStats.totalDecreased} Pcs`} icon={ExclamationTriangleIcon} subtext="Quantity reduced" color="orange" />
        <StatsCard title="Today's Adjustments" value={adjustmentStats.todaysCount} icon={CalendarIcon} subtext="Count of adjustments today" color="purple" />
      </div>

      {/* PRIMARY COLUMNS CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: STOCK ADJUSTMENT FORM (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm h-fit">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Adjustment Entry</h2>
            <button type="button" onClick={resetForm} className="text-[10px] text-indigo-650 hover:text-indigo-700 font-extrabold uppercase">Clear Form</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={submitting} className="space-y-4">              {/* Product Autocomplete Selection */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Select Product *</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search product by name, SKU or barcode..."
                    value={searchProductQuery}
                    onChange={(e) => handleProductSearchChange(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  />
                  <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  {searchProductQuery && (
                    <button 
                      type="button" 
                      onClick={() => handleProductSearchChange('')} 
                      className="text-[10px] text-slate-400 hover:text-slate-650 absolute right-3 top-2.5 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {showProductDropdown && (
                  <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {productList
                      .filter(p => {
                        const q = searchProductQuery.toLowerCase();
                        return (
                          (p.name && p.name.toLowerCase().includes(q)) ||
                          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                          (p.sku && p.sku.toLowerCase().includes(q))
                        );
                      })
                      .map(prod => (
                        <div 
                          key={prod.id} 
                          onClick={() => handleSelectProduct(prod)}
                          className="p-2.5 text-xs hover:bg-indigo-50 dark:hover:bg-slate-800/50 cursor-pointer flex justify-between items-center font-semibold"
                        >
                          <div>
                            <span className="text-slate-900 dark:text-white font-bold block">{prod.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Barcode: {prod.barcode || prod.sku || 'N/A'}</span>
                          </div>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 font-mono font-bold">
                            Stock: {prod.stock ?? prod.total_stock ?? 0} {prod.unit || 'Pcs'}
                          </span>
                        </div>
                      ))}
                    {productList.filter(p => {
                      const q = searchProductQuery.toLowerCase();
                      return (
                        (p.name && p.name.toLowerCase().includes(q)) ||
                        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                        (p.sku && p.sku.toLowerCase().includes(q))
                      );
                    }).length === 0 && (
                      <div className="p-3 text-xs text-slate-400 text-center font-medium">No products found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Product Metadata Block (Auto-Filled) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <input 
                    type="text" 
                    value={formData.category} 
                    readOnly 
                    placeholder="—"
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit</label>
                  <input 
                    type="text" 
                    value={formData.unit} 
                    readOnly 
                    placeholder="—"
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Stock</label>
                  <input 
                    type="text" 
                    value={selectedProductDetails ? `${selectedProductDetails.stock ?? selectedProductDetails.total_stock ?? 0} Pcs` : '—'} 
                    readOnly 
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Adjustment Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Adjustment Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="Increase">Increase (+)</option>
                    <option value="Decrease">Decrease (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Adjustment Qty *</label>
                  <input 
                    type="number"
                    name="quantity"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="Qty to adjust..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Reason *</label>
                  <select
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  >
                    {(formData.type === 'Increase' ? INCREASE_REASONS : DECREASE_REASONS).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Stock Preview</label>
                  <input 
                    type="text" 
                    value={selectedProductDetails ? `${calculatedUpdatedStock} Pcs` : '—'} 
                    readOnly 
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono font-black"
                  />
                </div>
              </div>

              {/* Commercial Pricing Section (Mandatory) */}
              <div className="bg-indigo-50/60 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Commercial Pricing (Mandatory)</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Updates Batch & Master</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Basic Cost Price / Purchase Price */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Cost Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="costPrice"
                      step="0.01"
                      min="0"
                      required
                      value={formData.costPrice}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Selling Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="sellingPrice"
                      step="0.01"
                      min="0"
                      required
                      value={formData.sellingPrice}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* MRP */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      MRP (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="mrp"
                      step="0.01"
                      min="0"
                      required
                      value={formData.mrp}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Valuation Impact & Margin Preview */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100 dark:border-slate-800 text-[10px]">
                  <div className="flex items-center justify-between bg-white dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-indigo-50 dark:border-slate-800">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Valuation Impact:</span>
                    <span className={`font-mono font-black ${formData.type === 'Increase' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formData.type === 'Increase' ? '+' : '-'}₹{calculatedAdjustmentValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-indigo-50 dark:border-slate-800">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Profit Margin:</span>
                    <span className={`font-mono font-black ${marginInfo.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      ₹{marginInfo.profit.toFixed(2)} ({marginInfo.marginPct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Batch & Expiry details */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Batch & Expiry Information
                  </h4>
                  {productBatches.length > 0 && (
                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setBatchMode('existing');
                          if (productBatches.length > 0) {
                            const b = productBatches[0];
                            setFormData(prev => ({
                              ...prev,
                              batchId: b.id,
                              batchNo: b.batch_number,
                              costPrice: b.purchase_price !== null && b.purchase_price !== undefined ? String(b.purchase_price) : prev.costPrice,
                              sellingPrice: b.selling_price !== null && b.selling_price !== undefined ? String(b.selling_price) : prev.sellingPrice,
                              mrp: b.mrp !== null && b.mrp !== undefined ? String(b.mrp) : prev.mrp,
                              expDate: b.expiry_date ? b.expiry_date.split('T')[0] : prev.expDate
                            }));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md transition-all ${batchMode === 'existing' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Existing ({productBatches.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchMode('new');
                          setFormData(prev => ({ ...prev, batchId: '', batchNo: '' }));
                        }}
                        className={`px-2 py-0.5 rounded-md transition-all ${batchMode === 'new' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        + New Batch
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-0.5">
                      Batch {loadingBatches && <span className="animate-spin inline-block text-[10px]">⌛</span>}
                    </label>
                    {batchMode === 'existing' && productBatches.length > 0 ? (
                      <select
                        name="batchId"
                        value={formData.batchId || ''}
                        onChange={handleBatchSelectChange}
                        className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
                      >
                        <option value="">-- Select Batch --</option>
                        {productBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batch_number} (Rem: {b.remaining_quantity})
                          </option>
                        ))}
                        <option value="NEW_BATCH">+ Enter Custom Batch...</option>
                      </select>
                    ) : (
                      <input 
                        type="text"
                        name="batchNo"
                        value={formData.batchNo}
                        onChange={handleInputChange}
                        placeholder="e.g. BT-102 (or auto)"
                        className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-0.5">Mfg Date</label>
                    <input 
                      type="date"
                      name="mfgDate"
                      value={formData.mfgDate}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white bg-white dark:bg-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-0.5">Expiry Date</label>
                    <input 
                      type="date"
                      name="expDate"
                      value={formData.expDate}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white bg-white dark:bg-slate-900 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks</label>
                <textarea 
                  name="remarks"
                  rows="2"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  placeholder="Notes for physical recount audit (Optional)..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Read Only Dynamic Info */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[10px] font-semibold text-slate-500 space-y-1.5">
                <div className="flex justify-between">
                  <span>Adjustment Date & Time:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-350">{new Date().toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Adjusted By Operator:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{user?.name || 'Store Admin'} ({user?.role || 'Operator'})</span>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              {!isReadOnly ? (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    {submitting ? 'Executing adjustment transaction...' : 'Save Stock Adjustment'}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-center text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  👁️ Monitoring Mode (Read-Only): Stock adjustment entry is disabled.
                </div>
              )}

            </fieldset>
          </form>
        </div>

        {/* RIGHT COLUMN: HISTORY TABLE LOGS (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm flex flex-col justify-between h-fit gap-4">
          
          {/* Header search controls */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Stock Adjustment History</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[11px] font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer"
                >
                  <ArrowDownTrayIcon className="w-3.5 h-3.5 text-indigo-500" /> Export Excel
                </button>
                <button 
                  onClick={handleExportPDFList}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[11px] font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer"
                >
                  <PrinterIcon className="w-3.5 h-3.5 text-slate-500" /> Export PDF
                </button>
              </div>
            </div>

            {/* Filter widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <div className="sm:col-span-2">
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Search Product Name</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Product Name..."
                    className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-bold bg-white dark:bg-slate-900"
                  />
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Adjust Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">All Types</option>
                  <option value="Increase">Increase (+)</option>
                  <option value="Decrease">Decrease (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Reason</label>
                <select
                  value={filterReason}
                  onChange={(e) => setFilterReason(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">All Reasons</option>
                  {ALL_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Adjusted By</label>
                <select
                  value={filterAdjustedBy}
                  onChange={(e) => setFilterAdjustedBy(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">All Operators</option>
                  {uniqueUsers.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date From</label>
                <input 
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-2 py-1 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date To</label>
                <input 
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-2 py-1 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* TABLE LOG DISPLAY */}
          {loading ? (
            <div className="py-20 text-center text-slate-500 animate-pulse text-xs font-bold">Loading adjustments history...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950">
                    <th className="py-2.5 px-3">Adjust No</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-center">Prev Stock</th>
                    <th className="py-2.5 px-3 text-center">Adjusted Qty</th>
                    <th className="py-2.5 px-3 text-center">New Stock</th>
                    <th className="py-2.5 px-3 text-right">Pricing (CP/SP/MRP)</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-350">
                  {filteredRecords.map((r) => {
                    const parsed = parseNotes(r.notes);
                    const isInc = checkIsIncrease(r);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          ADJ-{String(r.id).padStart(6, '0')}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-3">
                          <span className="block font-bold text-slate-900 dark:text-white">{r.product_name}</span>
                          {parsed.batchNo !== 'N/A' && (
                            <span className="block text-[9px] text-slate-400 font-mono">Batch: {parsed.batchNo}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-medium">{r.category_name || 'General'}</td>
                        <td className="py-3 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isInc ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}>
                            {isInc ? 'Increase' : 'Decrease'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">{r.previous_quantity ?? '—'}</td>
                        <td className="py-3 px-3 text-center font-black tabular-nums">
                          {isInc ? `+${Math.abs(r.quantity)}` : `-${Math.abs(r.quantity)}`}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-800 dark:text-white font-bold">{r.new_quantity ?? '—'}</td>
                        <td className="py-3 px-3 text-right font-mono text-[10px]">
                          <div className="text-slate-900 dark:text-white font-bold whitespace-nowrap">
                            ₹{Number(r.unit_cost || 0).toFixed(0)} / ₹{Number(r.selling_price || 0).toFixed(0)}
                          </div>
                          <div className="text-slate-400 text-[9px] whitespace-nowrap">
                            MRP: ₹{Number(r.mrp || 0).toFixed(0)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-amber-700 dark:text-amber-400 font-bold text-[10px]">{parsed.reason}</td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium">{r.user_name || 'Store Admin'}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => setSelectedLogForView(r)}
                              className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all border border-indigo-200/80 dark:border-indigo-800/80 active:scale-95 cursor-pointer shadow-xs"
                              title="View Log Details"
                            >
                              <EyeIcon className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handlePrintAdjustment(r)}
                              className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer shadow-xs"
                              title="Print Receipt"
                            >
                              <PrinterIcon className="w-3.5 h-3.5" />
                            </button>
                             {r.status !== 'Reversed' && (
                              <button 
                                type="button"
                                onClick={() => handleTriggerReversal(r)}
                                className="p-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-xl transition-all border border-amber-200/80 dark:border-amber-800/80 active:scale-95 cursor-pointer shadow-xs"
                                title="Reverse Adjustment"
                              >
                                ↺
                              </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-400 font-bold">No stock adjustments matched filters</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* VIEW MODAL: DETAILED ADJUSTMENT RECEIPT DIALOG */}
      <Modal
        isOpen={!!selectedLogForView}
        onClose={() => setSelectedLogForView(null)}
        title="Stock Adjustment Details"
        size="xl"
      >
        {selectedLogForView && (() => {
          const details = parseNotes(selectedLogForView.notes);
          const isIncModal = checkIsIncrease(selectedLogForView);
          const absQty = Math.abs(selectedLogForView.quantity);
          const unitCostVal = Number(selectedLogForView.unit_cost || 0);
          const totalVal = Number(selectedLogForView.adjustment_value || (absQty * unitCostVal)).toFixed(2);
          const prevQty = selectedLogForView.previous_quantity ?? '—';
          const newQty = selectedLogForView.new_quantity ?? '—';

          return (
            <div className="p-4 sm:p-5 space-y-3.5 text-[11px] select-none">
              
              {/* EXECUTIVE TOP VOUCHER BANNER */}
              <div className="bg-slate-900 text-white rounded-xl p-3 flex flex-row justify-between items-center gap-3 shadow-sm border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded-md">
                    <CubeIcon className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black tracking-wide text-white uppercase leading-tight">
                      {user?.store_name || user?.name || 'Kirana Store ERP'}
                    </h4>
                    <p className="text-[9px] font-medium text-slate-400">
                      Physical Audit Log Entry
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-950/90 border border-indigo-800/80 px-2 py-0.5 rounded-md">
                    {selectedLogForView.adjustment_no || `ADJ-${String(selectedLogForView.id).padStart(6, '0')}`}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 font-mono hidden sm:inline-block">
                    {new Date(selectedLogForView.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* ACTION TYPE HIGHLIGHT BADGE */}
              <div className={`px-3 py-2 rounded-xl border flex items-center justify-between font-bold text-[11px] ${
                isIncModal 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50' 
                  : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isIncModal ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-ping'}`}></span>
                  <span className="uppercase text-[10px] tracking-wider font-black">
                    Adjustment Direction: {isIncModal ? 'Stock Increase (+)' : 'Stock Decrease (-)'}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tabular-nums shadow-sm ${
                  isIncModal ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {isIncModal ? `+${absQty} Pcs` : `-${absQty} Pcs`}
                </span>
              </div>

              {/* TWO COLUMN METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Product Profile Card */}
                <div className="bg-white dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Product Description</span>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-slate-600 dark:text-slate-400">
                      {selectedLogForView.category_name || 'General'}
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                      {selectedLogForView.product_name}
                    </h5>
                    <p className="text-[9px] font-mono text-slate-400">
                      Barcode: {selectedLogForView.barcode || selectedLogForView.sku || 'N/A'}
                    </p>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1 text-[10px]">
                    <div>
                      <span className="text-slate-400 font-bold block text-[8px] uppercase">Cost Price</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(selectedLogForView.unit_cost || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[8px] uppercase">Selling Price</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(selectedLogForView.selling_price || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[8px] uppercase">MRP</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(selectedLogForView.mrp || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Stock Level Transition Card */}
                <div className="bg-white dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Stock Inventory Flow</span>
                    <span className="text-[9px] font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                      Delta: {isIncModal ? `+${absQty}` : `-${absQty}`} Pcs
                    </span>
                  </div>
                  
                  {/* Transition Indicator */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 font-mono text-[11px]">
                    <div className="text-center">
                      <span className="block text-[8px] text-slate-400 font-bold uppercase">Previous</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{prevQty} Pcs</span>
                    </div>
                    <span className="text-indigo-500 font-black text-xs">➔</span>
                    <div className="text-center">
                      <span className="block text-[8px] text-slate-400 font-bold uppercase">New Stock</span>
                      <span className="font-black text-slate-900 dark:text-white">{newQty} Pcs</span>
                    </div>
                  </div>

                  {/* Financial Impact */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                    <span className="text-slate-500 font-semibold">Valuation Impact:</span>
                    <span className={`font-mono font-black ${isIncModal ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isIncModal ? '+' : '-'}₹{totalVal} <span className="text-[9px] font-bold">({isIncModal ? 'Gain' : 'Loss'})</span>
                    </span>
                  </div>
                </div>

              </div>

              {/* BATCH & EXPIRY SPECIFICATIONS BAR */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Batch Number</span>
                  <span className="font-mono text-slate-900 dark:text-white font-black text-[11px]">
                    {selectedLogForView.batch_number || details.batchNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Mfg Date</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold text-[11px]">
                    {details.mfgDate !== 'N/A' ? details.mfgDate : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Expiry Date</span>
                  <span className={`font-bold text-[11px] ${details.expDate !== 'N/A' ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                    {details.expDate !== 'N/A' ? details.expDate : '—'}
                  </span>
                </div>
              </div>

              {/* REASON & OPERATOR AUDIT BOX */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-amber-500 font-bold text-xs">⚠️</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Audit Reason</span>
                  </div>
                  <span className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full text-[9px] font-extrabold">
                    {selectedLogForView.reason || details.reason}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Operator Remarks</span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium text-[11px] bg-white dark:bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                    {selectedLogForView.remarks || details.remarks || 'No notes specified.'}
                  </p>
                </div>
                <div className="flex justify-between items-center text-[9px] font-semibold text-slate-400 pt-0.5">
                  <span>Audited & Adjusted By:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    {selectedLogForView.user_name || 'Store Admin'}
                  </span>
                </div>
              </div>

              {/* STICKY MODAL ACTION BUTTONS FOOTER */}
              <div className="sticky -bottom-1 bg-white dark:bg-slate-900 pt-3 pb-1 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 z-20">
                <button 
                  type="button" 
                  onClick={() => handlePrintAdjustment(selectedLogForView)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-sm inline-flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <PrinterIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Print Receipt</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setSelectedLogForView(null)}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* PRE-CONFIRMATION MODAL */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Stock Adjustment Transaction"
        size="md"
      >
        <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] font-bold">
            ⚠️ Please review the adjustment breakdown before committing to the database.
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Product:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedProductDetails?.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Adjustment Type:</span>
              <span className={`font-black ${formData.type === 'Increase' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formData.type === 'Increase' ? 'Increase (+)' : 'Decrease (-)'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Stock Level Impact:</span>
              <span className="font-mono font-bold">
                Current: {selectedProductDetails ? (selectedProductDetails.stock ?? selectedProductDetails.total_stock ?? 0) : 0} Pcs 
                {' → '} 
                <span className="text-slate-900 dark:text-white font-black">{calculatedUpdatedStock} Pcs</span>
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Batch Number:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formData.batchNo || (formData.batchId ? (productBatches.find(b => String(b.id) === String(formData.batchId))?.batch_number) : 'Auto-generated')}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Cost Price (Purchase Price):</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(formData.costPrice || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Selling Price:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(formData.sellingPrice || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">MRP:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(formData.mrp || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Adjustment Total Value:</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{calculatedAdjustmentValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Reason:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">{formData.reason}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Financial Impact:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                formData.type === 'Increase' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {formData.type === 'Increase' ? 'Inventory Adjustment / Variation (+₹' + calculatedAdjustmentValue.toFixed(2) + ')' : 'Inventory Adjustment / Loss (-₹' + calculatedAdjustmentValue.toFixed(2) + ')'}
              </span>
            </div>
          </div>

          {formData.remarks && (
            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-600 dark:text-slate-400 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Remarks:</span>
              {formData.remarks}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={executeSubmitAdjustment}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              {submitting ? 'Committing...' : 'Confirm Adjustment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* REVERSAL CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={reversalConfirm.open}
        title={`Reverse Stock Adjustment — ${reversalConfirm.adjustmentNo}`}
        message={`Are you sure you want to reverse this stock adjustment (${reversalConfirm.adjustmentNo})? This will execute an atomic database transaction to restore stock and batch quantities while preserving audit trail history.`}
        confirmLabel="Execute Reversal"
        cancelLabel="Cancel"
        type="danger"
        onConfirm={executeReversal}
        onCancel={() => setReversalConfirm({ open: false, id: null, adjustmentNo: '' })}
      />

    </div>
  );
};

export default StockAdjustment;
