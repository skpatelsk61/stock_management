import { useState, useEffect } from 'react';
import {
  UserGroupIcon,
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  TagIcon,
  ShoppingBagIcon,
  FunnelIcon,
  CurrencyRupeeIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { vendorsAPI, productsAPI, categoriesAPI } from '../../services/api';

const normProduct = (p) => ({
  id: p.id,
  name: p.name,
  barcode: p.barcode || p.bar_code || '',
  category: p.category_name || p.category || 'General',
  category_id: p.category_id || p.categoryId || '',
  purchasePrice: Number(p.purchase_price ?? p.purchasePrice ?? 0),
  unit: p.unit || 'Pcs',
  gst: Number(p.gst ?? 0),
});

const PurchaseOrderForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    vendorId: '',
    warehouseId: '1', // Default Warehouse
    date: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    items: [],
    notes: '',
  });

  const [dbVendors, setDbVendors] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [itemGst, setItemGst] = useState(0);
  const [manualGst, setManualGst] = useState('');
  const [errors, setErrors] = useState({});

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
        console.error('Failed to load vendors/products/categories for purchase order form:', err);
        setDbVendors([]);
        setDbProducts([]);
        setDbCategories([]);
      }
    };
    loadFormData();
  }, []);

  // Selected Vendor Object
  const selectedVendorObj = dbVendors.find((v) => String(v.id) === String(formData.vendorId));

  // Selected Category Object
  const selectedCatObj = dbCategories.find(
    (c) => String(c.id) === String(selectedCategory) || c.name === selectedCategory
  );

  // Products filtered by selected Category
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
    setItemGst(0);
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setErrors((prev) => ({ ...prev, items: 'Please select a product first.' }));
      return;
    }

    const product = dbProducts.find((p) => String(p.id) === String(selectedProduct));
    if (!product) return;

    if (customPrice === '' || isNaN(parseFloat(customPrice)) || parseFloat(customPrice) < 0) {
      setErrors((prev) => ({ ...prev, items: 'Please enter a valid purchase price (₹).' }));
      return;
    }

    const price = parseFloat(customPrice);
    const qty = Number(quantity) || 1;
    const gstRate = parseFloat(itemGst) >= 0 ? parseFloat(itemGst) : 0;

    // Clear item errors
    setErrors((prev) => ({ ...prev, items: null }));

    // Check duplicate
    const existsIndex = formData.items.findIndex(
      (item) => String(item.product_id) === String(selectedProduct)
    );

    if (existsIndex > -1) {
      const updated = [...formData.items];
      updated[existsIndex].quantity += qty;
      updated[existsIndex].gst = gstRate;
      updated[existsIndex].purchase_price = price;
      updated[existsIndex].total = updated[existsIndex].quantity * updated[existsIndex].purchase_price * (1 + gstRate / 100);
      setFormData({ ...formData, items: updated });
    } else {
      const total = price * qty * (1 + gstRate / 100);
      const newItem = {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        quantity: qty,
        purchase_price: price,
        gst: gstRate,
        unit: product.unit,
        total,
      };
      setFormData({ ...formData, items: [...formData.items, newItem] });
    }

    // Reset item input
    setSelectedProduct('');
    setQuantity('');
    setCustomPrice('');
    setItemGst(0);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    const item = { ...updated[index] };

    if (field === 'quantity') {
      item.quantity = Math.max(1, Number(value) || 1);
    } else if (field === 'purchase_price') {
      const p = parseFloat(value);
      item.purchase_price = isNaN(p) || p < 0 ? 0 : p;
    } else if (field === 'gst') {
      const g = parseFloat(value);
      item.gst = isNaN(g) || g < 0 ? 0 : g;
    }

    item.total = item.purchase_price * item.quantity * (1 + (item.gst || 0) / 100);
    updated[index] = item;
    setFormData({ ...formData, items: updated });
  };

  const handleRemoveItem = (index) => {
    const updated = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updated });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let autoGstAmount = 0;

    formData.items.forEach((item) => {
      const base = Number(item.purchase_price || 0) * Number(item.quantity || 0);
      subtotal += base;
      autoGstAmount += base * ((Number(item.gst) || 0) / 100);
    });

    const gstAmount = manualGst !== '' && !isNaN(parseFloat(manualGst))
      ? Math.max(0, parseFloat(manualGst))
      : autoGstAmount;

    const total = subtotal + gstAmount;

    return {
      subtotal,
      autoGstAmount,
      gstAmount,
      total,
    };
  };

  const { subtotal, autoGstAmount, gstAmount, total } = calculateTotals();

  const handleProductSelect = (prodId) => {
    setSelectedProduct(prodId);
    const p = dbProducts.find((x) => String(x.id) === String(prodId));
    if (p) {
      setCustomPrice(p.purchasePrice > 0 ? p.purchasePrice.toString() : '');
      setItemGst(p.gst !== undefined && p.gst !== null ? p.gst : 0);
    } else {
      setCustomPrice('');
      setItemGst(0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const tempErrors = {};
    if (!formData.vendorId) tempErrors.vendorId = 'Please select a supplier vendor';
    if (formData.items.length === 0) tempErrors.items = 'Please add at least one item to order';

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    onSubmit({
      vendor_id: Number(formData.vendorId),
      warehouse_id: Number(formData.warehouseId),
      date: formData.date,
      expected_delivery_date: formData.expectedDeliveryDate || null,
      subtotal,
      discount: 0,
      gst_amount: gstAmount,
      total,
      notes: formData.notes,
      items: formData.items,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[82vh] overflow-y-auto px-1 pr-3 select-none">
      
      {/* 1. Header Information Section */}
      <div className="bg-gradient-to-br from-slate-50 via-slate-50/80 to-indigo-50/30 border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <UserGroupIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Supplier & Delivery Metadata</h3>
              <p className="text-[11px] font-semibold text-slate-500">Configure vendor partner and estimated timeline</p>
            </div>
          </div>
          {selectedVendorObj && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[11px] font-bold">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
              Supplier Verified
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          
          {/* Supplier Dropdown */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserGroupIcon className="w-4 h-4 text-indigo-500" />
                Select Vendor / Supplier <span className="text-rose-500">*</span>
              </span>
            </label>
            <select
              value={formData.vendorId}
              onChange={(e) => {
                setFormData({ ...formData, vendorId: e.target.value });
                if (errors.vendorId) setErrors((prev) => ({ ...prev, vendorId: null }));
              }}
              className="w-full bg-white border border-slate-300 hover:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
            >
              <option value="">-- Choose Supplier Partner --</option>
              {dbVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.company_name ? `(${v.company_name})` : ''}
                </option>
              ))}
            </select>
            {errors.vendorId && (
              <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                <InformationCircleIcon className="w-3.5 h-3.5" />
                {errors.vendorId}
              </p>
            )}

            {/* Selected Supplier Info Card */}
            {selectedVendorObj && (
              <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-semibold shadow-2xs">
                {selectedVendorObj.company_name && (
                  <div><span className="text-slate-400 font-normal">Company:</span> <strong className="text-slate-900">{selectedVendorObj.company_name}</strong></div>
                )}
                {selectedVendorObj.phone && (
                  <div><span className="text-slate-400 font-normal">Phone:</span> <strong className="text-slate-900 font-mono">{selectedVendorObj.phone}</strong></div>
                )}
                {selectedVendorObj.gstin && (
                  <div><span className="text-slate-400 font-normal">GSTIN:</span> <strong className="text-indigo-700 font-mono">{selectedVendorObj.gstin}</strong></div>
                )}
              </div>
            )}
          </div>

          {/* Order Date */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              Order Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-white border border-slate-300 hover:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
            />
          </div>

          {/* Expected Delivery Date */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-emerald-500" />
              Expected Delivery
            </label>
            <input
              type="date"
              value={formData.expectedDeliveryDate}
              onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
              className="w-full bg-white border border-slate-300 hover:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
            />
          </div>

        </div>
      </div>

      {/* 2. Product Line Item Addition Box */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingBagIcon className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Add Products & Pricing Lines
            </h3>
          </div>
          {filteredProducts.length > 0 && (
            <span className="text-[11px] font-bold text-slate-400">
              {filteredProducts.length} items available
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
          
          {/* 1. Category Filter */}
          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
              <FunnelIcon className="w-3.5 h-3.5 text-indigo-500" />
              Product Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
            >
              <option value="">-- All Categories --</option>
              {dbCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Product Selection */}
          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
              <TagIcon className="w-3.5 h-3.5 text-indigo-500" />
              Product Name <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
            >
              <option value="">
                {selectedCategory && filteredProducts.length === 0
                  ? '-- No Products in Category --'
                  : '-- Choose Product --'}
              </option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.barcode ? `(${p.barcode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Purchase Price */}
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-700">
                Unit Rate (₹) <span className="text-rose-500">*</span>
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                value={customPrice}
                onChange={(e) => {
                  setCustomPrice(e.target.value);
                  if (errors.items) setErrors((prev) => ({ ...prev, items: null }));
                }}
                placeholder="0.00"
                className="w-full bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
            </div>
          </div>

          {/* 4. Quantity */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="w-full bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          {/* 5. GST % */}
          <div className="sm:col-span-1 space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700">GST %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={itemGst}
              onChange={(e) => setItemGst(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          {/* Add Button */}
          <div className="sm:col-span-1">
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4 stroke-[2.8]" />
              Add
            </button>
          </div>
        </div>

        {errors.items && (
          <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1">
            <InformationCircleIcon className="w-3.5 h-3.5" />
            {errors.items}
          </p>
        )}

        {/* Added Items Table */}
        {formData.items.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/40 space-y-2 mt-2">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBagIcon className="w-5 h-5 stroke-[2]" />
            </div>
            <p className="text-xs font-bold text-slate-600">No products added to this purchase order yet</p>
            <p className="text-[11px] text-slate-400">Select a category and product above to add order line items.</p>
          </div>
        ) : (
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <th className="py-3 px-4 text-center">#</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4 text-center">Category</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Rate</th>
                  <th className="py-3 px-4 text-center">GST %</th>
                  <th className="py-3 px-4 text-right">Total Line Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {formData.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      {item.barcode && (
                        <span className="text-[10px] font-semibold text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          SKU: {item.barcode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                        {item.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-14 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[10px] font-bold text-slate-400">{item.unit || 'Pcs'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.purchase_price}
                        onChange={(e) => handleItemChange(idx, 'purchase_price', e.target.value)}
                        className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.gst}
                        onChange={(e) => handleItemChange(idx, 'gst', e.target.value)}
                        className="w-12 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900 tabular-nums">
                      ₹{item.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all active:scale-90 cursor-pointer"
                        title="Remove item"
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

      {/* 3. Bottom Section: Notes & Summary Financial Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* Left: Notes */}
        <div className="md:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <DocumentTextIcon className="w-4 h-4 text-indigo-500" />
            Supplier Instructions & Terms (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add special instructions, delivery slot terms, or supplier batch requirements..."
            rows={4}
            className="w-full bg-slate-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
          />
        </div>

        {/* Right: Financial Totals Breakdown */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-800/60 pb-2.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <CurrencyRupeeIcon className="w-4 h-4 text-indigo-400" />
              Order Calculation
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-900/80 text-indigo-200 border border-indigo-700 rounded-full">
              {formData.items.length} Item Lines
            </span>
          </div>

          <div className="space-y-2 text-xs font-semibold text-slate-300">
            <div className="flex justify-between items-center">
              <span>Subtotal (Base Price):</span>
              <span className="font-mono font-bold text-white">₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-300">Tax / GST Amount:</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={manualGst !== '' ? manualGst : (autoGstAmount > 0 ? autoGstAmount.toFixed(2) : '0')}
                  onChange={(e) => setManualGst(e.target.value)}
                  placeholder="0.00"
                  className="w-24 bg-indigo-900/90 border border-indigo-700/80 rounded-lg px-2 py-1 text-right text-xs font-bold font-mono text-white focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-indigo-800/80 pt-3 flex justify-between items-center">
            <div>
              <div className="text-xs font-extrabold text-indigo-200">Estimated Total</div>
              <div className="text-[10px] text-slate-400">Inclusive of taxes</div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-emerald-400">
                ₹{total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Action Buttons Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
        >
          <SparklesIcon className="w-4 h-4 stroke-[2.2]" />
          Create Purchase Order
        </button>
      </div>

    </form>
  );
};

export default PurchaseOrderForm;


