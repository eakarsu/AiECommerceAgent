import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

export const InventoryAlertWidget = () => {
  const [stats, setStats] = useState(null);
  const { get } = useApi();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await get('/api/inventory-alerts/stats');
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  if (!stats || (stats.active === 0 && stats.acknowledged === 0)) return null;

  return (
    <div
      className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-100 transition-colors"
      onClick={() => navigate('/inventory-alerts')}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-xl">
          !!
        </div>
        <div className="flex-1">
          <p className="font-medium text-red-900">Stock Alerts</p>
          <p className="text-sm text-red-700">
            {stats.active} active
            {stats.acknowledged > 0 && `, ${stats.acknowledged} acknowledged`}
          </p>
        </div>
        <div className="text-right">
          {stats.byType?.map(t => (
            <span key={t.type} className="block text-xs text-red-600">
              {t.type.replace('_', ' ')}: {t.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
