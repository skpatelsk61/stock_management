import axios from 'axios';
import jwt from 'jsonwebtoken';

async function testCheckout() {
  try {
    const token = jwt.sign(
      { id: 5, email: 'hariom@gmail.com', role: 'Admin', tenant_id: 2, tenantDbName: 'shop_hariom001' },
      'kirana_store_erp_premium_secure_jwt_secret_key_2026',
      { expiresIn: '1h' }
    );

    console.log('1. Generated Valid Token for Hariom (shop_hariom001)...');

    const payload = {
      customerType: 'Walk-in',
      customerName: 'Walk-in Customer',
      customerPhone: '',
      customerId: 1,
      dueDate: null,
      amountPaid: 890,
      dueAmount: 0,
      paymentMethod: 'Cash',
      payments: [{ paymentMethod: 'Cash', amount: 890, referenceNo: '' }],
      advanceCreditApplied: 0,
      paymentStatus: 'Paid',
      date: '2026-09-16',
      notes: '',
      items: [{
        productId: 1,
        name: 'Halka Fulka',
        barcode: 'BAR-1789538537829-8085',
        unit: 'Packet',
        selectedUnit: 'Packet',
        inputQty: 1,
        measurement_value: '',
        quantity: 1,
        availableStock: 90,
        price: 10,
        discount: 0,
        gst: 0,
        subtotal: 10,
        total: 10
      }],
      subtotal: 10,
      discount: 0,
      gstAmount: 0,
      total: 10
    };

    console.log('2. Sending POST /api/sales payload...');
    const saleRes = await axios.post('http://localhost:5000/api/sales', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('🎉 POS CHECKOUT SUCCESS! Server Response:\n', saleRes.data);
  } catch (err) {
    console.error('❌ POS Checkout Error:', err.response?.data || err.message);
  }
}

testCheckout();
