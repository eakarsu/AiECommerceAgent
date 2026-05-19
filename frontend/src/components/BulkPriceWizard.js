import React, { useEffect, useState } from 'react';

// NON-VIZ 2: Multi-step bulk price update wizard
// Step 1: Select products → Step 2: Choose adjustment (% or fixed) →
// Step 3: Preview new prices → Step 4: Apply.
export default function BulkPriceWizard() {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [mode, setMode] = useState('percentage');
  const [value, setValue] = useState(10);
  const [preview, setPreview] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/product-grid?limit=50', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setProducts(d.items || []))
      .catch((e) => setError(e.message));
  }, []);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const goPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/custom-views/bulk-price-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productIds: Array.from(selected), mode, value: Number(value) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setPreview(d.preview || []);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/custom-views/bulk-price-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productIds: Array.from(selected), mode, value: Number(value) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setResult(d);
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelected(new Set());
    setPreview([]);
    setResult(null);
    setError(null);
  };

  const stepHeader = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {['Select', 'Adjust', 'Preview', 'Done'].map((label, idx) => {
        const n = idx + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div
            key={label}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: active ? '#2563eb' : done ? '#10b981' : '#e5e7eb',
              color: active || done ? '#fff' : '#374151',
            }}
          >
            {n}. {label}
          </div>
        );
      })}
    </div>
  );

  return (
    <div data-testid="bulk-price-wizard" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Bulk Price Update Wizard</h3>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 16, borderRadius: 8 }}>
        {stepHeader}
        {error && (
          <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 8 }}>Error: {error}</div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Select products to include ({selected.size} selected).
            </p>
            <div
              style={{
                maxHeight: 280,
                overflow: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
              }}
            >
              {products.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '6px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span style={{ flex: 1, fontSize: 13 }}>
                    <strong>{p.sku}</strong> &nbsp; {p.name}
                  </span>
                  <span style={{ fontSize: 13, color: '#374151' }}>${p.price.toFixed(2)}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                disabled={selected.size === 0}
                onClick={() => setStep(2)}
                style={{
                  padding: '8px 16px',
                  background: selected.size === 0 ? '#9ca3af' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Choose how to adjust prices.
            </p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <label style={{ fontSize: 14 }}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'percentage'}
                  onChange={() => setMode('percentage')}
                />{' '}
                Percentage (%)
              </label>
              <label style={{ fontSize: 14 }}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'fixed'}
                  onChange={() => setMode('fixed')}
                />{' '}
                Fixed amount ($)
              </label>
            </div>
            <label style={{ fontSize: 14 }}>
              Value:&nbsp;
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                step="0.01"
                style={{
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: 120,
                }}
              />
              <span style={{ marginLeft: 6, color: '#6b7280' }}>
                {mode === 'percentage' ? '%' : 'USD'}
              </span>
            </label>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={() => setStep(1)}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6 }}
              >
                ← Back
              </button>
              <button
                disabled={busy}
                onClick={goPreview}
                style={{
                  padding: '8px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {busy ? 'Loading...' : 'Preview →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Review proposed price changes.
            </p>
            <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Old</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>New</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}>{r.sku}</td>
                      <td style={{ padding: 8 }}>{r.name}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>${r.oldPrice.toFixed(2)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>${r.newPrice.toFixed(2)}</td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: 'right',
                          color: r.delta >= 0 ? '#15803d' : '#b91c1c',
                          fontWeight: 600,
                        }}
                      >
                        {r.delta >= 0 ? '+' : ''}
                        {r.delta.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setStep(2)}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6 }}
              >
                ← Back
              </button>
              <button
                disabled={busy}
                onClick={apply}
                style={{
                  padding: '8px 16px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {busy ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div>
            <p style={{ fontSize: 14 }}>
              Updated <strong>{result.updated}</strong> product
              {result.updated === 1 ? '' : 's'} ({result.mode}, {result.value}).
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
