
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    PlusIcon,
    MinusIcon,
    TrashIcon,
    ShoppingCartIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    UserIcon,
    CreditCardIcon,
    BanknotesIcon,
    ArrowPathIcon,
    DocumentArrowDownIcon,
    PrinterIcon,
    QrCodeIcon,
    CalendarDaysIcon,
    HashtagIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    QuestionMarkCircleIcon,
    CommandLineIcon,
} from '@heroicons/react/24/outline';
import { productsAPI, customersAPI, settingsAPI } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../common/CustomSelect';
import CustomDatePicker from '../common/CustomDatePicker';

/* ── Toast Notification ── */
const Toast = ({ toast }) => {
    if (!toast) return null;
    const isError = toast.type === 'error';
    return (
        <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border mx-auto w-fit mb-4 ${
                isError
                    ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
            }`}
        >
            {isError ? (
                <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.msg}
        </div>
    );
};

const ALL_PAYMENT_MODES = [
  'Cash',
  'UPI',
  'Credit / Udhaar',
  'Credit/Debit Card',
  'Bank Transfer',
  'Wallet',
  'Cheque',
  'Gift Voucher',
  'Store Credit'
];

const PAYMENT_METHODS = ALL_PAYMENT_MODES;

const isDiscreteUnit = (unitStr) => {
    if (!unitStr) return true;
    const u = String(unitStr).trim().toLowerCase();
    const metricKeywords = ['kg', 'kilogram', 'gram', 'grams', 'g', 'litre', 'liter', 'l', 'ml', 'millilitre', 'milliliter', 'meter', 'm'];
    return !metricKeywords.includes(u);
};

// Module-level in-memory cache for POS products & customers
let cachedPosData = {
    products: null,
    customers: null,
    timestamp: 0
};

export const invalidatePosDataCache = () => {
    cachedPosData = { products: null, customers: null, timestamp: 0 };
};

const SalesForm = ({ sale, onSubmit, onCancel }) => {
    const { user } = useAppSelector((state) => state.auth);
    const today = new Date().toISOString().split('T')[0];

    const storeInfo = (() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return {
                name: u.store_name || u.storeName || 'Kirana Mart',
                gstin: u.gstin || '',
                address: u.address || '',
                phone: u.phone || '',
            };
        } catch {
            return { name: 'Kirana Mart', gstin: '', address: '', phone: '' };
        }
    })();

    const printRef = useRef();
    const searchRef = useRef(null);
    const dropdownRef = useRef(null);
    const custDropdownRef = useRef(null);
    const customerSearchInputRef = useRef(null);
    const discountInputRef = useRef(null);
    const paymentSectionRef = useRef(null);

    /* ── Keyboard Shortcuts & Navigation State ── */
    const [selectedCartIndex, setSelectedCartIndex] = useState(-1);
    const [highlightedSearchIndex, setHighlightedSearchIndex] = useState(-1);
    const [showShortcutsHelpModal, setShowShortcutsHelpModal] = useState(false);

    /* ── Core State ── */
    const [items, setItems] = useState(sale?.items || []);
    const [customerType, setCustomerType] = useState('Walk-in');
    const [customerName, setCustomerName] = useState(sale?.customerName || 'Walk-in Customer');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerId, setCustomerId] = useState(sale?.customerId || 1);

    // Searchable Customer Select States
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Credit / Borrow Parameters
    const [dueDate, setDueDate] = useState(
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [amountPaid, setAmountPaid] = useState('0');

    const [paymentMethod, setPaymentMethod] = useState(sale?.paymentMethod || 'Cash');
    const [paymentStatus, setPaymentStatus] = useState('Paid');
    const [billDate, setBillDate] = useState(sale?.date || today);
    const [notes, setNotes] = useState(sale?.notes || '');
    const [cashReceived, setCashReceived] = useState('');
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [additionalCharges, setAdditionalCharges] = useState(0);

    // Split Payment Allocation State
    const [paymentRows, setPaymentRows] = useState(
        sale?.payments && sale.payments.length > 0
            ? sale.payments.map((p, idx) => ({
                id: idx + 1,
                paymentMethod: p.paymentMethod || 'Cash',
                amount: p.amount !== undefined ? p.amount : '',
                referenceNo: p.referenceNo || ''
              }))
            : [{ id: 1, paymentMethod: sale?.paymentMethod || 'Cash', amount: '', referenceNo: '' }]
    );

    const handleAddPaymentRow = () => {
        const totalEntered = paymentRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const rem = Math.max(0, grandTotal - totalEntered);
        setPaymentRows([
            ...paymentRows,
            { id: Date.now(), paymentMethod: 'UPI', amount: rem > 0 ? rem : '', referenceNo: '' }
        ]);
    };

    const handleRemovePaymentRow = (id) => {
        if (paymentRows.length === 1) return;
        setPaymentRows(paymentRows.filter(r => r.id !== id));
    };

    const handlePaymentRowChange = (id, field, value) => {
        setPaymentRows(paymentRows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [productsList, setProductsList] = useState(() => cachedPosData.products || []);
    const [customersList, setCustomersList] = useState(() => cachedPosData.customers || []);
    const [loadingProducts, setLoadingProducts] = useState(() => !cachedPosData.products);
    const showToast = (msg, type = 'error') => {
        if (type === 'error') toast.error(msg);
        else toast.success(msg);
    };

    /* ── Load Products & Customers from API with Smart Caching ── */
    const fetchProductsAndCustomers = async (force = false) => {
        const isFresh = cachedPosData.products && (Date.now() - cachedPosData.timestamp < 60000);
        if (!force && isFresh) {
            setProductsList(cachedPosData.products);
            setCustomersList(cachedPosData.customers || []);
            setLoadingProducts(false);
            return;
        }

        if (!cachedPosData.products) {
            setLoadingProducts(true);
        }
        try {
            const [prodRes, custRes] = await Promise.all([
                productsAPI.getAll({ limit: 500 }),
                customersAPI.getAll().catch(() => ({ customers: [] })),
            ]);
            if (prodRes?.success && Array.isArray(prodRes.products)) {
                cachedPosData.products = prodRes.products;
                setProductsList(prodRes.products);
            }
            if (custRes?.success || custRes?.customers) {
                cachedPosData.customers = custRes.customers || [];
                setCustomersList(custRes.customers || []);
            }
            cachedPosData.timestamp = Date.now();
        } catch (err) {
            console.warn('POS API lookup failed, falling back to cache...');
        } finally {
            setLoadingProducts(false);
        }
    };

    useEffect(() => {
        fetchProductsAndCustomers();

        let syncTimer = null;
        const handleCustSync = () => {
            clearTimeout(syncTimer);
            syncTimer = setTimeout(() => {
                customersAPI.getAll().then((custRes) => {
                    if (custRes?.success || custRes?.customers) {
                        const updated = custRes.customers || [];
                        cachedPosData.customers = updated;
                        setCustomersList(updated);
                    }
                }).catch(() => {});
            }, 300);
        };

        window.addEventListener('customer-updated', handleCustSync);
        window.addEventListener('borrow-updated', handleCustSync);
        return () => {
            clearTimeout(syncTimer);
            window.removeEventListener('customer-updated', handleCustSync);
            window.removeEventListener('borrow-updated', handleCustSync);
        };
    }, []);

    /* ── Click outside to close dropdowns ── */
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
            if (custDropdownRef.current && !custDropdownRef.current.contains(e.target)) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ── Customer Filtering List ── */
    const filteredCustomers = useMemo(() => {
        const q = searchCustomer.trim().toLowerCase();
        return customersList
            .filter((c) => {
                const matchType = c.customer_type === customerType;
                const matchText =
                    !q ||
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.phone || '').includes(q);
                return matchType && matchText;
            })
            .slice(0, 10);
    }, [searchCustomer, customersList, customerType]);

    /* ── Grouped Products by Name & Brand with Weight Variants (Tree Structure) ── */
    const [collapsedGroups, setCollapsedGroups] = useState({});

    const toggleGroupCollapse = (grpKey, e) => {
        e?.stopPropagation?.();
        setCollapsedGroups((prev) => ({
            ...prev,
            [grpKey]: !prev[grpKey]
        }));
    };

    const handleExpandAll = (e) => {
        e?.stopPropagation?.();
        setCollapsedGroups({});
    };

    const handleCollapseAll = (e) => {
        e?.stopPropagation?.();
        const all = {};
        groupedProducts.forEach((g) => {
            all[g.key] = true;
        });
        setCollapsedGroups(all);
    };

    const groupedProducts = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const groups = {};

        // Filter products matching search query across Name, Brand, Barcode, SKU, Weight (measurement_value), or Unit
        const matched = productsList.filter((p) => {
            if (!q) return true;
            const name = (p.name || '').toLowerCase();
            const brand = (p.brand || '').toLowerCase();
            const barcode = String(p.barcode || '').toLowerCase();
            const sku = String(p.sku || '').toLowerCase();
            const weight = String(p.measurement_value || '').toLowerCase();
            const unit = String(p.unit || '').toLowerCase();
            return (
                name.includes(q) ||
                brand.includes(q) ||
                barcode.includes(q) ||
                sku.includes(q) ||
                weight.includes(q) ||
                unit.includes(q)
            );
        });

        matched.forEach((p) => {
            const nameStr = (p.name || '').trim();
            const brandStr = (p.brand || '').trim();
            const grpKey = `${nameStr.toLowerCase()}__${brandStr.toLowerCase()}`;
            const displayName = brandStr ? `${nameStr} (${brandStr})` : nameStr;

            if (!groups[grpKey]) {
                groups[grpKey] = {
                    key: grpKey,
                    name: nameStr,
                    brand: brandStr,
                    displayName,
                    totalStock: 0,
                    variants: []
                };
            }
            const stock = Number(p.total_stock ?? p.stock ?? p.currentStock ?? 0);
            groups[grpKey].totalStock += stock;
            groups[grpKey].variants.push({
                ...p,
                stock
            });
        });

        return Object.values(groups);
    }, [searchQuery, productsList]);

    /* ── Flattened matched variants for keyboard navigation and quick lookups ── */
    const filteredProducts = useMemo(() => {
        return groupedProducts.flatMap((g) => g.variants);
    }, [groupedProducts]);

    const isInCart = (id) => items.some((i) => i.productId === id);

    const handleAddProduct = useCallback(
        (product) => {
            const currentStock = Number(product.total_stock ?? product.stock ?? product.currentStock ?? 0);

            if (currentStock <= 0) {
                showToast(`"${product.name}" is OUT OF STOCK!`, 'error');
                return;
            }

            setItems((prev) => {
                const existingIdx = prev.findIndex((i) => i.productId === product.id);
                if (existingIdx !== -1) {
                    const item = { ...prev[existingIdx] };
                    // Determine the current qty in base units
                    const newQtyBase = Number(item.quantity) + 1;
                    if (newQtyBase > currentStock) {
                        showToast(`Cannot add more. Available stock for "${product.name}" is ${currentStock} ${product.unit || 'Pcs'}.`, 'error');
                        return prev;
                    }
                    const updated = [...prev];
                    item.quantity = newQtyBase;
                    item.availableStock = currentStock;
                    // Sync inputQty to reflect the new quantity in the selected display unit
                    const sel = (item.selectedUnit || item.unit || 'Pcs').trim().toLowerCase();
                    const base = (item.unit || 'Pcs').trim().toLowerCase();
                    if ((base === 'kg' || base === 'kilogram') && (sel === 'g' || sel === 'grams')) {
                        item.inputQty = Number((newQtyBase * 1000).toFixed(3));
                    } else if ((base === 'litre' || base === 'l') && (sel === 'ml' || sel === 'millilitre')) {
                        item.inputQty = Number((newQtyBase * 1000).toFixed(3));
                    } else {
                        item.inputQty = newQtyBase;
                    }
                    const p = Number(item.price) || 0;
                    const d = Math.min(100, Math.max(0, Number(item.discount) || 0));
                    const g = Number(item.gst) || 0;
                    const sub = p * newQtyBase;
                    const discAmt = (sub * d) / 100;
                    const taxable = sub - discAmt;
                    item.subtotal = sub;
                    item.total = taxable + (taxable * g) / 100;
                    updated[existingIdx] = item;
                    return updated;
                } else {
                    const price = Number(product.selling_price || product.sellingPrice || 0);
                    const gst = Number(product.gst || 18);
                    const baseUnit = (product.unit || 'Pcs').trim();
                    const qty = 1;
                    const subtotal = price * qty;
                    const taxAmt = (subtotal * gst) / 100;
                    return [
                        ...prev,
                        {
                            productId: product.id,
                            name: product.name,
                            brand: product.brand || '',
                            barcode: product.barcode || '',
                            unit: baseUnit,
                            selectedUnit: baseUnit,
                            inputQty: 1,
                            measurement_value: product.measurement_value || '',
                            quantity: qty,
                            availableStock: currentStock,
                            price,
                            discount: 0,
                            gst,
                            subtotal,
                            total: subtotal + taxAmt,
                        },
                    ];
                }
            });
            setSearchQuery('');
            setTimeout(() => searchRef.current?.focus(), 50);
        },
        []
    );

    const handleRemoveItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const handleUpdateItem = (idx, field, value) => {
        setItems((prev) => {
            const updated = [...prev];
            const item = { ...updated[idx] };
            
            const base = (item.unit || 'Pcs').trim().toLowerCase();

            if (field === 'selectedUnit') {
                item.selectedUnit = value;
                const sel = (value || '').trim().toLowerCase();
                const rawQty = item.inputQty === '' ? 0 : Number(item.inputQty) || 0;
                let qtyInBaseUnit = rawQty;

                if ((base === 'kg' || base === 'kilogram') && (sel === 'g' || sel === 'grams')) {
                    qtyInBaseUnit = rawQty / 1000;
                } else if ((base === 'litre' || base === 'l') && (sel === 'ml' || sel === 'millilitre')) {
                    qtyInBaseUnit = rawQty / 1000;
                } else if (base === 'grams' && (sel === 'kg' || sel === 'kilogram')) {
                    qtyInBaseUnit = rawQty * 1000;
                } else if (base === 'ml' && (sel === 'litre' || sel === 'l')) {
                    qtyInBaseUnit = rawQty * 1000;
                }
                item.quantity = qtyInBaseUnit;
            } else if (field === 'inputQty' || field === 'quantity') {
                const discrete = isDiscreteUnit(item.unit);
                // Preserve empty string while user is typing; convert to number for calculations
                const isEmpty = value === '' || value === null || value === undefined;
                let rawVal = isEmpty ? '' : Number(value);

                // Enforce integer-only quantity for discrete count units (Packet, Box, Bottle, Piece, Pcs, Sachet, Carton, Dozen)
                if (discrete && rawVal !== '') {
                    rawVal = Math.max(1, Math.floor(rawVal));
                }

                // Always store what the user typed in inputQty (display field)
                item.inputQty = rawVal;

                // Use the current selectedUnit as-is — never silently mutate selectedUnit here.
                // The user changes the unit explicitly via the unit dropdown.
                const sel = (item.selectedUnit || item.unit || 'Pcs').trim().toLowerCase();

                // Convert display qty → base-unit qty for stock and billing
                const numericVal = Number(rawVal) || 0;
                let qtyInBaseUnit = numericVal;
                if (!discrete) {
                    if ((base === 'kg' || base === 'kilogram') && (sel === 'g' || sel === 'grams')) {
                        qtyInBaseUnit = numericVal / 1000;
                    } else if ((base === 'litre' || base === 'l') && (sel === 'ml' || sel === 'millilitre')) {
                        qtyInBaseUnit = numericVal / 1000;
                    } else if (base === 'grams' && (sel === 'kg' || sel === 'kilogram')) {
                        qtyInBaseUnit = numericVal * 1000;
                    } else if (base === 'ml' && (sel === 'litre' || sel === 'l')) {
                        qtyInBaseUnit = numericVal * 1000;
                    }
                }

                if (item.availableStock !== undefined && qtyInBaseUnit > item.availableStock) {
                    toast.error(`Cannot exceed available stock (${item.availableStock} ${item.unit || 'Pcs'}).`);
                    item.quantity = item.availableStock;
                    item.inputQty = (!discrete && (sel === 'g' || sel === 'ml')) ? item.availableStock * 1000 : item.availableStock;
                } else {
                    item.quantity = qtyInBaseUnit;
                }
            } else {
                item[field] = value;
            }

            const p = Number(item.price) || 0;
            const q = Math.max(0, Number(item.quantity) || 0);
            const d = Math.min(100, Math.max(0, Number(item.discount) || 0));
            const g = Number(item.gst) || 0;
            const sub = p * q;
            const discAmt = (sub * d) / 100;
            const taxable = sub - discAmt;
            item.subtotal = sub;
            item.total = taxable + (taxable * g) / 100;
            updated[idx] = item;
            return updated;
        });
    };

    /* ── Calculations ── */
    const subtotal = items.reduce(
        (s, i) => s + Number(i.price) * (Number(i.quantity) || 0),
        0
    );
    const totalItemDiscount = items.reduce((s, i) => {
        const sub = Number(i.price) * (Number(i.quantity) || 0);
        return s + (sub * (Number(i.discount) || 0)) / 100;
    }, 0);
    const totalGst = items.reduce((s, i) => {
        const sub = Number(i.price) * (Number(i.quantity) || 0);
        const discAmt = (sub * (Number(i.discount) || 0)) / 100;
        const taxable = sub - discAmt;
        return s + (taxable * (Number(i.gst) || 0)) / 100;
    }, 0);

    const discountAmount =
        totalItemDiscount + (subtotal * (Number(globalDiscount) || 0)) / 100;
    const afterDiscount = subtotal - discountAmount;
    const afterGst = afterDiscount + totalGst;
    const afterCharges = afterGst + Number(additionalCharges || 0);
    const grandTotal = Math.max(0, Math.round(afterCharges));

    // Resolve selected customer object and balances
    const selectedCustomerObj = useMemo(() => {
        if (!customerId || Number(customerId) === 1) return null;
        return customersList.find((c) => Number(c.id) === Number(customerId)) || null;
    }, [customersList, customerId]);

    const customerAdvanceBalance = Number(selectedCustomerObj?.advance_balance || 0);
    const customerPreviousDue = Number(selectedCustomerObj?.outstanding_balance || selectedCustomerObj?.balance || 0);

    // Dynamic auto-deduction of Advance Jama:
    const autoDeductAdvance = Math.min(grandTotal, customerAdvanceBalance);
    const netPayableAfterAdvance = Math.max(0, grandTotal - autoDeductAdvance);
    const remainingAdvanceAfterBill = Math.max(0, customerAdvanceBalance - autoDeductAdvance);

    // Live Payment & Split Payment Calculations
    const totalPaymentsEntered = paymentRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalCashEntered = paymentRows.filter(r => r.paymentMethod === 'Cash').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalNonCashEntered = paymentRows.filter(r => r.paymentMethod !== 'Cash').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    // Remaining balance to be paid by cash/online/udhaar after applying Advance Jama:
    const remainingBalance = Math.max(0, netPayableAfterAdvance - totalPaymentsEntered);
    const changeAmount = (totalPaymentsEntered > netPayableAfterAdvance && totalCashEntered > 0)
        ? Math.max(0, totalPaymentsEntered - netPayableAfterAdvance)
        : 0;

    // Auto-sync single payment mode amount when cart items / total changes
    useEffect(() => {
        if (customerType === 'Walk-in' && paymentRows.length === 1 && (paymentRows[0].amount === '' || paymentRows[0].isAuto)) {
            setPaymentRows([{ ...paymentRows[0], amount: netPayableAfterAdvance > 0 ? netPayableAfterAdvance : '', isAuto: true }]);
        }
    }, [netPayableAfterAdvance, customerType]);

    const [invoiceNumber] = useState(() =>
        sale?.invoiceNo || sale?.invoice_no || `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    );

    /* ── Submit POS checkout ── */
    const handleSubmit = () => {
        if (items.length === 0) {
            showToast('Please add at least one product to the cart.');
            return;
        }

        const zeroPriceItem = items.find(it => !Number(it.price) || Number(it.price) <= 0);
        if (zeroPriceItem) {
            showToast(`Item "${zeroPriceItem.name}" has zero selling price (₹0.00). Please set a valid selling price before checkout.`);
            return;
        }

        // Calculate non-credit actual money collected vs credit amounts
        const nonCreditRows = paymentRows.filter(r => 
            r.paymentMethod !== 'Credit / Udhaar' && 
            r.paymentMethod !== 'Credit/Borrow' && 
            r.paymentMethod !== 'Advance Jama' &&
            Number(r.amount) > 0
        );
        const creditRows = paymentRows.filter(r => 
            (r.paymentMethod === 'Credit / Udhaar' || r.paymentMethod === 'Credit/Borrow') && 
            Number(r.amount) > 0
        );

        const actualMoneyCollected = nonCreditRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const explicitCreditAmount = creditRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

        // Auto Advance Deduction calculation
        const remainingUnpaidBeforeAdvance = Math.max(0, grandTotal - actualMoneyCollected);
        const advanceToAutoDeduct = Math.min(remainingUnpaidBeforeAdvance, customerAdvanceBalance);
        const totalPaidAndCovered = actualMoneyCollected + advanceToAutoDeduct;

        const effectiveDueAmount = Math.max(0, explicitCreditAmount > 0 ? explicitCreditAmount : (grandTotal - totalPaidAndCovered));
        const effectiveAmountPaid = Math.min(grandTotal, totalPaidAndCovered);

        if (effectiveDueAmount > 0 && customerType !== 'Borrow') {
            showToast(`Unpaid credit balance of ₹${effectiveDueAmount.toFixed(2)} requires selecting a Borrow Customer profile.`);
            return;
        }

        if (customerType === 'Borrow' && (!customerId || customerId === 1)) {
            showToast('You must select or register a Borrow Customer profile for credit billing.');
            return;
        }

        const finalPaymentStatus = effectiveDueAmount <= 0 ? 'Paid' : (effectiveAmountPaid > 0 ? 'Partial' : 'Pending');

        const validPaymentRows = paymentRows.filter(r => Number(r.amount) > 0);
        const finalPaymentsList = validPaymentRows.map(r => ({
            paymentMethod: r.paymentMethod,
            amount: Number(r.amount || 0),
            referenceNo: r.referenceNo || ''
        }));

        if (advanceToAutoDeduct > 0) {
            finalPaymentsList.push({
                paymentMethod: 'Advance Jama',
                amount: advanceToAutoDeduct,
                referenceNo: 'Auto-Deducted from Wallet'
            });
        }

        let primaryPaymentMethodText = 'Cash';
        if (effectiveDueAmount === 0 && actualMoneyCollected === 0 && advanceToAutoDeduct > 0) {
            primaryPaymentMethodText = 'Advance Jama';
        } else if (advanceToAutoDeduct > 0 && actualMoneyCollected > 0) {
            primaryPaymentMethodText = `Split (${validPaymentRows[0]?.paymentMethod || 'Cash'} + Advance Jama)`;
        } else if (validPaymentRows.length === 1) {
            primaryPaymentMethodText = validPaymentRows[0].paymentMethod;
        } else if (validPaymentRows.length > 1) {
            primaryPaymentMethodText = `Split (${validPaymentRows.map(p => `${p.paymentMethod} ₹${p.amount}`).join(' + ')})`;
        } else if (effectiveDueAmount > 0) {
            primaryPaymentMethodText = 'Credit / Udhaar';
        }

        const payload = {
            customerType,
            customerName: customerType === 'Walk-in' ? customerName || 'Walk-in Customer' : customerName,
            customerPhone: customerType === 'Walk-in' ? customerPhone : '',
            customerId: customerType === 'Borrow' ? customerId : (selectedCustomerObj?.id || 1),
            dueDate: effectiveDueAmount > 0 ? dueDate : null,
            amountPaid: effectiveAmountPaid,
            dueAmount: effectiveDueAmount,
            paymentMethod: primaryPaymentMethodText,
            payments: finalPaymentsList,
            advanceCreditApplied: advanceToAutoDeduct,
            paymentStatus: finalPaymentStatus,
            date: billDate,
            notes,
            items,
            subtotal,
            discount: discountAmount,
            gstAmount: totalGst,
            total: grandTotal,
            invoiceNo: invoiceNumber,
        };

        console.log(`[POS Submit Checkout Log] Front-end Payload:`, JSON.stringify(payload));
        onSubmit(payload);
    };

    /* ── Comprehensive POS Keyboard Shortcut Engine (Tally / ERP Standard) ── */
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const isInputTarget = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName);

            // Alt + / or Alt + ? -> Toggle Keyboard Shortcuts Help Modal
            if (e.altKey && (e.key === '/' || e.key === '?')) {
                e.preventDefault();
                setShowShortcutsHelpModal((prev) => !prev);
                return;
            }

            // Esc -> Close Modals or Dropdowns
            if (e.key === 'Escape') {
                if (showShortcutsHelpModal) {
                    setShowShortcutsHelpModal(false);
                    return;
                }
                if (showDropdown) {
                    setShowDropdown(false);
                    return;
                }
                if (showCustomerDropdown) {
                    setShowCustomerDropdown(false);
                    return;
                }
            }

            // Function Keys (F1 - F12) & Ctrl shortcuts (Work everywhere on POS screen)
            if (e.key === 'F2') {
                e.preventDefault();
                setShowCustomerDropdown(true);
                setTimeout(() => customerSearchInputRef.current?.focus(), 50);
                return;
            }

            if (e.key === 'F3' || (e.ctrlKey && (e.key === 'f' || e.key === 'F'))) {
                e.preventDefault();
                searchRef.current?.focus();
                setShowDropdown(true);
                return;
            }

            if (e.key === 'F4') {
                e.preventDefault();
                if (items.length > 0) {
                    const targetIdx = selectedCartIndex >= 0 ? selectedCartIndex : items.length - 1;
                    const qtyInput = document.getElementById(`cart-item-qty-${targetIdx}`);
                    if (qtyInput) {
                        qtyInput.focus();
                        qtyInput.select();
                    }
                }
                return;
            }

            if (e.key === 'F5') {
                e.preventDefault();
                discountInputRef.current?.focus();
                discountInputRef.current?.select();
                return;
            }

            if (e.key === 'F6') {
                e.preventDefault();
                paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            if (e.key === 'F7' || (e.ctrlKey && (e.key === 's' || e.key === 'S'))) {
                e.preventDefault();
                if (items.length > 0) {
                    showToast('Bill held & draft state saved successfully!', 'success');
                } else {
                    showToast('POS cart is empty. Add products before holding bill.');
                }
                return;
            }

            if (e.key === 'F8' || e.key === 'F10' || e.key === 'F12') {
                e.preventDefault();
                handleSubmit();
                return;
            }

            if (e.key === 'F9' || (e.ctrlKey && (e.key === 'p' || e.key === 'P'))) {
                e.preventDefault();
                if (printRef.current) {
                    const printContents = printRef.current.innerHTML;
                    const win = window.open('', '', 'height=600,width=800');
                    win.document.write('<html><head><title>Print Invoice</title></head><body>');
                    win.document.write(printContents);
                    win.document.write('</body></html>');
                    win.document.close();
                    win.print();
                }
                return;
            }

            if (e.key === 'F11') {
                e.preventDefault();
                handleClearCart();
                return;
            }

            // Cart Row Selection / Deletion when not inside text inputs
            if (!isInputTarget) {
                if (e.key === 'Delete' && selectedCartIndex >= 0 && selectedCartIndex < items.length) {
                    e.preventDefault();
                    handleRemoveItem(selectedCartIndex);
                    setSelectedCartIndex(-1);
                    return;
                }

                if (e.key === 'ArrowDown' && !showDropdown && !showCustomerDropdown) {
                    e.preventDefault();
                    setSelectedCartIndex((prev) => Math.min(prev + 1, items.length - 1));
                    return;
                }

                if (e.key === 'ArrowUp' && !showDropdown && !showCustomerDropdown) {
                    e.preventDefault();
                    setSelectedCartIndex((prev) => Math.max(prev - 1, 0));
                    return;
                }
            }

            // Search Dropdown Keyboard Navigation (when search dropdown is visible)
            if (showDropdown && filteredProducts.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedSearchIndex((prev) => Math.min(prev + 1, filteredProducts.length - 1));
                    return;
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedSearchIndex((prev) => Math.max(prev - 1, 0));
                    return;
                }

                if (e.key === 'Enter' && highlightedSearchIndex >= 0 && highlightedSearchIndex < filteredProducts.length) {
                    e.preventDefault();
                    const chosen = filteredProducts[highlightedSearchIndex];
                    if (isInCart(chosen.id)) {
                        handleRemoveItem(items.findIndex((i) => i.productId === chosen.id));
                    } else {
                        handleAddProduct(chosen);
                    }
                    setHighlightedSearchIndex(-1);
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [
        items,
        selectedCartIndex,
        highlightedSearchIndex,
        showDropdown,
        showCustomerDropdown,
        showShortcutsHelpModal,
        filteredProducts,
        customerType,
        customerId,
        paymentRows,
        grandTotal,
        remainingBalance
    ]);

    const handleClearCart = () => {
        if (items.length > 0 && !window.confirm('Clear all items from current POS cart?')) return;
        setItems([]);
        setGlobalDiscount(0);
        setAdditionalCharges(0);
        setCashReceived('');
        setAmountPaid('0');
    };

    return (
        // MAIN WRAPPER - Light mode: white background, Dark mode: dark background
        <div className="flex flex-col h-auto lg:h-[92vh] min-h-screen lg:min-h-0 bg-white dark:bg-[#0b0d15] text-gray-800 dark:text-slate-100 font-sans select-none overflow-y-auto lg:overflow-hidden">
            {/* ─── POS HEADER BAR (Dark Emerald) ─── */}
            <div className="bg-[#0F4C3A] dark:bg-[#0a1f18] px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between border-b border-[#1a6b4f] dark:border-slate-800 flex-shrink-0 shadow-sm dark:shadow-none gap-3">
                <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-white/20 dark:bg-emerald-500/20 flex items-center justify-center shadow-lg shadow-black/10 dark:shadow-none">
                        <ShoppingCartIcon className="w-5 h-5 text-white stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-lg font-bold tracking-tight text-white dark:text-slate-100">
                            {storeInfo.name}
                            <span className="ml-2 text-[10px] font-mono bg-white/20 dark:bg-emerald-500/20 text-white dark:text-emerald-300 px-2 py-0.5 rounded border border-white/30 dark:border-emerald-500/30">
                                POS
                            </span>
                        </h1>
                        <p className="text-[10px] text-emerald-100 dark:text-slate-400 font-medium tracking-wider">
                            Terminal · {user?.name || 'Staff'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 sm:mt-0">
                    <button
                        type="button"
                        onClick={handleClearCart}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-white rounded-xl text-xs font-bold border border-white/30 dark:border-amber-500/40 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Start New Bill / Reset Cart (F11)"
                    >
                        <span>New Bill</span>
                        <span className="text-[9px] font-mono opacity-80 bg-black/20 px-1 py-0.5 rounded font-bold">F11</span>
                    </button>
                    <div className="flex items-center gap-2 bg-white/20 dark:bg-[#0d101a] border border-white/30 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white dark:text-emerald-300">
                        <HashtagIcon className="w-3.5 h-3.5 text-white/70 dark:text-emerald-400" />
                        {invoiceNumber}
                    </div>
                    <CustomDatePicker
                        value={billDate}
                        onChange={setBillDate}
                        color="emerald"
                        align="right"
                        className="!w-auto"
                        triggerClassName="flex items-center gap-2 bg-white/20 hover:bg-white/25 dark:bg-[#0d101a] dark:hover:bg-slate-800 border border-white/30 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white dark:text-emerald-300 transition-all cursor-pointer shadow-xs"
                    />
                    <button
                        onClick={onCancel}
                        className="p-2 bg-white/10 dark:bg-[#0d101a] hover:bg-white/20 dark:hover:bg-slate-800/60 text-white/80 dark:text-slate-400 hover:text-white dark:hover:text-white rounded-xl border border-white/30 dark:border-slate-800 transition-all cursor-pointer"
                        title="Exit POS Console (Esc)"
                    >
                        <XMarkIcon className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>
            </div>

            {/* ─── POS 3-COLUMN LAYOUT ─── */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden bg-gray-50 dark:bg-[#0b0d15] p-3 sm:p-4 gap-4" style={{ minHeight: 0 }}>
                {/* ─── COLUMN 1: PRODUCT SEARCH (TOP) + CUSTOMER (BOTTOM) ─── */}
                <div className="lg:col-span-3 flex flex-col bg-white dark:bg-[#11141f] border border-gray-200 dark:border-slate-800 rounded-2xl p-4 gap-4 overflow-y-auto shadow-sm dark:shadow-xl dark:shadow-black/20">
                    
                    {/* ─── PRODUCT SEARCH (MOVED TO TOP) ─── */}
                    <div className="flex-0" ref={dropdownRef}>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-2.5 mb-2.5">
                            <span className="flex items-center gap-2">
                                <QrCodeIcon className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" /> Search Products
                            </span>
                            <span className="text-[9px] font-mono bg-slate-100 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-bold">F3 / Ctrl+F</span>
                        </h3>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Type name or scan barcode..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowDropdown(true);
                                }}
                                onFocus={() => setShowDropdown(true)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const query = searchQuery.trim();
                                        if (!query) return;
                                        let match = productsList.find(
                                            (p) => String(p.barcode) === query || String(p.sku) === query
                                        );
                                        if (!match) {
                                            match = productsList.find(
                                                (p) => p.name?.toLowerCase() === query.toLowerCase()
                                            );
                                        }
                                        if (!match && groupedProducts.length === 1 && groupedProducts[0].variants.length === 1) {
                                            match = groupedProducts[0].variants[0];
                                        }
                                        if (match) {
                                            handleAddProduct(match);
                                        }
                                    }
                                }}
                                className="w-full pl-9 pr-4 py-2.5 text-xs border border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-[#0d101a] text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:border-[#0F4C3A] dark:focus:border-emerald-500 placeholder:text-gray-400 dark:placeholder:text-slate-600 transition-colors"
                            />
                        </div>

                        {showDropdown && (
                            <div className="agy-dropdown-panel mt-2 max-h-[360px] overflow-y-auto custom-scrollbar p-2 space-y-1.5 z-30 relative w-full">
                                {groupedProducts.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500 font-medium">
                                        {searchQuery ? 'No matching products found' : 'Start typing to search...'}
                                    </div>
                                ) : (
                                    <>
                                        {/* Dropdown Toolbar */}
                                        <div className="flex items-center justify-between pb-1.5 px-1 border-b border-gray-100 dark:border-slate-800 text-[11px] font-semibold text-gray-500 dark:text-slate-400 select-none">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#0F4C3A] dark:bg-emerald-400"></span>
                                                <span>{groupedProducts.length} Product{groupedProducts.length === 1 ? '' : 's'}</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const allCollapsed = groupedProducts.every((g) => collapsedGroups[g.key]);
                                                    if (allCollapsed) handleExpandAll(e);
                                                    else handleCollapseAll(e);
                                                }}
                                                className="text-[#0F4C3A] dark:text-emerald-400 hover:underline font-bold cursor-pointer text-[10px]"
                                            >
                                                {groupedProducts.every((g) => collapsedGroups[g.key]) ? 'Expand All' : 'Collapse All'}
                                            </button>
                                        </div>

                                        {/* Tree Structure Product Groups */}
                                        {groupedProducts.map((grp) => {
                                            const isCollapsed = Boolean(collapsedGroups[grp.key]);
                                            const anyInCart = grp.variants.some((v) => isInCart(v.id));

                                            return (
                                                <div
                                                    key={grp.key}
                                                    className={`border rounded-xl overflow-hidden transition-all shadow-2xs ${
                                                        anyInCart
                                                            ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/15 dark:bg-emerald-950/20'
                                                            : 'border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#141824]'
                                                    }`}
                                                >
                                                    {/* Parent Group Header (Product Name & Brand) */}
                                                    <div
                                                        onClick={(e) => toggleGroupCollapse(grp.key, e)}
                                                        className={`flex items-center justify-between px-3 py-2 text-xs font-bold cursor-pointer transition-colors select-none ${
                                                            isCollapsed
                                                                ? 'bg-gray-50/90 dark:bg-[#11141f] hover:bg-gray-100 dark:hover:bg-[#191e2d] text-gray-800 dark:text-slate-200'
                                                                : 'bg-emerald-50/40 dark:bg-emerald-950/40 text-gray-900 dark:text-slate-100 border-b border-gray-100 dark:border-slate-800/80'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => toggleGroupCollapse(grp.key, e)}
                                                                className="p-0.5 rounded text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                                                title={isCollapsed ? 'Open (Expand)' : 'Close (Collapse)'}
                                                            >
                                                                {isCollapsed ? (
                                                                    <ChevronRightIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                ) : (
                                                                    <ChevronDownIcon className="w-3.5 h-3.5 stroke-[2.5] text-emerald-600 dark:text-emerald-400" />
                                                                )}
                                                            </button>

                                                            <span
                                                                className="font-extrabold text-gray-900 dark:text-white tracking-tight truncate cursor-pointer"
                                                                title={grp.displayName}
                                                            >
                                                                {grp.displayName}
                                                            </span>

                                                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/50 text-[#0F4C3A] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                                {grp.variants.length} {grp.variants.length === 1 ? 'Weight' : 'Weights'}
                                                            </span>

                                                            {anyInCart && (
                                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-600 text-white shrink-0">
                                                                    ✓ In Cart
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold text-gray-500 dark:text-slate-400">
                                                            <span>
                                                                Stock:{' '}
                                                                <span className={grp.totalStock <= 0 ? 'text-red-500 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                                                    {grp.totalStock}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Child Weight Variants */}
                                                    {!isCollapsed && (
                                                        <div className="divide-y divide-gray-100 dark:divide-slate-800/80 bg-white dark:bg-[#141824]">
                                                            {grp.variants.map((v, vIdx) => {
                                                                const isLast = vIdx === grp.variants.length - 1;
                                                                const inCart = isInCart(v.id);
                                                                const stock = Number(v.total_stock ?? v.stock ?? 0);
                                                                const price = Number(v.selling_price || v.sellingPrice || 0);
                                                                const isHighlighted = highlightedSearchIndex >= 0 && filteredProducts[highlightedSearchIndex]?.id === v.id;

                                                                return (
                                                                    <div
                                                                        key={v.id}
                                                                        title={`${grp.displayName} (${v.measurement_value || v.unit || 'Standard'}) - Stock: ${stock}, Price: ₹${price.toFixed(2)}`}
                                                                        onClick={() =>
                                                                            inCart
                                                                                ? handleRemoveItem(
                                                                                      items.findIndex((i) => i.productId === v.id)
                                                                                  )
                                                                                : handleAddProduct(v)
                                                                        }
                                                                        className={`flex items-center justify-between px-2.5 py-1.5 pl-3.5 text-xs cursor-pointer transition-colors ${
                                                                            isHighlighted
                                                                                ? 'bg-emerald-100/90 dark:bg-emerald-900/60 ring-2 ring-emerald-500 z-10'
                                                                                : inCart
                                                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/50 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/60'
                                                                                : 'hover:bg-gray-50 dark:hover:bg-[#1c2233]'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span className="font-mono text-xs select-none text-gray-300 dark:text-slate-600 shrink-0">
                                                                                {grp.variants.length > 1 ? (isLast ? '└──' : '├──') : '└──'}
                                                                            </span>

                                                                            {/* Weight Badge */}
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/70 shrink-0 whitespace-nowrap">
                                                                                Weight: <strong>{v.measurement_value || v.unit || 'Standard'}</strong>
                                                                            </span>
                                                                        </div>

                                                                        {/* Right side: Stock Quantity (replacing + Add button) */}
                                                                        <div className="flex-shrink-0 flex items-center gap-1.5 ml-2 text-[10px] font-semibold text-gray-500 dark:text-slate-400">
                                                                            {inCart && (
                                                                                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 shrink-0">
                                                                                    ✓ In Cart
                                                                                </span>
                                                                            )}
                                                                            <span>
                                                                                Stock:{' '}
                                                                                <span className={stock <= 0 ? 'text-red-500 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                                                                    {stock}
                                                                                </span>
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── CUSTOMER SECTION (BELOW SEARCH) ─── */}
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-2.5">
                            <span className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" /> Customer Profile
                            </span>
                            <span className="text-[9px] font-mono bg-slate-100 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-bold">F2</span>
                        </h3>
                    </div>

                    {/* Segmented type switcher */}
                    <div>
                        <label className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                            Billing Type
                        </label>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 rounded-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    setCustomerType('Walk-in');
                                    setCustomerId(1);
                                    setCustomerName('Walk-in Customer');
                                    setCustomerPhone('');
                                    setPaymentMethod('Cash');
                                    setPaymentRows([{ id: 1, paymentMethod: 'Cash', amount: grandTotal > 0 ? grandTotal : '', isAuto: true }]);
                                }}
                                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                                    customerType === 'Walk-in'
                                        ? 'bg-[#0F4C3A] text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30'
                                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                Walk-in
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCustomerType('Borrow');
                                    const firstBorrow = customersList.find(
                                        (c) => c.customer_type === 'Borrow'
                                    );
                                    if (firstBorrow) {
                                        setCustomerId(firstBorrow.id);
                                        setCustomerName(firstBorrow.name);
                                        setCustomerPhone(firstBorrow.phone || '');
                                    } else {
                                        setCustomerId('');
                                        setCustomerName('');
                                        setCustomerPhone('');
                                    }
                                    setPaymentMethod('Credit / Udhaar');
                                    setPaymentRows([{ id: 1, paymentMethod: 'Credit / Udhaar', amount: 0, isAuto: false }]);
                                }}
                                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                                    customerType === 'Borrow'
                                        ? 'bg-[#0F4C3A] text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30'
                                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                Borrow (Udhaar)
                            </button>
                        </div>
                    </div>

                    {/* Dropdown Customer Selector */}
                    <div className="relative" ref={custDropdownRef}>
                        <label className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                            Select Profile
                        </label>
                        <div
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            className="w-full flex justify-between items-center bg-gray-50 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-200 cursor-pointer hover:border-[#0F4C3A] dark:hover:border-emerald-500 transition-colors"
                        >
                            <span className="truncate">{customerName || 'Select Customer...'}</span>
                            <ChevronDownIcon className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                        </div>

                        {showCustomerDropdown && (
                            <div className="agy-dropdown-panel absolute z-30 w-full mt-1 p-2 space-y-2 max-h-[220px] overflow-y-auto">
                                <div className="flex items-center gap-2 border border-gray-200 dark:border-slate-800 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-[#0d101a]">
                                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                                    <input
                                        ref={customerSearchInputRef}
                                        type="text"
                                        value={searchCustomer}
                                        onChange={(e) => setSearchCustomer(e.target.value)}
                                        placeholder="Search name or mobile (F2)..."
                                        className="w-full bg-transparent border-none text-xs text-gray-700 dark:text-slate-200 focus:outline-none py-1 font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    {filteredCustomers.length === 0 ? (
                                        <div className="text-center text-[11px] text-gray-400 dark:text-slate-500 py-3 italic">
                                            No matching customers found
                                        </div>
                                    ) : (
                                        filteredCustomers.map((c) => (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    setCustomerId(c.id);
                                                    setCustomerName(c.name);
                                                    setCustomerPhone(c.phone || '');
                                                    if (c.payment_mode) setPaymentMethod(c.payment_mode);
                                                    setShowCustomerDropdown(false);
                                                    setSearchCustomer('');
                                                }}
                                                className="text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#21262d] hover:text-gray-900 dark:hover:text-white p-2 rounded-lg cursor-pointer flex flex-col gap-0.5 transition-colors"
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <span>{c.name}</span>
                                                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                        {c.phone || 'No Mobile'}
                                                    </span>
                                                </div>
                                                {customerType === 'Borrow' && (
                                                    <div className="flex items-center gap-2 text-[9px] font-bold">
                                                        {Number(c.outstanding_balance || c.balance || 0) > 0 && (
                                                            <span className="text-red-600 dark:text-red-400">
                                                                ⚠ Bakaya: <span className="font-mono">₹{Number(c.outstanding_balance || c.balance || 0).toFixed(2)}</span>
                                                            </span>
                                                        )}
                                                        {Number(c.advance_balance || 0) > 0 && (
                                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                                💰 Jama: <span className="font-mono">₹{Number(c.advance_balance || 0).toFixed(2)}</span>
                                                            </span>
                                                        )}
                                                        {Number(c.outstanding_balance || c.balance || 0) <= 0 && Number(c.advance_balance || 0) <= 0 && (
                                                            <span className="text-slate-400 dark:text-slate-500 font-normal">
                                                                ✓ No Dues
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selected Customer Card */}
                    {customerType === 'Walk-in' ? (
                        <div className="space-y-2 bg-gray-50/70 dark:bg-[#0d101a]/70 border border-gray-200 dark:border-slate-800 p-3 rounded-xl">
                            <span className="text-[9px] font-bold text-[#0F4C3A] dark:text-emerald-400 uppercase tracking-widest block">
                                Walk-in Details
                            </span>
                            <input
                                type="text"
                                placeholder="Customer name (optional)"
                                value={customerName === 'Walk-in Customer' ? '' : customerName}
                                onChange={(e) => setCustomerName(e.target.value || 'Walk-in Customer')}
                                className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-[#0d101a] text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:border-[#0F4C3A] dark:focus:border-emerald-500 transition-colors"
                            />
                            <input
                                type="text"
                                placeholder="Mobile number"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                maxLength={10}
                                className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-[#0d101a] text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:border-[#0F4C3A] dark:focus:border-emerald-500 transition-colors font-mono"
                            />
                        </div>
                    ) : (
                        selectedCustomerCard(customerId, customersList)
                    )}
                </div>

                {/* ─── COLUMN 2: CART ─── */}
                <div className="lg:col-span-6 flex flex-col bg-white dark:bg-[#11141f] border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-black/20">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-[#0d101a]/50 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <ShoppingCartIcon className="w-4.5 h-4.5 text-[#0F4C3A] dark:text-emerald-400 stroke-[2]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                                Billing Cart
                            </span>
                            {items.length > 0 && (
                                <span className="text-[10px] font-bold text-[#0F4C3A] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                    {items.length} Items
                                </span>
                            )}
                        </div>
                        {items.length > 0 && (
                            <button
                                onClick={handleClearCart}
                                type="button"
                                className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1 bg-gray-100 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-800/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                                <TrashIcon className="w-3.5 h-3.5" /> Clear Cart
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500 py-16">
                                <ShoppingCartIcon className="w-14 h-14 mb-4 stroke-1 text-gray-300 dark:text-slate-700/60" />
                                <p className="text-sm font-bold text-gray-500 dark:text-slate-400">Cart is empty</p>
                                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">Search products to build the bill</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-gray-50/80 dark:bg-[#0d101a]/80 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
                                    <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                        <th className="px-4 py-3 w-[38%]">Product</th>
                                        <th className="px-3 py-3 text-center w-28">Qty</th>
                                        <th className="px-3 py-3 text-right w-24">Rate</th>
                                        <th className="px-3 py-3 text-center w-20">Disc%</th>
                                        <th className="px-3 py-3 text-center w-20">GST%</th>
                                        <th className="px-3 py-3 text-right w-28">Amount</th>
                                        <th className="px-2 py-3 w-10 text-center" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white/20 dark:bg-[#0d101a]/20 font-medium text-gray-700 dark:text-slate-300">
                                    {items.map((item, idx) => {
                                        const isSelectedRow = selectedCartIndex === idx;
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => setSelectedCartIndex(idx)}
                                                className={`transition-colors cursor-pointer ${
                                                    isSelectedRow
                                                        ? 'bg-[#0F4C3A]/10 dark:bg-emerald-950/60 font-bold border-l-4 border-l-[#0F4C3A] dark:border-l-emerald-500'
                                                        : 'hover:bg-gray-50/60 dark:hover:bg-[#1a1f2e]/50'
                                                }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="text-xs font-bold text-gray-800 dark:text-slate-100 truncate max-w-[220px]">
                                                        {item.name} {item.brand ? `(${item.brand})` : ''}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 dark:text-slate-500">
                                                        <span>{item.barcode || '—'}</span>
                                                        {item.measurement_value && (
                                                            <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                                                {item.measurement_value}
                                                            </span>
                                                        )}
                                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">({item.unit || 'Pcs'})</span>
                                                        {item.selectedUnit && item.selectedUnit !== item.unit && (
                                                            <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded">
                                                                = {item.quantity} {item.unit}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const discrete = isDiscreteUnit(item.unit);
                                                                const current = Number(item.inputQty !== undefined ? item.inputQty : item.quantity) || 0;
                                                                let delta = 1;
                                                                if (!discrete) {
                                                                    delta = (item.selectedUnit === 'g' || item.selectedUnit === 'ml') ? 100 : 0.1;
                                                                }
                                                                const minVal = discrete ? 1 : 0.001;
                                                                const newQty = Math.max(minVal, Number((current - delta).toFixed(3)));
                                                                handleUpdateItem(idx, 'inputQty', newQty);
                                                            }}
                                                            className="h-6 w-6 rounded bg-gray-100 dark:bg-[#0d101a] hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 flex items-center justify-center font-bold cursor-pointer border border-gray-200 dark:border-slate-800 transition-colors"
                                                            title="Decrease Quantity"
                                                        >
                                                            <MinusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        </button>

                                                        <input
                                                            id={`cart-item-qty-${idx}`}
                                                            type="number"
                                                            step={isDiscreteUnit(item.unit) ? '1' : (item.selectedUnit === 'g' || item.selectedUnit === 'ml' ? '1' : '0.001')}
                                                            min={isDiscreteUnit(item.unit) ? '1' : '0.001'}
                                                            value={item.inputQty !== undefined ? item.inputQty : item.quantity}
                                                            onChange={(e) =>
                                                                handleUpdateItem(
                                                                    idx,
                                                                    'inputQty',
                                                                    e.target.value
                                                                )
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-14 text-center bg-gray-50 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 py-1 rounded text-xs font-bold text-gray-800 dark:text-slate-100 font-mono focus:outline-none focus:border-[#0F4C3A] dark:focus:border-emerald-500"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const discrete = isDiscreteUnit(item.unit);
                                                                const current = Number(item.inputQty !== undefined ? item.inputQty : item.quantity) || 0;
                                                                let delta = 1;
                                                                if (!discrete) {
                                                                    delta = (item.selectedUnit === 'g' || item.selectedUnit === 'ml') ? 100 : 0.1;
                                                                }
                                                                const newQty = Number((current + delta).toFixed(3));
                                                                handleUpdateItem(idx, 'inputQty', newQty);
                                                            }}
                                                            className="h-6 w-6 rounded bg-gray-100 dark:bg-[#0d101a] hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 flex items-center justify-center font-bold cursor-pointer border border-gray-200 dark:border-slate-800 transition-colors"
                                                            title="Increase Quantity"
                                                        >
                                                            <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        </button>

                                                        {/* Unit Selector Toggle dropdown (e.g. Kg vs g, Litre vs ml) */}
                                                        {((item.unit || '').toLowerCase() === 'kg' || (item.unit || '').toLowerCase() === 'kilogram' || (item.unit || '').toLowerCase() === 'grams' || (item.unit || '').toLowerCase() === 'g') ? (
                                                            <select
                                                                value={item.selectedUnit || 'Kg'}
                                                                onChange={(e) => handleUpdateItem(idx, 'selectedUnit', e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="agy-unit-select bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ml-1"
                                                            >
                                                                <option value="Kg">Kg</option>
                                                                <option value="g">g (Grams)</option>
                                                            </select>
                                                        ) : ((item.unit || '').toLowerCase() === 'litre' || (item.unit || '').toLowerCase() === 'l' || (item.unit || '').toLowerCase() === 'ml') ? (
                                                            <select
                                                                value={item.selectedUnit || 'Litre'}
                                                                onChange={(e) => handleUpdateItem(idx, 'selectedUnit', e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="agy-unit-select bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ml-1"
                                                            >
                                                                <option value="Litre">L (Litre)</option>
                                                                <option value="ml">ml</option>
                                                            </select>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
                                                                {item.unit || 'Pcs'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-slate-200">
                                                ₹{Number(item.price).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-3">
                                                <input
                                                    type="number"
                                                    value={item.discount}
                                                    min="0"
                                                    max="100"
                                                    onChange={(e) =>
                                                        handleUpdateItem(
                                                            idx,
                                                            'discount',
                                                            Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                                        )
                                                    }
                                                    className="w-12 text-center bg-gray-50 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 py-0.5 rounded text-xs font-semibold text-gray-700 dark:text-slate-200 font-mono focus:outline-none focus:border-[#0F4C3A] dark:focus:border-emerald-500"
                                                />
                                            </td>
                                            <td className="px-3 py-3 text-center text-gray-500 dark:text-slate-400 font-mono">
                                                {item.gst}%
                                            </td>
                                            <td className="px-3 py-3 text-right font-bold font-mono text-gray-800 dark:text-slate-100">
                                                ₹{Number(item.total).toFixed(2)}
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#0d101a] transition-all cursor-pointer"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ─── COLUMN 3: SUMMARY & CHECKOUT ─── */}
                <div className="lg:col-span-3 min-w-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#11141f] border border-gray-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm dark:shadow-xl">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-[#0F4C3A] text-white rounded-lg shrink-0">
                                <DocumentArrowDownIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                                Billing Summary
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full shrink-0">
                            {items.length} {items.length === 1 ? 'Item' : 'Items'}
                        </span>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-3 scrollbar-thin min-w-0">
                        
                        {/* 1. Summary Metrics Cards */}
                        <div className="space-y-2 min-w-0">
                            <div className="grid grid-cols-3 gap-1.5 text-xs min-w-0">
                                <div className="bg-slate-50 dark:bg-[#0d101a] border border-slate-200/80 dark:border-slate-800 p-2 rounded-xl text-center min-w-0">
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider truncate">Subtotal</span>
                                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#0d101a] border border-slate-200/80 dark:border-slate-800 p-2 rounded-xl text-center min-w-0">
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider truncate">Discount</span>
                                    <span className="font-mono text-xs font-bold text-rose-500 block truncate">-₹{totalItemDiscount.toFixed(2)}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#0d101a] border border-slate-200/80 dark:border-slate-800 p-2 rounded-xl text-center min-w-0">
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider truncate">GST Tax</span>
                                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">₹{totalGst.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Grand Total Hero Card */}
                            <div className="bg-gradient-to-r from-[#0F4C3A] to-emerald-700 text-white rounded-xl p-3 flex justify-between items-center shadow-sm min-w-0">
                                <div>
                                    <span className="uppercase text-[9px] font-black tracking-wider block opacity-80">Grand Total</span>
                                    <span className="text-[10px] opacity-75 font-medium">Final Billed Amount</span>
                                </div>
                                <span className="font-mono text-xl font-black tracking-tight truncate">₹{grandTotal.toFixed(2)}</span>
                            </div>

                            {/* Previous Balance & Advance Adjustment for Udhaar Customers */}
                            {customerType === 'Borrow' && customerId && customerId !== 1 && (() => {
                                const selectedCust = customersList.find(c => c.id === customerId);
                                const prevBal = Number(selectedCust?.outstanding_balance || selectedCust?.balance || 0);
                                const advBal = Number(selectedCust?.advance_balance || 0);
                                if (prevBal <= 0 && advBal <= 0) return null;
                                return (
                                    <div className="space-y-1.5 pt-0.5 min-w-0">
                                        {advBal > 0 && (
                                            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 rounded-xl p-2 text-xs space-y-1">
                                                <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-300 font-bold">
                                                    <span className="text-[10px]">💰 Jama (Advance):</span>
                                                    <span className="font-mono">₹{advBal.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 text-[10px]">
                                                    <span>Auto-Applied to Bill:</span>
                                                    <span className="font-mono font-bold">-₹{Math.min(grandTotal, advBal).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-200 text-[10px] font-extrabold border-t border-emerald-200 dark:border-emerald-800/60 pt-0.5">
                                                    <span>Remaining Jama:</span>
                                                    <span className="font-mono">₹{Math.max(0, advBal - grandTotal).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {prevBal > 0 && (
                                            <div className="grid grid-cols-2 gap-1.5 min-w-0">
                                                <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 p-2 rounded-xl text-xs min-w-0">
                                                    <span className="text-rose-600 dark:text-rose-400 font-bold text-[10px] truncate">Pichla Bakaya</span>
                                                    <span className="font-mono text-rose-700 dark:text-rose-300 font-black truncate">₹{prevBal.toFixed(2)}</span>
                                                </div>
                                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 rounded-xl p-2 flex justify-between items-center text-xs font-bold text-amber-800 dark:text-amber-300 shadow-xs min-w-0">
                                                    <span className="text-[10px] truncate">Total Dues</span>
                                                    <span className="font-mono text-xs text-amber-900 dark:text-amber-100 font-black truncate">₹{(Math.max(0, grandTotal - advBal) + prevBal).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* 2. Payment Section */}
                        <div className="space-y-2.5 min-w-0 pt-1 border-t border-slate-100 dark:border-slate-800" ref={paymentSectionRef}>
                            <div className="flex items-center justify-between gap-1 min-w-0">
                                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 min-w-0 truncate">
                                    <CreditCardIcon className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 shrink-0" />
                                    <span className="truncate">Payment Method</span>
                                    <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded text-slate-500 font-bold shrink-0">F6</span>
                                </h3>
                                <div className="flex items-center gap-1 shrink-0">
                                    {customerType === 'Borrow' && (
                                        <button
                                            type="button"
                                            onClick={() => setPaymentRows([{ id: 1, paymentMethod: 'Credit / Udhaar', amount: 0 }])}
                                            className="flex items-center gap-0.5 text-[9px] font-black text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 transition-all cursor-pointer shadow-xs active:scale-95"
                                        >
                                            🤝 Udhaar
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleAddPaymentRow}
                                        className="flex items-center gap-0.5 text-[9px] font-black text-[#0F4C3A] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 transition-all cursor-pointer shadow-xs active:scale-95"
                                    >
                                        <PlusIcon className="w-3 h-3" /> + Split
                                    </button>
                                </div>
                            </div>

                            {/* Itemized Payment Rows */}
                            <div className="space-y-2 max-h-48 overflow-y-auto overflow-x-hidden pr-1 min-w-0">
                                {paymentRows.map((row, idx) => {
                                    const isCash = row.paymentMethod === 'Cash';
                                    const isUpi = row.paymentMethod === 'UPI';
                                    const isCard = row.paymentMethod.includes('Card');
                                    const isBorrow = row.paymentMethod.includes('Udhaar');
                                    
                                    return (
                                        <div
                                            key={row.id}
                                            className={`p-2.5 rounded-xl border transition-all min-w-0 ${
                                                isBorrow
                                                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                                                    : isCash
                                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                                                    : isUpi
                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50'
                                                    : isCard
                                                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50'
                                                    : 'bg-slate-50 dark:bg-[#0d101a] border-slate-200 dark:border-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <span className="text-xs font-black text-slate-400 shrink-0">#{idx + 1}</span>
                                                    <div className="flex-1 min-w-[130px]">
                                                        <CustomSelect
                                                            value={row.paymentMethod}
                                                            onChange={(val) => handlePaymentRowChange(row.id, 'paymentMethod', val)}
                                                            options={[
                                                                { value: 'Cash', label: '💵 Cash' },
                                                                { value: 'UPI', label: '📱 UPI / QR Code' },
                                                                { value: 'Credit/Debit Card', label: '💳 Card' },
                                                                { value: 'Bank Transfer', label: '🏦 Bank Transfer' },
                                                                { value: 'Wallet', label: '👛 Wallet' },
                                                                { value: 'Cheque', label: '📄 Cheque' },
                                                                { value: 'Gift Voucher', label: '🎁 Voucher' },
                                                                { value: 'Store Credit', label: '🏷️ Store Credit' },
                                                                ...(customerType === 'Borrow' ? [{ value: 'Credit / Udhaar', label: '🤝 Udhaar (Borrow Ledger)' }] : [])
                                                            ]}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="relative w-28 shrink-0">
                                                    <span className="absolute left-2.5 top-1 text-xs font-black text-slate-400">₹</span>
                                                    <input
                                                        type="number"
                                                        value={row.amount}
                                                        onChange={(e) => handlePaymentRowChange(row.id, 'amount', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full pl-6 pr-2 py-1 text-xs font-mono font-black text-right border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#121824] text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0F4C3A]"
                                                    />
                                                </div>

                                                {paymentRows.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePaymentRow(row.id)}
                                                        className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg transition-colors shrink-0"
                                                        title="Remove Payment Row"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Quick Cash Presets */}
                                            {isCash && (
                                                <div className="flex items-center gap-1 pt-1 flex-wrap">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mr-0.5">Quick:</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePaymentRowChange(row.id, 'amount', grandTotal)}
                                                        className="px-1.5 py-0.5 bg-white dark:bg-[#121824] border border-slate-300 dark:border-slate-700 rounded text-[9px] font-extrabold hover:bg-emerald-100 text-slate-700 dark:text-slate-300 transition-colors"
                                                    >
                                                        Exact (₹{grandTotal})
                                                    </button>
                                                    {[100, 200, 500, 2000].map(val => (
                                                        <button
                                                            key={val}
                                                            type="button"
                                                            onClick={() => handlePaymentRowChange(row.id, 'amount', val)}
                                                            className="px-1.5 py-0.5 bg-white dark:bg-[#121824] border border-slate-300 dark:border-slate-700 rounded text-[9px] font-bold hover:bg-emerald-100 text-slate-600 dark:text-slate-400 transition-colors"
                                                        >
                                                            ₹{val}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {!isCash && (
                                                <input
                                                    type="text"
                                                    value={row.referenceNo || ''}
                                                    onChange={(e) => handlePaymentRowChange(row.id, 'referenceNo', e.target.value)}
                                                    placeholder="Enter UTR / Txn Ref #"
                                                    className="w-full px-2 py-1 text-[10px] font-mono border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-[#121824] text-slate-700 dark:text-slate-300 mt-1"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Visual Payment Breakdown Cards */}
                            <div className="p-2.5 bg-slate-50 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 min-w-0">
                                {customerAdvanceBalance > 0 && (
                                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl space-y-1.5 text-xs min-w-0">
                                        <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-300 font-black">
                                            <span className="text-[10px] uppercase tracking-wider">💰 Advance Jama (Wallet):</span>
                                            <span className="font-mono text-sm">₹{customerAdvanceBalance.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                                            <span>⚡ Auto-Applied to Bill:</span>
                                            <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">-₹{autoDeductAdvance.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-200 text-xs font-extrabold border-t border-emerald-200 dark:border-emerald-800/60 pt-1">
                                            <span>Remaining Jama Wallet:</span>
                                            <span className="font-mono">₹{remainingAdvanceAfterBill.toFixed(2)}</span>
                                        </div>
                                        {netPayableAfterAdvance === 0 ? (
                                            <div className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-emerald-900/40 p-1.5 rounded-lg text-center mt-1 border border-emerald-300 dark:border-emerald-800/60">
                                                ✓ Full bill auto-covered by Advance Jama! No cash required.
                                            </div>
                                        ) : (
                                            <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1 rounded text-center mt-1 border border-amber-300 dark:border-amber-800/60">
                                                Remaining to collect / bill: ₹{netPayableAfterAdvance.toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Allocation Summary</div>
                                
                                <div className="grid grid-cols-2 gap-1.5 text-xs min-w-0">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 min-w-0">
                                        <div className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 truncate">💵 Cash</div>
                                        <div className="text-xs font-black font-mono truncate">₹{totalCashEntered.toFixed(2)}</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 min-w-0">
                                        <div className="text-[9px] font-bold uppercase text-indigo-600 dark:text-indigo-400 truncate">💳 Digital / Online</div>
                                        <div className="text-xs font-black font-mono truncate">₹{totalNonCashEntered.toFixed(2)}</div>
                                    </div>
                                </div>

                                {changeAmount > 0 && (
                                    <div className="p-2 rounded-lg bg-emerald-600 text-white font-extrabold flex justify-between items-center shadow-xs animate-pulse min-w-0">
                                        <span className="text-[10px] uppercase tracking-wider truncate">🪙 Change to Return:</span>
                                        <span className="font-mono text-sm font-black truncate">₹{changeAmount.toFixed(2)}</span>
                                    </div>
                                )}

                                {remainingBalance > 0 && (
                                    <div className="p-2 rounded-lg bg-rose-600 text-white font-extrabold flex justify-between items-center shadow-xs min-w-0">
                                        <span className="text-[10px] uppercase tracking-wider truncate">⚠️ Unpaid Balance:</span>
                                        <span className="font-mono text-sm font-black truncate">₹{remainingBalance.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Udhaar Settlement Panel */}
                            {customerType === 'Borrow' && (
                                <div className="p-3 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 dark:border-amber-700/60 rounded-xl space-y-2.5 min-w-0">
                                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5 min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded font-black text-[9px] shrink-0">🤝 UDHAAR</span>
                                            <h4 className="text-[11px] font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider truncate">
                                                Borrow Credit
                                            </h4>
                                        </div>
                                        <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 truncate">
                                            {customerName || 'Select Profile'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 text-xs min-w-0">
                                        <div className="p-1.5 bg-white dark:bg-[#121824] border border-amber-300 dark:border-amber-800/60 rounded-lg min-w-0">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block truncate">Net Bill To Pay</span>
                                            <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100 truncate block">₹{netPayableAfterAdvance.toFixed(2)}</span>
                                        </div>
                                        <div className="p-1.5 bg-white dark:bg-[#121824] border border-amber-300 dark:border-amber-800/60 rounded-lg min-w-0">
                                            <span className="text-[9px] font-bold text-rose-500 uppercase block truncate">Udhaar Dues</span>
                                            <span className="font-mono text-xs font-black text-rose-600 dark:text-rose-400 truncate block">₹{remainingBalance.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-amber-900 dark:text-amber-200 tracking-wider block">
                                            Repayment Due Date (Optional)
                                        </label>
                                        <CustomDatePicker
                                            value={dueDate}
                                            onChange={setDueDate}
                                            color="amber"
                                            placeholder="Select due date..."
                                        />
                                    </div>

                                    {!customerId || customerId === 1 ? (
                                        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20">
                                            ⚠️ Select a Borrow Customer profile before billing.
                                        </p>
                                    ) : remainingBalance <= 0 ? (
                                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                                            <span>✅</span> <strong>Bill fully covered by Advance Jama. No new Udhaar dues.</strong>
                                        </p>
                                    ) : (
                                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                                            <span>✅</span> <strong>₹{remainingBalance.toFixed(2)}</strong> will be credited to <strong>{customerName}</strong>.
                                        </p>
                                    )}
                                </div>
                            )}

                            {customerType !== 'Borrow' && remainingBalance > 0 && (
                                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 rounded-xl text-xs">
                                    <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                        ⚠️ Unpaid balance ₹{remainingBalance.toFixed(2)}. Switch to Borrow Customer profile for Udhaar billing.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Pinned Action Buttons */}
                    <div className="flex-shrink-0 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5 mt-2 min-w-0">
                        <button
                            onClick={handleSubmit}
                            type="button"
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0F4C3A] hover:bg-[#15634d] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-900/20 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <CheckCircleIcon className="w-4 h-4 stroke-[3]" />
                            {autoDeductAdvance > 0 && remainingBalance === 0
                                ? 'Complete Sale (Covered by Advance Jama)'
                                : 'Complete Sale'} <span className="text-[9px] font-mono opacity-80">(F8)</span>
                        </button>
                        <button
                            onClick={onCancel}
                            type="button"
                            className="w-full py-2 bg-slate-100 dark:bg-[#0d101a] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── KEYBOARD SHORTCUTS HELP MODAL (Alt + /) ─── */}
            <AnimatePresence>
                {showShortcutsHelpModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
                        onClick={() => setShowShortcutsHelpModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-[#111422] border border-gray-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5"
                        >
                            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                                        <CommandLineIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                            POS Keyboard Shortcuts Guide
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Ultra-fast cashier billing shortcuts (Tally / Retail ERP Standard)
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowShortcutsHelpModal(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                                {/* Category 1: Navigation & Focus */}
                                <div className="p-3.5 bg-slate-50 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                                    <h3 className="font-black uppercase text-[10px] tracking-wider text-emerald-600 dark:text-emerald-400">
                                        🚀 Navigation & Search Focus
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Search Product Box</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F3 / Ctrl+F</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Customer Profile Search</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F2</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Focus Global Discount</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F5</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Jump to Payment Breakdown</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F6</kbd>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 2: Cart Operations */}
                                <div className="p-3.5 bg-slate-50 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                                    <h3 className="font-black uppercase text-[10px] tracking-wider text-indigo-600 dark:text-indigo-400">
                                        🛒 Cart & Line Items
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Edit Item Quantity</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F4</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Navigate Search / Cart Items</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">↑ / ↓ Arrows</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Select Product from Dropdown</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">Enter</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Delete Active Cart Line</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">Delete</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Start New Bill / Clear Cart</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F11</kbd>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 3: Payment & Checkout */}
                                <div className="p-3.5 bg-slate-50 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                                    <h3 className="font-black uppercase text-[10px] tracking-wider text-rose-600 dark:text-rose-400">
                                        💳 Settlement & Checkout
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Complete Sale Checkout</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F8 / F10 / F12</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Hold / Save Draft Bill</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F7 / Ctrl+S</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Print Invoice Receipt</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">F9 / Ctrl+P</kbd>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 4: Customer & Dialogs */}
                                <div className="p-3.5 bg-slate-50 dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                                    <h3 className="font-black uppercase text-[10px] tracking-wider text-amber-600 dark:text-amber-400">
                                        👤 Customer & Modals
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Close Active Dialog</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">Esc</kbd>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Shortcuts Help Guide</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-[#1a2030] border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200">Alt + /</kbd>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-slate-800 pt-3 text-center text-[10px] text-slate-400 font-semibold">
                                Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold text-slate-700 dark:text-slate-300">Esc</kbd> or click anywhere outside to close this shortcuts guide.
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── PRINT TEMPLATE ─── */}
            <div style={{ display: 'none' }}>
                <div ref={printRef} style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {storeInfo.name}
                        </h2>
                        <p>{storeInfo.address}</p>
                        <p>Ph: {storeInfo.phone} | GSTIN: {storeInfo.gstin}</p>
                    </div>
                    <hr style={{ margin: '15px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <div>
                            <p>
                                <strong>INVOICE NO:</strong> {invoiceNumber}
                            </p>
                            <p>
                                <strong>DATE:</strong> {billDate}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p>
                                <strong>CUSTOMER:</strong> {customerName}
                            </p>
                            <p>
                                <strong>PAYMENT:</strong> {paymentMethod}{' '}
                                ({paymentMethod === 'Credit/Borrow' ? 'Credit' : 'Paid'})
                            </p>
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Price</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                        {item.name} {item.brand ? `(${item.brand})` : ''} {item.measurement_value ? `[${item.measurement_value}]` : ''}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                        {item.quantity}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                        ₹{Number(item.price).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                        ₹{Number(item.total).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '250px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                <span>Subtotal:</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                <span>Discounts:</span>
                                <span>-₹{discountAmount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                <span>GST:</span>
                                <span>₹{totalGst.toFixed(2)}</span>
                            </div>
                            <hr style={{ margin: '8px 0' }} />
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '15px',
                                    fontWeight: 'bold',
                                }}
                            >
                                <span>Total Amount:</span>
                                <span>₹{grandTotal.toFixed(2)}</span>
                            </div>

                            {/* Split Payment Print Breakdown */}
                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '11px' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px', color: '#64748b' }}>
                                    Payment Breakdown:
                                </div>
                                {paymentRows.map((pm, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                        <span>{pm.paymentMethod}{pm.referenceNo ? ` (${pm.referenceNo})` : ''}:</span>
                                        <span>₹{Number(pm.amount || 0).toFixed(2)}</span>
                                    </div>
                                ))}
                                {changeAmount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#0F4C3A', fontWeight: 'bold' }}>
                                        <span>Change Returned:</span>
                                        <span>₹{changeAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                {remainingBalance > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#dc2626', fontWeight: 'bold' }}>
                                        <span>Remaining Balance / Credit:</span>
                                        <span>₹{remainingBalance.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
                        <p>Thank you for shopping with us!</p>
                        <p>This is a system-generated statement.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Customer Profile Card ───
const selectedCustomerCard = (customerId, list) => {
    const match = list.find((c) => c.id === customerId);
    if (!match) {
        return (
            <div className="bg-gray-50 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 p-3 rounded-xl text-[11px] text-gray-400 dark:text-slate-500 font-medium italic text-center">
                No borrow profile selected. Search from existing customers or register in Borrow Ledger.
            </div>
        );
    }

    const prevBalance = Number(match.outstanding_balance || match.balance || 0);

    return (
        <div className="bg-gray-50 dark:bg-[#0d101a] border border-gray-200 dark:border-slate-800 p-3 rounded-xl text-xs font-medium text-gray-700 dark:text-slate-300 space-y-1.5">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-[9px] font-bold text-[#0F4C3A] dark:text-emerald-400 uppercase tracking-widest">
                    Active Profile
                </span>
                <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/40 text-[#0F4C3A] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    {match.customer_code || 'CUST'}
                </span>
            </div>
            <div>
                Name: <span className="text-gray-900 dark:text-white font-bold">{match.name}</span>
            </div>
            <div>
                Mobile: <span className="text-gray-800 dark:text-slate-200 font-mono">{match.phone || '—'}</span>
            </div>
            <div>
                Payment: <span className="text-gray-800 dark:text-slate-200">{match.payment_mode || 'Cash'}</span>
            </div>
            {match.address && (
                <div>
                    Address: <span className="text-gray-500 dark:text-slate-400">{match.address}</span>
                </div>
            )}
            {match.notes && (
                <div>
                    Notes: <span className="text-gray-500 dark:text-slate-400 italic">{match.notes}</span>
                </div>
            )}
            {/* ── Previous Outstanding Balance (Bakaya) & Advance Balance (Jama) ── */}
            {match.customer_type === 'Borrow' && (() => {
                const advBalance = Number(match.advance_balance || 0);
                return (
                    <div className="space-y-1.5 mt-1.5">
                        {advBalance > 0 && (
                            <div className="flex justify-between items-center p-2 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                    💰 Jama (Advance Credit)
                                </span>
                                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                                    ₹{advBalance.toFixed(2)}
                                </span>
                            </div>
                        )}
                        <div className={`flex justify-between items-center p-2 rounded-lg border ${
                            prevBalance > 0
                                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'
                                : advBalance > 0
                                ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50'
                        }`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                prevBalance > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : advBalance > 0
                                    ? 'text-slate-500 dark:text-slate-400'
                                    : 'text-green-600 dark:text-green-400'
                            }`}>
                                {prevBalance > 0 ? '⚠ Pichla Bakaya' : '✓ Dues: Clear'}
                            </span>
                            <span className={`font-mono font-bold text-sm ${
                                prevBalance > 0
                                    ? 'text-red-700 dark:text-red-300'
                                    : advBalance > 0
                                    ? 'text-slate-600 dark:text-slate-400'
                                    : 'text-green-700 dark:text-green-300'
                            }`}>
                                ₹{prevBalance.toFixed(2)}
                            </span>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SalesForm;