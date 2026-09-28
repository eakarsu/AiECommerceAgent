import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const CONNECTORS = {
  shopify: {
    label: 'Shopify Admin',
    purpose: 'Create a validated draft product and set its initial variant price.',
    required: ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN'],
    operation: 'import_product',
  },
  social_evidence: {
    label: 'Social Evidence Discovery',
    purpose: 'Discover and ingest current TikTok and Instagram demand evidence.',
    required: ['SOCIAL_EVIDENCE_API_URL', 'SOCIAL_EVIDENCE_API_TOKEN'],
    operation: 'discover_evidence',
  },
  supplier_catalog: {
    label: 'Supplier Catalog',
    purpose: 'Search supplier catalogs and normalize delivered-cost candidates.',
    required: ['SUPPLIER_CATALOG_API_URL', 'SUPPLIER_CATALOG_API_TOKEN'],
    operation: 'search_suppliers',
  },
  ugc_video: {
    label: 'UGC Video Renderer',
    purpose: 'Render an approved OpenRouter production brief into a video asset.',
    required: ['UGC_VIDEO_API_URL', 'UGC_VIDEO_API_TOKEN'],
    operation: 'render_video',
  },
  social_publishing: {
    label: 'Social Publishing',
    purpose: 'Schedule approved creative for the organic 30-day plan.',
    required: ['SOCIAL_PUBLISHING_API_URL', 'SOCIAL_PUBLISHING_API_TOKEN'],
    operation: 'schedule_content',
  },
  meta_ads: {
    label: 'Meta Ads Outcomes',
    purpose: 'Synchronize spend, sessions, purchases, CPA, ROAS and revenue.',
    required: ['META_ADS_CONNECTOR_URL', 'META_ADS_ACCESS_TOKEN'],
    operation: 'sync_outcomes',
  },
  tiktok_ads: {
    label: 'TikTok Ads Outcomes',
    purpose: 'Synchronize paid product-test performance and revenue outcomes.',
    required: ['TIKTOK_ADS_CONNECTOR_URL', 'TIKTOK_ADS_ACCESS_TOKEN'],
    operation: 'sync_outcomes',
  },
};

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value, min, max) => Math.min(max, Math.max(min, value));

function configuration(key) {
  const connector = CONNECTORS[key];
  const missing = connector.required.filter(name => !String(process.env[name] || '').trim());
  return { key, label: connector.label, purpose: connector.purpose, operation: connector.operation, configured: missing.length === 0, missing };
}

async function snapshot(id) {
  const [row] = await sequelize.query(`
    SELECT o.*,
      COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.selected DESC,s.reliability_score DESC) FROM growth_suppliers s WHERE s.opportunity_id=o.id),'[]'::jsonb) suppliers,
      COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.published_at DESC) FROM growth_social_evidence e WHERE e.opportunity_id=o.id),'[]'::jsonb) evidence,
      COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM growth_creative_assets c WHERE c.opportunity_id=o.id),'[]'::jsonb) creatives
    FROM growth_opportunities o WHERE o.id=$1`, { bind: [id], type: QueryTypes.SELECT });
  return row || null;
}

async function createJob({ opportunityId, connector, operation, status, payload, userId, errorMessage = null }) {
  const [job] = await sequelize.query(`INSERT INTO growth_connector_jobs(opportunity_id,connector,operation,status,request_payload,error_message,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *`, {
    bind: [opportunityId || null, connector, operation, status, JSON.stringify(payload || {}), errorMessage, userId], type: QueryTypes.SELECT,
  });
  return job;
}

async function finishJob(id, { status, summary = {}, externalReference = null, errorMessage = null }) {
  const [job] = await sequelize.query(`UPDATE growth_connector_jobs SET status=$2,response_summary=$3::jsonb,external_reference=$4,error_message=$5,attempts=attempts+1,started_at=COALESCE(started_at,NOW()),completed_at=NOW() WHERE id=$1 RETURNING *`, {
    bind: [id, status, JSON.stringify(summary), externalReference, errorMessage], type: QueryTypes.SELECT,
  });
  return job;
}

