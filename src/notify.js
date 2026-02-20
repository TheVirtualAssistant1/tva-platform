import { sendEmail } from "./mailer.js";

/**
 * Erwartet:
 * - subscriptionId (string)
 * - pctUsed (0..1)
 * - customerBusinessEmail (string | null)
 * - customerSupportEmail (string | null)
 * - used (number)
 * - totalAvailable (number)
 */
export async function notifyUsageThreshold({
  subscriptionId,
  pctUsed,
  customerBusinessEmail,
  customerSupportEmail,
  used,
  totalAvailable
}) {
  const admin = process.env.TVA_ADMIN_EMAIL;

  const thresholds = [
    { pct: 0.50, label: "50%" },
    { pct: 0.70, label: "70%" },
    { pct: 0.85, label: "85%" }
  ];

  const reached = thresholds.findLast(t => pctUsed >= t.pct);
  if (!reached) return { ok: true, skipped: true };

  const pctText = Math.round(pctUsed * 1000) / 10;

  const toCustomer = [customerBusinessEmail, customerSupportEmail].filter(Boolean);

  const subjectCustomer = `TVA Usage Alert: ${reached.label} erreicht`;
  const textCustomer =
`Hallo,

Ihr Anfragekontingent ist zu ${pctText}% verbraucht.

Verbraucht: ${used}
Gesamt: ${totalAvailable}
Verbleibend: ${Math.max(0, totalAvailable - used)}

Viele Grüße
The Virtual Assistant`;

  if (toCustomer.length) {
    await sendEmail({
      to: toCustomer.join(","),
      subject: subjectCustomer,
      text: textCustomer
    });
  }

  if (admin) {
    await sendEmail({
      to: admin,
      subject: `⚠️ TVA: ${subscriptionId} bei ${reached.label}`,
      text:
`Subscription: ${subscriptionId}
Usage: ${pctText}%

used: ${used}
total: ${totalAvailable}`
    });
  }

  return { ok: true, threshold: reached.label };
}
