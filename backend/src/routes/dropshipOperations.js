import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  PURCHASE_TRANSITIONS, SHIPMENT_TRANSITIONS, assertTransition,
  calculateCatalogControl, calculatePurchaseCost, canRouteOrder, numeric,
} from '../services/dropshipOperationsCore.js';

const router = Router();
router.use(authenticateToken);

const allowed = (value, values) => values.includes(value);
const ref = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

async function event(entityType, entityId, action, actorId, details = {}, transaction) {
  await sequelize.query(`INSERT INTO dropship_operation_events(entity_type,entity_id,action,actor_id,details) VALUES($1,$2,$3,$4,$5::jsonb)`, {
    bind: [entityType, entityId, action, actorId, JSON.stringify(details)], transaction,
  });
}

async function postProvider(url, token, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || `Provider returned HTTP ${response.status}`);
  return body;
}

const operationConnectors = {
  supplier_ordering: ['SUPPLIER_ORDER_API_URL','SUPPLIER_ORDER_API_TOKEN'],
  catalog_reconciliation: ['DROPSHIP_CATALOG_SYNC_API_URL','DROPSHIP_CATALOG_SYNC_API_TOKEN'],
  shipment_tracking: ['DROPSHIP_TRACKING_API_URL','DROPSHIP_TRACKING_API_TOKEN'],
};

router.get('/integration-status', (_req,res) => {
  res.json(Object.entries(operationConnectors).map(([key,required])=>{
    const missing=required.filter(name=>!String(process.env[name]||'').trim());
    return {key,label:key.replaceAll('_',' '),configured:missing.length===0,missing};
  }));
});

