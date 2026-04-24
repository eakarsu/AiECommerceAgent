import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { useNotifications } from '../context/NotificationContext';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';
import { Pagination } from '../components/Pagination';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdvancedSearch } from '../components/AdvancedSearch';

export const Inventory = () => {
  const {
    data: inventory, total, page, setPage, filters, handleFilterChange, clearFilters,
    loading: pLoading, totalPages, limit, reload
  } = usePaginatedApi('/api/inventory', { defaultLimit: 10 });

  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkData, setBulkData] = useState({ warehouse: '', quantity: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const { get, put, del, post, loading } = useApi();
  const { showToast } = useNotifications();

  const advancedSearchFilters = [
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'in_stock', label: 'In Stock' }, { value: 'low_stock', label: 'Low Stock' },
      { value: 'out_of_stock', label: 'Out of Stock' }, { value: 'overstocked', label: 'Overstocked' }
    ]},
    { key: 'warehouse', label: 'Warehouse', type: 'select', options: [
      { value: 'US-East', label: 'US-East' }, { value: 'US-West', label: 'US-West' }, { value: 'US-Central', label: 'US-Central' }
    ]}
  ];

  const handleRowClick = (item) => { setSelectedItem(item); setIsModalOpen(true); };

  const handleDelete = () => {
    setConfirmMsg('Are you sure you want to delete this inventory item?');
    setConfirmAction(() => async () => {
      try {
        await del(`/api/inventory/${selectedItem.id}`);
        setIsModalOpen(false);
        reload();
        showToast('Inventory item deleted', 'success');
      } catch (error) {
        console.error('Error deleting inventory:', error);
        showToast('Failed to delete inventory item', 'error');
      }
    });
    setConfirmOpen(true);
  };

  const handleUpdateQuantity = async (newQty) => {
    try {
      await put(`/api/inventory/${selectedItem.id}`, { quantity: parseInt(newQty) });
      reload();
      setIsModalOpen(false);
      showToast('Inventory updated successfully', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to update inventory', 'error');
    }
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === inventory.length ? [] : inventory.map(i => i.id));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    try {
      await post('/api/bulk/inventory', { ids: selectedIds, action: bulkAction, data: bulkData });
      setSelectedIds([]);
      setBulkAction('');
      setBulkData({ warehouse: '', quantity: '' });
      reload();
      showToast('Bulk action completed', 'success');
    } catch (e) {
      showToast('Bulk action failed', 'error');
    }
  };

  const statusColors = { in_stock: 'badge-success', low_stock: 'badge-warning', out_of_stock: 'badge-danger', overstocked: 'badge-info' };

  const columns = [
    { header: 'Product', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-lg">📋</div>
        <span className="font-medium">{row.Product?.name || 'Unknown'}</span>
      </div>
    )},
    { header: 'SKU', render: (row) => row.Product?.sku },
    { header: 'Quantity', render: (row) => <span className="font-bold text-lg">{row.quantity}</span> },
    { header: 'Reserved', render: (row) => row.reservedQuantity },
    { header: 'Available', render: (row) => <span className="font-medium">{row.quantity - row.reservedQuantity}</span> },
    { header: 'Reorder Point', render: (row) => row.reorderPoint },
    { header: 'Warehouse', render: (row) => <span className="badge badge-gray">{row.warehouse}</span> },
    { header: 'Status', render: (row) => <span className={`badge ${statusColors[row.status]}`}>{row.status?.replace('_', ' ')}</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Inventory</h1><p className="text-gray-500">Track stock levels and reorder points</p></div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-gray-500">In Stock</p><p className="text-2xl font-bold text-green-600">{inventory.filter(i => i.status === 'in_stock').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Low Stock</p><p className="text-2xl font-bold text-yellow-600">{inventory.filter(i => i.status === 'low_stock').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Out of Stock</p><p className="text-2xl font-bold text-red-600">{inventory.filter(i => i.status === 'out_of_stock').length}</p></div>
        <div className="stat-card"><p className="text-sm text-gray-500">Total Units</p><p className="text-2xl font-bold">{inventory.reduce((sum, i) => sum + (i.quantity || 0), 0).toLocaleString()}</p></div>
      </div>

      <div className="card space-y-4">
        <AdvancedSearch filters={advancedSearchFilters} values={filters} onChange={handleFilterChange} onClear={clearFilters} />

        <LiveSearch data={inventory} onFilter={() => {}} searchFields={['Product.name', 'Product.sku', 'warehouse', 'status']} placeholder="Search by product, SKU, warehouse, status..." onServerSearch={(q) => handleFilterChange('search', q)} />

        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
            <span className="font-medium text-blue-800">{selectedIds.length} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="input">
              <option value="">Select action...</option>
              <option value="update_warehouse">Update Warehouse</option>
              <option value="bulk_restock">Bulk Restock</option>
            </select>
            {bulkAction === 'update_warehouse' && (
              <select value={bulkData.warehouse} onChange={(e) => setBulkData({ ...bulkData, warehouse: e.target.value })} className="input">
                <option value="">Select warehouse...</option>
                <option value="US-East">US-East</option><option value="US-West">US-West</option><option value="US-Central">US-Central</option>
              </select>
            )}
            {bulkAction === 'bulk_restock' && (
              <input type="number" placeholder="Quantity" value={bulkData.quantity} onChange={(e) => setBulkData({ ...bulkData, quantity: e.target.value })} className="input w-32" />
            )}
            <button onClick={handleBulkAction} disabled={!bulkAction} className="btn btn-primary">Apply</button>
            <button onClick={() => setSelectedIds([])} className="btn btn-secondary">Cancel</button>
          </div>
        )}

        <div className="flex items-center gap-2 px-2">
          <input type="checkbox" checked={selectedIds.length === inventory.length && inventory.length > 0} onChange={toggleSelectAll} className="w-4 h-4" />
          <span className="text-sm text-gray-600">Select all ({inventory.length})</span>
        </div>

        <DataTable
          columns={[
            { header: '', render: (row) => (
              <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(row.id); }} onClick={(e) => e.stopPropagation()} className="w-4 h-4" />
            )},
            ...columns
          ]}
          data={inventory}
          onRowClick={handleRowClick}
          loading={pLoading}
          emptyIcon="📋"
          emptyTitle="No inventory items found"
          emptyDescription="Try adjusting your filters."
        />

        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} noun="items" />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Inventory Details" size="md">
        {selectedItem && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center text-3xl">📋</div>
              <div>
                <h3 className="text-xl font-bold">{selectedItem.Product?.name}</h3>
                <p className="text-gray-500">SKU: {selectedItem.Product?.sku}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Current Quantity</p><p className="text-3xl font-bold">{selectedItem.quantity}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Reserved</p><p className="text-3xl font-bold">{selectedItem.reservedQuantity}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Reorder Point</p><p className="text-xl font-bold">{selectedItem.reorderPoint}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">Reorder Qty</p><p className="text-xl font-bold">{selectedItem.reorderQuantity}</p></div>
            </div>
            <div className="flex items-center gap-2"><span className="text-sm text-gray-500">Status:</span><span className={`badge ${statusColors[selectedItem.status]}`}>{selectedItem.status?.replace('_', ' ')}</span></div>
            <div className="flex items-center gap-2"><span className="text-sm text-gray-500">Warehouse:</span><span className="font-medium">{selectedItem.warehouse}</span></div>
            {selectedItem.predictedStockout && <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-sm text-red-600">Predicted Stockout: {new Date(selectedItem.predictedStockout).toLocaleDateString()}</p></div>}
            <div className="flex gap-3">
              <button onClick={() => handleUpdateQuantity(selectedItem.quantity + selectedItem.reorderQuantity)} className="btn btn-success">+ Restock ({selectedItem.reorderQuantity})</button>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Close</button>
              <button onClick={handleDelete} className="btn btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
