import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Forecasts = () => {
  const [forecasts, setForecasts] = useState([]);
  const [selectedForecast, setSelectedForecast] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newForecast, setNewForecast] = useState({ category: '', forecastDate: '', predictedSales: '', predictedRevenue: '' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, post, del, loading } = useApi();
  const { showToast } = useNotifications();

  useEffect(() => { loadForecasts(); }, []);
  const loadForecasts = async () => {
    try { const data = await get('/api/forecasts'); setForecasts(data); if (data.length > 0) generateAiSummary(data); } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', { type: 'forecasts_summary', data: { totalForecasts: data.length, totalPredictedSales: data.reduce((sum, f) => sum + (f.predictedSales || 0), 0), totalPredictedRevenue: data.reduce((sum, f) => sum + parseFloat(f.predictedRevenue || 0), 0), avgAccuracy: data.filter(f => f.accuracy).reduce((sum, f) => sum + parseFloat(f.accuracy), 0) / data.filter(f => f.accuracy).length || 0, categories: [...new Set(data.map(f => f.category))] } });
      setAiSummary(result.insight || result);
    } catch (e) { setAiSummary('AI analysis: Review forecast accuracy trends and adjust prediction models for better inventory planning.'); }
  };

  const handleRowClick = async (f) => {
    setSelectedForecast(f); setIsModalOpen(true); setAiInsight(null); setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', { type: 'forecast_analysis', data: { category: f.category, forecastDate: f.forecastDate, predictedSales: f.predictedSales, predictedRevenue: f.predictedRevenue, actualSales: f.actualSales, accuracy: f.accuracy, confidenceInterval: f.confidenceInterval } });
      setAiInsight(result.insight || result);
    } catch (e) { setAiInsight('Consider seasonal factors and market conditions when planning inventory based on this forecast.'); }
    setAiLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await post('/api/forecasts', { ...newForecast, predictedSales: parseInt(newForecast.predictedSales), predictedRevenue: parseFloat(newForecast.predictedRevenue) }); setIsNewModalOpen(false); loadForecasts(); showToast('Forecast created', 'success'); }
    catch (e) { console.error(e); showToast('Failed to create forecast', 'error'); }
  };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this forecast?');
    setConfirmAction(() => async () => {
      try { await del(`/api/forecasts/${selectedForecast.id}`); setIsModalOpen(false); loadForecasts(); showToast('Forecast deleted', 'success'); }
      catch (e) { console.error(e); showToast('Failed to delete forecast', 'error'); }
    });
    setConfirmOpen(true);
  };

  const columns = [
    { header: 'Forecast', render: (row) => (<div className="flex items-center gap-3"><div className="w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center text-lg">🔮</div><div><span className="font-medium block">{row.Product?.name || row.category || 'Category Forecast'}</span><span className="text-sm text-gray-500">{row.category}</span></div></div>) },
    { header: 'Date', render: (row) => new Date(row.forecastDate).toLocaleDateString() },
    { header: 'Predicted Sales', render: (row) => <span className="font-bold">{row.predictedSales?.toLocaleString()}</span> },
    { header: 'Predicted Revenue', render: (row) => <span className="font-bold text-green-600">${row.predictedRevenue?.toLocaleString()}</span> },
    { header: 'Actual', render: (row) => row.actualSales ? <span>{row.actualSales?.toLocaleString()}</span> : <span className="text-gray-400">-</span> },
    { header: 'Accuracy', render: (row) => row.accuracy ? <span className={`font-bold ${row.accuracy > 95 ? 'text-green-600' : row.accuracy > 90 ? 'text-yellow-600' : 'text-red-600'}`}>{parseFloat(row.accuracy).toFixed(1)}%</span> : <span className="text-gray-400">Pending</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Sales Forecasting</h1><p className="text-gray-500">AI-powered sales predictions</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ New Forecast</button>
      </div>

      {aiSummary && (<div className="bg-gradient-to-r from-fuchsia-50 to-purple-50 border border-fuchsia-200 rounded-lg p-4"><div className="flex items-start gap-3"><span className="text-2xl">✨</span><div><h3 className="font-medium text-fuchsia-900 mb-1">AI Forecast Insights</h3><p className="text-fuchsia-800 text-sm">{aiSummary}</p></div></div></div>)}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Forecasts</p><p className="text-2xl font-bold">{forecasts.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Predicted Sales</p><p className="text-2xl font-bold">{forecasts.reduce((sum, f) => sum + (f.predictedSales || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Predicted Revenue</p><p className="text-2xl font-bold text-green-600">${forecasts.reduce((sum, f) => sum + parseFloat(f.predictedRevenue || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Avg Accuracy</p><p className="text-2xl font-bold">{(forecasts.filter(f => f.accuracy).reduce((sum, f) => sum + parseFloat(f.accuracy), 0) / forecasts.filter(f => f.accuracy).length || 0).toFixed(1)}%</p></div>
      </div>

      <div className="card"><DataTable columns={columns} data={forecasts} onRowClick={handleRowClick} loading={loading} emptyIcon="🔮" emptyTitle="No forecasts found" emptyDescription="Create a new forecast to get started." /></div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Forecast Details" size="lg">
        {selectedForecast && (
          <div className="space-y-6">
            <div><h3 className="text-xl font-bold">{selectedForecast.Product?.name || selectedForecast.category}</h3><p className="text-gray-500">Forecast for {new Date(selectedForecast.forecastDate).toLocaleDateString()}</p></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center"><p className="text-sm text-blue-600 mb-2">Predicted</p><p className="text-3xl font-bold text-blue-700">{selectedForecast.predictedSales?.toLocaleString()}</p><p className="text-lg text-blue-600">${selectedForecast.predictedRevenue?.toLocaleString()}</p></div>
              <div className={`border rounded-lg p-6 text-center ${selectedForecast.actualSales ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-sm text-gray-600 mb-2">Actual</p>
                {selectedForecast.actualSales ? (<><p className="text-3xl font-bold text-green-700">{selectedForecast.actualSales?.toLocaleString()}</p><p className="text-lg text-green-600">${selectedForecast.actualRevenue?.toLocaleString()}</p></>) : <p className="text-2xl text-gray-400">Pending</p>}
              </div>
            </div>
            {selectedForecast.accuracy && (<div><p className="text-sm text-gray-500 mb-2">Forecast Accuracy</p><div className="flex items-center gap-3"><div className="flex-1 bg-gray-200 rounded-full h-4"><div className={`h-4 rounded-full ${selectedForecast.accuracy > 95 ? 'bg-green-500' : selectedForecast.accuracy > 90 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${selectedForecast.accuracy}%`}}></div></div><span className="text-xl font-bold">{parseFloat(selectedForecast.accuracy).toFixed(1)}%</span></div></div>)}
            {selectedForecast.confidenceInterval && (<div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500 mb-2">Confidence Interval</p><p className="font-medium">Low: {selectedForecast.confidenceInterval.low?.toLocaleString()} - High: {selectedForecast.confidenceInterval.high?.toLocaleString()}</p></div>)}
            {selectedForecast.factors?.length > 0 && <div><h4 className="font-medium mb-2">Contributing Factors</h4><div className="flex gap-2 flex-wrap">{selectedForecast.factors.map((f, i) => <span key={i} className="badge badge-info">{f}</span>)}</div></div>}
            {selectedForecast.notes && <div><h4 className="font-medium mb-2">Notes</h4><p className="text-gray-600">{selectedForecast.notes}</p></div>}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2"><h4 className="font-medium text-purple-900">✨ AI Insights</h4><button onClick={() => handleRowClick(selectedForecast)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button></div>
              {aiLoading ? <p className="text-purple-600">Analyzing forecast...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3"><button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button><button onClick={handleDelete} className="btn btn-danger">Delete</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Forecast">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Category</label><input type="text" className="input" value={newForecast.category} onChange={(e) => setNewForecast({...newForecast, category: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium mb-1">Forecast Date</label><input type="date" className="input" value={newForecast.forecastDate} onChange={(e) => setNewForecast({...newForecast, forecastDate: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Predicted Sales</label><input type="number" className="input" value={newForecast.predictedSales} onChange={(e) => setNewForecast({...newForecast, predictedSales: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium mb-1">Predicted Revenue</label><input type="number" step="0.01" className="input" value={newForecast.predictedRevenue} onChange={(e) => setNewForecast({...newForecast, predictedRevenue: e.target.value})} required /></div>
          </div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Create Forecast</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
