import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Segments = () => {
  const [segments, setSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newSegment, setNewSegment] = useState({ name: '', description: '', criteria: '{}' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, post, del, loading } = useApi();
  const { showToast } = useNotifications();

  useEffect(() => { loadSegments(); }, []);
  const loadSegments = async () => {
    try { const data = await get('/api/segments'); setSegments(data); if (data.length > 0) generateAiSummary(data); } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', { type: 'segments_summary', data: { totalSegments: data.length, totalCustomers: data.reduce((sum, s) => sum + (s.customerCount || 0), 0), totalRevenue: data.reduce((sum, s) => sum + parseFloat(s.totalRevenue || 0), 0), avgChurn: data.reduce((sum, s) => sum + parseFloat(s.churnRate || 0), 0) / data.length, activeSegments: data.filter(s => s.status === 'active').length } });
      setAiSummary(result.insight || result);
    } catch (e) { setAiSummary('AI analysis: Focus retention efforts on high-value segments with elevated churn risk for maximum impact.'); }
  };

  const handleRowClick = async (s) => {
    setSelectedSegment(s); setIsModalOpen(true); setAiInsight(null); setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', { type: 'segment_analysis', data: { name: s.name, customerCount: s.customerCount, averageValue: s.averageValue, totalRevenue: s.totalRevenue, growthRate: s.growthRate, churnRate: s.churnRate, status: s.status } });
      setAiInsight(result.insight || result);
    } catch (e) { setAiInsight('Consider personalized engagement strategies for this segment to reduce churn and increase lifetime value.'); }
    setAiLoading(false);
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', { type: 'segment_deep_analysis', data: { name: selectedSegment.name, description: selectedSegment.description, customerCount: selectedSegment.customerCount, averageValue: selectedSegment.averageValue, totalRevenue: selectedSegment.totalRevenue, growthRate: selectedSegment.growthRate, churnRate: selectedSegment.churnRate, status: selectedSegment.status, requestType: 'Provide detailed segment analysis with personalized marketing strategies and retention recommendations' } });
      setAiInsight(result.insight || result);
    } catch (e) { setAiInsight('Deep analysis: Focus on personalized engagement, loyalty programs, and targeted campaigns to maximize this segment\'s lifetime value.'); }
    setAiLoading(false);
  };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this segment?');
    setConfirmAction(() => async () => {
      try { await del(`/api/segments/${selectedSegment.id}`); setIsModalOpen(false); loadSegments(); showToast('Segment deleted', 'success'); }
      catch (e) { console.error(e); showToast('Failed to delete segment', 'error'); }
    });
    setConfirmOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await post('/api/segments', { ...newSegment, criteria: JSON.parse(newSegment.criteria) }); setIsNewModalOpen(false); loadSegments(); showToast('Segment created', 'success'); }
    catch (e) { console.error(e); showToast('Failed to create segment', 'error'); }
  };

  const columns = [
    { header: 'Segment', render: (row) => (<div className="flex items-center gap-3"><div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center text-lg">🎯</div><div><span className="font-medium block">{row.name}</span><span className="text-sm text-gray-500">{row.customerCount?.toLocaleString()} customers</span></div></div>) },
    { header: 'Customers', render: (row) => <span className="font-bold">{row.customerCount?.toLocaleString()}</span> },
    { header: 'Avg Value', render: (row) => <span>${parseFloat(row.averageValue).toLocaleString()}</span> },
    { header: 'Total Revenue', render: (row) => <span className="font-bold text-green-600">${parseFloat(row.totalRevenue).toLocaleString()}</span> },
    { header: 'Growth', render: (row) => <span className={`font-bold ${row.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}>{row.growthRate > 0 ? '+' : ''}{parseFloat(row.growthRate || 0).toFixed(1)}%</span> },
    { header: 'Churn', render: (row) => <span className={row.churnRate > 20 ? 'text-red-600 font-bold' : ''}>{parseFloat(row.churnRate || 0).toFixed(1)}%</span> },
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{row.status}</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Customer Segments</h1><p className="text-gray-500">AI-powered customer segmentation</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ New Segment</button>
      </div>

      {aiSummary && (<div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-lg p-4"><div className="flex items-start gap-3"><span className="text-2xl">✨</span><div><h3 className="font-medium text-rose-900 mb-1">AI Segment Insights</h3><p className="text-rose-800 text-sm">{aiSummary}</p></div></div></div>)}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Segments</p><p className="text-2xl font-bold">{segments.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Customers</p><p className="text-2xl font-bold">{segments.reduce((sum, s) => sum + (s.customerCount || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-green-600">${segments.reduce((sum, s) => sum + parseFloat(s.totalRevenue || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Avg Churn</p><p className="text-2xl font-bold">{(segments.reduce((sum, s) => sum + parseFloat(s.churnRate || 0), 0) / segments.length || 0).toFixed(1)}%</p></div>
      </div>

      <div className="card"><DataTable columns={columns} data={segments} onRowClick={handleRowClick} loading={loading} emptyIcon="🎯" emptyTitle="No segments found" emptyDescription="Create a new segment to get started." /></div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Segment Details" size="lg">
        {selectedSegment && (
          <div className="space-y-6">
            <div><h3 className="text-xl font-bold">{selectedSegment.name}</h3><p className="text-gray-500">{selectedSegment.description}</p></div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Customers</p><p className="text-2xl font-bold">{selectedSegment.customerCount?.toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Avg Value</p><p className="text-2xl font-bold">${parseFloat(selectedSegment.averageValue).toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-green-600">${parseFloat(selectedSegment.totalRevenue).toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Growth Rate</p><p className={`text-2xl font-bold ${selectedSegment.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}>{selectedSegment.growthRate > 0 ? '+' : ''}{selectedSegment.growthRate}%</p></div>
            </div>
            <div><p className="text-sm text-gray-500 mb-2">Churn Rate</p>
              <div className="flex items-center gap-3"><div className="flex-1 bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${selectedSegment.churnRate > 20 ? 'bg-red-500' : selectedSegment.churnRate > 10 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${Math.min(selectedSegment.churnRate * 2, 100)}%`}}></div></div><span className="font-bold">{parseFloat(selectedSegment.churnRate || 0).toFixed(1)}%</span></div>
            </div>
            {selectedSegment.recommendedActions?.length > 0 && <div><h4 className="font-medium mb-2">Recommended Actions</h4><ul className="list-disc list-inside space-y-1">{selectedSegment.recommendedActions.map((a, i) => <li key={i} className="text-gray-600">{a}</li>)}</ul></div>}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2"><h4 className="font-medium text-purple-900">✨ AI Insights</h4><button onClick={() => handleRowClick(selectedSegment)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button></div>
              {aiLoading ? <p className="text-purple-600">Analyzing segment...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3"><button onClick={handleAiAnalyze} className="btn btn-ai">✨ Deep AI Analysis</button><button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button><button onClick={handleDelete} className="btn btn-danger">Delete</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Segment">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Name</label><input type="text" className="input" value={newSegment.name} onChange={(e) => setNewSegment({...newSegment, name: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium mb-1">Description</label><textarea className="input" rows={2} value={newSegment.description} onChange={(e) => setNewSegment({...newSegment, description: e.target.value})} /></div>
          <div><label className="block text-sm font-medium mb-1">Criteria (JSON)</label><textarea className="input font-mono text-sm" rows={3} value={newSegment.criteria} onChange={(e) => setNewSegment({...newSegment, criteria: e.target.value})} placeholder='{"minLTV": 1000}' /></div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Create Segment</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
