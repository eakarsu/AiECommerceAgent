import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { get, post, del, loading } = useApi();

  useEffect(() => { loadReviews(); }, []);
  const loadReviews = async () => {
    try {
      const data = await get('/api/reviews');
      setReviews(data);
      setFilteredReviews(data);
      if (data.length > 0) generateAiSummary(data);
    } catch (e) { console.error(e); }
  };

  const generateAiSummary = async (data) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'reviews_summary',
        data: {
          totalReviews: data.length,
          positiveReviews: data.filter(r => r.sentiment === 'positive').length,
          negativeReviews: data.filter(r => r.sentiment === 'negative').length,
          pendingResponse: data.filter(r => !r.responded).length,
          avgRating: data.reduce((sum, r) => sum + (r.rating || 0), 0) / data.length,
          verifiedReviews: data.filter(r => r.verified).length
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Prioritize responding to negative reviews to improve customer satisfaction and brand perception.');
    }
  };

  const handleRowClick = async (r) => {
    setSelectedReview(r);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'review_analysis',
        data: {
          productName: r.Product?.name,
          customerName: r.customerName,
          rating: r.rating,
          title: r.title,
          content: r.content,
          sentiment: r.sentiment,
          sentimentScore: r.sentimentScore,
          keywords: r.keywords,
          verified: r.verified,
          responded: r.responded
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Analyze the customer feedback for actionable insights to improve product or service quality.');
    }
    setAiLoading(false);
  };
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await del(`/api/reviews/${selectedReview.id}`);
      setIsModalOpen(false);
      loadReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  const handleAiRespond = async () => {
    try { const result = await post(`/api/reviews/${selectedReview.id}/ai-respond`, {}); setSelectedReview(result.review); loadReviews(); }
    catch (e) { console.error(e); }
  };

  const columns = [
    { header: 'Product', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center text-lg">⭐</div>
        <span className="font-medium">{row.Product?.name || 'Unknown'}</span>
      </div>
    )},
    { header: 'Customer', render: (row) => row.customerName },
    { header: 'Rating', render: (row) => <div className="flex">{'⭐'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</div> },
    { header: 'Title', render: (row) => <span className="font-medium">{row.title}</span> },
    { header: 'Sentiment', render: (row) => (
      <span className={`badge ${row.sentiment === 'positive' ? 'badge-success' : row.sentiment === 'negative' ? 'badge-danger' : 'badge-warning'}`}>{row.sentiment || 'unanalyzed'}</span>
    )},
    { header: 'Responded', render: (row) => row.responded ? <span className="text-green-600">✓ Yes</span> : <span className="text-gray-400">No</span> },
    { header: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Review Analysis</h1><p className="text-gray-500">AI-powered sentiment analysis and responses</p></div>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-yellow-900 mb-1">AI Review Insights</h3><p className="text-yellow-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Reviews</p><p className="text-2xl font-bold">{reviews.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Positive</p><p className="text-2xl font-bold text-green-600">{reviews.filter(r => r.sentiment === 'positive').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Negative</p><p className="text-2xl font-bold text-red-600">{reviews.filter(r => r.sentiment === 'negative').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Pending Response</p><p className="text-2xl font-bold text-yellow-600">{reviews.filter(r => !r.responded).length}</p></div>
      </div>

      <div className="card space-y-4">
        <LiveSearch
          data={reviews}
          onFilter={setFilteredReviews}
          searchFields={['Product.name', 'Customer.name', 'content', 'sentiment']}
          placeholder="Search by product, customer, content, sentiment..."
        />
        <DataTable columns={columns} data={filteredReviews} onRowClick={handleRowClick} loading={loading} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Review Details" size="lg">
        {selectedReview && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-xl">⭐</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{selectedReview.title}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500">by {selectedReview.customerName}</span>
                  <div className="flex">{'⭐'.repeat(selectedReview.rating)}{'☆'.repeat(5 - selectedReview.rating)}</div>
                  {selectedReview.verified && <span className="badge badge-success">Verified</span>}
                </div>
              </div>
            </div>
            <div><h4 className="font-medium mb-2">Review Content</h4><p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedReview.content}</p></div>
            {selectedReview.sentiment && (
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-gray-500">Sentiment</p><span className={`badge ${selectedReview.sentiment === 'positive' ? 'badge-success' : selectedReview.sentiment === 'negative' ? 'badge-danger' : 'badge-warning'}`}>{selectedReview.sentiment}</span></div>
                <div><p className="text-sm text-gray-500">Score</p><p className="font-bold">{(parseFloat(selectedReview.sentimentScore || 0) * 100).toFixed(0)}%</p></div>
              </div>
            )}
            {selectedReview.keywords?.length > 0 && (
              <div><h4 className="font-medium mb-2">Keywords</h4><div className="flex gap-2 flex-wrap">{selectedReview.keywords.map((k, i) => <span key={i} className="badge badge-info">{k}</span>)}</div></div>
            )}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Insights</h4>
                <button onClick={() => handleRowClick(selectedReview)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
              </div>
              {aiLoading ? <p className="text-purple-600">Analyzing review...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>
            <div className="flex gap-3">
              {!selectedReview.responded && <button onClick={handleAiRespond} className="btn btn-ai">✨ AI Generate Response</button>}
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">🗑️ Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
