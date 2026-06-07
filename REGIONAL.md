# Regional module: Senegal — ENABLED

This project was scaffolded with the Senegal / West-Africa mobile-money module on.

- Default currency **XOF (FCFA)** — store integer amounts (no minor unit in practice).
- Default content locale **French** (`localization.defaultLocale = 'fr'` in payload.config.ts).
- Phone numbers are first-class (payment + notifications): `orders.customer.phone`.
- Provider stubs under [src/payments/providers/](src/payments/providers/):
  - [PayDunyaProvider.ts](src/payments/providers/PayDunyaProvider.ts) — Wave / Orange Money / Free Money + local cards. Natural default for Senegal.
  - [CinetPayProvider.ts](src/payments/providers/CinetPayProvider.ts) — broader West-Africa coverage; pick for regional expansion.

## To finish the module

1. Implement `initiate` / `verifyWebhook` / `getStatus` in each provider against
   **current** PayDunya / CinetPay docs — endpoints, field names, signature
   scheme, and fees change often and fees are per-merchant. Do not hardcode fee
   assumptions. See `.claude/skills/payload-multitenant-storefront/references/regional-senegal.md`.
2. Wire SMS/WhatsApp notifications as a Redis-backed Payload job fired from
   `Orders.afterChange` when status → `paid`/`fulfilled` (TODO marked in
   [src/collections/Orders.ts](src/collections/Orders.ts)). Keep the channel pluggable.
3. The four webhook rules are non-negotiable and already enforced in
   [the webhook route](src/app/api/webhooks/[provider]/[tenantId]/route.ts):
   signature, idempotency, amount check, + reconciliation
   ([reconcile.ts](src/payments/reconcile.ts)). Mobile-money retries and lost
   callbacks are common, so reconciliation matters more here, not less.

## Regulatory note (a legal decision — defer to the user)

- **Model A** — each merchant has their own aggregator account; you never hold
  funds. Keeps you out of payment-institution territory. **Recommended start.**
- **Model B** — you collect and disburse. Implicates BCEAO rules and a licensing
  question. The architecture supports it (credential routing + a disbursement
  flow), but the blocker is legal, not technical.
