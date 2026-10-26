import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  CurrencyRupeeIcon,
  BanknotesIcon,
  BuildingStorefrontIcon, 
  XMarkIcon,
  ArrowPathIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { categoriesAPI, subCategoriesAPI, brandsAPI } from '../../services/api';

const UNIT_SUFFIX_MAP = {
  'Kg': 'kg',
  'Grams': 'g',
  'Litre': 'L',
  'Ml': 'ml',
  'Packet': 'Packet',
  'Bottle': 'Bottle',
  'Box': 'Box',
  'Sachet': 'Sachet',
  'Piece': 'Pcs',
  'Carton': 'Carton',
  'Dozen': 'Dozen',
  'Meter': 'm'
};

const PREDEFINED_WEIGHTS = {
  'Kg': ['500 g', '1 kg', '2 kg', '5 kg', '10 kg', '25 kg'],
  'Grams': ['50 g', '100 g', '250 g', '500 g', '1 kg'],
  'Litre': ['250 ml', '500 ml', '1 L', '2 L', '5 L'],
  'Ml': ['50 ml', '100 ml', '200 ml', '250 ml', '500 ml', '750 ml'],
  'Piece': ['1 Pcs', '2 Pcs', '5 Pcs', '10 Pcs', '25 Pcs'],
  'Packet': ['1 Packet', '2 Packet', '5 Packet', '10 Packet'],
  'Bottle': ['1 Bottle', '2 Bottle', '5 Bottle'],
  'Box': ['1 Box', '2 Box', '5 Box', '10 Box'],
  'Carton': ['1 Carton', '5 Carton', '10 Carton'],
  'Dozen': ['1 Dozen', '2 Dozen', '5 Dozen'],
  'Meter': ['1 m', '2 m', '5 m', '10 m'],
  'Sachet': ['1 Sachet', '5 Sachet', '10 Sachet']
};

const extractNumber = (str) => {
  if (!str) return '';
  const m = String(str).match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? m[1] : '';
};

const getStoredCustomWeights = (unit) => {
  try {
    const raw = localStorage.getItem('kirana_custom_weights');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed[unit]) ? parsed[unit] : [];
  } catch (e) {
    return [];
  }
};

const saveCustomWeightToStorage = (unit, weightStr) => {
  try {
    const raw = localStorage.getItem('kirana_custom_weights');
    const parsed = raw ? JSON.parse(raw) : {};
    const existing = Array.isArray(parsed[unit]) ? parsed[unit] : [];
    if (!existing.includes(weightStr)) {
      parsed[unit] = [...existing, weightStr];
      localStorage.setItem('kirana_custom_weights', JSON.stringify(parsed));
    }
  } catch (e) {
    console.error('Failed to save custom weight to localStorage:', e);
  }
};

const removeCustomWeightFromStorage = (unit, weightStr) => {
  try {
    const raw = localStorage.getItem('kirana_custom_weights');
    const parsed = raw ? JSON.parse(raw) : {};
    if (Array.isArray(parsed[unit])) {
      parsed[unit] = parsed[unit].filter(w => w !== weightStr);
      localStorage.setItem('kirana_custom_weights', JSON.stringify(parsed));
    }
  } catch (e) {
    console.error('Failed to remove custom weight from localStorage:', e);
  }
};

// Module-level cache for master data to enable instant modal open
let cachedProductMasters = null;
let lastProductMastersTime = 0;

export const invalidateProductMastersCache = () => {
  cachedProductMasters = null;
  lastProductMastersTime = 0;
};

