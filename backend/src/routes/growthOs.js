import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const STAGES = ['discovery', 'validated', 'supplier_ready', 'creative_ready', 'organic_test', 'paid_test', 'scale', 'rejected'];
const TRANSITIONS = {
  discovery: ['validated', 'rejected'],
  validated: ['supplier_ready', 'discovery', 'rejected'],
  supplier_ready: ['creative_ready', 'validated', 'rejected'],
  creative_ready: ['organic_test', 'supplier_ready', 'rejected'],
  organic_test: ['paid_test', 'creative_ready', 'rejected'],
  paid_test: ['scale', 'organic_test', 'rejected'],
  scale: ['paid_test'],
  rejected: ['discovery'],
};

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bounded = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, places = 2) => Number(value.toFixed(places));

function calculateEconomics(input) {
  const sellingPrice = number(input.sellingPrice ?? input.selling_price);
  const unitCost = number(input.unitCost ?? input.unit_cost);
  const shippingCost = number(input.shippingCost ?? input.shipping_cost);
  const feeRate = number(input.transactionFeeRate ?? input.transaction_fee_rate, 0.029);
  const targetCpa = number(input.targetCpa ?? input.target_cpa);
  if (sellingPrice <= 0 || unitCost < 0 || shippingCost < 0 || feeRate < 0 || feeRate > 1 || targetCpa < 0) {
    throw new Error('Valid non-negative unit economics and a selling price greater than zero are required');
  }
  const transactionFee = sellingPrice * feeRate;
  const landedCost = unitCost + shippingCost + transactionFee;
  const grossProfitBeforeAds = sellingPrice - landedCost;
  const netProfitPerOrder = grossProfitBeforeAds - targetCpa;
  const grossMarginRate = sellingPrice ? (grossProfitBeforeAds / sellingPrice) * 100 : 0;
  const netMarginRate = sellingPrice ? (netProfitPerOrder / sellingPrice) * 100 : 0;
  const priceMultiple = unitCost + shippingCost ? sellingPrice / (unitCost + shippingCost) : 0;
  const marginScore = bounded(Math.round(grossMarginRate * 1.25 + Math.min(priceMultiple, 3) * 8), 0, 100);
  return {
    sellingPrice: round(sellingPrice), unitCost: round(unitCost), shippingCost: round(shippingCost),
    transactionFeeRate: round(feeRate, 4), transactionFee: round(transactionFee), landedCost: round(landedCost),
    grossProfitBeforeAds: round(grossProfitBeforeAds), breakEvenCpa: round(grossProfitBeforeAds), targetCpa: round(targetCpa),
    netProfitPerOrder: round(netProfitPerOrder), grossMarginRate: round(grossMarginRate, 1),
    netMarginRate: round(netMarginRate, 1), priceMultiple: round(priceMultiple, 2), marginScore,
  };
}

function calculateValidation(input) {
  const evidenceViews = number(input.evidenceViews ?? input.evidence_views);
  const creatorCount = number(input.creatorCount ?? input.creator_count);
  const purchaseIntentComments = number(input.purchaseIntentComments ?? input.purchase_intent_comments);
  const trendAgeDays = number(input.trendAgeDays ?? input.trend_age_days);
  const problemSolutionScore = bounded(Math.round(number(input.problemSolutionScore ?? input.problem_solution_score)), 0, 100);
  const evergreen = input.evergreen === true || input.evergreen === 'true';
  const viewPoints = Math.min(40, Math.log10(Math.max(evidenceViews, 1)) * 6.5);
  const creatorPoints = Math.min(22, creatorCount * 3.5);
  const intentPoints = Math.min(23, Math.log10(Math.max(purchaseIntentComments, 1)) * 8.5);
  const recencyPoints = trendAgeDays <= 30 ? 10 : trendAgeDays <= 90 ? 7 : trendAgeDays <= 180 ? 3 : 0;
  const demandScore = bounded(Math.round(viewPoints + creatorPoints + intentPoints + recencyPoints + (evergreen ? 5 : 0)), 0, 100);
  return { evidenceViews, creatorCount, purchaseIntentComments, trendAgeDays, evergreen, problemSolutionScore, demandScore };
}

function parseProviderJson(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* use the embedded object below */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return {
    headline: 'Provider analysis completed',
    executiveSummary: cleaned || 'No narrative was returned.',
    risk: 'REVIEW', confidence: 0, metrics: [], sections: [],
    actions: ['Validate the provider response against source evidence before advancing the product.'],
  };
}

