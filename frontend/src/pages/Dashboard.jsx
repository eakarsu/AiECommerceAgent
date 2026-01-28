import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { InventoryAlertWidget } from '../components/InventoryAlertWidget';

const features = [
  { name: 'Products', icon: '📦', path: '/products', color: 'from-blue-500 to-blue-600', description: 'Manage product listings' },
  { name: 'Dynamic Pricing', icon: '💰', path: '/pricing', color: 'from-green-500 to-green-600', description: 'AI-powered pricing' },
  { name: 'Ad Campaigns', icon: '📢', path: '/campaigns', color: 'from-orange-500 to-orange-600', description: 'Manage advertisements' },
  { name: 'Inventory', icon: '📋', path: '/inventory', color: 'from-purple-500 to-purple-600', description: 'Track stock levels' },
  { name: 'Customers', icon: '👥', path: '/customers', color: 'from-pink-500 to-pink-600', description: 'Customer analytics' },
  { name: 'Orders', icon: '🛒', path: '/orders', color: 'from-indigo-500 to-indigo-600', description: 'Order management' },
  { name: 'Reviews', icon: '⭐', path: '/reviews', color: 'from-yellow-500 to-yellow-600', description: 'Sentiment analysis' },
  { name: 'Content', icon: '✍️', path: '/content', color: 'from-teal-500 to-teal-600', description: 'AI content generation' },
  { name: 'Trends', icon: '📈', path: '/trends', color: 'from-cyan-500 to-cyan-600', description: 'Market trends' },
  { name: 'Competitors', icon: '🏢', path: '/competitors', color: 'from-red-500 to-red-600', description: 'Competitive analysis' },
  { name: 'A/B Tests', icon: '🧪', path: '/ab-tests', color: 'from-violet-500 to-violet-600', description: 'Experiment results' },
  { name: 'Forecasts', icon: '🔮', path: '/forecasts', color: 'from-fuchsia-500 to-fuchsia-600', description: 'Sales predictions' },
  { name: 'Segments', icon: '🎯', path: '/segments', color: 'from-rose-500 to-rose-600', description: 'Customer segments' },
  { name: 'Recommendations', icon: '💡', path: '/recommendations', color: 'from-amber-500 to-amber-600', description: 'Product recommendations' },
];

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const { get, loading } = useApi();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await get('/api/dashboard/stats');
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Products</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.products || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              📦
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.orders || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
              🛒
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.customers || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats?.revenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-2xl">
              💰
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📢</div>
            <div>
              <p className="text-sm text-orange-600">Active Campaigns</p>
              <p className="text-xl font-bold text-orange-700">{stats?.activeAds || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">💰</div>
            <div>
              <p className="text-sm text-yellow-600">Pending Pricing</p>
              <p className="text-xl font-bold text-yellow-700">{stats?.pendingPricing || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📋</div>
            <div>
              <p className="text-sm text-red-600">Low Stock Items</p>
              <p className="text-xl font-bold text-red-700">{stats?.lowStock || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⭐</div>
            <div>
              <p className="text-sm text-blue-600">Pending Reviews</p>
              <p className="text-xl font-bold text-blue-700">{stats?.pendingReviews || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Alert Widget */}
      <InventoryAlertWidget />

      {/* Feature Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div
              key={feature.path}
              className="feature-card group"
              onClick={() => handleCardClick(feature.path)}
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center text-2xl text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{feature.name}</h3>
              <p className="text-sm text-gray-500">{feature.description}</p>
              <div className="mt-3 flex items-center text-primary-600 text-sm font-medium">
                View details
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center text-3xl">
            🤖
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">AI-Powered Insights</h3>
            <p className="text-purple-100">
              Your e-commerce agent is analyzing data in real-time to provide actionable recommendations.
            </p>
          </div>
          <button
            onClick={() => navigate('/forecasts')}
            className="px-6 py-3 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            View AI Predictions
          </button>
        </div>
      </div>
    </div>
  );
};
