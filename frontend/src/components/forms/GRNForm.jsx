import { useState, useEffect, useMemo } from 'react';
import {
  CalendarIcon,
  DocumentTextIcon,
  ArchiveBoxArrowDownIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyRupeeIcon,
  ShieldExclamationIcon,
  LockClosedIcon,
  LockOpenIcon
} from '@heroicons/react/24/outline';
import { purchasesAPI } from '../../services/api';

const buildInitialItems = (items = []) => {
  return (items || []).map((item) => {
    const ord = Number(item.quantity || 0);
    const prevDel = Number(item.total_delivered !== undefined && item.total_delivered !== null ? item.total_delivered : (item.delivered_quantity ?? item.received_quantity ?? 0));
    const prevAcc = Number(item.received_quantity || 0);
    const remaining = Math.max(0, ord - prevDel);

    const resolvedPrice = Number(item.purchase_price || 0) > 0 
      ? Number(item.purchase_price) 
      : (Number(item.product_purchase_price || item.unit_price || item.price || 0) > 0 ? Number(item.product_purchase_price || item.unit_price || item.price) : '');

    const resolvedGst = item.gst !== undefined && item.gst !== null && Number(item.gst) >= 0 
      ? Number(item.gst) 
      : (Number(item.product_gst || 0) >= 0 ? Number(item.product_gst) : 0);

    const resolvedMrp = Number(item.mrp || 0) > 0 
      ? Number(item.mrp) 
      : (Number(item.product_mrp || item.max_retail_price || item.maxRetailPrice || 0) > 0 ? Number(item.product_mrp || item.max_retail_price || item.maxRetailPrice) : '');

    const resolvedSellingPrice = Number(item.selling_price || 0) > 0 
      ? Number(item.selling_price) 
      : (Number(item.product_selling_price || item.sellingPrice || 0) > 0 ? Number(item.product_selling_price || item.sellingPrice) : '');

    return {
      product_id: item.product_id,
      name: item.product_name,
      measurement_value: item.measurement_value || item.weight || '',
      unit: item.unit || 'Pcs',
      brand: item.brand || '',
      barcode: item.barcode || '',
      purchase_price: resolvedPrice,
      gst: resolvedGst,
      ordered_quantity: ord,
      previously_delivered: prevDel,
      previously_received: prevAcc,
      quantity_received: remaining > 0 ? remaining : '',
      quantity_damaged: '',
      quantity_rejected: '',
      quantity_missing: '',
      batch_number: '',
      mrp: resolvedMrp,
      selling_price: resolvedSellingPrice,
      expiry_date: '',
    };
  });
};

