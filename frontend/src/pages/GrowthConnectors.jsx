import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../services/api';

const statusStyle = {
  completed: 'badge-success', failed: 'badge-danger', configuration_required: 'badge-warning', running: 'badge-info', queued: 'badge-gray',
};

export default function GrowthConnectors() {
  const [connectors, setConnectors] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  async function load() {
    const [statusRows, products, jobRows] = await Promise.all([
      apiGet('/growth/connectors/status'), apiGet('/growth/opportunities'), apiGet('/growth/connectors/jobs'),
    ]);
    setConnectors(statusRows); setOpportunities(products); setJobs(jobRows);
    if (!selectedId && products.length) setSelectedId(String(products[0].id));
  }

  useEffect(() => { load().catch(error => setNotice({ type: 'error', message: error.message })); }, []);

  async function run(connector) {
    setBusy(connector.key); setNotice(null);
    try {
      const result = await apiPost(`/growth/connectors/${connector.key}/run`, { opportunityId: selectedId });
      setNotice({ type: 'success', message: `${connector.label} completed. Job ${result.job.id} retained in connector history.` });
    } catch (error) {
      const missing = error.data?.missing?.join(', ');
      setNotice({ type: 'error', message: missing ? `${connector.label} needs ${missing} in the ignored .env file.` : error.message });
    } finally { setBusy(''); await load(); }
  }

  const configuredCount = connectors.filter(item => item.configured).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-cyan-950 to-indigo-950 p-7 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Growth OS · Integration control plane</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div><h1 className="text-3xl font-bold">Live Commerce Connectors</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">Execute product imports, evidence discovery, supplier searches, video rendering, organic publishing, and advertising outcome synchronization. Every attempt is retained with an explicit success, failure, or configuration-required state.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center"><p className="text-3xl font-bold">{configuredCount}/{connectors.length}</p><p className="text-xs uppercase tracking-wide text-cyan-200">Configured</p></div>
        </div>
      </header>

      {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Product case used by connector actions</label>
        <select className="input mt-2 max-w-3xl" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {opportunities.map(item => <option key={item.id} value={item.id}>{item.name} · {item.readiness_score}/100 · {item.stage.replaceAll('_',' ')}</option>)}
        </select>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {connectors.map(connector => (
          <article key={connector.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{connector.operation.replaceAll('_',' ')}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{connector.label}</h2></div><span className={`badge ${connector.configured ? 'badge-success' : 'badge-warning'}`}>{connector.configured ? 'Ready' : 'Configuration required'}</span></div>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{connector.purpose}</p>
            {!connector.configured && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Add these names to the ignored `.env`:</p><div className="mt-2 flex flex-wrap gap-1.5">{connector.missing.map(name => <code key={name} className="rounded bg-white px-2 py-1 text-[11px] text-amber-900">{name}</code>)}</div></div>}
            <button onClick={() => run(connector)} disabled={!selectedId || busy === connector.key} className={`mt-4 w-full justify-center btn ${connector.configured ? 'btn-primary' : 'btn-secondary'}`}>{busy === connector.key ? 'Executing…' : connector.configured ? 'Run Connector' : 'Record Configuration Check'}</button>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div><h2 className="text-xl font-bold text-slate-900">Connector job history</h2><p className="mt-1 text-sm text-slate-500">No connector action reports success until the external provider confirms it.</p></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Job</th><th className="p-3">Product</th><th className="p-3">Connector</th><th className="p-3">Operation</th><th className="p-3">Status</th><th className="p-3">Reference / reason</th><th className="p-3">Created</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id} className="border-b border-slate-100"><td className="p-3 font-mono text-xs">#{job.id}</td><td className="p-3 font-semibold text-slate-900">{job.product_name || 'Portfolio'}</td><td className="p-3">{job.connector.replaceAll('_',' ')}</td><td className="p-3">{job.operation.replaceAll('_',' ')}</td><td className="p-3"><span className={`badge ${statusStyle[job.status] || 'badge-gray'}`}>{job.status.replaceAll('_',' ')}</span></td><td className="max-w-md p-3 text-xs text-slate-500">{job.external_reference || job.error_message || 'Completed without an external reference'}</td><td className="p-3 text-xs text-slate-500">{new Date(job.created_at).toLocaleString()}</td></tr>)}</tbody></table>{!jobs.length && <p className="p-8 text-center text-sm text-slate-500">No connector has been executed yet.</p>}</div>
      </section>
    </div>
  );
}