async function callOpenRouter(system, payload) {
  const { OPENROUTER_API_KEY: key, OPENROUTER_MODEL: model, OPENROUTER_BASE_URL: base } = process.env;
  if (!key || !model || base !== 'https://openrouter.ai/api/v1') throw new Error('OpenRouter runtime configuration is incomplete');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost', 'X-Title': 'AI Commerce Growth OS' },
    body: JSON.stringify({
      model, temperature: 0.2, max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}`);
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned no usable content');
  return { result: parseProviderJson(content), model: body.model || model };
}

async function opportunitySnapshot(id) {
  const opportunities = await sequelize.query(`
    SELECT o.*,
      COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.selected DESC, s.reliability_score DESC) FROM growth_suppliers s WHERE s.opportunity_id=o.id),'[]'::jsonb) suppliers,
      COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.published_at DESC) FROM growth_social_evidence e WHERE e.opportunity_id=o.id),'[]'::jsonb) evidence,
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM growth_experiments x WHERE x.opportunity_id=o.id),'[]'::jsonb) experiments
    FROM growth_opportunities o WHERE o.id=$1`, { bind: [id], type: QueryTypes.SELECT });
  return opportunities[0] || null;
}

router.get('/overview', async (_req, res, next) => {
  try {
    const [summary] = await sequelize.query(`
      SELECT COUNT(*)::int opportunities,
        COUNT(*) FILTER (WHERE recommendation='advance')::int advance_count,
        COUNT(*) FILTER (WHERE stage='scale')::int scaling_count,
        ROUND(AVG(readiness_score),1) average_readiness,
        COALESCE(SUM((SELECT COALESCE(SUM(revenue),0) FROM growth_experiments x WHERE x.opportunity_id=o.id)),0) measured_revenue,
        COALESCE(SUM((SELECT COALESCE(SUM(spend),0) FROM growth_experiments x WHERE x.opportunity_id=o.id)),0) measured_spend
      FROM growth_opportunities o`, { type: QueryTypes.SELECT });
    const stages = await sequelize.query(`SELECT stage,COUNT(*)::int count FROM growth_opportunities GROUP BY stage ORDER BY MIN(id)`, { type: QueryTypes.SELECT });
    res.json({ summary, stages });
  } catch (error) { next(error); }
});

router.get('/opportunities', async (req, res, next) => {
  try {
    const stage = req.query.stage && STAGES.includes(req.query.stage) ? req.query.stage : null;
    const rows = await sequelize.query(`
      SELECT o.*,
        (SELECT COUNT(*)::int FROM growth_social_evidence e WHERE e.opportunity_id=o.id) evidence_count,
        (SELECT COUNT(*)::int FROM growth_suppliers s WHERE s.opportunity_id=o.id) supplier_count,
        (SELECT COUNT(*)::int FROM growth_creative_assets c WHERE c.opportunity_id=o.id) creative_count,
        (SELECT COALESCE(SUM(x.revenue),0) FROM growth_experiments x WHERE x.opportunity_id=o.id) measured_revenue,
        (SELECT COALESCE(SUM(x.spend),0) FROM growth_experiments x WHERE x.opportunity_id=o.id) measured_spend
      FROM growth_opportunities o WHERE ($1::text IS NULL OR o.stage=$1) ORDER BY o.readiness_score DESC,o.id`,
      { bind: [stage], type: QueryTypes.SELECT });
    res.json(rows);
  } catch (error) { next(error); }
});

router.get('/opportunities/:id', async (req, res, next) => {
  try {
    const row = await opportunitySnapshot(req.params.id);
    if (!row) return res.status(404).json({ error: 'Product opportunity not found' });
    const creatives = await sequelize.query(`SELECT * FROM growth_creative_assets WHERE opportunity_id=$1 ORDER BY created_at DESC`, { bind: [req.params.id], type: QueryTypes.SELECT });
    const plans = await sequelize.query(`SELECT * FROM growth_validation_plans WHERE opportunity_id=$1 ORDER BY plan_type,day_start`, { bind: [req.params.id], type: QueryTypes.SELECT });
    const decisions = await sequelize.query(`SELECT id,analysis_type,result,provider,model,created_at FROM growth_ai_decisions WHERE opportunity_id=$1 ORDER BY created_at DESC LIMIT 10`, { bind: [req.params.id], type: QueryTypes.SELECT });
    res.json({ ...row, creatives, plans, decisions });
  } catch (error) { next(error); }
});

router.post('/opportunities', async (req, res, next) => {
  try {
    const required = ['name', 'category', 'problemStatement', 'targetAudience', 'sellingPrice'];
    if (required.some(key => !req.body?.[key])) return res.status(400).json({ error: 'Name, category, problem, audience, and selling price are required' });
    const validation = calculateValidation(req.body);
    const supplierScore = bounded(Math.round(number(req.body.supplierScore, 0)), 0, 100);
    const economics = calculateEconomics(req.body);
    const readinessScore = bounded(Math.round(validation.demandScore * .35 + validation.problemSolutionScore * .2 + supplierScore * .2 + economics.marginScore * .25), 0, 100);
    const recommendation = readinessScore >= 82 ? 'advance' : readinessScore >= 68 ? 'review' : 'reject';
    const nextAction = recommendation === 'advance' ? 'Compare suppliers and confirm delivered economics' : recommendation === 'review' ? 'Collect stronger evidence before spending' : 'Archive or materially revise the offer';
    const [row] = await sequelize.query(`
      INSERT INTO growth_opportunities(name,category,problem_statement,target_audience,selling_price,evidence_views,creator_count,purchase_intent_comments,trend_age_days,evergreen,problem_solution_score,demand_score,supplier_score,margin_score,readiness_score,recommendation,next_action)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`, {
      bind: [String(req.body.name).trim(), String(req.body.category).trim(), String(req.body.problemStatement).trim(), String(req.body.targetAudience).trim(), economics.sellingPrice, validation.evidenceViews, validation.creatorCount, validation.purchaseIntentComments, validation.trendAgeDays, validation.evergreen, validation.problemSolutionScore, validation.demandScore, supplierScore, economics.marginScore, readinessScore, recommendation, nextAction],
      type: QueryTypes.SELECT,
    });
    await sequelize.query(`INSERT INTO growth_validation_plans(opportunity_id,plan_type,day_start,day_end,objective,success_metric,target_value,status) VALUES
      ($1,'organic_30_day',1,7,'Publish three problem-solution hooks','qualified_sessions',150,'planned'),
      ($1,'organic_30_day',8,14,'Repeat the strongest hook across two creators','purchase_intent_comments',25,'planned'),
      ($1,'organic_30_day',15,21,'Test proof, comparison and testimonial angles','add_to_carts',18,'planned'),
      ($1,'organic_30_day',22,30,'Confirm repeatable demand before paid spend','organic_purchases',8,'planned'),
      ($1,'paid_test',1,3,'Test three creatives at controlled spend','max_cpa',$2,'planned'),
      ($1,'paid_test',4,7,'Concentrate spend on a statistically useful winner','minimum_roas',1.8,'planned')
      ON CONFLICT(opportunity_id,plan_type,day_start) DO NOTHING`, { bind: [row.id, economics.breakEvenCpa] });
    res.status(201).json({ opportunity: row, economics });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      const [existingOpportunity] = await sequelize.query(`SELECT id,name,readiness_score,stage FROM growth_opportunities WHERE LOWER(name)=LOWER($1) LIMIT 1`, {
        bind: [String(req.body?.name || '').trim()], type: QueryTypes.SELECT,
      });
      return res.status(409).json({
        error: 'A product opportunity with this name already exists',
        code: 'OPPORTUNITY_EXISTS',
        existingOpportunity: existingOpportunity || null,
      });
    }
    next(error);
  }
});

router.post('/economics/calculate', (req, res) => {
  try { res.json(calculateEconomics(req.body || {})); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

router.get('/suppliers', async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT s.*,o.name product_name,o.selling_price,
        ROUND((s.unit_cost+s.shipping_cost+(o.selling_price*s.transaction_fee_rate))::numeric,2) landed_cost,
        ROUND((o.selling_price-s.unit_cost-s.shipping_cost-(o.selling_price*s.transaction_fee_rate))::numeric,2) break_even_cpa
      FROM growth_suppliers s JOIN growth_opportunities o ON o.id=s.opportunity_id
      WHERE ($1::bigint IS NULL OR s.opportunity_id=$1) ORDER BY o.name,s.selected DESC,s.reliability_score DESC`,
      { bind: [req.query.opportunityId || null], type: QueryTypes.SELECT });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/suppliers', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { opportunityId, name, marketplace, productUrl = '', unitCost, shippingCost = 0, deliveryDays, rating, orderCount = 0, onTimeRate, disputeRate = 0, stockStatus = 'available' } = req.body || {};
    if (!opportunityId || !name || !marketplace || number(unitCost, -1) < 0 || number(deliveryDays) <= 0 || number(rating, -1) < 0 || number(rating) > 5 || number(onTimeRate, -1) < 0 || number(onTimeRate) > 100) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Product, supplier name, source, cost, delivery days, rating, and on-time rate are required' });
    }
    const reliabilityScore = bounded(Math.round(number(rating) / 5 * 35 + number(onTimeRate) / 100 * 40 + Math.max(0, 15 - number(deliveryDays)) + Math.max(0, 10 - number(disputeRate) * 2)), 0, 100);
    const [row] = await sequelize.query(`INSERT INTO growth_suppliers(opportunity_id,name,marketplace,product_url,unit_cost,shipping_cost,delivery_days,rating,order_count,on_time_rate,dispute_rate,stock_status,reliability_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT(opportunity_id,name) DO UPDATE SET marketplace=EXCLUDED.marketplace,product_url=EXCLUDED.product_url,unit_cost=EXCLUDED.unit_cost,shipping_cost=EXCLUDED.shipping_cost,delivery_days=EXCLUDED.delivery_days,rating=EXCLUDED.rating,order_count=EXCLUDED.order_count,on_time_rate=EXCLUDED.on_time_rate,dispute_rate=EXCLUDED.dispute_rate,stock_status=EXCLUDED.stock_status,reliability_score=EXCLUDED.reliability_score
      RETURNING *`, {
      bind: [opportunityId, String(name).trim(), String(marketplace).trim(), productUrl, number(unitCost), number(shippingCost), number(deliveryDays), number(rating), number(orderCount), number(onTimeRate), number(disputeRate), stockStatus, reliabilityScore], type: QueryTypes.SELECT, transaction,
    });
    const [opportunity] = await sequelize.query(`SELECT id,name,category,target_audience,selling_price,stage,readiness_score FROM growth_opportunities WHERE id=$1`, {
      bind: [opportunityId], type: QueryTypes.SELECT, transaction,
    });
    if (!opportunity) throw new Error('Product opportunity not found');
    const economics = calculateEconomics({
      sellingPrice: opportunity.selling_price,
      unitCost: row.unit_cost,
      shippingCost: row.shipping_cost,
      transactionFeeRate: row.transaction_fee_rate,
      targetCpa: 0,
    });
    const provider = await callOpenRouter(
      'You are a dropshipping supplier-risk committee. Return only complete valid JSON with keys headline, executiveSummary, risk (LOW|MODERATE|HIGH), confidence (0-100), metrics (exactly 4 objects with label, value, and one-sentence interpretation), sections (exactly 4 objects with title and detail of at most 70 words), actions (at most 5 concise strings), stageDecision (APPROVE|REVIEW|REJECT), and evidenceGaps (at most 4 strings). Use only the supplied supplier history, delivery, dispute, order-volume, product, and calculated economics. Do not invent certifications, inventory, quality inspections, contractual protections, or marketplace facts.',
      { workflow: 'supplier_candidate_review', opportunity, supplier: row, economics },
    );
    const [decision] = await sequelize.query(`INSERT INTO growth_ai_decisions(opportunity_id,analysis_type,input_snapshot,result,model,created_by) VALUES($1,'supplier_candidate_review',$2::jsonb,$3::jsonb,$4,$5) RETURNING id,created_at`, {
      bind: [opportunityId, JSON.stringify({ opportunity, supplier: row, economics }), JSON.stringify(provider.result), provider.model, req.user.id], type: QueryTypes.SELECT, transaction,
    });
    await transaction.commit();
    res.status(201).json({ supplier: row, economics, aiReview: { result: provider.result, provider: 'openrouter', model: provider.model, persisted: decision } });
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'This supplier is already linked to the product' });
    console.error('Supplier AI review failed:', error.message);
    if (String(error.message).includes('OpenRouter')) return res.status(502).json({ error: 'OpenRouter could not complete the supplier review; no supplier was saved' });
    next(error);
  }
});

