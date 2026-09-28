BEGIN;

CREATE TABLE IF NOT EXISTS dropship_store_orders (
  id BIGSERIAL PRIMARY KEY,
  order_ref VARCHAR(120) UNIQUE NOT NULL,
  channel VARCHAR(40) NOT NULL CHECK (channel IN ('shopify','amazon','ebay','manual','other')),
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id),
  customer_ref VARCHAR(120) NOT NULL,
  destination_country CHAR(2) NOT NULL DEFAULT 'US',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  sales_amount NUMERIC(12,2) NOT NULL CHECK (sales_amount >= 0),
  shipping_collected NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_collected >= 0),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded','chargeback')),
  fulfillment_status VARCHAR(30) NOT NULL DEFAULT 'unrouted' CHECK (fulfillment_status IN ('unrouted','routing_hold','routed','ordered','shipped','delivered','cancelled','exception','returned')),
  risk_status VARCHAR(30) NOT NULL DEFAULT 'clear' CHECK (risk_status IN ('clear','review','hold')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropship_purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  purchase_ref VARCHAR(120) UNIQUE NOT NULL,
  store_order_id BIGINT UNIQUE NOT NULL REFERENCES dropship_store_orders(id) ON DELETE CASCADE,
  supplier_id BIGINT NOT NULL REFERENCES growth_suppliers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total_cost NUMERIC(12,2) NOT NULL CHECK (total_cost >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','submitted','accepted','backordered','cancelled','shipped','delivered','failed')),
  external_reference VARCHAR(180),
  expected_delivery_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropship_shipments (
  id BIGSERIAL PRIMARY KEY,
  store_order_id BIGINT UNIQUE NOT NULL REFERENCES dropship_store_orders(id) ON DELETE CASCADE,
  purchase_order_id BIGINT UNIQUE NOT NULL REFERENCES dropship_purchase_orders(id) ON DELETE CASCADE,
  carrier VARCHAR(80),
  tracking_number VARCHAR(180),
  status VARCHAR(30) NOT NULL DEFAULT 'label_pending' CHECK (status IN ('label_pending','in_transit','out_for_delivery','delivered','delayed','lost','returned')),
  last_event TEXT NOT NULL DEFAULT 'Awaiting supplier fulfillment',
  last_sync_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropship_catalog_sync (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  supplier_id BIGINT NOT NULL REFERENCES growth_suppliers(id) ON DELETE CASCADE,
  supplier_inventory INTEGER NOT NULL DEFAULT 0 CHECK (supplier_inventory >= 0),
  supplier_unit_cost NUMERIC(12,2) NOT NULL CHECK (supplier_unit_cost >= 0),
  storefront_price NUMERIC(12,2) NOT NULL CHECK (storefront_price >= 0),
  previous_supplier_cost NUMERIC(12,2),
  price_drift_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
  stock_state VARCHAR(30) NOT NULL CHECK (stock_state IN ('healthy','low','out_of_stock')),
  action_state VARCHAR(30) NOT NULL DEFAULT 'clear' CHECK (action_state IN ('clear','review_price','pause_listing','resolved')),
  source_reference VARCHAR(180),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id,supplier_id)
);

CREATE TABLE IF NOT EXISTS dropship_returns (
  id BIGSERIAL PRIMARY KEY,
  return_ref VARCHAR(120) UNIQUE NOT NULL,
  store_order_id BIGINT NOT NULL REFERENCES dropship_store_orders(id) ON DELETE CASCADE,
  reason VARCHAR(60) NOT NULL CHECK (reason IN ('damaged','not_as_described','late_delivery','wrong_item','customer_remorse','lost','other')),
  disposition VARCHAR(40) NOT NULL DEFAULT 'review' CHECK (disposition IN ('review','refund_only','return_to_supplier','replacement','deny')),
  customer_refund NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (customer_refund >= 0),
  supplier_recovery NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (supplier_recovery >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','in_transit','resolved','denied')),
  evidence_notes TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropship_disputes (
  id BIGSERIAL PRIMARY KEY,
  dispute_ref VARCHAR(120) UNIQUE NOT NULL,
  store_order_id BIGINT NOT NULL REFERENCES dropship_store_orders(id) ON DELETE CASCADE,
  dispute_type VARCHAR(40) NOT NULL CHECK (dispute_type IN ('chargeback','supplier_claim','carrier_claim','platform_hold')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  recovered_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (recovered_amount >= 0),
  deadline_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','evidence_ready','submitted','won','lost','resolved')),
  evidence_summary TEXT NOT NULL,
  owner VARCHAR(120) NOT NULL DEFAULT 'Operations',
  resolved_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropship_operation_events (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(80) NOT NULL,
  actor_id INTEGER REFERENCES users(id),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dropship_orders_queue_idx ON dropship_store_orders(fulfillment_status,ordered_at DESC);
CREATE INDEX IF NOT EXISTS dropship_po_status_idx ON dropship_purchase_orders(status,created_at DESC);
CREATE INDEX IF NOT EXISTS dropship_shipments_status_idx ON dropship_shipments(status,last_sync_at DESC);
CREATE INDEX IF NOT EXISTS dropship_returns_status_idx ON dropship_returns(status,created_at DESC);
CREATE INDEX IF NOT EXISTS dropship_disputes_deadline_idx ON dropship_disputes(status,deadline_at);
CREATE INDEX IF NOT EXISTS dropship_events_entity_idx ON dropship_operation_events(entity_type,entity_id,created_at DESC);

INSERT INTO dropship_store_orders(order_ref,channel,opportunity_id,customer_ref,destination_country,quantity,sales_amount,shipping_collected,payment_status,fulfillment_status,risk_status,ordered_at)
SELECT x.order_ref,x.channel,o.id,x.customer_ref,x.country,x.quantity,x.sales,x.shipping,x.payment,x.fulfillment,x.risk,NOW()-x.age
FROM growth_opportunities o JOIN (VALUES
 ('DS-24001','shopify','Self-Watering Rocking Planter','CUS-8201','US',1,29.99,0,'paid','delivered','clear',INTERVAL '12 days'),
 ('DS-24002','shopify','Rechargeable Fabric Shaver','CUS-8202','US',2,69.98,0,'paid','shipped','clear',INTERVAL '5 days'),
 ('DS-24003','ebay','Magnetic Cable Organizer','CUS-8203','US',3,74.97,5.99,'paid','ordered','clear',INTERVAL '2 days'),
 ('DS-24004','shopify','Pet Paw Cleaner Cup','CUS-8204','CA',1,32.99,4.99,'paid','routing_hold','review',INTERVAL '6 hours'),
 ('DS-24005','amazon','Portable Blender Bottle','CUS-8205','US',1,49.99,0,'paid','unrouted','clear',INTERVAL '2 hours'),
 ('DS-24006','shopify','Under-Sink Sliding Organizer','CUS-8206','US',1,39.99,0,'paid','delivered','clear',INTERVAL '18 days'),
 ('DS-24007','shopify','Heated Eyelash Curler','CUS-8207','GB',2,55.98,7.99,'paid','unrouted','clear',INTERVAL '90 minutes'),
 ('DS-24008','ebay','Travel Compression Cubes','CUS-8208','US',1,44.99,0,'chargeback','exception','hold',INTERVAL '14 days'),
 ('DS-24009','shopify','Cordless Mini Food Chopper','CUS-8209','US',1,36.99,0,'paid','shipped','clear',INTERVAL '4 days'),
 ('DS-24010','manual','Car Seat Gap Organizer','CUS-8210','US',2,57.98,0,'paid','routed','clear',INTERVAL '1 day'),
 ('DS-24011','shopify','Reusable Lint Roller','CUS-8211','US',3,80.97,0,'partially_refunded','returned','review',INTERVAL '21 days'),
 ('DS-24012','amazon','Neck Reading Light','CUS-8212','US',1,33.99,0,'paid','delivered','clear',INTERVAL '11 days'),
 ('DS-24013','shopify','Silicone Air Fryer Liners','CUS-8213','US',2,47.98,0,'paid','shipped','clear',INTERVAL '3 days'),
 ('DS-24014','shopify','Self-Watering Rocking Planter','CUS-8214','US',2,59.98,0,'paid','unrouted','clear',INTERVAL '45 minutes'),
 ('DS-24015','ebay','Rechargeable Fabric Shaver','CUS-8215','US',1,34.99,3.99,'failed','routing_hold','hold',INTERVAL '30 minutes')
) AS x(order_ref,channel,product,customer_ref,country,quantity,sales,shipping,payment,fulfillment,risk,age) ON o.name=x.product
ON CONFLICT(order_ref) DO NOTHING;

INSERT INTO dropship_purchase_orders(purchase_ref,store_order_id,supplier_id,quantity,unit_cost,shipping_cost,total_cost,status,external_reference,expected_delivery_at,submitted_at)
SELECT 'PO-'||RIGHT(o.order_ref,5),o.id,s.id,o.quantity,s.unit_cost,s.shipping_cost,ROUND((s.unit_cost*o.quantity+s.shipping_cost)::numeric,2),x.status,x.external_ref,NOW()+x.eta,CASE WHEN x.status='ready' THEN NULL ELSE NOW()-INTERVAL '1 day' END
FROM dropship_store_orders o
JOIN growth_suppliers s ON s.opportunity_id=o.opportunity_id AND s.selected=TRUE
JOIN (VALUES
 ('DS-24001','delivered','SUP-84001',INTERVAL '-5 days'),('DS-24002','shipped','SUP-84002',INTERVAL '2 days'),
 ('DS-24003','accepted','SUP-84003',INTERVAL '7 days'),('DS-24006','delivered','SUP-84006',INTERVAL '-9 days'),
 ('DS-24008','delivered','SUP-84008',INTERVAL '-5 days'),('DS-24009','shipped','SUP-84009',INTERVAL '4 days'),
 ('DS-24010','ready',NULL,INTERVAL '6 days'),('DS-24011','delivered','SUP-84011',INTERVAL '-12 days'),
 ('DS-24012','delivered','SUP-84012',INTERVAL '-3 days'),('DS-24013','shipped','SUP-84013',INTERVAL '2 days')
) AS x(order_ref,status,external_ref,eta) ON x.order_ref=o.order_ref
ON CONFLICT(store_order_id) DO NOTHING;

INSERT INTO dropship_shipments(store_order_id,purchase_order_id,carrier,tracking_number,status,last_event,last_sync_at,shipped_at,delivered_at)
SELECT po.store_order_id,po.id,x.carrier,x.tracking,x.status,x.event,NOW()-INTERVAL '20 minutes',NOW()-x.ship_age,CASE WHEN x.status='delivered' THEN NOW()-x.delivery_age ELSE NULL END
FROM dropship_purchase_orders po JOIN dropship_store_orders o ON o.id=po.store_order_id
JOIN (VALUES
 ('DS-24001','USPS','940010000001','delivered','Delivered at front door',INTERVAL '10 days',INTERVAL '6 days'),
 ('DS-24002','UPS','1Z84000002','in_transit','Departed regional facility',INTERVAL '3 days',INTERVAL '0 days'),
 ('DS-24003','YunExpress','YT84000003','label_pending','Supplier confirmed allocation',INTERVAL '0 days',INTERVAL '0 days'),
 ('DS-24006','FedEx','780000000006','delivered','Delivered; photographic proof retained',INTERVAL '16 days',INTERVAL '11 days'),
 ('DS-24008','USPS','940010000008','delivered','Delivered to parcel locker',INTERVAL '12 days',INTERVAL '7 days'),
 ('DS-24009','4PX','4PX84000009','delayed','Customs handoff delayed by one day',INTERVAL '3 days',INTERVAL '0 days'),
 ('DS-24011','USPS','940010000011','returned','Return received by consolidation center',INTERVAL '18 days',INTERVAL '0 days'),
 ('DS-24012','UPS','1Z84000012','delivered','Delivered to customer',INTERVAL '9 days',INTERVAL '5 days'),
 ('DS-24013','USPS','940010000013','in_transit','Moving through network',INTERVAL '2 days',INTERVAL '0 days')
) AS x(order_ref,carrier,tracking,status,event,ship_age,delivery_age) ON x.order_ref=o.order_ref
ON CONFLICT(store_order_id) DO NOTHING;

INSERT INTO dropship_catalog_sync(opportunity_id,supplier_id,supplier_inventory,supplier_unit_cost,storefront_price,previous_supplier_cost,price_drift_percent,stock_state,action_state,source_reference)
SELECT o.id,s.id,x.inventory,x.cost,o.selling_price,x.previous,ROUND(CASE WHEN x.previous>0 THEN ((x.cost-x.previous)/x.previous*100) ELSE 0 END,2),x.stock,x.action,'seed-catalog-'||o.id
FROM growth_opportunities o JOIN growth_suppliers s ON s.opportunity_id=o.id AND s.selected=TRUE
JOIN (VALUES
 ('Self-Watering Rocking Planter',420,11.39,10.90,'healthy','clear'),('Rechargeable Fabric Shaver',88,12.40,11.95,'healthy','review_price'),
 ('Magnetic Cable Organizer',1120,4.30,4.30,'healthy','clear'),('Pet Paw Cleaner Cup',24,10.80,10.80,'low','clear'),
 ('Under-Sink Sliding Organizer',0,15.20,15.20,'out_of_stock','pause_listing'),('Heated Eyelash Curler',62,8.40,8.10,'healthy','clear'),
 ('Travel Compression Cubes',330,13.10,12.80,'healthy','clear'),('Cordless Mini Food Chopper',17,14.90,13.40,'low','review_price'),
 ('Car Seat Gap Organizer',205,9.30,9.30,'healthy','clear'),('Reusable Lint Roller',830,6.20,6.20,'healthy','clear'),
 ('Neck Reading Light',148,11.50,11.00,'healthy','clear'),('Silicone Air Fryer Liners',1400,5.10,5.10,'healthy','clear')
) AS x(product,inventory,cost,previous,stock,action) ON x.product=o.name
ON CONFLICT(opportunity_id,supplier_id) DO NOTHING;

INSERT INTO dropship_returns(return_ref,store_order_id,reason,disposition,customer_refund,supplier_recovery,status,evidence_notes,resolved_at)
SELECT x.ref,o.id,x.reason,x.disposition,x.refund,x.recovery,x.status,x.notes,CASE WHEN x.status='resolved' THEN NOW()-INTERVAL '1 day' ELSE NULL END
FROM dropship_store_orders o JOIN (VALUES
 ('RET-5101','DS-24011','damaged','refund_only',26.99,18.20,'resolved','Customer photograph and delivery packaging retained.'),
 ('RET-5102','DS-24008','not_as_described','return_to_supplier',44.99,0,'open','Listing copy and customer message require comparison.'),
 ('RET-5103','DS-24006','customer_remorse','deny',0,0,'denied','Request submitted outside the published return window.'),
 ('RET-5104','DS-24001','wrong_item','replacement',0,13.10,'resolved','Supplier acknowledged SKU mismatch and shipped replacement.'),
 ('RET-5105','DS-24009','late_delivery','review',0,0,'open','Carrier scan indicates customs delay; promised date review pending.')
) AS x(ref,order_ref,reason,disposition,refund,recovery,status,notes) ON x.order_ref=o.order_ref
ON CONFLICT(return_ref) DO NOTHING;

INSERT INTO dropship_disputes(dispute_ref,store_order_id,dispute_type,amount,recovered_amount,deadline_at,status,evidence_summary,owner,resolved_at)
SELECT x.ref,o.id,x.type,x.amount,x.recovered,NOW()+x.deadline,x.status,x.evidence,x.owner,CASE WHEN x.status IN ('won','lost','resolved') THEN NOW()-INTERVAL '2 days' ELSE NULL END
FROM dropship_store_orders o JOIN (VALUES
 ('DSP-7101','DS-24008','chargeback',44.99,0,INTERVAL '6 days','evidence_ready','Delivery scan, listing snapshot and customer correspondence assembled.','Risk Operations'),
 ('DSP-7102','DS-24011','supplier_claim',26.99,18.20,INTERVAL '-2 days','won','Damage photos and supplier quality guarantee accepted.','Supplier Recovery'),
 ('DSP-7103','DS-24009','carrier_claim',18.40,0,INTERVAL '12 days','open','Delay scans collected; eligibility review pending.','Fulfillment'),
 ('DSP-7104','DS-24015','platform_hold',34.99,0,INTERVAL '3 days','open','Payment failure and fraud-screen evidence retained.','Payments')
) AS x(ref,order_ref,type,amount,recovered,deadline,status,evidence,owner) ON x.order_ref=o.order_ref
ON CONFLICT(dispute_ref) DO NOTHING;

COMMIT;
