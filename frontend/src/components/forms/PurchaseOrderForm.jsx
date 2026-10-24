import { useState, useEffect, useMemo, useRef } from 'react';
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
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { vendorsAPI, productsAPI, categoriesAPI } from '../../services/api';

const normProduct = (p) => ({
  id: p.id,
  name: p.name,
  brand: p.brand || p.brand_name || '',
  measurement_value: p.measurement_value || '',
  barcode: p.barcode || p.bar_code || '',
  category: p.category_name || p.category || 'General',
  category_id: p.category_id || p.categoryId || '',
  purchasePrice: Number(p.purchase_price ?? p.purchasePrice ?? 0),
  unit: p.unit || 'Pcs',
  gst: Number(p.gst ?? 0),
  total_stock: Number(p.total_stock ?? p.currentStock ?? p.quantity ?? 0),
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
  const [errors, setErrors] = useState({});

  // Tree Dropdown interactive states
  const dropdownRef = useRef(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [productSearch, setProductSearch] = useState('');

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Group filtered products by product name (brand) for tree structure
  const groupedProducts = useMemo(() => {
    const groups = {};
    filteredProducts.forEach((p) => {
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
    return Object.values(groups);
  }, [filteredProducts]);

  const selectedProductObj = useMemo(() => {
    return dbProducts.find((p) => String(p.id) === String(selectedProduct));
  }, [dbProducts, selectedProduct]);

  const toggleGroupCollapse = (key, e) => {
    if (e) e.stopPropagation();
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleAllGroups = () => {
    const allCollapsed = groupedProducts.every((g) => collapsedGroups[g.key]);
    if (allCollapsed) {
      setCollapsedGroups({}); // expand all
    } else {
      const all = {};
      groupedProducts.forEach((g) => { all[g.key] = true; });
      setCollapsedGroups(all); // collapse all
    }
  };

  const handleSelectVariant = (variantId) => {
    if (String(selectedProduct) === String(variantId)) {
      // Toggle off / Unselect
      setSelectedProduct('');
    } else {
      setSelectedProduct(variantId);
      setIsProductDropdownOpen(false);
      if (errors.items) setErrors((prev) => ({ ...prev, items: null }));
    }
  };

  const searchedGroupedProducts = useMemo(() => {
    if (!productSearch.trim()) return groupedProducts;
    const q = productSearch.toLowerCase().trim();
    return groupedProducts.filter((grp) => {
      const matchGroup = grp.displayName.toLowerCase().includes(q);
      const matchVariant = grp.variants.some(
        (v) =>
          (v.measurement_value && v.measurement_value.toLowerCase().includes(q)) ||
          (v.barcode && v.barcode.toLowerCase().includes(q)) ||
          v.name.toLowerCase().includes(q)
      );
      return matchGroup || matchVariant;
    });
  }, [groupedProducts, productSearch]);

  const handleCategoryChange = (catVal) => {
    setSelectedCategory(catVal);
    setSelectedProduct('');
    setProductSearch('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setErrors((prev) => ({ ...prev, items: 'Please select a product first.' }));
      return;
    }

    const product = dbProducts.find((p) => String(p.id) === String(selectedProduct));
    if (!product) return;

    const qty = Math.max(1, Number(quantity) || 1);

    // Clear item errors
    setErrors((prev) => ({ ...prev, items: null }));

    // Check duplicate
    const existsIndex = formData.items.findIndex(
      (item) => String(item.product_id) === String(selectedProduct)
    );

    if (existsIndex > -1) {
      const updated = [...formData.items];
      updated[existsIndex].quantity += qty;
      setFormData({ ...formData, items: updated });
    } else {
      const newItem = {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        measurement_value: product.measurement_value,
        barcode: product.barcode,
        category: product.category,
        quantity: qty,
        purchase_price: 0,
        gst: 0,
        unit: product.unit || 'Pcs',
        total: 0,
      };
      setFormData({ ...formData, items: [...formData.items, newItem] });
    }

    // Reset item input
    setSelectedProduct('');
    setQuantity('');
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    const item = { ...updated[index] };

    if (field === 'quantity') {
      item.quantity = Math.max(1, Number(value) || 1);
    }

    updated[index] = item;
    setFormData({ ...formData, items: updated });
  };

  const handleRemoveItem = (index) => {
    const updated = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updated });
  };

  const totalOrderedUnits = formData.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

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
      subtotal: 0,
      discount: 0,
      gst_amount: 0,
      total: 0,
      notes: formData.notes,
      items: formData.items.map((item) => ({
        ...item,
        purchase_price: 0,
        gst: 0,
        total: 0,
      })),
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
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Select Products &amp; Order Quantities
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Purchase rates &amp; GST are recorded upon delivery and invoice verification (GRN).
              </p>
            </div>
          </div>
          {filteredProducts.length > 0 && (
            <span className="text-[11px] font-bold text-slate-400">
              {filteredProducts.length} items available
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
          
          {/* 1. Category Filter */}
          <div className="sm:col-span-4 space-y-1.5">
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

          {/* 2. Product Selection (Expandable Tree with Scrollbar) */}
          <div className="sm:col-span-5 space-y-1.5 relative" ref={dropdownRef}>
            <label className="text-[11px] font-extrabold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <TagIcon className="w-3.5 h-3.5 text-indigo-500" />
                Product Name <span className="text-rose-500">*</span>
              </span>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => setSelectedProduct('')}
                  className="text-[10px] text-slate-400 hover:text-rose-600 font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <XMarkIcon className="w-3 h-3" /> Clear
                </button>
              )}
            </label>

            {/* Custom Trigger Button */}
            <button
              type="button"
              onClick={() => setIsProductDropdownOpen((prev) => !prev)}
              className="w-full bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all flex items-center justify-between cursor-pointer shadow-2xs text-left"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedProductObj ? (
                  <span className="truncate text-slate-900 font-extrabold flex items-center gap-1.5">
                    <span>
                      {selectedProductObj.brand ? `${selectedProductObj.name} (${selectedProductObj.brand})` : selectedProductObj.name}
                    </span>
                    <span className="text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                      {selectedProductObj.measurement_value || selectedProductObj.unit}
                    </span>
                    {Number(selectedProductObj.total_stock || 0) <= 0 ? (
                      <span className="text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                        Out of Stock
                      </span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                        Stock: {selectedProductObj.total_stock}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">
                    {selectedCategory && filteredProducts.length === 0
                      ? '-- No Products in Category --'
                      : '-- Choose Product to Order --'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {selectedProduct && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduct('');
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Unselect Product"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </span>
                )}
                <ChevronDownIcon
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isProductDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />
              </div>
            </button>

            {/* Tree Dropdown Menu Popover */}
            {isProductDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
                
                {/* Search & Bulk Expand Header */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/80 space-y-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product name, brand or weight..."
                      className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                    <span>
                      {searchedGroupedProducts.length} Product Group{searchedGroupedProducts.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAllGroups}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                    >
                      {groupedProducts.every((g) => collapsedGroups[g.key]) ? 'Expand All' : 'Collapse All'}
                    </button>
                  </div>
                </div>

                {/* Selected Product Banner with Unselect Action */}
                {selectedProductObj && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase font-extrabold text-indigo-700 bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                        Selected
                      </span>
                      <span className="font-extrabold text-indigo-950 truncate">
                        {selectedProductObj.name} {selectedProductObj.brand ? `(${selectedProductObj.brand})` : ''} - {selectedProductObj.measurement_value || selectedProductObj.unit}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct('')}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors shrink-0 ml-2"
                      title="Unselect product"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                      Unselect
                    </button>
                  </div>
                )}

                {/* Scrollable Tree List */}
                <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                  {searchedGroupedProducts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-medium text-xs">
                      No matching products found.
                    </div>
                  ) : (
                    searchedGroupedProducts.map((grp) => {
                      const isCollapsed = Boolean(collapsedGroups[grp.key]);
                      const hasSelectedVariant = grp.variants.some((v) => String(v.id) === String(selectedProduct));

                      return (
                        <div
                          key={grp.key}
                          className={`border rounded-xl overflow-hidden transition-colors ${
                            hasSelectedVariant
                              ? 'border-indigo-300 bg-indigo-50/20 shadow-xs'
                              : 'border-slate-200/80 bg-white shadow-2xs'
                          }`}
                        >
                          {/* Parent Product Group Header (Clickable open/close toggle for all products) */}
                          <div
                            onClick={(e) => toggleGroupCollapse(grp.key, e)}
                            className={`flex items-center justify-between px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                              isCollapsed
                                ? 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                                : 'bg-indigo-50/50 hover:bg-indigo-50/70 text-indigo-950'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => toggleGroupCollapse(grp.key, e)}
                                className="p-1 rounded-md text-slate-500 hover:text-indigo-700 hover:bg-indigo-100/60 transition-colors"
                                title={isCollapsed ? 'Open (Expand)' : 'Close (Collapse)'}
                              >
                                {isCollapsed ? (
                                  <ChevronRightIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                ) : (
                                  <ChevronDownIcon className="w-3.5 h-3.5 stroke-[2.5] text-indigo-600" />
                                )}
                              </button>

                              <span className="font-extrabold text-slate-900 tracking-tight truncate">
                                {grp.displayName}
                              </span>

                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100/70 text-indigo-700 border border-indigo-200 shrink-0">
                                {grp.variants.length} {grp.variants.length === 1 ? 'Weight' : 'Weights'}
                              </span>

                              {hasSelectedVariant && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                  Selected
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 text-slate-400 text-[11px] font-semibold">
                              <span>{isCollapsed ? 'Open' : 'Close'}</span>
                            </div>
                          </div>

                          {/* Child Weight Variants (Visible when group is open/expanded) */}
                          {!isCollapsed && (
                            <div className="divide-y divide-slate-100 bg-white">
                              {grp.variants.map((v, idx) => {
                                const isLast = idx === grp.variants.length - 1;
                                const isSelected = String(selectedProduct) === String(v.id);
                                const stockQty = Number(v.total_stock || 0);

                                return (
                                  <div
                                    key={v.id}
                                    onClick={() => handleSelectVariant(v.id)}
                                    className={`flex items-center justify-between px-3 py-2 pl-7 text-xs font-semibold cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-indigo-600 text-white font-bold'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-mono text-xs select-none ${
                                          isSelected ? 'text-indigo-200' : 'text-slate-400'
                                        }`}
                                      >
                                        {grp.variants.length > 1 ? (isLast ? '└──' : '├──') : '└──'}
                                      </span>

                                      <span
                                        className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                                          isSelected
                                            ? 'bg-white/20 text-white border-white/30'
                                            : 'bg-amber-50 text-amber-950 border-amber-200'
                                        }`}
                                      >
                                        Weight: <strong>{v.measurement_value || v.unit || 'Standard'}</strong>
                                      </span>

                                      {v.barcode && (
                                        <span
                                          className={`text-[10px] font-mono ${
                                            isSelected ? 'text-indigo-200' : 'text-slate-400'
                                          }`}
                                        >
                                          ({v.barcode})
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {stockQty <= 0 ? (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                            isSelected
                                              ? 'bg-white/20 text-white border-white/30'
                                              : 'bg-rose-50 text-rose-700 border-rose-200'
                                          }`}
                                        >
                                          Out of Stock
                                        </span>
                                      ) : (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                            isSelected
                                              ? 'bg-white/20 text-white border-white/30'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          }`}
                                        >
                                          Stock: {stockQty}
                                        </span>
                                      )}

                                      {isSelected ? (
                                        <div className="flex items-center gap-1 bg-white/25 px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white">
                                          <CheckCircleIcon className="w-3.5 h-3.5" />
                                          <span>Click to unselect</span>
                                        </div>
                                      ) : null}
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

          {/* 3. Quantity */}
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

          {/* 4. Add Button */}
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
            <p className="text-[11px] text-slate-400">Select category, product, and quantity above to create order indent lines.</p>
          </div>
        ) : (
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <th className="py-3 px-4 text-center">#</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4 text-center">Category</th>
                  <th className="py-3 px-4 text-center">Ordered Qty</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-center">Pricing Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {formData.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-900">
                          {item.brand ? `${item.name} (${item.brand})` : item.name}
                        </p>
                        {item.measurement_value && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200">
                            Weight: {item.measurement_value}
                          </span>
                        )}
                      </div>
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
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-bold text-slate-500">{item.unit || 'Pcs'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-lg text-[10px] font-bold">
                        Rate &amp; GST on Delivery
                      </span>
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

      {/* 3. Bottom Section: Notes & Order Indent Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* Left: Notes */}
        <div className="md:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <DocumentTextIcon className="w-4 h-4 text-indigo-500" />
            Supplier Instructions &amp; Terms (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add special instructions, delivery slot terms, or supplier batch requirements..."
            rows={4}
            className="w-full bg-slate-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
          />
        </div>

        {/* Right: Order Indent Summary */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md space-y-3.5">
          <div className="flex items-center justify-between border-b border-indigo-800/60 pb-2.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <ShoppingBagIcon className="w-4 h-4 text-indigo-400" />
              Order Indent Summary
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-900/80 text-indigo-200 border border-indigo-700 rounded-full">
              {formData.items.length} Product Lines
            </span>
          </div>

          <div className="space-y-2.5 text-xs font-semibold text-slate-300">
            <div className="flex justify-between items-center">
              <span>Total Distinct Products:</span>
              <span className="font-mono font-bold text-white">{formData.items.length}</span>
            </div>

            <div className="flex justify-between items-center">
              <span>Total Units to Order:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{totalOrderedUnits} Units</span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-xl p-2.5">
              <span>Billing Status:</span>
              <span className="font-bold text-amber-200 text-right">Pending Bill Verification (GRN)</span>
            </div>
          </div>

          <div className="border-t border-indigo-800/80 pt-2.5 text-[10px] text-slate-400 leading-relaxed">
            Final purchase unit rates, GST %, selling prices, and MRP will be verified and added when goods arrive at the store.
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


