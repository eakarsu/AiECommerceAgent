import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export const StripeProvider = ({ children, clientSecret }) => {
  if (!stripePromise) {
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
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};