const GRNForm = ({ purchaseOrder, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: '',
    auto_create_invoice: true,
    items: buildInitialItems(purchaseOrder?.items || []),
  });

  useEffect(() => {
    if (purchaseOrder?.items && purchaseOrder.items.length > 0) {
      setFormData((prev) => ({
        ...prev,
        items: buildInitialItems(purchaseOrder.items),
      }));
    }
  }, [purchaseOrder]);

  // Dynamically calculate whether 100% full stock has arrived or if items are missing/short
  const deliveryStatusInfo = useMemo(() => {
    let hasShortageOrMissing = false;
    let totalOrderedUnits = 0;
    let totalDeliveredUnits = 0;
    let totalNetAcceptedUnits = 0;
    let totalPendingShortageUnits = 0;

    formData.items.forEach((it) => {
      const ord = Number(it.ordered_quantity) || 0;
      const prevDel = Number(it.previously_delivered || 0);
      const prevAcc = Number(it.previously_received || 0);
      const rec = it.quantity_received === '' ? 0 : Number(it.quantity_received) || 0;
      const dam = Number(it.quantity_damaged) || 0;
      const rej = Number(it.quantity_rejected) || 0;
      const netAcc = Math.max(0, rec - dam - rej);

      const cumDelivered = prevDel + rec;
      const cumAccepted = prevAcc + netAcc;

      totalOrderedUnits += ord;
      totalDeliveredUnits += cumDelivered;
      totalNetAcceptedUnits += cumAccepted;

      if (cumDelivered < ord) {
        hasShortageOrMissing = true;
        totalPendingShortageUnits += (ord - cumDelivered);
      }
    });

    const isFullStockArrived = !hasShortageOrMissing && totalOrderedUnits > 0;

    return {
      isFullStockArrived,
      hasShortageOrMissing,
      totalOrderedUnits,
      totalDeliveredUnits,
      totalNetAcceptedUnits,
      totalPendingShortageUnits
    };
  }, [formData.items]);

  const [reportMissingItems, setReportMissingItems] = useState(false);
  const [includeDamagedPayment, setIncludeDamagedPayment] = useState(false);
  const [includeMissingPayment, setIncludeMissingPayment] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchAutoBatches = async () => {
      if (purchaseOrder?.vendor_id && formData.items.length > 0) {
        try {
          const res = await purchasesAPI.getNextBatch(purchaseOrder.vendor_id, formData.items.length);
          if (res.success && res.batch_numbers && res.batch_numbers.length > 0) {
            setFormData((prev) => ({
              ...prev,
              items: prev.items.map((it, idx) => ({
                ...it,
                batch_number: it.batch_number || res.batch_numbers[idx] || res.batch_number,
              })),
            }));
          }
        } catch (err) {
          console.error('Failed to fetch auto vendor batch number:', err);
        }
      }
    };
    fetchAutoBatches();
  }, [purchaseOrder?.vendor_id]);

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    updated[index][field] = value;
    setFormData({ ...formData, items: updated });
  };

  // Helper to calculate missing items list across all products when reportMissingItems is active
  const getMissingItemsSummary = () => {
    if (!reportMissingItems) {
      return { missingList: [], totalMissingUnits: 0, totalMissingCost: 0 };
    }

    const missingList = [];
    let totalMissingUnits = 0;
    let totalMissingCost = 0;

    formData.items.forEach((item, idx) => {
      const remaining = item.ordered_quantity - item.previously_received;
      const rec = item.quantity_received === '' ? 0 : Number(item.quantity_received) || 0;
      
      let missing = 0;
      if (item.quantity_missing !== '') {
        missing = Math.max(0, Number(item.quantity_missing) || 0);
      } else {
        missing = Math.max(0, remaining - rec);
      }

      if (missing > 0) {
        const cost = Number(item.purchase_price) || 0;
        const gstP = Number(item.gst) || 0;
        const costWithGst = cost * (1 + gstP / 100);
        const itemShortageVal = missing * costWithGst;

        totalMissingUnits += missing;
        totalMissingCost += itemShortageVal;
        missingList.push({
          ...item,
          itemIdx: idx,
          remaining,
          received: rec,
          missing,
          costWithGst,
          shortageValue: itemShortageVal,
        });
      }
    });

    return { missingList, totalMissingUnits, totalMissingCost };
  };

  const { missingList, totalMissingUnits, totalMissingCost } = getMissingItemsSummary();

  const handleSubmit = (e) => {
    e.preventDefault();
    const tempErrors = {};
    
    // Validate: At least one item should have positive quantity_received
    let totalReceived = 0;
    formData.items.forEach((item, idx) => {
      const rec = item.quantity_received === '' ? 0 : Number(item.quantity_received);
      const dam = item.quantity_damaged === '' ? 0 : Number(item.quantity_damaged);
      const prev = Number(item.previously_received) || 0;
      const ord = Number(item.ordered_quantity) || 0;
      
      if (isNaN(rec) || rec < 0) {
        tempErrors[`item_${idx}_received`] = 'Quantity cannot be negative';
      }
      if (rec + prev > ord) {
        tempErrors[`item_${idx}_received`] = `Total received (${rec + prev}) exceeds ordered quantity (${ord})`;
      }
      if (isNaN(dam) || dam < 0) {
        tempErrors[`item_${idx}_damaged`] = 'Damaged quantity cannot be negative';
      } else if (dam > rec) {
        tempErrors[`item_${idx}_damaged`] = `Damaged (${dam}) cannot exceed received (${rec})`;
      }

      if (rec > 0) {
        if (item.purchase_price === '' || isNaN(Number(item.purchase_price)) || Number(item.purchase_price) <= 0) {
          tempErrors[`item_${idx}_purchase_price`] = 'Unit Rate (₹) is required';
        }
        if (item.mrp === '' || isNaN(Number(item.mrp)) || Number(item.mrp) < 0) {
          tempErrors[`item_${idx}_mrp`] = 'MRP is required';
        }
        if (item.selling_price === '' || isNaN(Number(item.selling_price)) || Number(item.selling_price) < 0) {
          tempErrors[`item_${idx}_selling_price`] = 'Selling price is required';
        } else if (item.mrp !== '' && Number(item.mrp) > 0 && Number(item.selling_price) > Number(item.mrp)) {
          tempErrors[`item_${idx}_selling_price`] = 'Selling price cannot exceed MRP';
        }
      }
      totalReceived += isNaN(rec) ? 0 : rec;
    });

    if (totalReceived <= 0) {
      tempErrors.items = 'Please receive at least one quantity for any product';
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    // Auto-generate missing items summary notes if reportMissingItems is active and missing items exist
    let finalNotes = formData.notes || '';
    if (reportMissingItems && missingList.length > 0) {
      const missingLog = `[GRN Shortage Report] ${totalMissingUnits} missing items worth ₹${totalMissingCost.toFixed(2)} recorded.`;
      if (!finalNotes.includes('[GRN Shortage Report]')) {
        finalNotes = finalNotes ? `${finalNotes}\n${missingLog}` : missingLog;
      }
    }

    onSubmit({
      date: formData.date,
      notes: finalNotes,
      auto_create_invoice: true,
      finalize_po: deliveryStatusInfo.isFullStockArrived,
      include_damaged_payment: includeDamagedPayment,
      include_missing_payment: includeMissingPayment,
      items: formData.items.map((item) => {
        const rec = item.quantity_received === '' ? 0 : Number(item.quantity_received);
        const dam = item.quantity_damaged === '' ? 0 : Number(item.quantity_damaged);
        const remaining = item.ordered_quantity - item.previously_received;
        const missing = reportMissingItems
          ? (item.quantity_missing !== '' ? Number(item.quantity_missing) : Math.max(0, remaining - rec))
          : Math.max(0, remaining - rec);
        const rej = item.quantity_rejected === '' ? 0 : Number(item.quantity_rejected);

        return {
          product_id: item.product_id,
          purchase_price: Number(item.purchase_price) || 0,
          gst: Number(item.gst) || 0,
          quantity_received: rec,
          quantity_damaged: dam,
          quantity_rejected: rej,
          quantity_missing: missing,
          batch_number: item.batch_number || null,
          mrp: item.mrp !== '' && !isNaN(Number(item.mrp)) ? Number(item.mrp) : null,
          selling_price: item.selling_price !== '' && !isNaN(Number(item.selling_price)) ? Number(item.selling_price) : null,
          expiry_date: item.expiry_date || null,
        };
      }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[85vh] overflow-y-auto px-1 pr-3 select-none">
      
      {/* Header Info */}
      <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Linked Purchase Order</span>
          <p className="text-xs font-black text-slate-900 mt-1">#{purchaseOrder.purchase_order_no}</p>
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Supplier (Vendor)</span>
          <p className="text-xs font-black text-slate-900 mt-1">{purchaseOrder.vendor_name}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">GRN Receipt Date *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 mt-1 shadow-2xs"
          />
        </div>
      </div>

      {/* Items Receiving Details Grid */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <ArchiveBoxArrowDownIcon className="w-5 h-5 text-emerald-600" />
            Verify Delivered Quantities & Stock Quality
          </h3>
        </div>

        {errors.items && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-[11px] font-bold text-rose-600">
            <ExclamationCircleIcon className="w-5 h-5 text-rose-500" />
            {errors.items}
          </div>
        )}

        <div className="space-y-4">
          {formData.items.map((item, idx) => {
            const remaining = item.ordered_quantity - item.previously_received;
            const rec = item.quantity_received === '' ? 0 : Number(item.quantity_received) || 0;
            const dam = item.quantity_damaged === '' ? 0 : Number(item.quantity_damaged) || 0;

            return (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50/80 transition-all space-y-3.5"
              >
                {/* Product Header & Stats */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">{item.name}</span>
                    {item.brand && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {item.brand}
                      </span>
                    )}
                    {(item.measurement_value || item.unit) && (
                      <span className="text-[11px] font-black text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 shadow-sm flex items-center gap-1">
                        <span>⚖️</span>
                        <span>{item.measurement_value ? `${item.measurement_value}${item.unit && !item.measurement_value.toLowerCase().includes(item.unit.toLowerCase()) ? ` (${item.unit})` : ''}` : item.unit}</span>
                      </span>
                    )}
                    {item.barcode && (
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Barcode: {item.barcode}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200/80">
                      Ordered: {item.ordered_quantity} {item.unit || 'units'}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-200/80">
                      Previously Rec: {item.previously_received} {item.unit || 'units'}
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-200/80">
                      Remaining PO: {remaining} {item.unit || 'units'}
                    </span>
                  </div>
                </div>

                {/* Input Fields Grid (2 Rows: Quantities & Batch, then Rates & Pricing) */}
                <div className="space-y-3">
                  
                  {/* Row 1: Quantities & Batch */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                    {/* 1. Qty Received ({item.unit || 'units'}) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                        Qty Received *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={item.quantity_received}
                        onChange={(e) => handleItemChange(idx, 'quantity_received', e.target.value)}
                        placeholder="0"
                        className={`w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none font-mono ${
                          errors[`item_${idx}_received`] ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-indigo-600'
                        }`}
                      />
                      {errors[`item_${idx}_received`] && (
                        <p className="text-[9px] font-bold text-rose-500 leading-tight">{errors[`item_${idx}_received`]}</p>
                      )}
                    </div>

                    {/* 2. Damaged and Defective Qty */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-rose-700 uppercase tracking-wider block truncate" title="Damaged and Defective Qty">
                        Damaged &amp; Defective Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity_received !== '' ? Number(item.quantity_received) : undefined}
                        value={item.quantity_damaged}
                        onChange={(e) => handleItemChange(idx, 'quantity_damaged', e.target.value)}
                        placeholder="0"
                        className={`w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none text-center font-mono ${
                          errors[`item_${idx}_damaged`] ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-rose-500'
                        }`}
                      />
                      {errors[`item_${idx}_damaged`] && (
                        <p className="text-[9px] font-bold text-rose-500 leading-tight">{errors[`item_${idx}_damaged`]}</p>
                      )}
                    </div>

                    {/* 3. Batch Number */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Batch No.
                      </label>
                      <input
                        type="text"
                        value={item.batch_number}
                        onChange={(e) => handleItemChange(idx, 'batch_number', e.target.value)}
                        placeholder="e.g. B-01"
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 font-mono"
                      />
                    </div>

                    {/* 4. Expiry Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => handleItemChange(idx, 'expiry_date', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Row 2: Physical Bill Rates & Pricing Verification */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/80">
                    {/* 5. Purchase Unit Rate (₹) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex items-center justify-between">
                        <span>Unit Rate (₹) *</span>
                        <span className="text-[8px] text-indigo-600 font-bold">Physical Bill</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-bold font-mono">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.purchase_price}
                          onChange={(e) => {
                            handleItemChange(idx, 'purchase_price', e.target.value);
                            if (errors[`item_${idx}_purchase_price`]) {
                              setErrors((prev) => ({ ...prev, [`item_${idx}_purchase_price`]: null }));
                            }
                          }}
                          placeholder="0.00"
                          className={`w-full bg-white border rounded-xl pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none font-mono ${
                            errors[`item_${idx}_purchase_price`] ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-indigo-600'
                          }`}
                        />
                      </div>
                      {errors[`item_${idx}_purchase_price`] && (
                        <p className="text-[9px] font-bold text-rose-500 leading-tight">{errors[`item_${idx}_purchase_price`]}</p>
                      )}
                    </div>

                    {/* 6. GST (%) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-indigo-900 uppercase tracking-wider block">
                        GST (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={item.gst}
                          onChange={(e) => handleItemChange(idx, 'gst', e.target.value)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 font-mono text-center"
                        />
                        <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs font-bold">%</span>
                      </div>
                    </div>

                    {/* 7. Batch MRP */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>MRP (₹) *</span>
                        <span className="text-[8px] text-indigo-600 font-bold">FIFO</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.mrp}
                        onChange={(e) => {
                          handleItemChange(idx, 'mrp', e.target.value);
                          if (errors[`item_${idx}_mrp`]) {
                            setErrors((prev) => ({ ...prev, [`item_${idx}_mrp`]: null }));
                          }
                        }}
                        placeholder="0.00"
                        className={`w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none font-mono ${
                          errors[`item_${idx}_mrp`] ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-indigo-600'
                        }`}
                      />
                      {errors[`item_${idx}_mrp`] && (
                        <p className="text-[9px] font-bold text-rose-500 leading-tight">{errors[`item_${idx}_mrp`]}</p>
                      )}
                    </div>

                    {/* 8. Selling Price */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Selling Price (₹) *</span>
                        <span className="text-[8px] text-emerald-600 font-bold">Store Price</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.selling_price}
                        onChange={(e) => {
                          handleItemChange(idx, 'selling_price', e.target.value);
                          if (errors[`item_${idx}_selling_price`]) {
                            setErrors((prev) => ({ ...prev, [`item_${idx}_selling_price`]: null }));
                          }
                        }}
                        placeholder="0.00"
                        className={`w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-700 focus:outline-none font-mono ${
                          errors[`item_${idx}_selling_price`] ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-emerald-600'
                        }`}
                      />
                      {errors[`item_${idx}_selling_price`] && (
                        <p className="text-[9px] font-bold text-rose-500 leading-tight">{errors[`item_${idx}_selling_price`]}</p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Real-time Calculation & Settlement Strip for Item */}
                {(() => {
                  const accepted = Math.max(0, rec - dam);
                  const cost = Number(item.purchase_price) || 0;
                  const gstP = Number(item.gst) || 0;
                  const costWithGst = cost * (1 + gstP / 100);
                  const payable = accepted * costWithGst;
                  const deduction = dam * costWithGst;
                  const sellingP = Number(item.selling_price) || 0;
                  const marginP = sellingP > 0 && cost > 0
                    ? (((sellingP - cost) / sellingP) * 100).toFixed(1)
                    : null;

                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/60 text-[11px] font-semibold">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                          Net Stock Inward: <strong className="font-mono">{accepted}</strong> {item.unit || 'units'}
                        </span>
                        {dam > 0 && (
                          <span className="text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200 font-bold">
                            Damaged: <strong className="font-mono">{dam}</strong> {item.unit || 'units'}
                          </span>
                        )}
                        {marginP !== null && (
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                            Number(marginP) >= 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            Margin: {marginP}%
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-right">
                        {cost > 0 && (
                          <span className="text-slate-500 text-[10px]">
                            Cost/Unit: ₹{cost.toFixed(2)} {gstP > 0 ? `(+${gstP}% GST = ₹${costWithGst.toFixed(2)})` : ''}
                          </span>
                        )}
                        {dam > 0 && (
                          <span className="text-rose-600">
                            Damaged Deduction: <strong className="font-mono">-₹{deduction.toFixed(2)}</strong>
                          </span>
                        )}
                        <span className="text-slate-700">
                          Line Payable: <strong className="text-slate-900 font-mono">₹{payable.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })}
        </div>
      </div>

      {/* CHECKBOX TRIGGER FOR MISSING & SHORTAGE SECTION AT THE END */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 shadow-2xs">
        <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={reportMissingItems}
            onChange={(e) => setReportMissingItems(e.target.checked)}
            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 bg-white cursor-pointer mt-0.5 sm:mt-0"
          />
          <div>
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 stroke-[2.2]" />
              Report Missing &amp; Shortage Items in Shipment
            </span>
            <p className="text-[11px] font-semibold text-amber-700/90 mt-0.5">
              Enable this option if supplier delivered fewer items than ordered to view and verify missing items debit report.
            </p>
          </div>
        </label>
      </div>

      {/* DEDICATED MISSING ITEMS & SUPPLIER SHORTAGE REPORT SECTION (SHOWN ONLY IF CHECKBOX IS CHECKED) */}
      {reportMissingItems && (
        <div className="rounded-2xl p-5 border border-amber-200 bg-amber-50/60 shadow-2xs space-y-3.5 transition-all">
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                <ShieldExclamationIcon className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Missing Items &amp; Supplier Shortage Report
                </h4>
                <p className="text-[11px] font-semibold text-slate-500">
                  Verify unfulfilled purchase order items and calculate vendor debit shortage claims
                </p>
              </div>
            </div>

            {missingList.length > 0 ? (
              <span className="px-3 py-1 bg-amber-600 text-white font-extrabold rounded-full text-[11px] shadow-2xs">
                {totalMissingUnits} Units Shortage (₹{totalMissingCost.toFixed(2)})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-[11px] font-bold border border-emerald-200">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                Zero Missing Items
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-100/70 text-[10px] font-black text-amber-900 uppercase tracking-wider border-b border-amber-200">
                    <th className="py-2.5 px-3.5">#</th>
                    <th className="py-2.5 px-3.5">Short Product Name</th>
                    <th className="py-2.5 px-3.5 text-center">Remaining PO Qty</th>
                    <th className="py-2.5 px-3.5 text-center">Delivered Qty</th>
                    <th className="py-2.5 px-3.5 text-center">Missing / Short Qty</th>
                    <th className="py-2.5 px-3.5 text-right">Unit Cost (incl Tax)</th>
                    <th className="py-2.5 px-3.5 text-right">Total Shortage Claim (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 font-semibold text-slate-800">
                  {formData.items.map((m, idx) => {
                    const remaining = m.ordered_quantity - m.previously_received;
                    const rec = m.quantity_received === '' ? 0 : Number(m.quantity_received) || 0;
                    const autoMissing = Math.max(0, remaining - rec);
                    const missing = m.quantity_missing !== '' ? Number(m.quantity_missing) || 0 : autoMissing;
                    const costWithGst = (Number(m.purchase_price) || 0) * (1 + (Number(m.gst) || 0) / 100);
                    const shortageVal = missing * costWithGst;

                    return (
                      <tr key={idx} className={missing > 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50/40'}>
                        <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3.5 font-extrabold text-slate-900">{m.name}</td>
                        <td className="py-2.5 px-3.5 text-center font-mono text-slate-600">{remaining}</td>
                        <td className="py-2.5 px-3.5 text-center font-mono text-emerald-700">{rec}</td>
                        <td className="py-2.5 px-3.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={m.quantity_missing !== '' ? m.quantity_missing : (autoMissing > 0 ? autoMissing : '')}
                            onChange={(e) => handleItemChange(idx, 'quantity_missing', e.target.value)}
                            placeholder="0"
                            className="w-16 bg-amber-100/80 border border-amber-300 rounded-lg px-2 py-1 text-center font-mono font-black text-amber-900 focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">₹{costWithGst.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-black text-amber-900">
                          ₹{shortageVal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {missingList.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-amber-900 bg-amber-100/60 p-3 rounded-xl border border-amber-200">
                <span className="flex items-center gap-1.5">
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-700" />
                  Shortage details will be automatically logged into Supplier Delivery Verification Notes.
                </span>
                <span>
                  Total Vendor Shortage Deduction: <strong className="font-mono text-sm font-black">₹{totalMissingCost.toFixed(2)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL PAYMENT SETTLEMENT RULES CARD */}
      <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-2.5">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <CurrencyRupeeIcon className="w-4 h-4 text-emerald-600 stroke-[2.2]" />
          Full Payment &amp; Shortage Adjustment Rules
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Checkbox 1: Include Damaged & Defective Goods in Payment */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-rose-300 transition-all select-none shadow-2xs">
            <input
              type="checkbox"
              checked={includeDamagedPayment}
              onChange={(e) => setIncludeDamagedPayment(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 bg-white cursor-pointer mt-0.5"
            />
            <div>
              <span className="text-xs font-black text-slate-900 block">
                Full Payment Done for Damaged &amp; Defective Items
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                Damaged items cost will NOT be deducted from vendor bill.
              </span>
            </div>
          </label>

          {/* Checkbox 2: Include Missing & Shortage Goods in Payment */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-amber-300 transition-all select-none shadow-2xs">
            <input
              type="checkbox"
              checked={includeMissingPayment}
              onChange={(e) => setIncludeMissingPayment(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 bg-white cursor-pointer mt-0.5"
            />
            <div>
              <span className="text-xs font-black text-slate-900 block">
                Full Payment Done for Missing &amp; Shortage Items
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                Missing items cost will NOT be deducted from vendor bill.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Financial & Stock Settlement Summary Bar */}
      {(() => {
        let totalReceivedQty = 0;
        let totalDamagedQty = 0;
        let totalAcceptedQty = 0;
        let totalDamagedDeductionCost = 0;
        let totalNetPayableCost = 0;

        formData.items.forEach((item) => {
          const rec = item.quantity_received === '' ? 0 : Number(item.quantity_received) || 0;
          const dam = item.quantity_damaged === '' ? 0 : Number(item.quantity_damaged) || 0;
          const remaining = item.ordered_quantity - item.previously_received;
          const missing = reportMissingItems
            ? (item.quantity_missing !== '' ? Number(item.quantity_missing) || 0 : Math.max(0, remaining - rec))
            : 0;

          const accepted = Math.max(0, rec - dam);
          const purchasePrice = Number(item.purchase_price) || 0;
          const gstRate = Number(item.gst) || 0;
          const unitWithGst = purchasePrice * (1 + gstRate / 100);

          totalReceivedQty += rec;
          totalDamagedQty += dam;
          totalAcceptedQty += accepted;

          let itemPayableQty = accepted;
          if (includeDamagedPayment) itemPayableQty += dam;
          if (includeMissingPayment) itemPayableQty += missing;

          totalDamagedDeductionCost += dam * unitWithGst;
          totalNetPayableCost += itemPayableQty * unitWithGst;
        });

        return (
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">⚖️</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                    Supplier Settlement &amp; Stock Verification Summary
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Damaged and missing stock is excluded from inventory. Supplier payment is calculated on your full payment selections.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                  Net Supplier Payable
                </span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  ₹{totalNetPayableCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Delivered Qty</span>
                <span className="text-base font-black text-slate-200 font-mono">{totalReceivedQty}</span>
              </div>
              <div className="bg-rose-950/40 rounded-xl p-3 border border-rose-800/50">
                <span className="text-[9px] font-black uppercase tracking-wider text-rose-300 block">Damaged &amp; Defective</span>
                <span className="text-base font-black text-rose-400 font-mono">{totalDamagedQty}</span>
                <span className="text-[9px] block mt-0.5 font-mono font-bold">
                  {includeDamagedPayment ? (
                    <span className="text-emerald-400">Payment Included</span>
                  ) : (
                    <span className="text-rose-300">-₹{totalDamagedDeductionCost.toFixed(2)} Excluded</span>
                  )}
                </span>
              </div>
              <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/50">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 block">Missing Qty (Shortage)</span>
                <span className="text-base font-black text-amber-400 font-mono">{totalMissingUnits}</span>
                <span className="text-[9px] block mt-0.5 font-mono font-bold">
                  {includeMissingPayment ? (
                    <span className="text-emerald-400">Payment Included</span>
                  ) : (
                    <span className="text-amber-300">-₹{totalMissingCost.toFixed(2)} Excluded</span>
                  )}
                </span>
              </div>
              <div className="bg-emerald-950/40 rounded-xl p-3 border border-emerald-800/50">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 block">Net Accepted (Inward)</span>
                <span className="text-base font-black text-emerald-400 font-mono">{totalAcceptedQty}</span>
                <span className="text-[9px] text-emerald-300 block mt-0.5">Added to stock</span>
              </div>
            </div>

            {/* Shipment Fulfillment & PO Status Indicator */}
            <div className="pt-3 border-t border-slate-700/80 mt-2">
              {deliveryStatusInfo.isFullStockArrived ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-black text-white block">
                        Full Stock Arrived (100% Fulfilled)
                      </span>
                      <span className="text-[10px] text-emerald-300 block">
                        All ordered units received without shortage. Purchase Order will automatically transition to <strong>Completed</strong>.
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white rounded-lg shadow-xs">
                    <LockClosedIcon className="w-3.5 h-3.5" />
                    Auto-Complete PO
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-950/70 border border-amber-500/50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-black text-amber-300 block">
                        Shipment Incomplete — {deliveryStatusInfo.totalPendingShortageUnits} Units Missing / Pending
                      </span>
                      <span className="text-[10px] text-amber-200/90 block">
                        PO remains open in <strong>"Partially Pending"</strong> status. You can inward the missing stock when the next delivery arrives.
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white rounded-lg shadow-xs">
                    <LockOpenIcon className="w-3.5 h-3.5" />
                    Stays Open (Partially Pending)
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Notes / Comments */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <DocumentTextIcon className="w-4 h-4 text-indigo-500" />
          Delivery Verification Notes &amp; Shortage Logs
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Log notes about delivery conditions, damaged item details, or vendor shortage claims..."
          rows={3}
          className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-600 resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
        >
          <CheckCircleIcon className="w-4 h-4" />
          Save Purchase Invoice / GRN
        </button>
      </div>

    </form>
  );
};

export default GRNForm;


