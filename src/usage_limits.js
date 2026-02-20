import { pool } from "./db.js";
import crypto from "crypto";

/**
 * ENV:
 *   INCLUDED_REQUESTS            (default 1000)
 *   HARD_STOP                   (default "1")  -> "1" = blocken, "0" = nur warnen
 *   WARN_THRESHOLDS             (default "50,70,85")
 *
 * DB:
 *   usage_periods(subscription_id, used_requests, extra_requests_purchased, notice50_sent, notice70_sent, notice85_sent, created_at)
 *
 * ASSUMPTION:
 *   customerId == subscription_id (passt zu usage_periods.subscription_id FK)
 */

function envInt(name, def) {
  const v = process.env[name];
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envBool(name, def) {
  const v = (process.env[name] ?? "").toString().trim();
  if (v === "") return def;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function parseThresholds() {
  const raw = (process.env.WARN_THRESHOLDS || "50,70,85").split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n));
  // Keep only 3 classic thresholds if someone put weird stuff
  const t = raw.length ? raw : [50,70,85];
  // normalize sorted unique
  return Array.from(new Set(t)).sort((a,b)=>a-b);
}

async function getOrCreateUsagePeriod(subscriptionId) {
  const sel = await pool.query(
    `SELECT * FROM usage_periods
     WHERE subscription_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [subscriptionId]
  );

  if (sel.rows.length) return sel.rows[0];

  const id = crypto.randomUUID();
  const ins = await pool.query(
    `INSERT INTO usage_periods
      (id, subscription_id, used_requests, extra_requests_purchased, notice50_sent, notice70_sent, notice85_sent)
     VALUES ($1, $2, 0, 0, false, false, false)
     RETURNING *`,
    [id, subscriptionId]
  );
  return ins.rows[0];
}

export async function checkUsage(subscriptionId) {
  if (!subscriptionId) {
    return { ok: false, reason: "missing_subscription_id" };
  }

  const included = envInt("INCLUDED_REQUESTS", 1000);
  const hardStop = envBool("HARD_STOP", true);
  const thresholds = parseThresholds();

  const period = await getOrCreateUsagePeriod(subscriptionId);

  const used = Number(period.used_requests || 0);
  const extra = Number(period.extra_requests_purchased || 0);
  const allowance = included + extra;

  const remaining = allowance - used;
  const wouldBlock = remaining <= 0;

  // percent on total allowance (included + extra)
  const pct = allowance > 0 ? Math.floor((used / allowance) * 100) : 100;

  // determine which notice flags should be set when we consume next
  const notices = {
    t50: thresholds.includes(50) && pct >= 50 && !period.notice50_sent,
    t70: thresholds.includes(70) && pct >= 70 && !period.notice70_sent,
    t85: thresholds.includes(85) && pct >= 85 && !period.notice85_sent,
  };

  return {
    ok: true,
    hardStop,
    included,
    extra,
    allowance,
    used,
    remaining,
    pct,
    wouldBlock,
    notices,
    periodId: period.id,
    createdAt: period.created_at
  };
}

export async function consumeUsage(subscriptionId, inc = 1) {
  if (!subscriptionId) throw new Error("missing_subscription_id");

  const included = envInt("INCLUDED_REQUESTS", 1000);
  const thresholds = parseThresholds();

  // lock latest row so parallel requests don't race too badly
  // (we lock the newest row; if none exists, create first)
  const period = await getOrCreateUsagePeriod(subscriptionId);

  const used = Number(period.used_requests || 0);
  const extra = Number(period.extra_requests_purchased || 0);
  const allowance = included + extra;

  const newUsed = used + Number(inc || 1);

  // update notices based on *new* usage
  const pct = allowance > 0 ? Math.floor((newUsed / allowance) * 100) : 100;

  const set50 = thresholds.includes(50) && pct >= 50 ? true : period.notice50_sent;
  const set70 = thresholds.includes(70) && pct >= 70 ? true : period.notice70_sent;
  const set85 = thresholds.includes(85) && pct >= 85 ? true : period.notice85_sent;

  const upd = await pool.query(
    `UPDATE usage_periods
     SET used_requests = $1,
         notice50_sent = $2,
         notice70_sent = $3,
         notice85_sent = $4
     WHERE id = $5
     RETURNING *`,
    [newUsed, set50, set70, set85, period.id]
  );

  const row = upd.rows[0];
  const remaining = (included + Number(row.extra_requests_purchased || 0)) - Number(row.used_requests || 0);

  return {
    ok: true,
    used: Number(row.used_requests || 0),
    extra: Number(row.extra_requests_purchased || 0),
    included,
    allowance: included + Number(row.extra_requests_purchased || 0),
    remaining,
    pct: (included + Number(row.extra_requests_purchased || 0)) > 0
      ? Math.floor((Number(row.used_requests || 0) / (included + Number(row.extra_requests_purchased || 0))) * 100)
      : 100,
    notices: {
      notice50_sent: !!row.notice50_sent,
      notice70_sent: !!row.notice70_sent,
      notice85_sent: !!row.notice85_sent,
    }
  };
}
