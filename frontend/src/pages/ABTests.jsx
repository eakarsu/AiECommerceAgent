import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const ABTests = () => {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTest, setNewTest] = useState({ name: '', type: 'layout', variantA: '{}', variantB: '{}' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, post, del, loading } = useApi();
  const { showToast } = useNotifications();

  useEffect(() => { loadTests(); }, []);
  const loadTests = async () => {
    try { const data = await get('/api/ab-tests'); setTests(data); if (data.length > 0) generateAiSummary(data); } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', { type: 'abtests_summary', data: { totalTests: data.length, runningTests: data.filter(t => t.status === 'running').length, completedTests: data.filter(t => t.status === 'completed').length, variantAWins: data.filter(t => t.winner === 'A').length, variantBWins: data.filter(t => t.winner === 'B').length, avgConfidence: data.filter(t => t.confidenceLevel).reduce((sum, t) => sum + parseFloat(t.confidenceLevel || 0), 0) / data.filter(t => t.confidenceLevel).length || 0 } });
      setAiSummary(result.insight || result);
    } catch (e) { setAiSummary('AI analysis: Focus on tests with high confidence levels and implement winning variants to improve conversions.'); }
  };

  const handleRowClick = async (t) => {
    setSelectedTest(t); setIsModalOpen(true); setAiInsight(null); setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', { type: 'abtest_analysis', data: { name: t.name, type: t.type, variantAViews: t.variantAViews, variantAConversions: t.variantAConversions, variantBViews: t.variantBViews, variantBConversions: t.variantBConversions, winner: t.winner, confidenceLevel: t.confidenceLevel, status: t.status } });
      setAiInsight(result.insight || result);
    } catch (e) { setAiInsight('Analyze conversion rates and statistical significance before making decisions on this test.'); }
    setAiLoading(false);
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', { type: 'abtest_deep_analysis', data: { name: selectedTest.name, type: selectedTest.type, variantA: selectedTest.variantA, variantB: selectedTest.variantB, variantAViews: selectedTest.variantAViews, variantAConversions: selectedTest.variantAConversions, variantBViews: selectedTest.variantBViews, variantBConversions: selectedTest.variantBConversions, conversionRateA: selectedTest.variantAViews > 0 ? (selectedTest.variantAConversions / selectedTest.variantAViews * 100).toFixed(2) : 0, conversionRateB: selectedTest.variantBViews > 0 ? (selectedTest.variantBConversions / selectedTest.variantBViews * 100).toFixed(2) : 0, winner: selectedTest.winner, confidenceLevel: selectedTest.confidenceLevel, status: selectedTest.status, requestType: 'Provide a detailed statistical analysis with actionable recommendations' } });
      setAiInsight(result.insight || result);
    } catch (e) { setAiInsight('Deep analysis: Review both variants carefully. Consider sample size, statistical significance, and business impact.'); }
    setAiLoading(false);
  };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this A/B test?');
    setConfirmAction(() => async () => {
      try { await del(`/api/ab-tests/${selectedTest.id}`); setIsModalOpen(false); loadTests(); showToast('Test deleted', 'success'); }
      catch (e) { console.error(e); showToast('Failed to delete test', 'error'); }
    });
    setConfirmOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await post('/api/ab-tests', { ...newTest, variantA: JSON.parse(newTest.variantA), variantB: JSON.parse(newTest.variantB), status: 'draft' }); setIsNewModalOpen(false); loadTests(); showToast('Test created', 'success'); }
    catch (e) { console.error(e); showToast('Failed to create test', 'error'); }
  };

  const columns = [
    { header: 'Test', render: (row) => (<div className="flex items-center gap-3"><div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center text-lg">🧪</div><div><span className="font-medium block">{row.name}</span><span className="text-sm text-gray-500">{row.type}</span></div></div>) },
    { header: 'Variant A', render: (row) => <div className="text-sm"><p>{row.variantAViews?.toLocaleString()} views</p><p className="text-green-600">{row.variantAConversions?.toLocaleString()} conv</p></div> },
    { header: 'Variant B', render: (row) => <div className="text-sm"><p>{row.variantBViews?.toLocaleString()} views</p><p className="text-green-600">{row.variantBConversions?.toLocaleString()} conv</p></div> },
    { header: 'Winner', render: (row) => row.winner ? <span className={`badge ${row.winner === 'A' ? 'badge-info' : row.winner === 'B' ? 'badge-success' : 'badge-gray'}`}>Variant {row.winner}</span> : <span className="text-gray-400">-</span> },
    { header: 'Confidence', render: (row) => row.confidenceLevel ? <span className={`font-bold ${row.confidenceLevel > 95 ? 'text-green-600' : row.confidenceLevel > 90 ? 'text-yellow-600' : 'text-gray-600'}`}>{parseFloat(row.confidenceLevel).toFixed(1)}%</span> : '-' },
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'running' ? 'badge-success' : row.status === 'completed' ? 'badge-info' : row.status === 'paused' ? 'badge-warning' : 'badge-gray'}`}>{row.status}</span> }
  ];

  const getConversionRate = (conv, views) => views > 0 ? ((conv / views) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">A/B Testing</h1><p className="text-gray-500">Experiment and optimize</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ New Test</button>
      </div>

      {aiSummary && (<div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-4"><div className="flex items-start gap-3"><span className="text-2xl">✨</span><div><h3 className="font-medium text-violet-900 mb-1">AI A/B Testing Insights</h3><p className="text-violet-800 text-sm">{aiSummary}</p></div></div></div>)}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Tests</p><p className="text-2xl font-bold">{tests.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Running</p><p className="text-2xl font-bold text-green-600">{tests.filter(t => t.status === 'running').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-blue-600">{tests.filter(t => t.status === 'completed').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">B Wins</p><p className="text-2xl font-bold">{tests.filter(t => t.winner === 'B').length}</p></div>
      </div>

      <div className="card"><DataTable columns={columns} data={tests} onRowClick={handleRowClick} loading={loading} emptyIcon="🧪" emptyTitle="No tests found" emptyDescription="Create a new A/B test to get started." /></div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="A/B Test Details" size="lg">
        {selectedTest && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div><h3 className="text-xl font-bold">{selectedTest.name}</h3><span className="badge badge-gray">{selectedTest.type}</span></div>
              <span className={`badge ${selectedTest.status === 'running' ? 'badge-success' : selectedTest.status === 'completed' ? 'badge-info' : 'badge-warning'}`}>{selectedTest.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className={`border-2 rounded-lg p-4 ${selectedTest.winner === 'A' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3"><h4 className="font-bold">Variant A</h4>{selectedTest.winner === 'A' && <span className="badge badge-success">Winner</span>}</div>
                <div className="space-y-2 text-sm"><p>Views: <span className="font-bold">{selectedTest.variantAViews?.toLocaleString()}</span></p><p>Conversions: <span className="font-bold text-green-600">{selectedTest.variantAConversions?.toLocaleString()}</span></p><p>Conv. Rate: <span className="font-bold">{getConversionRate(selectedTest.variantAConversions, selectedTest.variantAViews)}%</span></p></div>
                <div className="mt-3 p-2 bg-white rounded text-xs font-mono overflow-x-auto">{JSON.stringify(selectedTest.variantA, null, 2)}</div>
              </div>
              <div className={`border-2 rounded-lg p-4 ${selectedTest.winner === 'B' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3"><h4 className="font-bold">Variant B</h4>{selectedTest.winner === 'B' && <span className="badge badge-success">Winner</span>}</div>
                <div className="space-y-2 text-sm"><p>Views: <span className="font-bold">{selectedTest.variantBViews?.toLocaleString()}</span></p><p>Conversions: <span className="font-bold text-green-600">{selectedTest.variantBConversions?.toLocaleString()}</span></p><p>Conv. Rate: <span className="font-bold">{getConversionRate(selectedTest.variantBConversions, selectedTest.variantBViews)}%</span></p></div>
                <div className="mt-3 p-2 bg-white rounded text-xs font-mono overflow-x-auto">{JSON.stringify(selectedTest.variantB, null, 2)}</div>
              </div>
            </div>
            {selectedTest.confidenceLevel && <div><p className="text-sm text-gray-500">Statistical Confidence</p><div className="flex items-center gap-3"><div className="flex-1 bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${selectedTest.confidenceLevel > 95 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{width: `${selectedTest.confidenceLevel}%`}}></div></div><span className="font-bold">{parseFloat(selectedTest.confidenceLevel).toFixed(1)}%</span></div></div>}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2"><h4 className="font-medium text-purple-900">✨ AI Insights</h4><button onClick={() => handleRowClick(selectedTest)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button></div>
              {aiLoading ? <p className="text-purple-600">Analyzing test...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3"><button onClick={handleAiAnalyze} className="btn btn-ai">✨ Deep AI Analysis</button><button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button><button onClick={handleDelete} className="btn btn-danger">Delete</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New A/B Test">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Test Name</label><input type="text" className="input" value={newTest.name} onChange={(e) => setNewTest({...newTest, name: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium mb-1">Type</label><select className="input" value={newTest.type} onChange={(e) => setNewTest({...newTest, type: e.target.value})}><option value="layout">Layout</option><option value="pricing">Pricing</option><option value="content">Content</option><option value="ad_copy">Ad Copy</option><option value="email">Email</option></select></div>
          <div><label className="block text-sm font-medium mb-1">Variant A (JSON)</label><textarea className="input font-mono text-sm" rows={3} value={newTest.variantA} onChange={(e) => setNewTest({...newTest, variantA: e.target.value})} placeholder='{"key": "value"}' /></div>
          <div><label className="block text-sm font-medium mb-1">Variant B (JSON)</label><textarea className="input font-mono text-sm" rows={3} value={newTest.variantB} onChange={(e) => setNewTest({...newTest, variantB: e.target.value})} placeholder='{"key": "value"}' /></div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Create Test</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
