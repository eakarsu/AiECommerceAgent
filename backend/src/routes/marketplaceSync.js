// Marketplace sync: two-way Shopify / Amazon / eBay connectors.
// v0 implements pull + push helpers for Shopify; stubs others with TODOs.
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Product } from '../models/index.js';

const router = Router();

async function shopifyPull(shop, accessToken, sinceId = 0) {
  const url = `https://${shop}/admin/api/2024-01/products.json?since_id=${sinceId}&limit=50`;
  const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } });
  if (!r.ok) throw new Error(`Shopify pull failed: ${r.status}`);
  const data = await r.json();
  return data.products || [];
}

async function shopifyPush(shop, accessToken, product) {
  const url = `https://${shop}/admin/api/2024-01/products.json`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: { title: product.name, body_html: product.description || '', variants: [{ price: product.price, sku: product.sku }] } }),
  });
  if (!r.ok) throw new Error(`Shopify push failed: ${r.status}`);
  return await r.json();
}

// POST /api/ai/marketplace-sync/pull { provider:'shopify'|'amazon'|'ebay', since_id? }
router.post('/ai/marketplace-sync/pull', authenticateToken, async (req, res) => {
  try {
    const { provider, since_id = 0 } = req.body || {};
    if (!provider) return res.status(400).json({ error: 'provider required' });
    if (provider === 'shopify') {
      // TODO: configure credentials — SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN
      const shop = process.env.SHOPIFY_SHOP;
      const token = process.env.SHOPIFY_ACCESS_TOKEN;
      if (!shop || !token) return res.status(503).json({ error: 'SHOPIFY_SHOP/SHOPIFY_ACCESS_TOKEN missing' });
      const list = await shopifyPull(shop, token, since_id);
      let upserts = 0;
      for (const p of list) {
        try {
          await Product.upsert({ name: p.title, sku: p.variants?.[0]?.sku || `sh-${p.id}`, price: Number(p.variants?.[0]?.price || 0), description: p.body_html || '' });
          upserts++;
        } catch {}
      }
      return res.json({ provider, pulled: list.length, upserts });
    }
    // TODO: implement Amazon SP-API / eBay Trading API
    return res.status(501).json({ error: `${provider} sync not yet implemented` });
  } catch (e) {
    console.error('marketplace pull error:', e);
    return res.status(500).json({ error: 'pull failed', detail: e.message });
  }
});

// POST /api/ai/marketplace-sync/push { provider, product_id }
router.post('/ai/marketplace-sync/push', authenticateToken, async (req, res) => {
  try {
    const { provider, product_id } = req.body || {};
    if (!provider || !product_id) return res.status(400).json({ error: 'provider + product_id required' });
    const product = await Product.findByPk(product_id);
    if (!product) return res.status(404).json({ error: 'product not found' });
    if (provider === 'shopify') {
      const shop = process.env.SHOPIFY_SHOP;
      const token = process.env.SHOPIFY_ACCESS_TOKEN;
      if (!shop || !token) return res.status(503).json({ error: 'Shopify credentials missing' });
      const data = await shopifyPush(shop, token, product);
      return res.json({ provider, pushed: true, remote: data });
    }
    return res.status(501).json({ error: `${provider} push not yet implemented` });
  } catch (e) {
    console.error('marketplace push error:', e);
    return res.status(500).json({ error: 'push failed', detail: e.message });
  }
});

export default router;