router.post('/suppliers/:id/select', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const [supplier] = await sequelize.query(`SELECT * FROM growth_suppliers WHERE id=$1 FOR UPDATE`, { bind: [req.params.id], type: QueryTypes.SELECT, transaction });
    if (!supplier) { await transaction.rollback(); return res.status(404).json({ error: 'Supplier not found' }); }
    if (supplier.stock_status === 'unavailable') { await transaction.rollback(); return res.status(409).json({ error: 'Unavailable suppliers cannot be selected' }); }
    await sequelize.query(`UPDATE growth_suppliers SET selected=FALSE WHERE opportunity_id=$1`, { bind: [supplier.opportunity_id], transaction });
    await sequelize.query(`UPDATE growth_suppliers SET selected=TRUE WHERE id=$1`, { bind: [supplier.id], transaction });
    const [opportunity] = await sequelize.query(`SELECT demand_score,problem_solution_score,margin_score FROM growth_opportunities WHERE id=$1`, { bind: [supplier.opportunity_id], type: QueryTypes.SELECT, transaction });
    const readiness = bounded(Math.round(number(opportunity.demand_score) * .35 + number(opportunity.problem_solution_score) * .2 + number(supplier.reliability_score) * .2 + number(opportunity.margin_score) * .25), 0, 100);
    const recommendation = readiness >= 82 ? 'advance' : readiness >= 68 ? 'review' : 'reject';
    await sequelize.query(`UPDATE growth_opportunities SET supplier_score=$2,readiness_score=$3,recommendation=$4,updated_at=NOW(),next_action='Review landed economics and prepare storefront import' WHERE id=$1`, { bind: [supplier.opportunity_id, supplier.reliability_score, readiness, recommendation], transaction });
    await transaction.commit();
    res.json({ success: true, supplierId: supplier.id, opportunityId: supplier.opportunity_id });
  } catch (error) { await transaction.rollback(); next(error); }
});

