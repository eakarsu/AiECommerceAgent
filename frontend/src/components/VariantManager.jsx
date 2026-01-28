import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export const VariantManager = ({ productId, productName }) => {
  const [variants, setVariants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editVariant, setEditVariant] = useState(null);
  const [newVariant, setNewVariant] = useState({
    sku: '', name: '', options: { size: '', color: '' },
    priceOverride: '', quantity: 0, status: 'active'
  });
  const { get, post, put, del, loading } = useApi();

  useEffect(() => {
    if (productId) loadVariants();
  }, [productId]);

  const loadVariants = async () => {
    try {
      const data = await get(`/api/products/${productId}/variants`);
      setVariants(data);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newVariant,
        options: Object.fromEntries(
          Object.entries(newVariant.options).filter(([, v]) => v)
        ),
        priceOverride: newVariant.priceOverride ? parseFloat(newVariant.priceOverride) : null,
        quantity: parseInt(newVariant.quantity)
      };
      await post(`/api/products/${productId}/variants`, payload);
      setShowForm(false);
      setNewVariant({ sku: '', name: '', options: { size: '', color: '' }, priceOverride: '', quantity: 0, status: 'active' });
      loadVariants();
    } catch (e) { console.error(e); }
  };


  const handleStatusToggle = async (variant, e) => {
    e.stopPropagation();
    try {
      await put(`/api/products/${productId}/variants/${variant.id}`, {
        status: variant.status === 'active' ? 'inactive' : 'active'
      });
      loadVariants();
      if (selectedVariant?.id === variant.id) {
        setSelectedVariant({ ...variant, status: variant.status === 'active' ? 'inactive' : 'active' });
      }
    } catch (e) { console.error(e); }
  };

  const handleVariantClick = (variant) => {
    setSelectedVariant(variant);
    setEditMode(false);
    setEditVariant(null);
  };

  const handleEditStart = () => {
    setEditMode(true);
    setEditVariant({
      ...selectedVariant,
      priceOverride: selectedVariant.priceOverride || '',
      options: selectedVariant.options || { size: '', color: '' }
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        sku: editVariant.sku,
        name: editVariant.name,
        options: Object.fromEntries(
          Object.entries(editVariant.options || {}).filter(([, v]) => v)
        ),
        priceOverride: editVariant.priceOverride ? parseFloat(editVariant.priceOverride) : null,
        quantity: parseInt(editVariant.quantity),
        status: editVariant.status
      };
      await put(`/api/products/${productId}/variants/${selectedVariant.id}`, payload);
      setEditMode(false);
      setSelectedVariant(null);
      loadVariants();
    } catch (e) { console.error(e); }
  };

  const handleDeleteClick = async (variantId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this variant?')) return;
    try {
      await del(`/api/products/${productId}/variants/${variantId}`);
      if (selectedVariant?.id === variantId) {
        setSelectedVariant(null);
      }
      loadVariants();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Variants</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-sm">
          + Add Variant
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">SKU</label>
              <input className="input text-sm" value={newVariant.sku} onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input className="input text-sm" value={newVariant.name} onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Size</label>
              <input className="input text-sm" placeholder="e.g., S, M, L, XL" value={newVariant.options.size} onChange={(e) => setNewVariant({ ...newVariant, options: { ...newVariant.options, size: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Color</label>
              <input className="input text-sm" placeholder="e.g., Red, Blue" value={newVariant.options.color} onChange={(e) => setNewVariant({ ...newVariant, options: { ...newVariant.options, color: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price Override</label>
              <input type="number" step="0.01" className="input text-sm" placeholder="Leave empty for base price" value={newVariant.priceOverride} onChange={(e) => setNewVariant({ ...newVariant, priceOverride: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quantity</label>
              <input type="number" className="input text-sm" value={newVariant.quantity} onChange={(e) => setNewVariant({ ...newVariant, quantity: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary text-sm">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {variants.length === 0 ? (
        <p className="text-sm text-gray-500">No variants yet. Add variants for different sizes, colors, etc.</p>
      ) : (
        <div className="space-y-2">
          {variants.map(v => (
            <div
              key={v.id}
              onClick={() => handleVariantClick(v)}
              className={`flex items-center justify-between p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${selectedVariant?.id === v.id ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-xs text-gray-500">
                    SKU: {v.sku}
                    {v.options?.size && ` | Size: ${v.options.size}`}
                    {v.options?.color && ` | Color: ${v.options.color}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {v.priceOverride ? `$${parseFloat(v.priceOverride).toFixed(2)}` : 'Base price'}
                </span>
                <span className="text-sm text-gray-500">Qty: {v.quantity}</span>
                <span className={`badge ${v.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                  {v.status}
                </span>
                <button onClick={(e) => handleStatusToggle(v, e)} className="text-xs text-blue-600 hover:text-blue-800">
                  Toggle
                </button>
                <button onClick={(e) => handleDeleteClick(v.id, e)} className="text-xs text-red-600 hover:text-red-800">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Variant Detail Panel */}
      {selectedVariant && !editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-blue-900">Variant Details</h4>
            <button onClick={() => setSelectedVariant(null)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">{selectedVariant.name}</p>
            </div>
            <div>
              <p className="text-gray-500">SKU</p>
              <p className="font-medium">{selectedVariant.sku}</p>
            </div>
            <div>
              <p className="text-gray-500">Size</p>
              <p className="font-medium">{selectedVariant.options?.size || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Color</p>
              <p className="font-medium">{selectedVariant.options?.color || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Price Override</p>
              <p className="font-medium">{selectedVariant.priceOverride ? `$${parseFloat(selectedVariant.priceOverride).toFixed(2)}` : 'Uses base price'}</p>
            </div>
            <div>
              <p className="text-gray-500">Quantity</p>
              <p className="font-medium">{selectedVariant.quantity}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <span className={`badge ${selectedVariant.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                {selectedVariant.status}
              </span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleEditStart} className="btn btn-primary text-sm">Edit Variant</button>
            <button onClick={() => setSelectedVariant(null)} className="btn btn-secondary text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Edit Variant Panel */}
      {selectedVariant && editMode && editVariant && (
        <form onSubmit={handleEditSave} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-yellow-900">Edit Variant</h4>
            <button type="button" onClick={() => { setEditMode(false); setSelectedVariant(null); }} className="text-gray-500 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">SKU</label>
              <input className="input text-sm" value={editVariant.sku} onChange={(e) => setEditVariant({ ...editVariant, sku: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input className="input text-sm" value={editVariant.name} onChange={(e) => setEditVariant({ ...editVariant, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Size</label>
              <input className="input text-sm" placeholder="e.g., S, M, L, XL" value={editVariant.options?.size || ''} onChange={(e) => setEditVariant({ ...editVariant, options: { ...editVariant.options, size: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Color</label>
              <input className="input text-sm" placeholder="e.g., Red, Blue" value={editVariant.options?.color || ''} onChange={(e) => setEditVariant({ ...editVariant, options: { ...editVariant.options, color: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price Override</label>
              <input type="number" step="0.01" className="input text-sm" placeholder="Leave empty for base price" value={editVariant.priceOverride} onChange={(e) => setEditVariant({ ...editVariant, priceOverride: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quantity</label>
              <input type="number" className="input text-sm" value={editVariant.quantity} onChange={(e) => setEditVariant({ ...editVariant, quantity: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select className="input text-sm" value={editVariant.status} onChange={(e) => setEditVariant({ ...editVariant, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary text-sm">Save Changes</button>
            <button type="button" onClick={() => setEditMode(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
};
