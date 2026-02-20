import { pool } from "./db.js";

/**
 * consumeUsage(subscriptionId, amount=1)
 * - increments used_requests in usage_periods for the latest period row of this subscription
 * - returns the updated used_requests
 */
export async function consumeUsage(subscriptionId, amount = 1) {
  if (!subscriptionId) throw new Error("consumeUsage: subscriptionId missing");
  const inc = Number.isFinite(+amount) ? +amount : 1;

  // IMPORTANT: correct Postgres syntax (ORDER BY ... LIMIT ...)
  const qSelect = `
    select id, subscription_id, used_requests
    from usage_periods
    where subscription_id = $1
    order by created_at desc
    limit 1
  `;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const sel = await client.query(qSelect, [subscriptionId]);
    if (sel.rowCount === 0) {
      throw new Error(`consumeUsage: no usage_periods row found for subscription_id=${subscriptionId}`);
    }

    const rowId = sel.rows[0].id;

    const qUpdate = `
      update usage_periods
      set used_requests = used_requests + $2
      where id = $1
      returning used_requests
    `;

    const upd = await client.query(qUpdate, [rowId, inc]);
    await client.query("commit");
    return upd.rows[0].used_requests;
  } catch (e) {
    try { await client.query("rollback"); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}
/**
 * getUsageStatus(subscriptionId)
 * returns: { used_requests, extra_requests_purchased, remaining, limit, isBlocked }
 *
 * NOTE: limit is computed as (base_limit + extra_requests_purchased).
 * Base limit comes from env USAGE_BASE_LIMIT (fallback 2500) for now.
 * Later you can load plan limits from subscriptions/stripe.
 */
export async function getUsageStatus(subscriptionId) {
  if (!subscriptionId) throw new Error("getUsageStatus: subscriptionId missing");

  const baseLimit = Number(process.env.USAGE_BASE_LIMIT || 2500);

  const q = `
    select used_requests, coalesce(extra_requests_purchased,0) as extra_requests_purchased
    from usage_periods
    where subscription_id = $1
    order by created_at desc
    limit 1
  `;

  const r = await pool.query(q, [subscriptionId]);
  if (r.rowCount === 0) {
    throw new Error(`getUsageStatus: no usage_periods row found for subscription_id=${subscriptionId}`);
  }

  const used = Number(r.rows[0].used_requests || 0);
  const extra = Number(r.rows[0].extra_requests_purchased || 0);
  const limit = baseLimit + extra;
  const remaining = limit - used;
  const isBlocked = remaining <= 0;

  return { used_requests: used, extra_requests_purchased: extra, remaining, limit, isBlocked };
}