async function callConfigured(urlName, tokenName, payload) {
  const response = await fetch(process.env[urlName], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[tokenName]}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.error || body.message || `Connector request failed with status ${response.status}`);
  return body;
}

async function shopifyImport(opportunity) {
  const domain = String(process.env.SHOPIFY_SHOP_DOMAIN).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const version = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-04';
  const endpoint = `https://${domain}/admin/api/${version}/graphql.json`;
  const selectedSupplier = opportunity.suppliers.find(item => item.selected);
  if (!selectedSupplier) throw new Error('A primary supplier must be selected before Shopify import');
  const createQuery = `mutation CreateValidatedProduct($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product { id title variants(first: 1) { nodes { id } } }
      userErrors { field message }
    }
  }`;
  const createResponse = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN },
    body: JSON.stringify({ query: createQuery, variables: { product: {
      title: opportunity.name, descriptionHtml: `<p>${opportunity.problem_statement}</p><p>Designed for ${opportunity.target_audience}.</p>`,
      productType: opportunity.category, vendor: selectedSupplier.name, tags: ['validated-product','growth-os',opportunity.stage], status: 'DRAFT',
    } } }), signal: AbortSignal.timeout(60000),
  });
  const createBody = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || createBody.errors?.length) throw new Error(createBody.errors?.[0]?.message || `Shopify create failed with status ${createResponse.status}`);
  const createResult = createBody.data?.productCreate;
  if (createResult?.userErrors?.length) throw new Error(createResult.userErrors.map(item => item.message).join('; '));
  const product = createResult?.product;
  const variantId = product?.variants?.nodes?.[0]?.id;
  if (!product?.id || !variantId) throw new Error('Shopify did not return a product and initial variant');
  const priceQuery = `mutation PriceValidatedProduct($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }`;
  const priceResponse = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN },
    body: JSON.stringify({ query: priceQuery, variables: { productId: product.id, variants: [{ id: variantId, price: String(opportunity.selling_price) }] } }),
    signal: AbortSignal.timeout(60000),
  });
  const priceBody = await priceResponse.json().catch(() => ({}));
  const priceResult = priceBody.data?.productVariantsBulkUpdate;
  if (!priceResponse.ok || priceBody.errors?.length || priceResult?.userErrors?.length) throw new Error(priceBody.errors?.[0]?.message || priceResult?.userErrors?.map(item => item.message).join('; ') || 'Shopify price update failed');
  await sequelize.query(`UPDATE growth_opportunities SET shopify_status='imported',shopify_product_ref=$2,updated_at=NOW() WHERE id=$1`, { bind: [opportunity.id, product.id] });
  return { summary: { productTitle: product.title, status: 'DRAFT', price: opportunity.selling_price }, externalReference: product.id };
}

async function applyEvidence(opportunity, response) {
  const items = response.evidence || response.items || [];
  let imported = 0;
  for (const item of items.slice(0, 100)) {
    if (!item.sourceUrl || !item.creatorHandle || !item.publishedAt) continue;
    await sequelize.query(`INSERT INTO growth_social_evidence(opportunity_id,platform,source_url,creator_handle,published_at,views,likes,comments,purchase_intent_comments,evidence_excerpt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(opportunity_id,source_url) DO UPDATE SET views=EXCLUDED.views,likes=EXCLUDED.likes,comments=EXCLUDED.comments,purchase_intent_comments=EXCLUDED.purchase_intent_comments,evidence_excerpt=EXCLUDED.evidence_excerpt,captured_at=NOW()`, {
      bind: [opportunity.id, ['tiktok','instagram','youtube','facebook'].includes(item.platform) ? item.platform : 'other', item.sourceUrl, item.creatorHandle, item.publishedAt, number(item.views), number(item.likes), number(item.comments), number(item.purchaseIntentComments), item.evidenceExcerpt || ''],
    }); imported += 1;
  }
  const [aggregate] = await sequelize.query(`SELECT COALESCE(SUM(views),0)::int views,COUNT(DISTINCT creator_handle)::int creators,COALESCE(SUM(purchase_intent_comments),0)::int intent,GREATEST(0,CURRENT_DATE-MAX(published_at))::int age FROM growth_social_evidence WHERE opportunity_id=$1`, { bind: [opportunity.id], type: QueryTypes.SELECT });
  const demand = bounded(Math.round(Math.min(40, Math.log10(Math.max(number(aggregate.views),1))*6.5)+Math.min(22,number(aggregate.creators)*3.5)+Math.min(23,Math.log10(Math.max(number(aggregate.intent),1))*8.5)+(number(aggregate.age)<=30?10:number(aggregate.age)<=90?7:number(aggregate.age)<=180?3:0)+(opportunity.evergreen?5:0)),0,100);
  const readiness = bounded(Math.round(demand*.35+number(opportunity.problem_solution_score)*.2+number(opportunity.supplier_score)*.2+number(opportunity.margin_score)*.25),0,100);
  await sequelize.query(`UPDATE growth_opportunities SET evidence_views=$2,creator_count=$3,purchase_intent_comments=$4,trend_age_days=$5,demand_score=$6,readiness_score=$7,recommendation=CASE WHEN $7>=82 THEN 'advance' WHEN $7>=68 THEN 'review' ELSE 'reject' END,updated_at=NOW() WHERE id=$1`, { bind: [opportunity.id,aggregate.views,aggregate.creators,aggregate.intent,aggregate.age,demand,readiness] });
  return { imported, demandScore: demand, readinessScore: readiness };
}

