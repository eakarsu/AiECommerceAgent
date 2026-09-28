# AI E-commerce Agent

AI-assisted dropshipping validation, acquisition and post-sale operations built
with React, Express and PostgreSQL.

## Complete operating flow

1. Capture TikTok and Instagram demand evidence.
2. Score product demand, evergreen fit, supplier reliability and margin.
3. Compare suppliers and calculate landed cost, break-even CPA and profit.
4. Generate evidence-grounded UGC briefs through OpenRouter.
5. Execute organic and paid validation plans with CPA, ROAS and revenue outcomes.
6. Import approved products through the Shopify connector.
7. Capture paid store orders and route them through inventory and risk controls.
8. Create and submit supplier purchase orders without falsely reporting provider success.
9. Reconcile supplier price and stock drift, including listing-pause controls.
10. Synchronize tracking and propagate shipment exceptions to order state.
11. Manage returns, chargebacks, carrier claims and supplier recovery.
12. Retain an append-only operations timeline for human review.

The application includes meaningful local demo records for every workflow. Live
provider actions require the corresponding credentials documented in
`CONNECTORS.md`; manual governed workflows remain available when a connector is
not configured.

## Run

Configure the ignored `.env`, then run:

```bash
./start.sh
```

The launcher applies only idempotent schema preparation. It does not install
packages or terminate processes already using the configured ports.

## Verify

```bash
cd backend
npm run test:dropship
node --test governance/*.test.cjs

cd ../frontend
npm run build
```

Secrets, `.env`, dependencies and generated build directories are excluded by
`.gitignore`.
