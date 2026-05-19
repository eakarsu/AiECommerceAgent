// AI extra features (5 NEW custom features from audit):
//   1. Predictive inventory reorder agent
//   2. Real-time price-elasticity tester (live A/B)
//   3. Visual product-photo critique
//   4. Conversational shopping concierge with cart context + tool calls
//   5. Fraud-cluster detector (graph-based cross-order analysis)
//
// Plus password reset routes (forgot/reset/change).

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import openRouterService from '../services/openrouter.js';
import { parseAIJson } from '../utils/parseAIJson.js';
import {
  User,
  Product,
  Customer,
  Order,
  Inventory,
  FraudAlert,
  FraudCluster,
  InventoryReorderSuggestion,
  PriceElasticityTest,
  ProductPhotoCritique,
  ConciergeChatSession,
  ConciergeChatMessage,
  AILog,
} from '../models/index.js';

const router = Router();
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

async function persistAILog({ endpoint, user_id, input, ai_results, raw_response, latency_ms, status }) {
  try {
    return await AILog.create({
      endpoint,
      user_id: user_id || null,
      input,
      ai_results,
      raw_response: typeof raw_response === 'string' ? raw_response.slice(0, 8000) : null,
      model: MODEL,
      latency_ms,
      status: status || (ai_results ? 'success' : 'parse_failed'),
    });
  } catch (e) {
    console.warn('AILog persist failed:', e.message);
    return null;
  }
}

