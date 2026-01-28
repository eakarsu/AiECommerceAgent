import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
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
  const { post } = useApi();
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.08;
  const shipping = shippingMethod?.rate || 0;
  const total = subtotal + tax + shipping;

  const handleCreateOrder = async () => {
    try {
      setError(null);
      const orderData = {
        items: cart,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        total: total.toFixed(2),
        shippingAddress: address,
        paymentStatus: 'pending',
        status: 'pending'
      };

      const createdOrder = await post('/api/orders', orderData);
      setOrder(createdOrder);

      // Create payment intent
      const { clientSecret: secret } = await post('/api/payments/create-intent', {
        orderId: createdOrder.id
      });
      setClientSecret(secret);
      setStep(4);
    } catch (e) {
      setError(e.message || 'Failed to create order');
    }
  };

  const handlePaymentSuccess = () => {
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
          <div className="border-t pt-3">
            <p className="text-right font-bold text-lg">Subtotal: ${subtotal.toFixed(2)}</p>
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
            <p className="font-bold text-lg">Total: ${total.toFixed(2)}</p>
          </div>
          <StripeProvider clientSecret={clientSecret}>
            <PaymentForm
              clientSecret={clientSecret}
              amount={total}
              onSuccess={handlePaymentSuccess}
              onError={(err) => setError(err.message)}
            />
          </StripeProvider>
        </div>
      )}
    </div>
  );
};