async function applySuppliers(opportunity, response) {
  const items = response.suppliers || response.items || [];
  let imported = 0;
  for (const item of items.slice(0, 100)) {
    if (!item.name || number(item.deliveryDays) <= 0) continue;
    const score = bounded(Math.round(number(item.rating)/5*35+number(item.onTimeRate)/100*40+Math.max(0,15-number(item.deliveryDays))+Math.max(0,10-number(item.disputeRate)*2)),0,100);
    await sequelize.query(`INSERT INTO growth_suppliers(opportunity_id,name,marketplace,product_url,unit_cost,shipping_cost,delivery_days,rating,order_count,on_time_rate,dispute_rate,stock_status,reliability_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(opportunity_id,name) DO UPDATE SET marketplace=EXCLUDED.marketplace,product_url=EXCLUDED.product_url,unit_cost=EXCLUDED.unit_cost,shipping_cost=EXCLUDED.shipping_cost,delivery_days=EXCLUDED.delivery_days,rating=EXCLUDED.rating,order_count=EXCLUDED.order_count,on_time_rate=EXCLUDED.on_time_rate,dispute_rate=EXCLUDED.dispute_rate,stock_status=EXCLUDED.stock_status,reliability_score=EXCLUDED.reliability_score`, {
      bind: [opportunity.id,item.name,item.marketplace||'Connector',item.productUrl||'',number(item.unitCost),number(item.shippingCost),number(item.deliveryDays),number(item.rating),number(item.orderCount),number(item.onTimeRate),number(item.disputeRate),['available','limited','unavailable'].includes(item.stockStatus)?item.stockStatus:'available',score],
    }); imported += 1;
  }
  return { imported };
}

async function applyVideo(opportunity, response) {
  const creativeId = response.creativeId || opportunity.creatives.find(item => item.status === 'approved' || item.status === 'draft')?.id;
  const renderUrl = response.renderUrl || response.videoUrl;
  if (!creativeId || !renderUrl) throw new Error('Video connector must return creativeId and renderUrl');
  await sequelize.query(`UPDATE growth_creative_assets SET status='ready',render_url=$2,provider_job_ref=$3,updated_at=NOW() WHERE id=$1 AND opportunity_id=$4`, { bind: [creativeId,renderUrl,response.jobRef||response.id||null,opportunity.id] });
  return { creativeId, renderReady: true };
}

