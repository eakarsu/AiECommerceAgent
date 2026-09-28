# Growth OS connector contract

The Growth OS keeps secrets in the ignored `.env` file and stores only job status,
normalized business results, and external references in PostgreSQL. A connector is
never reported as successful until its provider returns a successful response.

## Configuration

Copy only the integrations you use from `.env.example` into `.env`:

- `SHOPIFY_SHOP_DOMAIN` and `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SOCIAL_EVIDENCE_API_URL` and `SOCIAL_EVIDENCE_API_TOKEN`
- `SUPPLIER_CATALOG_API_URL` and `SUPPLIER_CATALOG_API_TOKEN`
- `UGC_VIDEO_API_URL` and `UGC_VIDEO_API_TOKEN`
- `SOCIAL_PUBLISHING_API_URL` and `SOCIAL_PUBLISHING_API_TOKEN`
- `META_ADS_CONNECTOR_URL` and `META_ADS_ACCESS_TOKEN`
- `TIKTOK_ADS_CONNECTOR_URL` and `TIKTOK_ADS_ACCESS_TOKEN`
- `SUPPLIER_ORDER_API_URL` and `SUPPLIER_ORDER_API_TOKEN`
- `DROPSHIP_CATALOG_SYNC_API_URL` and `DROPSHIP_CATALOG_SYNC_API_TOKEN`
- `DROPSHIP_TRACKING_API_URL` and `DROPSHIP_TRACKING_API_TOKEN`

Shopify uses the Admin GraphQL API directly. The other URLs must accept an
authenticated JSON `POST` containing `operation`, `opportunity`, and `options`.

## Normalized response shapes

### Social evidence

Return `evidence` (or `items`) containing objects with:

- `platform`, `sourceUrl`, `creatorHandle`, and `publishedAt`
- `views`, `likes`, `comments`, and `purchaseIntentComments`
- optional `evidenceExcerpt`

The application upserts source evidence and recalculates demand and readiness.

### Supplier catalog

Return `suppliers` (or `items`) containing:

- `name`, `marketplace`, `productUrl`, `unitCost`, and `shippingCost`
- `deliveryDays`, `rating`, `orderCount`, `onTimeRate`, and `disputeRate`
- `stockStatus`: `available`, `limited`, or `unavailable`

The application calculates the reliability score and updates the comparison table.

### UGC video

Return `creativeId`, `renderUrl`, and optionally `jobRef`. The corresponding
creative becomes ready and retains its rendered asset URL and provider reference.

### Social publishing

Return a provider `jobRef`, `id`, or `externalReference` after the approved content
is scheduled. The provider remains responsible for platform-specific authorization.

### Advertising outcomes

Return `experiments` (or `items`) containing:

- `experimentName`, `dailyBudget`, `spend`, `impressions`, and `clicks`
- `sessions`, `addToCarts`, `purchases`, `revenue`, and `status`
- optional `startedAt` and `endedAt`

The application upserts the experiment and calculates CPA, ROAS, and conversion.

### Post-sale supplier ordering

The supplier-order endpoint receives `operation: submit_purchase_order` and a
normalized purchase order. It must return `externalReference`, `orderId`, or `id`.
The local purchase order is not marked submitted until that reference is returned.

### Catalog reconciliation

The catalog endpoint receives `operation: reconcile_catalog` and the current
catalog control record. Return `supplierInventory`, `supplierUnitCost`, and an
optional `reference` and `priceDriftLimit`. The application recalculates stock,
price-drift and listing-pause controls before persisting the response.

### Shipment tracking

The tracking endpoint receives `operation: track_shipment`. Return `status`,
`lastEvent`, and optional `carrier`, `trackingNumber`, and `reference`. Invalid or
out-of-sequence shipment transitions are rejected and retained as failures.

## Operational visibility

Use **Dropship Growth OS → Live Connectors** to see configuration readiness, run
an integration for the selected product, and inspect completed, failed, or
configuration-required jobs. Provider secrets and full provider responses are not
written to job history.
