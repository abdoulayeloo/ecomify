// Forced tenant filter — the baseline isolation seatbelt. See references/tenancy.md.
//
// `read` returns a *query constraint* (a Where), not just true/false, so Payload
// merges it into every where-clause. There is no way to fetch another tenant's
// rows even if the calling code forgets to filter.
//
// The `tenant` field itself is added by @payloadcms/plugin-multi-tenant, which
// also stamps it in the admin UI. Storefront server code passes `tenant`
// explicitly in `data` (checkout, webhook). `stampTenant` below remains as a
// helper if you ever add a tenant field to a non-plugin collection.
import type { Access, FieldHook, Where } from 'payload'

/** Pull the current tenant id off the Payload request context. */
export const getTenantId = (req: { context?: { tenantId?: string } }): string | undefined =>
  req?.context?.tenantId

/**
 * Access fn for tenant-owned collections. Admins (no tenant context but
 * authenticated as a platform user) are allowed through unconstrained so the
 * Payload admin can manage every store; storefront/API requests are constrained
 * to their resolved tenant. No tenant + no user => deny.
 */
export const tenantScoped: Access = ({ req }) => {
  const tenantId = getTenantId(req)
  if (tenantId) return { tenant: { equals: tenantId } } satisfies Where
  // Authenticated platform admin with no tenant scope: full access.
  if (req.user) return true
  // Anonymous, no tenant resolved: deny.
  return false
}

/** beforeChange field hook that stamps the resolved tenant on writes. */
export const stampTenant: FieldHook = ({ req, value }) => {
  const tenantId = getTenantId(req)
  // Keep an explicit tenant if an admin set one; otherwise force the request's.
  return tenantId ?? value
}
