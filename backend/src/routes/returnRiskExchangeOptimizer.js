import express from 'express';
const router = express.Router();

router.get('/return-risk-exchange-optimizer', (req, res) => res.json({
  summary: { orders_scored: 214, high_return_risk: 18, exchange_saves: 11, margin_saved: 7400 },
  orders: [
    { order: 'ORD-4410', product: 'Trail jacket', risk: 'high', action: 'offer size exchange before refund' },
    { order: 'ORD-4422', product: 'Running shoes', risk: 'medium', action: 'send fit guidance' },
    { order: 'ORD-4478', product: 'Desk lamp', risk: 'low', action: 'standard follow-up' },
  ],
}));

export default router;
