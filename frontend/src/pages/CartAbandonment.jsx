import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const CartAbandonment = () => {
  const [carts, setCarts] = useState([]);
  const [filteredCarts, setFilteredCarts] = useState([]);
  const [selectedCart, setSelectedCart] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { get, post, del, loading } = useApi();

  useEffect(() => { loadCarts(); }, []);

  const loadCarts = async () => {
    try {
      const data = await get('/api/abandoned-carts');
      setCarts(data);
      setFilteredCarts(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const recovered = data.filter(c => c.status === 'recovered');
      const active = data.filter(c => c.status === 'active');
      const totalValue = data.reduce((sum, c) => sum + parseFloat(c.cartTotal || 0), 0);
      const recoveredValue = recovered.reduce((sum, c) => sum + parseFloat(c.revenue || c.cartTotal || 0), 0);

      const result = await post('/api/ai/analyze', {
        type: 'abandoned_carts_summary',
        data: {
          totalCarts: data.length,
          activeCarts: active.length,
          recoveredCarts: recovered.length,
          recoveryRate: data.length > 0 ? ((recovered.length / data.length) * 100).toFixed(1) : 0,
          totalAbandonedValue: totalValue,
          recoveredRevenue: recoveredValue,
          avgCartValue: data.length > 0 ? (totalValue / data.length).toFixed(2) : 0
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Focus on high-value carts with recent abandonment. Personalized recovery emails with time-sensitive discounts show the highest conversion rates.');
    }
  };

  const handleRowClick = async (cart) => {
    setSelectedCart(cart);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post(`/api/abandoned-carts/${cart.id}/ai-recovery`, {});
      setAiInsight(result.strategy);
      setSelectedCart(result.cart);
    } catch (e) {
      setAiInsight({
        personalizedMessage: cart.aiPersonalizedMessage || 'Complete your purchase today!',
        strategy: cart.aiRecoveryStrategy || 'Send personalized reminder with discount offer.',
        recommendedDiscount: cart.aiRecommendedDiscount || 10,
        urgencyLevel: cart.recoveryEmailsSent >= 2 ? 'high' : 'medium'
      });
    }
    setAiLoading(false);
  };

  const handleSendRecoveryEmail = async () => {
    setSendingEmail(true);
    try {
      const result = await post(`/api/abandoned-carts/${selectedCart.id}/send-recovery-email`, {});
      setSelectedCart(result.cart);
      loadCarts();
      alert('Recovery email sent successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to send email. Check console for details.');
    }
    setSendingEmail(false);
  };

  const handleMarkRecovered = async () => {
    try {
      await post(`/api/abandoned-carts/${selectedCart.id}/mark-recovered`, {
        revenue: selectedCart.cartTotal
      });
      setIsModalOpen(false);
      loadCarts();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this abandoned cart record?')) return;
    try {
      await del(`/api/abandoned-carts/${selectedCart.id}`);
      setIsModalOpen(false);
      loadCarts();
    } catch (e) { console.error(e); }
  };

  const getStageBadge = (stage) => {
    const styles = {
      identified: 'badge-info',
      email_1_sent: 'badge-warning',
      email_2_sent: 'badge-warning',
      email_3_sent: 'badge-danger',
      recovered: 'badge-success',
      expired: 'badge-secondary'
    };
    const labels = {
      identified: 'Identified',
      email_1_sent: 'Email 1',
      email_2_sent: 'Email 2',
      email_3_sent: 'Email 3',
      recovered: 'Recovered',
      expired: 'Expired'
    };
    return <span className={`badge ${styles[stage] || 'badge-secondary'}`}>{labels[stage] || stage}</span>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-blue-100 text-blue-800',
      recovered: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      unsubscribed: 'bg-red-100 text-red-800'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.active}`}>{status}</span>;
  };

  const getTimeSinceAbandonment = (abandonedAt) => {
    const diff = Date.now() - new Date(abandonedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const columns = [
    { header: 'Customer', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-lg">
          {row.customerName?.charAt(0) || '?'}
        </div>
        <div>
          <p className="font-medium">{row.customerName || 'Unknown'}</p>
          <p className="text-sm text-gray-500">{row.customerEmail}</p>
        </div>
      </div>
    )},
    { header: 'Cart Value', render: (row) => <span className="font-bold text-gray-900">${parseFloat(row.cartTotal || 0).toFixed(2)}</span> },
    { header: 'Items', render: (row) => (
      <div className="flex items-center gap-1">
        <span className="text-lg">🛒</span>
        <span>{row.cartItemCount || row.cartItems?.length || 0} items</span>
      </div>
    )},
    { header: 'Abandoned', render: (row) => (
      <div>
        <p className="font-medium">{getTimeSinceAbandonment(row.abandonedAt)}</p>
        <p className="text-sm text-gray-500">{new Date(row.abandonedAt).toLocaleDateString()}</p>
      </div>
    )},
    { header: 'Stage', render: (row) => getStageBadge(row.recoveryStage) },
    { header: 'Emails', render: (row) => (
      <span className={`font-medium ${row.recoveryEmailsSent >= 3 ? 'text-red-600' : row.recoveryEmailsSent >= 1 ? 'text-yellow-600' : 'text-gray-600'}`}>
        {row.recoveryEmailsSent || 0} sent
      </span>
    )},
    { header: 'Status', render: (row) => getStatusBadge(row.status) }
  ];

  const stats = {
    total: carts.length,
    active: carts.filter(c => c.status === 'active').length,
    recovered: carts.filter(c => c.status === 'recovered').length,
    rate: carts.length > 0 ? ((carts.filter(c => c.status === 'recovered').length / carts.length) * 100).toFixed(1) : 0,
    revenue: carts.filter(c => c.status === 'recovered').reduce((sum, c) => sum + parseFloat(c.revenue || c.cartTotal || 0), 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Cart Recovery</h1>
          <p className="text-gray-500">AI-powered abandoned cart recovery</p>
        </div>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <h3 className="font-medium text-pink-900 mb-1">AI Recovery Insights</h3>
              <p className="text-pink-800 text-sm">{aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Abandoned</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="stat-card border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-500">Active Recovery</p>
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
        </div>
        <div className="stat-card border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500">Recovered</p>
          <p className="text-2xl font-bold text-green-600">{stats.recovered}</p>
        </div>
        <div className="stat-card border-l-4 border-l-purple-500">
          <p className="text-sm text-gray-500">Recovery Rate</p>
          <p className="text-2xl font-bold text-purple-600">{stats.rate}%</p>
        </div>
        <div className="stat-card border-l-4 border-l-pink-500">
          <p className="text-sm text-gray-500">Recovered Revenue</p>
          <p className="text-2xl font-bold text-pink-600">${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={carts}
          onFilter={setFilteredCarts}
          searchFields={['customerName', 'customerEmail', 'status', 'recoveryStage']}
          placeholder="Search by customer, email, status..."
        />
        <DataTable columns={columns} data={filteredCarts} onRowClick={handleRowClick} loading={loading} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Abandoned Cart Details" size="lg">
        {selectedCart && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center text-2xl">
                {selectedCart.customerName?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{selectedCart.customerName || 'Unknown Customer'}</h3>
                <p className="text-gray-500">{selectedCart.customerEmail}</p>
                <div className="flex items-center gap-3 mt-2">
                  {getStageBadge(selectedCart.recoveryStage)}
                  {getStatusBadge(selectedCart.status)}
                  <span className="text-sm text-gray-500">{selectedCart.deviceType || 'Unknown'} device</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">${parseFloat(selectedCart.cartTotal || 0).toFixed(2)}</p>
                <p className="text-sm text-gray-500">{selectedCart.cartItemCount || selectedCart.cartItems?.length || 0} items</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Cart Items</h4>
              <div className="space-y-2">
                {selectedCart.cartItems?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xl">📦</div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-bold">${parseFloat(item.price || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Abandoned</p>
                <p className="font-medium">{getTimeSinceAbandonment(selectedCart.abandonedAt)}</p>
                <p className="text-sm text-gray-500">{new Date(selectedCart.abandonedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Exit Page</p>
                <p className="font-medium">{selectedCart.exitPage || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Emails Sent</p>
                <p className="font-medium">{selectedCart.recoveryEmailsSent || 0} / 3</p>
                {selectedCart.lastEmailSentAt && (
                  <p className="text-sm text-gray-500">Last: {new Date(selectedCart.lastEmailSentAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            {selectedCart.discountCodeOffered && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Discount Offered</p>
                    <p className="text-lg font-bold text-green-700">{selectedCart.discountAmount}% OFF</p>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg border border-green-200">
                    <p className="font-mono font-bold text-green-700">{selectedCart.discountCodeOffered}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Recovery Strategy</h4>
                <button
                  onClick={() => handleRowClick(selectedCart)}
                  disabled={aiLoading}
                  className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50"
                >
                  🔄 Regenerate
                </button>
              </div>
              {aiLoading ? (
                <p className="text-purple-600">Generating recovery strategy...</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Personalized Message:</p>
                    <p className="text-purple-800 whitespace-pre-line">{aiInsight?.personalizedMessage || selectedCart.aiPersonalizedMessage || 'Click regenerate to generate AI message.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-purple-700">Recommended Discount:</p>
                      <p className="text-purple-800 font-bold">{aiInsight?.recommendedDiscount || selectedCart.aiRecommendedDiscount || 0}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-700">Urgency Level:</p>
                      <p className="text-purple-800 capitalize">{aiInsight?.urgencyLevel || 'medium'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-700">Strategy:</p>
                    <p className="text-purple-800">{aiInsight?.strategy || selectedCart.aiRecoveryStrategy || 'Send personalized recovery email.'}</p>
                  </div>
                </div>
              )}
            </div>

            {selectedCart.status === 'recovered' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="font-medium text-green-800">Cart Recovered!</p>
                    <p className="text-sm text-green-600">
                      Recovered on {new Date(selectedCart.recoveredAt).toLocaleDateString()} -
                      Revenue: ${parseFloat(selectedCart.revenue || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              {selectedCart.status === 'active' && selectedCart.recoveryEmailsSent < 3 && (
                <button
                  onClick={handleSendRecoveryEmail}
                  disabled={sendingEmail}
                  className="btn btn-ai"
                >
                  {sendingEmail ? '📧 Sending...' : '📧 Send Recovery Email'}
                </button>
              )}
              {selectedCart.status === 'active' && (
                <button onClick={handleMarkRecovered} className="btn btn-success">
                  ✓ Mark as Recovered
                </button>
              )}
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary ml-auto">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">🗑️ Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
