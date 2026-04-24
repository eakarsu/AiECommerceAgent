import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [formData, setFormData] = useState({ email: '', name: '', password: '', role: 'user' });
  const { get, post, put, del, loading } = useApi();
  const { user: currentUser } = useAuth();
  const { showToast } = useNotifications();

  useEffect(() => { loadUsers(); loadStats(); }, []);

  const loadUsers = async () => { try { setUsers(await get('/api/users')); } catch (e) { console.error(e); } };
  const loadStats = async () => { try { setStats(await get('/api/users/stats/summary')); } catch (e) { console.error(e); } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        await put(`/api/users/${editingUser.id}`, payload);
        showToast('User updated successfully', 'success');
      } else {
        await post('/api/users', formData);
        showToast('User created successfully', 'success');
      }
      setIsModalOpen(false);
      resetForm();
      loadUsers();
      loadStats();
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Failed to save user', 'error');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({ email: user.email, name: user.name, password: '', role: user.role });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (id === currentUser?.id) {
      showToast('You cannot delete your own account', 'error');
      return;
    }
    setConfirmMsg('Are you sure you want to delete this user?');
    setConfirmAction(() => async () => {
      try { await del(`/api/users/${id}`); loadUsers(); loadStats(); showToast('User deleted', 'success'); }
      catch (e) { console.error(e); showToast(e.message || 'Failed to delete user', 'error'); }
    });
    setConfirmOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ email: '', name: '', password: '', role: 'user' });
  };

  const roleColors = { admin: 'badge-danger', manager: 'badge-warning', user: 'badge-info' };

  const columns = [
    { header: 'User', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-600">{row.name?.[0]?.toUpperCase() || row.email?.[0]?.toUpperCase()}</div>
        <div><p className="font-medium">{row.name}</p><p className="text-sm text-gray-500">{row.email}</p></div>
      </div>
    )},
    { header: 'Role', render: (row) => <span className={`badge ${roleColors[row.role]}`}>{row.role}</span> },
    { header: 'Last Login', render: (row) => row.lastLogin ? new Date(row.lastLogin).toLocaleString() : 'Never' },
    { header: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { header: 'Actions', render: (row) => (
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="btn btn-secondary text-sm">Edit</button>
        {row.id !== currentUser?.id && (
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="btn btn-danger text-sm">Delete</button>
        )}
      </div>
    )}
  ];

  if (currentUser?.role !== 'admin') {
    return (<div className="text-center py-12"><div className="text-6xl mb-4">Access Denied</div><p className="text-gray-500">You need admin privileges to access this page.</p></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">User Management</h1><p className="text-gray-500">Manage users and roles</p></div>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn btn-primary">+ Add User</button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="stat-card"><p className="text-sm text-gray-500">Total Users</p><p className="text-2xl font-bold">{stats.total}</p></div>
          <div className="stat-card"><p className="text-sm text-gray-500">Admins</p><p className="text-2xl font-bold text-red-600">{stats.byRole?.admin || 0}</p></div>
          <div className="stat-card"><p className="text-sm text-gray-500">Managers</p><p className="text-2xl font-bold text-yellow-600">{stats.byRole?.manager || 0}</p></div>
          <div className="stat-card"><p className="text-sm text-gray-500">Active (7 days)</p><p className="text-2xl font-bold text-green-600">{stats.activeLastWeek || 0}</p></div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Role Permissions</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="badge badge-danger">Admin</span><p className="text-blue-800 mt-1">Full access to all features, user management, and system settings</p></div>
          <div><span className="badge badge-warning">Manager</span><p className="text-blue-800 mt-1">Access to products, orders, customers, and reports</p></div>
          <div><span className="badge badge-info">User</span><p className="text-blue-800 mt-1">Read-only access to dashboard and basic features</p></div>
        </div>
      </div>

      <div className="card"><DataTable data={users} columns={columns} loading={loading} emptyIcon="👤" emptyTitle="No users found" emptyDescription="Add a user to get started." /></div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'Add New User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input w-full" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser ? '(leave blank to keep current)' : '*'}</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input w-full" required={!editingUser} minLength={6} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Role *</label><select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="input w-full" required><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{editingUser ? 'Update' : 'Create'} User</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => { confirmAction && confirmAction(); setConfirmOpen(false); }} title="Confirm Delete" message={confirmMsg} confirmText="Delete" confirmStyle="danger" />
    </div>
  );
};
