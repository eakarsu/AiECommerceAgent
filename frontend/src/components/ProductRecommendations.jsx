import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export const ProductRecommendations = ({ productId }) => {
  const [recommendations, setRecommendations] = useState([]);
  const { get } = useApi();

  useEffect(() => {
    if (productId) loadRecommendations();
  }, [productId]);

  const loadRecommendations = async () => {
    try {
      const data = await get(`/api/recommendations/for-product/${productId}`);
      setRecommendations(data);
    } catch (e) {
      console.error(e);
    }
  };

  if (recommendations.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="font-semibold text-gray-900 mb-3">Customers Also Bought</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {recommendations.map(rec => (
          <div
            key={rec.id}
            className="min-w-[160px] p-3 bg-gray-50 border rounded-lg"
          >
            <p className="text-sm font-medium truncate">Product #{rec.targetProductId}</p>
            <p className="text-xs text-gray-500 mt-1">{rec.reason?.slice(0, 60)}...</p>
            <div className="mt-2 flex items-center gap-1">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-amber-500"
                  style={{ width: `${parseFloat(rec.score) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-medium">{(parseFloat(rec.score) * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
