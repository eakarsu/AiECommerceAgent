import React from 'react';
import ProductGrid from '../components/ProductGrid.js';
import PurchaseFunnel from '../components/PurchaseFunnel.js';
import ProductCSVExport from '../components/ProductCSVExport.js';
import BulkPriceWizard from '../components/BulkPriceWizard.js';

// Aggregator page mounted at /store-views that renders all four
// custom views (2 viz + 2 non-viz) for the AI E-commerce Agent.
export default function CustomViewsPage() {
  return (
    <div data-testid="custom-views-page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Store Views</h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Product grid, purchase funnel, CSV export and bulk price update wizard
          for the AI E-commerce Agent.
        </p>
      </header>
      <section>
        <ProductGrid />
      </section>
      <section>
        <PurchaseFunnel />
      </section>
      <section>
        <ProductCSVExport />
      </section>
      <section>
        <BulkPriceWizard />
      </section>
    </div>
  );
}
