import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';
import { ShippingCalculator } from '../components/ShippingCalculator';
import { StripeProvider } from '../components/StripeProvider';
import { PaymentForm } from '../components/PaymentForm';

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [shippingAddress, setShippingAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [shippingMethod, setShippingMethod] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [savedCards, setSavedCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('saved'); // 'saved' or 'new'
  const [processingPayment, setProcessingPayment] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customerId: '', items: [], status: 'pending', paymentStatus: 'pending',
    subtotal: '', tax: '', shipping: '', total: ''
  });
  const { get, post, put, del, loading } = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const processedOrderIdRef = useRef(null);

  useEffect(() => { loadOrders(); }, []);

  // Auto-open checkout when redirected from Products page
  useEffect(() => {
    const orderId = location.state?.openCheckoutForOrderId;

    // Only process if we have an orderId and haven't already processed this exact order
    if (orderId && orders.length > 0 && processedOrderIdRef.current !== orderId) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.status === 'pending' && order.paymentStatus === 'pending') {
        processedOrderIdRef.current = orderId;
        setSelectedOrder(order);
        setCheckoutStep(1);
        setShippingAddress({ street: '', city: '', state: '', zip: '' });
        setShippingMethod(null);
        setClientSecret(null);
        setCheckoutError(null);
        setIsCheckoutModalOpen(true);
        // Clear the state using navigate
        navigate('/orders', { replace: true });
      }
    }
  }, [orders, location.state, navigate]);

  useEffect(() => {
    if (orders.length > 0) generateAiSummary();
  }, [orders]);

  const loadOrders = async () => {
    try {
      const data = await get('/api/orders');
      setOrders(data);
      setFilteredOrders(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async () => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'orders_summary',
        data: {
          totalOrders: orders.length,
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          deliveredOrders: orders.filter(o => o.status === 'delivered').length,
          totalRevenue: orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + parseFloat(o.total || 0), 0),
          avgOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) / orders.length : 0
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Focus on converting pending orders and improving delivery times for better customer satisfaction.');
    }
  };

  const handleRowClick = async (o) => {
    setSelectedOrder(o);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'order_analysis',
        data: {
          orderNumber: o.orderNumber,
          total: o.total,
          status: o.status,
          paymentStatus: o.paymentStatus,
          itemCount: o.items?.length || 0,
          customer: o.Customer?.name
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight(`This ${o.status} order worth $${parseFloat(o.total).toFixed(2)} ${o.paymentStatus === 'paid' ? 'has been paid' : 'is awaiting payment'}. ${o.status === 'pending' ? 'Consider prioritizing fulfillment to improve customer satisfaction.' : 'Order is progressing well.'}`);
    }
    setAiLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await del(`/api/orders/${selectedOrder.id}`);
      setIsModalOpen(false);
      loadOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await post('/api/orders', {
        ...newOrder,
        subtotal: parseFloat(newOrder.subtotal),
        tax: parseFloat(newOrder.tax || 0),
        shipping: parseFloat(newOrder.shipping || 0),
        total: parseFloat(newOrder.total),
        items: [{ name: 'New Item', quantity: 1, price: parseFloat(newOrder.total) }]
      });
      setIsNewModalOpen(false);
      setNewOrder({ customerId: '', items: [], status: 'pending', paymentStatus: 'pending', subtotal: '', tax: '', shipping: '', total: '' });
      loadOrders();
    } catch (e) { console.error(e); }
  };

  const handleCompleteOrder = async () => {
    setCheckoutStep(1);
    setShippingAddress({ street: '', city: '', state: '', zip: '' });
    setShippingMethod(null);
    setClientSecret(null);
    setCheckoutError(null);
    setSelectedCardId(null);
    setPaymentMode('saved');
    setProcessingPayment(false);

    // Load saved cards
    try {
      const cards = await get('/api/payment-methods');
      setSavedCards(cards);
      const defaultCard = cards.find(c => c.isDefault);
      if (defaultCard) {
        setSelectedCardId(defaultCard.id);
      } else if (cards.length > 0) {
        setSelectedCardId(cards[0].id);
      }
    } catch (e) {
      console.error('Failed to load saved cards:', e);
      setSavedCards([]);
    }

    setIsCheckoutModalOpen(true);
  };

  const handleProceedToPayment = async () => {
    try {
      setCheckoutError(null);
      const shippingCost = shippingMethod?.rate || 0;
      const subtotal = parseFloat(selectedOrder.subtotal);
      const tax = parseFloat(selectedOrder.tax);
      const newTotal = subtotal + tax + shippingCost;

      // Update order with shipping info first
      await put(`/api/orders/${selectedOrder.id}`, {
        shippingAddress,
        shipping: shippingCost.toFixed(2),
        total: newTotal.toFixed(2)
      });

      // Create payment intent
      const { clientSecret: secret } = await post('/api/payments/create-intent', {
        orderId: selectedOrder.id
      });
      setClientSecret(secret);
      setCheckoutStep(3);
    } catch (e) {
      console.error(e);
      setCheckoutError('Failed to create payment. Stripe may not be configured.');
      // Allow demo completion without Stripe
      setCheckoutStep(3);
    }
  };

  const handlePaymentSuccess = async () => {
    processedOrderIdRef.current = null;
    setIsCheckoutModalOpen(false);
    setIsModalOpen(false);
    setSelectedOrder(null);
    loadOrders();
    alert('Payment successful! Order completed.');
  };

  const handleDemoComplete = async () => {
    try {
      const shippingCost = shippingMethod?.rate || 0;
      const subtotal = parseFloat(selectedOrder.subtotal);
      const tax = parseFloat(selectedOrder.tax);
      const newTotal = subtotal + tax + shippingCost;

      await put(`/api/orders/${selectedOrder.id}`, {
        shippingAddress,
        shipping: shippingCost.toFixed(2),
        total: newTotal.toFixed(2),
        status: 'processing',
        paymentStatus: 'paid'
      });

      processedOrderIdRef.current = null;
      setIsCheckoutModalOpen(false);
      setIsModalOpen(false);
      setSelectedOrder(null);
      loadOrders();
      alert('Order completed successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to complete order');
    }
  };

  const handlePayWithSavedCard = async () => {
    if (!selectedCardId) {
      setCheckoutError('Please select a payment method');
      return;
    }

    setProcessingPayment(true);
    setCheckoutError(null);

    try {
      // Pay with saved card
      const result = await post('/api/payments/pay-with-saved-card', {
        orderId: selectedOrder.id,
        paymentMethodId: selectedCardId
      });

      if (result.success) {
        processedOrderIdRef.current = null;
        setIsCheckoutModalOpen(false);
        setIsModalOpen(false);
        setSelectedOrder(null);
        loadOrders();
        alert('Payment successful! Order completed.');
      } else {
        setCheckoutError(result.error || 'Payment failed');
      }
    } catch (e) {
      console.error(e);
      setCheckoutError(e.message || 'Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCloseCheckout = () => {
    processedOrderIdRef.current = null;
    setIsCheckoutModalOpen(false);
  };

  const statusColors = { pending: 'badge-warning', processing: 'badge-info', shipped: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger', refunded: 'badge-gray' };

  const columns = [
    { header: 'Order', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-lg">🛒</div>
        <span className="font-medium">{row.orderNumber}</span>
      </div>
    )},
    { header: 'Customer', render: (row) => row.Customer?.name || 'Guest' },
    { header: 'Items', render: (row) => `${row.items?.length || 0} items` },
    { header: 'Total', render: (row) => <span className="font-bold">${parseFloat(row.total).toFixed(2)}</span> },
    { header: 'Payment', render: (row) => <span className={`badge ${row.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{row.paymentStatus}</span> },
    { header: 'Status', render: (row) => <span className={`badge ${statusColors[row.status]}`}>{row.status}</span> },
    { header: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Orders</h1><p className="text-gray-500">Order management and tracking</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ New Order</button>
      </div>

      {/* AI Summary Card */}
      {aiSummary && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold text-purple-900">AI Insights</h3>
              <p className="text-purple-800 text-sm mt-1">{typeof aiSummary === 'string' ? aiSummary : JSON.stringify(aiSummary)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Orders</p><p className="text-2xl font-bold">{orders.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'pending').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Delivered</p><p className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'delivered').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold">${orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + parseFloat(o.total || 0), 0).toLocaleString()}</p></div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={orders}
          onFilter={setFilteredOrders}
          searchFields={['orderNumber', 'Customer.name', 'Customer.email', 'status', 'paymentStatus']}
          placeholder="Search by order number, customer, status..."
        />
        <DataTable columns={columns} data={filteredOrders} onRowClick={handleRowClick} loading={loading} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Order Details" size="lg">
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h3 className="text-xl font-bold">{selectedOrder.orderNumber}</h3><p className="text-gray-500">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p></div>
              <span className={`badge ${statusColors[selectedOrder.status]}`}>{selectedOrder.status}</span>
            </div>

            {/* AI Insight */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">✨</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-purple-900">AI Analysis</h4>
                    <button onClick={() => handleRowClick(selectedOrder)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
                  </div>
                  {aiLoading ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      <span className="text-purple-600 text-sm">Analyzing order...</span>
                    </div>
                  ) : (
                    <p className="text-purple-800 text-sm mt-1">{typeof aiInsight === 'string' ? aiInsight : JSON.stringify(aiInsight)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Subtotal</p><p className="text-xl font-bold">${parseFloat(selectedOrder.subtotal).toFixed(2)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Tax + Shipping</p><p className="text-xl font-bold">${(parseFloat(selectedOrder.tax) + parseFloat(selectedOrder.shipping)).toFixed(2)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold text-green-600">${parseFloat(selectedOrder.total).toFixed(2)}</p></div>
            </div>
            <div><h4 className="font-medium mb-3">Items</h4>
              <div className="space-y-2">{selectedOrder.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div><p className="font-medium">{item.name}</p><p className="text-sm text-gray-500">Qty: {item.quantity}</p></div>
                  <span className="font-bold">${parseFloat(item.price).toFixed(2)}</span>
                </div>
              ))}</div>
            </div>
            {selectedOrder.shippingAddress && (
              <div><h4 className="font-medium mb-2">Shipping Address</h4>
                <p className="text-gray-600">{selectedOrder.shippingAddress.street}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zip}</p>
              </div>
            )}
            {selectedOrder.trackingNumber && <div><h4 className="font-medium mb-2">Tracking</h4><p className="text-primary-600 font-mono">{selectedOrder.trackingNumber}</p></div>}

            {selectedOrder.paymentIntentId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Payment Details</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-green-700">Payment ID:</span> {selectedOrder.paymentIntentId}</p>
                  <p><span className="text-green-700">Status:</span> {selectedOrder.paymentStatus}</p>
                  {selectedOrder.refundId && (
                    <>
                      <p><span className="text-green-700">Refund ID:</span> {selectedOrder.refundId}</p>
                      <p><span className="text-green-700">Refund Amount:</span> ${parseFloat(selectedOrder.refundAmount || 0).toFixed(2)}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              {selectedOrder.status === 'pending' && selectedOrder.paymentStatus === 'pending' && (
                <button onClick={handleCompleteOrder} className="btn btn-success">
                  💳 Complete Order
                </button>
              )}
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              {selectedOrder.paymentIntentId && selectedOrder.paymentStatus === 'paid' && (
                <button onClick={async () => {
                  if (!window.confirm('Issue a full refund for this order?')) return;
                  try {
                    const result = await post('/api/payments/refund', { orderId: selectedOrder.id });
                    const updated = await get(`/api/orders/${selectedOrder.id}`);
                    setSelectedOrder(updated);
                    loadOrders();
                    alert('Refund processed successfully!');
                  } catch (e) {
                    console.error(e);
                    alert('Refund failed: ' + (e.message || 'Unknown error'));
                  }
                }} className="btn btn-warning">Refund</button>
              )}
              {selectedOrder.paymentStatus === 'refunded' && (
                <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                  Refunded
                </span>
              )}
              <button onClick={handleDelete} className="btn btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Create New Order">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal ($)</label>
              <input type="number" step="0.01" className="input" value={newOrder.subtotal} onChange={(e) => setNewOrder({...newOrder, subtotal: e.target.value, total: (parseFloat(e.target.value || 0) + parseFloat(newOrder.tax || 0) + parseFloat(newOrder.shipping || 0)).toFixed(2)})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax ($)</label>
              <input type="number" step="0.01" className="input" value={newOrder.tax} onChange={(e) => setNewOrder({...newOrder, tax: e.target.value, total: (parseFloat(newOrder.subtotal || 0) + parseFloat(e.target.value || 0) + parseFloat(newOrder.shipping || 0)).toFixed(2)})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping ($)</label>
              <input type="number" step="0.01" className="input" value={newOrder.shipping} onChange={(e) => setNewOrder({...newOrder, shipping: e.target.value, total: (parseFloat(newOrder.subtotal || 0) + parseFloat(newOrder.tax || 0) + parseFloat(e.target.value || 0)).toFixed(2)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total ($)</label>
              <input type="number" step="0.01" className="input" value={newOrder.total} readOnly />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={newOrder.status} onChange={(e) => setNewOrder({...newOrder, status: e.target.value})}>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
              <select className="input" value={newOrder.paymentStatus} onChange={(e) => setNewOrder({...newOrder, paymentStatus: e.target.value})}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn btn-primary">Create Order</button>
            <button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Checkout Modal */}
      <Modal isOpen={isCheckoutModalOpen} onClose={handleCloseCheckout} title="Complete Order" size="lg">
        {selectedOrder && (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-4">
              {['Address', 'Shipping', 'Payment'].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    checkoutStep > i + 1 ? 'bg-green-500 text-white' :
                    checkoutStep === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {checkoutStep > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${checkoutStep === i + 1 ? 'font-medium' : 'text-gray-500'}`}>{label}</span>
                  {i < 2 && <div className="w-8 h-0.5 bg-gray-200"></div>}
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Order: {selectedOrder.orderNumber}</h4>
              <div className="text-sm space-y-1">
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.name} x {item.quantity}</span>
                    <span>${parseFloat(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Address */}
            {checkoutStep === 1 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Shipping Address</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Street</label>
                  <input
                    className="input"
                    value={shippingAddress.street}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input
                      className="input"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">State</label>
                    <input
                      className="input"
                      maxLength={2}
                      placeholder="NY"
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ZIP</label>
                    <input
                      className="input"
                      maxLength={5}
                      placeholder="10001"
                      value={shippingAddress.zip}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setCheckoutStep(2)}
                    disabled={!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip}
                    className="btn btn-primary flex-1"
                  >
                    Continue to Shipping
                  </button>
                  <button onClick={handleCloseCheckout} className="btn btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {/* Step 2: Shipping */}
            {checkoutStep === 2 && (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <p className="text-blue-800">
                    <strong>Shipping to:</strong> {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                  </p>
                </div>

                <ShippingCalculator
                  items={selectedOrder.items?.map(item => ({
                    price: item.price,
                    quantity: item.quantity,
                    weight: 1
                  })) || []}
                  onSelectMethod={setShippingMethod}
                  initialAddress={{ state: shippingAddress.state, zip: shippingAddress.zip }}
                />

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span>${parseFloat(selectedOrder.tax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping:</span>
                    <span>{shippingMethod ? (shippingMethod.freeShipping ? 'FREE' : `$${shippingMethod.rate.toFixed(2)}`) : '-'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>${(parseFloat(selectedOrder.subtotal) + parseFloat(selectedOrder.tax) + (shippingMethod?.rate || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setCheckoutStep(1)} className="btn btn-secondary">Back</button>
                  <button
                    onClick={handleProceedToPayment}
                    disabled={!shippingMethod}
                    className="btn btn-primary flex-1"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {checkoutStep === 3 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Payment</h4>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span>${parseFloat(selectedOrder.tax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping ({shippingMethod?.name}):</span>
                    <span>{shippingMethod?.freeShipping ? 'FREE' : `$${shippingMethod?.rate?.toFixed(2)}`}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${(parseFloat(selectedOrder.subtotal) + parseFloat(selectedOrder.tax) + (shippingMethod?.rate || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <p className="text-blue-800">
                    <strong>Shipping to:</strong> {shippingAddress.street}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                  </p>
                </div>

                {checkoutError && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">{checkoutError}</p>
                  </div>
                )}

                {/* Payment Method Selection */}
                {savedCards.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaymentMode('saved')}
                        className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                          paymentMode === 'saved' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Use Saved Card
                      </button>
                      <button
                        onClick={() => setPaymentMode('new')}
                        className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                          paymentMode === 'new' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        New Card
                      </button>
                    </div>
                  </div>
                )}

                {/* Saved Cards */}
                {paymentMode === 'saved' && savedCards.length > 0 && (
                  <div className="space-y-2">
                    {savedCards.map((card) => (
                      <label
                        key={card.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedCardId === card.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="savedCard"
                            checked={selectedCardId === card.id}
                            onChange={() => setSelectedCardId(card.id)}
                            className="text-blue-600"
                          />
                          <span className="text-xl">💳</span>
                          <div>
                            <p className="font-medium text-sm">
                              {card.brand} •••• {card.last4}
                              {card.isDefault && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Default</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">Expires {card.expMonth}/{card.expYear}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                    <button
                      onClick={handlePayWithSavedCard}
                      disabled={!selectedCardId || processingPayment}
                      className="btn btn-success w-full mt-4"
                    >
                      {processingPayment ? 'Processing...' : `Pay $${(parseFloat(selectedOrder.subtotal) + parseFloat(selectedOrder.tax) + (shippingMethod?.rate || 0)).toFixed(2)}`}
                    </button>
                  </div>
                )}

                {/* New Card Entry */}
                {(paymentMode === 'new' || savedCards.length === 0) && (
                  <>
                    {clientSecret ? (
                      <div className="border rounded-lg p-4">
                        <StripeProvider clientSecret={clientSecret}>
                          <PaymentForm
                            clientSecret={clientSecret}
                            amount={(parseFloat(selectedOrder.subtotal) + parseFloat(selectedOrder.tax) + (shippingMethod?.rate || 0))}
                            onSuccess={handlePaymentSuccess}
                            onError={(err) => setCheckoutError(err.message)}
                          />
                        </StripeProvider>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="bg-gray-100 rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-3">
                            <strong>Stripe not configured.</strong> To enable real payments, add your Stripe keys to the environment variables.
                          </p>
                          <p className="text-xs text-gray-500">
                            Test card: 4242 4242 4242 4242 | Any future date | Any CVC
                          </p>
                        </div>
                        <button onClick={handleDemoComplete} className="btn btn-success w-full">
                          ✓ Complete Order (Demo Mode)
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCheckoutStep(2)} className="btn btn-secondary">Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
