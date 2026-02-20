import { pool } from "./db.js";

async function main() {
  // 1) IDs
  const subId = process.argv[2] || "demo123";
  const customerId = `cust_${subId}`;
  const usageId = `usage_${subId}`;

  // 2) Plan (zum Test): 1000 Requests / Monat
  const planCode = "starter_1000";
  const planLimit = 1000;

  // 3) Period (jetzt -> +30 Tage)
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 4) Upsert Customer
  await pool.query(
    `
    INSERT INTO customers (id, company_name, business_email, support_email, allowed_domains)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      business_email = EXCLUDED.business_email,
      support_email = EXCLUDED.support_email,
      allowed_domains = EXCLUDED.allowed_domains,
      is_active = true;
    `,
    [
      customerId,
      "Demo Company",
      "business@demo-company.com",
      "support@demo-company.com",
      ["thevirtualassistant.site"],
    ]
  );

  // 5) Upsert Subscription
  await pool.query(
    `
    INSERT INTO subscriptions (id, customer_id, plan_code, plan_limit, period_start, period_end, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'active')
    ON CONFLICT (id) DO UPDATE SET
      plan_code = EXCLUDED.plan_code,
      plan_limit = EXCLUDED.plan_limit,
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      status = 'active';
    `,
    [subId, customerId, planCode, planLimit, now.toISOString(), end.toISOString()]
  );

  // 6) Upsert Usage Period
  await pool.query(
    `
    INSERT INTO usage_periods (id, subscription_id, used_requests, extra_requests_purchased, notice50_sent, notice70_sent, notice85_sent)
    VALUES ($1, $2, 0, 0, false, false, false)
    ON CONFLICT (id) DO UPDATE SET
      used_requests = 0,
      extra_requests_purchased = 0,
      notice50_sent = false,
      notice70_sent = false,
      notice85_sent = false;
    `,
    [usageId, subId]
  );

  console.log("? Seed OK:", { customerId, subId, usageId, planLimit });
  await pool.end();
}

main().catch((e) => {
  console.error("? Seed failed:", e);
  process.exit(1);
});
