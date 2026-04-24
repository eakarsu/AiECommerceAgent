import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdvancedSearch } from '../components/AdvancedSearch';

export const Trends = () => {
  const {
    data: trends, total, page, setPage, filters, handleFilterChange, clearFilters,
    loading: pLoading, totalPages, limit, reload
  } = usePaginatedApi('/api/trends', { defaultLimit: 10 });

  const [selectedTrend, setSelectedTrend] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTrend, setNewTrend] = useState({ category: '', trendName: '', description: '', growthRate: '', competitionLevel: 'medium', opportunity: 'medium' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, post, del, loading } = useApi();
  const { showToast } = useNotifications();

  const advancedSearchFilters = [
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'rising', label: 'Rising' }, { value: 'stable', label: 'Stable' }, { value: 'declining', label: 'Declining' }
    ]},
    { key: 'competitionLevel', label: 'Competition', type: 'select', options: [
      { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }
    ]},
    { key: 'category', label: 'Category', type: 'text' }
  ];

  useEffect(() => {
    if (trends && trends.length > 0) generateAiSummary(trends);
  }, [trends]);

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'trends_summary',
        data: {
          totalTrends: total || data.length,
          risingTrends: data.filter(t => t.status === 'rising').length,
          highOpportunity: data.filter(t => t.opportunity === 'high').length,
          avgGrowth: data.reduce((sum, t) => sum + parseFloat(t.growthRate || 0), 0) / data.length,
          categories: [...new Set(data.map(t => t.category))]
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Focus on rising trends with high opportunity and low competition for maximum market impact.');
    }
  };

  const handleRowClick = async (t) => {
    setSelectedTrend(t);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'trend_analysis',
        data: {
          trendName: t.trendName, category: t.category, growthRate: t.growthRate, searchVolume: t.searchVolume,
          competitionLevel: t.competitionLevel, opportunity: t.opportunity, status: t.status
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Consider capitalizing on this trend by aligning product offerings and marketing strategies.');
    }
    setAiLoading(false);
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'trend_deep_analysis',
        data: {
          trendName: selectedTrend.trendName, category: selectedTrend.category, description: selectedTrend.description,
          growthRate: selectedTrend.growthRate, searchVolume: selectedTrend.searchVolume,
          competitionLevel: selectedTrend.competitionLevel, opportunity: selectedTrend.opportunity,
          status: selectedTrend.status, relatedKeywords: selectedTrend.relatedKeywords,
          requestType: 'Provide detailed trend analysis with market entry strategies and product recommendations'
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Deep analysis: Evaluate product-market fit, timing for entry, and develop differentiated offerings to capitalize on this trend.');
    }
    setAiLoading(false);
  };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this trend?');
    setConfirmAction(() => async () => {
      try {
        await del(`/api/trends/${selectedTrend.id}`);
        setIsModalOpen(false);
        reload();
        showToast('Trend deleted successfully', 'success');
      } catch (e) {
        console.error(e);
        showToast('Failed to delete trend', 'error');
      }
    });
    setConfirmOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await post('/api/trends', { ...newTrend, growthRate: parseFloat(newTrend.growthRate) });
      setIsNewModalOpen(false);
      reload();
      showToast('Trend added successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to add trend', 'error');
    }
  };

  const columns = [
    { header: 'Trend', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center text-lg">📈</div>
        <div><span className="font-medium block">{row.trendName}</span><span className="text-sm text-gray-500">{row.category}</span></div>
      </div>
    )},
    { header: 'Growth', render: (row) => <span className={`font-bold ${row.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}>{row.growthRate > 0 ? '+' : ''}{parseFloat(row.growthRate || 0).toFixed(1)}%</span> },
    { header: 'Search Volume', render: (row) => row.searchVolume?.toLocaleString() },
    { header: 'Competition', render: (row) => <span className={`badge ${row.competitionLevel === 'low' ? 'badge-success' : row.competitionLevel === 'high' ? 'badge-danger' : 'badge-warning'}`}>{row.competitionLevel}</span> },
    { header: 'Opportunity', render: (row) => <span className={`badge ${row.opportunity === 'high' ? 'badge-success' : row.opportunity === 'low' ? 'badge-danger' : 'badge-warning'}`}>{row.opportunity}</span> },
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'rising' ? 'badge-success' : row.status === 'declining' ? 'badge-danger' : 'badge-info'}`}>{row.status}</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Market Trends</h1><p className="text-gray-500">Track industry trends and opportunities</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ Add Trend</button>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-cyan-900 mb-1">AI Trend Insights</h3><p className="text-cyan-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Rising Trends</p><p className="text-2xl font-bold text-green-600">{trends.filter(t => t.status === 'rising').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">High Opportunity</p><p className="text-2xl font-bold text-blue-600">{trends.filter(t => t.opportunity === 'high').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Avg Growth</p><p className="text-2xl font-bold">{(trends.reduce((sum, t) => sum + parseFloat(t.growthRate || 0), 0) / trends.length || 0).toFixed(1)}%</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Categories</p><p className="text-2xl font-bold">{new Set(trends.map(t => t.category)).size}</p></div>
      </div>

      <div className="card space-y-4">
        <AdvancedSearch filters={advancedSearchFilters} values={filters} onChange={handleFilterChange} onClear={clearFilters} />
        <DataTable columns={columns} data={trends} onRowClick={handleRowClick} loading={pLoading} emptyIcon="📈" emptyTitle="No trends found" emptyDescription="Add a new trend to start tracking." />
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} noun="trends" />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Trend Details" size="lg">
        {selectedTrend && (
          <div className="space-y-6">
            <div><h3 className="text-xl font-bold">{selectedTrend.trendName}</h3><p className="text-gray-500">{selectedTrend.category}</p></div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Growth Rate</p><p className={`text-2xl font-bold ${selectedTrend.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}>{selectedTrend.growthRate > 0 ? '+' : ''}{selectedTrend.growthRate}%</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Search Volume</p><p className="text-2xl font-bold">{selectedTrend.searchVolume?.toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Competition</p><span className={`badge ${selectedTrend.competitionLevel === 'low' ? 'badge-success' : 'badge-warning'}`}>{selectedTrend.competitionLevel}</span></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Opportunity</p><span className={`badge ${selectedTrend.opportunity === 'high' ? 'badge-success' : 'badge-warning'}`}>{selectedTrend.opportunity}</span></div>
            </div>
            <div><h4 className="font-medium mb-2">Description</h4><p className="text-gray-600">{selectedTrend.description}</p></div>
            {selectedTrend.relatedKeywords?.length > 0 && <div><h4 className="font-medium mb-2">Related Keywords</h4><div className="flex gap-2 flex-wrap">{selectedTrend.relatedKeywords.map((k, i) => <span key={i} className="badge badge-info">{k}</span>)}</div></div>}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Insights</h4>
                <button onClick={() => handleRowClick(selectedTrend)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
              </div>
              {aiLoading ? <p className="text-purple-600">Analyzing trend...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3"><button onClick={handleAiAnalyze} className="btn btn-ai">✨ Deep AI Analysis</button><button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button><button onClick={handleDelete} className="btn btn-danger">Delete</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Add Trend">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Category</label><input type="text" className="input" value={newTrend.category} onChange={(e) => setNewTrend({...newTrend, category: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium mb-1">Trend Name</label><input type="text" className="input" value={newTrend.trendName} onChange={(e) => setNewTrend({...newTrend, trendName: e.target.value})} required /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Description</label><textarea className="input" rows={3} value={newTrend.description} onChange={(e) => setNewTrend({...newTrend, description: e.target.value})} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Growth Rate %</label><input type="number" step="0.1" className="input" value={newTrend.growthRate} onChange={(e) => setNewTrend({...newTrend, growthRate: e.target.value})} /></div>
            <div><label className="block text-sm font-medium mb-1">Competition</label><select className="input" value={newTrend.competitionLevel} onChange={(e) => setNewTrend({...newTrend, competitionLevel: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Opportunity</label><select className="input" value={newTrend.opportunity} onChange={(e) => setNewTrend({...newTrend, opportunity: e.target.value})}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          </div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Add Trend</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
