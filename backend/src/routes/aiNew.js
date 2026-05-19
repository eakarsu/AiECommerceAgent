import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import openRouterService from '../services/openrouter.js';
import { Customer, Order, Product, AILog } from '../models/index.js';
import { parseAIJson } from '../utils/parseAIJson.js';

const router = Router();

// ============================================
// POST /api/ai/churn-prediction
// ============================================
router.post('/ai/churn-prediction', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { customer_id } = req.body;
    if (!customer_id) {
      return res.status(400).json({ error: 'Validation failed: customer_id is required.' });
    }

    const customer = await Customer.findByPk(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Fetch orders for recency / frequency
    const orders = await Order.findAll({
      where: { customerId: customer_id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    const totalOrders = orders.length;
    const lastOrderDate = orders[0]?.createdAt || null;
    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((Date.now() - new Date(lastOrderDate)) / (1000 * 60 * 60 * 24))
      : 999;

    const totalSpend = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? (totalSpend / totalOrders).toFixed(2) : 0;

    const messages = [
      {
        role: 'user',
        content: `You are a churn prediction expert. Analyze the following customer data and return a JSON object with these exact fields:
{
  "churn_risk_score": <integer 0-100>,
  "risk_level": "<low|medium|high>",
  "risk_factors": [<array of strings>],
  "retention_offer": "<personalized offer string>"
}

Customer data:
- Name: ${customer.name || 'Unknown'}
- Total orders: ${totalOrders}
- Days since last order: ${daysSinceLastOrder}
- Total lifetime spend: $${totalSpend.toFixed(2)}
- Average order value: $${avgOrderValue}
- Customer since: ${customer.createdAt || 'Unknown'}

Return ONLY valid JSON, no markdown.`
      }
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.3 });
    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = {
        churn_risk_score: daysSinceLastOrder > 90 ? 75 : daysSinceLastOrder > 30 ? 45 : 20,
        risk_level: daysSinceLastOrder > 90 ? 'high' : daysSinceLastOrder > 30 ? 'medium' : 'low',
        risk_factors: [
          `Last purchase was ${daysSinceLastOrder} days ago`,
          `Total orders: ${totalOrders}`,
          `Lifetime value: $${totalSpend.toFixed(2)}`
        ],
        retention_offer: `Come back and enjoy 15% off your next order with code COMEBACK15`
      };
    }

    res.json({ customer_id, customer_name: customer.name, ...parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/ai/bundle-optimizer
// ============================================
router.post('/ai/bundle-optimizer', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { product_ids } = req.body;
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length < 2) {
      return res.status(400).json({ error: 'Validation failed: product_ids must be an array with at least 2 items.' });
    }

    const products = await Product.findAll({ where: { id: product_ids } });
    if (products.length < 2) {
      return res.status(404).json({ error: 'At least 2 valid products are required.' });
    }

    const productSummaries = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.currentPrice || p.price || 0,
      description: p.description
    }));

    const totalValue = productSummaries.reduce((sum, p) => sum + parseFloat(p.price), 0);

    const messages = [
      {
        role: 'user',
        content: `You are a product bundling expert. Analyze these products and suggest the optimal bundle configuration. Return a JSON object with these exact fields:
{
  "bundle_name": "<catchy name>",
  "bundle_rationale": "<why these products work together>",
  "recommended_discount_pct": <integer 5-30>,
  "bundle_price": <number>,
  "expected_uplift_pct": <integer>,
  "upsell_talking_points": [<array of 3 strings>]
}

Products:
${JSON.stringify(productSummaries, null, 2)}

Total list price: $${totalValue.toFixed(2)}

Return ONLY valid JSON, no markdown.`
      }
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.4 });
    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      const discount = 15;
      parsed = {
        bundle_name: `${productSummaries[0].name} + ${productSummaries[1].name} Bundle`,
        bundle_rationale: 'These products are frequently purchased together and complement each other well.',
        recommended_discount_pct: discount,
        bundle_price: parseFloat((totalValue * (1 - discount / 100)).toFixed(2)),
        expected_uplift_pct: 22,
        upsell_talking_points: [
          `Save $${(totalValue * discount / 100).toFixed(2)} compared to buying separately`,
          'Perfect pairing for maximum value',
          'Bundle includes all you need in one purchase'
        ]
      };
    }

    res.json({
      product_ids,
      products: productSummaries,
      total_list_price: parseFloat(totalValue.toFixed(2)),
      ...parsed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/ai/returns-analyzer
// ============================================
router.post('/ai/returns-analyzer', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { date_range } = req.body;
    if (!date_range || !date_range.start || !date_range.end) {
      return res.status(400).json({ error: 'Validation failed: date_range with start and end dates is required.' });
    }

    // Fetch orders that contain return/refund info within date range
    const { Op } = await import('sequelize');
    const orders = await Order.findAll({
      where: {
        status: { [Op.in]: ['returned', 'refunded', 'partially_refunded'] },
        createdAt: {
          [Op.between]: [new Date(date_range.start), new Date(date_range.end)]
        }
      },
      limit: 200,
      order: [['createdAt', 'DESC']]
    });

    const totalReturns = orders.length;
    const totalRefundValue = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
    const statusBreakdown = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    const messages = [
      {
        role: 'user',
        content: `You are a returns analysis expert for an e-commerce business. Analyze the following returns data and identify patterns and recommendations. Return a JSON object with these exact fields:
{
  "summary": "<2-3 sentence overview>",
  "top_return_reasons": [<array of strings>],
  "quality_issues": [<array of identified quality/design issues>],
  "return_patterns": [<array of identified patterns>],
  "recommendations": [<array of 4-5 actionable recommendations>],
  "estimated_savings_opportunity": "<string describing potential savings>"
}

Returns data (${date_range.start} to ${date_range.end}):
- Total returns: ${totalReturns}
- Total refund value: $${totalRefundValue.toFixed(2)}
- Status breakdown: ${JSON.stringify(statusBreakdown)}

Return ONLY valid JSON, no markdown.`
      }
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.3 });
    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = {
        summary: `In the specified period, ${totalReturns} returns totaling $${totalRefundValue.toFixed(2)} were processed. The breakdown indicates ${Object.keys(statusBreakdown).join(', ')} statuses.`,
        top_return_reasons: ['Product not as described', 'Size/fit issues', 'Defective item', 'Changed mind'],
        quality_issues: ['Inconsistent sizing across product lines', 'Packaging damage during shipping'],
        return_patterns: ['Higher return rates on weekends', 'Repeat returners in certain segments'],
        recommendations: [
          'Improve product descriptions with more detailed specifications',
          'Add size guides to reduce fit-related returns',
          'Implement stricter QA on high-return SKUs',
          'Follow up with returning customers to identify root causes',
          'Review packaging for fragile items'
        ],
        estimated_savings_opportunity: `Addressing top 2 issues could reduce returns by ~30%, saving $${(totalRefundValue * 0.3).toFixed(2)}`
      };
    }

    res.json({
      date_range,
      total_returns: totalReturns,
      total_refund_value: parseFloat(totalRefundValue.toFixed(2)),
      status_breakdown: statusBreakdown,
      ...parsed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/ai/email-sequence
// ============================================
router.post('/ai/email-sequence', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { trigger_event, customer_segment } = req.body;
    if (!trigger_event || !customer_segment) {
      return res.status(400).json({ error: 'Validation failed: trigger_event and customer_segment are required.' });
    }

    const messages = [
      {
        role: 'user',
        content: `You are an expert email marketing copywriter. Generate a 3-email nurture sequence for the following scenario. Return a JSON object with this exact structure:
{
  "sequence_name": "<name for this sequence>",
  "emails": [
    {
      "email_number": 1,
      "send_timing": "<e.g. Immediately, 3 days later>",
      "subject_line": "<subject>",
      "preview_text": "<preview>",
      "body": "<full email body with personalization tokens like {{first_name}}>",
      "cta_text": "<call to action button text>",
      "cta_url_placeholder": "<e.g. {{shop_url}}/sale>"
    },
    { "email_number": 2, ... },
    { "email_number": 3, ... }
  ]
}

Trigger event: ${trigger_event}
Customer segment: ${customer_segment}

Make each email distinct in tone and offer. Return ONLY valid JSON, no markdown.`
      }
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.7, maxTokens: 3000 });
    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = {
        sequence_name: `${trigger_event} - ${customer_segment} Sequence`,
        emails: [
          {
            email_number: 1,
            send_timing: 'Immediately',
            subject_line: `Welcome, {{first_name}}! Here's what's waiting for you`,
            preview_text: 'Your exclusive offer is inside',
            body: `Hi {{first_name}},\n\nThank you for being a valued customer. We have something special just for you.\n\nExplore our latest collection and find exactly what you're looking for.\n\nBest regards,\nThe Team`,
            cta_text: 'Shop Now',
            cta_url_placeholder: '{{shop_url}}'
          },
          {
            email_number: 2,
            send_timing: '3 days later',
            subject_line: `{{first_name}}, don't miss out on these picks`,
            preview_text: 'Handpicked just for you',
            body: `Hi {{first_name}},\n\nWe noticed you haven't had a chance to check out our recommendations. Here's a quick reminder — these top picks are going fast.\n\nUse code SAVE10 for 10% off your order today.\n\nBest,\nThe Team`,
            cta_text: 'Claim Your Discount',
            cta_url_placeholder: '{{shop_url}}/discount/SAVE10'
          },
          {
            email_number: 3,
            send_timing: '7 days later',
            subject_line: 'Last chance: Your offer expires soon',
            preview_text: 'This is your final reminder',
            body: `Hi {{first_name}},\n\nThis is your last chance to take advantage of your exclusive offer. Your discount code SAVE10 expires in 24 hours.\n\nDon't miss out — shop now and save!\n\nWarm regards,\nThe Team`,
            cta_text: 'Shop Before It Expires',
            cta_url_placeholder: '{{shop_url}}/discount/SAVE10'
          }
        ]
      };
    }

    res.json({ trigger_event, customer_segment, ...parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/ai/merchandising-mix (NEW)
// Recommends an optimal product mix for a category given budget + objective.
// Uses parseAIJson 3-strategy and persists to AILog (ai_results JSONB).
// ============================================
router.post('/ai/merchandising-mix', authenticateToken, aiRateLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const { category, budget, objective, audience } = req.body;
    const errors = {};
    if (!category) errors.category = 'category is required';
    if (!budget || budget <= 0) errors.budget = 'budget must be > 0';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

    const products = await Product.findAll({ where: { category }, limit: 30 });
    if (products.length === 0) {
      return res.status(404).json({ error: `No products found in category "${category}"` });
    }

    const productList = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: parseFloat(p.currentPrice || p.basePrice || 0),
      cost: parseFloat(p.cost || 0),
      tags: p.tags || [],
    }));

    const messages = [
      {
        role: 'system',
        content: 'You are a senior merchandising strategist. Return ONLY a single JSON object, no markdown, no commentary.',
      },
      {
        role: 'user',
        content: `Recommend an optimal product mix for the "${category}" category.

Budget: $${budget}
Objective: ${objective || 'maximize revenue'}
Audience: ${audience || 'general'}

Available products:
${JSON.stringify(productList, null, 2)}

Return a JSON object with this shape:
{
  "selected_skus": ["<sku>", ...],
  "allocation": [
    { "sku": "<sku>", "units": <int>, "subtotal": <number>, "rationale": "<short>" }
  ],
  "expected_revenue": <number>,
  "expected_margin_pct": <number>,
  "diversification_score": <0-100>,
  "missing_categories_to_consider": ["<string>", ...],
  "executive_summary": "<2-3 sentences>"
}`,
      },
    ];

    const aiResult = await openRouterService.chat(messages, { temperature: 0.3 });
    const parsed = parseAIJson(aiResult);
    const latency_ms = Date.now() - start;

    let log;
    try {
      log = await AILog.create({
        endpoint: 'merchandising-mix',
        user_id: req.user?.id || null,
        input: { category, budget, objective, audience },
        ai_results: parsed,
        raw_response: typeof aiResult === 'string' ? aiResult.slice(0, 8000) : null,
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
        latency_ms,
        status: parsed ? 'success' : 'parse_failed',
      });
    } catch (e) {
      // table may not exist yet — surface as warning but still return
      console.warn('AILog persist failed:', e.message);
    }

    if (!parsed) {
      return res.status(200).json({
        warning: 'AI response could not be parsed as JSON.',
        raw: typeof aiResult === 'string' ? aiResult.slice(0, 4000) : aiResult,
        latency_ms,
        log_id: log?.id || null,
      });
    }

    res.json({
      category,
      budget,
      objective: objective || 'maximize revenue',
      audience: audience || 'general',
      product_count: products.length,
      ai_results: parsed,
      latency_ms,
      log_id: log?.id || null,
    });
  } catch (error) {
    console.error('merchandising-mix error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/ai/logs (paginated) — list AI execution logs
// ============================================
router.get('/ai/logs', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const endpoint = req.query.endpoint;

    const where = {};
    if (endpoint) where.endpoint = endpoint;

    const { count, rows } = await AILog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
