import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: ''
  });
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const { get, loading } = useApi();
  const limit = 20;

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [page, filters]);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString()
      });
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const data = await get(`/api/audit-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStats = async () => {
    try {
      const data = await get('/api/audit-logs/stats');
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ entityType: '', action: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const actionColors = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800'
  };

  const actionIcons = {
    create: '+',
    update: '~',
    delete: '×'
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500">Track all changes made in the system</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="stat-card">
            <p className="text-sm text-gray-500">Total Logs</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-2xl font-bold text-green-600">{stats.byAction?.create || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Updated</p>
            <p className="text-2xl font-bold text-blue-600">{stats.byAction?.update || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Deleted</p>
            <p className="text-2xl font-bold text-red-600">{stats.byAction?.delete || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              className="input"
            >
              <option value="">All Types</option>
              <option value="Product">Product</option>
              <option value="Order">Order</option>
              <option value="Customer">Customer</option>
              <option value="Coupon">Coupon</option>
              <option value="Inventory">Inventory</option>
              <option value="User">User</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="input"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="input"
            />
          </div>
          <button onClick={clearFilters} className="btn btn-secondary">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No audit logs found</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map(log => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${actionColors[log.action]}`}>
                      {actionIcons[log.action]}
                    </span>
                    <div>
                      <p className="font-medium">
                        <span className="text-gray-600">{log.userName || 'System'}</span>
                        {' '}
                        <span className={`${actionColors[log.action]} px-2 py-0.5 rounded text-xs font-medium`}>
                          {log.action}
                        </span>
                        {' '}
                        <span className="text-gray-900">{log.entityType}</span>
                        {log.entityName && (
                          <span className="text-gray-500"> - {log.entityName}</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                        {log.ipAddress && ` • IP: ${log.ipAddress}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400">
                    {selectedLog?.id === log.id ? '▼' : '▶'}
                  </span>
                </div>

                {/* Expanded details */}
                {selectedLog?.id === log.id && log.changes && (
                  <div className="mt-4 pl-11">
                    <div className="bg-gray-100 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </div>
                    {log.userAgent && (
                      <p className="text-xs text-gray-400 mt-2">
                        User Agent: {log.userAgent}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} logs
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <span className="px-4 py-2 bg-gray-100 rounded">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Top Entities */}
      {stats?.byEntity && stats.byEntity.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Most Changed Entities</h3>
          <div className="grid grid-cols-5 gap-4">
            {stats.byEntity.map((item, i) => (
              <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{item.count}</p>
                <p className="text-sm text-gray-500">{item.entityType}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
