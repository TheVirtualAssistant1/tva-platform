import { pool } from "./src/db.js";

const subId = "demo123";
const usageId = "up_demo123";

const customerId = "demo_customer";
const planCode = "starter";
const planLimit = 1000;

// 30 Tage Periode
const start = new Date();
const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

const iso = (d) => d.toISOString(); // Postgres akzeptiert ISO für timestamptz

try {
  await pool.query("BEGIN");

  // Clean slate (falls schon vorhanden)
  await pool.query("DELETE FROM usage_periods WHERE subscription_id = $1", [subId]);
  await pool.query("DELETE FROM subscriptions WHERE id = $1", [subId]);

  // subscriptions: ALLE NOT NULL Felder setzen
  await pool.query(
    `INSERT INTO subscriptions (id, customer_id, plan_code, plan_limit, period_start, period_end, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
    [subId, customerId, planCode, planLimit, iso(start), iso(end)]
  );

  // usage_periods: id ist NOT NULL (kein default) -> muss gesetzt werden
  await pool.query(
    `INSERT INTO usage_periods (id, subscription_id, used_requests, extra_requests_purchased, notice50_sent, notice70_sent, notice85_sent)
     VALUES ($1, $2, 0, 0, false, false, false)`,
    [usageId, subId]
  );

  await pool.query("COMMIT");
  console.log("✅ Seed OK:", { subId, usageId, customerId, planCode, planLimit, start: iso(start), end: iso(end) });
} catch (e) {
  try { await pool.query("ROLLBACK"); } catch {}
  console.error("❌ Seed FAILED:", e?.message || e);
} finally {
  await pool.end();
}