// ============================================
// PASSWORD RESET ROUTES
// ============================================

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.json({ message: 'If an account exists, a reset token was generated.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.update({ resetToken: token, resetTokenExpiry: expiry });
    res.json({
      message: 'If an account exists, a reset token was generated.',
      reset_token: token,
      expires_at: expiry,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password required' });
    if (String(new_password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await User.findOne({ where: { resetToken: token, resetTokenExpiry: { [Op.gt]: new Date() } } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    const hashed = await bcrypt.hash(new_password, 10);
    await user.update({ password: hashed, resetToken: null, resetTokenExpiry: null });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required' });
    if (String(new_password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(current_password, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(new_password, 10);
    await user.update({ password: hashed });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 1. PREDICTIVE INVENTORY REORDER AGENT
// ============================================
router.post('/ai/inventory-reorder', authenticateToken, aiRateLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const { productId, lead_time_days } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Recent orders containing this product (proxy for sales velocity)
    const orders = await Order.findAll({
      where: { createdAt: { [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      limit: 500,
      order: [['createdAt', 'DESC']],
    });

    // Compute velocity per day (estimate via order count / 90)
    const dailyVelocity = orders.length / 90;
    const inventory = await Inventory.findOne({ where: { productId } }).catch(() => null);
    const stock = inventory?.quantity ?? product.stock ?? 0;
    const leadTime = lead_time_days || 14;

    const messages = [
      {
        role: 'system',
        content: 'You are a supply chain analyst. Return only strict JSON.',
      },
      {
        role: 'user',
        content: `Predict inventory reorder for product.

Product: ${product.name} (SKU ${product.sku || product.id})
Current stock: ${stock}
Estimated daily velocity: ${dailyVelocity.toFixed(2)}
Lead time (days): ${leadTime}

Return JSON:
{
  "predicted_days_to_stockout": <int>,
  "recommended_reorder_qty": <int>,
  "reorder_now": <bool>,
  "safety_stock_qty": <int>,
  "rationale": "<short reason>",
  "confidence": "<low|medium|high>"
}`,
      },
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.2 });
    const parsed = parseAIJson(aiResult);

    let suggestion = null;
    if (parsed && parsed.recommended_reorder_qty != null) {
      suggestion = await InventoryReorderSuggestion.create({
        productId,
        current_stock: stock,
        predicted_days_to_stockout: parsed.predicted_days_to_stockout || null,
        recommended_qty: parsed.recommended_reorder_qty || null,
        lead_time_days: leadTime,
        reasoning: parsed.rationale || null,
        ai_results: parsed,
        raw_response: typeof aiResult === 'string' ? aiResult : null,
        model: MODEL,
        latency_ms: Date.now() - start,
        status: 'pending',
      });
    }

    await persistAILog({
      endpoint: 'inventory-reorder',
      user_id: req.user?.id,
      input: { productId, lead_time_days },
      ai_results: parsed,
      raw_response: aiResult,
      latency_ms: Date.now() - start,
    });

    res.json({
      productId,
      product_name: product.name,
      current_stock: stock,
      daily_velocity: parseFloat(dailyVelocity.toFixed(2)),
      ai_results: parsed,
      suggestion,
      latency_ms: Date.now() - start,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ai/inventory-reorder/suggestions', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { count, rows } = await InventoryReorderSuggestion.findAndCountAll({
      include: [{ model: Product, attributes: ['id', 'name', 'sku'] }],
      order: [['createdAt', 'DESC']], limit, offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/ai/inventory-reorder/suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const sug = await InventoryReorderSuggestion.findByPk(req.params.id);
    if (!sug) return res.status(404).json({ error: 'Not found' });
    await sug.update({ status });
    res.json(sug);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// 2. REAL-TIME PRICE ELASTICITY TESTER
// ============================================
router.post('/ai/price-elasticity/start', authenticateToken, aiRateLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const cur = parseFloat(product.currentPrice || product.basePrice || product.price || 0) || 0;
    const cost = parseFloat(product.cost || 0);

    const messages = [
      { role: 'system', content: 'You are a pricing strategist. Return strict JSON.' },
      {
        role: 'user',
        content: `Propose 2 price test variants for product "${product.name}".

Current price: $${cur}
Cost: $${cost}

Return JSON:
{
  "variant_a_price": <number>,
  "variant_b_price": <number>,
  "hypothesis": "<which is expected to win and why>",
  "expected_winner": "<a|b|tie>",
  "estimated_lift_pct": <number>
}`,
      },
    ];
    const aiResult = await openRouterService.chat(messages, { temperature: 0.4 });
    const parsed = parseAIJson(aiResult);
    if (!parsed) return res.status(500).json({ error: 'Failed to parse AI proposal', raw: aiResult });

    const test = await PriceElasticityTest.create({
      productId,
      variant_a_price: parsed.variant_a_price || cur,
      variant_b_price: parsed.variant_b_price || cur,
      ai_proposal: parsed,
      status: 'running',
    });

    await persistAILog({
      endpoint: 'price-elasticity/start',
      user_id: req.user?.id,
      input: { productId },
      ai_results: parsed,
      raw_response: aiResult,
      latency_ms: Date.now() - start,
    });

    res.status(201).json({ test, ai_proposal: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/price-elasticity/:id/event', authenticateToken, async (req, res) => {
  try {
    const { variant, type } = req.body; // variant: 'a'|'b', type: 'view'|'conversion'
    if (!['a', 'b'].includes(variant) || !['view', 'conversion'].includes(type)) {
      return res.status(400).json({ error: 'Invalid variant or type' });
    }
    const t = await PriceElasticityTest.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Test not found' });
    const field = `variant_${variant}_${type}s`;
    t[field] = (t[field] || 0) + 1;
    await t.save();
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai/price-elasticity', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { count, rows } = await PriceElasticityTest.findAndCountAll({
      include: [{ model: Product, attributes: ['id', 'name', 'sku'] }],
      order: [['createdAt', 'DESC']], limit, offset,
    });
    // Compute conversion deltas
    const enriched = rows.map((t) => {
      const j = t.toJSON();
      j.conv_rate_a = j.variant_a_views > 0 ? (j.variant_a_conversions / j.variant_a_views * 100).toFixed(2) : '0';
      j.conv_rate_b = j.variant_b_views > 0 ? (j.variant_b_conversions / j.variant_b_views * 100).toFixed(2) : '0';
      return j;
    });
    res.json({ data: enriched, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/price-elasticity/:id/conclude', authenticateToken, async (req, res) => {
  try {
    const t = await PriceElasticityTest.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Test not found' });
    const rateA = t.variant_a_views > 0 ? t.variant_a_conversions / t.variant_a_views : 0;
    const rateB = t.variant_b_views > 0 ? t.variant_b_conversions / t.variant_b_views : 0;
    const winner = rateA > rateB ? 'a' : (rateB > rateA ? 'b' : 'tie');
    await t.update({ status: 'completed', winner, ended_at: new Date(), ai_results: { final_rate_a: rateA, final_rate_b: rateB } });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// 3. VISUAL PRODUCT-PHOTO CRITIQUE
// ============================================
router.post('/ai/photo-critique', authenticateToken, aiRateLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const { productId, image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url required' });

    let product = null;
    if (productId) {
      product = await Product.findByPk(productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });
    }

    // We use the multimodal-friendly format: image content blocks
    const messages = [
      {
        role: 'system',
        content: 'You are an expert e-commerce product photographer and visual merchandiser. Always return strict JSON only.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Critique this product photo${product ? ` for "${product.name}"` : ''} for use as a hero image on an online store.

Return JSON:
{
  "overall_score": <0-100>,
  "lighting_score": <0-100>,
  "background_score": <0-100>,
  "composition_score": <0-100>,
  "issues": ["<string>", ...],
  "improvements": ["<string>", ...],
  "summary": "<2-3 sentence overall verdict>"
}` },
          { type: 'image_url', image_url: { url: image_url } },
        ],
      },
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.2 });
    const parsed = parseAIJson(aiResult);

    let crit = null;
    if (parsed) {
      crit = await ProductPhotoCritique.create({
        productId: productId || null,
        image_url,
        overall_score: parsed.overall_score || null,
        ai_results: parsed,
        raw_response: typeof aiResult === 'string' ? aiResult : null,
        model: MODEL,
        latency_ms: Date.now() - start,
      });
    }

    await persistAILog({
      endpoint: 'photo-critique',
      user_id: req.user?.id,
      input: { productId, image_url },
      ai_results: parsed,
      raw_response: aiResult,
      latency_ms: Date.now() - start,
    });

    res.json({ critique: crit, ai_results: parsed, latency_ms: Date.now() - start });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai/photo-critique', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { count, rows } = await ProductPhotoCritique.findAndCountAll({
      include: [{ model: Product, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']], limit, offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// 4. CONVERSATIONAL SHOPPING CONCIERGE
// ============================================
router.post('/ai/concierge/sessions', authenticateToken, async (req, res) => {
  try {
    const { customerId, cart_snapshot } = req.body;
    const session_token = crypto.randomBytes(16).toString('hex');
    const session = await ConciergeChatSession.create({
      customerId: customerId || null,
      session_token,
      cart_snapshot: cart_snapshot || null,
      status: 'active',
    });
    res.status(201).json(session);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/concierge/sessions/:id/message', authenticateToken, aiRateLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });

    const session = await ConciergeChatSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Persist user message
    await ConciergeChatMessage.create({ sessionId: session.id, role: 'user', content });

    // Pull recent messages for context (last 20)
    const history = await ConciergeChatMessage.findAll({
      where: { sessionId: session.id },
      order: [['createdAt', 'ASC']],
      limit: 20,
    });

    // Retrieve a small product catalog snapshot for grounding
    const products = await Product.findAll({ limit: 25, order: [['createdAt', 'DESC']] });
    const catalog = products.map((p) => ({ id: p.id, name: p.name, price: parseFloat(p.currentPrice || p.basePrice || p.price || 0), category: p.category }));

    const messages = [
      {
        role: 'system',
        content: `You are a conversational shopping concierge. You help customers discover products, compare options, and add items to their cart.
Available product catalog (use only these IDs when recommending or adding to cart):
${JSON.stringify(catalog, null, 2)}

Current cart snapshot:
${JSON.stringify(session.cart_snapshot || [], null, 2)}

When the user wants to add an item to their cart, respond with strict JSON of this form:
{"reply": "<your message>", "tool_calls": [{"name": "add_to_cart", "args": {"product_id": <id>, "qty": <int>}}]}

When no tool call is needed, return:
{"reply": "<your message>", "tool_calls": []}`,
      },
      ...history.map((m) => ({ role: m.role === 'tool' ? 'system' : m.role, content: m.content })),
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.7 });
    const parsed = parseAIJson(aiResult) || { reply: aiResult, tool_calls: [] };

    // Persist assistant message
    const asstMsg = await ConciergeChatMessage.create({
      sessionId: session.id,
      role: 'assistant',
      content: parsed.reply || aiResult,
      tool_calls: parsed.tool_calls || [],
      ai_results: parsed,
    });

    // Execute tool calls (simulated cart mutations)
    let updatedCart = session.cart_snapshot || [];
    for (const tc of (parsed.tool_calls || [])) {
      if (tc.name === 'add_to_cart' && tc.args && tc.args.product_id) {
        const p = catalog.find((c) => c.id === tc.args.product_id);
        if (p) {
          updatedCart = Array.isArray(updatedCart) ? [...updatedCart] : [];
          const existing = updatedCart.find((it) => it.product_id === p.id);
          if (existing) existing.qty = (existing.qty || 0) + (tc.args.qty || 1);
          else updatedCart.push({ product_id: p.id, name: p.name, qty: tc.args.qty || 1, price: p.price });
        }
      }
    }
    if (JSON.stringify(updatedCart) !== JSON.stringify(session.cart_snapshot)) {
      await session.update({ cart_snapshot: updatedCart });
    }

    await persistAILog({
      endpoint: 'concierge/message',
      user_id: req.user?.id,
      input: { sessionId: session.id, content },
      ai_results: parsed,
      raw_response: aiResult,
      latency_ms: Date.now() - start,
    });

    res.json({ assistant_message: asstMsg, cart: updatedCart, ai_results: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai/concierge/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await ConciergeChatSession.findByPk(req.params.id, {
      include: [{ model: ConciergeChatMessage, separate: true, order: [['createdAt', 'ASC']] }],
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai/concierge/sessions', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { count, rows } = await ConciergeChatSession.findAndCountAll({
      order: [['createdAt', 'DESC']], limit, offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// 5. FRAUD CLUSTER DETECTOR
// ============================================
router.post('/ai/fraud-clusters/detect', authenticateToken, aiRateLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const alerts = await FraudAlert.findAll({ limit: 500, order: [['createdAt', 'DESC']] });

    // Group by ipAddress
    const ipBuckets = {};
    for (const a of alerts) {
      const ip = a.ipAddress || 'unknown';
      if (!ipBuckets[ip]) ipBuckets[ip] = [];
      ipBuckets[ip].push(a);
    }

    const created = [];
    for (const [ip, bucketAlerts] of Object.entries(ipBuckets)) {
      if (ip === 'unknown' || bucketAlerts.length < 2) continue;

      const customer_ids = [...new Set(bucketAlerts.map((a) => a.customerId).filter(Boolean))];
      const order_ids = [...new Set(bucketAlerts.map((a) => a.orderId).filter(Boolean))];
      if (customer_ids.length < 2) continue;
      const total_value = bucketAlerts.reduce((s, a) => s + parseFloat(a.orderAmount || 0), 0);

      const aiMsgs = [
        { role: 'system', content: 'You are a fraud analyst. Return strict JSON.' },
        {
          role: 'user',
          content: `Multiple FraudAlert rows share IP ${ip}. Determine if this is a coordinated cluster.

Alerts:
${JSON.stringify(bucketAlerts.map((a) => ({ id: a.id, customerId: a.customerId, orderId: a.orderId, riskScore: a.riskScore, alertType: a.alertType, indicators: a.indicators })), null, 2)}

Customer IDs in cluster: ${customer_ids.length}
Order IDs in cluster: ${order_ids.length}
Total value: $${total_value.toFixed(2)}

Return JSON:
{
  "is_cluster": <bool>,
  "severity": "<low|medium|high|critical>",
  "summary": "<short narrative>",
  "recommended_action": "<short action>",
  "patterns": ["<string>", ...]
}`,
        },
      ];
      const aiResult = await openRouterService.chat(aiMsgs, { temperature: 0.2 });
      const parsed = parseAIJson(aiResult) || {};
      if (parsed.is_cluster === false) continue;

      const cluster = await FraudCluster.create({
        cluster_key: ip,
        cluster_type: 'ip',
        customer_ids,
        order_ids,
        alert_count: bucketAlerts.length,
        total_value,
        ai_summary: parsed.summary || 'Cluster detected',
        ai_results: parsed,
        recommended_action: parsed.recommended_action || 'Review',
        severity: parsed.severity || 'medium',
        status: 'open',
      });
      created.push(cluster);
    }

    await persistAILog({
      endpoint: 'fraud-clusters/detect',
      user_id: req.user?.id,
      input: { alert_count: alerts.length, ip_buckets: Object.keys(ipBuckets).length },
      ai_results: { clusters_created: created.length },
      latency_ms: Date.now() - start,
    });

    res.json({ clusters_created: created.length, clusters: created, latency_ms: Date.now() - start });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai/fraud-clusters', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const where = {};
    if (status) where.status = status;
    const { count, rows } = await FraudCluster.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']], limit, offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai/fraud-clusters/:id', authenticateToken, async (req, res) => {
  try {
    const c = await FraudCluster.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/ai/fraud-clusters/:id', authenticateToken, async (req, res) => {
  try {
    const { status, severity, recommended_action } = req.body;
    const c = await FraudCluster.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    await c.update({
      status: status || c.status,
      severity: severity || c.severity,
      recommended_action: recommended_action || c.recommended_action,
    });
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
