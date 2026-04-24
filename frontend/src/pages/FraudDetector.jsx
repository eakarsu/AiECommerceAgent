import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const FraudDetector = () => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { get, post, del, loading } = useApi();

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    try {
      const data = await get('/api/fraud-alerts');
      setAlerts(data);
      setFilteredAlerts(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'fraud_alerts_summary',
        data: {
          totalAlerts: data.length,
          criticalAlerts: data.filter(a => a.riskLevel === 'critical').length,
          highRiskAlerts: data.filter(a => a.riskLevel === 'high').length,
          pendingAlerts: data.filter(a => a.status === 'pending').length,
          confirmedFraud: data.filter(a => a.status === 'confirmed_fraud').length,
          totalAtRisk: data.filter(a => ['pending', 'investigating'].includes(a.status)).reduce((sum, a) => sum + parseFloat(a.orderAmount || 0), 0)
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Prioritize critical alerts for immediate review. Focus on card testing and account takeover patterns which have highest fraud confirmation rates.');
    }
  };

  const handleRowClick = async (alert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post(`/api/fraud-alerts/${alert.id}/ai-analyze`, {});
      setAiInsight(result.analysis);
      setSelectedAlert(result.alert);
    } catch (e) {
      setAiInsight({ analysis: alert.aiAnalysis || 'Review the transaction details and risk indicators to determine appropriate action.', recommendation: alert.aiRecommendation || 'Investigate further before making a decision.' });
    }
    setAiLoading(false);
  };

  const handleResolve = async (status) => {
    try {
      await post(`/api/fraud-alerts/${selectedAlert.id}/resolve`, { status });
      setIsModalOpen(false);
      loadAlerts();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this fraud alert?')) return;
    try {
      await del(`/api/fraud-alerts/${selectedAlert.id}`);
      setIsModalOpen(false);
      loadAlerts();
    } catch (e) { console.error(e); }
  };

  const getRiskLevelBadge = (level) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[level] || styles.low}`}>{level}</span>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'badge-warning',
      investigating: 'badge-info',
      confirmed_fraud: 'badge-danger',
      false_positive: 'badge-success',
      resolved: 'badge-secondary'
    };
    return <span className={`badge ${styles[status] || 'badge-secondary'}`}>{status?.replace('_', ' ')}</span>;
  };

  const getAlertTypeIcon = (type) => {
    const icons = {
      suspicious_order: '🚨',
      velocity_check: '⚡',
      address_mismatch: '📍',
      card_testing: '💳',
      account_takeover: '👤',
      refund_abuse: '↩️'
    };
    return icons[type] || '⚠️';
  };

  const columns = [
    { header: 'Alert Type', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-lg">
          {getAlertTypeIcon(row.alertType)}
        </div>
        <span className="font-medium capitalize">{row.alertType?.replace(/_/g, ' ')}</span>
      </div>
    )},
    { header: 'Customer', render: (row) => (
      <div>
        <p className="font-medium">{row.Customer?.name || row.customerEmail}</p>
        <p className="text-sm text-gray-500">{row.customerEmail}</p>
      </div>
    )},
    { header: 'Amount', render: (row) => <span className="font-bold text-gray-900">${parseFloat(row.orderAmount || 0).toFixed(2)}</span> },
    { header: 'Risk Score', render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${row.riskScore >= 80 ? 'bg-red-500' : row.riskScore >= 60 ? 'bg-orange-500' : row.riskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${row.riskScore}%` }}
          />
        </div>
        <span className="text-sm font-medium">{row.riskScore}</span>
      </div>
    )},
    { header: 'Risk Level', render: (row) => getRiskLevelBadge(row.riskLevel) },
    { header: 'Status', render: (row) => getStatusBadge(row.status) },
    { header: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() }
  ];

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.riskLevel === 'critical').length,
    high: alerts.filter(a => a.riskLevel === 'high').length,
    pending: alerts.filter(a => a.status === 'pending').length,
    atRisk: alerts.filter(a => ['pending', 'investigating'].includes(a.status)).reduce((sum, a) => sum + parseFloat(a.orderAmount || 0), 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Fraud Detector</h1>
          <p className="text-gray-500">AI-powered fraud detection and prevention</p>
        </div>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h3 className="font-medium text-red-900 mb-1">AI Fraud Analysis</h3>
              <p className="text-red-800 text-sm">{aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Alerts</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="stat-card border-l-4 border-l-red-500">
          <p className="text-sm text-gray-500">Critical</p>
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
        </div>
        <div className="stat-card border-l-4 border-l-orange-500">
          <p className="text-sm text-gray-500">High Risk</p>
          <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
        </div>
        <div className="stat-card border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="stat-card border-l-4 border-l-purple-500">
          <p className="text-sm text-gray-500">At Risk Amount</p>
          <p className="text-2xl font-bold text-purple-600">${stats.atRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={alerts}
          onFilter={setFilteredAlerts}
          searchFields={['alertType', 'customerEmail', 'Customer.name', 'status', 'riskLevel']}
          placeholder="Search by alert type, customer, status..."
        />
        <DataTable columns={columns} data={filteredAlerts} onRowClick={handleRowClick} loading={loading} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Fraud Alert Details" size="lg">
        {selectedAlert && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                {getAlertTypeIcon(selectedAlert.alertType)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold capitalize">{selectedAlert.alertType?.replace(/_/g, ' ')}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {getRiskLevelBadge(selectedAlert.riskLevel)}
                  {getStatusBadge(selectedAlert.status)}
                  <span className="text-sm text-gray-500">Transaction: {selectedAlert.transactionId}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">${parseFloat(selectedAlert.orderAmount || 0).toFixed(2)}</p>
                <p className="text-sm text-gray-500">Order Amount</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Risk Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${selectedAlert.riskScore >= 80 ? 'bg-red-500' : selectedAlert.riskScore >= 60 ? 'bg-orange-500' : selectedAlert.riskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${selectedAlert.riskScore}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold">{selectedAlert.riskScore}/100</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">IP Address</p>
                <p className="font-mono text-sm">{selectedAlert.ipAddress}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Risk Indicators</p>
              <div className="flex gap-2 flex-wrap">
                {selectedAlert.indicators?.map((indicator, i) => (
                  <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm border border-red-200">
                    {indicator.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Shipping Address</p>
                {selectedAlert.shippingAddress && (
                  <div className="text-sm">
                    <p>{selectedAlert.shippingAddress.street}</p>
                    <p>{selectedAlert.shippingAddress.city}, {selectedAlert.shippingAddress.state} {selectedAlert.shippingAddress.zip}</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Billing Address</p>
                {selectedAlert.billingAddress && (
                  <div className="text-sm">
                    <p>{selectedAlert.billingAddress.street}</p>
                    <p>{selectedAlert.billingAddress.city}, {selectedAlert.billingAddress.state} {selectedAlert.billingAddress.zip}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Analysis</h4>
                <button
                  onClick={() => handleRowClick(selectedAlert)}
                  disabled={aiLoading}
                  className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50"
                >
                  🔄 Regenerate
                </button>
              </div>
              {aiLoading ? (
                <p className="text-purple-600">Analyzing fraud patterns...</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Analysis:</p>
                    <p className="text-purple-800">{aiInsight?.analysis || selectedAlert.aiAnalysis || 'Click regenerate to generate AI analysis.'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-700">Recommendation:</p>
                    <p className="text-purple-800">{aiInsight?.recommendation || selectedAlert.aiRecommendation || 'Review the indicators and take appropriate action.'}</p>
                  </div>
                </div>
              )}
            </div>

            {selectedAlert.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedAlert.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              {selectedAlert.status === 'pending' && (
                <>
                  <button onClick={() => handleResolve('investigating')} className="btn btn-warning">🔍 Investigate</button>
                  <button onClick={() => handleResolve('confirmed_fraud')} className="btn btn-danger">🚫 Confirm Fraud</button>
                  <button onClick={() => handleResolve('false_positive')} className="btn btn-success">✓ False Positive</button>
                </>
              )}
              {selectedAlert.status === 'investigating' && (
                <>
                  <button onClick={() => handleResolve('confirmed_fraud')} className="btn btn-danger">🚫 Confirm Fraud</button>
                  <button onClick={() => handleResolve('false_positive')} className="btn btn-success">✓ False Positive</button>
                  <button onClick={() => handleResolve('resolved')} className="btn btn-secondary">✓ Resolve</button>
                </>
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
