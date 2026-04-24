import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { useFormValidation } from '../hooks/useFormValidation';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';
import { VariantManager } from '../components/VariantManager';
import { Pagination } from '../components/Pagination';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdvancedSearch } from '../components/AdvancedSearch';
import { FormField } from '../components/FormField';

export const Products = () => {
  const {
    data,
    total,
    page,
    setPage,
    filters,
    handleFilterChange,
    clearFilters,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    loading: paginatedLoading,
    totalPages,
    limit,
    reload
  } = usePaginatedApi('/api/products', { defaultLimit: 10 });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', description: '', category: '', basePrice: '', currentPrice: '', cost: '', status: 'active', imageUrl: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkData, setBulkData] = useState({ status: '', category: '', adjustType: 'percentage', adjustValue: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const { get, post, put, del, loading } = useApi();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const { errors, validate, clearErrors } = useFormValidation({
    name: { required: true },
    sku: { required: true, minLength: 3 },
    basePrice: { required: true, min: 0 },
    currentPrice: { required: true, min: 0 }
  });

  const advancedSearchFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'draft', label: 'Draft' }
      ]
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'Electronics', label: 'Electronics' },
        { value: 'Fashion', label: 'Fashion' },
        { value: 'Home', label: 'Home' },
        { value: 'Sports', label: 'Sports' },
        { value: 'Beauty', label: 'Beauty' }
      ]
    },
    {
      key: 'minPrice',
      label: 'Min Price',
      type: 'number'
    },
    {
      key: 'maxPrice',
      label: 'Max Price',
      type: 'number'
    },
    {
      key: 'search',
      label: 'Search',
      type: 'text'
    }
  ];

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (data && data.length > 0) {
      generateAiSummary(data);
    }
  }, [data]);

  const loadCustomers = async () => {
    try {
      const customerData = await get('/api/customers');
      setCustomers(customerData);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleOrderNow = () => {
    setOrderQuantity(1);
    setSelectedCustomerId('');
    setOrderSuccess(null);
    setIsOrderModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }
    try {
      const subtotal = parseFloat(selectedProduct.currentPrice) * orderQuantity;
      const tax = subtotal * 0.08;
      const shipping = 0;
      const totalAmount = subtotal + tax + shipping;

      const orderData = {
        customerId: parseInt(selectedCustomerId),
        items: [{
          productId: selectedProduct.id,
          name: selectedProduct.name,
          quantity: orderQuantity,
          price: parseFloat(selectedProduct.currentPrice)
        }],
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        total: totalAmount.toFixed(2),
        status: 'pending',
        paymentStatus: 'pending'
      };

      const order = await post('/api/orders', orderData);
      setOrderSuccess(order);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order');
    }
  };

  const generateAiSummary = async (productData) => {
    try {
      const result = await post('/api/ai/analyze', {
        type: 'products_summary',
        data: {
          totalProducts: productData.length,
          activeProducts: productData.filter(p => p.status === 'active').length,
          aiOptimized: productData.filter(p => p.aiOptimized).length,
          avgPrice: productData.reduce((sum, p) => sum + parseFloat(p.currentPrice || 0), 0) / productData.length,
          categories: [...new Set(productData.map(p => p.category))],
          lowStock: productData.filter(p => p.Inventory?.status === 'low_stock').length
        }
      });
      setAiSummary(result.insight || result);
    } catch (e) {
      setAiSummary('AI analysis: Review low-stock items and consider price optimization for underperforming products.');
    }
  };

  const handleRowClick = async (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
    setAiInsight(null);
    setAiLoading(true);
    try {
      const result = await post('/api/ai/analyze', {
        type: 'product_analysis',
        data: {
          name: product.name,
          category: product.category,
          basePrice: product.basePrice,
          currentPrice: product.currentPrice,
          cost: product.cost,
          status: product.status,
          aiOptimized: product.aiOptimized,
          inventory: product.Inventory
        }
      });
      setAiInsight(result.insight || result);
    } catch (e) {
      setAiInsight('Consider optimizing the product description and pricing based on market demand.');
    }
    setAiLoading(false);
  };

  const handleAiOptimize = async () => {
    try {
      await post(`/api/products/${selectedProduct.id}/ai-optimize`, {});
      await reload();
      const updated = await get(`/api/products/${selectedProduct.id}`);
      setSelectedProduct(updated);
      showToast('Product optimized successfully', 'success');
    } catch (error) {
      console.error('Error optimizing product:', error);
      showToast('Failed to optimize product', 'error');
    }
  };

  const handleDelete = () => {
    setConfirmAction(() => async () => {
      try {
        await del(`/api/products/${selectedProduct.id}`);
        setIsModalOpen(false);
        reload();
        showToast('Product deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Failed to delete product', 'error');
      }
    });
    setConfirmOpen(true);
  };

  const handleImageUpload = async (e, forNewProduct = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploadingImage(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/upload/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const uploadData = await response.json();
      const imageUrl = uploadData.file?.url || uploadData.url;

      if (forNewProduct) {
        setNewProduct(prev => ({ ...prev, imageUrl }));
      } else if (selectedProduct) {
        await put(`/api/products/${selectedProduct.id}`, { imageUrl });
        setSelectedProduct(prev => ({ ...prev, imageUrl }));
        reload();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    }
    setUploadingImage(false);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    const isValid = validate({
      name: newProduct.name,
      sku: newProduct.sku,
      basePrice: newProduct.basePrice,
      currentPrice: newProduct.currentPrice
    });
    if (!isValid) return;
    try {
      await post('/api/products', {
        ...newProduct,
        basePrice: parseFloat(newProduct.basePrice),
        currentPrice: parseFloat(newProduct.currentPrice),
        cost: parseFloat(newProduct.cost)
      });
      setIsNewModalOpen(false);
      setNewProduct({ sku: '', name: '', description: '', category: '', basePrice: '', currentPrice: '', cost: '', status: 'active', imageUrl: '' });
      clearErrors();
      reload();
      showToast('Product created successfully', 'success');
    } catch (error) {
      console.error('Error creating product:', error);
      showToast('Failed to create product', 'error');
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    try {
      const bulkPayload = {};
      if (bulkAction === 'update_status') bulkPayload.status = bulkData.status;
      if (bulkAction === 'update_category') bulkPayload.category = bulkData.category;
      if (bulkAction === 'adjust_price') {
        bulkPayload.adjustType = bulkData.adjustType;
        bulkPayload.adjustValue = parseFloat(bulkData.adjustValue);
      }

      await post('/api/bulk/products', {
        ids: selectedIds,
        action: bulkAction,
        data: bulkPayload
      });
      setSelectedIds([]);
      setBulkAction('');
      setBulkData({ status: '', category: '', adjustType: 'percentage', adjustValue: '' });
      reload();
      showToast('Bulk action completed successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Bulk action failed', 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map(p => p.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const columns = [
    { header: 'SKU', accessor: 'sku' },
    { header: 'Name', accessor: 'name', render: (row) => (
      <div className="flex items-center gap-3">
        {row.imageUrl ? (
          <img src={row.imageUrl} alt={row.name} className="w-10 h-10 object-cover rounded-lg" />
        ) : (
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">📦</div>
        )}
        <span className="font-medium">{row.name}</span>
      </div>
    )},
    { header: 'Category', accessor: 'category', render: (row) => (
      <span className="badge badge-info">{row.category}</span>
    )},
    { header: 'Price', render: (row) => (
      <div>
        <span className="font-medium">${parseFloat(row.currentPrice).toFixed(2)}</span>
        {row.currentPrice !== row.basePrice && (
          <span className="text-xs text-gray-500 line-through ml-2">${parseFloat(row.basePrice).toFixed(2)}</span>
        )}
      </div>
    )},
    { header: 'Status', render: (row) => (
      <span className={`badge ${row.status === 'active' ? 'badge-success' : row.status === 'draft' ? 'badge-warning' : 'badge-gray'}`}>
        {row.status}
      </span>
    )},
    { header: 'AI', render: (row) => (
      row.aiOptimized ? <span className="ai-badge">✨ Optimized</span> : <span className="text-gray-400">-</span>
    )},
    { header: 'Stock', render: (row) => (
      <span className={`badge ${row.Inventory?.status === 'in_stock' ? 'badge-success' : row.Inventory?.status === 'low_stock' ? 'badge-warning' : 'badge-danger'}`}>
        {row.Inventory?.quantity || 0} units
      </span>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage your product catalog</p>
        </div>
        <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">
          + Add Product
        </button>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div><h3 className="font-medium text-blue-900 mb-1">AI Product Insights</h3><p className="text-blue-800 text-sm">{aiSummary}</p></div>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <LiveSearch
          data={data}
          onFilter={() => {}}
          searchFields={['sku', 'name', 'description', 'category', 'status']}
          placeholder="Search by SKU, name, description, category..."
          onServerSearch={(value) => handleFilterChange('search', value)}
        />

        <AdvancedSearch
          filters={advancedSearchFilters}
          values={filters}
          onChange={handleFilterChange}
          onClear={clearFilters}
        />

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4 flex-wrap">
            <span className="font-medium text-blue-800">{selectedIds.length} selected</span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="input"
            >
              <option value="">Select action...</option>
              <option value="update_status">Update Status</option>
              <option value="update_category">Update Category</option>
              <option value="adjust_price">Adjust Price</option>
              <option value="delete">Delete</option>
            </select>
            {bulkAction === 'update_status' && (
              <select
                value={bulkData.status}
                onChange={(e) => setBulkData({ ...bulkData, status: e.target.value })}
                className="input"
              >
                <option value="">Select status...</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            )}
            {bulkAction === 'update_category' && (
              <select
                value={bulkData.category}
                onChange={(e) => setBulkData({ ...bulkData, category: e.target.value })}
                className="input"
              >
                <option value="">Select category...</option>
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Home">Home</option>
                <option value="Sports">Sports</option>
                <option value="Beauty">Beauty</option>
                <option value="Tech">Tech</option>
              </select>
            )}
            {bulkAction === 'adjust_price' && (
              <>
                <select
                  value={bulkData.adjustType}
                  onChange={(e) => setBulkData({ ...bulkData, adjustType: e.target.value })}
                  className="input w-32"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
                <input
                  type="number"
                  value={bulkData.adjustValue}
                  onChange={(e) => setBulkData({ ...bulkData, adjustValue: e.target.value })}
                  className="input w-24"
                  placeholder={bulkData.adjustType === 'percentage' ? '% change' : '$ change'}
                />
                <span className="text-sm text-gray-500">
                  (use negative for decrease)
                </span>
              </>
            )}
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction || (bulkAction === 'update_status' && !bulkData.status) || (bulkAction === 'update_category' && !bulkData.category) || (bulkAction === 'adjust_price' && !bulkData.adjustValue)}
              className="btn btn-primary"
            >
              Apply
            </button>
            <button onClick={() => setSelectedIds([])} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        )}

        {/* Select All Checkbox */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border">
          <input
            type="checkbox"
            checked={selectedIds.length === data.length && data.length > 0}
            onChange={toggleSelectAll}
            className="w-5 h-5 cursor-pointer accent-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">
            Select all products ({data.length})
          </span>
          {selectedIds.length > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              — {selectedIds.length} selected
            </span>
          )}
        </div>

        <DataTable
          columns={[
            {
              header: '☑️',
              render: (row) => (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(row.id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 cursor-pointer accent-blue-600"
                />
              )
            },
            ...columns
          ]}
          data={data}
          onRowClick={handleRowClick}
          loading={paginatedLoading || loading}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          limit={limit}
        />
      </div>

      {/* Product Details Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Product Details" size="lg">
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="relative group">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-24 h-24 object-cover rounded-xl" />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-4xl">
                    📦
                  </div>
                )}
                <label className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <span className="text-white text-sm">{uploadingImage ? 'Uploading...' : 'Change'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, false)}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h3>
                <p className="text-gray-500">SKU: {selectedProduct.sku}</p>
                <div className="flex gap-2 mt-2">
                  <span className="badge badge-info">{selectedProduct.category}</span>
                  <span className={`badge ${selectedProduct.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedProduct.status}
                  </span>
                  {selectedProduct.aiOptimized && <span className="ai-badge">✨ AI Optimized</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Current Price</p>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(selectedProduct.currentPrice).toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Base Price</p>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(selectedProduct.basePrice).toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Cost</p>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(selectedProduct.cost).toFixed(2)}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-gray-600">{selectedProduct.description}</p>
            </div>

            {selectedProduct.Inventory && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Inventory Status</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600">Quantity:</span> {selectedProduct.Inventory.quantity}
                  </div>
                  <div>
                    <span className="text-blue-600">Status:</span> {selectedProduct.Inventory.status}
                  </div>
                  <div>
                    <span className="text-blue-600">Warehouse:</span> {selectedProduct.Inventory.warehouse}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900">✨ AI Insights</h4>
                <button onClick={() => handleRowClick(selectedProduct)} disabled={aiLoading} className="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50">🔄 Regenerate</button>
              </div>
              {aiLoading ? <p className="text-purple-600">Analyzing product...</p> : <p className="text-purple-800">{aiInsight || 'Generating...'}</p>}
            </div>

            <VariantManager productId={selectedProduct.id} productName={selectedProduct.name} />

            <div className="flex gap-3 flex-wrap">
              <button onClick={handleOrderNow} className="btn btn-success">
                🛒 Order Now
              </button>
              <button onClick={handleAiOptimize} className="btn btn-ai">
                ✨ AI Optimize Description
              </button>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                Close
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Product Modal */}
      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Add New Product">
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="SKU" error={errors.sku}>
              <input type="text" className="input" value={newProduct.sku} onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})} required />
            </FormField>
            <FormField label="Name" error={errors.name}>
              <input type="text" className="input" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} required />
            </FormField>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input" rows={3} value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="input" value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} required>
                <option value="">Select category</option>
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Home">Home</option>
                <option value="Sports">Sports</option>
                <option value="Beauty">Beauty</option>
                <option value="Tech">Tech</option>
                <option value="Outdoor">Outdoor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={newProduct.status} onChange={(e) => setNewProduct({...newProduct, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Base Price" error={errors.basePrice}>
              <input type="number" step="0.01" className="input" value={newProduct.basePrice} onChange={(e) => setNewProduct({...newProduct, basePrice: e.target.value})} required />
            </FormField>
            <FormField label="Current Price" error={errors.currentPrice}>
              <input type="number" step="0.01" className="input" value={newProduct.currentPrice} onChange={(e) => setNewProduct({...newProduct, currentPrice: e.target.value})} required />
            </FormField>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
              <input type="number" step="0.01" className="input" value={newProduct.cost} onChange={(e) => setNewProduct({...newProduct, cost: e.target.value})} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
            <div className="flex items-center gap-4">
              {newProduct.imageUrl ? (
                <img src={newProduct.imageUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📦</div>
              )}
              <div className="flex-1">
                <label className="btn btn-secondary cursor-pointer inline-block">
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, true)}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn btn-primary">Create Product</button>
            <button type="button" onClick={() => setIsNewModalOpen(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Order Now Modal */}
      <Modal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Create Order">
        {selectedProduct && !orderSuccess && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl">📦</div>
                <div>
                  <h3 className="font-bold">{selectedProduct.name}</h3>
                  <p className="text-gray-500 text-sm">{selectedProduct.sku}</p>
                  <p className="text-lg font-bold text-green-600">${parseFloat(selectedProduct.currentPrice).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                className="input"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
              >
                <option value="">Select a customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                className="input"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${(parseFloat(selectedProduct.currentPrice) * orderQuantity).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (8%):</span>
                <span>${(parseFloat(selectedProduct.currentPrice) * orderQuantity * 0.08).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>${(parseFloat(selectedProduct.currentPrice) * orderQuantity * 1.08).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleCreateOrder} className="btn btn-primary flex-1">
                Create Order
              </button>
              <button onClick={() => setIsOrderModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}

        {orderSuccess && (
          <div className="space-y-4 text-center">
            <div className="text-6xl">✅</div>
            <h3 className="text-xl font-bold text-green-600">Order Created!</h3>
            <p className="text-gray-600">Order #{orderSuccess.orderNumber || orderSuccess.id} has been created.</p>
            <p className="text-sm text-gray-500">Continue to add shipping address and complete payment.</p>
            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => {
                  setIsOrderModalOpen(false);
                  navigate('/orders', { state: { openCheckoutForOrderId: orderSuccess.id } });
                }}
                className="btn btn-success"
              >
                Continue to Checkout →
              </button>
              <button
                onClick={() => { setIsOrderModalOpen(false); setOrderSuccess(null); }}
                className="btn btn-secondary"
              >
                Order Later
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialog for Delete */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction}
        title="Delete Product"
        message="Are you sure you want to delete this product? This cannot be undone."
        confirmText="Delete"
      />
    </div>
  );
};
