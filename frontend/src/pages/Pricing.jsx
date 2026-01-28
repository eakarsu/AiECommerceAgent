import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const Pricing = () => {
  const [pricing, setPricing] = useState([]);
  const [filteredPricing, setFilteredPricing] = useState([]);
  const [selectedPricing, setSelectedPricing] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [newPricing, setNewPricing] = useState({
    productId: '', originalPrice: '', suggestedPrice: '', competitorPrice: '', demandScore: 50, priceChangeReason: ''
  });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { get, post, del, loading } = useApi();

  useEffect(() => {
    loadPricing();
    loadProducts();
  }, []);

  const loadPricing = async () => {
    try {
      const data = await get('/api/pricing');
      setPricing(data);
      setFilteredPricing(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'pricing_summary',
        data: {
          totalSuggestions: data.length,
          pendingCount: data.filter(p => p.status === 'pending').length,
          appliedCount: data.filter(p => p.status === 'applied').length,
          avgConfidence: data.reduce((sum, p) => sum + parseFloat(p.aiConfidence || 0), 0) / data.length,
          avgDemand: data.reduce((sum, p) => sum + (p.demandScore || 0), 0) / data.length,
          priceIncreases: data.filter(p => parseFloat(p.suggestedPrice) > parseFloat(p.originalPrice)).length,
          priceDecreases: data.filter(p => parseFloat(p.suggestedPrice) < parseFloat(p.originalPrice)).length
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Review pending price suggestions and prioritize high-confidence recommendations for quick wins.');
    }
  };

  const loadProducts = async () => {
    try {
      const data = await get('/api/products');
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleRowClick = async (item) => {
    setSelectedPricing(item);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'pricing_analysis',
        data: {
          productName: item.Product?.name,
          originalPrice: item.originalPrice,
          suggestedPrice: item.suggestedPrice,
          competitorPrice: item.competitorPrice,
          demandScore: item.demandScore,
          aiConfidence: item.aiConfidence,
          status: item.status,
          reason: item.priceChangeReason
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Consider the demand score and competitor pricing when making your final pricing decision.');
    }
    setAiLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this pricing suggestion?')) return;
    try {
      await del(`/api/pricing/${selectedPricing.id}`);
      setIsModalOpen(false);
      loadPricing();
    } catch (error) {
      console.error('Error deleting pricing:', error);
    }
  };

  const handleApplyPrice = async () => {
    try {
      await post(`/api/pricing/${selectedPricing.id}/apply`, {});
      loadPricing();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error applying price:', error);
    }
  };

  const handleCreatePricing = async (e) => {
    e.preventDefault();
    try {
      await post('/api/pricing', {
        ...newPricing,
        productId: parseInt(newPricing.productId),
        originalPrice: parseFloat(newPricing.originalPrice),
        suggestedPrice: parseFloat(newPricing.suggestedPrice),
        competitorPrice: parseFloat(newPricing.competitorPrice),
        demandScore: parseInt(newPricing.demandScore),
        aiConfidence: 85.0,
        status: 'pending'
      });
      setIsNewModalOpen(false);
      setNewPricing({ productId: '', originalPrice: '', suggestedPrice: '', competitorPrice: '', demandScore: 50, priceChangeReason: '' });
      loadPricing();
    } catch (error) {
      console.error('Error creating pricing:', error);
    }
  };

  const columns = [
    { header: 'Product', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg">💰</div>
        <span className="font-medium">{row.Product?.name || 'Unknown'}</span>
      </div>
    )},
    { header: 'Original', render: (row) => <span className="text-gray-600">${parseFloat(row.originalPrice).toFixed(2)}</span> },
    { header: 'Suggested', render: (row) => (
      <span className={`font-bold ${parseFloat(row.suggestedPrice) < parseFloat(row.originalPrice) ? 'text-red-600' : 'text-green-600'}`}>
        ${parseFloat(row.suggestedPrice).toFixed(2)}
      </span>
    )},
    { header: 'Competitor', render: (row) => row.competitorPrice ? `$${parseFloat(row.competitorPrice).toFixed(2)}` : '-' },
    { header: 'Demand', render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div className={`h-2 rounded-full ${row.demandScore > 70 ? 'bg-green-500' : row.demandScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${row.demandScore}%`}}></div>
        </div>
        <span className="text-sm">{row.demandScore}%</span>
      </div>
    )},
    { header: 'Confidence', render: (row) => <span className="text-sm">{parseFloat(row.aiConfidence || 0).toFixed(1)}%</span> },
    { header: 'Status', render: (row) => (
      <span className={`badge ${row.status === 'applied' ? 'badge-success' : row.status === 'approved' ? 'badge-info' : row.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
        {row.status}
      </span>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dynamic Pricing</h1>
          <p className="text-gray-500">AI-powered pricing suggestions</p>
        </div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">
          + New Price Suggestion
        </button>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-green-900 mb-1">AI Pricing Insights</h3><p className="text-green-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pricing.filter(p => p.status === 'pending').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-2xl font-bold text-blue-600">{pricing.filter(p => p.status === 'approved').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Applied</p>
          <p className="text-2xl font-bold text-green-600">{pricing.filter(p => p.status === 'applied').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{pricing.filter(p => p.status === 'rejected').length}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={pricing}
          onFilter={setFilteredPricing}
          searchFields={['Product.name', 'Product.sku', 'status', 'priceChangeReason']}
          placeholder="Search by product, SKU, status..."
        />
        <DataTable columns={columns} data={filteredPricing} onRowClick={handleRowClick} loading={loading} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Pricing Suggestion Details" size="lg">
        {selectedPricing && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">{selectedPricing.Product?.name}</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Original Price</p>
                  <p className="text-2xl font-bold text-gray-600">${parseFloat(selectedPricing.originalPrice).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">AI Suggested</p>
                  <p className={`text-2xl font-bold ${parseFloat(selectedPricing.suggestedPrice) < parseFloat(selectedPricing.originalPrice) ? 'text-red-600' : 'text-green-600'}`}>
                    ${parseFloat(selectedPricing.suggestedPrice).toFixed(2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Competitor Price</p>
                  <p className="text-2xl font-bold text-blue-600">${parseFloat(selectedPricing.competitorPrice || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">AI Reasoning</h4>
              <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{selectedPricing.priceChangeReason}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Demand Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div className={`h-3 rounded-full ${selectedPricing.demandScore > 70 ? 'bg-green-500' : selectedPricing.demandScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${selectedPricing.demandScore}%`}}></div>
                  </div>
                  <span className="font-bold">{selectedPricing.demandScore}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">AI Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div className="h-3 rounded-full bg-purple-500" style={{width: `${selectedPricing.aiConfidence}%`}}></div>
                  </div>
                  <span className="font-bold">{parseFloat(selectedPricing.aiConfidence || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Insights</h4>
                <button onClick={() => handleRowClick(selectedPricing)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
              </div>
              {aiLoading ? <p className="text-purple-600">Analyzing pricing...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>

            <div className="flex gap-3">
              {selectedPricing.status === 'pending' || selectedPricing.status === 'approved' ? (
                <button onClick={handleApplyPrice} className="btn btn-success">Apply This Price</button>
              ) : null}
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">🗑️ Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Price Suggestion">
        <form onSubmit={handleCreatePricing} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select className="input" value={newPricing.productId} onChange={(e) => setNewPricing({...newPricing, productId: e.target.value})} required>
              <option value="">Select product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Original Price</label>
              <input type="number" step="0.01" className="input" value={newPricing.originalPrice} onChange={(e) => setNewPricing({...newPricing, originalPrice: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Price</label>
              <input type="number" step="0.01" className="input" value={newPricing.suggestedPrice} onChange={(e) => setNewPricing({...newPricing, suggestedPrice: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitor Price</label>
              <input type="number" step="0.01" className="input" value={newPricing.competitorPrice} onChange={(e) => setNewPricing({...newPricing, competitorPrice: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Demand Score: {newPricing.demandScore}%</label>
            <input type="range" min="0" max="100" className="w-full" value={newPricing.demandScore} onChange={(e) => setNewPricing({...newPricing, demandScore: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Change</label>
            <textarea className="input" rows={3} value={newPricing.priceChangeReason} onChange={(e) => setNewPricing({...newPricing, priceChangeReason: e.target.value})} placeholder="Explain the pricing strategy..." />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn btn-primary">Create Suggestion</button>
            <button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
