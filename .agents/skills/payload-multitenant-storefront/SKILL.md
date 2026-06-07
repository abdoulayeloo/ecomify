---
name: payload-multitenant-storefront
description: Build a multi-tenant e-commerce platform on Payload CMS where one deployment hosts many independent merchant storefronts — a Shopify-style architecture. Use this skill whenever the user wants to create a multi-store / multi-vendor / multi-merchant platform, a "Shopify-like" or "white-label" storefront builder, a SaaS where each customer gets their own shop, a themeable storefront with per-tenant customization, or any system where one Payload + Next.js codebase serves multiple stores resolved by domain. Trigger this even when the user describes the goal without naming Payload (e.g. "platform where merchants build their own stores", "host many shops from one app"), and for sub-tasks like per-tenant theming, tenant isolation/data partitioning, the section/blocks rendering engine, or routing payments per store. Includes an optional regional module for mobile-money markets (FCFA, Wave/Orange Money via PayDunya/CinetPay, French content) that is OFF by default.
---

# Payload multi-tenant storefront platform

## What this builds

A single Payload CMS + Next.js deployment that hosts many independent merchant
storefronts, each resolved by its own domain or subdomain. This is the
*pooled multi-tenancy* model that powers Shopify-style platforms: one codebase,
one (partitioned) database, N stores. It is the opposite of standing up one
instance per merchant — which does not scale past a handful of tenants.

The platform rests on five pillars. Build them in this order; each depends on
the one before it.

1. **Tenant resolution** — middleware maps an incoming host to a tenant.
2. **Tenant isolation** — every query is scoped to its tenant; cross-tenant
   leakage is the single worst failure mode, so isolation is enforced at the
   access-control layer (and optionally Postgres RLS), never left to app code.
3. **Theme engine** — stores are customized through ordered JSON sections
   (Payload blocks) rendered by mapped React components, with per-tenant design
   tokens injected as CSS variables. This is the Liquid-equivalent.
4. **Commerce** — catalog, cart, orders; one shared data model partitioned by
   tenant.
5. **Payments** — a provider-agnostic interface with per-tenant credentials and
   secure, idempotent, tenant-scoped webhooks.

Supporting infrastructure (orchestrated by Coolify in the reference setup, but
any Docker host works): PostgreSQL, Redis (cache + jobs), Meilisearch (search),
MinIO or any S3-compatible store (media), behind a reverse proxy (Caddy in the
reference setup) that terminates HTTPS and handles tenant domains.

## How to use this skill

Work through the pillars in order. For each pillar there is a reference file
with the concrete schema, code, and decisions — read it when you reach that
pillar rather than all upfront. Then scaffold the project skeleton with the
bundled script and fill it in.

| Pillar / topic | Read this when |
| --- | --- |
| `references/architecture.md` | Before anything — the decision map (pooled vs instance-per-tenant, isolation strategy, data scope) and the dependency graph. |
| `references/tenancy.md` | Building tenant resolution + isolation (middleware, access control, Postgres RLS, the `tenants`/`domains` collections). |
| `references/theme-engine.md` | Building the theming system (themes, pages, blocks-as-sections, the render loop, CSS-variable design tokens, the Tailwind safelist pitfall). |
| `references/commerce.md` | Building catalog, cart, and orders (collections, the cart/checkout flow, Meilisearch indexing per tenant). |
| `references/payments.md` | Building the payment layer (the `PaymentProvider` interface, the async mobile-money/redirect flow, the four webhook rules, per-tenant credential encryption). |
| `references/deployment.md` | Wiring services on Coolify/Docker, Caddy wildcard + custom-domain routing, env layout, S3/MinIO config. |
| `references/regional-senegal.md` | ONLY if the user wants the Senegal / mobile-money module (FCFA, Wave/Orange Money/Free Money via PayDunya & CinetPay, SMS/WhatsApp, French). Off by default. |

Always start by reading `references/architecture.md` and confirming the two
decisions it raises (isolation strategy and whether the regional module is
wanted). Don't assume — these choices reshape later code.

## Scaffolding

`scripts/scaffold.py` generates the project skeleton: directory layout, a
typed `PaymentProvider` interface, stub collections for the five pillars, the
tenant-resolution middleware, and the section-registry render loop. Run:

```bash
python scripts/scaffold.py --target ./my-platform --regional none
```

Pass `--regional senegal` to also emit the mobile-money provider stubs and
FCFA/French defaults. The script writes files only; it does not install
dependencies. After it runs, read the relevant reference file for each stub and
flesh it out — the stubs are intentionally minimal and marked with `TODO`.

## Non-negotiables (why they matter)

- **Tenant scoping lives in access control, not business logic.** If a single
  `find()` somewhere forgets its tenant filter, one store sees another store's
  orders. Enforce the filter in each collection's `access` functions so it
  cannot be forgotten. RLS in Postgres is the second seatbelt.
- **The webhook is the only source of truth for payment.** Mobile-money and
  redirect flows are asynchronous: the buyer may close the tab before the
  callback fires. Never mark an order paid on the browser return — only on a
  signature-verified, amount-checked, idempotent, tenant-scoped webhook. A
  reconciliation job catches webhooks that never arrive.
- **Per-tenant secrets are encrypted at rest.** Each merchant's payment
  credentials are encrypted with a master key held outside the database
  (secret manager / env), decrypted only at point of use.
- **Design tokens go through CSS variables, not dynamic class names.** Tailwind
  purges classes it can't see at build time, so `grid-cols-${n}` silently
  breaks; use a safelist or inline styles for tenant-driven values.

## Regional module (optional, default OFF)

The core platform is payment-provider-agnostic and locale-neutral. The Senegal
module is an *add-on* read from `references/regional-senegal.md` only when the
user asks for it. It supplies: PayDunya and CinetPay implementations of
`PaymentProvider`, the async USSD/redirect specifics, XOF (FCFA) currency
defaults, French as default content locale, and SMS/WhatsApp-first
notifications. Keeping it modular means the same skill serves a generic SaaS
storefront or a Dakar-specific marketplace without forking.

## After building

Suggest the user verify, in this order: (1) two stores on two domains render
different themes from the same deploy; (2) store A cannot read store B's data
via the API (the isolation test); (3) a test-mode payment moves an order to
"paid" only after the webhook lands. These three checks prove the three hardest
pillars actually work.
