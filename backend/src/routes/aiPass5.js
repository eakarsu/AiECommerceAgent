// Pass 5 backlog implementations:
//   1. /ai/visual-search        — NEEDS-PRODUCT-DECISION; in-memory embedding stub (no pgvector dep)
//   2. /api/integrations/marketplace-sync — NEEDS-CREDS; gates on SHOPIFY_ACCESS_TOKEN / AMAZON_SP_API_KEY
//   3. /api/affiliate/*         — TOO-RISKY (accounting); additive CREATE TABLE IF NOT EXISTS + simple CRUD
//
// Constraints respected:
//  - No npm install. No new heavy deps.
//  - Additive only. Existing endpoints untouched.
//  - 503 + missing:<ENV> when external creds are missing.
//
// PRODUCT-DECISION notes:
//  - Visual-search uses an in-memory deterministic hash-based "embedding" so the FE flow can be
//    validated without pgvector or a real CLIP model. Production should swap in OpenAI/Cohere
//    embeddings + pgvector. The result includes `stub: true` so callers know.
//  - Marketplace-sync is a stub that prepares a payload preview only — no live API calls.
//  - Affiliate tracker uses a single new table `affiliate_referrals` so existing schema is unaffected.

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { sequelize } from '../models/index.js';
import { Product } from '../models/index.js';

const router = Router();

// ---------- 1. /ai/visual-search ----------
// Simple deterministic embedding from any string (length 16). Stable for same input.
function pseudoEmbedding(text) {
  const s = String(text || '').toLowerCase();
  const dims = 16;
  const v = new Array(dims).fill(0);
  for (let i = 0; i < s.length; i++) {
    v[i % dims] += s.charCodeAt(i);
  }
  // Normalize
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map(x => x / norm);
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

router.post('/ai/visual-search', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { image_description, image_url, top_k } = req.body || {};
    const queryText = image_description || image_url || '';
    if (!queryText) {
      return res.status(400).json({ error: 'Provide image_description or image_url.' });
    }
    const k = Math.min(Math.max(parseInt(top_k, 10) || 10, 1), 50);
    const queryVec = pseudoEmbedding(queryText);

    // Pull a bounded set of products and rank in-memory.
    const products = await Product.findAll({ limit: 500 });
    const scored = products.map(p => {
      const corpus = [p.name, p.description, p.category, p.tags ? JSON.stringify(p.tags) : ''].filter(Boolean).join(' ');
      const v = pseudoEmbedding(corpus);
      return { id: p.id, name: p.name, category: p.category, price: p.price, score: cosine(queryVec, v) };
    });
    scored.sort((a, b) => b.score - a.score);

    res.json({
      query: queryText,
      stub: true,
      note: 'Visual-search using in-memory deterministic embedding stub (no pgvector / CLIP). See aiPass5.js for swap-in points.',
      results: scored.slice(0, k),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- 2. /api/integrations/marketplace-sync ----------
router.post('/integrations/marketplace-sync', authenticateToken, async (req, res) => {
  try {
    const { marketplace, direction } = req.body || {};
    const dir = direction === 'pull' ? 'pull' : 'push';
    const mp = (marketplace || '').toLowerCase();

    if (!['shopify', 'amazon', 'ebay'].includes(mp)) {
      return res.status(400).json({ error: 'marketplace must be one of: shopify | amazon | ebay' });
    }

    // Per-marketplace env gating
    const envMap = {
      shopify: 'SHOPIFY_ACCESS_TOKEN',
      amazon: 'AMAZON_SP_API_KEY',
      ebay: 'EBAY_OAUTH_TOKEN',
    };
    const envVar = envMap[mp];
    if (!process.env[envVar]) {
      return res.status(503).json({ error: `${mp} integration not configured.`, missing: envVar });
    }

    // Stub: do not call the live marketplace API. Return prepared payload preview.
    const payload = {
      marketplace: mp,
      direction: dir,
      preparedAt: new Date().toISOString(),
      stub: true,
      note: `Live ${mp} ${dir} would be issued with ${envVar}. Stub returns prepared payload only.`,
    };
    res.json(payload);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- 3. /api/affiliate/* (TOO-RISKY: additive only) ----------
// Bootstrap table on first request. Idempotent.
let affiliateTableInitialized = false;
async function ensureAffiliateTable() {
  if (affiliateTableInitialized) return;
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS affiliate_referrals (
        id SERIAL PRIMARY KEY,
        affiliate_code VARCHAR(120) NOT NULL,
        referrer_user_id INTEGER,
        referred_email VARCHAR(255),
        order_id INTEGER,
        amount_cents INTEGER,
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    affiliateTableInitialized = true;
  } catch (e) {
    console.warn('affiliate_referrals create failed:', e.message);
  }
}

router.post('/affiliate/referrals', authenticateToken, async (req, res) => {
  try {
    await ensureAffiliateTable();
    const { affiliate_code, referred_email, order_id, amount_cents } = req.body || {};
    if (!affiliate_code) return res.status(400).json({ error: 'affiliate_code required' });
    const [rows] = await sequelize.query(
      `INSERT INTO affiliate_referrals (affiliate_code, referrer_user_id, referred_email, order_id, amount_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      { bind: [affiliate_code, req.user?.id || null, referred_email || null, order_id || null, amount_cents || null] }
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/affiliate/referrals', authenticateToken, async (req, res) => {
  try {
    await ensureAffiliateTable();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const [rows] = await sequelize.query(
      `SELECT * FROM affiliate_referrals ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      { bind: [limit, offset] }
    );
    res.json({ data: rows, pagination: { limit, offset } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/affiliate/summary', authenticateToken, async (req, res) => {
  try {
    await ensureAffiliateTable();
    const [rows] = await sequelize.query(`
      SELECT
        COUNT(*)::int AS total_referrals,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
        COALESCE(SUM(amount_cents), 0)::int AS total_amount_cents
      FROM affiliate_referrals
    `);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
