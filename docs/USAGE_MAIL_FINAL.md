# Usage & Mail System — FINAL (verifiziert)

Stand: 2026-02-02

## Scope
- Usage-Tracking pro Kunde, Schwellen: 50% / 70% / 85%
- Pro Schwelle: E-Mail **nur einmal** je Abrechnungszeitraum (keine Doppel-Mails)
- used_requests wird gecappt (kein >100% Überlauf)

## Fixe Schwellen
- 50%
- 70%
- 85%

## DB-Flags (usage_periods)
- notice50_sent
- notice70_sent
- notice85_sent

## Verifiziert (manuell getestet)
- Empfänger-Logik & Versand (Kunde: business_email + support_email, Admin: NOTIFY_EMAIL oder SMTP_USER)
- Flags werden korrekt gesetzt und verhindern Doppel-Mails
- Cap via LEAST(...) verhindert Überlauf
- Kundendaten via subscriptions -> customers verfügbar
- 85%: Mail kommt exakt 1x (already_sent bei weiteren Increments)
- 50%: verifiziert (Mail 1x, danach keine)
- 70%: verifiziert (Mail 1x, danach keine)

## Relevante Endpoint-Route
- POST /v1/usage/increment

## Hinweis
Dieses Modul gilt als FINAL. Änderungen nur bei klarer Regression mit Beweis (Logs/DB-Screenshots).
