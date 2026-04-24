import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdvancedSearch } from '../components/AdvancedSearch';

export const Content = () => {
  const {
    data: content, total, page, setPage, filters, handleFilterChange, clearFilters,
    loading: pLoading, totalPages, limit, reload
  } = usePaginatedApi('/api/content', { defaultLimit: 10 });

  const [selectedContent, setSelectedContent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newContent, setNewContent] = useState({ type: 'product_description', title: '', context: '', platform: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, post, del, loading } = useApi();
  const { showToast } = useNotifications();

  const advancedSearchFilters = [
    { key: 'type', label: 'Type', type: 'select', options: [
      { value: 'product_description', label: 'Product Description' }, { value: 'ad_copy', label: 'Ad Copy' },
      { value: 'email', label: 'Email' }, { value: 'social_post', label: 'Social Post' },
      { value: 'blog', label: 'Blog' }, { value: 'seo_meta', label: 'SEO Meta' }
    ]},
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'draft', label: 'Draft' }, { value: 'approved', label: 'Approved' }, { value: 'published', label: 'Published' }
    ]}
  ];

  const handleRowClick = (c) => { setSelectedContent(c); setIsModalOpen(true); };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this content?');
    setConfirmAction(() => async () => {
      try {
        await del(`/api/content/${selectedContent.id}`);
        setIsModalOpen(false);
        reload();
        showToast('Content deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting content:', error);
        showToast('Failed to delete content', 'error');
      }
    });
    setConfirmOpen(true);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      await post('/api/content/ai-generate', { type: newContent.type, title: newContent.title, context: { description: newContent.context, platform: newContent.platform } });
      setIsNewModalOpen(false);
      setNewContent({ type: 'product_description', title: '', context: '', platform: '' });
      reload();
      showToast('Content generated successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to generate content', 'error');
    }
  };

  const typeColors = { product_description: 'bg-blue-100 text-blue-800', ad_copy: 'bg-orange-100 text-orange-800', email: 'bg-green-100 text-green-800', social_post: 'bg-pink-100 text-pink-800', blog: 'bg-purple-100 text-purple-800', seo_meta: 'bg-teal-100 text-teal-800' };

  const columns = [
    { header: 'Content', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-lg">✍️</div>
        <div><span className="font-medium block">{row.title}</span><span className="text-sm text-gray-500">{row.wordCount} words</span></div>
      </div>
    )},
    { header: 'Type', render: (row) => <span className={`badge ${typeColors[row.type]}`}>{row.type.replace('_', ' ')}</span> },
    { header: 'Platform', render: (row) => row.platform ? <span className="badge badge-gray">{row.platform}</span> : '-' },
    { header: 'SEO Score', render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-12 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${row.seoScore > 80 ? 'bg-green-500' : row.seoScore > 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${row.seoScore}%`}}></div></div>
        <span className="text-sm">{row.seoScore}</span>
      </div>
    )},
    { header: 'Status', render: (row) => <span className={`badge ${row.status === 'published' ? 'badge-success' : row.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>{row.status}</span> },
    { header: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Content Generation</h1><p className="text-gray-500">AI-powered content creation</p></div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-ai">✨ Generate Content</button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">Total Content</p><p className="text-2xl font-bold">{total || content.length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Published</p><p className="text-2xl font-bold text-green-600">{content.filter(c => c.status === 'published').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Drafts</p><p className="text-2xl font-bold text-yellow-600">{content.filter(c => c.status === 'draft').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Avg SEO Score</p><p className="text-2xl font-bold">{Math.round(content.reduce((sum, c) => sum + (c.seoScore || 0), 0) / content.length || 0)}</p></div>
      </div>

      <div className="card space-y-4">
        <AdvancedSearch filters={advancedSearchFilters} values={filters} onChange={handleFilterChange} onClear={clearFilters} />
        <DataTable columns={columns} data={content} onRowClick={handleRowClick} loading={pLoading} emptyIcon="✍️" emptyTitle="No content found" emptyDescription="Generate new content to get started." />
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} noun="items" />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Content Details" size="lg">
        {selectedContent && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div><h3 className="text-xl font-bold">{selectedContent.title}</h3><div className="flex gap-2 mt-2"><span className={`badge ${typeColors[selectedContent.type]}`}>{selectedContent.type.replace('_', ' ')}</span><span className={`badge ${selectedContent.status === 'published' ? 'badge-success' : 'badge-warning'}`}>{selectedContent.status}</span></div></div>
              <div className="text-right"><p className="text-sm text-gray-500">SEO Score</p><p className="text-2xl font-bold">{selectedContent.seoScore}</p></div>
            </div>
            <div><h4 className="font-medium mb-2">Content</h4><div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto"><p className="text-gray-700 whitespace-pre-wrap">{selectedContent.content}</p></div></div>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-sm text-gray-500">Word Count</p><p className="font-bold">{selectedContent.wordCount}</p></div>
              <div><p className="text-sm text-gray-500">Tone</p><p className="font-bold">{selectedContent.tone}</p></div>
              <div><p className="text-sm text-gray-500">AI Model</p><p className="font-bold">{selectedContent.aiModel}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Generate AI Content">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
            <select className="input" value={newContent.type} onChange={(e) => setNewContent({...newContent, type: e.target.value})}>
              <option value="product_description">Product Description</option><option value="ad_copy">Ad Copy</option><option value="email">Email</option><option value="social_post">Social Post</option><option value="blog">Blog</option><option value="seo_meta">SEO Meta</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input type="text" className="input" value={newContent.title} onChange={(e) => setNewContent({...newContent, title: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Context/Instructions</label><textarea className="input" rows={4} value={newContent.context} onChange={(e) => setNewContent({...newContent, context: e.target.value})} placeholder="Describe what you want the AI to write..." required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Platform (optional)</label><input type="text" className="input" value={newContent.platform} onChange={(e) => setNewContent({...newContent, platform: e.target.value})} placeholder="e.g., Instagram, Google" /></div>
          <div className="flex gap-3 pt-4"><button type="submit" className="btn btn-ai">✨ Generate</button><button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