router.post('/opportunities/:id/evidence', async (req, res, next) => {
  try {
    const { platform, sourceUrl, creatorHandle, publishedAt, views = 0, likes = 0, comments = 0, purchaseIntentComments = 0, evidenceExcerpt = '' } = req.body || {};
    if (!['tiktok','instagram','youtube','facebook','other'].includes(platform) || !sourceUrl || !creatorHandle || !publishedAt) return res.status(400).json({ error: 'Platform, source URL, creator, and published date are required' });
    const [row] = await sequelize.query(`INSERT INTO growth_social_evidence(opportunity_id,platform,source_url,creator_handle,published_at,views,likes,comments,purchase_intent_comments,evidence_excerpt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(opportunity_id,source_url) DO UPDATE SET platform=EXCLUDED.platform,creator_handle=EXCLUDED.creator_handle,published_at=EXCLUDED.published_at,views=EXCLUDED.views,likes=EXCLUDED.likes,comments=EXCLUDED.comments,purchase_intent_comments=EXCLUDED.purchase_intent_comments,evidence_excerpt=EXCLUDED.evidence_excerpt,captured_at=NOW()
      RETURNING *`,
      { bind: [req.params.id, platform, sourceUrl, creatorHandle, publishedAt, number(views), number(likes), number(comments), number(purchaseIntentComments), evidenceExcerpt], type: QueryTypes.SELECT });
    const [aggregate] = await sequelize.query(`SELECT COALESCE(SUM(views),0)::int evidence_views,COUNT(DISTINCT creator_handle)::int creator_count,COALESCE(SUM(purchase_intent_comments),0)::int purchase_intent_comments,GREATEST(0,(CURRENT_DATE-MAX(published_at)))::int trend_age_days FROM growth_social_evidence WHERE opportunity_id=$1`, { bind: [req.params.id], type: QueryTypes.SELECT });
    const current = await opportunitySnapshot(req.params.id);
    const scores = calculateValidation({ ...aggregate, evergreen: current.evergreen, problem_solution_score: current.problem_solution_score });
    const readiness = bounded(Math.round(scores.demandScore * .35 + number(current.problem_solution_score) * .2 + number(current.supplier_score) * .2 + number(current.margin_score) * .25), 0, 100);
    const recommendation = readiness >= 82 ? 'advance' : readiness >= 68 ? 'review' : 'reject';
    await sequelize.query(`UPDATE growth_opportunities SET evidence_views=$2,creator_count=$3,purchase_intent_comments=$4,trend_age_days=$5,demand_score=$6,readiness_score=$7,recommendation=$8,updated_at=NOW() WHERE id=$1`, { bind: [req.params.id, scores.evidenceViews, scores.creatorCount, scores.purchaseIntentComments, scores.trendAgeDays, scores.demandScore, readiness, recommendation] });
    res.status(201).json({ evidence: row, validation: { ...scores, readinessScore: readiness, recommendation } });
  } catch (error) { next(error); }
});

