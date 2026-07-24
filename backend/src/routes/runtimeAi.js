import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.post('/commerce-advice', authenticateToken, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || !Object.keys(req.body).length) return res.status(400).json({ error: 'commerce_context_required' });
    const { OPENROUTER_API_KEY: key, OPENROUTER_MODEL: model, OPENROUTER_BASE_URL: base } = process.env;
    if (base !== 'https://openrouter.ai/api/v1' || !key || !model) throw new Error('OpenRouter runtime configuration is incomplete');
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: 'Give concise e-commerce merchandising and fulfillment advice with measurable next steps.' },
        { role: 'user', content: JSON.stringify(req.body) },
      ] }),
    });
    if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}`);
    const body = await response.json();
    const result = body.choices?.[0]?.message?.content;
    if (!result) throw new Error('OpenRouter returned no usable content');
    const saved = await sequelize.query(
      `INSERT INTO ecommerce_runtime_ai_results(user_id,input,result,model)
       VALUES($1,$2::jsonb,$3::jsonb,$4) RETURNING id,created_at`,
      { bind: [req.user.id, JSON.stringify(req.body), JSON.stringify({ text: result }), body.model || model], type: QueryTypes.SELECT },
    );
    return res.json({ success: true, result, model: body.model || model, persisted: saved[0] });
  } catch (error) {
    console.error('Runtime AI error:', error.message);
    return res.status(502).json({ error: 'provider_request_failed' });
  }
});

export default router;
