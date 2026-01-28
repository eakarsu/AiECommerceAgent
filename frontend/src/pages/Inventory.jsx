import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { LiveSearch } from '../components/LiveSearch';

export const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { get, put, del, loading } = useApi();

  useEffect(() => { loadInventory(); }, []);

  const loadInventory = async () => {
    try {
      const data = await get('/api/inventory');
      setInventory(data);
      setFilteredInventory(data);
    } catch (error) { console.error('Error:', error); }
  };

  const handleRowClick = (item) => { setSelectedItem(item); setIsModalOpen(true); };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this inventory item?')) return;
    try {
      await del(`/api/inventory/${selectedItem.id}`);
      setIsModalOpen(false);
      loadInventory();
    } catch (error) {
      console.error('Error deleting inventory:', error);
    }
  };

  const handleUpdateQuantity = async (newQty) => {
    try {
      await put(`/api/inventory/${selectedItem.id}`, { quantity: parseInt(newQty) });
      loadInventory();
      setIsModalOpen(false);
    } catch (error) { console.error('Error:', error); }
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
        <LiveSearch
          data={inventory}
          onFilter={setFilteredInventory}
          searchFields={['Product.name', 'Product.sku', 'warehouse', 'status']}
          placeholder="Search by product, SKU, warehouse, status..."
        />
        <DataTable columns={columns} data={filteredInventory} onRowClick={handleRowClick} loading={loading} />
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
              <button onClick={handleDelete} className="btn btn-danger">🗑️ Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
