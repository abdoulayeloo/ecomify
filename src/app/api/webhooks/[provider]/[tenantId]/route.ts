// Tenant-scoped webhook handler — the ONLY place an order becomes `paid`. Never
// trust the browser redirect. Implements the four rules from payments.md:
//   1. signature  2. idempotency  3. amount check  4. (reconciliation = separate job)
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '../../../../../payload.config'
import { getProviderForTenant } from '../../../../../payments/providerFactory'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string; tenantId: string }> },
) {
  const { tenantId } = await params
  const raw = await req.text()

  const provider = await getProviderForTenant(tenantId)

  // Rule 1: signature. An unverified webhook lets anyone POST a fake "paid".
  const event = provider.verifyWebhook(raw, req.headers)
  if (!event) return new NextResponse('invalid signature', { status: 401 })

  const payload = await getPayload({ config })

  // Load the transaction for this providerRef, scoped to the tenant from the URL.
  // This also confirms the webhook belongs to this store (routing safety).
  const { docs: txns } = await payload.find({
    collection: 'transactions',
    where: { tenant: { equals: tenantId }, providerRef: { equals: event.providerRef } },
    limit: 1,
    context: { tenantId },
  })
  const txn = txns[0]
  if (!txn) return new NextResponse('unknown transaction', { status: 404 })

  // Rule 2: idempotency. Gateways retry; a settled txn is a no-op (still 200 so
  // the gateway stops retrying).
  if (txn.status === 'success' || txn.status === 'failed') {
    return new NextResponse('ok (already processed)', { status: 200 })
  }

  if (event.status !== 'success') {
    await payload.update({
      collection: 'transactions',
      id: txn.id,
      data: { status: 'failed', rawWebhook: raw },
      context: { tenantId },
    })
    return new NextResponse('ok', { status: 200 })
  }

  // Rule 3: amount. Compare against the authoritative expected amount stored at
  // checkout — never a client-influenced value.
  if (event.amount !== txn.amount) {
    await payload.update({
      collection: 'transactions',
      id: txn.id,
      data: { status: 'failed', rawWebhook: raw },
      context: { tenantId },
    })
    return new NextResponse('amount mismatch', { status: 400 })
  }

  // Success: settle the transaction and flip the order to paid (the one place).
  await payload.update({
    collection: 'transactions',
    id: txn.id,
    data: { status: 'success', rawWebhook: raw },
    context: { tenantId },
  })
  await payload.update({
    collection: 'orders',
    id: typeof txn.order === 'object' ? txn.order.id : txn.order,
    data: { status: 'paid' },
    context: { tenantId },
  })

  // TODO: enqueue SMS/WhatsApp notification job (regional-senegal.md).
  return new NextResponse('ok', { status: 200 })
}
