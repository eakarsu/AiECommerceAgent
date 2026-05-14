import { useEffect, useState } from 'react';
import { FraudClusterApi } from '../services/api';

export const FraudClusters = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await FraudClusterApi.list({ page, limit: 20 });
      setItems(r.data || []);
      setPagination(r.pagination || {});
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const detect = async () => {
    setRunning(true);
    try { const r = await FraudClusterApi.detect(); alert(`Detected ${r.clusters_created} clusters`); load(); } catch (e) { alert(e.message); } finally { setRunning(false); }
  };

  const update = async (id, body) => {
    try { await FraudClusterApi.update(id, body); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fraud Cluster Detector</h1>
        <button className="btn btn-primary" onClick={detect} disabled={running}>{running ? 'Analyzing...' : 'Run Detection'}</button>
      </div>

      <div className="card p-6">
        {loading ? <p>Loading...</p> : items.length === 0 ? <p className="text-gray-500">No clusters yet. Click Run Detection to analyze fraud alerts.</p> : (
          <table className="table-auto w-full">
            <thead><tr className="text-left text-sm text-gray-600">
              <th>ID</th><th>Type</th><th>Key</th><th>Customers</th><th>Orders</th><th>Total</th><th>Severity</th><th>Status</th><th>Action</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t">
                  <td>{c.id}</td>
                  <td>{c.cluster_type}</td>
                  <td className="font-mono text-xs">{c.cluster_key}</td>
                  <td>{(c.customer_ids || []).length}</td>
                  <td>{(c.order_ids || []).length}</td>
                  <td>${parseFloat(c.total_value || 0).toFixed(2)}</td>
                  <td><span className={`px-2 py-0.5 rounded text-xs ${c.severity === 'critical' ? 'bg-red-200 text-red-900' : c.severity === 'high' ? 'bg-orange-200 text-orange-900' : 'bg-yellow-100 text-yellow-800'}`}>{c.severity}</span></td>
                  <td>
                    <select className="text-xs" value={c.status} onChange={(e) => update(c.id, { status: e.target.value })}>
                      <option value="open">open</option>
                      <option value="investigating">investigating</option>
                      <option value="resolved">resolved</option>
                      <option value="false_positive">false_positive</option>
                    </select>
                  </td>
                  <td className="text-xs max-w-xs">{c.recommended_action}</td>
                  <td className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FraudClusters;
