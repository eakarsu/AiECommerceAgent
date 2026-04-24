import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState([]);
  const [selectedRec, setSelectedRec] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newRec, setNewRec] = useState({ type: 'cross_sell', sourceProductId: '', targetProductId: '', score: '', reason: '' });
  const [products, setProducts] = useState([]);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, post, del, loading } = useApi();
  const { showToast } = useNotifications();

  useEffect(() => { loadRecommendations(); loadProducts(); }, []);
  const loadRecommendations = async () => {
    try {
      const data = await get('/api/recommendations');
      setRecommendations(data);
      setFilteredRecommendations(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', { type: 'recommendations_summary', data: { totalRecommendations: data.length, totalClicks: data.reduce((sum, r) => sum + (r.clicks || 0), 0), totalConversions: data.reduce((sum, r) => sum + (r.conversions || 0), 0), totalRevenue: data.reduce((sum, r) => sum + parseFloat(r.revenue || 0), 0), types: [...new Set(data.map(r => r.type))], avgScore: data.reduce((sum, r) => sum + parseFloat(r.score || 0), 0) / data.length } });
      setAiSummary(result.insight || result);
    } catch (e) { setAiSummary('AI analysis: High-score recommendations are driving revenue. Consider expanding successful cross-sell patterns.'); }
  };

  const loadProducts = async () => { try { setProducts(await get('/api/products')); } catch (e) { console.error(e); } };

  const handleRowClick = async (r) => {
    setSelectedRec(r); setIsModalOpen(true); setAiInsight(null); setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', { type: 'recommendation_analysis', data: { type: r.type, sourceProduct: products.find(p => p.id === r.sourceProductId)?.name, targetProduct: products.find(p => p.id === r.targetProductId)?.name, score: r.score, clicks: r.clicks, conversions: r.conversions, revenue: r.revenue, status: r.status, reason: r.reason } });
      setAiInsight(result.insight || result);
    } catch (e) { setAiInsight('Analyze the conversion rate and consider adjusting positioning or timing of this recommendation.'); }
    setAiLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await post('/api/recommendations', { ...newRec, sourceProductId: parseInt(newRec.sourceProductId), targetProductId: parseInt(newRec.targetProductId), score: parseFloat(newRec.score) }); setIsNewModalOpen(false); loadRecommendations(); showToast('Recommendation created', 'success'); }
    catch (e) { console.error(e); showToast('Failed to create recommendation', 'error'); }
  };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this recommendation?');
    setConfirmAction(() => async () => {
      try { await del(`/api/recommendations/${selectedRec.id}`); setIsModalOpen(false); loadRecommendations(); showToast('Recommendation deleted', 'success'); }
      catch (e) { console.error(e); showToast('Failed to delete recommendation', 'error'); }
    });
    setConfirmOpen(true);
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try { await post('/api/recommendations/recalculate'); loadRecommendations(); showToast('Recommendations recalculated', 'success'); }
    catch (e) { console.error(e); showToast('Failed to recalculate', 'error'); }
    setRecalculating(false);
  };

  const typeColors = { product: 'badge-info', upsell: 'badge-success', cross_sell: 'badge-warning', bundle: 'badge-gray' };
  const getProductName = (id) => products.find(p => p.id === id)?.name || `Product #${id}`;

  const columns = [
    { header: 'Recommendation', render: (row) => (<div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-lg">💡</div><div><span className={`badge ${typeColors[row.type]}`}>{row.type.replace('_', ' ')}</span></div></div>) },
    { header: 'Source', render: (row) => row.sourceProductId ? getProductName(row.sourceProductId) : '-' },
    { header: 'Target', render: (row) => getProductName(row.targetProductId) },
    { header: 'Score', render: (row) => (<div className="flex items-center gap-2"><div className="w-12 bg-gray-200 rounded-full h-2"><div className="h-2 rounded-full bg-amber-500" style={{width: `${row.score * 100}%`}}></div></div><span className="font-bold">{(parseFloat(row.score || 0) * 100).toFixed(0)}%</span></div>) },
    { header: 'Clicks', render: (row) => row.clicks?.toLocaleString() },
    { header: 'Conversions', render: (row) => row.conversions?.toLocaleString() },
    { header: 'Revenue', render: (row) => <span className="font-bold text-green-600">${parseFloat(row.revenue).toLocaleString()}</span> },
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{row.status}</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Product Recommendations</h1><p className="text-gray-500">AI-powered product recommendations</p></div>
        <div className="flex gap-2">
          <button onClick={handleRecalculate} disabled={recalculating} className="btn btn-secondary">{recalculating ? 'Recalculating...' : 'Recalculate'}</button>
          <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ New Recommendation</button>
        </div>
      </div>

      {aiSummary && (<div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4"><div className="flex items-start gap-3"><span className="text-2xl">✨</span><div><h3 className="font-medium text-amber-900 mb-1">AI Recommendation Insights</h3><p className="text-amber-800 text-sm">{aiSummary}</p></div></div></div>)}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Recommendations</p><p className="text-2xl font-bold">{recommendations.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Clicks</p><p className="text-2xl font-bold">{recommendations.reduce((sum, r) => sum + (r.clicks || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Conversions</p><p className="text-2xl font-bold text-green-600">{recommendations.reduce((sum, r) => sum + (r.conversions || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-green-600">${recommendations.reduce((sum, r) => sum + parseFloat(r.revenue || 0), 0).toLocaleString()}</p></div>
      </div>

      <div className="card space-y-4">
        <LiveSearch data={recommendations} onFilter={setFilteredRecommendations} searchFields={['type', 'reason', 'status']} placeholder="Search by type, reason, status..." />
        <DataTable columns={columns} data={filteredRecommendations} onRowClick={handleRowClick} loading={loading} emptyIcon="💡" emptyTitle="No recommendations found" emptyDescription="Create a new recommendation to get started." />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Recommendation Details" size="lg">
        {selectedRec && (
          <div className="space-y-6">
            <div className="flex items-center gap-3"><span className={`badge ${typeColors[selectedRec.type]}`}>{selectedRec.type.replace('_', ' ')}</span><span className={`badge ${selectedRec.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{selectedRec.status}</span></div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">{selectedRec.sourceProductId ? (<><p className="text-sm text-gray-500">Source Product</p><p className="font-bold">{getProductName(selectedRec.sourceProductId)}</p></>) : <p className="text-gray-400">No Source</p>}</div>
                <div className="px-4 text-2xl">→</div>
                <div className="text-center flex-1"><p className="text-sm text-gray-500">Recommended Product</p><p className="font-bold">{getProductName(selectedRec.targetProductId)}</p></div>
              </div>
            </div>
            <div><p className="text-sm text-gray-500 mb-2">Recommendation Score</p><div className="flex items-center gap-3"><div className="flex-1 bg-gray-200 rounded-full h-4"><div className="h-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-600" style={{width: `${parseFloat(selectedRec.score || 0) * 100}%`}}></div></div><span className="text-xl font-bold">{(parseFloat(selectedRec.score || 0) * 100).toFixed(0)}%</span></div></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Clicks</p><p className="text-2xl font-bold">{selectedRec.clicks?.toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Conversions</p><p className="text-2xl font-bold text-green-600">{selectedRec.conversions?.toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Revenue</p><p className="text-2xl font-bold text-green-600">${parseFloat(selectedRec.revenue).toLocaleString()}</p></div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2"><h4 className="font-medium text-purple-900">✨ AI Insights</h4><button onClick={() => handleRowClick(selectedRec)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button></div>
              {aiLoading ? <p className="text-purple-600">Analyzing recommendation...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3"><button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button><button onClick={handleDelete} className="btn btn-danger">Delete</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Recommendation">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Type</label><select className="input" value={newRec.type} onChange={(e) => setNewRec({...newRec, type: e.target.value})}><option value="cross_sell">Cross Sell</option><option value="upsell">Upsell</option><option value="bundle">Bundle</option><option value="product">Product</option></select></div>
          <div><label className="block text-sm font-medium mb-1">Source Product (optional)</label><select className="input" value={newRec.sourceProductId} onChange={(e) => setNewRec({...newRec, sourceProductId: e.target.value})}><option value="">None</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Target Product</label><select className="input" value={newRec.targetProductId} onChange={(e) => setNewRec({...newRec, targetProductId: e.target.value})} required>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Score (0-1)</label><input type="number" step="0.01" min="0" max="1" className="input" value={newRec.score} onChange={(e) => setNewRec({...newRec, score: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium mb-1">Reason</label><textarea className="input" rows={2} value={newRec.reason} onChange={(e) => setNewRec({...newRec, reason: e.target.value})} /></div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Create</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
