// Subscription prediction: flag repeat buyers for subscription offers.
// v0 uses simple buy-frequency rules; later swap for ML.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Customer, Order } from '../models/index.js';

const router = Router();

// GET /api/ai/subscription-predictor/candidates?threshold=3
router.get('/ai/subscription-predictor/candidates', authenticateToken, async (req, res) => {
  try {
    const threshold = Math.max(parseInt(req.query.threshold) || 3, 2);
    const customers = await Customer.findAll({ limit: 2000 });
    const candidates = [];
    for (const c of customers) {
      const orders = await Order.findAll({ where: { customer_id: c.id }, order: [['createdAt', 'ASC']] });
      if (orders.length < threshold) continue;
      // Compute inter-order interval mean (days)
      const dates = orders.map(o => new Date(o.createdAt).getTime());
      const intervals = [];
      for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / 86400000);
      const meanDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - meanDays, 2), 0) / intervals.length;
      const stability = 1 / (1 + Math.sqrt(variance));
      candidates.push({
        customer_id: c.id,
        email: c.email,
        order_count: orders.length,
        mean_interval_days: Math.round(meanDays),
        stability_score: Math.round(stability * 100) / 100,
        suggested_frequency: meanDays < 21 ? 'biweekly' : meanDays < 45 ? 'monthly' : 'quarterly',
      });
    }
    candidates.sort((a, b) => b.stability_score - a.stability_score);
    return res.json({ count: candidates.length, threshold, candidates: candidates.slice(0, 100) });
  } catch (e) {
    console.error('subscription-predictor error:', e);
    return res.status(500).json({ error: 'analysis failed' });
  }
});

export default router;
