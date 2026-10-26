import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilSquareIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  TagIcon,
  Squares2X2Icon,
  BuildingStorefrontIcon,
  XMarkIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import StatusBadge from '../../components/common/StatusBadge';
import { categoriesAPI, subCategoriesAPI, brandsAPI } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { invalidateProductMastersCache } from '../../components/forms/ProductForm';

let cachedCategoryState = null;
try {
  const stored = sessionStorage.getItem('cached_category_state');
  if (stored) cachedCategoryState = JSON.parse(stored);
} catch (e) {}

const CategoryList = () => {
  const { isDarkMode } = useAppSelector((state) => state.theme);
  
  // Navigation Tabs: 'main' (Add Category), 'sub' (Sub Category), 'brand' (Brand)
  const [activeTab, setActiveTab] = useState('main');

  // Loading States
  const [loading, setLoading] = useState(!cachedCategoryState);
  const [btnLoading, setBtnLoading] = useState(false);

  // Error & Toast Message
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter States per tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Data Lists
  const [categories, setCategories] = useState(cachedCategoryState?.categories || []);
  const [subCategories, setSubCategories] = useState(cachedCategoryState?.subCategories || []);
  const [brands, setBrands] = useState(cachedCategoryState?.brands || []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editId, setEditId] = useState(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    sub_category_id: '',
    description: '',
    status: 'Active'
  });

  // Load Data based on active tab
  const loadData = async (forceSpinner = false) => {
    if (!cachedCategoryState || forceSpinner) setLoading(true);
    setError('');
    try {
      if (activeTab === 'main') {
        const res = await categoriesAPI.getAll({ search: searchQuery, status: statusFilter });
        if (res.success) setCategories(res.categories || []);
      } else if (activeTab === 'sub') {
        const [subRes, catRes] = await Promise.all([
          subCategoriesAPI.getAll({ search: searchQuery, status: statusFilter }),
          categoriesAPI.getAll({ status: 'Active' })
        ]);
        if (subRes.success) setSubCategories(subRes.subCategories || []);
        if (catRes.success) setCategories(catRes.categories || []);
      } else if (activeTab === 'brand') {
        const [brandRes, catRes, subRes] = await Promise.all([
          brandsAPI.getAll({ search: searchQuery, status: statusFilter }),
          categoriesAPI.getAll({ status: 'Active' }),
          subCategoriesAPI.getAll({ status: 'Active' })
        ]);
        if (brandRes.success) setBrands(brandRes.brands || []);
        if (catRes.success) setCategories(catRes.categories || []);
        if (subRes.success) setSubCategories(subRes.subCategories || []);
      }
    } catch (err) {
      console.error('Failed to load master records:', err);
      setError(err.response?.data?.message || 'Failed to fetch database records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    let debounceTimer = null;
    let lastFocusSync = Date.now();

    const handleDebouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 350);
    };

    const handleFocusSync = () => {
      if (Date.now() - lastFocusSync > 60000) {
        lastFocusSync = Date.now();
        loadData();
      }
    };

    window.addEventListener('focus', handleFocusSync);
    window.addEventListener('category-updated', handleDebouncedUpdate);
    window.addEventListener('brand-updated', handleDebouncedUpdate);
    window.addEventListener('inventory-updated', handleDebouncedUpdate);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('focus', handleFocusSync);
      window.removeEventListener('category-updated', handleDebouncedUpdate);
      window.removeEventListener('brand-updated', handleDebouncedUpdate);
      window.removeEventListener('inventory-updated', handleDebouncedUpdate);
    };
  }, [activeTab, searchQuery, statusFilter]);

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditId(null);
    const initialCatId = categories.length > 0 ? categories[0].id : '';
    let initialSubId = '';
    if (activeTab === 'brand' && initialCatId) {
      const activeSubs = subCategories.filter(s => String(s.category_id) === String(initialCatId) && s.status === 'Active');
      if (activeSubs.length > 0) {
        initialSubId = activeSubs[0].id;
      }
    }
    setFormData({
      name: '',
      category_id: activeTab === 'main' ? '' : initialCatId,
      sub_category_id: initialSubId,
      description: '',
      status: 'Active'
    });
    setError('');
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item) => {
    setModalMode('edit');
    setEditId(item.id);
    let resolvedCatId = item.category_id || (categories.length > 0 ? categories[0].id : '');
    if (activeTab === 'brand' && item.sub_category_id) {
      const parentSub = subCategories.find(s => String(s.id) === String(item.sub_category_id));
      if (parentSub && parentSub.category_id) {
        resolvedCatId = parentSub.category_id;
      }
    }
    setFormData({
      name: item.name || '',
      category_id: resolvedCatId,
      sub_category_id: item.sub_category_id || '',
      description: item.description || '',
      status: item.status || 'Active'
    });
    setError('');
    setIsModalOpen(true);
  };

  // Close Modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setError('');
  };

  // Toast message helper
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (activeTab === 'sub' && !formData.category_id) {
      setError('Parent Main Category is required.');
      return;
    }
    if (activeTab === 'brand') {
      if (!formData.category_id) {
        setError('Parent Main Category is required.');
        return;
      }
      if (!formData.sub_category_id) {
        setError('Parent Sub Category is required.');
        return;
      }
    }

    setBtnLoading(true);
    setError('');

    try {
      if (activeTab === 'main') {
        if (modalMode === 'add') {
          const res = await categoriesAPI.create({
            name: formData.name.trim(),
            description: formData.description,
            status: formData.status
          });
          if (res.success) showSuccess('Main Category created successfully!');
        } else {
          const res = await categoriesAPI.update(editId, {
            name: formData.name.trim(),
            description: formData.description,
            status: formData.status
          });
          if (res.success) showSuccess('Main Category updated successfully!');
        }
      } else if (activeTab === 'sub') {
        if (modalMode === 'add') {
          const res = await subCategoriesAPI.create({
            name: formData.name.trim(),
            category_id: formData.category_id,
            description: formData.description,
            status: formData.status
          });
          if (res.success) showSuccess('Sub Category created successfully!');
        } else {
          const res = await subCategoriesAPI.update(editId, {
            name: formData.name.trim(),
            category_id: formData.category_id,
            description: formData.description,
            status: formData.status
          });
          if (res.success) showSuccess('Sub Category updated successfully!');
        }
      } else if (activeTab === 'brand') {
        const parentSub = subCategories.find(s => String(s.id) === String(formData.sub_category_id));
        const finalCatId = parentSub?.category_id || formData.category_id;
        if (modalMode === 'add') {
          const res = await brandsAPI.create({
            name: formData.name.trim(),
            category_id: finalCatId,
            sub_category_id: formData.sub_category_id,
            description: formData.description,
            status: formData.status
          });
          if (res.success) showSuccess('Brand created successfully!');
        } else {
          const res = await brandsAPI.update(editId, {
            name: formData.name.trim(),
            category_id: finalCatId,
            sub_category_id: formData.sub_category_id,
            description: formData.description,
            status: formData.status
          });
          if (res.success) showSuccess('Brand updated successfully!');
        }
      }

      handleCloseModal();
      loadData();
      invalidateProductMastersCache();
      window.dispatchEvent(new CustomEvent('category-updated'));
      window.dispatchEvent(new CustomEvent('brand-updated'));
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      console.error('Submit Master Error:', err);
      setError(err.response?.data?.message || 'Operation failed. Please check form values.');
    } finally {
      setBtnLoading(false);
    }
  };

  // Status Toggle Handler (Replaces Delete)
  const handleToggleStatus = async (id, currentStatus, name) => {
    const targetStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      if (activeTab === 'main') {
        const res = await categoriesAPI.toggleStatus(id, targetStatus);
        if (res.success) showSuccess(`Main Category "${name}" status changed to ${targetStatus}`);
      } else if (activeTab === 'sub') {
        const res = await subCategoriesAPI.toggleStatus(id, targetStatus);
        if (res.success) showSuccess(`Sub Category "${name}" status changed to ${targetStatus}`);
      } else if (activeTab === 'brand') {
        const res = await brandsAPI.toggleStatus(id, targetStatus);
        if (res.success) showSuccess(`Brand "${name}" status changed to ${targetStatus}`);
      }
      loadData();
      invalidateProductMastersCache();
      window.dispatchEvent(new CustomEvent('category-updated'));
      window.dispatchEvent(new CustomEvent('brand-updated'));
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMsg && (
        <div className="bg-emerald-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-slide-down">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircleIcon className="w-5 h-5" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="hover:opacity-75">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Squares2X2Icon className="w-6 h-6" />
              </span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Category & Brand Masters</h1>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 ml-10">
              Protected ERP Masters — Delete disabled to safeguard historical transaction records
            </p>
          </div>

          {/* Add Button */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 dark:shadow-none"
          >
            <PlusIcon className="w-4 h-4 stroke-[3]" />
            <span>
              {activeTab === 'main' && 'Add Main Category'}
              {activeTab === 'sub' && 'Add Sub Category'}
              {activeTab === 'brand' && 'Add Brand'}
            </span>
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => { setActiveTab('main'); setSearchQuery(''); setStatusFilter(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'main'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Squares2X2Icon className="w-4 h-4" />
            <span>Main Category</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'main' ? 'bg-indigo-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {categories.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('sub'); setSearchQuery(''); setStatusFilter(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'sub'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <TagIcon className="w-4 h-4" />
            <span>Sub Category</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'sub' ? 'bg-indigo-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {subCategories.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('brand'); setSearchQuery(''); setStatusFilter(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'brand'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <BuildingStorefrontIcon className="w-4 h-4" />
            <span>Brand Master</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'brand' ? 'bg-indigo-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {brands.length}
            </span>
          </button>
        </div>
      </div>

      {/* FILTER HUB & CONTROLS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-2 relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'main' ? 'Main Categories' : activeTab === 'sub' ? 'Sub Categories' : 'Brands'} by name...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* LISTING TABLES */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="py-3 px-4 w-16">S.No</th>
                <th className="py-3 px-4">
                  {activeTab === 'main' && 'Category Name'}
                  {activeTab === 'sub' && 'Sub Category Name'}
                  {activeTab === 'brand' && 'Brand Name'}
                </th>
                {activeTab === 'sub' && <th className="py-3 px-4">Parent Category</th>}
                {activeTab === 'brand' && (
                  <>
                    <th className="py-3 px-4">Main Category</th>
                    <th className="py-3 px-4">Sub Category</th>
                  </>
                )}
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 w-32">Status</th>
                <th className="py-3 px-4 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'brand' ? 7 : activeTab === 'sub' ? 6 : 5} className="py-12 text-center text-slate-400 font-semibold animate-pulse">
                    Loading {activeTab} master records...
                  </td>
                </tr>
              ) : activeTab === 'main' ? (
                categories.length > 0 ? (
                  categories.map((cat, idx) => (
                    <tr key={cat.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{cat.name}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{cat.description || '—'}</td>
                      <td className="py-3 px-4"><StatusBadge status={cat.status} /></td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditModal(cat)}
                          title="Edit Details"
                          className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold inline-flex items-center gap-1"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400 font-semibold">No Main Categories found. Click "Add Main Category" to create one.</td>
                  </tr>
                )
              ) : activeTab === 'sub' ? (
                subCategories.length > 0 ? (
                  subCategories.map((sub, idx) => (
                    <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{sub.name}</td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">{sub.category_name}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{sub.description || '—'}</td>
                      <td className="py-3 px-4"><StatusBadge status={sub.status} /></td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditModal(sub)}
                          title="Edit Details"
                          className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold inline-flex items-center gap-1"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400 font-semibold">No Sub Categories found. Click "Add Sub Category" to create one.</td>
                  </tr>
                )
              ) : (
                brands.length > 0 ? (
                  brands.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{b.name}</td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">{b.category_name || '—'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{b.sub_category_name || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{b.description || '—'}</td>
                      <td className="py-3 px-4"><StatusBadge status={b.status} /></td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditModal(b)}
                          title="Edit Details"
                          className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold inline-flex items-center gap-1"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-semibold">No Brands found. Click "Add Brand" to create one.</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {modalMode === 'add' ? 'Add New' : 'Edit'}{' '}
                {activeTab === 'main' && 'Main Category'}
                {activeTab === 'sub' && 'Sub Category'}
                {activeTab === 'brand' && 'Brand Master'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Error inside modal */}
            {error && (
              <div className="bg-rose-50 text-rose-700 text-xs font-bold p-3 rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Parent Category Field (For Sub Category) */}
              {activeTab === 'sub' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Parent Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Select Active Parent Category</option>
                    {categories.filter(c => c.status === 'Active' || String(c.id) === String(formData.category_id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Main Category & Sub Category Fields (For Brand) */}
              {activeTab === 'brand' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Main Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => {
                        const newCatId = e.target.value;
                        const matchingSubs = subCategories.filter(s => 
                          String(s.category_id) === String(newCatId) && 
                          (s.status === 'Active' || String(s.id) === String(formData.sub_category_id))
                        );
                        // Auto-select first matching subcategory if current subcategory does not belong to new category
                        const isCurrentValid = matchingSubs.some(s => String(s.id) === String(formData.sub_category_id));
                        const nextSubId = isCurrentValid ? formData.sub_category_id : (matchingSubs.length > 0 ? matchingSubs[0].id : '');

                        setFormData({
                          ...formData,
                          category_id: newCatId,
                          sub_category_id: nextSubId
                        });
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="">Select Main Category</option>
                      {categories.filter(c => c.status === 'Active' || String(c.id) === String(formData.category_id)).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Sub Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!formData.category_id}
                      value={formData.sub_category_id}
                      onChange={(e) => {
                        const chosenSubId = e.target.value;
                        const parentSub = subCategories.find(s => String(s.id) === String(chosenSubId));
                        setFormData({
                          ...formData,
                          sub_category_id: chosenSubId,
                          category_id: parentSub?.category_id || formData.category_id
                        });
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                    >
                      {!formData.category_id ? (
                        <option value="">Select Main Category First</option>
                      ) : subCategories.filter(s => String(s.category_id) === String(formData.category_id) && (s.status === 'Active' || String(s.id) === String(formData.sub_category_id))).length === 0 ? (
                        <option value="" disabled>No Sub Categories Available for this Category</option>
                      ) : (
                        <option value="">Select Sub Category</option>
                      )}
                      {subCategories
                        .filter(s => String(s.category_id) === String(formData.category_id) && (s.status === 'Active' || String(s.id) === String(formData.sub_category_id)))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {activeTab === 'main' && 'Category Name'}
                  {activeTab === 'sub' && 'Sub Category Name'}
                  {activeTab === 'brand' && 'Brand Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter ${activeTab === 'main' ? 'Category' : activeTab === 'sub' ? 'Sub Category' : 'Brand'} Name...`}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Status Field (Only shown in Edit mode) */}
              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              )}

              {/* Description Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Optional brief description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={btnLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                >
                  {btnLoading ? 'Saving...' : modalMode === 'add' ? 'Save Record' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryList;