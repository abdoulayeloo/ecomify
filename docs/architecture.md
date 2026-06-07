# Architecture & decisions

Read this first. It frames the two decisions that reshape everything downstream,
then gives the dependency order for the five pillars.

## The core model: pooled multi-tenancy

One deployment, many stores. All merchants share the same application code and
the same database; their data is separated logically by a `tenant` identifier
carried on every record and every query. This is how Shopify serves millions of
shops from shared infrastructure.

Contrast with **instance-per-tenant** (one app + one database per merchant).
That model suits a *small fixed number* of products with *different data
models*. It does NOT suit a storefront platform, where you may have hundreds or
thousands of merchants sharing the *same* data model. You cannot run a thousand
Payload instances. Choose pooled.

The cost of pooled is two risks you must engineer against:
- **Cross-tenant leakage** — a missing tenant filter exposes one store's data to
  another. Mitigated by enforcing the filter in access control + RLS.
- **Noisy neighbor** — one large store starves shared resources. Mitigated by
  connection limits, query budgets, and (later) read replicas. Not urgent at
  launch; note it and move on.

## Decision 1: isolation strategy

Pick one. They are not mutually exclusive — the robust choice is both.

| Strategy | How | When |
| --- | --- | --- |
| App-level filter (required) | Payload `access` functions force `tenant = currentTenant` on every read/write. The `@payloadcms/plugin-multi-tenant` automates much of this wiring. | Always. This is the baseline; never skip it. |
| Postgres RLS (recommended) | Row-Level Security policies on each table keyed to a session variable (`SET app.tenant_id`). The database itself refuses cross-tenant rows. | When the data is sensitive or the team is large enough that one forgotten filter is plausible. Strongly recommended for payments/orders. |
| Schema-per-tenant | A Postgres schema per merchant. | Rarely. Heavy at high tenant counts; loses the "shared model" simplicity. Skip unless a compliance requirement forces physical separation. |

Default recommendation: app-level filter for everything + RLS on the
money-touching tables (`orders`, `transactions`). See `tenancy.md` for code.

## Decision 2: regional module on or off

The core is locale- and payment-neutral. Confirm with the user whether they want
the optional Senegal / mobile-money module (FCFA, Wave/Orange Money via
PayDunya/CinetPay, French, SMS/WhatsApp). Default OFF. If on, read
`regional-senegal.md` when you reach the payments and commerce pillars.

## Dependency graph (build order)

```
reverse proxy (Caddy)            <- deployment.md
        |
   tenant resolution             <- tenancy.md  (middleware: host -> tenant)
        |
   tenant isolation              <- tenancy.md  (access control + RLS)
        |
   +----+--------+
   |             |
theme engine   commerce          <- theme-engine.md / commerce.md
   |             |
   +----+--------+
        |
   payments                      <- payments.md  (depends on orders existing)
```

Resolution before isolation (you must know the tenant before you can scope to
it). Isolation before theme/commerce (those read tenant data). Payments last
(it acts on orders). Don't build payments before commerce — there's nothing to
pay for yet.

## Reference infrastructure

The skill assumes, but does not require, this stack (swap freely):

- **Coolify** on a VPS as the container orchestrator.
- **Caddy** as the global reverse proxy: HTTPS termination, wildcard subdomain
  + custom-domain routing to the single app.
- **Next.js + Payload** as one application (Payload runs inside the Next app).
- **PostgreSQL** — primary datastore, partitioned by tenant.
- **Redis** — cache and Payload job queue, shared across tenants.
- **Meilisearch** — product search, one index namespaced per tenant.
- **MinIO** (or any S3-compatible) — media storage via Payload's S3 adapter.

None of these are load-bearing choices except "one app, one partitioned DB".
Everything else can be substituted.

## What "done" looks like

The three proofs from SKILL.md, restated as acceptance criteria:
1. Two domains → two visually distinct stores from one deployment.
2. Authenticated API calls scoped to store A return zero rows from store B.
3. An order flips to `paid` only after a verified webhook, never on redirect.
