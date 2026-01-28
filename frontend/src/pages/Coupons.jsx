import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';

export const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    startDate: '',
    endDate: '',
    status: 'active'
  });
  const { get, post, put, del, loading } = useApi();

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      const data = await get('/api/coupons');
      setCoupons(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        discountValue: parseFloat(formData.discountValue),
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null
      };

      if (editingCoupon) {
        await put(`/api/coupons/${editingCoupon.id}`, payload);
      } else {
        await post('/api/coupons', payload);
      }
      setIsModalOpen(false);
      resetForm();
      loadCoupons();
    } catch (e) {
      console.error(e);
      alert('Failed to save coupon');
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount || '',
      maxDiscount: coupon.maxDiscount || '',
      usageLimit: coupon.usageLimit || '',
      startDate: coupon.startDate ? coupon.startDate.split('T')[0] : '',
      endDate: coupon.endDate ? coupon.endDate.split('T')[0] : '',
      status: coupon.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await del(`/api/coupons/${id}`);
      loadCoupons();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minOrderAmount: '',
      maxDiscount: '',
      usageLimit: '',
      startDate: '',
      endDate: '',
      status: 'active'
    });
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row) => (
        <span className="font-mono font-bold text-primary-600">{row.code}</span>
      )
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (row) => (
        <span>
          {row.discountType === 'percentage'
            ? `${row.discountValue}%`
            : `$${parseFloat(row.discountValue).toFixed(2)}`}
        </span>
      )
    },
    {
      key: 'minOrderAmount',
      label: 'Min Order',
      render: (row) => row.minOrderAmount ? `$${parseFloat(row.minOrderAmount).toFixed(2)}` : '-'
    },
    {
      key: 'usage',
      label: 'Usage',
      render: (row) => (
        <span>
          {row.usedCount || 0} / {row.usageLimit || '∞'}
        </span>
      )
    },
    {
      key: 'validity',
      label: 'Valid Period',
      render: (row) => {
        const start = row.startDate ? new Date(row.startDate).toLocaleDateString() : 'Now';
        const end = row.endDate ? new Date(row.endDate).toLocaleDateString() : 'Forever';
        return `${start} - ${end}`;
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`badge ${
          row.status === 'active' ? 'badge-success' :
          row.status === 'inactive' ? 'badge-warning' : 'badge-danger'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(row)} className="btn btn-secondary text-sm">
            Edit
          </button>
          <button onClick={() => handleDelete(row.id)} className="btn btn-danger text-sm">
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons & Discounts</h1>
          <p className="text-gray-500">Manage promotional codes and discounts</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="btn btn-primary"
        >
          + Create Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Coupons</p>
          <p className="text-2xl font-bold">{coupons.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {coupons.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Uses</p>
          <p className="text-2xl font-bold text-blue-600">
            {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Expired</p>
          <p className="text-2xl font-bold text-red-600">
            {coupons.filter(c => c.status === 'expired').length}
          </p>
        </div>
      </div>

      <DataTable
        data={coupons}
        columns={columns}
        loading={loading}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coupon Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="input w-full font-mono"
                placeholder="SAVE20"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input w-full"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              placeholder="20% off your order"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type *
              </label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                className="input w-full"
                required
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Value *
              </label>
              <input
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                className="input w-full"
                placeholder={formData.discountType === 'percentage' ? '20' : '10.00'}
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Order Amount
              </label>
              <input
                type="number"
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                className="input w-full"
                placeholder="50.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Discount
              </label>
              <input
                type="number"
                value={formData.maxDiscount}
                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                className="input w-full"
                placeholder="100.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usage Limit
            </label>
            <input
              type="number"
              value={formData.usageLimit}
              onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
              className="input w-full"
              placeholder="Leave empty for unlimited"
              min="1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {editingCoupon ? 'Update' : 'Create'} Coupon
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
