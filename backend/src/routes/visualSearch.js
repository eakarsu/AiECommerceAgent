// Visual search: image-based product discovery via vision model.
// v0 calls OpenRouter/OpenAI vision endpoint with the supplied image and
// asks for a textual description, then runs a fuzzy product match.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { Product } from '../models/index.js';
import { Op } from 'sequelize';

const router = Router();

async function describeImage(imageUrl, base64) {
  // TODO: configure credentials — OPENAI_API_KEY (vision) or OPENROUTER_API_KEY
  const key = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const isOpenAI = !!process.env.OPENAI_API_KEY;
  const url = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const body = {
    model: isOpenAI ? 'gpt-4o-mini' : (process.env.OPENROUTER_VISION_MODEL || 'anthropic/claude-3-5-sonnet-20241022'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the product in this image in 2-3 short phrases (category, colour, key features). Return JSON {"keywords":["..."]}.' },
          imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 200,
  };
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return null;
  const j = await r.json();
  return j.choices?.[0]?.message?.content;
}

// POST /api/ai/visual-search { image_url? OR image_base64?, limit? }
router.post('/ai/visual-search', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { image_url, image_base64, limit = 10 } = req.body || {};
    if (!image_url && !image_base64) return res.status(400).json({ error: 'image_url or image_base64 required' });
    const desc = await describeImage(image_url, image_base64);
    if (!desc) return res.status(503).json({ error: 'Vision API not configured' });

    let keywords = [];
    try {
      const parsed = JSON.parse(desc.match(/\{[\s\S]*\}/)?.[0] || '{}');
      keywords = parsed.keywords || [];
    } catch { keywords = desc.split(/[\s,]+/).slice(0, 5); }

    const where = keywords.length
      ? { [Op.or]: keywords.map(k => ({ name: { [Op.iLike]: `%${k}%` } })) }
      : {};
    const products = await Product.findAll({ where, limit: Math.min(parseInt(limit) || 10, 25) });
    return res.json({ keywords, matches: products });
  } catch (e) {
    console.error('visual-search error:', e);
    return res.status(500).json({ error: 'search failed' });
  }
});

export default router;
