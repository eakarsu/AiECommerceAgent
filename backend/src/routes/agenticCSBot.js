// Agentic CS bot: chat that can process refunds, explain policies, and
// resolve issues. Uses ConciergeChatSession-style persistence + LLM call.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import openRouterService from '../services/openrouter.js';
import { Customer, Order, AILog } from '../models/index.js';
import { parseAIJson } from '../utils/parseAIJson.js';

const router = Router();

// POST /api/ai/cs-bot/chat { customer_id, messages:[{role,content}], allow_actions? }
router.post('/ai/cs-bot/chat', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { customer_id, messages = [], allow_actions = false } = req.body || {};
    if (!customer_id || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'customer_id and messages[] required' });
    }
    const customer = await Customer.findByPk(customer_id);
    if (!customer) return res.status(404).json({ error: 'customer not found' });

    let recentOrders = [];
    try {
      recentOrders = await Order.findAll({ where: { customer_id }, order: [['createdAt', 'DESC']], limit: 5 });
    } catch {}

    const system = 'You are a customer-service agent for an e-commerce store. Reference order history and policies. Output JSON: {"reply":"...","intent":"refund|return|status|other","actions":[{"type":"refund|cancel|reship","order_id":"..."}]} . Only include actions when explicit consent or clear policy match.';
    const ctx = `Customer: ${customer.email}\nRecent orders: ${JSON.stringify(recentOrders.map(o => ({ id: o.id, total: o.total, status: o.status })))}\nConversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

    let parsed = { reply: 'I can help with refunds, returns, and order status.', intent: 'other', actions: [] };
    try {
      const raw = await openRouterService.complete(ctx, system);
      parsed = parseAIJson(raw) || { reply: raw, intent: 'other', actions: [] };
    } catch (e) {
      parsed.reply = `(LLM unavailable: ${e.message}). I can still help with FAQs.`;
    }

    const executed = [];
    if (allow_actions && Array.isArray(parsed.actions)) {
      for (const a of parsed.actions.slice(0, 3)) {
        if (a.type === 'cancel' && a.order_id) {
          try {
            const o = await Order.findByPk(a.order_id);
            if (o && o.customer_id === customer_id) { o.status = 'cancelled'; await o.save(); executed.push(a); }
          } catch {}
        }
      }
    }

    try {
      await AILog.create({ feature: 'cs_bot', input: JSON.stringify(messages).slice(0, 2000), output: JSON.stringify(parsed).slice(0, 2000) });
    } catch {}

    return res.json({ response: parsed, executed_actions: executed });
  } catch (e) {
    console.error('cs-bot error:', e);
    return res.status(500).json({ error: 'cs-bot failed' });
  }
});

export default router;