const ProductForm = ({ product, categories = [], onSubmit, onCancel, readOnly = false }) => {
  
  const defaultState = {
    name: '',
    category: '',
    category_id: '',
    sub_category: '',
    sub_category_id: '',
    brand: '',
    brand_id: '',
    unit: 'Packet',
    measurement_value: '',
    description: '',
    image: '📦',
    purchasePrice: '',
    sellingPrice: '',
    mrp: '',
    gst: '0',
    openingStock: '0',
    minimumStock: '5',
    maximumStock: '100',
    manufacturingDate: '',
    expiryDate: '',
  };

  const [formData, setFormData] = useState({ ...defaultState });
  const [selectedWeights, setSelectedWeights] = useState([]);
  const [customWeights, setCustomWeights] = useState(() => getStoredCustomWeights('Packet'));
  const [isWeightDropdownOpen, setIsWeightDropdownOpen] = useState(false);
  const [customWeightInput, setCustomWeightInput] = useState('');
  const [variantPrices, setVariantPrices] = useState({});
  const pricingSectionRef = useRef(null);
  const weightDropdownRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [dbCategories, setDbCategories] = useState(() => cachedProductMasters?.categories || (categories.length ? categories : []));
  const [dbSubCategories, setDbSubCategories] = useState(() => cachedProductMasters?.subCategories || []);
  const [dbBrands, setDbBrands] = useState(() => cachedProductMasters?.brands || []);
  const [loadingMasters, setLoadingMasters] = useState(() => !cachedProductMasters && !categories.length);
  const [masterFetchError, setMasterFetchError] = useState(null);
  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (weightDropdownRef.current && !weightDropdownRef.current.contains(event.target)) {
        setIsWeightDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchMasters = async (force = false) => {
    if (!force && cachedProductMasters && (Date.now() - lastProductMastersTime < 120000)) {
      setDbCategories(cachedProductMasters.categories);
      setDbSubCategories(cachedProductMasters.subCategories);
      setDbBrands(cachedProductMasters.brands);
      setLoadingMasters(false);
      return;
    }

    if (!cachedProductMasters) setLoadingMasters(true);
    setMasterFetchError(null);
    try {
      const [catRes, subRes, brandRes] = await Promise.all([
        categoriesAPI.getAll({ status: 'Active' }),
        subCategoriesAPI.getAll({ status: 'Active' }),
        brandsAPI.getAll({ status: 'Active' })
      ]);
      const cats = catRes.success ? (catRes.categories || []) : [];
      const subs = subRes.success ? (subRes.subCategories || []) : [];
      const brands = brandRes.success ? (brandRes.brands || []) : [];

      cachedProductMasters = { categories: cats, subCategories: subs, brands: brands };
      lastProductMastersTime = Date.now();

      setDbCategories(cats);
      setDbSubCategories(subs);
      setDbBrands(brands);
    } catch (err) {
      console.error('Failed to load ProductForm dropdown masters:', err);
      if (!cachedProductMasters) setMasterFetchError('Failed to load master dropdown data from server.');
    } finally {
      setLoadingMasters(false);
    }
  };

  useEffect(() => {
    fetchMasters();

    const handleMasterUpdate = () => {
      invalidateProductMastersCache();
      fetchMasters(true);
    };

    window.addEventListener('category-updated', handleMasterUpdate);
    window.addEventListener('brand-updated', handleMasterUpdate);
    return () => {
      window.removeEventListener('category-updated', handleMasterUpdate);
      window.removeEventListener('brand-updated', handleMasterUpdate);
    };
  }, []);

  // Selected Main Category Object
  const selectedCatObj = dbCategories.find(c => 
    (formData.category_id && String(c.id) === String(formData.category_id)) ||
    (formData.category && c.name.toLowerCase() === formData.category.toLowerCase())
  );

  // Active Sub Categories belonging to selected Main Category
  const activeSubCategories = selectedCatObj
    ? dbSubCategories.filter(s => String(s.category_id) === String(selectedCatObj.id))
    : [];

  // Active Brands belonging to selected Category & Sub Category
  const activeBrands = useMemo(() => {
    if (!formData.category_id && !formData.category) return [];
    return dbBrands.filter(b => {
      // Keep currently selected brand in edit mode
      if (formData.brand_id && String(b.id) === String(formData.brand_id)) return true;
      if (formData.brand && b.name.toLowerCase() === formData.brand.toLowerCase()) return true;

      // Filter by sub_category_id if selected
      if (formData.sub_category_id && b.sub_category_id) {
        return String(b.sub_category_id) === String(formData.sub_category_id);
      }
      // If brand only has category_id
      if (formData.category_id && b.category_id && !b.sub_category_id) {
        return String(b.category_id) === String(formData.category_id);
      }
      // Legacy brands without category/subcategory
      if (!b.category_id && !b.sub_category_id) {
        return true;
      }
      return false;
    });
  }, [dbBrands, formData.category_id, formData.category, formData.sub_category_id, formData.brand_id, formData.brand]);

  // Parse incoming product props and pre-fill form
  useEffect(() => {
    if (product) {
      const catMatch = dbCategories.find(c => 
        (product.category_id && String(c.id) === String(product.category_id)) || 
        (product.category && c.name.toLowerCase() === product.category.toLowerCase()) ||
        (product.category_name && c.name.toLowerCase() === product.category_name.toLowerCase())
      );

      const subMatch = dbSubCategories.find(s => 
        (product.sub_category_id && String(s.id) === String(product.sub_category_id)) ||
        (product.sub_category && s.name.toLowerCase() === product.sub_category.toLowerCase())
      );

      const brandMatch = dbBrands.find(b => 
        (product.brand_id && String(b.id) === String(product.brand_id)) ||
        (product.brand && b.name.toLowerCase() === product.brand.toLowerCase())
      );

      const catName = catMatch ? catMatch.name : (product.category_name || product.category || '');
      const catId = catMatch ? catMatch.id : (product.category_id || '');

      const subName = subMatch ? subMatch.name : (product.sub_category || '');
      const subId = subMatch ? subMatch.id : (product.sub_category_id || '');

      const brandName = brandMatch ? brandMatch.name : (product.brand || '');
      const brandId = brandMatch ? brandMatch.id : (product.brand_id || '');

      setFormData({
        ...defaultState,
        ...product,
        name: product.name || '',
        category: catName,
        category_id: catId,
        sub_category: subName,
        sub_category_id: subId,
        brand: brandName,
        brand_id: brandId,
        unit: product.unit || 'Packet',
        measurement_value: product.measurement_value || '',
        description: product.description || '',
        image: product.image || '📦',
        purchasePrice: product.purchasePrice ?? product.purchase_price ?? '',
        sellingPrice: product.sellingPrice ?? product.selling_price ?? '',
        mrp: product.mrp ?? product.max_retail_price ?? '',
        gst: product.gst !== undefined && product.gst !== null ? String(product.gst) : '0',
        openingStock: product.openingStock ?? product.opening_stock ?? '0',
        minimumStock: product.minimumStock ?? product.min_stock ?? '5',
        maximumStock: product.maximumStock ?? product.max_stock ?? '100',
        manufacturingDate: product.manufacturingDate ?? (product.manufacturing_date ? product.manufacturing_date.substring(0, 10) : ''),
        expiryDate: product.expiryDate ?? (product.expiry_date ? product.expiry_date.substring(0, 10) : ''),
      });
      const allExistingWeights = (product.existingVariants && product.existingVariants.length > 0)
        ? product.existingVariants.map(v => v.measurement_value).filter(Boolean)
        : (product.measurement_value ? [product.measurement_value] : []);
      setSelectedWeights(allExistingWeights);
      setCustomWeights(getStoredCustomWeights(product.unit || 'Packet'));
      setCustomWeightInput('');

      const initialVariantPrices = {};
      if (product.existingVariants && product.existingVariants.length > 0) {
        product.existingVariants.forEach(v => {
          initialVariantPrices[v.id] = {
            sellingPrice: v.sellingPrice ?? v.selling_price ?? '',
            mrp: v.mrp ?? v.max_retail_price ?? '',
            purchasePrice: v.purchasePrice ?? v.purchase_price ?? '',
            gst: v.gst !== undefined && v.gst !== null ? String(v.gst) : '0',
          };
        });
      }
      setVariantPrices(initialVariantPrices);

      if (product.focusPricing) {
        setTimeout(() => {
          if (pricingSectionRef.current) {
            pricingSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }

      if (subName && !subMatch && dbSubCategories.length > 0) {
        setIsCustomSubCategory(true);
      } else {
        setIsCustomSubCategory(false);
      }

      if (brandName && !brandMatch && dbBrands.length > 0) {
        setIsCustomBrand(true);
      } else {
        setIsCustomBrand(false);
      }
    } else {
      setFormData(defaultState);
      setSelectedWeights([]);
      setCustomWeights(getStoredCustomWeights(defaultState.unit));
      setCustomWeightInput('');
      setIsCustomBrand(false);
      setIsCustomSubCategory(false);
    }
    setErrors({});
  }, [product, dbCategories, dbSubCategories, dbBrands]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'category_id' || name === 'category') {
      const selectedCat = dbCategories.find(c => String(c.id) === String(value) || c.name === value);
      setFormData((prev) => ({ 
        ...prev, 
        category: selectedCat ? selectedCat.name : '', 
        category_id: selectedCat ? selectedCat.id : '',
        sub_category: '',
        sub_category_id: '',
        brand: '',
        brand_id: ''
      }));
      setIsCustomSubCategory(false);
      setIsCustomBrand(false);
    } else if (name === 'sub_category_id' || name === 'sub_category') {
      if (value === 'Custom') {
        setIsCustomSubCategory(true);
        setFormData((prev) => ({ 
          ...prev, 
          sub_category: '',
          sub_category_id: '',
          brand: '',
          brand_id: ''
        }));
        setIsCustomBrand(false);
      } else {
        setIsCustomSubCategory(false);
        const selectedSub = dbSubCategories.find(s => String(s.id) === String(value) || s.name === value);
        setFormData((prev) => ({ 
          ...prev, 
          sub_category: selectedSub ? selectedSub.name : value,
          sub_category_id: selectedSub ? selectedSub.id : '',
          brand: '',
          brand_id: ''
        }));
        setIsCustomBrand(false);
      }
    } else if (name === 'customSubCategory') {
      setFormData((prev) => ({ ...prev, sub_category: value, sub_category_id: '' }));
    } else if (name === 'brand_select' || name === 'brand') {
      if (value === 'Custom') {
        setIsCustomBrand(true);
        setFormData((prev) => ({ 
          ...prev, 
          brand: '',
          brand_id: ''
        }));
      } else {
        setIsCustomBrand(false);
        const selectedBr = dbBrands.find(b => String(b.id) === String(value) || b.name === value);
        setFormData((prev) => ({ 
          ...prev, 
          brand: selectedBr ? selectedBr.name : value,
          brand_id: selectedBr ? selectedBr.id : ''
        }));
      }
    } else if (name === 'customBrand') {
      setFormData((prev) => ({ ...prev, brand: value, brand_id: '' }));
    } else if (name === 'unit') {
      const newUnit = value;
      setFormData((prev) => ({ 
        ...prev, 
        unit: newUnit,
        measurement_value: ''
      }));
      setSelectedWeights([]);
      setCustomWeights(getStoredCustomWeights(newUnit));
      setCustomWeightInput('');
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name] || (name === 'category_id' && errors.category) || (name === 'brand_select' && errors.brand)) {
      setErrors((prev) => ({ ...prev, [name]: null, category: null, brand: null }));
    }
  };

  const handleToggleWeight = (weightStr) => {
    setSelectedWeights(prev => {
      const exists = prev.includes(weightStr);
      const next = exists
        ? prev.filter(w => w !== weightStr)
        : [...prev, weightStr];
      setFormData(fd => ({
        ...fd,
        measurement_value: next[0] || ''
      }));
      return next;
    });
  };

  const handleAddCustomWeight = () => {
    const raw = customWeightInput.trim();
    if (!raw) return;
    const currentUnit = formData.unit || 'Packet';
    const suffix = UNIT_SUFFIX_MAP[currentUnit] || currentUnit;
    let formatted = raw;
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(raw)) {
      formatted = `${raw} ${suffix}`;
    } else if (!raw.toLowerCase().includes(suffix.toLowerCase())) {
      formatted = `${raw} ${suffix}`;
    }

    saveCustomWeightToStorage(currentUnit, formatted);

    if (!customWeights.includes(formatted)) {
      setCustomWeights(prev => [...prev, formatted]);
    }
    if (!selectedWeights.includes(formatted)) {
      setSelectedWeights(prev => {
        const next = [...prev, formatted];
        setFormData(fd => ({ ...fd, measurement_value: next[0] || '' }));
        return next;
      });
    }
    setCustomWeightInput('');
    toast.success(`Custom weight "${formatted}" saved to dropdown`);
  };

  const handleDeleteCustomWeight = (e, weightToRemove) => {
    e.stopPropagation();
    e.preventDefault();
    const currentUnit = formData.unit || 'Packet';
    removeCustomWeightFromStorage(currentUnit, weightToRemove);
    setCustomWeights(prev => prev.filter(w => w !== weightToRemove));
    setSelectedWeights(prev => prev.filter(w => w !== weightToRemove));
  };

  const currentUnit = formData.unit || 'Packet';
  const baseOptions = PREDEFINED_WEIGHTS[currentUnit] || ['1 ' + currentUnit, '2 ' + currentUnit, '5 ' + currentUnit];
  const allAvailableWeights = useMemo(() => {
    const list = [...baseOptions];
    customWeights.forEach(cw => {
      if (!list.includes(cw)) list.push(cw);
    });
    selectedWeights.forEach(sw => {
      if (!list.includes(sw)) list.push(sw);
    });
    return list;
  }, [baseOptions, customWeights, selectedWeights]);

  const handleReset = () => {
    if (product) {
      const allExistingWeights = (product.existingVariants && product.existingVariants.length > 0)
        ? product.existingVariants.map(v => v.measurement_value).filter(Boolean)
        : (product.measurement_value ? [product.measurement_value] : []);
      setFormData({ ...defaultState, ...product });
      setSelectedWeights(allExistingWeights);
      setCustomWeights(getStoredCustomWeights(product.unit || 'Packet'));
      setCustomWeightInput('');
    } else {
      setFormData(defaultState);
      setSelectedWeights([]);
      setCustomWeights(getStoredCustomWeights(defaultState.unit));
      setCustomWeightInput('');
      setIsCustomBrand(false);
      setIsCustomSubCategory(false);
    }
    setErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.category_id && !formData.category) newErrors.category = 'Main Category is required';
    if (!formData.brand_id && !formData.brand) newErrors.brand = 'Brand is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.keys(newErrors)[0];
      const element = document.getElementsByName(firstError)[0];
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit({
      ...formData,
      openingStock: formData.openingStock || '0',
      measurement_value: selectedWeights[0] || formData.measurement_value || '',
      weights: selectedWeights,
      existingVariants: product?.existingVariants || [],
      variantPrices: variantPrices
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 select-none">
      
      {/* Scrollable Form Body Container */}
      <fieldset disabled={readOnly} className="flex-grow p-6 space-y-6 overflow-y-visible bg-slate-50/30 dark:bg-slate-950/20">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARD 1: BASIC PRODUCT INFORMATION (Full Width) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span>📋</span> Basic Product Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              {/* Product Name */}
              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Product Name"
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 font-semibold bg-slate-50/50 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none ${errors.name ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-850'}`}
                />
                {errors.name && <p className="text-[10px] font-bold text-rose-600 mt-1">{errors.name}</p>}
              </div>

              {/* Unit */}
              <div>
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">
                  Unit (Measurement Parameter) <span className="text-rose-500">*</span>
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-bold text-slate-800 dark:text-slate-205 outline-none cursor-pointer"
                >
                  <option value="Packet">Packet</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Box">Box</option>
                  <option value="Kg">Kg (Kilogram)</option>
                  <option value="Grams">Grams (g)</option>
                  <option value="Litre">Litre (L)</option>
                  <option value="Ml">Ml (Millilitre)</option>
                  <option value="Sachet">Sachet</option>
                  <option value="Piece">Piece / Pcs</option>
                  <option value="Carton">Carton</option>
                  <option value="Dozen">Dozen</option>
                  <option value="Meter">Meter</option>
                </select>
              </div>

              {/* Weight / Size (Multi-select dropdown with checkboxes + custom option) */}
              <div className="relative" ref={weightDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest">
                    Weight / Size
                  </label>
                  {selectedWeights.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedWeights.length} variant{selectedWeights.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>

                {/* Dropdown Trigger Box */}
                <div
                  onClick={() => setIsWeightDropdownOpen((prev) => !prev)}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between cursor-pointer hover:border-emerald-500 transition-all focus:border-emerald-500"
                >
                  <div className="flex flex-wrap gap-1 items-center flex-1 pr-2">
                    {selectedWeights.length === 0 ? (
                      <span className="text-slate-400 font-semibold">
                        Select {formData.unit} weight(s) or add custom...
                      </span>
                    ) : (
                      selectedWeights.map((w) => (
                        <span
                          key={w}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs"
                        >
                          {w}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWeight(w);
                            }}
                            className="hover:text-rose-600 dark:hover:text-rose-400 text-xs font-black cursor-pointer ml-0.5 px-0.5"
                            title="Remove weight"
                          >
                            ×
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 select-none">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {formData.unit}
                    </span>
                    <span className={`text-[10px] transition-transform duration-200 ${isWeightDropdownOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Dropdown Menu */}
                {isWeightDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Pre-defined {formData.unit} Weights
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        Check to select / Uncheck to remove
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2.5">
                      {allAvailableWeights.map((w) => {
                        const isChecked = selectedWeights.includes(w);
                        const isCustom = !baseOptions.includes(w);
                        return (
                          <label
                            key={w}
                            className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border select-none ${
                              isChecked
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleWeight(w)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                              <span className="truncate">{w}</span>
                            </div>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomWeight(e, w)}
                                title="Remove custom weight"
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded text-[11px] leading-none ml-1 cursor-pointer font-bold"
                              >
                                ×
                              </button>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Custom Weight / Size input inside dropdown */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        + Custom Weight / Size:
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:border-emerald-500">
                          <input
                            type="text"
                            value={customWeightInput}
                            onChange={(e) => setCustomWeightInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomWeight();
                              }
                            }}
                            placeholder="Enter value (e.g. 15)"
                            className="w-full px-3 py-1.5 text-xs bg-transparent font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                          />
                          <div className="flex items-center px-2.5 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 select-none">
                            {UNIT_SUFFIX_MAP[formData.unit] || formData.unit}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCustomWeight}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected weights summary */}
                {selectedWeights.length > 0 && (
                  <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <span>✓</span>
                    <span>
                      {selectedWeights.length === 1
                        ? `Weight variant: ${selectedWeights[0]}`
                        : `${selectedWeights.length} variants will be created (${selectedWeights.join(', ')}) under this product.`}
                    </span>
                  </div>
                )}
              </div>


              {/* Product Image File */}
              <div className="sm:col-span-1 md:col-span-1">
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">Product Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 25 * 1024 * 1024) {
                        toast.error('Selected image exceeds 25MB limit.');
                        e.target.value = '';
                        return;
                      }
                      setFormData((prev) => ({ ...prev, imageFile: file, image: file.name }));
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 text-slate-600 dark:text-slate-455 font-semibold outline-none cursor-pointer"
                />
              </div>

            </div>
          </div>

          {/* CARD 2: CATEGORY & CLASSIFICATION (Full Width) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">🏷️ Category &amp; Classification</span>
              {loadingMasters && <span className="text-[10px] font-bold text-amber-600 animate-pulse">Loading active masters...</span>}
            </h3>
            
            {masterFetchError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700 font-bold">
                <span>{masterFetchError}</span>
                <button type="button" onClick={fetchMasters} className="underline hover:text-rose-900">Retry</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              {/* 1. Main Category Dropdown */}
              <div>
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">
                  Main Category <span className="text-rose-500">*</span>
                </label>
                <select
                  name="category_id"
                  value={formData.category_id || (selectedCatObj ? selectedCatObj.id : '')}
                  onChange={handleChange}
                  disabled={loadingMasters}
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer disabled:opacity-50 ${errors.category ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-850'}`}
                >
                  <option value="">Select Main Category</option>
                  {dbCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {errors.category && <p className="text-[10px] font-bold text-rose-600 mt-1">{errors.category}</p>}
              </div>

              {/* 2. Sub Category Dropdown */}
              <div>
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">
                  Sub Category
                </label>
                <select
                  name="sub_category_id"
                  value={isCustomSubCategory ? 'Custom' : (formData.sub_category_id || (dbSubCategories.find(s => s.name === formData.sub_category)?.id || ''))}
                  onChange={handleChange}
                  disabled={!formData.category_id && !formData.category}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-semibold text-slate-800 dark:text-slate-100 outline-none disabled:opacity-50 cursor-pointer"
                >
                  {!formData.category_id && !formData.category ? (
                    <option value="">Select Main Category First</option>
                  ) : activeSubCategories.length === 0 ? (
                    <option value="" disabled>No Sub Categories Available</option>
                  ) : (
                    <option value="">Select Sub Category</option>
                  )}
                  
                  {activeSubCategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                  
                  {(formData.category_id || formData.category) && (
                    <option value="Custom">+ Add Custom Sub Category...</option>
                  )}
                </select>

                {isCustomSubCategory && (
                  <input
                    type="text"
                    name="customSubCategory"
                    value={formData.sub_category}
                    onChange={handleChange}
                    placeholder="Enter custom sub category..."
                    className="w-full px-3 py-2 mt-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  />
                )}
              </div>

              {/* 3. Brand Dropdown (Mandatory) */}
              <div>
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">
                  Brand Name <span className="text-rose-500">*</span>
                </label>
                <select
                  name="brand_select"
                  value={isCustomBrand ? 'Custom' : (formData.brand_id || (dbBrands.find(b => b.name === formData.brand)?.id || ''))}
                  onChange={handleChange}
                  disabled={loadingMasters || (!formData.category_id && !formData.category)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer disabled:opacity-50 ${errors.brand ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-850'}`}
                >
                  {!formData.category_id && !formData.category ? (
                    <option value="">Select Main Category First</option>
                  ) : !formData.sub_category_id && !formData.sub_category ? (
                    <option value="">Select Sub Category First</option>
                  ) : activeBrands.length === 0 ? (
                    <option value="" disabled>No Brands Available for this Sub Category</option>
                  ) : (
                    <option value="">Select Brand</option>
                  )}
                  {activeBrands.map((br) => (
                    <option key={br.id} value={br.id}>{br.name}</option>
                  ))}
                  {(formData.category_id || formData.category) && (
                    <option value="Custom">+ Add Custom Brand...</option>
                  )}
                </select>
                {errors.brand && <p className="text-[10px] font-bold text-rose-600 mt-1">{errors.brand}</p>}

                {isCustomBrand && (
                  <input
                    type="text"
                    name="customBrand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="Enter custom brand name..."
                    className="w-full px-3 py-2 mt-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  />
                )}
              </div>

            </div>
          </div>


          {/* CARD 3: PRICING & TAX RATES (Full Width - Visible ONLY when editing details) */}
          {Boolean(product) && (
          <div 
            ref={pricingSectionRef}
            id="pricing-section"
            className={`md:col-span-2 bg-white dark:bg-slate-900 border p-5 rounded-2xl shadow-sm space-y-4 transition-all ${
              product?.focusPricing ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10' : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span className="text-base">💰</span> Price &amp; Tax Configuration / Rates Management
              </h3>
              {product && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-semibold text-slate-500">Active Variant:</span>
                  <span className="font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    ⚖️ {product.measurement_value || product.unit || 'Standard'}
                  </span>
                </div>
              )}
            </div>

            {/* Rates Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. New Selling Price */}
              <div>
                <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">
                  Selling Price / बिक्री दर (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-xs border border-emerald-300 dark:border-emerald-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 font-mono font-bold text-emerald-800 dark:text-emerald-200 placeholder-slate-400 outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Store customer price (POS selling rate)</p>
              </div>

              {/* 2. MRP */}
              <div>
                <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">
                  MRP / अधिकतम खुदरा मूल्य (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="mrp"
                    value={formData.mrp}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-mono font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Printed package MRP</p>
              </div>

              {/* 3. Purchase Cost */}
              <div>
                <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">
                  Purchase Price / खरीद लागत (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-mono font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Base wholesale purchase cost</p>
              </div>

              {/* 4. GST */}
              <div>
                <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">
                  GST Rate (%)
                </label>
                <select
                  name="gst"
                  value={formData.gst}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="0">0% (Exempted)</option>
                  <option value="5">5% (Essential)</option>
                  <option value="12">12% (Standard 1)</option>
                  <option value="18">18% (Standard 2)</option>
                  <option value="28">28% (Luxury)</option>
                </select>
                <p className="text-[9px] text-slate-400 mt-1">Applicable GST tax bracket</p>
              </div>
            </div>

            {/* Live Metrics: Discount & Margin calculations */}
            {(Number(formData.sellingPrice) > 0 || Number(formData.mrp) > 0 || Number(formData.purchasePrice) > 0) && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                {Number(formData.mrp) > Number(formData.sellingPrice) && Number(formData.sellingPrice) > 0 && (
                  <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <span>🏷️ Discount:</span>
                    <span>₹{(Number(formData.mrp) - Number(formData.sellingPrice)).toFixed(2)} ({(((Number(formData.mrp) - Number(formData.sellingPrice)) / Number(formData.mrp)) * 100).toFixed(1)}% OFF)</span>
                  </span>
                )}

                {Number(formData.sellingPrice) > Number(formData.purchasePrice) && Number(formData.purchasePrice) > 0 && (
                  <span className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <span>📈 Gross Margin:</span>
                    <span>₹{(Number(formData.sellingPrice) - Number(formData.purchasePrice)).toFixed(2)} ({(((Number(formData.sellingPrice) - Number(formData.purchasePrice)) / Number(formData.sellingPrice)) * 100).toFixed(1)}%)</span>
                  </span>
                )}

                {Number(formData.sellingPrice) > 0 && Number(formData.purchasePrice) > Number(formData.sellingPrice) && (
                  <span className="flex items-center gap-1.5 font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    <span>⚠️ Warning: Selling price is lower than purchase cost!</span>
                  </span>
                )}

                {Number(formData.mrp) > 0 && Number(formData.sellingPrice) > Number(formData.mrp) && (
                  <span className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <span>⚠️ Note: Selling price exceeds printed MRP.</span>
                  </span>
                )}
              </div>
            )}

            {/* Multi-variant prices table if more than 1 variant exists */}
            {product?.existingVariants && product.existingVariants.length > 1 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    All Pack Size Variants Pricing
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Set specific prices for each pack size below:
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2 px-3">Variant Weight/Size</th>
                        <th className="py-2 px-3">Barcode</th>
                        <th className="py-2 px-3">Purchase Price (₹)</th>
                        <th className="py-2 px-3">MRP (₹)</th>
                        <th className="py-2 px-3">Selling Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                      {product.existingVariants.map((v) => {
                        const isSelected = v.id === product.id;
                        const vPrice = variantPrices[v.id] || {
                          sellingPrice: v.sellingPrice ?? v.selling_price ?? '',
                          mrp: v.mrp ?? '',
                          purchasePrice: v.purchasePrice ?? v.purchase_price ?? ''
                        };
                        return (
                          <tr key={v.id} className={isSelected ? 'bg-amber-50/50 dark:bg-amber-950/20 font-bold' : ''}>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                ⚖️ {v.measurement_value || v.unit}
                              </span>
                              {isSelected && <span className="ml-2 text-[10px] text-amber-600 font-bold">(Active)</span>}
                            </td>
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{v.barcode || '—'}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.01"
                                value={isSelected ? formData.purchasePrice : vPrice.purchasePrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (isSelected) {
                                    setFormData(prev => ({ ...prev, purchasePrice: val }));
                                  }
                                  setVariantPrices(prev => ({
                                    ...prev,
                                    [v.id]: { ...(prev[v.id] || vPrice), purchasePrice: val }
                                  }));
                                }}
                                placeholder="0.00"
                                className="w-24 px-2 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-mono"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.01"
                                value={isSelected ? formData.mrp : vPrice.mrp}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (isSelected) {
                                    setFormData(prev => ({ ...prev, mrp: val }));
                                  }
                                  setVariantPrices(prev => ({
                                    ...prev,
                                    [v.id]: { ...(prev[v.id] || vPrice), mrp: val }
                                  }));
                                }}
                                placeholder="0.00"
                                className="w-24 px-2 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-mono"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.01"
                                value={isSelected ? formData.sellingPrice : vPrice.sellingPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (isSelected) {
                                    setFormData(prev => ({ ...prev, sellingPrice: val }));
                                  }
                                  setVariantPrices(prev => ({
                                    ...prev,
                                    [v.id]: { ...(prev[v.id] || vPrice), sellingPrice: val }
                                  }));
                                }}
                                placeholder="0.00"
                                className="w-24 px-2 py-1 text-xs border rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 font-mono font-bold text-emerald-700 dark:text-emerald-300"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

          {/* CARD 4: INVENTORY DETAILS (Full Width) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span>📦</span> Stock Control
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Minimum Alert Stock */}
              <div>
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">Min Stock Alert Threshold</label>
                <input
                  type="number"
                  name="minimumStock"
                  value={formData.minimumStock}
                  onChange={handleChange}
                  placeholder="5"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                />
              </div>

              {/* Maximum Capacity Stock */}
              <div>
                <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1">Max Storage Capacity</label>
                <input
                  type="number"
                  name="maximumStock"
                  value={formData.maximumStock}
                  onChange={handleChange}
                  placeholder="100"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* CARD 5: ADDITIONAL INFORMATION (Full Width) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span>✍️</span> Storage Description Notes
            </h3>
            
            <div>
              <label className="block text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest mb-1">Product Description Notes</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows="2"
                placeholder="Enter dynamic storage instructions, pack benefits, or description notes..."
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/20 font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none"
              />
            </div>
          </div>

        </div>
      </fieldset>

      {/* STICKY FOOTER ACTIONS */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
        {!readOnly ? (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer bg-white dark:bg-slate-900"
          >
            <ArrowPathIcon className="w-4 h-4 stroke-[2]" /> Reset Form
          </button>
        ) : (
          <div className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/50 px-3 py-1.5 rounded-xl">
            ⚠️ Viewing in Read-Only Mode
          </div>
        )}
        
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer bg-white dark:bg-slate-900"
          >
            Close View
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircleIcon className="w-4 h-4 stroke-[2]" /> Save Product Record
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProductForm;