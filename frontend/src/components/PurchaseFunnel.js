import React, { useEffect, useState } from 'react';
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// VIZ 2: Vertical funnel chart for view → add-to-cart → checkout → purchase.
// Data source: GET /api/custom-views/purchase-funnel
export default function PurchaseFunnel() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/purchase-funnel', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setStages(d.stages || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading purchase funnel...</div>;
  if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {error}</div>;

  const data = stages.map((s) => ({ name: s.stage, value: s.value, fill: s.fill }));

  return (
    <div data-testid="purchase-funnel" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Purchase Funnel</h3>
      <div style={{ width: '100%', height: 360, background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb' }}>
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={data} isAnimationActive orientation="vertical">
              <LabelList position="right" fill="#111827" stroke="none" dataKey="name" />
              <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {stages.map((s) => (
          <div
            key={s.stage}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              fontSize: 13,
            }}
          >
            <span style={{ display: 'inline-block', width: 10, height: 10, background: s.fill, borderRadius: 2, marginRight: 8 }} />
            <strong>{s.stage}:</strong> {s.value.toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
}
