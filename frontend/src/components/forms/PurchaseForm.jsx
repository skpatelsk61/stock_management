import { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserGroupIcon,
  ShoppingBagIcon,
  CalculatorIcon,
  CreditCardIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PrinterIcon,
  DocumentTextIcon,
  BuildingStorefrontIcon,
  ReceiptPercentIcon,
  TruckIcon,
  TagIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline';
import { vendorsAPI, productsAPI, categoriesAPI } from '../../services/api';
import PurchaseInvoicePrintTemplate from '../common/PurchaseInvoicePrintTemplate';

// ── Helper to normalise a product object from API (snake_case or camelCase)
const normProduct = (p) => ({
  id: p.id,
  name: p.name,
  barcode: p.barcode || p.bar_code || '',
  category: p.category_name || p.category || 'General',
  category_id: p.category_id || p.categoryId || '',
  purchasePrice: Number(p.purchase_price ?? p.purchasePrice ?? 0),
  unit: p.unit || 'Pcs',
  gst: Number(p.gst ?? 18),
});

const PurchaseForm = ({ purchase, purchaseOrder, onSubmit, onCancel }) => {
  const storeInfo = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        store_name: u.store_name || u.storeName || '',
        name: u.store_name || u.storeName || '',
        gstin: u.gstin || '',
        address: u.address || '',
        phone: u.phone || '',
        email: u.email || '',
        logo_url: u.logo_url || null
      };
    } catch { return { store_name: '', name: '', gstin: '', address: '', phone: '', email: '', logo_url: null }; }
  })();

  const getInitialFormData = () => {
    if (purchase) return purchase;
    if (purchaseOrder) {
      const items = (purchaseOrder.items || []).map((item) => {
        const ordered = Number(item.quantity || 0);
        const delivered = Number(item.total_delivered ?? item.delivered_quantity ?? (item.received_quantity !== undefined ? item.received_quantity : item.quantity) ?? 0);
        const damaged = Number(item.total_damaged ?? item.damaged_quantity ?? 0);
        const rejected = Number(item.total_rejected ?? item.rejected_quantity ?? 0);
        let accepted = 0;
        if (delivered > 0) {
          accepted = Math.max(0, delivered - damaged - rejected);
        } else if (Number(item.received_quantity) > 0) {
          accepted = Number(item.received_quantity);
        } else {
          accepted = ordered;
        }

        const qty = accepted;
        const price = Number(item.purchase_price || 0);
        const gstP = Number(item.gst || 0);
        const itemSubtotal = price * qty;
        const taxAmount = (itemSubtotal * gstP) / 100;
        const total = itemSubtotal + taxAmount;
        return {
          productId: item.product_id || item.id,
          name: item.product_name || item.name,
          barcode: item.barcode || '—',
          category: item.category || 'General',
          unit: item.unit || 'Pcs',
          ordered_quantity: ordered,
          total_delivered: delivered,
          total_damaged: damaged,
          total_rejected: rejected,
          net_accepted: accepted,
          quantity: qty,
          price: price,
          discountPercent: 0,
          gstPercent: gstP,
          taxAmount: taxAmount,
          total: total,
        };
      });

      return {
        vendor: purchaseOrder.vendor_name || purchaseOrder.vendor || '',
        vendorId: purchaseOrder.vendor_id || purchaseOrder.vendorId || '',
        vendorContact: purchaseOrder.vendor_phone || '',
        gstNumber: purchaseOrder.vendor_gstin || '',
        invoiceNo: purchaseOrder.purchase_order_no ? `INV-${purchaseOrder.purchase_order_no}` : '',
        purchaseDate: purchaseOrder.date ? new Date(purchaseOrder.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: purchaseOrder.expected_delivery_date ? new Date(purchaseOrder.expected_delivery_date).toISOString().split('T')[0] : '',
        items,
        paymentMode: 'Credit',
        paymentStatus: 'Pending',
        transportCharge: '0',
        otherCharges: '0',
        discountAmount: String(purchaseOrder.discount || 0),
        notes: purchaseOrder.notes || '',
        warehouseId: purchaseOrder.warehouse_id || 1,
        poNo: purchaseOrder.purchase_order_no || purchaseOrder.order_number || '',
      };
    }
    return {
      vendor: '',
      vendorId: '',
      vendorContact: '',
      gstNumber: '',
      invoiceNo: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [],
      paymentMode: 'Credit',
      paymentStatus: 'Pending',
      transportCharge: '0',
      otherCharges: '0',
      discountAmount: '0',
      notes: '',
      warehouseId: 1,
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());
  const [finalizePO, setFinalizePO] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData());
  }, [purchase, purchaseOrder]);

  const [dbVendors, setDbVendors] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const [vRes, pRes, cRes] = await Promise.all([
          vendorsAPI.getAll({ status: 'Active' }),
          productsAPI.getAll(),
          categoriesAPI.getAll({ status: 'Active' })
        ]);
        if (vRes.success) setDbVendors((vRes.vendors || []).filter((v) => v.status === 'Active'));
        if (pRes.success) setDbProducts((pRes.products || []).map(normProduct));
        if (cRes.success) setDbCategories(cRes.categories || []);
      } catch (err) {
        console.error('Failed to load vendors/products/categories for purchase form:', err);
        setDbVendors([]);
        setDbProducts([]);
        setDbCategories([]);
      }
    };
    loadFormData();
  }, []);

  const selectedCatObj = dbCategories.find(
    (c) => String(c.id) === String(selectedCategory) || c.name === selectedCategory
  );

  const filteredProducts = selectedCategory
    ? dbProducts.filter((p) => {
        if (selectedCatObj && p.category_id && String(p.category_id) === String(selectedCatObj.id)) return true;
        if (selectedCatObj && p.category && p.category.toLowerCase() === selectedCatObj.name.toLowerCase()) return true;
        if (p.category_id && String(p.category_id) === String(selectedCategory)) return true;
        if (p.category && p.category.toLowerCase() === String(selectedCategory).toLowerCase()) return true;
        return false;
      })
    : dbProducts;

  const handleCategoryChange = (catVal) => {
    setSelectedCategory(catVal);
    setSelectedProduct('');
    setCustomPrice('');
  };

  // ── Line item entry state
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('');
  const [itemMrp, setItemMrp] = useState('');
  const [itemDiscount, setItemDiscount] = useState(0);
  const [itemGst, setItemGst] = useState(18);
  const [errors, setErrors] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef();

  // ── Duplicate guard: same product can be added multiple times (different batches)
  const handleAddItem = () => {
    if (!selectedProduct) return;

    const product = dbProducts.find((p) => String(p.id) === String(selectedProduct));
    if (!product) return;

    const rawPrice = customPrice !== '' ? parseFloat(customPrice) : product.purchasePrice;
    const finalPrice = isNaN(rawPrice) || rawPrice <= 0 ? 0 : rawPrice;
    const qty = Math.max(0.001, parseFloat(quantity) || 1);
    const disc = parseFloat(itemDiscount) || 0;
    const gstP = parseFloat(itemGst) || 0;

    const itemSubtotal = finalPrice * qty;
    const calculatedDiscount = (itemSubtotal * disc) / 100;
    const taxableAmount = itemSubtotal - calculatedDiscount;
    const calculatedTax = (taxableAmount * gstP) / 100;
    const finalLineTotal = taxableAmount + calculatedTax;

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode || '—',
          category: product.category || 'General',
          unit: product.unit || 'Pcs',
          quantity: qty,
          price: finalPrice,
          purchase_price: finalPrice,
          sellingPrice: Number(product.sellingPrice ?? product.selling_price ?? 0),
          selling_price: Number(product.sellingPrice ?? product.selling_price ?? 0),
          mrp: itemMrp !== '' ? parseFloat(itemMrp) : (product.mrp || 0),
          discountPercent: disc,
          gstPercent: gstP,
          taxAmount: calculatedTax,
          total: finalLineTotal,
        },
      ],
    }));

    setSelectedProduct('');
    setQuantity(1);
    setCustomPrice('');
    setItemMrp('');
    setItemDiscount(0);
    setItemGst(18);
    setErrors((prev) => ({ ...prev, items: null }));
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleUpdateItemValue = (idx, field, value) => {
    const updated = [...formData.items];
    const item = { ...updated[idx] };
    item[field] = Number(value) || 0;

    const base = item.price * item.quantity;
    const discVal = (base * item.discountPercent) / 100;
    const taxable = base - discVal;
    item.taxAmount = (taxable * item.gstPercent) / 100;
    item.total = taxable + item.taxAmount;

    updated[idx] = item;
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));

    if (name === 'vendor') {
      const found = dbVendors.find((v) => v.name === value);
      if (found) {
        setFormData((prev) => ({
          ...prev,
          vendor: value,
          vendorId: found.id,
          vendorContact: found.phone || prev.vendorContact,
          gstNumber: found.gstin || prev.gstNumber,
        }));
      }
    }
  };

  // ── Financials
  const subtotal = formData.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDisc = formData.items.reduce((s, i) => s + (i.price * i.quantity * i.discountPercent) / 100, 0);
  const totalGst = formData.items.reduce((s, i) => s + i.taxAmount, 0);
  const transport = parseFloat(formData.transportCharge) || 0;
  const other = parseFloat(formData.otherCharges) || 0;
  const extraDisc = parseFloat(formData.discountAmount) || 0;
  const grandTotal = Math.max(0, subtotal - totalDisc + totalGst + transport + other - extraDisc);

  // ── PO Delivery, Damage & Accepted audit metrics (when linked to PO)
  const poAuditMetrics = useMemo(() => {
    if (!purchaseOrder) return null;
    let totalOrdered = 0;
    let totalDelivered = 0;
    let totalDamaged = 0;
    let totalAccepted = 0;
    let totalDamagedDeduction = 0;
    let totalGrossDeliveredValue = 0;

    formData.items.forEach((item) => {
      const ord = Number(item.ordered_quantity ?? item.quantity ?? 0);
      const del = Number(item.total_delivered ?? item.delivered_quantity ?? item.quantity ?? 0);
      const dam = Number(item.total_damaged ?? item.damaged_quantity ?? 0);
      const acc = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const gstP = Number(item.gstPercent || 0);
      const unitWithTax = price * (1 + gstP / 100);

      totalOrdered += ord;
      totalDelivered += del;
      totalDamaged += dam;
      totalAccepted += acc;
      totalDamagedDeduction += dam * unitWithTax;
      totalGrossDeliveredValue += del * unitWithTax;
    });

    return {
      totalOrdered: purchaseOrder.total_ordered_quantity !== undefined && purchaseOrder.total_ordered_quantity !== null ? Number(purchaseOrder.total_ordered_quantity) : totalOrdered,
      totalDelivered: purchaseOrder.total_delivered_quantity !== undefined && purchaseOrder.total_delivered_quantity !== null ? Number(purchaseOrder.total_delivered_quantity) : totalDelivered,
      totalDamaged: purchaseOrder.total_damaged_quantity !== undefined && purchaseOrder.total_damaged_quantity !== null ? Number(purchaseOrder.total_damaged_quantity) : totalDamaged,
      totalAccepted: purchaseOrder.total_accepted_quantity !== undefined && purchaseOrder.total_accepted_quantity !== null ? Number(purchaseOrder.total_accepted_quantity) : totalAccepted,
      totalDamagedDeduction: purchaseOrder.total_damaged_deduction !== undefined && purchaseOrder.total_damaged_deduction !== null ? Number(purchaseOrder.total_damaged_deduction) : Number(totalDamagedDeduction.toFixed(2)),
      totalGrossDeliveredValue: Number(totalGrossDeliveredValue.toFixed(2)),
    };
  }, [purchaseOrder, formData.items]);

  const handleReset = () => {
    setFormData({
      vendor: '', vendorId: '', vendorContact: '', gstNumber: '',
      invoiceNo: '', purchaseDate: new Date().toISOString().split('T')[0],
      dueDate: '', items: [], paymentMode: 'Credit', paymentStatus: 'Pending',
      transportCharge: '0', otherCharges: '0', discountAmount: '0', notes: '',
    });
    setErrors({});
  };

  const validate = () => {
    const e = {};
    if (!formData.vendor) e.vendor = 'Supplier selection is mandatory';
    if (!formData.invoiceNo) e.invoiceNo = 'Invoice reference # is required';
    if (!formData.purchaseDate) e.purchaseDate = 'Billing date is required';
    if (formData.items.length === 0) e.items = 'Add at least one product line item';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const finalPaymentStatus = formData.paymentStatus || (formData.paymentMode === 'Credit' ? 'Pending' : 'Paid');
      await onSubmit({
        ...formData,
        finalize_po: finalizePO,
        paymentStatus: finalPaymentStatus,
        subtotal,
        tax: totalGst,
        total: grandTotal,
        deliveryStatus: 'Received',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Invoice – ${formData.invoiceNo || 'Draft'}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 portrait; margin: 0.4in; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; margin: 0; padding: 0; }
            .no-print { display: none !important; }
          }
          *{box-sizing:border-box;}
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; }
        </style>
      </head>
      <body class="bg-white p-2">
        <div class="w-full max-w-full">${printContent}</div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ── GST options
  const GST_OPTS = [0, 5, 12, 18, 28];

  return (
    <form onSubmit={(e) => e.preventDefault()}
      className="w-full flex flex-col min-h-0 h-full overflow-hidden text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950/20">

      {/* ── FORM BODY ── */}
      <div className="overflow-y-auto p-5 space-y-4 flex-1">

        {/* ── SHIPMENT RECEIPT & DAMAGED GOODS AUDIT BANNER (PO MODE) ── */}
        {purchaseOrder && poAuditMetrics && (
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg border border-indigo-800/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                  <ShieldCheckIcon className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                      Goods Receipt &amp; Damage Audit Summary
                    </span>
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full font-mono font-bold border border-indigo-500/30">
                      PO #{purchaseOrder.purchase_order_no}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                    Supplier invoice is billed strictly on Net Accepted items. Damaged goods are excluded and deducted.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircleIcon className="w-3.5 h-3.5" /> Supplier Payment Protection Active
                </span>
              </div>
            </div>

            {/* 5 High-Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. Ordered */}
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ordered Qty</span>
                  <ClipboardDocumentListIcon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-slate-200">
                    {poAuditMetrics.totalOrdered}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1.5">units</span>
                </div>
                <span className="text-[9px] text-slate-400 mt-1 font-medium">Initial PO Request</span>
              </div>

              {/* 2. Delivered / Received */}
              <div className="bg-blue-950/40 rounded-xl p-3.5 border border-blue-800/40 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Qty Delivered</span>
                  <TruckIcon className="w-4 h-4 text-blue-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-blue-200">
                    {poAuditMetrics.totalDelivered}
                  </span>
                  <span className="text-[10px] text-blue-300 font-semibold ml-1.5">units</span>
                </div>
                <span className="text-[9px] text-blue-300/80 mt-1 font-medium">Physical Delivery (GRN)</span>
              </div>

              {/* 3. Damaged (Excluded) */}
              <div className="bg-rose-950/50 rounded-xl p-3.5 border border-rose-800/50 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Damaged Goods</span>
                  <ExclamationTriangleIcon className="w-4 h-4 text-rose-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-rose-300">
                    {poAuditMetrics.totalDamaged > 0 ? `-${poAuditMetrics.totalDamaged}` : '0'}
                  </span>
                  <span className="text-[10px] text-rose-400 font-semibold ml-1.5">units</span>
                </div>
                <span className="text-[10px] font-bold text-rose-300 mt-1">
                  -₹{poAuditMetrics.totalDamagedDeduction.toFixed(2)} deducted
                </span>
              </div>

              {/* 4. Net Accepted */}
              <div className="bg-emerald-950/50 rounded-xl p-3.5 border border-emerald-800/50 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Net Accepted</span>
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-emerald-300">
                    {poAuditMetrics.totalAccepted}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold ml-1.5">units</span>
                </div>
                <span className="text-[9px] text-emerald-400 mt-1 font-medium">Inwarded to Stock</span>
              </div>

              {/* 5. Final Total Amount */}
              <div className="col-span-2 sm:col-span-1 bg-indigo-600/30 rounded-xl p-3.5 border border-indigo-400/40 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Final Total</span>
                  <BanknotesIcon className="w-4 h-4 text-indigo-300" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-white">
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="text-[9px] text-indigo-200 mt-1 font-medium">Net Payable to Supplier</span>
              </div>
            </div>

            {/* Explanatory note */}
            <div className="bg-slate-800/70 rounded-xl px-4 py-2.5 border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-300">
              <span className="text-base shrink-0">💡</span>
              <p className="leading-relaxed">
                <strong>Supplier Settlement Rule:</strong> Damaged quantity ({poAuditMetrics.totalDamaged} units) is <strong>excluded from inventory</strong> and not added to batches. The deduction of <strong>₹{poAuditMetrics.totalDamagedDeduction.toFixed(2)}</strong> has been subtracted. The supplier will be paid only for the <strong>{poAuditMetrics.totalAccepted} accepted units</strong>.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1 – SUPPLIER + METADATA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* section header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <BuildingStorefrontIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-widest">Supplier Details &amp; Invoice Metadata</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Supplier Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Supplier Name *</label>
              <select name="vendor" value={formData.vendor} onChange={handleChange} disabled={!!purchaseOrder}
                className={`w-full px-3 py-2.5 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold transition-all ${errors.vendor ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-800'}`}>
                <option value="">— Select Vendor Supplier —</option>
                {dbVendors.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
              {errors.vendor && <p className="text-[10px] font-bold text-rose-600 mt-1">⚠ {errors.vendor}</p>}
            </div>

            {/* Invoice No */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Invoice Reference # *</label>
              <input type="text" name="invoiceNo" value={formData.invoiceNo} onChange={handleChange} placeholder="e.g. INV-9842"
                className={`w-full px-3 py-2.5 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold ${errors.invoiceNo ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`} />
              {errors.invoiceNo && <p className="text-[10px] font-bold text-rose-600 mt-1">⚠ {errors.invoiceNo}</p>}
            </div>

            {/* Billing Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Billing Date *</label>
              <input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange}
                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold text-slate-700" />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Due Date</label>
              <input type="date" name="dueDate" value={formData.dueDate || ''} onChange={handleChange}
                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold text-slate-700" />
            </div>

            {/* Supplier Phone */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Supplier Phone</label>
              <input type="text" name="vendorContact" value={formData.vendorContact || ''} onChange={handleChange} placeholder="Auto-filled on select"
                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold" />
            </div>

            {/* GSTIN */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Supplier GSTIN</label>
              <input type="text" name="gstNumber" value={formData.gstNumber || ''} onChange={handleChange} placeholder="GST Identification No."
                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-mono font-semibold" />
            </div>
          </div>
        </div>

        {/* SECTION 2 – PRODUCT QUICK ENTRY */}
        {!purchaseOrder && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <ShoppingBagIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-widest">Quick Product Line Entry</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* Category select */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Product Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="">— All Categories —</option>
                    {dbCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Product select */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Select Catalog Item</label>
                  <select value={selectedProduct}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value);
                      const prod = dbProducts.find((p) => String(p.id) === String(e.target.value));
                      if (prod) {
                        setCustomPrice(prod.purchasePrice > 0 ? prod.purchasePrice : '');
                        setItemGst(prod.gst || 18);
                      }
                    }}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-semibold text-slate-700 cursor-pointer">
                    <option value="">
                      {selectedCategory && filteredProducts.length === 0
                        ? '— No Products in Category —'
                        : '— Choose Catalog Product —'}
                    </option>
                    {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.barcode || '—'})</option>)}
                  </select>
                </div>

                {/* Qty */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Quantity</label>
                  <input type="number" min="0.001" step="0.001" value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(0.001, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-mono text-center font-bold text-slate-700" />
                </div>

                {/* Rate */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Rate (₹)</label>
                  <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-mono font-bold" />
                </div>

                {/* Batch MRP (Optional) */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center justify-between">
                    <span>Batch MRP (₹)</span>
                    <span className="text-[8px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input type="number" value={itemMrp} onChange={(e) => setItemMrp(e.target.value)} placeholder="e.g. 50.00"
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-mono font-bold text-slate-900" />
                </div>

                {/* GST % */}
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">GST %</label>
                  <select value={itemGst} onChange={(e) => setItemGst(Number(e.target.value))}
                    className="w-full px-2 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-bold text-xs">
                    {GST_OPTS.map((g) => <option key={g} value={g}>{g}%</option>)}
                  </select>
                </div>

                {/* Disc % */}
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Disc %</label>
                  <input type="number" min="0" max="100" value={itemDiscount}
                    onChange={(e) => setItemDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 font-mono text-center font-bold text-slate-700" />
                </div>

                {/* Add btn */}
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-transparent mb-1 uppercase">Add</label>
                  <button type="button" onClick={handleAddItem} disabled={!selectedProduct}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl flex items-center justify-center font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20">
                    <PlusIcon className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>

              {errors.items && (
                <p className="mt-3 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  ⚠ {errors.items}
                </p>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3 – ITEMS TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <DocumentTextIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-widest block">
                  {purchaseOrder ? 'PO Inward Items & Damage Audit Breakdown' : 'Purchase Line Items'}
                </span>
                {purchaseOrder && (
                  <span className="text-[10px] text-slate-300 font-medium">
                    Quantities reconciled from Goods Received Note (GRN)
                  </span>
                )}
              </div>
            </div>
            {formData.items.length > 0 && (
              <span className="text-[10px] font-bold text-white/70 bg-white/10 px-2.5 py-1 rounded-full">
                {formData.items.length} item{formData.items.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                {purchaseOrder ? (
                  <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                    <th className="px-3 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 min-w-[160px]">Item &amp; Barcode</th>
                    <th className="px-3 py-3 text-center w-16">Ordered</th>
                    <th className="px-3 py-3 text-center w-24">Delivered (GRN)</th>
                    <th className="px-3 py-3 text-center w-24">Damaged</th>
                    <th className="px-3 py-3 text-center w-24">Net Billed (Qty)</th>
                    <th className="px-3 py-3 text-right w-24">Rate ₹</th>
                    <th className="px-3 py-3 text-center w-16">GST%</th>
                    <th className="px-3 py-3 text-right w-24">Tax ₹</th>
                    <th className="px-3 py-3 text-right w-28">Total ₹</th>
                    <th className="px-2 py-3 w-6"></th>
                  </tr>
                ) : (
                  <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                    <th className="px-4 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3">Item &amp; Barcode</th>
                    <th className="px-4 py-3 text-center w-16">Qty</th>
                    <th className="px-4 py-3 text-right w-24">Rate ₹</th>
                    <th className="px-4 py-3 text-center w-16">GST%</th>
                    <th className="px-4 py-3 text-center w-16">Disc%</th>
                    <th className="px-4 py-3 text-right w-24">Tax ₹</th>
                    <th className="px-4 py-3 text-right w-28">Total ₹</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.items.length === 0 ? (
                  <tr>
                    <td colSpan={purchaseOrder ? 11 : 9} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <ShoppingBagIcon className="w-8 h-8 opacity-30" />
                        <p className="text-xs font-bold">No items added yet</p>
                        <p className="text-[10px] font-medium">Choose a product above and click the <strong>+</strong> button</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  formData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-3 py-3 text-center text-slate-400 text-[10px] font-bold">{idx + 1}</td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <p className="text-xs font-bold text-slate-900 leading-tight">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-slate-400 font-mono uppercase">{item.barcode}</span>
                          <span className="text-[9px] text-slate-400">·</span>
                          <span className="text-[9px] text-indigo-500 font-semibold">{item.category}</span>
                          {item.unit && <span className="text-[9px] text-slate-400 font-semibold">/ {item.unit}</span>}
                        </div>
                      </td>

                      {purchaseOrder ? (
                        <>
                          {/* Ordered */}
                          <td className="px-3 py-3 text-center font-mono text-xs font-semibold text-slate-600">
                            {item.ordered_quantity ?? item.quantity}
                          </td>
                          {/* Delivered / Received */}
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {Number(item.total_delivered ?? item.delivered_quantity ?? item.quantity)}
                            </span>
                          </td>
                          {/* Damaged */}
                          <td className="px-3 py-3 text-center">
                            {Number(item.total_damaged ?? item.damaged_quantity ?? 0) > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                -{Number(item.total_damaged ?? item.damaged_quantity ?? 0)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">0</span>
                            )}
                          </td>
                          {/* Net Billed Qty */}
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md font-mono text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs">
                              {item.quantity}
                            </span>
                          </td>
                          {/* Rate */}
                          <td className="px-3 py-3 text-right font-mono text-xs font-bold text-slate-800">
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => handleUpdateItemValue(idx, 'price', e.target.value)}
                              className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                            />
                          </td>
                          {/* GST % */}
                          <td className="px-3 py-3 text-center">
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">{item.gstPercent}%</span>
                          </td>
                          {/* Tax */}
                          <td className="px-3 py-3 text-right font-mono text-[11px] text-emerald-600 font-bold">₹{item.taxAmount.toFixed(2)}</td>
                          {/* Total */}
                          <td className="px-3 py-3 text-right font-mono text-sm font-black text-slate-900">₹{item.total.toFixed(2)}</td>
                          <td className="px-2 py-3 text-center"></td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-center font-mono text-xs font-bold text-slate-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-800">
                            `₹${item.price.toFixed(2)}`
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">{item.gstPercent}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.discountPercent > 0 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                              {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[11px] text-emerald-600 font-bold">₹{item.taxAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-black text-slate-900">₹{item.total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => handleRemoveItem(idx)}
                              className="text-slate-300 hover:text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {formData.items.length > 0 && (
                <tfoot>
                  {purchaseOrder ? (
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan="2" className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-500">Subtotals</td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs font-black text-slate-600">
                        {formData.items.reduce((s, i) => s + Number(i.ordered_quantity || i.quantity || 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs font-black text-blue-700">
                        {formData.items.reduce((s, i) => s + Number((i.total_delivered ?? i.delivered_quantity ?? i.quantity) || 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs font-black text-rose-700">
                        {formData.items.reduce((s, i) => s + Number((i.total_damaged ?? i.damaged_quantity) || 0), 0) > 0
                          ? `-${formData.items.reduce((s, i) => s + Number((i.total_damaged ?? i.damaged_quantity) || 0), 0)}`
                          : '0'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs font-black text-emerald-700">
                        {formData.items.reduce((s, i) => s + Number(i.quantity || 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-black text-slate-800">₹{subtotal.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-[10px] font-bold text-slate-500">—</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-black text-emerald-600">₹{totalGst.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-indigo-700">₹{(subtotal - totalDisc + totalGst).toFixed(2)}</td>
                      <td></td>
                    </tr>
                  ) : (
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan="2" className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-500">Subtotals</td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs font-black text-slate-700">
                        {formData.items.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-black text-slate-800">₹{subtotal.toFixed(2)}</td>
                      <td colSpan="2" className="px-4 py-2.5 text-center font-mono text-[10px] font-bold text-slate-500">—</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-black text-emerald-600">₹{totalGst.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-black text-indigo-700">₹{(subtotal - totalDisc + totalGst).toFixed(2)}</td>
                      <td></td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* SECTION 4 – PAYMENT + SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LEFT – Payment & charges */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-700 to-violet-600 px-5 py-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <CreditCardIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-widest">Payment &amp; Charges</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Payment mode */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Payment Mode</label>
                  <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 font-bold">
                    <option value="Cash">💵 Cash Transaction</option>
                    <option value="UPI">📱 UPI / Digital Wallet</option>
                    <option value="Bank Transfer">🏦 Bank Transfer / NEFT</option>
                    <option value="Credit">📋 Credit / Accounts Payable</option>
                  </select>
                </div>

                {/* Transport */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <TruckIcon className="w-3 h-3" /> Transport ₹
                  </label>
                  <input type="number" name="transportCharge" value={formData.transportCharge} onChange={handleChange} placeholder="0.00"
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 font-mono text-right font-bold text-slate-700" />
                </div>

                {/* Other */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Other Charges ₹</label>
                  <input type="number" name="otherCharges" value={formData.otherCharges} onChange={handleChange} placeholder="0.00"
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 font-mono text-right font-bold text-slate-700" />
                </div>

                {/* Extra discount */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <TagIcon className="w-3 h-3" /> Invoice Level Discount ₹
                  </label>
                  <input type="number" name="discountAmount" value={formData.discountAmount} onChange={handleChange} placeholder="0.00"
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-emerald-50/40 font-mono text-right font-bold text-emerald-700 border-emerald-200" />
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Notes (optional)</label>
                  <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2} placeholder="Internal remarks or payment terms…"
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 font-semibold resize-none" />
                </div>

                {/* Compact Finalize PO Checkbox */}
                {purchaseOrder && (
                  <div className="col-span-2 pt-2 border-t border-slate-200 mt-1 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg border border-slate-800 cursor-pointer select-none hover:bg-slate-850 transition-all text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={finalizePO}
                        onChange={(e) => setFinalizePO(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 border-slate-600 bg-slate-950 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5 text-slate-200">
                        {finalizePO ? (
                          <LockClosedIcon className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
                        ) : (
                          <LockOpenIcon className="w-4 h-4 text-amber-400 stroke-[2.2]" />
                        )}
                        Finalize Invoice &amp; Lock PO
                      </span>
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">
                      {finalizePO ? '🔒 PO slip will be locked permanently' : '🔓 Slip stays open for missing items'}
                    </span>
                  </div>
                )}
              </div>

              {/* Info strip */}
              <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-base leading-none mt-0.5">ℹ️</span>
                <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                  Payment status auto-maps: <strong>Credit</strong> → <em>Pending</em>. Cash / UPI / Bank → <em>Paid</em>.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT – Financial summary */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-200 rounded-2xl shadow-xl flex flex-col border border-slate-700/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <CalculatorIcon className="w-4 h-4 text-indigo-300" />
              </div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Invoice Summary</span>
            </div>

            <div className="flex-1 p-5 space-y-0">
              {purchaseOrder && poAuditMetrics ? (
                <>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-700/40">
                    <span className="text-xs text-slate-300 font-medium">Gross Goods Delivered ({poAuditMetrics.totalDelivered} units)</span>
                    <span className="font-mono text-sm text-slate-200 font-bold">₹{poAuditMetrics.totalGrossDeliveredValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-700/40 bg-rose-950/30 px-2 -mx-2 rounded-lg">
                    <span className="text-xs text-rose-300 font-bold flex items-center gap-1.5">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 text-rose-400" />
                      Damaged Deduction ({poAuditMetrics.totalDamaged} units)
                    </span>
                    <span className="font-mono text-sm text-rose-400 font-black">
                      {poAuditMetrics.totalDamagedDeduction > 0 ? `-₹${poAuditMetrics.totalDamagedDeduction.toFixed(2)}` : '₹0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-700/40">
                    <span className="text-xs text-slate-300 font-medium">Net Accepted Subtotal ({poAuditMetrics.totalAccepted} units)</span>
                    <span className="font-mono text-sm text-white font-bold">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-700/40">
                    <span className="text-xs text-slate-400 font-medium">Inward GST Tax</span>
                    <span className="font-mono text-sm text-emerald-400 font-bold">+₹{totalGst.toFixed(2)}</span>
                  </div>
                  {(transport > 0 || other > 0) && (
                    <div className="flex justify-between items-center py-2.5 border-b border-slate-700/40">
                      <span className="text-xs text-slate-400 font-medium">Transport &amp; Other</span>
                      <span className="font-mono text-sm text-slate-300 font-bold">₹{(transport + other).toFixed(2)}</span>
                    </div>
                  )}
                  {extraDisc > 0 && (
                    <div className="flex justify-between items-center py-2.5 border-b border-slate-700/40">
                      <span className="text-xs text-slate-400 font-medium">Invoice Discount</span>
                      <span className="font-mono text-sm text-emerald-400 font-bold">-₹{extraDisc.toFixed(2)}</span>
                    </div>
                  )}
                </>
              ) : (
                [
                  { label: 'Items Subtotal', value: `₹${subtotal.toFixed(2)}`, cls: 'text-white font-bold' },
                  { label: 'Total Item Discounts', value: totalDisc > 0 ? `-₹${totalDisc.toFixed(2)}` : '₹0.00', cls: totalDisc > 0 ? 'text-rose-400 font-bold' : 'text-slate-500' },
                  { label: 'Inward GST Tax', value: `+₹${totalGst.toFixed(2)}`, cls: 'text-emerald-400 font-bold' },
                  ...(transport > 0 || other > 0 ? [{ label: 'Transport & Other', value: `₹${(transport + other).toFixed(2)}`, cls: 'text-slate-300 font-bold' }] : []),
                  ...(extraDisc > 0 ? [{ label: 'Invoice Discount', value: `-₹${extraDisc.toFixed(2)}`, cls: 'text-emerald-400 font-bold' }] : []),
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-700/40 last:border-b-0">
                    <span className="text-xs text-slate-400 font-medium">{r.label}</span>
                    <span className={`font-mono text-sm ${r.cls}`}>{r.value}</span>
                  </div>
                ))
              )}
            </div>

            {/* Grand total */}
            <div className="px-5 py-4 bg-indigo-600/20 border-t border-indigo-500/30 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-indigo-300 tracking-widest block">
                  {purchaseOrder ? 'Final Payable Total' : 'Grand Total'}
                </span>
                <span className="text-3xl font-black font-mono text-white">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {purchaseOrder && (
                  <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                    ✓ Net Accepted: {poAuditMetrics?.totalAccepted ?? 0} units (Damaged deducted)
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Live Calculation
                </div>
                <div className={`text-[9px] font-bold px-2.5 py-1 rounded-lg ${formData.paymentMode === 'Credit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {formData.paymentMode === 'Credit' ? '📋 CREDIT / PENDING' : '✅ WILL BE MARKED PAID'}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      {/* ── FOOTER ── */}
      <div className="sticky bottom-0 z-30 bg-white border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.06)] shrink-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 transition-all">
            <ArrowPathIcon className="w-3.5 h-3.5 stroke-[2]" /> Reset
          </button>
          <button type="button" onClick={() => setShowPreview(!showPreview)}
            disabled={formData.items.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <ReceiptPercentIcon className="w-3.5 h-3.5" /> Preview
          </button>
          {formData.items.length > 0 && (
            <button type="button" onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
              <PrinterIcon className="w-3.5 h-3.5" /> Print
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={formData.items.length === 0 || !formData.vendor || !formData.invoiceNo}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircleIcon className="w-4 h-4 stroke-[2]" /> Save Purchase Invoice
          </button>
        </div>
      </div>

      {/* ── GREEN-THEMED PURCHASE INVOICE PREVIEW MODAL ── */}
      {showPreview && formData.items.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden" onClick={() => setShowPreview(false)}>
          <div className="bg-slate-900 rounded-3xl w-full max-w-[92vw] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-800" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Top Bar */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl text-white">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Purchase Invoice Studio Preview</h2>
                  <p className="text-[11px] text-slate-400 font-medium">Standard A4 Portrait PDF Format • Single Reusable Component</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Print A4 Invoice
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer border border-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Scrollable Document Container Backdrop */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-start bg-slate-700/30">
              <div className="w-full max-w-[880px] shadow-2xl transition-all">
              <PurchaseInvoicePrintTemplate
                storeInfo={storeInfo}
                purchase={{
                  invoiceNo: formData.invoiceNo,
                  poNo: formData.poNo || 'N/A',
                  date: formData.purchaseDate,
                  vendor: formData.vendor,
                  vendor_company: formData.vendor,
                  vendor_gstin: formData.gstNumber,
                  vendor_phone: formData.vendorContact,
                  paymentStatus: formData.paymentMode === 'Credit' ? 'UNPAID' : 'PAID',
                  deliveryStatus: 'RECEIVED',
                  subtotal: subtotal,
                  discount: totalDisc + (extraDisc || 0),
                  gst_amount: totalGst,
                  other_charges: transport + other,
                  total: grandTotal,
                  paid_amount: formData.paymentMode === 'Credit' ? 0 : grandTotal,
                  items: formData.items.map(i => ({
                    product_name: i.name,
                    barcode: i.barcode,
                    batch_no: i.batchNo || 'DEFAULT',
                    expiry_date: i.expDate || 'N/A',
                    quantity: i.quantity,
                    unit: i.unit || 'Pcs',
                    purchase_price: i.price || i.purchase_price,
                    selling_price: i.sellingPrice || i.selling_price || 0,
                    gst: i.gstPercent,
                    discount: i.discount || 0,
                    tax_amount: i.taxAmount,
                    total: i.total
                  })),
                  remarks: formData.notes
                }}
              />
              </div>
            </div>

            {/* Hidden, print-ready document structure containing raw invoice details */}
            <div className="hidden">
              <div ref={printRef}>
                <PurchaseInvoicePrintTemplate
                  storeInfo={storeInfo}
                  purchase={{
                    invoiceNo: formData.invoiceNo,
                    poNo: formData.poNo || 'N/A',
                    date: formData.purchaseDate,
                    vendor: formData.vendor,
                    vendor_company: formData.vendor,
                    vendor_gstin: formData.gstNumber,
                    vendor_phone: formData.vendorContact,
                    paymentStatus: formData.paymentMode === 'Credit' ? 'UNPAID' : 'PAID',
                    deliveryStatus: 'RECEIVED',
                    subtotal: subtotal,
                    discount: totalDisc + (extraDisc || 0),
                    gst_amount: totalGst,
                    other_charges: transport + other,
                    total: grandTotal,
                    paid_amount: formData.paymentMode === 'Credit' ? 0 : grandTotal,
                    items: formData.items.map(i => ({
                      product_name: i.name,
                      barcode: i.barcode,
                      batch_no: i.batchNo || 'DEFAULT',
                      expiry_date: i.expDate || 'N/A',
                      quantity: i.quantity,
                      unit: i.unit || 'Pcs',
                      purchase_price: i.price,
                      gst: i.gstPercent,
                      discount: i.discount || 0,
                      tax_amount: i.taxAmount,
                      total: i.total
                    })),
                    remarks: formData.notes
                  }}
                />
              </div>
            </div>

          </div>
        </div>
      )}
    </form>
  );
};

export default PurchaseForm;