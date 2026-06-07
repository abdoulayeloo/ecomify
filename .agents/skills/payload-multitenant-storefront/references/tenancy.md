# Tenant resolution & isolation

The two hardest, most important pillars. Resolution answers "which store is this
request for?"; isolation guarantees "this request can only ever touch that
store's data."

## Collections

### `tenants`
The store itself. Minimal shape:

```ts
{
  slug: 'tenants',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'status', type: 'select', options: ['active','suspended'], defaultValue: 'active' },
    { name: 'activeTheme', type: 'relationship', relationTo: 'themes' },
    { name: 'themeSettings', type: 'json' }, // design tokens: colors, fonts, logo
    { name: 'paymentConfig', type: 'group', fields: [
      { name: 'provider', type: 'select', options: ['paydunya','cinetpay','stripe'] },
      { name: 'credentials', type: 'json' }, // ENCRYPTED — see payments.md
      { name: 'mode', type: 'select', options: ['test','live'], defaultValue: 'test' },
    ]},
  ],
}
```

### `domains`
Maps a hostname to a tenant. This is the lookup the middleware uses.

```ts
{
  slug: 'domains',
  fields: [
    { name: 'hostname', type: 'text', required: true, unique: true, index: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'isPrimary', type: 'checkbox', defaultValue: false },
  ],
}
```

Keep `hostname` indexed and unique — it's hit on every request.

## Resolution: middleware

The Next.js middleware reads the `Host` header and resolves the tenant before
the request reaches a page. Don't do a DB call inside the middleware on every
request if you can avoid it — cache the host→tenant map (Redis, or an in-memory
LRU with short TTL) and fall back to DB on miss.

```ts
// middleware.ts
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const host = req.headers.get('host')?.split(':')[0] ?? ''
  const tenantId = await resolveTenant(host) // cache -> DB on miss
  if (!tenantId) return new NextResponse('Unknown store', { status: 404 })

  const res = NextResponse.next()
  res.headers.set('x-tenant-id', tenantId)
  return res
}

export const config = { matcher: ['/((?!_next|api/admin|favicon).*)'] }
```

Downstream, read `x-tenant-id` (server components via `headers()`, route
handlers via the request). For Payload operations, attach it to the request
context so access control can see it.

## Isolation: app-level access control (required)

Every tenant-scoped collection forces the filter in `access`. A read returns a
*query constraint*, not a boolean — Payload merges it into the where-clause, so
there is no way to fetch another tenant's rows even if the calling code forgets
to filter.

```ts
const tenantScoped = (req): Where | boolean => {
  const tenantId = req.context?.tenantId
  if (!tenantId) return false           // no tenant context => deny
  return { tenant: { equals: tenantId } } // constrain to this tenant
}

// in each tenant-owned collection:
{
  slug: 'products',
  access: { read: tenantScoped, create: tenantScoped, update: tenantScoped, delete: tenantScoped },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    // ... product fields
  ],
  hooks: {
    beforeChange: [({ req, data }) => ({ ...data, tenant: req.context?.tenantId })],
  },
}
```

Two things make this safe: the `read` access returns a constraint (not just
true/false), and `beforeChange` stamps the tenant on writes so a client can't
forge it. The `@payloadcms/plugin-multi-tenant` packages this pattern; evaluate
it rather than hand-rolling every collection, but understand the mechanism
either way.

## Isolation: Postgres RLS (recommended for money tables)

A second seatbelt below the app. Even if app code is wrong, the database refuses
the row. Apply at least to `orders` and `transactions`.

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Set the session variable per request, in a transaction, before Payload runs its
queries:

```ts
await db.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
```

`true` (the third arg / `is_local`) scopes it to the transaction so it can't leak
across pooled connections. This is the critical detail with PgBouncer/connection
pooling — a session-level setting on a shared connection is a leak; a
transaction-local one is safe.

## The isolation test (make this an automated test)

Create two tenants, seed each with a product, authenticate as tenant A, and
assert that querying products returns only A's row. Then try to fetch B's
product by id and assert it 404s. This single test guards the platform's worst
failure mode — keep it green.
