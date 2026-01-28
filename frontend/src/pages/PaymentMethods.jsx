import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { StripeProvider } from '../components/StripeProvider';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const AddCardForm = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const { post } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      // Save to backend
      await post('/api/payment-methods', {
        paymentMethodId: paymentMethod.id
      });

      onSuccess();
    } catch (e) {
      setError(e.message || 'Failed to save card');
    }
    setProcessing(false);
  };

  const cardStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': { color: '#9ca3af' }
      },
      invalid: { color: '#ef4444' }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Card Details</label>
        <div className="border border-gray-300 rounded-lg p-3">
          <CardElement options={cardStyle} />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || processing}
          className="btn btn-primary flex-1"
        >
          {processing ? 'Saving...' : 'Save Card'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Test card: 4242 4242 4242 4242 | Exp: 12/28 | CVC: 123
      </p>
    </form>
  );
};

export const PaymentMethods = () => {
  const [cards, setCards] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { get, del } = useApi();

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    try {
      const data = await get('/api/payment-methods');
      setCards(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDelete = async (cardId) => {
    if (!window.confirm('Remove this card?')) return;
    try {
      await del(`/api/payment-methods/${cardId}`);
      loadCards();
    } catch (e) {
      console.error(e);
      alert('Failed to remove card');
    }
  };

  const handleSetDefault = async (cardId) => {
    try {
      await fetch(`/api/payment-methods/${cardId}/default`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      loadCards();
    } catch (e) {
      console.error(e);
    }
  };

  const getCardIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      default: return '💳';
    }
  };

  if (!stripePromise) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-500">Manage your saved payment methods</p>
        </div>
        <div className="card p-8 text-center">
          <p className="text-yellow-600">Stripe is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY to enable payments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-500">Manage your saved payment methods</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
          + Add Card
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading cards...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">💳</div>
            <h3 className="font-medium text-gray-900 mb-2">No saved cards</h3>
            <p className="text-gray-500 mb-4">Add a card to make checkout faster</p>
            <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
              Add Your First Card
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  card.isDefault ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{getCardIcon(card.brand)}</span>
                  <div>
                    <p className="font-medium">
                      {card.brand} •••• {card.last4}
                      {card.isDefault && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Default</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">Expires {card.expMonth}/{card.expYear}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!card.isDefault && (
                    <button
                      onClick={() => handleSetDefault(card.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Payment Method">
        <Elements stripe={stripePromise}>
          <AddCardForm
            onSuccess={() => {
              setIsAddModalOpen(false);
              loadCards();
            }}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Elements>
      </Modal>
    </div>
  );
};
