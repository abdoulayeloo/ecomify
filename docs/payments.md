# Payments

A provider-agnostic layer. Business logic (checkout, orders) never references a
specific gateway; it talks to one interface, and each gateway is an
interchangeable implementation. This is the same decoupling pattern as the
section registry.

## The interface

```ts
interface PaymentProvider {
  // Create the transaction at the gateway; return where to send the buyer.
  initiate(p: InitiateParams): Promise<InitiateResult>
  // Validate signature + parse an incoming webhook into a normalized event.
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null
  // Active status check, for reconciliation when a webhook never arrives.
  getStatus(providerRef: string): Promise<PaymentStatus>
}

type InitiateParams = { orderId: string; tenantId: string; amount: number; currency: string; customer: Customer; callbackUrl: string }
type InitiateResult = { redirectUrl: string; providerRef: string }
type WebhookEvent = { providerRef: string; status: 'success'|'failed'|'pending'; amount: number }
type PaymentStatus = 'success'|'failed'|'pending'|'unknown'
```

Checkout knows only this interface. A `providerFactory(name, credentials)`
returns the right implementation for a tenant.

## Per-tenant credentials (encrypted)

Each merchant has their own gateway credentials, stored on the tenant's
`paymentConfig.credentials` (see `tenancy.md`) and **encrypted at rest**.

```ts
// beforeChange hook on tenants: encrypt; afterRead: decrypt on demand.
import crypto from 'node:crypto'
const KEY = Buffer.from(process.env.PAYMENT_ENC_KEY!, 'hex') // 32 bytes, OUTSIDE the DB

function encrypt(plain: string) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([c.update(plain,'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}
```

The master key lives in a secret manager or env, never in the database and never
in the repo. Decrypt only at the moment of building a provider for a request.

## Resolving the provider for a tenant

```ts
async function getProviderForTenant(tenantId: string): Promise<PaymentProvider> {
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantId })
  const creds = decryptCredentials(tenant.paymentConfig.credentials)
  return providerFactory(tenant.paymentConfig.provider, creds)
}
```

Each transaction uses *its own store's* credentials, so funds reach the right
merchant. This is multi-tenancy applied to money.

### Who is the merchant of record? (a decision, not code)

- **Model A — each merchant has their own gateway account** (you pass through;
  money goes straight to them). Simplest legally: you never hold funds, so
  you're not a payment institution. **Start here.**
- **Model B — you collect for all, then disburse** (marketplace model, like
  Shopify Payments). This makes you a de-facto aggregator with heavy regulatory
  implications. Only with the right legal status. The architecture supports it —
  only credential routing and a disbursement flow change — but the blocker is
  legal, not technical. Flag this to the user; don't decide it for them.

## The async flow (why webhooks are the only truth)

Card-on-file is synchronous; redirect and mobile-money flows are NOT. The buyer
leaves your site (to a hosted page, or to dial a USSD code on their phone), and
confirmation returns out-of-band via webhook — possibly seconds later, possibly
after they've closed the tab.

```
checkout -> initiate() -> gateway -> { redirectUrl, providerRef }
   -> buyer pays elsewhere (hosted page / USSD)   [outside your app]
   -> gateway POSTs webhook -> you verify + flip order to paid
```

**Never mark an order paid on the browser redirect/return.** Only on the
webhook.

## The four webhook rules (all four, every time)

1. **Verify the signature.** Each gateway signs (HMAC/hash). Unverified webhooks
   let anyone POST a fake "paid" and get free orders. This is `verifyWebhook`.
2. **Idempotency.** The same webhook may arrive 2–3 times (gateway retries).
   Store each processed `providerRef`; ignore duplicates. Otherwise you
   double-fulfill (or double-credit in Model B).
3. **Verify the amount.** Compare webhook amount to the order's authoritative
   total. Never trust a client-influenced amount — someone could pay 1 for a
   1000 order.
4. **Reconciliation fallback.** Webhooks get lost (network, downtime). A job
   sweeps `pending` transactions older than N minutes and calls `getStatus()` to
   catch ones whose webhook never landed. Without this you get paid-but-unfilled
   orders and angry customers.

## Routing webhooks to the right tenant

When a webhook lands, you must know which store it belongs to:
- **URL per tenant** — `/api/webhooks/:provider/:tenantId`, set as the
  `callbackUrl` at `initiate()` time. Cleanest.
- **Encoded reference** — pass `tenantId`+`orderId` in the gateway's custom-data
  field; it echoes back in the webhook.
- **DB lookup by `providerRef`** — find the transaction record (which carries the
  tenant). Always do this anyway to load the order.

Combine: URL or custom-data to identify fast, DB lookup to confirm, then
re-verify the webhook matches that tenant's credentials.

## Transactions collection

```ts
{
  slug: 'transactions',
  access: { /* tenantScoped + RLS */ },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'provider', type: 'text' },
    { name: 'providerRef', type: 'text', index: true }, // idempotency key
    { name: 'amount', type: 'number' },   // expected amount, for rule 3
    { name: 'currency', type: 'text' },
    { name: 'status', type: 'select', options: ['pending','success','failed'], defaultValue: 'pending' },
    { name: 'rawWebhook', type: 'json' }, // store the raw payload — invaluable in prod debugging
  ],
}
```

## Card / international fallback

For buyers with international cards (diaspora, expats), add a card provider
(e.g. Stripe) as an additional `PaymentProvider` implementation, offered
alongside the primary method — not as the default where local methods dominate.
Availability and fees vary by country; confirm against the provider's current
docs at integration time rather than hardcoding assumptions.
