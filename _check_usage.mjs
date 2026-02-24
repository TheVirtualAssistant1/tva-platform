import { pool } from "./src/db.js";
const subId = "demo123";
const r = await pool.query(
  SELECT id, used_requests, extra_requests_purchased, notice50_sent, notice70_sent, notice85_sent, created_at
   FROM usage_periods
   WHERE subscription_id = 
   ORDER BY created_at DESC
   LIMIT 1, [subId]
);
console.log(r.rows[0] || null);
await pool.end();
