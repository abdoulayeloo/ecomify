# Regional module: Senegal / mobile-money markets (OPTIONAL)

Read this ONLY if the user wants the Senegal / West-Africa mobile-money module.
It is an add-on to the generic core, not a rewrite. It supplies concrete
`PaymentProvider` implementations, currency/locale defaults, and notification
specifics. Everything here plugs into the interfaces defined in `payments.md`
and `commerce.md`.

> Caveat: gateway fees, API endpoints, and merchant-onboarding rules in this
> market change frequently and fees are negotiated per merchant contract. Treat
> figures below as orders of magnitude and verify against each provider's
> current documentation at integration time. Do not hardcode fee assumptions.

## Why mobile money is the core, not an option

In this market the large majority of consumer transactions run on mobile money
(Wave, Orange Money, Free Money), not cards — card ownership is low. A
storefront that only accepts cards loses most buyers. So in this module, mobile
money is the default payment path and cards are the fallback (the inverse of a
Western default).

## Aggregator strategy

Don't integrate each wallet directly. Use an aggregator that exposes one API
covering Wave + Orange Money + Free Money + local cards:

- **PayDunya** — Senegalese, strong local fit, plugins and good local support.
  Natural default for a Senegal-focused platform.
- **CinetPay** — broad West-Africa wallet coverage; choose if regional
  (Côte d'Ivoire, Mali, ...) expansion matters.

Both implement the `PaymentProvider` interface. Per-tenant `provider` selects
which one a given merchant uses.

## Currency & locale defaults (when module ON)

- Default `currency` = `XOF` (FCFA). Note XOF has no minor unit in practice;
  store integer FCFA amounts.
- Default content locale = French.
- Phone numbers are first-class (used for both payment and notifications).

## The async specifics

The generic async flow from `payments.md` applies, with these local shapes:
- **Wave** — `initiate()` typically returns a `pay.wave.com` redirect URL (often
  via the aggregator rather than a public direct merchant API).
- **Orange Money** — may return a redirect, a QR code, or trigger a USSD
  confirmation depending on the aggregator's current flow.
- **Free Money** — commonly a USSD-completion flow: the buyer dials a code
  (e.g. a `#...#` shortcode) to confirm; you get the result by webhook.

In all cases: confirmation is asynchronous and the **webhook is the only source
of truth**. The browser never confirms payment.

## Provider implementation shape (PayDunya example)

```ts
class PayDunyaProvider implements PaymentProvider {
  constructor(private creds: { masterKey: string; privateKey: string; token: string }) {}

  async initiate(p: InitiateParams): Promise<InitiateResult> {
    // Create an invoice via the aggregator's API with p.amount (XOF), p.callbackUrl,
    // and custom data carrying p.tenantId + p.orderId. Return its redirect URL + ref.
    // Verify exact endpoint/field names against current PayDunya docs.
  }

  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null {
    // Validate the aggregator's signature/hash; parse into the normalized event.
    // Reject if signature invalid.
  }

  async getStatus(providerRef: string): Promise<PaymentStatus> {
    // Active confirmation lookup for the reconciliation job.
  }
}
```

The same four webhook rules from `payments.md` are non-negotiable here:
signature, idempotency, amount check, reconciliation. Mobile-money retries and
lost callbacks are common, so the reconciliation sweep matters more, not less.

## Notifications: SMS / WhatsApp first

Email is secondary in this market. On order paid/fulfilled, notify the customer
(and merchant) by SMS or WhatsApp. WhatsApp via a Business/Cloud API or a
provider integration; SMS via a local gateway. Model notification as a Payload
job (Redis-backed) fired from the order's `afterChange` so it retries on
failure. Keep the channel pluggable, like payments — the platform shouldn't
hardwire one SMS vendor.

## Regulatory note (defer to the user)

Model A (each merchant has their own aggregator account; you never hold funds)
keeps you out of payment-institution territory. Model B (you collect and
disburse) implicates BCEAO rules and a licensing question. This is a legal
decision, not a coding one — surface it, recommend Model A to start, and don't
decide it on the user's behalf.