async function applyAds(opportunity, response, connector) {
  const items = response.experiments || response.items || [];
  let imported = 0;
  for (const item of items.slice(0,100)) {
    if (!item.experimentName) continue;
    const channel = connector === 'meta_ads' ? 'meta_ads' : 'tiktok_ads';
    await sequelize.query(`INSERT INTO growth_experiments(opportunity_id,channel,experiment_name,daily_budget,spend,impressions,clicks,sessions,add_to_carts,purchases,revenue,status,started_at,ended_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(opportunity_id,experiment_name) DO UPDATE SET daily_budget=EXCLUDED.daily_budget,spend=EXCLUDED.spend,impressions=EXCLUDED.impressions,clicks=EXCLUDED.clicks,sessions=EXCLUDED.sessions,add_to_carts=EXCLUDED.add_to_carts,purchases=EXCLUDED.purchases,revenue=EXCLUDED.revenue,status=EXCLUDED.status,ended_at=EXCLUDED.ended_at`, {
      bind: [opportunity.id,channel,item.experimentName,number(item.dailyBudget),number(item.spend),number(item.impressions),number(item.clicks),number(item.sessions),number(item.addToCarts),number(item.purchases),number(item.revenue),['planned','active','passed','failed','paused'].includes(item.status)?item.status:'active',item.startedAt||new Date(),item.endedAt||null],
    }); imported += 1;
  }
  return { imported };
}

router.get('/status', (_req, res) => res.json(Object.keys(CONNECTORS).map(configuration)));

router.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await sequelize.query(`SELECT j.*,o.name product_name FROM growth_connector_jobs j LEFT JOIN growth_opportunities o ON o.id=j.opportunity_id WHERE ($1::bigint IS NULL OR j.opportunity_id=$1) ORDER BY j.created_at DESC LIMIT 100`, { bind: [req.query.opportunityId||null], type: QueryTypes.SELECT });
    res.json(jobs);
  } catch (error) { next(error); }
});

router.post('/:key/run', async (req, res, next) => {
  const key = req.params.key;
  if (!CONNECTORS[key]) return res.status(404).json({ error: 'Unknown connector' });
  try {
    const opportunity = await snapshot(req.body?.opportunityId);
    if (!opportunity) return res.status(404).json({ error: 'Product opportunity not found' });
    const config = configuration(key);
    if (!config.configured) {
      const job = await createJob({ opportunityId: opportunity.id, connector:key, operation:config.operation, status:'configuration_required', payload:{ product:opportunity.name }, userId:req.user.id, errorMessage:`Missing ${config.missing.join(', ')}` });
      return res.status(409).json({ error:'Connector configuration required', missing:config.missing, job });
    }
    const job = await createJob({ opportunityId:opportunity.id, connector:key, operation:config.operation, status:'running', payload:{ product:opportunity.name }, userId:req.user.id });
    try {
      let outcome;
      if (key === 'shopify') outcome = await shopifyImport(opportunity);
      else {
        const envPrefix = { social_evidence:['SOCIAL_EVIDENCE_API_URL','SOCIAL_EVIDENCE_API_TOKEN'], supplier_catalog:['SUPPLIER_CATALOG_API_URL','SUPPLIER_CATALOG_API_TOKEN'], ugc_video:['UGC_VIDEO_API_URL','UGC_VIDEO_API_TOKEN'], social_publishing:['SOCIAL_PUBLISHING_API_URL','SOCIAL_PUBLISHING_API_TOKEN'], meta_ads:['META_ADS_CONNECTOR_URL','META_ADS_ACCESS_TOKEN'], tiktok_ads:['TIKTOK_ADS_CONNECTOR_URL','TIKTOK_ADS_ACCESS_TOKEN'] }[key];
        const response = await callConfigured(envPrefix[0],envPrefix[1],{ operation:config.operation, opportunity, options:req.body?.options||{} });
        const applied = key==='social_evidence'?await applyEvidence(opportunity,response):key==='supplier_catalog'?await applySuppliers(opportunity,response):key==='ugc_video'?await applyVideo(opportunity,response):['meta_ads','tiktok_ads'].includes(key)?await applyAds(opportunity,response,key):{ scheduled:true };
        outcome = { summary:applied, externalReference:response.jobRef||response.id||response.externalReference||null };
      }
      const completed = await finishJob(job.id,{ status:'completed', summary:outcome.summary, externalReference:outcome.externalReference });
      return res.json({ success:true, job:completed });
    } catch (error) {
      const failed = await finishJob(job.id,{ status:'failed', errorMessage:error.message });
      return res.status(502).json({ error:error.message, job:failed });
    }
  } catch (error) { next(error); }
});

export default router;
