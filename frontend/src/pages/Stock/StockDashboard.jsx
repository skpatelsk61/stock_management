import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
  CubeIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

// Import child components
import StockAdjustment from './StockAdjustment';
import StockDestroy from './StockDestroy';
import PurchaseOrderList from '../Purchase/PurchaseOrderList';
import Modal from '../../components/common/Modal';

import StatsCard from '../../components/common/StatsCard';
import { stockAPI } from '../../services/api';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchStockSummary, fetchStockAlerts } from '../../store/slices/stockSlice';
import { fetchProducts } from '../../store/slices/productSlice';

const StockDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  // Read stock data from shared Redux state
  const { stockSummary: reduxStockSummary } = useAppSelector((s) => s.stock);

  // Local mapped state derived from Redux data
  const [stockSummary, setStockSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbOffline, setDbOffline] = useState(false);

  // Filters state (for Current Stock tab)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Tree state: By default, all groups are open (keys not set to false evaluate to true)
  const [expandedGroups, setExpandedGroups] = useState({});

  // History modal state for inline stock history view
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    item: null,
    isGroup: false,
    parentGroup: null,
    variants: [],
    selectedVariantId: 'all',
    logs: [],
    loading: false
  });

  const openHistoryModal = async (target, isGroup = false, parentGroup = null) => {
    let variants = [];
    let selectedVariantId = 'all';

    if (isGroup) {
      variants = target.variants || [];
      selectedVariantId = 'all';
    } else {
      variants = parentGroup?.variants || [target];
      selectedVariantId = String(target.productId || target.id);
    }

    setHistoryModal({
      isOpen: true,
      item: target,
      isGroup,
      parentGroup,
      variants,
      selectedVariantId,
      logs: [],
      loading: true
    });

    try {
      const productIds = variants.map(v => v.productId || v.id).join(',');
      const res = await stockAPI.getLogs({ productId: productIds, limit: 200 });
      if (res && res.success) {
        setHistoryModal(prev => ({
          ...prev,
          logs: res.logs || [],
          loading: false
        }));
      } else {
        setHistoryModal(prev => ({ ...prev, logs: [], loading: false }));
      }
    } catch (err) {
      console.error('Error fetching stock history:', err);
      setHistoryModal(prev => ({ ...prev, logs: [], loading: false }));
    }
  };

  const closeHistoryModal = () => {
    setHistoryModal(prev => ({ ...prev, isOpen: false }));
  };

  // Filter logs for selected variant in modal
  const displayedHistoryLogs = useMemo(() => {
    if (!historyModal.logs || historyModal.logs.length === 0) return [];
    if (historyModal.selectedVariantId === 'all') return historyModal.logs;
    return historyModal.logs.filter(
      (log) => String(log.product_id) === String(historyModal.selectedVariantId)
    );
  }, [historyModal.logs, historyModal.selectedVariantId]);

  const activeSelectedVariant = useMemo(() => {
    if (historyModal.selectedVariantId === 'all') return null;
    return historyModal.variants.find(
      (v) => String(v.productId || v.id) === String(historyModal.selectedVariantId)
    );
  }, [historyModal.variants, historyModal.selectedVariantId]);

  const modalActiveStock = activeSelectedVariant
    ? activeSelectedVariant.currentStock
    : (historyModal.isGroup ? (historyModal.item?.totalStock ?? 0) : (historyModal.item?.currentStock ?? 0));

  const modalTotalInward = useMemo(() => {
    return displayedHistoryLogs
      .filter((l) => Number(l.quantity) > 0)
      .reduce((sum, l) => sum + Number(l.quantity), 0);
  }, [displayedHistoryLogs]);

  const modalTotalOutward = useMemo(() => {
    return displayedHistoryLogs
      .filter((l) => Number(l.quantity) < 0)
      .reduce((sum, l) => sum + Number(l.quantity), 0);
  }, [displayedHistoryLogs]);

  const getLogTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('in') || t.includes('purchase') || t.includes('increase')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (t.includes('out') || t.includes('sale') || t.includes('decrease')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (t.includes('destroy') || t.includes('damage')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (t.includes('adjust')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Map paths to active tabs
  const getTabFromPath = (path) => {
    if (path.includes('/stock/destroy')) return 'stock-destroy';
    if (path.includes('/stock/adjustment')) return 'stock-adjustment';
    if (path.includes('/purchase/orders') || path.includes('/purchase')) return 'purchase-order';
    return 'current-stock';
  };

  const activeTab = getTabFromPath(location.pathname);

  useEffect(() => {
    if (location.pathname.includes('/stock/returns')) {
      navigate('/dashboard/vendors?view=returns', { replace: true });
    }
    if (location.pathname.includes('/stock/history')) {
      navigate('/dashboard/stock', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleTabChange = (tabId) => {
    switch (tabId) {
      case 'stock-destroy':
        navigate('/dashboard/stock/destroy');
        break;
      case 'stock-adjustment':
        navigate('/dashboard/stock/adjustment');
        break;
      case 'purchase-order':
        navigate('/dashboard/purchase/orders');
        break;
      default:
        navigate('/dashboard/stock');
    }
  };

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const summaryRes = await stockAPI.getSummary();
      if (summaryRes.success) {
        // Map per product variant to preserve distinct pack sizes / measurement values
        const productMap = {};
        summaryRes.stock.forEach(s => {
          const key = s.product_id || s.id || s.product_name;
          const qty = Number(s.quantity || 0);
          const val = Number(s.stock_valuation || 0);
          const minStock = Number(s.min_stock || 0);

          if (!productMap[key]) {
            productMap[key] = {
              id: s.id,
              productId: s.product_id || s.id,
              name: s.product_name,
              brand: s.brand ? s.brand.trim() : '',
              measurement_value: s.measurement_value ? s.measurement_value.trim() : '',
              sku: s.barcode || s.sku || 'N/A',
              barcode: s.barcode || s.sku || 'N/A',
              unit: s.unit || 'Pcs',
              currentStock: qty,
              minimumStock: minStock,
              warehouse: s.warehouse_name || 'Main Storage',
              valuation: val,
              everPurchased: s.ever_purchased ? 1 : 0,
              outOfStockDate: s.out_of_stock_date || null
            };
          } else {
            productMap[key].currentStock += qty;
            productMap[key].valuation += val;
          }
        });

        const mapped = Object.values(productMap).filter(p => {
          if (p.currentStock > 0) return true;
          if (p.everPurchased === 0) return false;
          if (p.outOfStockDate) {
            const outTime = new Date(p.outOfStockDate).getTime();
            const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
            if (outTime < tenDaysAgo) return false;
          }
          return true;
        }).map(p => ({
          ...p,
          status: p.currentStock <= 0 ? 'Out Of Stock' : p.currentStock <= p.minimumStock ? 'Low Stock' : 'In Stock'
        }));

        setStockSummary(mapped);
      }
    } catch (err) {
      console.error('Stock APIs error:', err);
      setDbOffline(false);
      setStockSummary([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'current-stock') {
      fetchStockData();
    }
    const handleEventUpdate = () => {
      handleStockChanged();
    };
    window.addEventListener('stock-changed', handleEventUpdate);
    window.addEventListener('inventory-updated', handleEventUpdate);
    window.addEventListener('stock-transfer-updated', handleEventUpdate);
    window.addEventListener('focus', handleEventUpdate);
    return () => {
      window.removeEventListener('stock-changed', handleEventUpdate);
      window.removeEventListener('inventory-updated', handleEventUpdate);
      window.removeEventListener('stock-transfer-updated', handleEventUpdate);
      window.removeEventListener('focus', handleEventUpdate);
    };
  }, [activeTab]);

  // Called by any child tab after a stock-mutating operation
  // Dispatches Redux thunks so all subscribers update immediately
  const handleStockChanged = () => {
    dispatch(fetchStockSummary());
    dispatch(fetchStockAlerts());
    dispatch(fetchProducts());
    fetchStockData(); // also refresh local view
  };

  // Keep local stockSummary in sync with Redux when it changes from another source
  useEffect(() => {
    if (reduxStockSummary && reduxStockSummary.length > 0) {
      const productMap = {};
      reduxStockSummary.forEach(s => {
        const key = s.product_id || s.id || s.product_name;
        const qty = Number(s.quantity || 0);
        const val = Number(s.stock_valuation || 0);
        const minStock = Number(s.min_stock || 0);
        if (!productMap[key]) {
          productMap[key] = {
            id: s.id,
            productId: s.product_id || s.id,
            name: s.product_name,
            brand: s.brand ? s.brand.trim() : '',
            measurement_value: s.measurement_value ? s.measurement_value.trim() : '',
            sku: s.barcode || s.sku || 'N/A',
            barcode: s.barcode || s.sku || 'N/A',
            unit: s.unit || 'Pcs',
            currentStock: qty,
            minimumStock: minStock,
            warehouse: s.warehouse_name || 'Main Storage',
            valuation: val,
            everPurchased: s.ever_purchased ? 1 : 0,
            outOfStockDate: s.out_of_stock_date || null
          };
        } else {
          productMap[key].currentStock += qty;
          productMap[key].valuation += val;
        }
      });
      const mapped = Object.values(productMap).filter(p => {
        if (p.currentStock > 0) return true;
        if (p.everPurchased === 0) return false;
        if (p.outOfStockDate) {
          const outTime = new Date(p.outOfStockDate).getTime();
          const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
          if (outTime < tenDaysAgo) return false;
        }
        return true;
      }).map(p => ({
        ...p,
        status: p.currentStock <= 0 ? 'Out Of Stock' : p.currentStock <= p.minimumStock ? 'Low Stock' : 'In Stock'
      }));
      setStockSummary(mapped);
      setLoading(false);
    }
  }, [reduxStockSummary]);

  // Group products by Product Name + Brand for the Tree structure
  // Formatted as: "Product Name (Brand Name)"
  const groupedStock = useMemo(() => {
    const groupsMap = {};

    stockSummary.forEach((item) => {
      const pName = (item.name || '').trim();
      const pBrand = (item.brand || '').trim();
      const groupKey = `${pName.toLowerCase()}:::${pBrand.toLowerCase()}`;
      // Product Name format: "Product Name (Brand Name)"
      const displayName = pBrand ? `${pName} (${pBrand})` : pName;

      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = {
          key: groupKey,
          name: pName,
          brand: pBrand,
          displayName,
          unit: item.unit || 'Pcs',
          variants: []
        };
      }
      groupsMap[groupKey].variants.push(item);
    });

    return Object.values(groupsMap).map((grp) => {
      const totalStock = grp.variants.reduce((sum, v) => sum + Number(v.currentStock || 0), 0);
      const totalValuation = grp.variants.reduce((sum, v) => sum + Number(v.valuation || 0), 0);
      const minStockTotal = grp.variants.reduce((sum, v) => sum + Number(v.minimumStock || 0), 0);

      const hasLowStock = grp.variants.some((v) => v.status === 'Low Stock');
      const allOutOfStock = grp.variants.length > 0 && grp.variants.every((v) => v.status === 'Out Of Stock');

      let overallStatus = 'In Stock';
      if (allOutOfStock) {
        overallStatus = 'Out Of Stock';
      } else if (hasLowStock || (totalStock <= minStockTotal && totalStock > 0)) {
        overallStatus = 'Low Stock';
      }

      // Sort variants numerically by weight/pack size if possible
      const sortedVariants = [...grp.variants].sort((a, b) => {
        const valA = parseFloat(a.measurement_value) || 0;
        const valB = parseFloat(b.measurement_value) || 0;
        if (valA !== valB) return valA - valB;
        return (a.measurement_value || '').localeCompare(b.measurement_value || '');
      });

      return {
        ...grp,
        totalStock,
        totalValuation,
        minStockTotal,
        overallStatus,
        variants: sortedVariants
      };
    });
  }, [stockSummary]);

  // Filter computations for Tree Structure
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return groupedStock.map((grp) => {
      const groupMatchesSearch = q === '' ||
        grp.displayName.toLowerCase().includes(q) ||
        grp.name.toLowerCase().includes(q) ||
        grp.brand.toLowerCase().includes(q);

      const matchingVariants = grp.variants.filter((v) => {
        if (q === '') return true;
        return groupMatchesSearch ||
          (v.sku && v.sku.toLowerCase().includes(q)) ||
          (v.barcode && v.barcode.toLowerCase().includes(q)) ||
          (v.measurement_value && v.measurement_value.toLowerCase().includes(q)) ||
          (v.name && v.name.toLowerCase().includes(q)) ||
          (v.brand && v.brand.toLowerCase().includes(q));
      });

      const statusFilteredVariants = matchingVariants.filter((v) => {
        if (statusFilter === 'All') return true;
        if (statusFilter === 'In Stock') return v.currentStock > 0;
        if (statusFilter === 'Low Stock') return v.currentStock > 0 && v.currentStock <= v.minimumStock;
        if (statusFilter === 'Out Of Stock') return v.currentStock <= 0;
        return v.status === statusFilter;
      });

      if (statusFilter === 'All') {
        if (groupMatchesSearch || matchingVariants.length > 0) {
          return {
            ...grp,
            variants: matchingVariants.length > 0 ? matchingVariants : grp.variants
          };
        }
      } else {
        if (statusFilteredVariants.length > 0) {
          return {
            ...grp,
            variants: statusFilteredVariants
          };
        }
      }
      return null;
    }).filter(Boolean);
  }, [groupedStock, searchQuery, statusFilter]);

  // Tree is open by default: missing key in expandedGroups evaluates to true
  const isGroupExpanded = (key) => expandedGroups[key] !== false;

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false
    }));
  };

  const areAllExpanded = useMemo(() => {
    if (filteredGroups.length === 0) return true;
    return filteredGroups.every(g => isGroupExpanded(g.key));
  }, [filteredGroups, expandedGroups]);

  const toggleAllGroups = () => {
    if (areAllExpanded) {
      const collapsedMap = {};
      filteredGroups.forEach(g => {
        collapsedMap[g.key] = false;
      });
      setExpandedGroups(collapsedMap);
    } else {
      const expandedMap = {};
      filteredGroups.forEach(g => {
        expandedMap[g.key] = true;
      });
      setExpandedGroups(expandedMap);
    }
  };

  const totalValuation = useMemo(() => {
    return stockSummary.reduce((sum, item) => {
      const val = Number(item.valuation) || (Number(item.currentStock || 0) * Number(item.purchasePrice || 0)) || 0;
      return sum + val;
    }, 0);
  }, [stockSummary]);

  const totalQty = useMemo(() => {
    return stockSummary.reduce((sum, item) => sum + item.currentStock, 0);
  }, [stockSummary]);

  const lowCount = stockSummary.filter(s => s.status === 'Low Stock').length;
  const outCount = stockSummary.filter(s => s.status === 'Out Of Stock').length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
  };

  const getStatusChipStyles = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Low Stock': return 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse';
      case 'Out Of Stock': return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'Near Expiry': return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'Expired': return 'bg-purple-50 text-purple-700 border border-purple-200';
      default: return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const { user } = useAppSelector((state) => state.auth);
  const isPurchaseEmployee = user?.role === 'Purchase Employee' || (user?.role === 'Employee' && user?.department === 'Purchase');

  const allTabs = [
    { id: 'current-stock', label: 'Current Stock', icon: CircleStackIcon },
    { id: 'purchase-order', label: 'Purchase Orders', icon: DocumentTextIcon },
    { id: 'stock-destroy', label: 'Stock Destroy', icon: TrashIcon },
    { id: 'stock-adjustment', label: 'Stock Adjustment', icon: AdjustmentsHorizontalIcon }
  ];

  const tabs = isPurchaseEmployee
    ? allTabs.filter(t => !['stock-destroy', 'stock-adjustment'].includes(t.id))
    : allTabs;

  return (
    <div className="space-y-5 pb-12 select-none">
      
      {/* TABS HEADER BAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                <CubeIcon className="w-5 h-5" />
              </div>
              Inventory Control Center
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Unified hub for stock levels, purchases, adjustments, transfers, and return ledgers.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 mt-4 pt-3.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
                  isActive 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-soft' 
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                }`}
              >
                <Icon className="w-4 h-4 stroke-[2]" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDER ACTIVE SUB-PANELS */}
      <div className="w-full">
        {activeTab === 'current-stock' && (
          <div className="space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title="Total Stock Units" value={totalQty} icon={CircleStackIcon} subtext="Aggregated Pieces Hand" color="green" />
              <StatsCard title="Inventory Valuation" value={`₹${totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} icon={CurrencyRupeeIcon} subtext="Purchased Cost Basis" color="purple" />
              <StatsCard title="Low Stock Warns" value={lowCount} icon={ExclamationTriangleIcon} subtext="Under Buffer Limit" color="orange" />
              <StatsCard title="Out Of Stock Products" value={outCount} icon={MinusCircleIcon} subtext="Zero Available Lines" color="red" />
            </div>

            {/* Stock Levels Filters & Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search inventory items by product name or brand..."
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="All">All Stock Statuses</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out Of Stock">Out Of Stock</option>
                  </select>

                  <button
                    onClick={toggleAllGroups}
                    className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {areAllExpanded ? (
                      <>
                        <ChevronUpIcon className="w-4 h-4 stroke-[2.5]" />
                        <span>Collapse All</span>
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="w-4 h-4 stroke-[2.5]" />
                        <span>Expand All</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center">
                  <span className="text-sm font-semibold text-slate-500 animate-pulse">Loading stock lists...</span>
                </div>
              ) : (
                <div 
                  className="overflow-x-auto max-h-[295px] overflow-y-auto custom-scrollbar border border-slate-200/80 rounded-xl shadow-2xs"
                  style={{ maxHeight: '295px' }}
                >
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-xs">
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-5">Product Name (Brand) & Variants</th>
                        <th className="py-3 px-4 text-center">Available stock</th>
                        <th className="py-3 px-4 text-right">Valuation (Cost)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center w-28">History</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
                      {filteredGroups.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400 font-medium text-xs">
                            No inventory items found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredGroups.map((grp) => {
                          const isExpanded = isGroupExpanded(grp.key);
                          const hasMultiple = grp.variants.length > 1;

                          return (
                            <React.Fragment key={grp.key}>
                              {/* Parent / Group Row */}
                              <tr 
                                onClick={() => toggleGroup(grp.key)}
                                className={`transition-colors cursor-pointer select-none ${
                                  isExpanded ? 'bg-slate-50/90 hover:bg-slate-100/90' : 'bg-white hover:bg-slate-50/80'
                                }`}
                              >
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroup(grp.key);
                                      }}
                                      className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
                                      title={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDownIcon className="w-4 h-4 stroke-[2.5] text-indigo-600" />
                                      ) : (
                                        <ChevronRightIcon className="w-4 h-4 stroke-[2.5] text-slate-400" />
                                      )}
                                    </button>

                                    <span className="font-bold text-slate-950 text-sm tracking-tight">
                                      {grp.displayName}
                                    </span>

                                    {hasMultiple && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {grp.variants.length} Weights
                                      </span>
                                    )}

                                    {hasMultiple && (
                                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-md hidden md:inline-block">
                                        {grp.variants.map(v => v.measurement_value || v.unit).join(' • ')}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className={`py-3.5 px-4 text-center font-black tabular-nums text-sm ${grp.totalStock <= grp.minStockTotal ? 'text-red-500' : 'text-slate-950'}`}>
                                  {grp.totalStock}
                                </td>
                                <td className="py-3.5 px-4 text-right font-black text-slate-950 tabular-nums text-sm">
                                  ₹{Number(grp.totalValuation).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-bold ${getStatusChipStyles(grp.overallStatus)}`}>
                                    {grp.overallStatus}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openHistoryModal(grp, true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all active:scale-95 cursor-pointer shadow-2xs"
                                    title={`View Stock History for ${grp.displayName}`}
                                  >
                                    <ClockIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>History</span>
                                  </button>
                                </td>
                              </tr>

                              {/* Child / Variant Rows (Weight Variants) */}
                              {isExpanded && grp.variants.map((v, idx) => {
                                const isLast = idx === grp.variants.length - 1;
                                return (
                                  <tr 
                                    key={v.id || `${grp.key}-${idx}`} 
                                    className="bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors border-t border-slate-100"
                                  >
                                    <td className="py-2.5 px-5">
                                      <div className="flex items-center gap-2 pl-6">
                                        <span className="text-slate-400 font-mono select-none text-xs">
                                          {isLast ? '└──' : '├──'}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                          Weight: <strong className="ml-1 text-amber-950">{v.measurement_value || `${v.unit || 'Pcs'}`}</strong>
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-medium">
                                          ({v.name})
                                        </span>
                                      </div>
                                    </td>
                                    <td className={`py-2.5 px-4 text-center font-bold tabular-nums text-xs ${v.currentStock <= v.minimumStock ? 'text-red-500' : 'text-slate-800'}`}>
                                      {v.currentStock}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-bold text-slate-800 tabular-nums text-xs">
                                      ₹{Number(v.valuation || (v.currentStock * (v.purchasePrice || 0)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusChipStyles(v.status)}`}>
                                        {v.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openHistoryModal(v, false, grp);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
                                        title={`View History for ${v.measurement_value || v.name}`}
                                      >
                                        <ClockIcon className="w-3.5 h-3.5 text-slate-500" />
                                        <span>History</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stock-adjustment' && <StockAdjustment onStockChanged={handleStockChanged} />}
        
        {activeTab === 'purchase-order' && <PurchaseOrderList />}

        {activeTab === 'stock-destroy' && <StockDestroy onStockChanged={handleStockChanged} />}
      </div>

      {/* STOCK MOVEMENT HISTORY MODAL */}
      <Modal
        isOpen={historyModal.isOpen}
        onClose={closeHistoryModal}
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <ClockIcon className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Stock Movement History
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {historyModal.selectedVariantId === 'all' ? 'All Weights' : 'Pack Variant'}
                </span>
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {historyModal.selectedVariantId === 'all'
                  ? `${historyModal.parentGroup?.displayName || historyModal.item?.displayName || historyModal.item?.name} (Consolidated History)`
                  : `${historyModal.item?.name} (${historyModal.item?.brand || ''}) — Weight: ${activeSelectedVariant?.measurement_value || activeSelectedVariant?.unit || 'Standard'}`}
              </p>
            </div>
          </div>
        }
        size="3xl"
      >
        <div className="space-y-4">
          {/* Dropdown & Tab Selector when product has multiple different weights */}
          {historyModal.variants && historyModal.variants.length > 1 && (
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700 whitespace-nowrap">
                    Select Weight:
                  </span>
                  <select
                    value={historyModal.selectedVariantId}
                    onChange={(e) => setHistoryModal(prev => ({ ...prev, selectedVariantId: e.target.value }))}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 shadow-2xs focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value="all">
                      All Weights ({historyModal.variants.length} Pack Sizes)
                    </option>
                    {historyModal.variants.map((v) => (
                      <option key={v.productId || v.id} value={String(v.productId || v.id)}>
                        {v.measurement_value || v.unit} (Stock: {v.currentStock})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Interactive Tab Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryModal(prev => ({ ...prev, selectedVariantId: 'all' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      historyModal.selectedVariantId === 'all'
                        ? 'bg-slate-900 border-slate-900 text-white shadow-soft'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    All ({historyModal.variants.length})
                  </button>
                  {historyModal.variants.map((v) => {
                    const isSelected = String(historyModal.selectedVariantId) === String(v.productId || v.id);
                    return (
                      <button
                        key={v.productId || v.id}
                        type="button"
                        onClick={() => setHistoryModal(prev => ({ ...prev, selectedVariantId: String(v.productId || v.id) }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-soft'
                            : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <span>{v.measurement_value || v.unit}</span>
                        <span className={`ml-1 text-[10px] font-semibold ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                          ({v.currentStock})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Available Stock</span>
              <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
                {modalActiveStock}
              </p>
            </div>
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Total Inward Qty</span>
              <p className="text-lg font-black text-emerald-800 mt-0.5 tabular-nums">
                +{modalTotalInward}
              </p>
            </div>
            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80">
              <span className="text-[10px] font-bold text-rose-700 uppercase">Total Outward Qty</span>
              <p className="text-lg font-black text-rose-800 mt-0.5 tabular-nums">
                {modalTotalOutward}
              </p>
            </div>
            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80">
              <span className="text-[10px] font-bold text-indigo-700 uppercase">Audit Records</span>
              <p className="text-lg font-black text-indigo-800 mt-0.5 tabular-nums">
                {displayedHistoryLogs.length}
              </p>
            </div>
          </div>

          {/* Table of logs */}
          {historyModal.loading ? (
            <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Fetching movement history...</span>
            </div>
          ) : displayedHistoryLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-medium text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No stock movement logs recorded yet for this item.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto border border-slate-200/80 rounded-xl shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10 shadow-xs">
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    {historyModal.selectedVariantId === 'all' && <th className="py-2.5 px-3">Pack / Weight</th>}
                    <th className="py-2.5 px-3 text-center">Change Qty</th>
                    <th className="py-2.5 px-3 text-center">Balance</th>
                    <th className="py-2.5 px-3">Reference / Notes</th>
                    <th className="py-2.5 px-3">Done By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {displayedHistoryLogs.map((log) => {
                    const qtyNum = Number(log.quantity || 0);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-medium text-[11px]">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${getLogTypeBadge(log.type)}`}>
                            {log.type}
                          </span>
                        </td>
                        {historyModal.selectedVariantId === 'all' && (
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {log.measurement_value || log.unit || 'Standard'}
                            </span>
                          </td>
                        )}
                        <td className={`py-2.5 px-3 text-center font-black tabular-nums ${qtyNum > 0 ? 'text-emerald-600' : qtyNum < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          {qtyNum > 0 ? `+${qtyNum}` : qtyNum}
                        </td>
                        <td className="py-2.5 px-3 text-center tabular-nums text-slate-800 font-semibold text-[11px]">
                          {log.new_quantity !== undefined && log.new_quantity !== null ? Number(log.new_quantity) : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            {log.reference_no && (
                              <span className="font-mono text-[10px] font-bold text-slate-800">
                                {log.reference_no}
                              </span>
                            )}
                            {log.notes && (
                              <span className="text-[10px] text-slate-400 truncate max-w-xs" title={log.notes}>
                                {log.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                          {log.user_name || 'System'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default StockDashboard;