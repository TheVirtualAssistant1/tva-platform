import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  const missing = [];
  if (!host) missing.push("SMTP_HOST");
  if (!port) missing.push("SMTP_PORT");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!from) missing.push("SMTP_FROM");

  return { host, port, secure, user, pass, from, missing };
}

export async function sendEmail({ to, subject, text, html }) {
  const cfg = getSmtpConfig();

  // Wenn SMTP noch nicht vollständig gesetzt ist: sauber skippen, nicht crashen
  if (cfg.missing.length) {
    return { ok: false, skipped: true, reason: `Missing: ${cfg.missing.join(", ")}` };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });

  return { ok: true, messageId: info.messageId };
}
