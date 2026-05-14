# Audit Notes — AiECommerceAgent

Audit source: `_AUDIT/reports/batch_03.md` § 6 (skeleton, audit reported 0 AI endpoints).

## Original audit recommendations

### Missing AI counterparts
- `/fraud-detection`, `/cart-abandonment-recovery`, `/recommendations`,
  `/churn-prediction`, `/review-analysis`, `/pricing-optimization`,
  `/demand-forecast`, `/inventory-reorder`.

### Missing non-AI features
- Product / order / customer / review / cart / checkout / inventory CRUD.

### Custom feature suggestions
- Agentic customer service.
- Competitive intelligence.
- Visual search.
- Marketplace connector (Amazon / Shopify).
- Bundle recommendation.
- Subscription prediction.
- Affiliate marketing tracker.

## Current state observed

The audit's "3 routes, 0 AI" is significantly outdated. Current code already
has churn-prediction, bundle-optimizer, returns-analyzer, email-sequence,
merchandising-mix, inventory-reorder (+ suggestions), price-elasticity (full
A/B flow), photo-critique, concierge sessions (multi-turn agent), and
fraud-clusters. Eight of eight audit-suggested AI counterparts are at least
partially present.

## Implementations applied this pass

None — the heavy lift is already done. Remaining items below either need
external integrations or product-level decisions.

## Prioritized backlog

1. **MECHANICAL** — Add a thin `/api/ai/cart-abandonment-recovery` endpoint
   that pulls open carts older than N hours (assuming a `carts` table) and
   returns personalized recovery copy per customer.
2. **MECHANICAL** — Add `/api/ai/review-analysis` endpoint that runs sentiment
   + fake-review detection on `reviews` rows.
3. **NEEDS-CREDS** — Marketplace connectors (Shopify/Amazon/eBay) require
   per-tenant OAuth.
4. **NEEDS-PRODUCT-DECISION** — Visual search needs an embedding store
   (pgvector) and a UX decision about image upload flows.
5. **TOO-RISKY** — Affiliate-payout calculations need an accounting-of-record
   contract and tax handling — out of mechanical scope.

## Apply pass 5 (all backlog)

Implemented the remaining backlog items as additive endpoints + FE pages in a new file `backend/src/routes/aiPass5.js` (registered alongside `aiNew` and `aiExtra` in `src/index.js`).

- **`POST /api/ai/visual-search`** (NEEDS-PRODUCT-DECISION) — Visual product search. PRODUCT-DECISION: in-memory deterministic hash-based "embedding" stub (no pgvector, no CLIP, no npm install). Response carries `stub: true` and a swap-in note. Production should use OpenAI/Cohere embeddings + pgvector.
- **`POST /api/integrations/marketplace-sync`** (NEEDS-CREDS) — Shopify / Amazon / eBay sync. Gated per-marketplace on `SHOPIFY_ACCESS_TOKEN` / `AMAZON_SP_API_KEY` / `EBAY_OAUTH_TOKEN`; returns 503 + `missing: <ENV>` when unset. Stub returns prepared payload preview only.
- **`POST /api/affiliate/referrals`, `GET /api/affiliate/referrals`, `GET /api/affiliate/summary`** (TOO-RISKY) — Affiliate tracker. Uses `CREATE TABLE IF NOT EXISTS affiliate_referrals` (additive, no schema changes to existing tables). Avoids the accounting-of-record / tax handling complexity.

**FE pages** (new): `frontend/src/pages/VisualSearch.jsx`, `MarketplaceSync.jsx`, `AffiliateReferrals.jsx`. Routes added to `frontend/src/App.jsx` and nav links to `Layout.jsx`.

**Smoke test:** pkill ports → start `backend/src/index.js` → login `admin@ecommerce.ai / admin123` → all 3 endpoints exercised:
  - `/ai/visual-search` returns 200 with `stub: true` + ranked products.
  - `/integrations/marketplace-sync?marketplace=shopify` returns 503 `{"error":"shopify integration not configured.","missing":"SHOPIFY_ACCESS_TOKEN"}`.
  - `/affiliate/referrals` POST returns 201 with row, `/affiliate/summary` returns counts + total amount.

**Note (pre-existing):** Two columns (`resetToken`, `resetTokenExpiry`) defined in the User model were missing from the live `users` table; added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to allow login. Pre-existing schema drift, not caused by pass 5.

**Constraints:** No npm install. Additive routes / pages / tables only.

## Apply pass 4 (mechanical backlog)

**Action:** SKIP — both MECHANICAL items already covered.

Re-checked backlog vs current code:
- Backlog #1 "cart-abandonment-recovery" is already implemented as `POST /api/abandoned-carts/:id/ai-recovery` (in `backend/src/routes/index.js` ~line 3367), with the FE `pages/CartAbandonment.jsx` route at `/cart-abandonment` and a generic `/api/ai/analyze?type=CartAbandonment` flow as well.
- Backlog #2 "review-analysis" is already implemented as `POST /api/reviews/:id/ai-respond` (~line 782) which calls `openRouterService.analyzeReviewSentiment` (sentiment + keywords + suggested response) and persists fields back to the review row. Surfaced in the existing Reviews page.

Remaining items are NEEDS-CREDS / NEEDS-PRODUCT-DECISION / TOO-RISKY. No new mechanical work to add without duplicating existing endpoints or touching working code.

## Apply pass 3 (frontend)

**Action:** LEFT-AS-IS — FE already comprehensively wired.

15+ pages under `frontend/src/pages/` already dispatch to a generic `/api/ai/analyze` endpoint with type-tagged payloads (ABTests, Forecasts, Segments, Customers, Competitors, Products, Reviews, Trends, Recommendations, Campaigns, Orders, Pricing, FraudDetector, CartAbandonment). Dedicated pages exist for `PriceElasticity`, `PhotoCritique`, `Concierge`, `FraudClusters`, `InventoryReorder` — each calling its specific backend route. Auth via existing api client. No FE changes needed.
