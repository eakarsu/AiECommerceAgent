BEGIN;

CREATE TABLE IF NOT EXISTS growth_opportunities (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) UNIQUE NOT NULL,
  category VARCHAR(120) NOT NULL,
  problem_statement TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price > 0),
  evidence_views INTEGER NOT NULL DEFAULT 0 CHECK (evidence_views >= 0),
  creator_count INTEGER NOT NULL DEFAULT 0 CHECK (creator_count >= 0),
  purchase_intent_comments INTEGER NOT NULL DEFAULT 0 CHECK (purchase_intent_comments >= 0),
  trend_age_days INTEGER NOT NULL DEFAULT 0 CHECK (trend_age_days >= 0),
  evergreen BOOLEAN NOT NULL DEFAULT TRUE,
  problem_solution_score INTEGER NOT NULL DEFAULT 0 CHECK (problem_solution_score BETWEEN 0 AND 100),
  demand_score INTEGER NOT NULL DEFAULT 0 CHECK (demand_score BETWEEN 0 AND 100),
  supplier_score INTEGER NOT NULL DEFAULT 0 CHECK (supplier_score BETWEEN 0 AND 100),
  margin_score INTEGER NOT NULL DEFAULT 0 CHECK (margin_score BETWEEN 0 AND 100),
  readiness_score INTEGER NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  stage VARCHAR(40) NOT NULL DEFAULT 'discovery' CHECK (stage IN (
    'discovery','validated','supplier_ready','creative_ready','organic_test','paid_test','scale','rejected'
  )),
  recommendation VARCHAR(40) NOT NULL DEFAULT 'review' CHECK (recommendation IN ('advance','review','reject')),
  next_action TEXT NOT NULL DEFAULT 'Review demand evidence',
  shopify_status VARCHAR(32) NOT NULL DEFAULT 'not_ready' CHECK (shopify_status IN ('not_ready','ready','queued','imported','failed')),
  shopify_product_ref VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS growth_social_evidence (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  platform VARCHAR(40) NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','facebook','other')),
  source_url TEXT NOT NULL,
  creator_handle VARCHAR(180) NOT NULL,
  published_at DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments INTEGER NOT NULL DEFAULT 0 CHECK (comments >= 0),
  purchase_intent_comments INTEGER NOT NULL DEFAULT 0 CHECK (purchase_intent_comments >= 0),
  evidence_excerpt TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id, source_url)
);

CREATE TABLE IF NOT EXISTS growth_suppliers (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  marketplace VARCHAR(80) NOT NULL,
  product_url TEXT,
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  transaction_fee_rate NUMERIC(7,4) NOT NULL DEFAULT 0.029 CHECK (transaction_fee_rate BETWEEN 0 AND 1),
  delivery_days INTEGER NOT NULL CHECK (delivery_days > 0),
  rating NUMERIC(3,2) NOT NULL CHECK (rating BETWEEN 0 AND 5),
  order_count INTEGER NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (on_time_rate BETWEEN 0 AND 100),
  dispute_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (dispute_rate BETWEEN 0 AND 100),
  stock_status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (stock_status IN ('available','limited','unavailable')),
  reliability_score INTEGER NOT NULL DEFAULT 0 CHECK (reliability_score BETWEEN 0 AND 100),
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id, name)
);

CREATE TABLE IF NOT EXISTS growth_creative_assets (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  platform VARCHAR(40) NOT NULL CHECK (platform IN ('tiktok','instagram','facebook','youtube')),
  asset_type VARCHAR(40) NOT NULL CHECK (asset_type IN ('source_video','ugc_brief','script','render')),
  hook TEXT NOT NULL,
  angle TEXT NOT NULL,
  script TEXT,
  source_url TEXT,
  avatar_brief TEXT,
  production_prompt TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('evidence','draft','approved','producing','ready','rejected')),
  predicted_ctr NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS growth_validation_plans (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  plan_type VARCHAR(24) NOT NULL CHECK (plan_type IN ('organic_30_day','paid_test')),
  day_start INTEGER NOT NULL CHECK (day_start > 0),
  day_end INTEGER NOT NULL CHECK (day_end >= day_start),
  objective TEXT NOT NULL,
  success_metric TEXT NOT NULL,
  target_value NUMERIC(12,2) NOT NULL,
  actual_value NUMERIC(12,2),
  status VARCHAR(24) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','passed','failed','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id, plan_type, day_start)
);

