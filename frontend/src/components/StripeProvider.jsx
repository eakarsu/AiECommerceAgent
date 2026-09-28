import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';

let stripePromise;

export const getStripePromise = () => {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return null;
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
};

export const StripeProvider = ({ children, clientSecret }) => {
  const stripe = getStripePromise();

  if (!stripe) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your .env file.
        </p>
      </div>
    );
  }

  const options = clientSecret ? { clientSecret } : {};

  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
};
