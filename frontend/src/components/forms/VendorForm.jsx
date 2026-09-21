import { useState, useEffect, useRef } from 'react';
import { validateEmailField } from '../../utils/validators';

const VendorForm = ({ vendor, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    phone: '',
    alternate_phone: '',
    email: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    categories_supplied: '',
    payment_terms: 'Net 30',
    credit_limit: '0.00',
    opening_balance: '0.00',
    opening_balance_type: 'Payable',
    status: 'Active',
    notes: '',
    bank_name: '',
    account_number: '',
    ifsc_code: ''
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Field Refs for focusing cursor on validation error
  const nameRef = useRef(null);
  const companyNameRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const gstinRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        company_name: vendor.company_name || '',
        contact_person: vendor.contact_person || '',
        phone: vendor.phone || '',
        alternate_phone: vendor.alternate_phone || '',
        email: vendor.email || '',
        gstin: vendor.gstin || '',
        pan: vendor.pan || '',
        address: vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        pincode: vendor.pincode || '',
        categories_supplied: vendor.categories_supplied || '',
        payment_terms: vendor.payment_terms || 'Net 30',
        credit_limit: vendor.credit_limit || '0.00',
        opening_balance: vendor.opening_balance || '0.00',
        opening_balance_type: vendor.opening_balance_type || 'Payable',
        status: vendor.status || 'Active',
        notes: vendor.notes || '',
        bank_name: vendor.bank_name || '',
        account_number: vendor.account_number || '',
        ifsc_code: vendor.ifsc_code || ''
      });
    }
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'phone' || name === 'alternate_phone') {
      finalValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (formError) {
      setFormError('');
    }
  };

  const focusAndScrollToField = (fieldName) => {
    const refMap = {
      name: nameRef,
      company_name: companyNameRef,
      phone: phoneRef,
      email: emailRef,
      gstin: gstinRef,
      pan: panRef
    };
    const targetRef = refMap[fieldName];
    if (targetRef && targetRef.current) {
      targetRef.current.focus();
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setErrors({});

    // Client-side quick validations
    const newErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Supplier name is required';
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = 'Supplier mobile number is required';
    } else if (formData.phone.replace(/\D/g, '').length !== 10) {
      newErrors.phone = 'Supplier mobile number must be exactly 10 digits';
    }

    if (formData.alternate_phone?.trim() && formData.alternate_phone.replace(/\D/g, '').length !== 10) {
      newErrors.alternate_phone = 'Alternate mobile number must be exactly 10 digits';
    }

    if (formData.email?.trim()) {
      const emailErr = validateEmailField(formData.email, false);
      if (emailErr) {
        newErrors.email = emailErr;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstInvalidField = Object.keys(newErrors)[0];
      focusAndScrollToField(firstInvalidField);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      const apiMsg = err.response?.data?.message || err.message || 'Error saving supplier profile';
      const returnedField = err.response?.data?.field || null;
      setFormError(apiMsg);

      let targetField = returnedField;
      if (!targetField) {
        const lowerMsg = apiMsg.toLowerCase();
        if (lowerMsg.includes('gstin')) targetField = 'gstin';
        else if (lowerMsg.includes('mobile') || lowerMsg.includes('phone')) targetField = 'phone';
        else if (lowerMsg.includes('email')) targetField = 'email';
        else if (lowerMsg.includes('name')) targetField = 'name';
        else if (lowerMsg.includes('pan')) targetField = 'pan';
      }

      if (targetField) {
        setErrors({ [targetField]: apiMsg });
        focusAndScrollToField(targetField);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="p-6 space-y-6 select-none overflow-y-auto max-h-[78vh] bg-slate-50/40 dark:bg-slate-900/40">
      {/* Top Error Banner */}
      {formError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>{formError}</span>
          </div>
        </div>
      )}

      {/* SECTION 1: BUSINESS & CONTACT PROFILE */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              🏢
            </div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Business & Contact Profile
            </h4>
          </div>
          <span className="text-[10px] font-bold text-slate-400">Fields marked with <span className="text-rose-500">*</span> are mandatory</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Supplier / Contact Person <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Contact person name"
              className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-none bg-slate-50/60 dark:bg-slate-950/50 font-bold transition-all ${
                errors.name ? 'border-rose-500 ring-2 ring-rose-200 text-rose-900 dark:text-rose-200 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-800 dark:text-white'
              }`}
            />
            {errors.name && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <span>⚠️</span> {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Company / Business Name <span className="text-rose-500">*</span>
            </label>
            <input
              ref={companyNameRef}
              type="text"
              name="company_name"
              value={formData.company_name || ''}
              onChange={handleChange}
              placeholder="Company / Business name"
              className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-none bg-slate-50/60 dark:bg-slate-950/50 font-bold transition-all ${
                errors.company_name ? 'border-rose-500 ring-2 ring-rose-200 text-rose-900 dark:text-rose-200 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-800 dark:text-white'
              }`}
            />
            {errors.company_name && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <span>⚠️</span> {errors.company_name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Authorized Contact Person</label>
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person || ''}
              onChange={handleChange}
              placeholder="Authorized representative"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Mobile / Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              ref={phoneRef}
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              maxLength={10}
              placeholder="10-digit mobile number"
              className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-none bg-slate-50/60 dark:bg-slate-950/50 font-bold font-mono transition-all ${
                errors.phone ? 'border-rose-500 ring-2 ring-rose-200 text-rose-900 dark:text-rose-200 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-800 dark:text-white'
              }`}
            />
            {errors.phone && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <span>⚠️</span> {errors.phone}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Alternate Mobile Number</label>
            <input
              type="text"
              name="alternate_phone"
              value={formData.alternate_phone || ''}
              onChange={handleChange}
              maxLength={10}
              placeholder="Alternate mobile number"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
            <input
              ref={emailRef}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
              className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-none bg-slate-50/60 dark:bg-slate-950/50 font-bold transition-all ${
                errors.email ? 'border-rose-500 ring-2 ring-rose-200 text-rose-900 dark:text-rose-200 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-800 dark:text-white'
              }`}
            />
            {errors.email && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <span>⚠️</span> {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">GSTIN (Taxes) Registration</label>
            <input
              ref={gstinRef}
              type="text"
              name="gstin"
              value={formData.gstin || ''}
              onChange={handleChange}
              placeholder="GSTIN Number"
              className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-none bg-slate-50/60 dark:bg-slate-950/50 font-mono font-bold transition-all ${
                errors.gstin ? 'border-rose-500 ring-2 ring-rose-200 text-rose-900 dark:text-rose-200 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-850 dark:text-white'
              }`}
            />
            {errors.gstin && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <span>⚠️</span> {errors.gstin}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">PAN Card Number</label>
            <input
              ref={panRef}
              type="text"
              name="pan"
              value={formData.pan || ''}
              onChange={handleChange}
              placeholder="PAN card number"
              className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-none bg-slate-50/60 dark:bg-slate-950/50 font-mono font-bold transition-all ${
                errors.pan ? 'border-rose-500 ring-2 ring-rose-200 text-rose-900 dark:text-rose-200 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-850 dark:text-white'
              }`}
            />
            {errors.pan && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <span>⚠️</span> {errors.pan}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Product Categories Supplied</label>
            <input
              type="text"
              name="categories_supplied"
              value={formData.categories_supplied || ''}
              onChange={handleChange}
              placeholder="e.g. Groceries, Spices, Oils"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: GEOGRAPHICAL ADDRESS DETAILS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            📍
          </div>
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Address & Location Details
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Complete Office / Shop Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street / Building / Shop address"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">City</label>
            <input
              type="text"
              name="city"
              value={formData.city || ''}
              onChange={handleChange}
              placeholder="City"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">State</label>
            <input
              type="text"
              name="state"
              value={formData.state || ''}
              onChange={handleChange}
              placeholder="State"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Pincode</label>
            <input
              type="text"
              name="pincode"
              value={formData.pincode || ''}
              onChange={handleChange}
              placeholder="Pincode"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: BANKING & SETTLEMENT DETAILS + STATUS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            🏦
          </div>
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Banking & Status Specifications
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Bank Name</label>
            <input
              type="text"
              name="bank_name"
              value={formData.bank_name || ''}
              onChange={handleChange}
              placeholder="Bank name"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Account Number</label>
            <input
              type="text"
              name="account_number"
              value={formData.account_number || ''}
              onChange={handleChange}
              placeholder="Account number"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">IFSC Code</label>
            <input
              type="text"
              name="ifsc_code"
              value={formData.ifsc_code || ''}
              onChange={handleChange}
              placeholder="IFSC code"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Supplier Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 4: ADMINISTRATIVE NOTES */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            📝
          </div>
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Internal Administrative Notes
          </h4>
        </div>
        <div>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            rows="2"
            placeholder="Add internal supplier notes or remarks..."
            className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 bg-slate-50/60 dark:bg-slate-950/50 font-bold text-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md py-3 -mx-6 px-6 shadow-lg z-10">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
        >
          {submitting ? 'Saving...' : vendor ? 'Update Supplier Specs' : 'Save Supplier Partner'}
        </button>
      </div>
    </form>
  );
};

export default VendorForm;

