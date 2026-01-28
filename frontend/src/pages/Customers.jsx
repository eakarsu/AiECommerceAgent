import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', segment: 'New' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkData, setBulkData] = useState({ segment: '', status: '' });
  const { get, post, del, loading } = useApi();

  useEffect(() => { loadCustomers(); }, []);
  const loadCustomers = async () => {
    try {
      const data = await get('/api/customers');
      setCustomers(data);
      setFilteredCustomers(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'customers_summary',
        data: {
          totalCustomers: data.length,
          vipCustomers: data.filter(c => c.segment === 'VIP').length,
          atRisk: data.filter(c => c.churnRisk > 30).length,
          totalLTV: data.reduce((sum, c) => sum + parseFloat(c.lifetimeValue || 0), 0),
          avgChurnRisk: data.reduce((sum, c) => sum + parseFloat(c.churnRisk || 0), 0) / data.length,
          segments: [...new Set(data.map(c => c.segment))]
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Focus retention efforts on high-value at-risk customers and nurture new customers to VIP status.');
    }
  };

  const handleRowClick = async (c) => {
    setSelectedCustomer(c);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    setOrderHistory(null);
    setOrderStats(null);
    setShowOrderHistory(false);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'customer_analysis',
        data: {
          name: c.name,
          segment: c.segment,
          totalOrders: c.totalOrders,
          totalSpent: c.totalSpent,
          averageOrderValue: c.averageOrderValue,
          lifetimeValue: c.lifetimeValue,
          churnRisk: c.churnRisk,
          status: c.status,
          preferredCategories: c.preferredCategories
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Consider personalized engagement strategies based on this customer\'s purchase history and preferences.');
    }
    setAiLoading(false);
  };

  const loadOrderHistory = async (customerId) => {
    try {
      const data = await get(`/api/customers/${customerId}/orders`);
      setOrderHistory(data.orders);
      setOrderStats(data.stats);
      setShowOrderHistory(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    try {
      await post('/api/bulk/customers', {
        ids: selectedIds,
        action: bulkAction,
        data: bulkData
      });
      setSelectedIds([]);
      setBulkAction('');
      setBulkData({ segment: '', status: '' });
      loadCustomers();
    } catch (e) {
      console.error(e);
      alert('Bulk action failed');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCustomers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await del(`/api/customers/${selectedCustomer.id}`);
      setIsModalOpen(false);
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await post('/api/customers', newCustomer); setIsNewModalOpen(false); setNewCustomer({ name: '', email: '', phone: '', segment: 'New' }); loadCustomers(); }
    catch (e) { console.error(e); }
  };

  const columns = [
    { header: 'Customer', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-lg">{row.name?.[0]?.toUpperCase()}</div>
        <div><span className="font-medium block">{row.name}</span><span className="text-sm text-gray-500">{row.email}</span></div>
      </div>
    )},
    { header: 'Segment', render: (row) => <span className={`badge ${row.segment === 'VIP' ? 'badge-success' : row.segment === 'New' ? 'badge-info' : 'badge-gray'}`}>{row.segment}</span> },
    { header: 'Orders', render: (row) => row.totalOrders },
    { header: 'Total Spent', render: (row) => `$${parseFloat(row.totalSpent).toLocaleString()}` },
    { header: 'AOV', render: (row) => `$${parseFloat(row.averageOrderValue).toFixed(2)}` },
    { header: 'LTV', render: (row) => `$${parseFloat(row.lifetimeValue).toLocaleString()}` },
    { header: 'Churn Risk', render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-12 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${row.churnRisk > 30 ? 'bg-red-500' : row.churnRisk > 15 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${Math.min(row.churnRisk, 100)}%`}}></div></div>
        <span className="text-sm">{parseFloat(row.churnRisk || 0).toFixed(0)}%</span>
      </div>
    )},
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : row.status === 'churned' ? 'badge-danger' : 'badge-warning'}`}>{row.status}</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Customers</h1><p className="text-gray-500">Customer analytics and management</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ Add Customer</button>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-pink-900 mb-1">AI Customer Insights</h3><p className="text-pink-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Customers</p><p className="text-2xl font-bold">{customers.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">VIP Customers</p><p className="text-2xl font-bold text-green-600">{customers.filter(c => c.segment === 'VIP').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">At Risk</p><p className="text-2xl font-bold text-red-600">{customers.filter(c => c.churnRisk > 30).length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total LTV</p><p className="text-2xl font-bold">${customers.reduce((sum, c) => sum + parseFloat(c.lifetimeValue || 0), 0).toLocaleString()}</p></div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={customers}
          onFilter={setFilteredCustomers}
          searchFields={['name', 'email', 'phone', 'segment']}
          placeholder="Search by name, email, phone, segment..."
        />

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
            <span className="font-medium text-blue-800">{selectedIds.length} selected</span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="input"
            >
              <option value="">Select action...</option>
              <option value="update_segment">Update Segment</option>
              <option value="update_status">Update Status</option>
              <option value="delete">Delete</option>
            </select>
            {bulkAction === 'update_segment' && (
              <select
                value={bulkData.segment}
                onChange={(e) => setBulkData({ ...bulkData, segment: e.target.value })}
                className="input"
              >
                <option value="">Select segment...</option>
                <option value="New">New</option>
                <option value="Regular">Regular</option>
                <option value="VIP">VIP</option>
                <option value="At Risk">At Risk</option>
              </select>
            )}
            {bulkAction === 'update_status' && (
              <select
                value={bulkData.status}
                onChange={(e) => setBulkData({ ...bulkData, status: e.target.value })}
                className="input"
              >
                <option value="">Select status...</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="churned">Churned</option>
              </select>
            )}
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction || (bulkAction === 'update_segment' && !bulkData.segment) || (bulkAction === 'update_status' && !bulkData.status)}
              className="btn btn-primary"
            >
              Apply
            </button>
            <button onClick={() => setSelectedIds([])} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        )}

        {/* Select All Checkbox */}
        <div className="flex items-center gap-2 px-2">
          <input
            type="checkbox"
            checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-600">Select all ({filteredCustomers.length})</span>
        </div>

        <DataTable
          columns={[
            {
              header: '',
              render: (row) => (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(row.id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4"
                />
              )
            },
            ...columns
          ]}
          data={filteredCustomers}
          onRowClick={handleRowClick}
          loading={loading}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Customer Details" size="lg">
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center text-2xl">{selectedCustomer.name?.[0]?.toUpperCase()}</div>
              <div>
                <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                <p className="text-gray-500">{selectedCustomer.email}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`badge ${selectedCustomer.segment === 'VIP' ? 'badge-success' : 'badge-info'}`}>{selectedCustomer.segment}</span>
                  <span className={`badge ${selectedCustomer.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{selectedCustomer.status}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setShowOrderHistory(false)}
                className={`px-4 py-2 font-medium ${!showOrderHistory ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
              >
                Overview
              </button>
              <button
                onClick={() => loadOrderHistory(selectedCustomer.id)}
                className={`px-4 py-2 font-medium ${showOrderHistory ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
              >
                Order History
              </button>
            </div>

            {!showOrderHistory ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Orders</p><p className="text-2xl font-bold">{selectedCustomer.totalOrders}</p></div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Total Spent</p><p className="text-2xl font-bold">${parseFloat(selectedCustomer.totalSpent).toLocaleString()}</p></div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">AOV</p><p className="text-2xl font-bold">${parseFloat(selectedCustomer.averageOrderValue).toFixed(2)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">LTV</p><p className="text-2xl font-bold text-green-600">${parseFloat(selectedCustomer.lifetimeValue).toLocaleString()}</p></div>
                </div>
                {selectedCustomer.preferredCategories?.length > 0 && (
                  <div><h4 className="font-medium mb-2">Preferred Categories</h4><div className="flex gap-2">{selectedCustomer.preferredCategories.map((cat, i) => <span key={i} className="badge badge-info">{cat}</span>)}</div></div>
                )}
                <div><h4 className="font-medium mb-2">Churn Risk</h4>
                  <div className="flex items-center gap-3"><div className="flex-1 bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${selectedCustomer.churnRisk > 30 ? 'bg-red-500' : selectedCustomer.churnRisk > 15 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${Math.min(selectedCustomer.churnRisk, 100)}%`}}></div></div><span className="font-bold">{parseFloat(selectedCustomer.churnRisk || 0).toFixed(1)}%</span></div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-purple-900">✨ AI Insights</h4>
                    <button onClick={() => handleRowClick(selectedCustomer)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
                  </div>
                  {aiLoading ? <p className="text-purple-600">Analyzing customer...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {orderStats && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-500">Total Orders</p>
                      <p className="text-xl font-bold text-blue-600">{orderStats.totalOrders}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-500">Total Spent</p>
                      <p className="text-xl font-bold text-green-600">${orderStats.totalSpent?.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-500">Average Order</p>
                      <p className="text-xl font-bold text-purple-600">${orderStats.averageOrder?.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-500">Orders by Status</p>
                      <div className="flex gap-1 justify-center mt-1">
                        {orderStats.ordersByStatus && Object.entries(orderStats.ordersByStatus).map(([status, count]) => (
                          <span key={status} className="text-xs badge badge-info">{status}: {count}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {orderHistory?.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No orders found</p>
                  ) : (
                    orderHistory?.map(order => (
                      <div key={order.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.orderId}</p>
                          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${parseFloat(order.total).toFixed(2)}</p>
                          <span className={`badge ${
                            order.status === 'delivered' ? 'badge-success' :
                            order.status === 'shipped' ? 'badge-info' :
                            order.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                          }`}>{order.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Add Customer">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" className="input" value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" className="input" value={newCustomer.email} onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" className="input" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} /></div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Add Customer</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>
    </div>
  );
};
