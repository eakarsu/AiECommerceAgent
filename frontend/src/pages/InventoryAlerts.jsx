import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';

export const InventoryAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { get, put, post, loading } = useApi();

  useEffect(() => {
    loadAlerts();
    loadStats();
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await get('/api/inventory-alerts');
      setAlerts(data);
    } catch (e) { console.error(e); }
  };

  const loadStats = async () => {
    try {
      const data = await get('/api/inventory-alerts/stats');
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const handleRowClick = (alert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const handleAcknowledge = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const updated = await put(`/api/inventory-alerts/${id}/acknowledge`);
      // Update local state immediately
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged', acknowledgedAt: new Date() } : a));
      if (selectedAlert?.id === id) {
        setSelectedAlert({ ...selectedAlert, status: 'acknowledged', acknowledgedAt: new Date() });
      }
      loadStats();
    } catch (err) { console.error(err); }
  };

  const handleResolve = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await put(`/api/inventory-alerts/${id}/resolve`);
      // Update local state immediately
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved', resolvedAt: new Date() } : a));
      if (selectedAlert?.id === id) {
        setSelectedAlert({ ...selectedAlert, status: 'resolved', resolvedAt: new Date() });
      }
      loadStats();
      // Close modal after a brief delay to show the update
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedAlert(null);
      }, 500);
    } catch (err) { console.error(err); }
  };

  const handleCheckAll = async () => {
    try {
      const result = await post('/api/inventory-alerts/check-all');
      alert(`Checked all inventory. ${result.created} new alerts created.`);
      await loadAlerts();
      await loadStats();
    } catch (err) { console.error(err); }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const typeColors = {
    low_stock: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    out_of_stock: 'bg-red-100 text-red-800 border-red-200',
    overstock: 'bg-blue-100 text-blue-800 border-blue-200',
    reorder_needed: 'bg-purple-100 text-purple-800 border-purple-200'
  };

  const typeIcons = {
    low_stock: '⚠️',
    out_of_stock: '🚫',
    overstock: '📦',
    reorder_needed: '🔄'
  };

  const statusColors = {
    active: 'badge-danger',
    acknowledged: 'badge-warning',
    resolved: 'badge-success'
  };

  const getSuggestedActions = (alert) => {
    switch (alert.type) {
      case 'out_of_stock':
        return [
          'Contact supplier for emergency restock',
          'Update product listing to show "Out of Stock"',
          'Check for backorders and notify customers',
          'Consider alternative products for cross-sell'
        ];
      case 'low_stock':
        return [
          'Place reorder with supplier',
          'Review sales velocity to adjust reorder point',
          'Check upcoming promotions that may increase demand',
          'Consider adjusting safety stock levels'
        ];
      case 'overstock':
        return [
          'Create promotional discount to move inventory',
          'Consider bundle deals with other products',
          'Review demand forecast accuracy',
          'Evaluate warehouse storage costs'
        ];
      case 'reorder_needed':
        return [
          'Submit purchase order to supplier',
          'Verify supplier lead times',
          'Check for quantity discounts',
          'Review historical demand patterns'
        ];
      default:
        return ['Review inventory levels'];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Alerts</h1>
          <p className="text-gray-500">Monitor and manage stock level alerts</p>
        </div>
        <button onClick={handleCheckAll} disabled={loading} className="btn btn-primary">
          Check All Inventory
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm text-gray-500">Active Alerts</p>
            <p className="text-2xl font-bold text-red-600">{stats.active}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Acknowledged</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.acknowledged}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Resolved</p>
            <p className="text-2xl font-bold text-green-600">{stats.total - stats.active - stats.acknowledged}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Total Alerts</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'active', 'acknowledged', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({alerts.filter(a => f === 'all' || a.status === f).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-500">No alerts found</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => handleRowClick(alert)}
              className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${typeColors[alert.type] || 'bg-gray-50'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{typeIcons[alert.type]}</span>
                    <span className="font-medium">{alert.Product?.name || `Product #${alert.productId}`}</span>
                    <span className={`badge ${statusColors[alert.status]}`}>{alert.status}</span>
                    <span className="text-xs px-2 py-0.5 bg-white/50 rounded">{alert.type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs mt-1 opacity-75">
                    Current: {alert.currentQuantity} units | Threshold: {alert.threshold} | Created: {new Date(alert.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {alert.status === 'active' && (
                    <button
                      onClick={(e) => handleAcknowledge(alert.id, e)}
                      className="btn btn-secondary text-sm"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={(e) => handleResolve(alert.id, e)}
                      className="btn btn-success text-sm"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alert Detail Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Alert Details" size="lg">
        {selectedAlert && (
          <div className="space-y-6">
            {/* Header */}
            <div className={`p-4 rounded-lg ${typeColors[selectedAlert.type]}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{typeIcons[selectedAlert.type]}</span>
                <div>
                  <h3 className="text-lg font-bold">{selectedAlert.type.replace('_', ' ').toUpperCase()}</h3>
                  <p className="text-sm">{selectedAlert.message}</p>
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Product Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Product Name</p>
                  <p className="font-medium">{selectedAlert.Product?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">SKU</p>
                  <p className="font-medium">{selectedAlert.Product?.sku || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium">{selectedAlert.Product?.category || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Price</p>
                  <p className="font-medium">${parseFloat(selectedAlert.Product?.currentPrice || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Stock Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Current Stock</p>
                <p className={`text-2xl font-bold ${selectedAlert.currentQuantity === 0 ? 'text-red-600' : selectedAlert.currentQuantity <= selectedAlert.threshold ? 'text-yellow-600' : 'text-green-600'}`}>
                  {selectedAlert.currentQuantity}
                </p>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Threshold</p>
                <p className="text-2xl font-bold text-gray-700">{selectedAlert.threshold}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Status</p>
                <span className={`badge ${statusColors[selectedAlert.status]} text-lg`}>{selectedAlert.status}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">{new Date(selectedAlert.createdAt).toLocaleString()}</span>
                </div>
                {selectedAlert.acknowledgedAt && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    <span className="text-gray-600">Acknowledged:</span>
                    <span className="font-medium">{new Date(selectedAlert.acknowledgedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedAlert.resolvedAt && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-gray-600">Resolved:</span>
                    <span className="font-medium">{new Date(selectedAlert.resolvedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Suggested Actions */}
            {selectedAlert.status !== 'resolved' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Suggested Actions</h4>
                <ul className="space-y-2">
                  {getSuggestedActions(selectedAlert).map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="text-blue-500 mt-0.5">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              {selectedAlert.status === 'active' && (
                <button
                  onClick={() => handleAcknowledge(selectedAlert.id, null)}
                  className="btn btn-warning flex-1"
                >
                  Acknowledge Alert
                </button>
              )}
              {selectedAlert.status === 'active' || selectedAlert.status === 'acknowledged' ? (
                <button
                  onClick={() => handleResolve(selectedAlert.id, null)}
                  className="btn btn-success flex-1"
                >
                  Mark as Resolved
                </button>
              ) : null}
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
