import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/NotificationCenter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Pricing } from './pages/Pricing';
import { Campaigns } from './pages/Campaigns';
import { Inventory } from './pages/Inventory';
import { Customers } from './pages/Customers';
import { Orders } from './pages/Orders';
import { Reviews } from './pages/Reviews';
import { Content } from './pages/Content';
import { Trends } from './pages/Trends';
import { Competitors } from './pages/Competitors';
import { ABTests } from './pages/ABTests';
import { Forecasts } from './pages/Forecasts';
import { Segments } from './pages/Segments';
import { Recommendations } from './pages/Recommendations';
import { InventoryAlerts } from './pages/InventoryAlerts';
import { PaymentMethods } from './pages/PaymentMethods';
import { Checkout } from './pages/Checkout';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { Coupons } from './pages/Coupons';
import { AuditLog } from './pages/AuditLog';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Notifications } from './pages/Notifications';
import { FraudDetector } from './pages/FraudDetector';
import { CartAbandonment } from './pages/CartAbandonment';
import { Profile } from './pages/Profile';
import InventoryReorder from './pages/InventoryReorder';
import PriceElasticity from './pages/PriceElasticity';
import PhotoCritique from './pages/PhotoCritique';
import Concierge from './pages/Concierge';
import FraudClusters from './pages/FraudClusters';
import ForgotPassword from './pages/ForgotPassword';
import VisualSearch from './pages/VisualSearch';
import MarketplaceSync from './pages/MarketplaceSync';
import AffiliateReferrals from './pages/AffiliateReferrals';

import Batch03Features from './pages/Batch03Features';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const hierarchy = { admin: 3, manager: 2, user: 1 };
    const userLevel = hierarchy[user?.role] || 0;
    const requiredLevel = hierarchy[requiredRole] || 0;
    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
          <Route path="/batch03" element={<Batch03Features />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
              <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
              <Route path="/content" element={<ProtectedRoute><Content /></ProtectedRoute>} />
              <Route path="/trends" element={<ProtectedRoute><Trends /></ProtectedRoute>} />
              <Route path="/competitors" element={<ProtectedRoute><Competitors /></ProtectedRoute>} />
              <Route path="/ab-tests" element={<ProtectedRoute><ABTests /></ProtectedRoute>} />
              <Route path="/forecasts" element={<ProtectedRoute><Forecasts /></ProtectedRoute>} />
              <Route path="/segments" element={<ProtectedRoute><Segments /></ProtectedRoute>} />
              <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
              <Route path="/inventory-alerts" element={<ProtectedRoute><InventoryAlerts /></ProtectedRoute>} />
              <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethods /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
              <Route path="/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
              <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredRole="admin"><Users /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/fraud-detector" element={<ProtectedRoute><FraudDetector /></ProtectedRoute>} />
              <Route path="/cart-abandonment" element={<ProtectedRoute><CartAbandonment /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/inventory-reorder" element={<ProtectedRoute><InventoryReorder /></ProtectedRoute>} />
              <Route path="/price-elasticity" element={<ProtectedRoute><PriceElasticity /></ProtectedRoute>} />
              <Route path="/photo-critique" element={<ProtectedRoute><PhotoCritique /></ProtectedRoute>} />
              <Route path="/concierge" element={<ProtectedRoute><Concierge /></ProtectedRoute>} />
              <Route path="/fraud-clusters" element={<ProtectedRoute><FraudClusters /></ProtectedRoute>} />
              <Route path="/visual-search" element={<ProtectedRoute><VisualSearch /></ProtectedRoute>} />
              <Route path="/marketplace-sync" element={<ProtectedRoute><MarketplaceSync /></ProtectedRoute>} />
              <Route path="/affiliate-referrals" element={<ProtectedRoute><AffiliateReferrals /></ProtectedRoute>} />
            </Routes>
          </ErrorBoundary>
          <ToastContainer />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
