import React from 'react';
import { getLogoUrl } from '../../utils/logoHelper';

const PurchaseInvoicePrintTemplate = ({ purchase, storeInfo, ref }) => {
  if (!purchase) return null;

  // Helper validators to detect and suppress mock/dummy strings
  const isDummyAddress = (addr) => {
    if (!addr) return true;
    const s = String(addr).toLowerCase().trim();
    return s === '' || s.includes('enter store address') || s.includes('malviya nagar') || s.includes('main commercial market') || s.includes('main market, city center') || s.includes('commercial supplier depot');
  };

  const isDummyPhone = (p) => {
    if (!p) return true;
    const s = String(p).replace(/\D/g, '');
    return s === '' || s === '0000000000' || s === '00000000' || s.startsWith('000000') || s === '9876543210' || s === '9812345678';
  };

  const isDummyGstin = (g) => {
    if (!g) return true;
    const s = String(g).trim().toUpperCase();
    return s === '' || s === '07AAAAA1111A1Z1' || s === '07BBBCC2222B2Z2' || s === '000000000000000' || s.startsWith('000000');
  };

  const isDummyEmail = (e) => {
    if (!e) return true;
    const s = String(e).toLowerCase().trim();
    return s === '' || s.includes('support@kiranamart.com') || s.includes('billing@supplier.com');
  };

  // Real Store Details
  const rawStoreName = storeInfo?.store_name || storeInfo?.name || purchase.store_name || purchase.storeName || '';
  const storeName = (rawStoreName && rawStoreName !== 'KIRANA MART ERP' && rawStoreName !== 'Kirana Mart Enterprise') ? rawStoreName : 'Store Invoice';

  const rawStoreAddress = storeInfo?.address || storeInfo?.store_address || purchase.store_address || '';
  const storeAddress = !isDummyAddress(rawStoreAddress) ? rawStoreAddress : '';

  const rawStoreGstin = storeInfo?.gstin || purchase.store_gstin || '';
  const storeGstin = !isDummyGstin(rawStoreGstin) ? rawStoreGstin : '';

  const rawStorePhone = storeInfo?.phone || storeInfo?.store_phone || purchase.store_phone || '';
  const storePhone = !isDummyPhone(rawStorePhone) ? rawStorePhone : '';

  const rawStoreEmail = storeInfo?.email || storeInfo?.store_email || purchase.store_email || '';
  const storeEmail = !isDummyEmail(rawStoreEmail) ? rawStoreEmail : '';

  const storeLogo = storeInfo?.logo_url || storeInfo?.store_logo || purchase.store_logo || null;

  // Invoice Reference Specs
  const invoiceNo = purchase.purchaseNo || purchase.purchase_no || purchase.invoiceNo || purchase.invoice_no || 'DRAFT';
  const poNo = purchase.purchase_order_no || purchase.poNo || purchase.po_no || purchase.purchaseOrderNo || null;
  const invoiceDate = purchase.date ? new Date(purchase.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const purchaseDate = purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : invoiceDate;
  
  const paymentStatus = (purchase.paymentStatus || purchase.payment_status || 'Paid').toUpperCase();
  const deliveryStatus = (purchase.deliveryStatus || purchase.delivery_status || 'Received').toUpperCase();
  const receivedBy = purchase.receivedBy || purchase.user_name || purchase.prepared_by || 'Store Staff';

  // Vendor Details
  const vendorName = purchase.vendor || purchase.vendor_name || 'Vendor';
  const vendorCompany = purchase.vendor_company || purchase.company_name || vendorName;
  const rawVendorAddr = purchase.vendor_full_address || purchase.vendor_address || purchase.address || '';
  const vendorAddress = !isDummyAddress(rawVendorAddr) ? rawVendorAddr : '';
  const rawVendorPhone = purchase.vendor_phone || purchase.phone || '';
  const vendorPhone = !isDummyPhone(rawVendorPhone) ? rawVendorPhone : '';
  const rawVendorEmail = purchase.vendor_email || purchase.email || '';
  const vendorEmail = !isDummyEmail(rawVendorEmail) ? rawVendorEmail : '';
  const rawVendorGstin = purchase.vendor_gstin || purchase.gstin || '';
  const vendorGstin = !isDummyGstin(rawVendorGstin) ? rawVendorGstin : '';
  const vendorContactPerson = purchase.vendor_contact_person || purchase.contact_person || purchase.contactPerson || '';

  // Items List
  const rawItems = purchase.items || purchase.products || [];
  const items = Array.isArray(rawItems) ? rawItems : [];

  // Financial Calculations
  const subtotal = Number(purchase.subtotal || purchase.subTotal || items.reduce((acc, i) => acc + (Number(i.quantity || i.qty || 0) * Number(i.purchase_price || i.price || 0)), 0));
  const discount = Number(purchase.discount || purchase.discountAmount || 0);
  const gstAmount = Number(purchase.gst_amount || purchase.gstAmount || purchase.tax || 0);
  const cgstAmount = (gstAmount / 2).toFixed(2);
  const sgstAmount = (gstAmount / 2).toFixed(2);
  const otherCharges = Number(purchase.other_charges || purchase.otherCharges || 0);
  const grandTotal = Number(purchase.total || purchase.grandTotal || (subtotal - discount + gstAmount + otherCharges));
  const paidAmount = Number(purchase.paid_amount || purchase.paidAmount || (paymentStatus === 'PAID' ? grandTotal : 0));
  const pendingAmount = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));
  const roundOff = (grandTotal - Math.floor(grandTotal)).toFixed(2);

  return (
    <div
      ref={ref}
      className="print-paper w-full max-w-[860px] mx-auto bg-white text-slate-900 p-6 md:p-8 font-sans shadow-md border border-slate-200 rounded-sm print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full select-none"
    >
      
      {/* ── 1. HEADER SECTION ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
        
        {/* Store Info Left */}
        <div>
          <div className="flex items-center gap-3">
            {storeLogo && (
              <img
                src={getLogoUrl(storeLogo)}
                alt={storeName}
                className="w-12 h-12 object-contain rounded border border-slate-200"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight leading-tight uppercase">
                {storeName}
              </h1>
              {storeAddress && (
                <p className="text-[11px] text-slate-600 font-medium mt-0.5 max-w-sm leading-snug">
                  {storeAddress}
                </p>
              )}
            </div>
          </div>

          {(storeGstin || storePhone || storeEmail) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-[11px] font-medium text-slate-700">
              {storeGstin && (
                <span>GSTIN: <strong className="font-mono font-bold text-slate-900">{storeGstin}</strong></span>
              )}
              {storePhone && (
                <span>{storeGstin ? '• ' : ''}Phone: <strong className="font-bold text-slate-900">{storePhone}</strong></span>
              )}
              {storeEmail && (
                <span>{(storeGstin || storePhone) ? '• ' : ''}Email: <strong className="font-bold text-slate-900">{storeEmail}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* Invoice Title & Meta Info Right */}
        <div className="text-left sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <div className="inline-block bg-slate-900 text-white px-3.5 py-1 rounded text-xs font-black uppercase tracking-widest mb-2">
            PURCHASE INVOICE
          </div>
          <div className="space-y-1 text-[11px] font-medium text-slate-700">
            <p>Invoice No: <strong className="font-mono font-bold text-slate-950 text-xs">{invoiceNo}</strong></p>
            {poNo && <p>PO Reference: <strong className="font-mono font-bold text-slate-950">{poNo}</strong></p>}
            <p>Invoice Date: <strong className="font-bold text-slate-950">{invoiceDate}</strong></p>
            {purchaseDate && purchaseDate !== invoiceDate && (
              <p>Purchase Date: <strong className="font-bold text-slate-950">{purchaseDate}</strong></p>
            )}
            <div className="flex items-center gap-1.5 justify-start sm:justify-end mt-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {paymentStatus}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-extrabold uppercase tracking-wider">
                {deliveryStatus}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 2. VENDOR & BILLING DETAILS SECTION ── */}
      <div className="my-4 p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 border-b border-slate-200 pb-0.5">
            Vendor / Supplier Details
          </h3>
          <p className="text-xs font-bold text-slate-950">{vendorCompany}</p>
          {vendorContactPerson && (
            <p className="text-slate-700 font-semibold mt-0.5">Contact Person: <span className="font-bold text-slate-900">{vendorContactPerson}</span></p>
          )}
          <p className="text-slate-600 font-medium mt-0.5 leading-snug">{vendorAddress || '—'}</p>
        </div>

        <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 border-b border-slate-200 pb-0.5">
            Tax &amp; Contact Information
          </h3>
          <p className="text-slate-700">Vendor GSTIN: <strong className="font-mono font-bold text-slate-950">{vendorGstin || '—'}</strong></p>
          <p className="text-slate-700">Phone Number: <strong className="font-bold text-slate-950">{vendorPhone || '—'}</strong></p>
          <p className="text-slate-700">Email Address: <strong className="font-bold text-slate-950">{vendorEmail || '—'}</strong></p>
          <p className="text-slate-700">Intake Received By: <strong className="font-bold text-slate-900">{receivedBy}</strong></p>
        </div>
      </div>

      {/* ── 3. PRODUCT ITEMS TABLE ── */}
      <div className="overflow-x-auto my-4 border border-slate-300 rounded-lg">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-wider">
              <th className="py-2.5 px-2 border-r border-slate-800 text-center w-8">Sr.</th>
              <th className="py-2.5 px-3 border-r border-slate-800">Product Name</th>
              <th className="py-2.5 px-2.5 border-r border-slate-800 font-mono">Barcode</th>
              <th className="py-2.5 px-2 border-r border-slate-800 text-center">HSN</th>
              <th className="py-2.5 px-2 border-r border-slate-800 text-center">Batch</th>
              <th className="py-2.5 px-2 border-r border-slate-800 text-center">Qty</th>
              <th className="py-2.5 px-2 border-r border-slate-800 text-center">Unit</th>
              <th className="py-2.5 px-2.5 border-r border-slate-800 text-right">Rate</th>
              <th className="py-2.5 px-2 border-r border-slate-800 text-center">GST</th>
              <th className="py-2.5 px-2.5 border-r border-slate-800 text-right">Tax Amt</th>
              <th className="py-2.5 px-3 text-right font-black">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
            {items.length > 0 ? (
              items.map((item, idx) => {
                const qty = Number(item.quantity || item.qty || 1);
                const price = Number(item.purchase_price || item.price || 0);
                const gstPct = Number(item.gst || item.gst_rate || 0);
                const itemDisc = Number(item.discount || 0);
                const hsn = item.hsn_code || item.hsn || '—';
                const batchNo = item.batch_number || item.batch_no || item.batchNo || '—';
                const barcode = item.barcode || item.sku || '—';
                const baseVal = qty * price;
                const taxVal = Number(item.tax_amount || item.taxAmount || ((baseVal - itemDisc) * (gstPct / 100)));
                const lineTotal = Number(item.total || item.lineTotal || (baseVal - itemDisc + taxVal));

                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-2 px-2 text-center border-r border-slate-200 font-bold text-slate-500 text-[10px]">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-950">{item.product_name || item.name || 'Inventory Product'}</td>
                    <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-slate-600 text-[10px]">{barcode}</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-600 text-[10px]">{hsn}</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-700 text-[10px]">{batchNo}</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-center font-bold text-slate-950">{qty}</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-center text-slate-600 text-[10px]">{item.unit || 'Pcs'}</td>
                    <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-slate-900">₹{price.toFixed(2)}</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-center font-bold text-slate-700">{gstPct}%</td>
                    <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-emerald-700">₹{taxVal.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-950">₹{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11" className="py-6 text-center text-slate-400 font-semibold">No product items attached to this purchase invoice.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 4. CALCULATION SUMMARY & NOTES ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 my-4">
        
        {/* Notes & Terms (Left) */}
        <div className="w-full sm:w-1/2 space-y-3 text-[11px]">
          {purchase.remarks || purchase.notes ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5">
              <h4 className="font-bold text-slate-900 uppercase text-[9px] tracking-widest">Notes &amp; Intake Remarks</h4>
              <p className="text-slate-600 leading-relaxed font-medium">
                {purchase.remarks || purchase.notes}
              </p>
            </div>
          ) : null}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5">
            <h4 className="font-bold text-slate-900 uppercase text-[9px] tracking-widest">Terms &amp; Conditions</h4>
            <ol className="list-decimal list-inside text-slate-600 space-y-0.5 leading-relaxed font-medium text-[10px]">
              <li>All items verified and logged into store inventory valuation.</li>
              <li>Calculations formatted per Indian Goods &amp; Services Tax (GST) Act.</li>
            </ol>
          </div>
        </div>

        {/* Calculation Summary Box (Right) */}
        <div className="w-full sm:w-5/12 bg-slate-900 text-white rounded-lg p-4 shadow-sm space-y-1.5 text-[11px] shrink-0">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-400 font-medium">Subtotal (Excl. Tax)</span>
            <span className="font-mono font-bold">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-medium">Trade Discount (-)</span>
              <span className="font-mono font-bold text-rose-400">-₹{discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-400 font-medium">CGST Amount (50%)</span>
            <span className="font-mono text-emerald-400">+₹{cgstAmount}</span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-400 font-medium">SGST Amount (50%)</span>
            <span className="font-mono text-emerald-400">+₹{sgstAmount}</span>
          </div>

          {otherCharges > 0 && (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-medium">Freight &amp; Handling</span>
              <span className="font-mono font-bold text-amber-300">+₹{otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-0.5 text-slate-400 text-[10px]">
            <span>Round Off</span>
            <span className="font-mono">₹{roundOff}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-700">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">Grand Total</span>
            <span className="text-lg font-black font-mono text-emerald-300">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div className="pt-1.5 border-t border-slate-800 flex justify-between text-slate-300 text-[10px] font-semibold">
            <span>Paid: <strong className="text-white font-mono">₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            <span>Balance: <strong className={`font-mono ${pendingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          </div>
        </div>

      </div>

      {/* ── 5. SIGNATURE BLOCKS ── */}
      <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-[11px]">
        
        {/* Vendor Sign */}
        <div className="flex flex-col items-center justify-end h-20">
          <div className="w-4/5 border-b border-slate-400 border-dashed mb-1.5"></div>
          <p className="font-bold text-slate-900">Vendor Signature</p>
          <p className="text-[9px] text-slate-500">Authorized Acceptance</p>
        </div>

        {/* Company Seal */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center text-[8px] font-black text-slate-400 uppercase tracking-widest p-1.5 text-center">
            Official Store Seal
          </div>
        </div>

        {/* Store Authorized Sign */}
        <div className="flex flex-col items-center justify-end h-20">
          <div className="w-4/5 border-b border-slate-400 border-dashed mb-1.5"></div>
          <p className="font-bold text-slate-900">Authorized Signatory</p>
          <p className="text-[9px] text-slate-500">For {storeName}</p>
        </div>

      </div>

      {/* ── 6. SYSTEM FOOTER ── */}
      <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-500 font-semibold tracking-wider uppercase">
        {storeName} • Purchase Document ID: {invoiceNo}
      </div>

    </div>
  );
};

export default PurchaseInvoicePrintTemplate;
