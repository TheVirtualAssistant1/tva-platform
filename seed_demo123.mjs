import { pool } from "./src/db.js";

function iso(d){ return new Date(d).toISOString(); }
function addDays(date, days){ const d = new Date(date); d.setDate(d.getDate()+days); return d; }

const subId = "demo123";
const usageId = "usage_demo123";

const now = new Date();
const periodStart = now;
const periodEnd = addDays(now, 30);

const planCode = "demo";
const planLimit = 1000;
const status = "active";

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) EXISTIERENDEN customer holen
    const c = await client.query(`SELECT id FROM customers ORDER BY created_at DESC NULLS LAST LIMIT 1`);
    if (c.rowCount === 0) {
      throw new Error("Kein customers Datensatz gefunden. Lege zuerst einen customer an (z.B. über deinen normalen Signup/Stripe-Flow) oder sag mir die customers Spalten, dann erstellen wir einen minimalen.");
    }
    const customerId = String(c.rows[0].id);

    // 2) subscription upsert (subscriptions hat laut deinem Schema NOT NULL: id, customer_id, plan_code, plan_limit, period_start, period_end)
    await client.query(
      `
      INSERT INTO subscriptions (id, customer_id, plan_code, plan_limit, period_start, period_end, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        plan_code   = EXCLUDED.plan_code,
        plan_limit  = EXCLUDED.plan_limit,
        period_start= EXCLUDED.period_start,
        period_end  = EXCLUDED.period_end,
        status      = EXCLUDED.status
      `,
      [subId, customerId, planCode, planLimit, iso(periodStart), iso(periodEnd), status]
    );

    // 3) usage_period anlegen, falls keiner existiert
    const u = await client.query(`SELECT id FROM usage_periods WHERE subscription_id = $1 LIMIT 1`, [subId]);
    if (u.rowCount === 0) {
      await client.query(
        `
        INSERT INTO usage_periods
          (id, subscription_id, used_requests, extra_requests_purchased, notice50_sent, notice70_sent, notice85_sent)
        VALUES
          ($1, $2, 0, 0, false, false, false)
        `,
        [usageId, subId]
      );
    }

    await client.query("COMMIT");
    console.log("✅ Seed OK", { subId, customerId, usageId });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("❌ Seed FAILED:", e?.message || e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
