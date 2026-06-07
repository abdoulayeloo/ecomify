# Multi-tenant storefront platform

A Shopify-style multi-tenant e-commerce platform on **Payload CMS + Next.js**:
one deployment hosts many independent merchant storefronts, each resolved by its
own domain. Pooled multi-tenancy — one codebase, one tenant-partitioned
database, N stores.

The core is generic (currency-, locale-, and payment-provider-neutral). An
optional regional module adds mobile-money markets (FCFA, Wave / Orange Money /
Free Money via PayDunya & CinetPay, French, SMS/WhatsApp), off by default.

## Architecture at a glance

Five pillars, built in dependency order:

1. **Tenant resolution** — middleware maps host → tenant.
2. **Tenant isolation** — every query scoped; access control + Postgres RLS.
3. **Theme engine** — JSON sections (Payload blocks) → mapped React components.
4. **Commerce** — catalog, cart, orders; shared model, partitioned by tenant.
5. **Payments** — provider-agnostic interface, per-tenant credentials, secure webhooks.

Stack: Next.js + Payload, PostgreSQL, Redis, Meilisearch, MinIO/S3, Caddy,
orchestrated on Coolify.

## Quick start

```bash
# generate the skeleton (generic)
python scripts/scaffold.py --target . --regional none

# or with the Senegal / mobile-money module
python scripts/scaffold.py --target . --regional senegal
```

The script writes TODO-marked stubs only. Install Payload, Next.js and adapters
separately, then flesh out each pillar following the docs. See
[`docs/scaffolding.md`](docs/scaffolding.md).

## Docs

- [`CLAUDE.md`](CLAUDE.md) — project context and invariants (read first if using Claude Code)
- [`docs/architecture.md`](docs/architecture.md) — decisions & dependency graph
- [`docs/tenancy.md`](docs/tenancy.md) — resolution & isolation
- [`docs/theme-engine.md`](docs/theme-engine.md) — theming system
- [`docs/commerce.md`](docs/commerce.md) — catalog, cart, orders
- [`docs/payments.md`](docs/payments.md) — payment layer
- [`docs/deployment.md`](docs/deployment.md) — Coolify / Caddy
- [`docs/regional-senegal.md`](docs/regional-senegal.md) — optional mobile-money module
- [`docs/scaffolding.md`](docs/scaffolding.md) — generating & extending the skeleton

## The three acceptance proofs

The platform is working when: (1) two domains render distinct stores from one
deploy; (2) store A cannot read store B's data via the API; (3) an order flips
to `paid` only after a verified webhook. These guard the hardest pillars.

## Note on external APIs

Payload plugin option names and aggregator (PayDunya/CinetPay) endpoints shift
between versions. Verify against current official docs at integration time
rather than trusting a fixed recipe.

## License

MIT — see [`LICENSE`](LICENSE).
