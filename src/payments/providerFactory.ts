// Resolves the right PaymentProvider for a tenant, using that tenant's own
// (decrypted) credentials so funds reach the right merchant. This is
// multi-tenancy applied to money. See references/payments.md.
import { getPayload } from 'payload'

import config from '../payload.config'
import { decryptCredentials } from './crypto'
import type { PaymentProvider } from './PaymentProvider'
import { CinetPayProvider } from './providers/CinetPayProvider'
import { PayDunyaProvider } from './providers/PayDunyaProvider'

export function providerFactory(
  name: string,
  creds: Record<string, any>,
  mode: 'test' | 'live',
): PaymentProvider {
  switch (name) {
    case 'paydunya':
      return new PayDunyaProvider({ ...(creds as any), mode })
    case 'cinetpay':
      return new CinetPayProvider({ ...(creds as any), mode })
    // case 'stripe': return new StripeProvider(...) // international card fallback
    default:
      throw new Error(`unknown payment provider: ${name}`)
  }
}

export async function getProviderForTenant(tenantId: string): Promise<PaymentProvider> {
  const payload = await getPayload({ config })
  // overrideAccess: this runs server-side with a known tenant id; the encrypted
  // credentials field is read-blocked over the API but readable internally.
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })

  const pc = (tenant as any).paymentConfig
  if (!pc?.provider || !pc?.credentials) {
    throw new Error(`tenant ${tenantId} has no payment configuration`)
  }
  const creds = decryptCredentials(pc.credentials)
  return providerFactory(pc.provider, creds, pc.mode ?? 'test')
}
