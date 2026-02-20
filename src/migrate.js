import { pool } from "./db.js";

const sql = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  support_email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  plan_limit INT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_periods (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  used_requests INT NOT NULL DEFAULT 0,
  extra_requests_purchased INT NOT NULL DEFAULT 0,
  notice50_sent BOOLEAN NOT NULL DEFAULT false,
  notice70_sent BOOLEAN NOT NULL DEFAULT false,
  notice85_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function main() {
  try {
    await pool.query(sql);
    console.log("✅ Migration OK");
  } catch (e) {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