router.get('/overview', async (_req, res, next) => {
  try {
    const [summary] = await sequelize.query(`SELECT
      COUNT(*)::int total_orders,
      COUNT(*) FILTER(WHERE fulfillment_status IN ('unrouted','routing_hold','exception'))::int orders_attention,
      COALESCE(SUM(sales_amount),0)::numeric(12,2) gross_sales,
      COALESCE(SUM(sales_amount) FILTER(WHERE fulfillment_status='delivered'),0)::numeric(12,2) delivered_sales,
      COUNT(*) FILTER(WHERE payment_status='chargeback')::int chargebacks
      FROM dropship_store_orders`, { type: QueryTypes.SELECT });
    const [operations] = await sequelize.query(`SELECT
      (SELECT COUNT(*) FROM dropship_purchase_orders WHERE status IN ('ready','backordered','failed'))::int purchase_attention,
      (SELECT COUNT(*) FROM dropship_shipments WHERE status IN ('delayed','lost'))::int shipment_exceptions,
      (SELECT COUNT(*) FROM dropship_catalog_sync WHERE action_state IN ('review_price','pause_listing'))::int catalog_actions,
      (SELECT COUNT(*) FROM dropship_returns WHERE status='open')::int open_returns,
      (SELECT COUNT(*) FROM dropship_disputes WHERE status IN ('open','evidence_ready','submitted'))::int open_disputes,
      (SELECT COALESCE(SUM(recovered_amount),0) FROM dropship_disputes)::numeric(12,2) dispute_recovery,
      (SELECT COALESCE(SUM(supplier_recovery),0) FROM dropship_returns)::numeric(12,2) return_recovery`, { type: QueryTypes.SELECT });
    res.json({ ...summary, ...operations });
  } catch (error) { next(error); }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const rows = await sequelize.query(`SELECT o.*,g.name product_name,g.category,
      po.id purchase_order_id,po.purchase_ref,po.status purchase_status,s.name supplier_name,
      sh.id shipment_id,sh.carrier,sh.tracking_number,sh.status shipment_status
      FROM dropship_store_orders o JOIN growth_opportunities g ON g.id=o.opportunity_id
      LEFT JOIN dropship_purchase_orders po ON po.store_order_id=o.id
      LEFT JOIN growth_suppliers s ON s.id=po.supplier_id
      LEFT JOIN dropship_shipments sh ON sh.store_order_id=o.id
      ORDER BY o.ordered_at DESC`, { type: QueryTypes.SELECT });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/orders', async (req, res, next) => {
  try {
    const { orderRef, channel='manual', opportunityId, customerRef, destinationCountry='US', quantity=1, salesAmount, shippingCollected=0, paymentStatus='paid', riskStatus='clear' } = req.body || {};
    if (!orderRef || !opportunityId || !customerRef || !allowed(channel,['shopify','amazon','ebay','manual','other']) || !allowed(paymentStatus,['pending','paid','failed','refunded','partially_refunded','chargeback']) || !allowed(riskStatus,['clear','review','hold']) || numeric(quantity) <= 0 || numeric(salesAmount,-1) < 0) return res.status(400).json({ error: 'Valid order reference, channel, product, customer reference, quantity, sales amount, payment and risk status are required' });
    const [row] = await sequelize.query(`INSERT INTO dropship_store_orders(order_ref,channel,opportunity_id,customer_ref,destination_country,quantity,sales_amount,shipping_collected,payment_status,risk_status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, {
      bind: [String(orderRef).trim(),channel,opportunityId,String(customerRef).trim(),String(destinationCountry).trim().toUpperCase().slice(0,2),Math.trunc(numeric(quantity)),numeric(salesAmount),numeric(shippingCollected),paymentStatus,riskStatus,req.user.id], type: QueryTypes.SELECT,
    });
    await event('order',row.id,'order_ingested',req.user.id,{channel,orderRef:row.order_ref});
    res.status(201).json(row);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'This store order already exists' });
    next(error);
  }
});

router.post('/orders/:id/route', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const [order] = await sequelize.query(`SELECT * FROM dropship_store_orders WHERE id=$1 FOR UPDATE`, { bind:[req.params.id],type:QueryTypes.SELECT,transaction });
    if (!order) { await transaction.rollback(); return res.status(404).json({ error:'Store order not found' }); }
    if (!['unrouted','routing_hold','exception'].includes(order.fulfillment_status)) { await transaction.rollback(); return res.status(409).json({ error:'This order has already been routed' }); }
    const [supplier] = await sequelize.query(`SELECT s.*,c.stock_state FROM growth_suppliers s LEFT JOIN dropship_catalog_sync c ON c.supplier_id=s.id WHERE s.opportunity_id=$1 AND s.selected=TRUE ORDER BY c.synced_at DESC NULLS LAST LIMIT 1`, { bind:[order.opportunity_id],type:QueryTypes.SELECT,transaction });
    if (!supplier) { await transaction.rollback(); return res.status(409).json({ error:'Select a primary supplier before routing this order' }); }
    const gate = canRouteOrder({ paymentStatus:order.payment_status,riskStatus:order.risk_status,supplierStockStatus:supplier.stock_status,catalogStockState:supplier.stock_state });
    if (!gate.allowed) {
      await sequelize.query(`UPDATE dropship_store_orders SET fulfillment_status='routing_hold',updated_at=NOW() WHERE id=$1`,{bind:[order.id],transaction});
      await event('order',order.id,'routing_blocked',req.user.id,{reasons:gate.reasons},transaction);
      await transaction.commit(); return res.status(409).json({ error:'Order routing controls did not pass',reasons:gate.reasons });
    }
    const totalCost=calculatePurchaseCost({quantity:order.quantity,unitCost:supplier.unit_cost,shippingCost:supplier.shipping_cost});
    const purchaseRef=ref('PO');
    const [purchase] = await sequelize.query(`INSERT INTO dropship_purchase_orders(purchase_ref,store_order_id,supplier_id,quantity,unit_cost,shipping_cost,total_cost,created_by,expected_delivery_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+($9::int*INTERVAL '1 day')) RETURNING *`, {
      bind:[purchaseRef,order.id,supplier.id,order.quantity,supplier.unit_cost,supplier.shipping_cost,totalCost,req.user.id,supplier.delivery_days],type:QueryTypes.SELECT,transaction,
    });
    await sequelize.query(`UPDATE dropship_store_orders SET fulfillment_status='routed',updated_at=NOW() WHERE id=$1`,{bind:[order.id],transaction});
    await event('order',order.id,'routed_to_supplier',req.user.id,{purchaseRef,supplier:supplier.name,totalCost},transaction);
    await transaction.commit(); res.status(201).json({orderId:order.id,purchaseOrder:purchase});
  } catch (error) { await transaction.rollback(); if(error.name==='SequelizeUniqueConstraintError')return res.status(409).json({error:'A purchase order already exists for this store order'}); next(error); }
});

router.get('/purchase-orders', async (_req,res,next) => {
  try { res.json(await sequelize.query(`SELECT po.*,o.order_ref,o.sales_amount,o.fulfillment_status,g.name product_name,s.name supplier_name,s.marketplace FROM dropship_purchase_orders po JOIN dropship_store_orders o ON o.id=po.store_order_id JOIN growth_opportunities g ON g.id=o.opportunity_id JOIN growth_suppliers s ON s.id=po.supplier_id ORDER BY po.created_at DESC`,{type:QueryTypes.SELECT})); }
  catch(error){next(error);}
});

router.post('/purchase-orders/:id/submit', async (req,res,next) => {
  try {
    const [purchase] = await sequelize.query(`SELECT po.*,o.order_ref,o.destination_country,g.name product_name,s.name supplier_name,s.product_url FROM dropship_purchase_orders po JOIN dropship_store_orders o ON o.id=po.store_order_id JOIN growth_opportunities g ON g.id=o.opportunity_id JOIN growth_suppliers s ON s.id=po.supplier_id WHERE po.id=$1`,{bind:[req.params.id],type:QueryTypes.SELECT});
    if(!purchase)return res.status(404).json({error:'Purchase order not found'});
    if(purchase.status!=='ready')return res.status(409).json({error:'Only ready purchase orders can be submitted'});
    const url=String(process.env.SUPPLIER_ORDER_API_URL||'').trim(),token=String(process.env.SUPPLIER_ORDER_API_TOKEN||'').trim();
    if(!url||!token)return res.status(409).json({error:'Supplier ordering connector is not configured',missing:['SUPPLIER_ORDER_API_URL','SUPPLIER_ORDER_API_TOKEN']});
    const provider=await postProvider(url,token,{operation:'submit_purchase_order',purchaseOrder:purchase});
    const externalReference=provider.externalReference||provider.orderId||provider.id;
    if(!externalReference)throw new Error('Supplier did not return an order reference');
    const [row]=await sequelize.query(`UPDATE dropship_purchase_orders SET status='submitted',external_reference=$2,submitted_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *`,{bind:[purchase.id,String(externalReference)],type:QueryTypes.SELECT});
    await sequelize.query(`UPDATE dropship_store_orders SET fulfillment_status='ordered',updated_at=NOW() WHERE id=$1`,{bind:[purchase.store_order_id]});
    await event('purchase_order',purchase.id,'submitted_to_supplier',req.user.id,{externalReference});
    res.json(row);
  }catch(error){next(error);}
});

router.post('/purchase-orders/:id/status', async (req,res,next) => {
  const transaction=await sequelize.transaction();
  try{
    const [purchase]=await sequelize.query(`SELECT * FROM dropship_purchase_orders WHERE id=$1 FOR UPDATE`,{bind:[req.params.id],type:QueryTypes.SELECT,transaction});
    if(!purchase){await transaction.rollback();return res.status(404).json({error:'Purchase order not found'});}
    const status=req.body?.status; assertTransition(PURCHASE_TRANSITIONS,purchase.status,status,'Purchase order');
    const [row]=await sequelize.query(`UPDATE dropship_purchase_orders SET status=$2::varchar,external_reference=COALESCE($3,external_reference),submitted_at=CASE WHEN $2::varchar='submitted' THEN COALESCE(submitted_at,NOW()) ELSE submitted_at END,updated_at=NOW() WHERE id=$1 RETURNING *`,{bind:[purchase.id,status,req.body?.externalReference||null],type:QueryTypes.SELECT,transaction});
    const fulfillment={submitted:'ordered',accepted:'ordered',backordered:'exception',shipped:'shipped',delivered:'delivered',cancelled:'cancelled',failed:'exception'}[status];
    if(fulfillment)await sequelize.query(`UPDATE dropship_store_orders SET fulfillment_status=$2,updated_at=NOW() WHERE id=$1`,{bind:[purchase.store_order_id,fulfillment],transaction});
    if(status==='shipped')await sequelize.query(`INSERT INTO dropship_shipments(store_order_id,purchase_order_id,carrier,tracking_number,status,last_event,last_sync_at,shipped_at) VALUES($1,$2,$3,$4,'in_transit',$5,NOW(),NOW()) ON CONFLICT(store_order_id) DO UPDATE SET carrier=EXCLUDED.carrier,tracking_number=EXCLUDED.tracking_number,status='in_transit',last_event=EXCLUDED.last_event,last_sync_at=NOW(),shipped_at=COALESCE(dropship_shipments.shipped_at,NOW()),updated_at=NOW()`,{bind:[purchase.store_order_id,purchase.id,req.body?.carrier||'Pending carrier',req.body?.trackingNumber||null,req.body?.lastEvent||'Supplier marked order shipped'],transaction});
    await event('purchase_order',purchase.id,'status_changed',req.user.id,{from:purchase.status,to:status},transaction);
    await transaction.commit();res.json(row);
  }catch(error){await transaction.rollback();if(error.message.includes('cannot transition'))return res.status(409).json({error:error.message});next(error);}
});

router.get('/shipments', async (_req,res,next) => {
  try{res.json(await sequelize.query(`SELECT sh.*,o.order_ref,g.name product_name,po.purchase_ref FROM dropship_shipments sh JOIN dropship_store_orders o ON o.id=sh.store_order_id JOIN growth_opportunities g ON g.id=o.opportunity_id JOIN dropship_purchase_orders po ON po.id=sh.purchase_order_id ORDER BY COALESCE(sh.last_sync_at,sh.created_at) DESC`,{type:QueryTypes.SELECT}));}catch(error){next(error);}
});

router.post('/shipments/:id/sync', async (req,res,next) => {
  const transaction=await sequelize.transaction();
  try{
    const [shipment]=await sequelize.query(`SELECT * FROM dropship_shipments WHERE id=$1 FOR UPDATE`,{bind:[req.params.id],type:QueryTypes.SELECT,transaction});
    if(!shipment){await transaction.rollback();return res.status(404).json({error:'Shipment not found'});}
    const status=req.body?.status; assertTransition(SHIPMENT_TRANSITIONS,shipment.status,status,'Shipment');
    const lastEvent=String(req.body?.lastEvent||'').trim(); if(lastEvent.length<5){await transaction.rollback();return res.status(400).json({error:'A meaningful tracking event is required'});}
    const [row]=await sequelize.query(`UPDATE dropship_shipments SET status=$2::varchar,carrier=COALESCE($3,carrier),tracking_number=COALESCE($4,tracking_number),last_event=$5,last_sync_at=NOW(),delivered_at=CASE WHEN $2::varchar='delivered' THEN NOW() ELSE delivered_at END,updated_at=NOW() WHERE id=$1 RETURNING *`,{bind:[shipment.id,status,req.body?.carrier||null,req.body?.trackingNumber||null,lastEvent],type:QueryTypes.SELECT,transaction});
    const fulfillment=status==='delivered'?'delivered':status==='returned'?'returned':['delayed','lost'].includes(status)?'exception':'shipped';
    await sequelize.query(`UPDATE dropship_store_orders SET fulfillment_status=$2,updated_at=NOW() WHERE id=$1`,{bind:[shipment.store_order_id,fulfillment],transaction});
    if(status==='delivered')await sequelize.query(`UPDATE dropship_purchase_orders SET status='delivered',updated_at=NOW() WHERE id=$1`,{bind:[shipment.purchase_order_id],transaction});
    await event('shipment',shipment.id,'tracking_updated',req.user.id,{from:shipment.status,to:status,lastEvent},transaction);
    await transaction.commit();res.json(row);
  }catch(error){await transaction.rollback();if(error.message.includes('cannot transition'))return res.status(409).json({error:error.message});next(error);}
});

router.post('/shipments/:id/sync-provider', async (req,res,next) => {
  const transaction=await sequelize.transaction();
  try{
    const url=String(process.env.DROPSHIP_TRACKING_API_URL||'').trim(),token=String(process.env.DROPSHIP_TRACKING_API_TOKEN||'').trim();
    if(!url||!token){await transaction.rollback();return res.status(409).json({error:'Shipment tracking connector is not configured',missing:operationConnectors.shipment_tracking});}
    const [shipment]=await sequelize.query(`SELECT sh.*,o.order_ref,po.external_reference supplier_order_ref FROM dropship_shipments sh JOIN dropship_store_orders o ON o.id=sh.store_order_id JOIN dropship_purchase_orders po ON po.id=sh.purchase_order_id WHERE sh.id=$1 FOR UPDATE`,{bind:[req.params.id],type:QueryTypes.SELECT,transaction});
    if(!shipment){await transaction.rollback();return res.status(404).json({error:'Shipment not found'});}
    const provider=await postProvider(url,token,{operation:'track_shipment',shipment});
    const status=provider.status,lastEvent=String(provider.lastEvent||provider.message||'').trim();
    if(!allowed(status,['label_pending','in_transit','out_for_delivery','delivered','delayed','lost','returned'])||lastEvent.length<5)throw new Error('Tracking provider returned an invalid status or event');
    assertTransition(SHIPMENT_TRANSITIONS,shipment.status,status,'Shipment');
    const [row]=await sequelize.query(`UPDATE dropship_shipments SET status=$2::varchar,carrier=COALESCE($3,carrier),tracking_number=COALESCE($4,tracking_number),last_event=$5,last_sync_at=NOW(),delivered_at=CASE WHEN $2::varchar='delivered' THEN NOW() ELSE delivered_at END,updated_at=NOW() WHERE id=$1 RETURNING *`,{bind:[shipment.id,status,provider.carrier||null,provider.trackingNumber||null,lastEvent],type:QueryTypes.SELECT,transaction});
    const fulfillment=status==='delivered'?'delivered':status==='returned'?'returned':['delayed','lost'].includes(status)?'exception':'shipped';
    await sequelize.query(`UPDATE dropship_store_orders SET fulfillment_status=$2,updated_at=NOW() WHERE id=$1`,{bind:[shipment.store_order_id,fulfillment],transaction});
    await event('shipment',shipment.id,'provider_tracking_synchronized',req.user.id,{from:shipment.status,to:status,providerReference:provider.reference||null},transaction);
    await transaction.commit();res.json(row);
  }catch(error){await transaction.rollback();if(error.message.includes('cannot transition'))return res.status(409).json({error:error.message});next(error);}
});

router.get('/catalog', async (_req,res,next) => {
  try{res.json(await sequelize.query(`SELECT c.*,o.name product_name,s.name supplier_name,s.marketplace FROM dropship_catalog_sync c JOIN growth_opportunities o ON o.id=c.opportunity_id JOIN growth_suppliers s ON s.id=c.supplier_id ORDER BY CASE c.action_state WHEN 'pause_listing' THEN 1 WHEN 'review_price' THEN 2 ELSE 3 END,o.name`,{type:QueryTypes.SELECT}));}catch(error){next(error);}
});

router.post('/catalog/sync', async (req,res,next) => {
  try{
    const {opportunityId,supplierId,supplierInventory,supplierUnitCost,previousSupplierCost,storefrontPrice,sourceReference='manual-sync'}=req.body||{};
    if(!opportunityId||!supplierId||numeric(storefrontPrice,-1)<0)return res.status(400).json({error:'Product, supplier, inventory, supplier cost and storefront price are required'});
    const control=calculateCatalogControl({supplierInventory,supplierUnitCost,previousSupplierCost,priceDriftLimit:req.body?.priceDriftLimit});
    const [row]=await sequelize.query(`INSERT INTO dropship_catalog_sync(opportunity_id,supplier_id,supplier_inventory,supplier_unit_cost,storefront_price,previous_supplier_cost,price_drift_percent,stock_state,action_state,source_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(opportunity_id,supplier_id) DO UPDATE SET supplier_inventory=EXCLUDED.supplier_inventory,previous_supplier_cost=dropship_catalog_sync.supplier_unit_cost,supplier_unit_cost=EXCLUDED.supplier_unit_cost,storefront_price=EXCLUDED.storefront_price,price_drift_percent=EXCLUDED.price_drift_percent,stock_state=EXCLUDED.stock_state,action_state=EXCLUDED.action_state,source_reference=EXCLUDED.source_reference,synced_at=NOW() RETURNING *`,{bind:[opportunityId,supplierId,Math.trunc(numeric(supplierInventory)),numeric(supplierUnitCost),numeric(storefrontPrice),numeric(previousSupplierCost,numeric(supplierUnitCost)),control.priceDriftPercent,control.stockState,control.actionState,sourceReference],type:QueryTypes.SELECT});
    await event('catalog_sync',row.id,'catalog_reconciled',req.user.id,control);res.json(row);
  }catch(error){if(error.message.includes('must be non-negative'))return res.status(400).json({error:error.message});next(error);}
});

router.post('/catalog/:id/sync-provider', async (req,res,next) => {
  try{
    const url=String(process.env.DROPSHIP_CATALOG_SYNC_API_URL||'').trim(),token=String(process.env.DROPSHIP_CATALOG_SYNC_API_TOKEN||'').trim();
    if(!url||!token)return res.status(409).json({error:'Catalog reconciliation connector is not configured',missing:operationConnectors.catalog_reconciliation});
    const [current]=await sequelize.query(`SELECT c.*,o.name product_name,s.name supplier_name,s.product_url FROM dropship_catalog_sync c JOIN growth_opportunities o ON o.id=c.opportunity_id JOIN growth_suppliers s ON s.id=c.supplier_id WHERE c.id=$1`,{bind:[req.params.id],type:QueryTypes.SELECT});
    if(!current)return res.status(404).json({error:'Catalog control record not found'});
    const provider=await postProvider(url,token,{operation:'reconcile_catalog',catalog:current});
    const control=calculateCatalogControl({supplierInventory:provider.supplierInventory,supplierUnitCost:provider.supplierUnitCost,previousSupplierCost:current.supplier_unit_cost,priceDriftLimit:provider.priceDriftLimit});
    const [row]=await sequelize.query(`UPDATE dropship_catalog_sync SET supplier_inventory=$2,supplier_unit_cost=$3,previous_supplier_cost=$4,price_drift_percent=$5,stock_state=$6,action_state=$7,source_reference=$8,synced_at=NOW() WHERE id=$1 RETURNING *`,{bind:[current.id,Math.trunc(numeric(provider.supplierInventory)),numeric(provider.supplierUnitCost),current.supplier_unit_cost,control.priceDriftPercent,control.stockState,control.actionState,provider.reference||provider.id||'provider-sync'],type:QueryTypes.SELECT});
    await event('catalog_sync',row.id,'provider_catalog_reconciled',req.user.id,control);res.json(row);
  }catch(error){next(error);}
});

router.get('/returns', async (_req,res,next) => {
  try{res.json(await sequelize.query(`SELECT r.*,o.order_ref,g.name product_name FROM dropship_returns r JOIN dropship_store_orders o ON o.id=r.store_order_id JOIN growth_opportunities g ON g.id=o.opportunity_id ORDER BY r.created_at DESC`,{type:QueryTypes.SELECT}));}catch(error){next(error);}
});

router.post('/returns', async (req,res,next) => {
  try{
    const {storeOrderId,reason,disposition='review',customerRefund=0,supplierRecovery=0,evidenceNotes}=req.body||{};
    if(!storeOrderId||!allowed(reason,['damaged','not_as_described','late_delivery','wrong_item','customer_remorse','lost','other'])||!allowed(disposition,['review','refund_only','return_to_supplier','replacement','deny'])||String(evidenceNotes||'').trim().length<8)return res.status(400).json({error:'Order, reason, disposition and meaningful evidence notes are required'});
    const [row]=await sequelize.query(`INSERT INTO dropship_returns(return_ref,store_order_id,reason,disposition,customer_refund,supplier_recovery,evidence_notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,{bind:[ref('RET'),storeOrderId,reason,disposition,numeric(customerRefund),numeric(supplierRecovery),String(evidenceNotes).trim(),req.user.id],type:QueryTypes.SELECT});
    await event('return',row.id,'return_opened',req.user.id,{reason,disposition});res.status(201).json(row);
  }catch(error){next(error);}
});

router.post('/returns/:id/status', async (req,res,next) => {
  try{const status=req.body?.status;if(!allowed(status,['open','approved','in_transit','resolved','denied']))return res.status(400).json({error:'Valid return status is required'});const [row]=await sequelize.query(`UPDATE dropship_returns SET status=$2::varchar,customer_refund=COALESCE($3,customer_refund),supplier_recovery=COALESCE($4,supplier_recovery),resolved_at=CASE WHEN $2::varchar IN ('resolved','denied') THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1 RETURNING *`,{bind:[req.params.id,status,req.body?.customerRefund??null,req.body?.supplierRecovery??null],type:QueryTypes.SELECT});if(!row)return res.status(404).json({error:'Return not found'});await event('return',row.id,'return_status_changed',req.user.id,{status});res.json(row);}catch(error){next(error);}
});

router.get('/disputes', async (_req,res,next) => {
  try{res.json(await sequelize.query(`SELECT d.*,o.order_ref,g.name product_name,EXTRACT(DAY FROM(d.deadline_at-NOW()))::int days_remaining FROM dropship_disputes d JOIN dropship_store_orders o ON o.id=d.store_order_id JOIN growth_opportunities g ON g.id=o.opportunity_id ORDER BY CASE WHEN d.status IN ('won','lost','resolved') THEN 2 ELSE 1 END,d.deadline_at`,{type:QueryTypes.SELECT}));}catch(error){next(error);}
});

router.post('/disputes', async (req,res,next) => {
  try{const {storeOrderId,disputeType,amount,deadlineAt,evidenceSummary,owner='Operations'}=req.body||{};if(!storeOrderId||!allowed(disputeType,['chargeback','supplier_claim','carrier_claim','platform_hold'])||numeric(amount,-1)<0||!deadlineAt||String(evidenceSummary||'').trim().length<8)return res.status(400).json({error:'Order, dispute type, amount, deadline and evidence summary are required'});const [row]=await sequelize.query(`INSERT INTO dropship_disputes(dispute_ref,store_order_id,dispute_type,amount,deadline_at,evidence_summary,owner,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,{bind:[ref('DSP'),storeOrderId,disputeType,numeric(amount),deadlineAt,String(evidenceSummary).trim(),String(owner).trim(),req.user.id],type:QueryTypes.SELECT});await event('dispute',row.id,'dispute_opened',req.user.id,{disputeType,amount:numeric(amount)});res.status(201).json(row);}catch(error){next(error);}
});

router.post('/disputes/:id/status', async (req,res,next) => {
  try{const status=req.body?.status;if(!allowed(status,['open','evidence_ready','submitted','won','lost','resolved']))return res.status(400).json({error:'Valid dispute status is required'});const [row]=await sequelize.query(`UPDATE dropship_disputes SET status=$2::varchar,recovered_amount=COALESCE($3,recovered_amount),resolved_at=CASE WHEN $2::varchar IN ('won','lost','resolved') THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1 RETURNING *`,{bind:[req.params.id,status,req.body?.recoveredAmount??null],type:QueryTypes.SELECT});if(!row)return res.status(404).json({error:'Dispute not found'});await event('dispute',row.id,'dispute_status_changed',req.user.id,{status,recoveredAmount:row.recovered_amount});res.json(row);}catch(error){next(error);}
});

router.get('/events', async (_req,res,next) => {
  try{res.json(await sequelize.query(`SELECT e.*,u.name actor_name FROM dropship_operation_events e LEFT JOIN users u ON u.id=e.actor_id ORDER BY e.created_at DESC LIMIT 150`,{type:QueryTypes.SELECT}));}catch(error){next(error);}
});

export default router;
