BEGIN;

ALTER TABLE growth_creative_assets ADD COLUMN IF NOT EXISTS render_url TEXT;
ALTER TABLE growth_creative_assets ADD COLUMN IF NOT EXISTS provider_job_ref VARCHAR(255);

CREATE TABLE IF NOT EXISTS growth_connector_jobs (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT REFERENCES growth_opportunities(id) ON DELETE SET NULL,
  connector VARCHAR(40) NOT NULL CHECK (connector IN ('shopify','social_evidence','supplier_catalog','ugc_video','social_publishing','meta_ads','tiktok_ads')),
  operation VARCHAR(80) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('queued','running','completed','failed','configuration_required')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_reference VARCHAR(512),
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS growth_connector_jobs_status_idx ON growth_connector_jobs(status,created_at DESC);
CREATE INDEX IF NOT EXISTS growth_connector_jobs_opportunity_idx ON growth_connector_jobs(opportunity_id,created_at DESC);

COMMIT;
