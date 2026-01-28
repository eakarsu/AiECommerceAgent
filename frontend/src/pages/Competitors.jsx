import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';

export const Competitors = () => {
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: '', website: '', category: '', priceRange: 'Mid-range' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { get, post, del, loading } = useApi();

  useEffect(() => { loadCompetitors(); }, []);
  const loadCompetitors = async () => {
    try {
      const data = await get('/api/competitors');
      setCompetitors(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'competitors_summary',
        data: {
          totalCompetitors: data.length,
          activeThreats: data.filter(c => c.status === 'active').length,
          avgStrength: Math.round(data.reduce((sum, c) => sum + (c.strengthScore || 0), 0) / data.length),
          totalMarketShare: data.reduce((sum, c) => sum + parseFloat(c.marketShare || 0), 0),
          categories: [...new Set(data.map(c => c.category))]
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Monitor competitor pricing strategies and capitalize on their weaknesses in your marketing.');
    }
  };

  const handleRowClick = async (c) => {
    setSelectedCompetitor(c);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'competitor_analysis',
        data: {
          name: c.name,
          category: c.category,
          marketShare: c.marketShare,
          strengthScore: c.strengthScore,
          priceRange: c.priceRange,
          products: c.products,
          avgRating: c.avgRating,
          strengths: c.strengths,
          weaknesses: c.weaknesses
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Analyze their weaknesses to identify market opportunities and differentiation strategies.');
    }
    setAiLoading(false);
  };
  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'competitor_deep_analysis',
        data: {
          name: selectedCompetitor.name,
          category: selectedCompetitor.category,
          website: selectedCompetitor.website,
          marketShare: selectedCompetitor.marketShare,
          strengthScore: selectedCompetitor.strengthScore,
          priceRange: selectedCompetitor.priceRange,
          products: selectedCompetitor.products,
          avgRating: selectedCompetitor.avgRating,
          strengths: selectedCompetitor.strengths,
          weaknesses: selectedCompetitor.weaknesses,
          requestType: 'Provide detailed competitive analysis with strategic recommendations to outperform this competitor'
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Deep analysis: Study their pricing strategy, identify gaps in their product offerings, and develop unique value propositions to differentiate your brand.');
    }
    setAiLoading(false);
  };
  const handleDelete = async () => { if (!window.confirm('Are you sure you want to delete this competitor?')) return; try { await del(`/api/competitors/${selectedCompetitor.id}`); setIsModalOpen(false); loadCompetitors(); } catch (e) { console.error(e); } };
  const handleCreate = async (e) => { e.preventDefault(); try { await post('/api/competitors', newCompetitor); setIsNewModalOpen(false); setNewCompetitor({ name: '', website: '', category: '', priceRange: 'Mid-range' }); loadCompetitors(); } catch (e) { console.error(e); } };

  const columns = [
    { header: 'Competitor', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-lg">🏢</div>
        <div><span className="font-medium block">{row.name}</span><span className="text-sm text-gray-500">{row.category}</span></div>
      </div>
    )},
    { header: 'Market Share', render: (row) => <span className="font-bold">{row.marketShare}%</span> },
    { header: 'Price Range', render: (row) => <span className="badge badge-gray">{row.priceRange}</span> },
    { header: 'Strength', render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-12 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${row.strengthScore > 70 ? 'bg-red-500' : row.strengthScore > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${row.strengthScore}%`}}></div></div>
        <span className="text-sm">{row.strengthScore}</span>
      </div>
    )},
    { header: 'Products', render: (row) => row.products?.toLocaleString() },
    { header: 'Rating', render: (row) => <span>⭐ {parseFloat(row.avgRating || 0).toFixed(1)}</span> },
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-danger' : 'badge-info'}`}>{row.status}</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Competitor Analysis</h1><p className="text-gray-500">Monitor and analyze competitors</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ Add Competitor</button>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-red-900 mb-1">AI Competitive Insights</h3><p className="text-red-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Competitors</p><p className="text-2xl font-bold">{competitors.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Active Threats</p><p className="text-2xl font-bold text-red-600">{competitors.filter(c => c.status === 'active').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Avg Strength</p><p className="text-2xl font-bold">{Math.round(competitors.reduce((sum, c) => sum + (c.strengthScore || 0), 0) / competitors.length || 0)}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Market Share</p><p className="text-2xl font-bold">{competitors.reduce((sum, c) => sum + parseFloat(c.marketShare || 0), 0).toFixed(1)}%</p></div>
      </div>

      <div className="card"><DataTable columns={columns} data={competitors} onRowClick={handleRowClick} loading={loading} /></div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Competitor Details" size="lg">
        {selectedCompetitor && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div><h3 className="text-xl font-bold">{selectedCompetitor.name}</h3><p className="text-gray-500">{selectedCompetitor.category}</p>{selectedCompetitor.website && <a href={selectedCompetitor.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm">{selectedCompetitor.website}</a>}</div>
              <div className="text-right"><p className="text-sm text-gray-500">Market Share</p><p className="text-3xl font-bold">{selectedCompetitor.marketShare}%</p></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Strength</p><p className="text-2xl font-bold">{selectedCompetitor.strengthScore}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Products</p><p className="text-2xl font-bold">{selectedCompetitor.products?.toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Rating</p><p className="text-2xl font-bold">⭐ {selectedCompetitor.avgRating}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Price Range</p><p className="font-bold">{selectedCompetitor.priceRange}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedCompetitor.strengths?.length > 0 && <div><h4 className="font-medium mb-2 text-red-600">Strengths (Threats)</h4><div className="flex gap-2 flex-wrap">{selectedCompetitor.strengths.map((s, i) => <span key={i} className="badge badge-danger">{s}</span>)}</div></div>}
              {selectedCompetitor.weaknesses?.length > 0 && <div><h4 className="font-medium mb-2 text-green-600">Weaknesses (Opportunities)</h4><div className="flex gap-2 flex-wrap">{selectedCompetitor.weaknesses.map((w, i) => <span key={i} className="badge badge-success">{w}</span>)}</div></div>}
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Analysis</h4>
                <button onClick={() => handleRowClick(selectedCompetitor)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
              </div>
              {aiLoading ? <p className="text-purple-600">Analyzing competitor...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3"><button onClick={handleAiAnalyze} className="btn btn-ai">✨ Deep AI Analysis</button><button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button><button onClick={handleDelete} className="btn btn-danger">🗑️ Delete</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Add Competitor">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Name</label><input type="text" className="input" value={newCompetitor.name} onChange={(e) => setNewCompetitor({...newCompetitor, name: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium mb-1">Website</label><input type="url" className="input" value={newCompetitor.website} onChange={(e) => setNewCompetitor({...newCompetitor, website: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Category</label><input type="text" className="input" value={newCompetitor.category} onChange={(e) => setNewCompetitor({...newCompetitor, category: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium mb-1">Price Range</label><select className="input" value={newCompetitor.priceRange} onChange={(e) => setNewCompetitor({...newCompetitor, priceRange: e.target.value})}><option value="Budget">Budget</option><option value="Mid-range">Mid-range</option><option value="Premium">Premium</option><option value="Luxury">Luxury</option></select></div>
          </div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Add Competitor</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>
    </div>
  );
};