router.post('/opportunities/:id/stage', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const [opportunity] = await sequelize.query(`SELECT * FROM growth_opportunities WHERE id=$1 FOR UPDATE`, { bind: [req.params.id], type: QueryTypes.SELECT, transaction });
    if (!opportunity) { await transaction.rollback(); return res.status(404).json({ error: 'Product opportunity not found' }); }
    const toStage = req.body?.stage;
    if (!TRANSITIONS[opportunity.stage]?.includes(toStage)) { await transaction.rollback(); return res.status(409).json({ error: `Transition from ${opportunity.stage} to ${toStage} is not allowed` }); }
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 8) { await transaction.rollback(); return res.status(400).json({ error: 'A meaningful transition reason is required' }); }
    if (toStage === 'supplier_ready' && opportunity.supplier_score < 70) { await transaction.rollback(); return res.status(409).json({ error: 'Supplier readiness must be at least 70' }); }
    if (toStage === 'validated' && opportunity.readiness_score < 68) { await transaction.rollback(); return res.status(409).json({ error: 'Product readiness must be at least 68' }); }
    await sequelize.query(`UPDATE growth_opportunities SET stage=$2,next_action=$3,updated_at=NOW() WHERE id=$1`, { bind: [opportunity.id, toStage, req.body.nextAction || `Complete ${toStage.replaceAll('_',' ')} requirements`], transaction });
    await sequelize.query(`INSERT INTO growth_stage_events(opportunity_id,from_stage,to_stage,reason,actor_id,metrics) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, { bind: [opportunity.id, opportunity.stage, toStage, reason, req.user.id, JSON.stringify({ readinessScore: opportunity.readiness_score, demandScore: opportunity.demand_score, supplierScore: opportunity.supplier_score, marginScore: opportunity.margin_score })], transaction });
    await transaction.commit();
    res.json({ success: true, fromStage: opportunity.stage, toStage });
  } catch (error) { await transaction.rollback(); next(error); }
});

router.post('/opportunities/:id/shopify-import', async (req, res, next) => {
  try {
    const snapshot = await opportunitySnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ error: 'Product opportunity not found' });
    const supplier = snapshot.suppliers.find(item => item.selected);
    if (!supplier) return res.status(409).json({ error: 'Select a supplier before creating a Shopify import' });
    if (!['supplier_ready','creative_ready','organic_test','paid_test','scale'].includes(snapshot.stage)) return res.status(409).json({ error: 'The product has not passed the supplier stage gate' });
    const provider = await callOpenRouter(
      'You are a governed ecommerce merchandising and compliance reviewer. Return only complete valid JSON with keys headline, executiveSummary, risk (LOW|MODERATE|HIGH), confidence (0-100), metrics (exactly 4 objects with label, value, and one-sentence interpretation), sections (exactly 4 objects with title and detail of at most 70 words), actions (at most 5 concise strings), stageDecision (QUEUE|HOLD|REJECT), evidenceGaps (at most 4 strings), productTitle, productDescription, seoTitle, seoDescription, sellingPoints (3 to 5 concise strings), complianceDisclosures (an array), and tags (an array). Use only supplied product, evidence, economics, and selected-supplier data. Avoid unsupported performance, scarcity, shipping, medical, financial, testimonial, and guarantee claims.',
      { workflow: 'shopify_merchandising_draft', opportunity: snapshot, selectedSupplier: supplier },
    );
    const stageDecision = String(provider.result.stageDecision || 'HOLD').toUpperCase();
    const [decision] = await sequelize.query(`INSERT INTO growth_ai_decisions(opportunity_id,analysis_type,input_snapshot,result,model,created_by) VALUES($1,'shopify_merchandising_draft',$2::jsonb,$3::jsonb,$4,$5) RETURNING id,created_at`, {
      bind: [snapshot.id, JSON.stringify({ opportunity: snapshot, selectedSupplier: supplier }), JSON.stringify(provider.result), provider.model, req.user.id], type: QueryTypes.SELECT,
    });
    const aiReview = { result: provider.result, provider: 'openrouter', model: provider.model, persisted: decision };
    if (stageDecision !== 'QUEUE') return res.json({ success: false, status: 'held', message: `OpenRouter placed the Shopify draft on ${stageDecision.toLowerCase()} for human review.`, aiReview });
    const importRef = `local-import-${snapshot.id}-${Date.now()}`;
    const payload = {
      title: provider.result.productTitle || snapshot.name, status: 'draft', productType: snapshot.category,
      description: provider.result.productDescription || snapshot.problem_statement, audience: snapshot.target_audience,
      price: number(snapshot.selling_price), cost: number(supplier.unit_cost) + number(supplier.shipping_cost),
      supplier: { id: supplier.id, name: supplier.name, sourceUrl: supplier.product_url },
      seo: { title: provider.result.seoTitle || snapshot.name, description: provider.result.seoDescription || snapshot.problem_statement },
      sellingPoints: Array.isArray(provider.result.sellingPoints) ? provider.result.sellingPoints : [],
      complianceDisclosures: Array.isArray(provider.result.complianceDisclosures) ? provider.result.complianceDisclosures : [],
      tags: Array.from(new Set(['validated-product', 'growth-os', snapshot.stage, ...(Array.isArray(provider.result.tags) ? provider.result.tags : [])])),
    };
    await sequelize.query(`UPDATE growth_opportunities SET shopify_status='queued',shopify_product_ref=$2,updated_at=NOW() WHERE id=$1`, { bind: [snapshot.id, importRef] });
    res.status(202).json({ success: true, status: 'queued', importRef, payload, message: 'OpenRouter-reviewed draft payload queued for the configured Shopify connector.', aiReview });
  } catch (error) {
    console.error('Shopify AI draft failed:', error.message);
    if (String(error.message).includes('OpenRouter')) return res.status(502).json({ error: 'OpenRouter could not complete the Shopify merchandising draft' });
    next(error);
  }
});

router.get('/creatives', async (req, res, next) => {
  try {
    const rows = await sequelize.query(`SELECT c.*,o.name product_name FROM growth_creative_assets c JOIN growth_opportunities o ON o.id=c.opportunity_id WHERE ($1::bigint IS NULL OR c.opportunity_id=$1) ORDER BY c.created_at DESC`, { bind: [req.query.opportunityId || null], type: QueryTypes.SELECT });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/opportunities/:id/ugc-brief', async (req, res, next) => {
  try {
    const snapshot = await opportunitySnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ error: 'Product opportunity not found' });
    const creativeInput = {
      platform: String(req.body?.platform || '').trim(),
      angle: String(req.body?.angle || '').trim(),
      audienceVoice: String(req.body?.audienceVoice || '').trim(),
      durationSeconds: number(req.body?.durationSeconds),
      callToAction: String(req.body?.callToAction || '').trim(),
      constraints: String(req.body?.constraints || '').trim(),
    };
    if (!['tiktok','instagram','facebook','youtube'].includes(creativeInput.platform) || creativeInput.angle.length < 8 || creativeInput.durationSeconds < 6 || creativeInput.durationSeconds > 90) return res.status(400).json({ error: 'Platform, meaningful creative angle, and duration from 6 to 90 seconds are required' });
    const provider = await callOpenRouter(
      'You are a performance creative director. Return only complete valid JSON with keys headline, hook, angle, script, avatarBrief, productionPrompt, complianceNotes (array of at most 4 strings), shotList (array of at most 6 strings), and successMetrics (array of at most 4 objects with label and value). Keep the entire result under 900 words. Build an authentic vertical UGC brief grounded only in supplied evidence. Do not invent performance claims or missing facts.',
      { workflow: 'ugc_video_production', product: snapshot, creativeInput },
    );
    const result = provider.result;
    const [asset] = await sequelize.query(`INSERT INTO growth_creative_assets(opportunity_id,platform,asset_type,hook,angle,script,avatar_brief,production_prompt,status) VALUES($1,$2,'ugc_brief',$3,$4,$5,$6,$7,'draft') RETURNING *`, {
      bind: [snapshot.id, creativeInput.platform, result.hook || result.headline || 'Evidence-led product demonstration', result.angle || creativeInput.angle, result.script || '', result.avatarBrief || creativeInput.audienceVoice, result.productionPrompt || 'Create an evidence-led vertical product demonstration.'], type: QueryTypes.SELECT,
    });
    await sequelize.query(`INSERT INTO growth_ai_decisions(opportunity_id,analysis_type,input_snapshot,result,model,created_by) VALUES($1,'ugc_brief',$2::jsonb,$3::jsonb,$4,$5)`, { bind: [snapshot.id, JSON.stringify(creativeInput), JSON.stringify(result), provider.model, req.user.id] });
    res.status(201).json({ asset, result, provider: 'openrouter', model: provider.model });
  } catch (error) { console.error('UGC brief generation failed:', error.message); res.status(502).json({ error: 'OpenRouter could not generate the UGC production brief' }); }
});

router.get('/plans', async (req, res, next) => {
  try {
    const rows = await sequelize.query(`SELECT p.*,o.name product_name FROM growth_validation_plans p JOIN growth_opportunities o ON o.id=p.opportunity_id WHERE ($1::bigint IS NULL OR p.opportunity_id=$1) ORDER BY o.name,p.plan_type,p.day_start`, { bind: [req.query.opportunityId || null], type: QueryTypes.SELECT });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/plans/:id/result', async (req, res, next) => {
  try {
    const actualValue = number(req.body?.actualValue, NaN);
    const status = req.body?.status;
    if (!Number.isFinite(actualValue) || !['active','passed','failed','paused'].includes(status)) return res.status(400).json({ error: 'A numeric actual value and valid plan status are required' });
    const [row] = await sequelize.query(`UPDATE growth_validation_plans SET actual_value=$2,status=$3 WHERE id=$1 RETURNING *`, { bind: [req.params.id, actualValue, status], type: QueryTypes.SELECT });
    if (!row) return res.status(404).json({ error: 'Validation plan step not found' });
    res.json(row);
  } catch (error) { next(error); }
});

router.get('/experiments', async (req, res, next) => {
  try {
    const rows = await sequelize.query(`SELECT x.*,o.name product_name,ROUND(CASE WHEN x.purchases>0 THEN x.spend/x.purchases ELSE 0 END,2) cpa,ROUND(CASE WHEN x.spend>0 THEN x.revenue/x.spend ELSE 0 END,2) roas,ROUND(CASE WHEN x.sessions>0 THEN x.purchases::numeric/x.sessions*100 ELSE 0 END,2) conversion_rate FROM growth_experiments x JOIN growth_opportunities o ON o.id=x.opportunity_id WHERE ($1::bigint IS NULL OR x.opportunity_id=$1) ORDER BY x.created_at DESC`, { bind: [req.query.opportunityId || null], type: QueryTypes.SELECT });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/experiments', async (req, res, next) => {
  try {
    const { opportunityId, channel, experimentName, dailyBudget = 0, spend = 0, impressions = 0, clicks = 0, sessions = 0, addToCarts = 0, purchases = 0, revenue = 0, status = 'planned' } = req.body || {};
    if (!opportunityId || !['organic_tiktok','organic_instagram','meta_ads','tiktok_ads'].includes(channel) || !experimentName || !['planned','active','passed','failed','paused'].includes(status)) return res.status(400).json({ error: 'Product, channel, experiment name, and status are required' });
    const [row] = await sequelize.query(`INSERT INTO growth_experiments(opportunity_id,channel,experiment_name,daily_budget,spend,impressions,clicks,sessions,add_to_carts,purchases,revenue,status,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::varchar,CASE WHEN $12::varchar='planned' THEN NULL ELSE NOW() END) RETURNING *`, {
      bind: [opportunityId, channel, String(experimentName).trim(), number(dailyBudget), number(spend), number(impressions), number(clicks), number(sessions), number(addToCarts), number(purchases), number(revenue), status], type: QueryTypes.SELECT,
    });
    res.status(201).json(row);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'An experiment with this name already exists for the product' });
    next(error);
  }
});

router.post('/opportunities/:id/ai-decision', async (req, res, next) => {
  try {
    const snapshot = await opportunitySnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ error: 'Product opportunity not found' });
    const reviewInput = {
      analysisType: String(req.body?.analysisType || '').trim(),
      objective: String(req.body?.objective || '').trim(),
      riskTolerance: String(req.body?.riskTolerance || '').trim(),
      decisionHorizon: String(req.body?.decisionHorizon || '').trim(),
      notes: String(req.body?.notes || '').trim(),
    };
    if (!['full_validation','downside_review','exception_review'].includes(reviewInput.analysisType) || reviewInput.objective.length < 12 || !['balanced','conservative','minimal'].includes(reviewInput.riskTolerance) || !reviewInput.decisionHorizon) return res.status(400).json({ error: 'Analysis type, meaningful objective, risk tolerance, and decision horizon are required' });
    const provider = await callOpenRouter(
      'You are a disciplined dropshipping investment committee. Return only complete valid JSON with keys headline, executiveSummary, risk (LOW|MODERATE|HIGH), confidence (0-100), metrics (exactly 4 objects with label, value, and one-sentence interpretation), sections (exactly 4 objects with title and detail of at most 70 words), actions (at most 5 concise strings), stageDecision (ADVANCE|HOLD|REJECT), and evidenceGaps (at most 4 strings). Keep the entire result under 1100 words. Use only supplied evidence and calculated values. Do not estimate missing costs, benchmarks, saturation, or performance.',
      { workflow: 'product_stage_gate', reviewInput, opportunity: snapshot },
    );
    const [decision] = await sequelize.query(`INSERT INTO growth_ai_decisions(opportunity_id,analysis_type,input_snapshot,result,model,created_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6) RETURNING id,created_at`, {
      bind: [snapshot.id, reviewInput.analysisType, JSON.stringify({ reviewInput, opportunity: snapshot }), JSON.stringify(provider.result), provider.model, req.user.id], type: QueryTypes.SELECT,
    });
    res.json({ result: provider.result, provider: 'openrouter', model: provider.model, persisted: decision });
  } catch (error) { console.error('Growth decision failed:', error.message); res.status(502).json({ error: 'OpenRouter could not complete the product decision' }); }
});

export default router;
