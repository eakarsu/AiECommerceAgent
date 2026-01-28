import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';

const menuItems = [
  { path: '/dashboard', name: 'Dashboard', icon: '📊' },
  { path: '/products', name: 'Products', icon: '📦' },
  { path: '/pricing', name: 'Dynamic Pricing', icon: '💰' },
  { path: '/campaigns', name: 'Ad Campaigns', icon: '📢' },
  { path: '/inventory', name: 'Inventory', icon: '📋' },
  { path: '/customers', name: 'Customers', icon: '👥' },
  { path: '/orders', name: 'Orders', icon: '🛒' },
  { path: '/reviews', name: 'Review Analysis', icon: '⭐' },
  { path: '/content', name: 'Content Generation', icon: '✍️' },
  { path: '/trends', name: 'Market Trends', icon: '📈' },
  { path: '/competitors', name: 'Competitor Analysis', icon: '🏢' },
  { path: '/ab-tests', name: 'A/B Testing', icon: '🧪' },
  { path: '/forecasts', name: 'Sales Forecasting', icon: '🔮' },
  { path: '/segments', name: 'Customer Segments', icon: '🎯' },
  { path: '/recommendations', name: 'Recommendations', icon: '💡' },
  { path: '/inventory-alerts', name: 'Stock Alerts', icon: '⚠️' },
  { path: '/payment-methods', name: 'Payment Methods', icon: '💳' },
  { path: '/coupons', name: 'Coupons', icon: '🎟️' },
  { path: '/reports', name: 'Reports & Export', icon: '📑' },
  { path: '/audit-log', name: 'Audit Log', icon: '📜' },
  { path: '/users', name: 'User Management', icon: '👤' },
  { path: '/notifications', name: 'All Notifications', icon: '🔔' },
];

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center text-xl">
              🤖
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-lg">AI Commerce</h1>
                <p className="text-xs text-gray-400">E-commerce Agent</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="ml-3">{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.role}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={handleLogout}
              className="mt-3 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-800">
              {menuItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="ai-badge">
              <span className="mr-1">✨</span>
              AI Powered
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
