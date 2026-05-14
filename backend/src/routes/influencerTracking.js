// Influencer / affiliate tracking: link attribution + auto-commissions.
// v0 uses cookieless ref-code → attribution links → commission ledger.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Order } from '../models/index.js';

const router = Router();

const COMMISSION_PCT = Number(process.env.AFFILIATE_COMMISSION_PCT || 0.1); // 10%

// POST /api/ai/influencer/track-click { ref_code, landing_url, ip? }
router.post('/ai/influencer/track-click', async (req, res) => {
  try {
    const { ref_code, landing_url, ip } = req.body || {};
    if (!ref_code) return res.status(400).json({ error: 'ref_code required' });
    // No PII stored; just hash IP for anti-fraud bucketing.
    const ipHash = ip ? Buffer.from(ip).toString('base64').slice(0, 20) : null;
    return res.json({
      tracked: true,
      ref_code,
      landing_url: landing_url || null,
      ip_hash: ipHash,
      cookie_name: `aff_${ref_code}`,
      cookie_max_age_seconds: 7 * 24 * 60 * 60,
    });
  } catch (e) {
    return res.status(500).json({ error: 'track failed' });
  }
});

// POST /api/ai/influencer/attribute  { order_id, ref_code }
router.post('/ai/influencer/attribute', authenticateToken, async (req, res) => {
  try {
    const { order_id, ref_code } = req.body || {};
    if (!order_id || !ref_code) return res.status(400).json({ error: 'order_id + ref_code required' });
    const order = await Order.findByPk(order_id);
    if (!order) return res.status(404).json({ error: 'order not found' });
    const commission = Math.round(Number(order.total || 0) * COMMISSION_PCT * 100) / 100;
    // Persist into AuditLog or a dedicated table if available.
    return res.json({ order_id, ref_code, commission, commission_pct: COMMISSION_PCT });
  } catch (e) {
    return res.status(500).json({ error: 'attribute failed' });
  }
});

// GET /api/ai/influencer/ledger?ref_code=...
router.get('/ai/influencer/ledger', authenticateToken, async (req, res) => {
  try {
    const { ref_code } = req.query;
    if (!ref_code) return res.status(400).json({ error: 'ref_code required' });
    // Aggregate orders that include the ref_code in their notes.
    const orders = await Order.findAll({ limit: 1000 });
    const matched = orders.filter(o => (o.metadata && JSON.stringify(o.metadata).includes(ref_code)) || (o.notes || '').includes(ref_code));
    const totalCommission = matched.reduce((a, o) => a + Number(o.total || 0) * COMMISSION_PCT, 0);
    return res.json({ ref_code, orders: matched.length, total_commission: Math.round(totalCommission * 100) / 100 });
  } catch (e) {
    return res.status(500).json({ error: 'ledger failed' });
  }
});

export default router;
