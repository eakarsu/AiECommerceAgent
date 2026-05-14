// Competitive intelligence: monitor competitor prices, auto-adjust own.
// v0 stores fetched competitor prices and emits price-update suggestions.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { Competitor, Product, Pricing } from '../models/index.js';

const router = Router();

// POST /api/ai/competitive-intel/snapshot { competitor_id, samples:[{sku, name, price, url}] }
router.post('/ai/competitive-intel/snapshot', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { competitor_id, samples = [] } = req.body || {};
    if (!competitor_id || !Array.isArray(samples) || !samples.length) {
      return res.status(400).json({ error: 'competitor_id and samples[] required' });
    }
    const competitor = await Competitor.findByPk(competitor_id);
    if (!competitor) return res.status(404).json({ error: 'competitor not found' });

    const suggestions = [];
    for (const s of samples.slice(0, 200)) {
      if (!s.sku || s.price == null) continue;
      const mine = await Product.findOne({ where: { sku: s.sku } });
      if (!mine) continue;
      const myPrice = Number(mine.price || 0);
      const cmp = Number(s.price);
      const diff = ((cmp - myPrice) / Math.max(myPrice, 0.01)) * 100;
      let action = 'hold';
      let newPrice = myPrice;
      if (diff > 8) { action = 'raise'; newPrice = Math.min(cmp - 0.01, myPrice * 1.05); }
      else if (diff < -8) { action = 'lower'; newPrice = Math.max(cmp - 0.01, myPrice * 0.95); }
      suggestions.push({ sku: s.sku, my_price: myPrice, competitor_price: cmp, diff_pct: Math.round(diff * 100) / 100, action, suggested_price: Math.round(newPrice * 100) / 100, source_url: s.url });
    }

    try {
      // Persist as Pricing suggestions for review.
      for (const s of suggestions) {
        if (s.action !== 'hold') {
          await Pricing.create({ sku: s.sku, suggested_price: s.suggested_price, source: 'competitive_intel', notes: JSON.stringify(s) });
        }
      }
    } catch {}

    return res.json({ competitor_id, sample_count: samples.length, suggestions: suggestions.slice(0, 100) });
  } catch (e) {
    console.error('competitive-intel error:', e);
    return res.status(500).json({ error: 'snapshot failed' });
  }
});

// GET /api/ai/competitive-intel/recent — return last N suggestions
router.get('/ai/competitive-intel/recent', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const rows = await Pricing.findAll({ where: { source: 'competitive_intel' }, order: [['createdAt', 'DESC']], limit });
    return res.json({ count: rows.length, suggestions: rows });
  } catch (e) {
    return res.status(500).json({ error: 'lookup failed' });
  }
});

export default router;
