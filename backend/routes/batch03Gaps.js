// ============================================================
// === Batch 03 Gaps & Frontend Mounts ===
// Auto-generated Gap-feature endpoints (lean v0).
// TODO: configure credentials (set OPENROUTER_API_KEY).
// ============================================================
const express = require('express');
const router = express.Router();

let _gfReady = false;
async function ensureGapTable(pool) {
  if (_gfReady || !pool) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS gap_features (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(120) NOT NULL,
      user_id INT,
      input JSONB,
      output JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    _gfReady = true;
  } catch (_) { /* tolerant of missing DB */ }
}

async function callAI(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, status: 503, error: 'AI service unavailable. Set OPENROUTER_API_KEY (TODO: configure credentials).' };
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
      }),
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { ok: r.ok, status: r.status, text, raw: data };
  } catch (e) {
    return { ok: false, status: 500, error: String(e.message || e) };
  }
}

function buildHandler(slug, label, hint) {
  return async (req, res) => {
    const body = req.body || {};
    const userId = req.user?.id || null;
    const prompt = `Feature: ${label}\nContext hint: ${hint}\nUser input:\n${JSON.stringify(body, null, 2)}\n\nProduce a concise, actionable response.`;
    const ai = await callAI(prompt);
    try {
      const pool = req.app.locals.pool || req.app.get('pool') || null;
      if (pool) {
        await ensureGapTable(pool);
        await pool.query('INSERT INTO gap_features(slug, user_id, input, output) VALUES ($1,$2,$3,$4)',
          [slug, userId, body, { text: ai.text || ai.error || null }]);
      }
    } catch (_) { /* tolerant */ }
    if (!ai.ok) return res.status(ai.status || 500).json({ error: ai.error || ai.text || `Upstream error (${ai.status})`, slug });
    res.json({ slug, label, result: ai.text });
  };
}

router.post('/gap-no-visual-search-image-to-product', buildHandler('gap-ai-no-visual-search-image-to-product', 'No visual search (image-to-product)', 'No visual search (image-to-product)'));
router.post('/gap-no-agentic-customer-service-chat-refund-policy-handling', buildHandler('gap-ai-no-agentic-customer-service-chat-refund-policy-handling', 'No agentic customer-service chat (refund/policy handling)', 'No agentic customer-service chat (refund/policy handling)'));
router.post('/gap-no-bundle-auto-generator-from-co-purchase-data', buildHandler('gap-ai-no-bundle-auto-generator-from-co-purchase-data', 'No bundle auto-generator from co-purchase data', 'No bundle auto-generator from co-purchase data'));
router.post('/gap-no-subscription-conversion-predictor', buildHandler('gap-ai-no-subscription-conversion-predictor', 'No subscription-conversion predictor', 'No subscription-conversion predictor'));
router.post('/gap-no-multi-currency-support-observed', buildHandler('gap-non-no-multi-currency-support-observed', 'No multi-currency support observed', 'No multi-currency support observed'));
router.post('/gap-limited-marketplace-connectors-no-amazon-ebay-shopify-sync', buildHandler('gap-non-limited-marketplace-connectors-no-amazon-ebay-shopify-sync', 'Limited marketplace connectors (no Amazon/eBay/Shopify sync)', 'Limited marketplace connectors (no Amazon/eBay/Shopify sync)'));
router.post('/gap-no-affiliate-influencer-tracking-module', buildHandler('gap-non-no-affiliate-influencer-tracking-module', 'No affiliate/influencer tracking module', 'No affiliate/influencer tracking module'));
router.post('/gap-no-native-mobile-app-api-surface', buildHandler('gap-non-no-native-mobile-app-api-surface', 'No native mobile-app API surface', 'No native mobile-app API surface'));

module.exports = router;
