import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

import Stripe from 'stripe';
import { pool } from "./db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
// Serve static assets from src/ (widget.js, retell-frame.html, test-widget.html)
app.use(express.static(__dirname));

app.get('/db-test', async (req, res) => {
  try {
    const { pool } = await import('./db.js');

    // If DB is disabled (no DATABASE_URL), pool.connect() throws DB_DISABLED_NO_DATABASE_URL
    let client;
    try {
      client = await pool.connect();
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      if (msg.includes('DB_DISABLED_NO_DATABASE_URL')) {
        return res.json({ ok: true, db_disabled: true });
      }
      throw e;
    }

  try {
      const r = await client.query('SELECT 1 as ok');
      return res.json({ ok: true, db: r.rows?.[0]?.ok ?? 1, db_disabled: false });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && (e.message || e)) });
  }
});

app.use(cors());

function hostnameFromWebsiteUrl(u) {
  try {
    const h = new URL(String(u)).hostname.toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch { return ''; }
}

const PRICE_TO_PLAN = {
  // Beispiel: dein verifizierter Test-Recurring-Price:
  'price_1SyAjLF7QrxcSqN0lvJnzvzm': { plan_code: 'plan_2500', plan_limit: 2500 }
};



app.post('/stripe/webhook', async (req, res) => {
const receivedAt = new Date().toISOString();
  try {

    let event;
    const exit200 = (reason, meta) => {
      try {
        const loc = (new Error()).stack?.split('\n')[2]?.trim();
        const eid = (typeof event !== 'undefined' && event && event.id) ? event.id : null;
        const extra = meta ? (' meta=' + JSON.stringify(meta)) : '';
        console.log('[stripe-webhook] EXIT:', reason, 'event=', eid, 'loc=', loc, extra);
      } catch (e) {
        console.log('[stripe-webhook] EXIT:', reason);
      }
      return res.sendStatus(200);
    };

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'];
    if (!sig) { console.log('[stripe-webhook] Missing stripe-signature header'); return exit200('missing_signature_header'); }
    if (!secret) { console.log('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET'); return exit200('missing_webhook_secret'); }

  try {
          const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ? req.body : '');

const secrets = String(process.env.STRIPE_WEBHOOK_SECRET || "")
  .split(/[\s,]+/)
  .map(s => s.trim())
  .filter(Boolean);

if (!secrets.length) {
  console.log('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET');
  return exit200('missing_webhook_secret');
}

let lastErr = null;
let usedSecret = null;

for (const s of secrets) {
  try {
    event = stripe.webhooks.constructEvent(payload, sig, s);
    usedSecret = s;
    break;
  } catch (e) {
    lastErr = e;
  }
}

if (!event) {
  console.log('[stripe-webhook] Signature verification failed:', lastErr && lastErr.message ? lastErr.message : lastErr);
  try {
    const sh = String(sig || '');
    const parts = sh.split(',').map(x => x.trim());
    const tPart = parts.find(p => p.startsWith('t='));
    const v1Parts = parts.filter(p => p.startsWith('v1='));
    const t = tPart ? tPart.slice(2) : '';
    console.log('[stripe-webhook] sig_debug',
      'ua=', req.headers['user-agent'],
      'ct=', req.headers['content-type'],
      'raw_len=', payload.length,
      't=', t,
      'v1_prefix=', (v1Parts[0] ? v1Parts[0].slice(3, 11) : ''),
      'secrets_tried=', secrets.map(x => x.slice(0,8) + '...' + x.slice(-6)).join(' | ')
    );
  } catch {}
  return res.sendStatus(200);
}

console.log('[stripe-webhook] Signature OK with secret=', usedSecret.slice(0,8) + '...' + usedSecret.slice(-6));
    } catch (err) {
      console.log('[stripe-webhook] Signature verification failed:', err && err.message ? err.message : err);
      try { const ce = req.headers['content-encoding']; const sh = String(sig || ''); const parts = sh.split(',').map(s=>s.trim()); const tPart = parts.find(p=>p.startsWith('t=')); const v1Parts = parts.filter(p=>p.startsWith('v1=')); const t = tPart ? tPart.slice(2) : ''; const v1 = v1Parts.length ? v1Parts[0].slice(3) : ''; const payload = (req.body && Buffer.isBuffer(req.body)) ? req.body : (req.rawBody && Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from('')); const crypto = await import('node:crypto'); const prefix = Buffer.from(t + '.', 'utf8'); const expected = crypto.createHmac('sha256', secret).update(Buffer.concat([prefix, payload])).digest('hex'); const anyMatch = v1Parts.some(p => p.slice(3) === expected); console.log('[stripe-webhook] sig_debug ua=', req.headers['user-agent'], 'ct=', req.headers['content-type'], 'ce=', ce, 'hasSig=', !!sig, 'raw_len=', payload.length, 't=', t, 'v1_prefix=', v1.slice(0,8), 'expected_prefix=', expected.slice(0,8), 'match=', anyMatch, 'v1_count=', v1Parts.length, 'secret_len=', (secret?secret.length:0), 'secret_prefix=', (secret?secret.slice(0,8):''), 'secret_suffix=', (secret?secret.slice(-6):'')); } catch (e) { console.log('[stripe-webhook] sig_debug_compute_failed:', e && e.message ? e.message : e); }
      return res.sendStatus(200);
    }

    if (!event || !event.id) { console.log('[stripe-webhook] Missing event.id'); return exit200('missing_event_id'); }

    if (event.type !== 'checkout.session.completed') {
      // Ignore other events but always 200 to prevent retries
      return res.sendStatus(200);
    }

    const session = event.data && event.data.object ? event.data.object : null;

    // Pflichtdaten (hart)
    const sessionId = session && session.id;
    const mode = session && session.mode;
    const subscriptionId = session && session.subscription;
    const customerId = session && session.customer;
    const metadata = session && session.metadata ? session.metadata : {};
    const websiteUrl = metadata && metadata.website_url ? String(metadata.website_url).trim() : "";
        let companyName = metadata && metadata.company_name ? String(metadata.company_name).trim() : "";

    // Email primär aus Session
    let email = session && session.customer_details && session.customer_details.email ? String(session.customer_details.email).trim() : "";

    const missing = [];
    if (!event.id) missing.push('event.id');
    if (!sessionId) missing.push('session.id');
    if (mode !== 'subscription') missing.push('session.mode!=subscription');
    if (!subscriptionId) missing.push('session.subscription');
    if (!customerId) missing.push('session.customer');
    if (!websiteUrl) missing.push('session.metadata.website_url');

    if (missing.length) {
      console.log('[stripe-webhook] Invalid payload, missing:', missing.join(', '), 'event=', event.id, 'at=', receivedAt);
      return exit200('invalid_payload_missing_fields', { missing });




    }

    // Domains aus website_url ableiten (minimale Logik)
    let allowedDomains = [];
    try {
      const u = new URL(websiteUrl);
      if (u.hostname) allowedDomains = [u.hostname.toLowerCase()];
    } catch (_) {}

    // DB versuchen zu laden; wenn das scheitert -> File-Fallback wie vorher
    let pool;
    try {
      const mod = await import('./db.js');

      // ESM: export const pool = ...
      // CJS: module.exports = { pool } -> landet bei ESM import oft unter mod.default
      pool = mod.pool || (mod.default && mod.default.pool);

      if (!pool) {
        const keys = Object.keys(mod || {});
        const defKeys = mod && mod.default ? Object.keys(mod.default) : [];
        throw new Error('db.pool missing. mod keys=' + JSON.stringify(keys) + ' default keys=' + JSON.stringify(defKeys));
      }
    } catch (e) {
      console.log('[stripe-webhook] DB import failed -> fallback:', e && (e.stack || e.message) ? (e.stack || e.message) : e);
      // Fallback disabled here: avoid duplicate JSONL writes; pool.connect() catch handles file-fallback.
      return res.sendStatus(200);
    }

    // Stripe Subscription laden -> price_id -> plan mapping
    let sub;
    try {
      sub = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (e) {
      console.log('[stripe-webhook] Failed to retrieve subscription:', subscriptionId, e && e.message ? e.message : e);
      return exit200('subscription_retrieve_failed', { subscriptionId });
    }

    // price_id ermitteln
    let priceId = null;
    try {
      const item0 = sub && sub.items && sub.items.data && sub.items.data[0] ? sub.items.data[0] : null;
      priceId = item0 && item0.price && item0.price.id ? item0.price.id : null;
    } catch (_) {}

    if (!priceId) {
      console.log('[stripe-webhook] Missing price_id on subscription items. sub=', subscriptionId, 'event=', event.id);
      return exit200('missing_price_id', { subscriptionId });
    }

    // PRICE_TO_PLAN muss existieren (laut Übergabe)
    const planInfo = (typeof PRICE_TO_PLAN !== 'undefined') ? PRICE_TO_PLAN[priceId] : null;
    if (!planInfo || !planInfo.plan_code || (planInfo.plan_limit === undefined || planInfo.plan_limit === null)) {
      console.log('[stripe-webhook] Unknown price_id mapping:', priceId, 'event=', event.id);
      return exit200('unknown_price_mapping', { priceId });
    }

    const planCode = String(planInfo.plan_code);
    const planLimit = Number(planInfo.plan_limit);

        // period_start/end aus Stripe subscription (robust: manche Accounts liefern es nur auf item-level)
    const cps = sub && sub.current_period_start ? sub.current_period_start
      : (sub && sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_start ? sub.items.data[0].current_period_start : null);

    const cpe = sub && sub.current_period_end ? sub.current_period_end
      : (sub && sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end ? sub.items.data[0].current_period_end : null);

    const periodStart = cps ? new Date(cps * 1000) : null;
    const periodEnd = cpe ? new Date(cpe * 1000) : null;
    const status = sub && sub.status ? String(sub.status) : 'active';if (!periodStart || !periodEnd || isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      console.log('[stripe-webhook] Missing/invalid period dates. sub=', subscriptionId, 'event=', event.id);
      return res.sendStatus(200);
    }

    // companyName fallback (not null in DB)
    if (!companyName) {
      companyName = (session && session.customer_details && session.customer_details.name) ? String(session.customer_details.name).trim() : "";
    }
    if (!companyName) companyName = "Unknown";

    // Email fallback: stripe customer retrieve
    if (!email) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if (c && typeof c === 'object' && c.email) email = String(c.email).trim();
      } catch (_) {}
    }
    if (!email) {
      console.log('[stripe-webhook] Missing email (business_email/support_email required). customer=', customerId, 'event=', event.id);
      return res.sendStatus(200);
    }

    const businessEmail = email;
    const supportEmail = email;

    // usage_periods.id deterministisch für Idempotenz bei Retries
    const usagePeriodId = `up_${event.id}`;

    let client;
try {
  client = await pool.connect();
} catch (e) {
  const msg = (e && e.message) ? e.message : String(e);
  if (msg.includes("DB_DISABLED_NO_DATABASE_URL")) {
    // Dev/File-Fallback: write subscription record so checkout/webhook test works without DB
    try {
      const fs = await import('node:fs/promises');
      await fs.mkdir('run_logs', { recursive: true });
      const line = JSON.stringify({
        at: receivedAt,
        event_id: event.id,
        event: "checkout.session.completed",
        session_id: sessionId,
        customer_id: customerId,
        subscription_id: subscriptionId,
        website_url: websiteUrl,
        company_name: companyName || null,
        email: email || null,
        note: "DB_DISABLED_NO_DATABASE_URL -> fallback"
      }) + "\n";
      const logPath = 'run_logs/subscriptions_fallback.jsonl';

// Idempotency in file-fallback: do not write the same Stripe event twice
let already = false;
try {
  const prev = await fs.readFile(logPath, 'utf8');
  // JSONL line contains: ""event_id"":""<id>""
  already = prev.includes("\"event_id\":\"" + event.id + "\"");
} catch (_) {
  // file may not exist yet -> ok
}

if (already) {
  console.log("[stripe-webhook] DB disabled -> fallback already has event_id, skip:", event.id);
} else {
  await fs.appendFile(logPath, line, 'utf8');
  console.log("[stripe-webhook] DB disabled -> wrote fallback:", logPath);
}

      // === TVA RETELL AUTO-KB CREATE (file-fallback side-effect) ===
      if (!already) {
        queueMicrotask(async () => {
          try {
            const apiKey = process.env.RETELL_API_KEY || "";
            if (apiKey && websiteUrl) {
              let hostname = "unknown";
              try { hostname = new URL(websiteUrl).hostname || "unknown"; } catch (_) {}
              const kbName = String(`tva_${String(subscriptionId || "no").slice(-8)}_${hostname}`).slice(0, 39);
              const fd = new FormData();
              fd.append("knowledge_base_name", kbName);
              fd.append("knowledge_base_urls", JSON.stringify([websiteUrl]));
              const r = await fetch("https://api.retellai.com/create-knowledge-base", {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}` },
                body: fd
              });
              console.log("[TVA_AUTO_KB_CREATE]", "status=", r.status, "kbName=", kbName);
            } else {
              console.log("[TVA_AUTO_KB_CREATE] skipped");
            }
          } catch (e) {
            console.log("[TVA_AUTO_KB_CREATE] failed:", e?.message || e);
          }
        });
      }
      // === END TVA RETELL AUTO-KB CREATE ===
    } catch (fe) {
      console.log("[stripe-webhook] DB disabled fallback write failed:", fe && (fe.message || fe) ? (fe.message || fe) : fe);
    }
    return res.sendStatus(200);
  }
  throw e;
}

  try {
      await client.query('BEGIN');

            // 1) Idempotenz: event markieren (ON CONFLICT DO NOTHING). Wenn schon da -> rollback & 200
      const idem = await client.query(
        'INSERT INTO public.stripe_events_processed(event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id',
        [event.id]
      );
      if (!idem.rowCount) {
        await client.query('ROLLBACK');
      return res.sendStatus(200);
      }

      // 2) customers upsert (id = stripe customer id)
      await client.query(
        'INSERT INTO public.customers (id, company_name, business_email, support_email, is_active, allowed_domains) ' +
        'VALUES ($1, $2, $3, $4, true, $5) ' +
        'ON CONFLICT (id) DO UPDATE SET ' +
        'company_name = EXCLUDED.company_name, ' +
        'business_email = EXCLUDED.business_email, ' +
        'support_email = EXCLUDED.support_email, ' +
        'is_active = true, ' +
        'allowed_domains = EXCLUDED.allowed_domains',
        [customerId, companyName, businessEmail, supportEmail, allowedDomains]
      );

      // 3) subscriptions upsert (id = stripe subscription id)
      await client.query(
        'INSERT INTO public.subscriptions (id, customer_id, plan_code, plan_limit, period_start, period_end, status) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7) ' +
        'ON CONFLICT (id) DO UPDATE SET ' +
        'customer_id = EXCLUDED.customer_id, ' +
        'plan_code = EXCLUDED.plan_code, ' +
        'plan_limit = EXCLUDED.plan_limit, ' +
        'period_start = EXCLUDED.period_start, ' +
        'period_end = EXCLUDED.period_end, ' +
        'status = EXCLUDED.status',
        [subscriptionId, customerId, planCode, planLimit, periodStart.toISOString(), periodEnd.toISOString(), status]
      );

      // 4) usage_periods insert (idempotent über deterministische id)
      await client.query(
        'INSERT INTO public.usage_periods (id, subscription_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [usagePeriodId, subscriptionId]
      );await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.log('[stripe-webhook] DB transaction failed:', e && e.message ? e.message : e, 'event=', event.id);
      return res.sendStatus(200);
    } finally {
      client.release();
    }

    // Side-effects nach COMMIT (stubs: hier später Retell/Widget/Welcome-Mail anhängen)

    queueMicrotask(async () => {
// === TVA RETELL AUTO-KB CREATE (triggered by successful checkout) ===
    try {
      const apiKey = process.env.RETELL_API_KEY || "";
      if (apiKey && websiteUrl) {
        let hostname = "unknown";
        try { hostname = new URL(websiteUrl).hostname || "unknown"; } catch (_) {}

        const kbName = String(`tva_${String(subscriptionId || "no").slice(-8)}_${hostname}`).slice(0, 39);

        const fd = new FormData();
        fd.append("knowledge_base_name", kbName);
        fd.append("knowledge_base_urls", JSON.stringify([websiteUrl]));

        const r = await fetch("https://api.retellai.com/create-knowledge-base", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: fd
        });

        const txt = await r.text().catch(() => "");
        console.log("[TVA_AUTO_KB_CREATE]", "status=", r.status, "kbName=", kbName);
      } else {
        console.log("[TVA_AUTO_KB_CREATE] skipped");
      }
    } catch (e) {
      console.log("[TVA_AUTO_KB_CREATE] failed:", e?.message || e);
    }
    // === END TVA RETELL AUTO-KB CREATE ===
    });
    // queueMicrotask(async () => { ... });

      return res.sendStatus(200);
  } catch (e) {
    console.log('[stripe-webhook] Unhandled error:', e && e.message ? e.message : e);
      return res.sendStatus(200);
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/v1/usage/increment", async (req, res) => {
  const subscriptionId = String(req.body?.subscription_id || "");
  const amount = Number(req.body?.amount ?? 1);

  if (!subscriptionId) return res.status(400).json({ ok: false, error: "subscription_id required" });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50) {
    return res.status(400).json({ ok: false, error: "amount must be 1..50" });
  }

  let client;
try {
  client = await pool.connect();
} catch (e) {
  const msg = (e && e.message) ? e.message : String(e);
  if (msg.includes("DB_DISABLED_NO_DATABASE_URL")) {
    console.log("[db] DB disabled (no DATABASE_URL) -> /v1/usage/increment unavailable in file-fallback mode");
    return res.status(503).json({ ok: false, error: "DB_DISABLED_NO_DATABASE_URL" });
  }
  throw e;
}

  try {
    await client.query("BEGIN");

    const sub = await client.query(
      `SELECT id, plan_limit FROM subscriptions WHERE id = $1 AND status = 'active'`,
      [subscriptionId]
    );
    if (sub.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "subscription not found/active" });
    }

    const planLimit = Number(sub.rows[0].plan_limit);

    const u = await client.query(
      `SELECT id, used_requests, extra_requests_purchased,
              notice50_sent, notice70_sent, notice85_sent
       FROM usage_periods
       WHERE subscription_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [subscriptionId]
    );
    if (u.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "usage_period not found" });
    }

    const usage = u.rows[0];
    const usageId = usage.id;

    const updated = await client.query(
      `UPDATE usage_periods
       SET used_requests = used_requests + $1
       WHERE id = $2
       RETURNING used_requests, extra_requests_purchased,
                 notice50_sent, notice70_sent, notice85_sent`,
      [amount, usageId]
    );

    const used = Number(updated.rows[0].used_requests);
    const extra = Number(updated.rows[0].extra_requests_purchased);
    const totalAvailable = planLimit + extra;
    const pctUsed = totalAvailable > 0 ? used / totalAvailable : 0;

    // HARD BLOCK: do not allow going above plan limit (+extras)
    if (used > totalAvailable) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        ok: false,
        error: "limit_reached",
        used: Math.min(used, totalAvailable),
        limit: planLimit,
        extra,
        total_available: totalAvailable,
        remaining: 0,
        pct_used: 100
      });
    }

    const updates = [];
    if (pctUsed >= 0.5 && !usage.notice50_sent) updates.push("notice50_sent = true");
    if (pctUsed >= 0.7 && !usage.notice70_sent) updates.push("notice70_sent = true");
    if (pctUsed >= 0.85 && !usage.notice85_sent) updates.push("notice85_sent = true");

    if (updates.length) {
      await client.query(
        `UPDATE usage_periods SET ${updates.join(", ")} WHERE id = $1`,
        [usageId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      used,
      limit: planLimit,
      extra,
      total_available: totalAvailable,
      remaining: Math.max(0, totalAvailable - used),
      pct_used: Math.round(pctUsed * 1000) / 10
    });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ ok: false, error: String(e) });
  } finally {
    client.release();
  }
});


// === STRIPE: minimal create-checkout-session (TEST) ===
app.get("/v1/usage/current", async (req, res) => {
  const subscriptionId = String(req.query?.subscription_id || "");
  if (!subscriptionId) return res.status(400).json({ ok: false, error: "subscription_id required" });

  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    if (msg.includes("DB_DISABLED_NO_DATABASE_URL")) {
      return res.status(503).json({ ok: false, error: "DB_DISABLED_NO_DATABASE_URL" });
    }
    return res.status(500).json({ ok: false, error: msg });
  }

  try {
    const sub = await client.query(
      `SELECT id, plan_limit FROM subscriptions WHERE id = $1 AND status = 'active'`,
      [subscriptionId]
    );
    if (sub.rowCount === 0) return res.status(404).json({ ok: false, error: "subscription not found/active" });

    const planLimit = Number(sub.rows[0].plan_limit);

    const u = await client.query(
      `SELECT id, used_requests, extra_requests_purchased
       FROM usage_periods
       WHERE subscription_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [subscriptionId]
    );
    if (u.rowCount === 0) return res.status(404).json({ ok: false, error: "usage_period not found" });

    const used = Number(u.rows[0].used_requests);
    const extra = Number(u.rows[0].extra_requests_purchased);
    const totalAvailable = planLimit + extra;
    const pctUsed = totalAvailable > 0 ? used / totalAvailable : 0;

    // HARD BLOCK: do not allow going above plan limit (+extras)
    if (used > totalAvailable) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        ok: false,
        error: "limit_reached",
        used,
        limit: planLimit,
        extra,
        total_available: totalAvailable,
        remaining: 0,
        pct_used: 100
      });
    }

    return res.json({
      ok: true,
      subscription_id: subscriptionId,
      used,
      limit: planLimit,
      extra,
      total_available: totalAvailable,
      remaining: Math.max(0, totalAvailable - used),
      pct_used: Math.round(pctUsed * 1000) / 10
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && (e.message || e)) });
  } finally {
    client.release();
  }
});

app.post('/create-checkout-session', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const price_id = String(req.body?.price_id || process.env.STRIPE_DEFAULT_PRICE_ID || '');
    console.log('create-checkout-session body:', req.body);
    console.log('create-checkout-session price_id:', price_id);
    if (!price_id) return res.status(400).json({ error: 'price_id required (body.price_id or STRIPE_DEFAULT_PRICE_ID)' });

    const website_url  = String(req.body?.website_url  || '');
    const company_name = String(req.body?.company_name || '');
    if (!website_url) return res.status(400).json({ error: 'website_url required (body.website_url)' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/cancel`,
      metadata: {
        website_url,
        company_name
      }
    });

    return res.json({
  url: session.url,
  debug_public_base_url: PUBLIC_BASE_URL,
  debug_success_url: `${PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
  debug_cancel_url: `${PUBLIC_BASE_URL}/cancel`});
  } catch (e) {
    console.error('create-checkout-session error:', e?.message || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});
const port = Number(process.env.PORT || 3001);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || ("http://localhost:" + port);

// STARTUP DEBUG (temporary)
(async () => {
  try {
    console.log("[startup] PUBLIC_BASE_URL =", PUBLIC_BASE_URL);
    const sk = process.env.STRIPE_SECRET_KEY || "";
    console.log("[startup] STRIPE_SECRET_KEY prefix =", (sk.slice(0, 7) + "..."));
    const resp = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: "Bearer " + sk }
    });
    const acct = await resp.json();
    console.log("[startup] STRIPE account =", { id: acct.id, email: acct.email, livemode: acct.livemode });
  } catch (e) {
    console.log("[startup] stripe account lookup failed:", (e && e.message) ? e.message : e);
  }
})();
// END STARTUP DEBUG (temporary)
// Checkout redirect endpoints (Stripe success/cancel)
app.get('/success', async (req, res) => {
  try {
    const sessionId = String(req.query?.session_id || "");
    if (!sessionId) {
      return res.status(400).send("Missing session_id. Please return to the checkout flow.");
    }

    // Retrieve checkout session and read subscription id
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const subscriptionId = String(session?.subscription || "");

    // Build embed snippet (customerId == subscription_id for TVA widget)
    const widgetBase = PUBLIC_BASE_URL.replace(/\/+$/, "");
    const widgetSrc  = widgetBase + "/widget.js";

    const publicKey  = process.env.TVA_PUBLIC_KEY  || "";
    const agentId    = process.env.TVA_AGENT_ID    || "";
    const agentVer   = process.env.TVA_AGENT_VERSION || "";
    const title      = process.env.TVA_WIDGET_TITLE || "The Virtual Assistant";
    const color      = process.env.TVA_WIDGET_COLOR || "#7c3aed";

    const snippet = `<script src="${widgetSrc}"
  data-customer-id="${subscriptionId}"
  data-public-key="${publicKey}"
  data-agent-id="${agentId}"
  data-agent-version="${agentVer}"
  data-title="${title}"
  data-color="${color}"
  data-auto-open="true"></script>`;

    const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>TVA Setup</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;max-width:860px;margin:40px auto;padding:0 16px;line-height:1.4}
    .box{border:1px solid #333;border-radius:12px;padding:16px;background:#0b0b0b;color:#fff}
    textarea{width:100%;min-height:140px;border-radius:10px;border:1px solid #444;background:#000;color:#fff;padding:12px;font-family:ui-monospace,Menlo,Consolas,monospace}
    .muted{opacity:.8}
    code{background:#111;padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <h1>✅ Zahlung erfolgreich – TVA installieren</h1>
  <p class="muted">Copy & Paste den folgenden Code direkt vor <code>&lt;/body&gt;</code> auf deiner Website.</p>

  <div class="box">
    <p><strong>Dein Embed Code:</strong></p>
    <textarea readonly>${snippet.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</textarea>
    <p class="muted">Subscription-ID: <code>${subscriptionId || "(not found)"}</code></p>
    <p class="muted">Test: Seite neu laden → Widget unten rechts öffnen → Frage stellen.</p>
  </div>
</body>
</html>`;
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send("Onboarding error: " + String(e?.message || e));
  }
});

app.get('/cancel', (req, res) => {
  res.status(200).send('Payment canceled. You can close this tab.');
});

app.listen(port, () => console.log("API listening on http://localhost:" + port));














