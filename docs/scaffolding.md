# Scaffolding

How to generate the project skeleton and what to do after.

## Generate

```bash
python scripts/scaffold.py --target . --regional none      # generic
python scripts/scaffold.py --target . --regional senegal   # + mobile-money module
```

- `--target` — where to write files (use `.` for the current repo).
- `--regional` — `none` (default, generic USD/locale-neutral) or `senegal`
  (adds PayDunya + CinetPay provider stubs, defaults to XOF/French).

The script writes files only. It does NOT install dependencies. It is safe to
re-run; it overwrites the stubs but won't touch files you've fleshed out unless
they share a path with a stub.

## What it generates

Generic mode (12 files):

```
src/middleware.ts                              # tenant resolution
src/access/tenantScoped.ts                     # forced tenant filter
src/collections/{tenants,domains,pages,products,orders,transactions}.ts
src/theme/sectionRegistry.ts                   # section type -> component map
src/payments/PaymentProvider.ts                # the payment interface
src/app/[...slug]/page.tsx                     # render loop
src/app/api/webhooks/[provider]/[tenantId]/route.ts
```

Senegal mode adds (15 files total):

```
src/payments/providers/PayDunyaProvider.ts
src/payments/providers/CinetPayProvider.ts
REGIONAL.md                                    # notes the module is enabled
```

## After scaffolding

The stubs are intentionally minimal and marked `TODO`. For each pillar, open the
matching doc and fill in the stubs:

| Stub area | Read |
| --- | --- |
| `middleware.ts`, `access/`, `collections/tenants,domains` | `docs/tenancy.md` |
| `collections/pages`, `theme/` | `docs/theme-engine.md` |
| `collections/products,orders`, search | `docs/commerce.md` |
| `payments/`, `app/api/webhooks/` | `docs/payments.md` |
| `providers/` (Senegal) | `docs/regional-senegal.md` |

Then install the real dependencies (Payload, Next.js, the S3 adapter, the
multi-tenant plugin, a Postgres driver, the Meilisearch client) per their
current docs, and wire the Payload config to register the collections.

## Order of work

Follow the dependency graph in `docs/architecture.md`: resolution → isolation →
theme/commerce → payments. Don't build payments before commerce exists — there's
nothing to pay for yet. Keep the isolation test (in `docs/tenancy.md`) green as
you go.
