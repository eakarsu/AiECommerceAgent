// Bundle auto-generator: frequently-bought-together → published bundles.
// v0 mines Order line items for co-occurrence and proposes bundles.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { Order, Product } from '../models/index.js';

const router = Router();

// POST /api/ai/bundle-generator/mine { min_support? = 5, top_k? = 10 }
router.post('/ai/bundle-generator/mine', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const minSupport = Math.max(parseInt(req.body?.min_support) || 5, 2);
    const topK = Math.min(parseInt(req.body?.top_k) || 10, 25);

    // Fetch recent orders with line items in a JSON column.
    const orders = await Order.findAll({ limit: 2000, order: [['createdAt', 'DESC']] });
    const pairs = new Map();
    const productHits = new Map();
    for (const o of orders) {
      let items;
      try {
        items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items) : []);
      } catch { items = []; }
      const ids = (items || []).map(i => i.product_id || i.id).filter(Boolean);
      const uniq = Array.from(new Set(ids));
      for (const id of uniq) productHits.set(id, (productHits.get(id) || 0) + 1);
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          const key = [uniq[i], uniq[j]].sort().join('|');
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
      }
    }

    const candidates = [];
    for (const [key, count] of pairs.entries()) {
      if (count < minSupport) continue;
      const [a, b] = key.split('|');
      candidates.push({ a, b, count, lift: count / (productHits.get(a) || 1) });
    }
    candidates.sort((x, y) => y.count - x.count);

    const top = candidates.slice(0, topK);
    // Decorate with product names
    for (const t of top) {
      try {
        const pa = await Product.findByPk(t.a);
        const pb = await Product.findByPk(t.b);
        t.name_a = pa?.name;
        t.name_b = pb?.name;
        t.bundle_price = Math.round(((Number(pa?.price || 0) + Number(pb?.price || 0)) * 0.9) * 100) / 100;
      } catch {}
    }

    return res.json({ analysed_orders: orders.length, candidate_count: candidates.length, top_bundles: top });
  } catch (e) {
    console.error('bundle-generator error:', e);
    return res.status(500).json({ error: 'mine failed' });
  }
});

export default router;
