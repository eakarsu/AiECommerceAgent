import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../services/api';

export default function AffiliateReferrals() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await apiGet('/affiliate/referrals', { limit: 50 });
      setItems(list.data || []);
      const sum = await apiGet('/affiliate/summary');
      setSummary(sum);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/affiliate/referrals', {
        affiliate_code: code,
        referred_email: email || null,
        order_id: orderId ? parseInt(orderId, 10) : null,
        amount_cents: amount ? parseInt(amount, 10) : null,
      });
      setCode(''); setEmail(''); setOrderId(''); setAmount('');
      await load();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Affiliate Referrals</h1>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="card p-4"><div className="text-xs text-gray-500">Total</div><div className="text-2xl font-bold">{summary.total_referrals}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold">{summary.pending}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Paid</div><div className="text-2xl font-bold">{summary.paid}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Total amount</div><div className="text-2xl font-bold">{(summary.total_amount_cents || 0) / 100}</div></div>
        </div>
      )}

      <div className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Record a referral</h2>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Affiliate code</label>
            <input className="input" value={code} onChange={e => setCode(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Referred email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Order ID</label>
            <input className="input" type="number" value={orderId} onChange={e => setOrderId(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount (cents)</label>
            <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn btn-primary">Record</button>
          </div>
        </form>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-3">Recent referrals</h2>
        {loading ? <div>Loading...</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>ID</th><th>Code</th><th>Email</th><th>Order</th><th>Amount (cents)</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td>{it.id}</td><td>{it.affiliate_code}</td><td>{it.referred_email || '-'}</td>
                  <td>{it.order_id || '-'}</td><td>{it.amount_cents || '-'}</td><td>{it.status}</td>
                  <td>{it.created_at && new Date(it.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
