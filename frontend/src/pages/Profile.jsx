import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../context/NotificationContext';

export const Profile = () => {
  const { user } = useAuth();
  const { put, loading } = useApi();
  const { showToast } = useNotifications();
  const [name, setName] = useState(user?.name || '');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [editing, setEditing] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await put('/api/users/me/profile', { name });
      showToast('Profile updated successfully', 'success');
      setEditing(false);
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (passwords.new.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      await put('/api/users/me/password', { currentPassword: passwords.current, newPassword: passwords.new });
      showToast('Password changed successfully', 'success');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500">Manage your account settings</p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-2xl font-bold text-primary-600">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{user?.name}</h3>
            <p className="text-gray-500">{user?.email}</p>
            <span className="badge badge-info mt-1">{user?.role}</span>
          </div>
        </div>

        {user?.lastLogin && (
          <p className="text-sm text-gray-500">Last login: {new Date(user.lastLogin).toLocaleString()}</p>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-3 border-t pt-4">
          <h4 className="font-medium">Edit Profile</h4>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => { setName(e.target.value); setEditing(true); }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input bg-gray-100" value={user?.email || ''} disabled />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input type="text" className="input bg-gray-100" value={user?.role || ''} disabled />
          </div>
          {editing && (
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </form>
      </div>

      <div className="card p-6 space-y-4">
        <h4 className="font-medium">Change Password</h4>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              className="input"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              className="input"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
