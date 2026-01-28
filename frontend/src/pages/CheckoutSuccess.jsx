import { useLocation, useNavigate } from 'react-router-dom';

export const CheckoutSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state?.order;

  return (
    <div className="max-w-xl mx-auto text-center space-y-6 py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto">
        !
      </div>

      <h1 className="text-3xl font-bold text-gray-900">Order Confirmed!</h1>

      <p className="text-gray-600">
        Thank you for your purchase. Your order has been successfully placed.
      </p>

      {order && (
        <div className="bg-gray-50 rounded-lg p-6 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Order Number:</span>
            <span className="font-medium">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold text-lg">${parseFloat(order.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="badge badge-success">Processing</span>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500">
        A confirmation email will be sent to your registered email address.
      </p>

      <div className="flex gap-3 justify-center">
        <button onClick={() => navigate('/orders')} className="btn btn-primary">
          View Orders
        </button>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};
