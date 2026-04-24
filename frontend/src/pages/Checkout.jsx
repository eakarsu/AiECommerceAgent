import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../context/NotificationContext';
import { ShippingCalculator } from '../components/ShippingCalculator';
import { StripeProvider } from '../components/StripeProvider';
import { PaymentForm } from '../components/PaymentForm';

export const Checkout = () => {
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState([
    { productId: 1, name: 'Sample Product', price: 99.99, quantity: 1, weight: 1.5 }
  ]);
  const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [shippingMethod, setShippingMethod] = useState(null);
  const [order, setOrder] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const { post } = useApi();
  const navigate = useNavigate();
  const { showToast } = useNotifications();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.08;
  const shipping = shippingMethod?.rate || 0;
  const discount = couponApplied
    ? couponApplied.discountType === 'percentage'
      ? Math.min(subtotal * (couponApplied.discountValue / 100), couponApplied.maxDiscount || Infinity)
      : couponApplied.discountValue
    : 0;
  const total = subtotal + tax + shipping - discount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const result = await post('/api/coupons/validate', { code: couponCode.toUpperCase(), orderAmount: subtotal });
      if (result.valid) {
        setCouponApplied(result.coupon || result);
        showToast(`Coupon "${couponCode.toUpperCase()}" applied! You save $${(result.coupon?.discountValue || result.discountValue || discount).toFixed ? discount.toFixed(2) : discount}`, 'success');
      } else {
        showToast(result.message || 'Invalid coupon code', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Failed to validate coupon', 'error');
    }
    setCouponLoading(false);
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(null);
    setCouponCode('');
    showToast('Coupon removed', 'info');
  };

  const handleCreateOrder = async () => {
    try {
      setError(null);
      const orderData = {
        items: cart,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        shippingAddress: address,
        couponCode: couponApplied ? couponCode.toUpperCase() : null,
        paymentStatus: 'pending',
        status: 'pending'
      };

      const createdOrder = await post('/api/orders', orderData);
      setOrder(createdOrder);
      showToast('Order created successfully', 'success');

      // Create payment intent
      const { clientSecret: secret } = await post('/api/payments/create-intent', {
        orderId: createdOrder.id
      });
      setClientSecret(secret);
      setStep(4);
    } catch (e) {
      setError(e.message || 'Failed to create order');
      showToast('Failed to create order', 'error');
    }
  };

  const handlePaymentSuccess = () => {
    showToast('Payment successful!', 'success');
    navigate('/checkout/success', { state: { order } });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['Cart', 'Address', 'Shipping', 'Payment'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > i + 1 ? 'bg-green-500 text-white' :
              step === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {step > i + 1 ? '>' : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? 'font-medium' : 'text-gray-500'}`}>{label}</span>
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200"></div>}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Step 1: Cart */}
      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">Your Cart</h2>
          {cart.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <p className="font-bold">${(item.price * item.quantity).toFixed(2)}</p>
            </div>
          ))}

          {/* Coupon Code Input */}
          <div className="border-t pt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Coupon Code</label>
            {couponApplied ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <div>
                  <span className="font-mono font-bold text-green-700">{couponCode.toUpperCase()}</span>
                  <span className="text-sm text-green-600 ml-2">
                    (-${discount.toFixed(2)} {couponApplied.discountType === 'percentage' ? `(${couponApplied.discountValue}%)` : 'off'})
                  </span>
                </div>
                <button onClick={handleRemoveCoupon} className="text-sm text-red-600 hover:text-red-800">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="input flex-1 font-mono"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="btn btn-secondary"
                >
                  {couponLoading ? 'Applying...' : 'Apply'}
                </button>
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <p className="text-right font-bold text-lg">Subtotal: ${(subtotal - discount).toFixed(2)}</p>
          </div>
          <button onClick={() => setStep(2)} className="btn btn-primary w-full">Continue to Address</button>
        </div>
      )}

      {/* Step 2: Address */}
      {step === 2 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">Shipping Address</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Street</label>
            <input className="input" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input className="input" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input className="input" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ZIP</label>
              <input className="input" maxLength={5} value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} required />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn btn-secondary">Back</button>
            <button onClick={() => setStep(3)} disabled={!address.street || !address.city || !address.state} className="btn btn-primary flex-1">Continue to Shipping</button>
          </div>
        </div>
      )}

      {/* Step 3: Shipping */}
      {step === 3 && (
        <div className="card space-y-4">
          <ShippingCalculator items={cart} onSelectMethod={setShippingMethod} />
          <div className="border-t pt-3 space-y-1">
            <p className="text-sm text-gray-600">Subtotal: ${subtotal.toFixed(2)}</p>
            {discount > 0 && <p className="text-sm text-green-600">Discount: -${discount.toFixed(2)}</p>}
            <p className="text-sm text-gray-600">Tax: ${tax.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Shipping: ${shipping.toFixed(2)}</p>
            <p className="font-bold text-lg">Total: ${total.toFixed(2)}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn btn-secondary">Back</button>
            <button onClick={handleCreateOrder} disabled={!shippingMethod} className="btn btn-primary flex-1">Proceed to Payment</button>
          </div>
        </div>
      )}

      {/* Step 4: Payment */}
      {step === 4 && clientSecret && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">Payment</h2>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Order: {order?.orderNumber}</p>
            {discount > 0 && <p className="text-sm text-green-600">Discount: -${discount.toFixed(2)}</p>}
            <p className="font-bold text-lg">Total: ${total.toFixed(2)}</p>
          </div>
          <StripeProvider clientSecret={clientSecret}>
            <PaymentForm
              clientSecret={clientSecret}
              amount={total}
              onSuccess={handlePaymentSuccess}
              onError={(err) => { setError(err.message); showToast('Payment failed', 'error'); }}
            />
          </StripeProvider>
        </div>
      )}
    </div>
  );
};