CREATE TABLE IF NOT EXISTS growth_experiments (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  channel VARCHAR(40) NOT NULL CHECK (channel IN ('organic_tiktok','organic_instagram','meta_ads','tiktok_ads')),
  experiment_name VARCHAR(180) NOT NULL,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (daily_budget >= 0),
  spend NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  sessions INTEGER NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  add_to_carts INTEGER NOT NULL DEFAULT 0 CHECK (add_to_carts >= 0),
  purchases INTEGER NOT NULL DEFAULT 0 CHECK (purchases >= 0),
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  status VARCHAR(24) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','passed','failed','paused')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id, experiment_name)
);

CREATE TABLE IF NOT EXISTS growth_ai_decisions (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  analysis_type VARCHAR(60) NOT NULL,
  input_snapshot JSONB NOT NULL,
  result JSONB NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'openrouter',
  model VARCHAR(180) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS growth_stage_events (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  from_stage VARCHAR(40) NOT NULL,
  to_stage VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS growth_opportunities_stage_idx ON growth_opportunities(stage, readiness_score DESC);
CREATE INDEX IF NOT EXISTS growth_social_evidence_lookup_idx ON growth_social_evidence(opportunity_id, published_at DESC);
CREATE INDEX IF NOT EXISTS growth_suppliers_compare_idx ON growth_suppliers(opportunity_id, reliability_score DESC);
CREATE INDEX IF NOT EXISTS growth_experiments_lookup_idx ON growth_experiments(opportunity_id, created_at DESC);

INSERT INTO growth_opportunities
  (name,category,problem_statement,target_audience,selling_price,evidence_views,creator_count,purchase_intent_comments,trend_age_days,evergreen,problem_solution_score,demand_score,supplier_score,margin_score,readiness_score,stage,recommendation,next_action,shopify_status)
VALUES
  ('Self-Watering Rocking Planter','Home & Garden','Indoor plants are frequently overwatered or forgotten','Apartment gardeners and gift buyers',29.99,1850000,7,684,18,TRUE,91,94,88,87,91,'paid_test','advance','Complete controlled paid test','imported'),
  ('Rechargeable Fabric Shaver','Home Care','Pilling makes clothing look prematurely worn','Value-conscious apparel owners',34.99,920000,5,318,24,TRUE,88,89,92,90,90,'organic_test','advance','Complete day 15-30 organic validation','imported'),
  ('Magnetic Cable Organizer','Office','Loose charging cables create desk clutter','Remote workers and gamers',24.99,640000,6,201,31,TRUE,83,84,90,86,86,'creative_ready','advance','Approve three creative variants','ready'),
  ('Pet Paw Cleaner Cup','Pet Care','Outdoor debris is tracked inside after walks','Dog owners in urban and wet climates',32.99,1480000,8,522,12,TRUE,94,96,85,82,90,'supplier_ready','advance','Select primary and backup supplier','ready'),
  ('Portable Blender Bottle','Fitness','Healthy drinks are difficult to prepare away from home','Fitness and commuter audiences',49.99,2140000,10,709,19,TRUE,86,95,79,76,84,'validated','review','Resolve supplier reliability risk','not_ready'),
  ('Under-Sink Sliding Organizer','Home Organization','Deep cabinets waste space and hide household items','Homeowners and renters',39.99,810000,5,245,36,TRUE,90,86,91,84,88,'organic_test','advance','Publish remaining organic content','imported'),
  ('Heated Eyelash Curler','Beauty','Traditional curlers provide inconsistent short-lived results','Beauty buyers aged 18-34',27.99,1180000,9,403,14,FALSE,76,88,80,89,83,'creative_ready','review','Validate repeatable creative angle','ready'),
  ('Travel Compression Cubes','Travel','Luggage capacity is lost through inefficient packing','Frequent leisure and business travelers',44.99,735000,6,277,43,TRUE,92,83,93,91,90,'paid_test','advance','Evaluate CPA against break-even','imported'),
  ('Cordless Mini Food Chopper','Kitchen','Small meal-prep tasks require bulky appliances','Busy households and meal preppers',36.99,1330000,7,481,27,TRUE,89,92,84,80,86,'supplier_ready','advance','Negotiate delivered unit cost','ready'),
  ('Sunset Projection Lamp','Decor','Renters want inexpensive ambient room transformation','Students and young apartment renters',31.99,450000,3,89,210,FALSE,59,55,78,82,66,'rejected','reject','Archive stale trend','not_ready'),
  ('Car Seat Gap Organizer','Automotive','Phones and small items fall between vehicle seats','Commuters and rideshare drivers',28.99,690000,5,193,52,TRUE,87,81,89,88,86,'validated','advance','Confirm vehicle fit coverage','not_ready'),
  ('Reusable Lint Roller','Home Care','Pet hair removal creates recurring disposable waste','Pet owners and sustainability buyers',26.99,970000,7,356,29,TRUE,93,90,94,92,92,'scale','advance','Increase winning creative budget 20%','imported'),
  ('Neck Reading Light','Books','Shared rooms make nighttime reading disruptive','Readers, students and travelers',33.99,580000,4,171,61,TRUE,89,79,95,90,88,'organic_test','advance','Measure saves and product-page sessions','imported'),
  ('Silicone Air Fryer Liners','Kitchen','Air fryer cleanup is repetitive and messy','Air fryer owners and busy families',23.99,1020000,8,392,33,TRUE,90,91,96,93,93,'scale','advance','Protect inventory coverage while scaling','imported'),
  ('Posture Reminder Wearable','Wellness','Desk workers forget to correct slouching behavior','Remote professionals with desk discomfort',59.99,390000,4,104,45,TRUE,82,72,70,78,76,'discovery','review','Collect evidence from two more creators','not_ready')
ON CONFLICT(name) DO NOTHING;

INSERT INTO growth_suppliers
  (opportunity_id,name,marketplace,product_url,unit_cost,shipping_cost,delivery_days,rating,order_count,on_time_rate,dispute_rate,stock_status,reliability_score,selected)
SELECT o.id, s.name, s.marketplace, s.url, s.cost, s.shipping, s.days, s.rating, s.orders, s.on_time, s.disputes, s.stock, s.score, s.selected
FROM growth_opportunities o
JOIN (VALUES
 ('Self-Watering Rocking Planter','US Garden Direct','AutoDS','https://supplier.example/rocking-planter-us',11.39,0.00,5,4.82,4821,96.4,1.1,'available',94,TRUE),
 ('Self-Watering Rocking Planter','HomeSource Global','CJdropshipping','https://supplier.example/rocking-planter-cj',8.70,3.90,9,4.65,7910,91.2,2.3,'available',86,FALSE),
 ('Rechargeable Fabric Shaver','TextileCare US','AutoDS','https://supplier.example/fabric-shaver',12.40,1.80,4,4.88,10920,97.1,0.8,'available',96,TRUE),
 ('Magnetic Cable Organizer','DeskWorks','AliExpress','https://supplier.example/cable-organizer',4.30,2.20,11,4.71,22400,90.3,1.9,'available',84,TRUE),
 ('Pet Paw Cleaner Cup','PawSupply Domestic','Spocket','https://supplier.example/paw-cleaner',10.80,3.50,4,4.91,8460,97.8,0.6,'available',97,TRUE),
 ('Portable Blender Bottle','BlendGo Wholesale','CJdropshipping','https://supplier.example/blender',22.60,4.80,12,4.42,6820,83.2,4.8,'limited',69,FALSE),
 ('Under-Sink Sliding Organizer','HomeOrder US','Spocket','https://supplier.example/sink-organizer',15.20,2.90,5,4.79,5100,95.1,1.4,'available',92,TRUE),
 ('Heated Eyelash Curler','BeautyVolt','AutoDS','https://supplier.example/lash-curler',8.40,2.10,7,4.68,12300,92.0,2.2,'available',86,TRUE),
 ('Travel Compression Cubes','PackLight Direct','Spocket','https://supplier.example/compression-cubes',13.10,3.40,5,4.92,9380,98.0,0.5,'available',98,TRUE),
 ('Cordless Mini Food Chopper','KitchenQuick','CJdropshipping','https://supplier.example/food-chopper',14.90,4.20,8,4.70,18820,91.8,1.7,'available',87,TRUE),
 ('Car Seat Gap Organizer','AutoStore US','AutoDS','https://supplier.example/seat-gap',9.30,2.40,6,4.83,14200,95.5,1.0,'available',94,TRUE),
 ('Reusable Lint Roller','CleanLoop','Spocket','https://supplier.example/lint-roller',6.20,2.00,4,4.94,31600,98.6,0.4,'available',99,TRUE),
 ('Neck Reading Light','ReadBright','AutoDS','https://supplier.example/reading-light',11.50,2.30,5,4.89,20300,97.3,0.7,'available',97,TRUE),
 ('Silicone Air Fryer Liners','KitchenLoop','Spocket','https://supplier.example/air-fryer-liners',5.10,1.60,4,4.96,45500,98.9,0.3,'available',99,TRUE),
 ('Posture Reminder Wearable','ErgoSense','CJdropshipping','https://supplier.example/posture-wearable',25.40,5.90,13,4.38,3210,81.4,5.1,'limited',65,FALSE)
) AS s(product,name,marketplace,url,cost,shipping,days,rating,orders,on_time,disputes,stock,score,selected)
ON o.name = s.product
ON CONFLICT(opportunity_id,name) DO NOTHING;

INSERT INTO growth_social_evidence
  (opportunity_id,platform,source_url,creator_handle,published_at,views,likes,comments,purchase_intent_comments,evidence_excerpt)
SELECT o.id, e.platform, e.url, e.creator, CURRENT_DATE - e.age, e.views, e.likes, e.comments, e.intent, e.excerpt
FROM growth_opportunities o
JOIN (VALUES
 ('Self-Watering Rocking Planter','tiktok','https://tiktok.example/v/planter-01','@smallspacegarden',18,820000,51200,1830,318,'Where can I order this?'),
 ('Self-Watering Rocking Planter','instagram','https://instagram.example/r/planter-02','@plantroomideas',11,430000,27800,920,166,'Ordered mine for my office.'),
 ('Rechargeable Fabric Shaver','tiktok','https://tiktok.example/v/shaver-01','@closetrefresh',24,610000,38600,1120,211,'Does this work on wool coats?'),
 ('Pet Paw Cleaner Cup','instagram','https://instagram.example/r/paw-01','@citydogdaily',12,790000,61100,2140,387,'Need this before rainy season.'),
 ('Travel Compression Cubes','tiktok','https://tiktok.example/v/cubes-01','@carryononly',43,505000,30100,780,142,'Bought these for Europe.'),
 ('Reusable Lint Roller','tiktok','https://tiktok.example/v/lint-01','@twocatsoneflat',29,690000,48700,1510,284,'Finally one without refills.'),
 ('Silicone Air Fryer Liners','instagram','https://instagram.example/r/liner-01','@weeknightkitchen',33,720000,39400,1260,231,'Just placed my order.'),
 ('Posture Reminder Wearable','tiktok','https://tiktok.example/v/posture-01','@deskbetter',45,210000,9200,240,49,'Would try this if it is comfortable.')
) AS e(product,platform,url,creator,age,views,likes,comments,intent,excerpt)
ON o.name=e.product
ON CONFLICT(opportunity_id,source_url) DO NOTHING;

INSERT INTO growth_creative_assets
  (opportunity_id,platform,asset_type,hook,angle,script,source_url,avatar_brief,production_prompt,status,predicted_ctr)
SELECT o.id,'tiktok','ugc_brief',c.hook,c.angle,c.script,c.source_url,c.avatar,c.prompt,c.status,c.ctr
FROM growth_opportunities o
JOIN (VALUES
 ('Self-Watering Rocking Planter','I stopped guessing when my plants need water','Visible problem-to-relief demonstration','Show a wilted plant, fill the reservoir, then reveal seven-day progress.','https://tiktok.example/v/planter-01','Apartment gardener, natural daylight, phone-shot authenticity','Create a 20-second vertical UGC sequence with macro water-reservoir detail.','ready',3.90),
 ('Rechargeable Fabric Shaver','This sweater was headed for the donation pile','Before-and-after restoration','Open on severe pilling and reveal a split-screen finish.','https://tiktok.example/v/shaver-01','Value-conscious professional refreshing a favorite sweater','Create a tactile 18-second transformation with no unsupported claims.','approved',3.45),
 ('Pet Paw Cleaner Cup','Rainy walks stopped ruining my floors','Mess prevention','Show muddy paw, cleaning action, towel proof and clean floor.','https://instagram.example/r/paw-01','Urban dog owner at apartment entryway','Produce a 22-second vertical testimonial with close-up proof.','ready',4.10),
 ('Travel Compression Cubes','I packed seven days into one carry-on','Space transformation','Use overhead packing comparison and zipped compression reveal.','https://tiktok.example/v/cubes-01','Frequent traveler preparing at home','Create a fast 25-second pack-with-me sequence.','ready',3.70),
 ('Reusable Lint Roller','Pet hair disappeared without another sticky refill','Savings plus sustainability','Demonstrate sofa pass, chamber reveal and reuse.','https://tiktok.example/v/lint-01','Pet owner in a bright living room','Create an honest 20-second UGC demo emphasizing repeat use.','ready',4.25),
 ('Silicone Air Fryer Liners','The cleanup took longer than dinner—until this','Time-saving cleanup','Show stuck-on residue versus lift-out liner cleanup.','https://instagram.example/r/liner-01','Busy parent preparing a weeknight meal','Produce a 17-second comparison with clear food-safety disclaimer.','approved',3.95)
) AS c(product,hook,angle,script,source_url,avatar,prompt,status,ctr)
ON o.name=c.product
WHERE NOT EXISTS (
  SELECT 1 FROM growth_creative_assets existing
  WHERE existing.opportunity_id=o.id AND existing.asset_type='ugc_brief' AND existing.hook=c.hook
);

INSERT INTO growth_validation_plans(opportunity_id,plan_type,day_start,day_end,objective,success_metric,target_value,actual_value,status)
SELECT o.id, p.plan_type, p.day_start, p.day_end, p.objective, p.metric, p.target, p.actual, p.status
FROM growth_opportunities o
CROSS JOIN (VALUES
 ('organic_30_day',1,7,'Publish three problem-solution hooks','qualified_sessions',150,175,'passed'),
 ('organic_30_day',8,14,'Repeat the strongest hook across two creators','purchase_intent_comments',25,31,'passed'),
 ('organic_30_day',15,21,'Test proof, comparison and testimonial angles','add_to_carts',18,14,'active'),
 ('organic_30_day',22,30,'Confirm repeatable demand before paid spend','organic_purchases',8,NULL,'planned'),
 ('paid_test',1,3,'Test three creatives at controlled spend','max_cpa',18,NULL,'planned'),
 ('paid_test',4,7,'Concentrate spend on statistically useful winner','minimum_roas',1.8,NULL,'planned')
) AS p(plan_type,day_start,day_end,objective,metric,target,actual,status)
WHERE o.stage <> 'rejected'
ON CONFLICT(opportunity_id,plan_type,day_start) DO NOTHING;

INSERT INTO growth_experiments
  (opportunity_id,channel,experiment_name,daily_budget,spend,impressions,clicks,sessions,add_to_carts,purchases,revenue,status,started_at)
SELECT o.id, x.channel, x.name, x.budget, x.spend, x.impressions, x.clicks, x.sessions, x.carts, x.purchases, x.revenue, x.status, NOW() - INTERVAL '5 days'
FROM growth_opportunities o
JOIN (VALUES
 ('Self-Watering Rocking Planter','meta_ads','Three-angle paid validation',75,312,42800,1590,1260,118,31,929.69,'active'),
 ('Rechargeable Fabric Shaver','organic_tiktok','30-day organic proof',0,0,184000,6400,2210,174,42,1469.58,'passed'),
 ('Under-Sink Sliding Organizer','organic_instagram','Organization transformation series',0,0,121000,4300,1760,136,29,1159.71,'active'),
 ('Travel Compression Cubes','meta_ads','Carry-on audience test',90,420,55300,2020,1640,144,34,1529.66,'active'),
 ('Reusable Lint Roller','tiktok_ads','Scale validated pet-owner creative',240,1380,310000,12100,8750,920,246,6639.54,'passed'),
 ('Silicone Air Fryer Liners','meta_ads','Kitchen cleanup scale test',200,1160,225000,8700,6710,804,219,5253.81,'passed')
) AS x(product,channel,name,budget,spend,impressions,clicks,sessions,carts,purchases,revenue,status)
ON o.name=x.product
ON CONFLICT(opportunity_id,experiment_name) DO NOTHING;

COMMIT;
