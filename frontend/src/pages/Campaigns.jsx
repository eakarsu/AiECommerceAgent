import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '', platform: 'google', budget: '', targetAudience: '', status: 'draft'
  });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { get, post, del, loading } = useApi();

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const data = await get('/api/campaigns');
      setCampaigns(data);
      setFilteredCampaigns(data);
      if (data.length > 0) generateAiSummary(data);
    }
    catch (error) { console.error('Error:', error); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'campaigns_summary',
        data: {
          totalCampaigns: data.length,
          activeCampaigns: data.filter(c => c.status === 'active').length,
          totalSpent: data.reduce((sum, c) => sum + parseFloat(c.spent || 0), 0),
          totalBudget: data.reduce((sum, c) => sum + parseFloat(c.budget || 0), 0),
          avgROAS: data.reduce((sum, c) => sum + parseFloat(c.roas || 0), 0) / data.length,
          platforms: [...new Set(data.map(c => c.platform))]
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Focus on high-ROAS campaigns and consider pausing underperformers to optimize ad spend.');
    }
  };

  const handleRowClick = async (campaign) => {
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'campaign_analysis',
        data: {
          name: campaign.name,
          platform: campaign.platform,
          budget: campaign.budget,
          spent: campaign.spent,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          ctr: campaign.ctr,
          roas: campaign.roas,
          status: campaign.status
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Consider A/B testing ad creatives and adjusting targeting to improve campaign performance.');
    }
    setAiLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await del(`/api/campaigns/${selectedCampaign.id}`);
      setIsModalOpen(false);
      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
  };

  const handleAiGenerate = async () => {
    try {
      const result = await post(`/api/campaigns/${selectedCampaign.id}/ai-generate-copy`, {});
      setSelectedCampaign(result.campaign);
      loadCampaigns();
    } catch (error) { console.error('Error:', error); }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      await post('/api/campaigns', { ...newCampaign, budget: parseFloat(newCampaign.budget) });
      setIsNewModalOpen(false);
      setNewCampaign({ name: '', platform: 'google', budget: '', targetAudience: '', status: 'draft' });
      loadCampaigns();
    } catch (error) { console.error('Error:', error); }
  };

  const platformColors = { google: 'bg-red-100 text-red-800', facebook: 'bg-blue-100 text-blue-800', instagram: 'bg-pink-100 text-pink-800', tiktok: 'bg-gray-900 text-white', amazon: 'bg-orange-100 text-orange-800' };

  const columns = [
    { header: 'Campaign', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-lg">📢</div>
        <div>
          <span className="font-medium block">{row.name}</span>
          {row.aiGenerated && <span className="ai-badge text-xs">✨ AI</span>}
        </div>
      </div>
    )},
    { header: 'Platform', render: (row) => <span className={`badge ${platformColors[row.platform]}`}>{row.platform}</span> },
    { header: 'Budget', render: (row) => `$${parseFloat(row.budget).toLocaleString()}` },
    { header: 'Spent', render: (row) => `$${parseFloat(row.spent).toLocaleString()}` },
    { header: 'Performance', render: (row) => (
      <div className="text-sm">
        <div>{row.impressions?.toLocaleString()} imp</div>
        <div className="text-gray-500">{row.clicks?.toLocaleString()} clicks</div>
      </div>
    )},
    { header: 'CTR', render: (row) => <span className={row.ctr > 3 ? 'text-green-600 font-medium' : ''}>{parseFloat(row.ctr || 0).toFixed(2)}%</span> },
    { header: 'ROAS', render: (row) => <span className={row.roas > 4 ? 'text-green-600 font-bold' : ''}>{parseFloat(row.roas || 0).toFixed(1)}x</span> },
    { header: 'Status', render: (row) => (
      <span className={`badge ${row.status === 'active' ? 'badge-success' : row.status === 'paused' ? 'badge-warning' : row.status === 'completed' ? 'badge-info' : 'badge-gray'}`}>
        {row.status}
      </span>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ad Campaigns</h1>
          <p className="text-gray-500">Manage your advertising campaigns</p>
        </div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">+ New Campaign</button>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-purple-900 mb-1">AI Campaign Insights</h3><p className="text-purple-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold text-green-600">{campaigns.filter(c => c.status === 'active').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Spent</p><p className="text-2xl font-bold">${campaigns.reduce((sum, c) => sum + parseFloat(c.spent || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Conversions</p><p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Avg ROAS</p><p className="text-2xl font-bold">{(campaigns.reduce((sum, c) => sum + parseFloat(c.roas || 0), 0) / campaigns.length || 0).toFixed(1)}x</p></div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={campaigns}
          onFilter={setFilteredCampaigns}
          searchFields={['name', 'platform', 'status', 'targetAudience']}
          placeholder="Search by name, platform, status..."
        />
        <DataTable columns={columns} data={filteredCampaigns} onRowClick={handleRowClick} loading={loading} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Campaign Details" size="lg">
        {selectedCampaign && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedCampaign.name}</h3>
                <div className="flex gap-2 mt-2">
                  <span className={`badge ${platformColors[selectedCampaign.platform]}`}>{selectedCampaign.platform}</span>
                  <span className={`badge ${selectedCampaign.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{selectedCampaign.status}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Budget</p><p className="text-xl font-bold">${parseFloat(selectedCampaign.budget).toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">Spent</p><p className="text-xl font-bold">${parseFloat(selectedCampaign.spent).toLocaleString()}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">CTR</p><p className="text-xl font-bold">{parseFloat(selectedCampaign.ctr || 0).toFixed(2)}%</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-sm text-gray-500">ROAS</p><p className="text-xl font-bold text-green-600">{parseFloat(selectedCampaign.roas || 0).toFixed(1)}x</p></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-sm text-gray-500">Impressions</p><p className="text-lg font-medium">{selectedCampaign.impressions?.toLocaleString()}</p></div>
              <div><p className="text-sm text-gray-500">Clicks</p><p className="text-lg font-medium">{selectedCampaign.clicks?.toLocaleString()}</p></div>
              <div><p className="text-sm text-gray-500">Conversions</p><p className="text-lg font-medium">{selectedCampaign.conversions?.toLocaleString()}</p></div>
            </div>
            {selectedCampaign.adCopy && <div><h4 className="font-medium mb-2">Ad Copy</h4><p className="bg-gray-50 p-4 rounded-lg text-gray-700">{selectedCampaign.adCopy}</p></div>}
            {selectedCampaign.targetAudience && <div><h4 className="font-medium mb-2">Target Audience</h4><p className="text-gray-600">{selectedCampaign.targetAudience}</p></div>}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Insights</h4>
                <button onClick={() => handleRowClick(selectedCampaign)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
              </div>
              {aiLoading ? <p className="text-purple-600">Analyzing campaign...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={handleAiGenerate} className="btn btn-ai">✨ AI Generate Ad Copy</button>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">🗑️ Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Campaign">
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label><input type="text" className="input" value={newCampaign.name} onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select className="input" value={newCampaign.platform} onChange={(e) => setNewCampaign({...newCampaign, platform: e.target.value})}>
                <option value="google">Google</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="amazon">Amazon</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Budget</label><input type="number" step="0.01" className="input" value={newCampaign.budget} onChange={(e) => setNewCampaign({...newCampaign, budget: e.target.value})} required /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label><textarea className="input" rows={2} value={newCampaign.targetAudience} onChange={(e) => setNewCampaign({...newCampaign, targetAudience: e.target.value})} /></div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-primary">Create Campaign</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>
    </div>
  );
};
