import { pool } from "./src/db.js";

async function run() {
  const sid = "demo123";

  const before = await pool.query(
    "select subscription_id, used_requests from usage_periods where subscription_id = $1 order by created_at desc limit 1",
    [sid]
  );
  console.log("BEFORE:", before.rows[0] || null);

  await pool.query(
    "update usage_periods set used_requests = used_requests + 1 where subscription_id = $1",
    [sid]
  );

  const after = await pool.query(
    "select subscription_id, used_requests from usage_periods where subscription_id = $1 order by created_at desc limit 1",
    [sid]
  );
  console.log("AFTER:", after.rows[0] || null);

  await pool.end();
}

run().catch(e => {
  console.error("ERROR:", e);
  process.exit(1);
});
