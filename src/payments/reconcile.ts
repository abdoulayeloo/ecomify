// Rule 4: reconciliation. Webhooks get lost (network, downtime). This sweep
// finds `pending` transactions older than N minutes and actively re-checks them
// via provider.getStatus(), settling any whose webhook never landed. Without it
// you get paid-but-unfulfilled orders. See references/payments.md.
//
// Wire this as a Payload job (Redis-backed) on a schedule. Skeleton only.
import { getPayload } from 'payload'

import config from '../payload.config'
import { getProviderForTenant } from './providerFactory'

const STALE_MINUTES = 15

export async function reconcilePendingTransactions(): Promise<void> {
  const payload = await getPayload({ config })
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString()

  const { docs } = await payload.find({
    collection: 'transactions',
    where: { status: { equals: 'pending' }, createdAt: { less_than: cutoff } },
    limit: 100,
    overrideAccess: true, // a platform-level sweep across all tenants
  })

  for (const txn of docs) {
    if (txn.tenant == null) continue // orphaned txn; nothing to reconcile
    const tenantId =
      typeof txn.tenant === 'object' ? String(txn.tenant.id) : String(txn.tenant)
    try {
      const provider = await getProviderForTenant(tenantId)
      const status = await provider.getStatus(txn.providerRef ?? '')
      if (status === 'success') {
        // TODO: settle exactly like the webhook (amount check + flip order).
      } else if (status === 'failed') {
        await payload.update({
          collection: 'transactions',
          id: txn.id,
          data: { status: 'failed' },
          context: { tenantId },
        })
      }
    } catch {
      // leave pending; retry next sweep
    }
  }
}
