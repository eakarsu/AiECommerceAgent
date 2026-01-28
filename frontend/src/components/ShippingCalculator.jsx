import { useState, useEffect, useRef } from 'react';

export const ShippingCalculator = ({ items, onSelectMethod, initialAddress }) => {
  const [rates, setRates] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const calculatedRef = useRef(false);

  // Auto-calculate when initialAddress is provided
  useEffect(() => {
    if (initialAddress?.state && initialAddress?.zip && !calculatedRef.current) {
      calculatedRef.current = true;
      handleCalculate();
    }
  }, [initialAddress]);

  const handleCalculate = async () => {
    if (!initialAddress?.state) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items, address: initialAddress })
      });

      if (!response.ok) {
        throw new Error('Failed to calculate shipping');
      }

      const data = await response.json();
      setRates(data);

      if (data.length > 0) {
        setSelectedMethod(data[0]);
        if (onSelectMethod) onSelectMethod(data[0]);
      }
    } catch (e) {
      console.error('Shipping calculation error:', e);
      setError('Failed to load shipping rates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMethod = (rate) => {
    setSelectedMethod(rate);
    if (onSelectMethod) onSelectMethod(rate);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Select Shipping Method</h3>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Calculating shipping rates...</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={handleCalculate} className="text-sm text-red-700 underline mt-1">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && rates.length > 0 && (
        <div className="space-y-2">
          {rates.map((rate) => (
            <label
              key={rate.methodId}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedMethod?.methodId === rate.methodId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shippingMethod"
                  checked={selectedMethod?.methodId === rate.methodId}
                  onChange={() => handleSelectMethod(rate)}
                  className="text-blue-600"
                />
                <div>
                  <p className="font-medium text-sm">{rate.name}</p>
                  <p className="text-xs text-gray-500">{rate.estimatedDays}</p>
                </div>
              </div>
              <span className="font-bold text-sm">
                {rate.freeShipping ? (
                  <span className="text-green-600">FREE</span>
                ) : (
                  `$${rate.rate.toFixed(2)}`
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      {!loading && !error && rates.length === 0 && initialAddress?.state && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-2">No shipping rates loaded</p>
          <button onClick={handleCalculate} className="btn btn-secondary text-sm">
            Calculate Shipping
          </button>
        </div>
      )}
    </div>
  );
};
