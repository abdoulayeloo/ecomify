// host -> tenant id resolution with a short-TTL in-memory LRU cache.
// See references/tenancy.md. Swap the cache for Redis in a multi-instance deploy
// (an in-memory cache is per-process; that's fine for a single node).
import { getPayload } from 'payload'

import config from '../payload.config'

const TTL_MS = 60_000
const cache = new Map<string, { tenantId: string | null; expires: number }>()

export async function resolveTenant(host: string): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(host)
  if (hit && hit.expires > now) return hit.tenantId

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'domains',
    where: { hostname: { equals: host } },
    limit: 1,
    depth: 0,
    overrideAccess: true, // resolution runs before any tenant context exists
  })

  const domain = docs[0]
  const tenantId = domain ? String(domain.tenant) : null

  cache.set(host, { tenantId, expires: now + TTL_MS })
  return tenantId
}
