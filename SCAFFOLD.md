# Multi-tenant storefront — scaffold map & next steps

This project is a **pooled multi-tenant** Payload + Next.js storefront platform:
one deployment hosts many merchant stores, resolved by domain. Built across the
five pillars (see `.claude/skills/payload-multitenant-storefront/`).

## Decisions baked in

- **Isolation**: app-level `tenantScoped` access on every tenant-owned
  collection **+ Postgres RLS** on the money tables **+ `@payloadcms/plugin-multi-tenant`**.
  The plugin **owns the `tenant` field** (auto-added to pages, product-collections,
  products, orders, transactions) and the admin tenant selector; we do **not**
  hand-declare a `tenant` field on those collections. The storefront resolves the
  tenant from the domain (`x-tenant-id` → `req.context.tenantId`), which
  `tenantScoped` reads — independent of the plugin's admin cookie scoping.
- **Regional module**: Senegal **ON** (XOF, French, PayDunya/CinetPay). See [REGIONAL.md](REGIONAL.md).

## File map

| Pillar | Files |
| --- | --- |
| Tenant resolution | [src/middleware.ts](src/middleware.ts), [src/tenancy/resolveTenant.ts](src/tenancy/resolveTenant.ts), [resolve-tenant route](src/app/api/internal/resolve-tenant/route.ts), [src/tenancy/payloadForTenant.ts](src/tenancy/payloadForTenant.ts) |
| Tenant isolation | [src/access/tenantScoped.ts](src/access/tenantScoped.ts), [Tenants](src/collections/Tenants.ts), [Domains](src/collections/Domains.ts), [RLS migration](src/migrations/0001_rls_money_tables.sql) |
| Theme engine | [Themes](src/collections/Themes.ts), [Pages](src/collections/Pages.ts), [blocks](src/theme/blocks.ts), [sectionRegistry](src/theme/sectionRegistry.ts), [sections/](src/theme/sections/), [ThemeProvider](src/theme/ThemeProvider.tsx), [render loop](src/app/(frontend)/[...slug]/page.tsx) |
| Commerce | [ProductCollections](src/collections/ProductCollections.ts), [Products](src/collections/Products.ts), [Orders](src/collections/Orders.ts), [checkout route](src/app/api/checkout/route.ts) |
| Payments | [PaymentProvider](src/payments/PaymentProvider.ts), [providerFactory](src/payments/providerFactory.ts), [crypto](src/payments/crypto.ts), [Transactions](src/collections/Transactions.ts), [webhook route](src/app/api/webhooks/[provider]/[tenantId]/route.ts), [reconcile](src/payments/reconcile.ts), [providers/](src/payments/providers/) |

## To get it running

1. **Install the added dependency**: `yarn add @payloadcms/plugin-multi-tenant@3.85.0`
   (already in package.json; not yet installed).
2. **Set env** (see [.env.example](.env.example)): `DATABASE_URL` (Postgres, not
   Mongo), `PAYLOAD_SECRET`, `INTERNAL_API_SECRET`, `PAYMENT_ENC_KEY`
   (`openssl rand -hex 32`).
3. **Generate types & importmap**: `yarn generate:types && yarn generate:importmap`.
4. **Migrate, then apply RLS**: let Payload create the schema, then run
   [src/migrations/0001_rls_money_tables.sql](src/migrations/0001_rls_money_tables.sql)
   — adjust the `tenant_id` column name/cast to the generated schema first, and
   set `app.tenant_id` transaction-locally before tenant queries.
5. **Seed**: create two tenants + two domains pointing at your local hosts
   (e.g. `a.localhost`, `b.localhost`), a theme, and a `home` page per tenant.

## TODOs still open (intentional stubs)

- Implement the PayDunya / CinetPay provider methods (see [REGIONAL.md](REGIONAL.md)).
- Meilisearch indexing hooks on Products (single index + mandatory `tenant` filter).
- RichText section rendering via the Lexical React converter.
- SMS/WhatsApp notification job on order paid/fulfilled.
- Reconciliation sweep wired as a scheduled Payload job.
- Tailwind safelist for any dynamic grid classes (currently using inline styles).

## The three acceptance proofs

1. Two domains → two visually distinct stores from one deploy.
2. Authenticated API scoped to store A returns zero rows from store B —
   see [tests/int/isolation.int.spec.ts](tests/int/isolation.int.spec.ts) (`yarn test:int`).
3. An order flips to `paid` only after a verified webhook, never on redirect.
