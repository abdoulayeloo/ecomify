// Helper for storefront/server code: get a Payload instance whose request
// context carries the current tenant, so tenantScoped access kicks in.
// See references/tenancy.md.
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import config from '../payload.config'

/** Read the tenant id injected by middleware into request headers. */
export async function currentTenantId(): Promise<string> {
  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) throw new Error('No tenant in request context')
  return tenantId
}

export type TenantPayload = { payload: Payload; tenantId: string }

/**
 * Returns { payload, tenantId }. Pass `tenantId` in the `context` and `req` of
 * every find/create call so access control sees it:
 *
 *   const { payload, tenantId } = await getTenantPayload()
 *   await payload.find({ collection: 'products', context: { tenantId } })
 */
export async function getTenantPayload(): Promise<TenantPayload> {
  const tenantId = await currentTenantId()
  const payload = await getPayload({ config })
  return { payload, tenantId }
}
