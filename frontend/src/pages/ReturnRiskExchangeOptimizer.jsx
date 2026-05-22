import { useEffect, useState } from 'react';

export default function ReturnRiskExchangeOptimizer() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/return-risk-exchange-optimizer').then(r => r.json()).then(setData).catch(() => setData(null)); }, []);
  return <div className="p-6"><h1 className="text-2xl font-bold mb-2">Return Risk Exchange Optimizer</h1><p className="text-gray-600 mb-6">Reduce refunds by routing high-risk orders to exchange and save offers.</p><div className="grid grid-cols-4 gap-4 mb-6">{data && Object.entries(data.summary).map(([k,v]) => <div key={k} className="bg-white border rounded-lg p-4"><div className="text-xs uppercase text-gray-500">{k.replaceAll('_',' ')}</div><div className="text-2xl font-bold">{v}</div></div>)}</div><div className="bg-white border rounded-lg">{(data?.orders || []).map(o => <div key={o.order} className="p-4 border-b"><strong>{o.order}</strong><div>{o.product} - {o.risk} - {o.action}</div></div>)}</div></div>;
}
