// Checkout. Resolves the tenant, loads the cart's products SCOPED TO THE TENANT,
// recomputes the authoritative total server-side (never trust a client total),
// creates a `pending` order + transaction, then calls the tenant's
// PaymentProvider.initiate() and returns the redirect URL. It does NOT mark the
// order paid — only the webhook does. See references/commerce.md + payments.md.
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '../../../payload.config'
import { getProviderForTenant } from '../../../payments/providerFactory'

export const runtime = 'nodejs'

interface CartLine {
  productId: string
  quantity: number
}

export async function POST(req: Request) {
  const tenantId = req.headers.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

  const body = (await req.json()) as {
    items: CartLine[]
    customer?: { name?: string; phone?: string; email?: string }
  }
  if (!body.items?.length) return NextResponse.json({ error: 'empty cart' }, { status: 400 })

  const payload = await getPayload({ config })

  // Load the referenced products, scoped to this tenant. A product id from
  // another store simply won't be found, so it can't be purchased here.
  const { docs: products } = await payload.find({
    collection: 'products',
    where: {
      tenant: { equals: tenantId },
      id: { in: body.items.map((i) => i.productId) },
      status: { equals: 'active' },
    },
    limit: body.items.length,
    context: { tenantId },
  })

  const byId = new Map(products.map((p) => [String(p.id), p]))
  let total = 0
  let currency = 'XOF'
  const items = body.items.map((line) => {
    const product = byId.get(line.productId)
    if (!product) throw new Error(`product not available: ${line.productId}`)
    if ((product.stock ?? 0) < line.quantity) throw new Error(`out of stock: ${line.productId}`)
    currency = product.currency ?? currency
    total += product.price * line.quantity
    return { product: product.id, quantity: line.quantity, unitPrice: product.price }
  })

  // Create the pending order (authoritative total).
  const order = await payload.create({
    collection: 'orders',
    data: {
      tenant: Number(tenantId),
      orderNumber: `ord_${order_seed(tenantId)}`,
      items,
      total,
      currency,
      customer: body.customer ?? {},
      status: 'pending',
    },
    context: { tenantId },
  })

  // Hand the authoritative amount to the payment layer.
  const provider = await getProviderForTenant(tenantId)
  const origin = new URL(req.url).origin
  const result = await provider.initiate({
    orderId: String(order.id),
    tenantId,
    amount: total,
    currency,
    customer: body.customer ?? {},
    // Tenant-scoped webhook URL — see payments.md routing rules.
    callbackUrl: `${origin}/api/webhooks/${provider.name}/${tenantId}`,
  })

  // Record the expected amount for the webhook amount-check (rule 3).
  await payload.create({
    collection: 'transactions',
    data: {
      tenant: Number(tenantId),
      order: order.id,
      provider: provider.name,
      providerRef: result.providerRef,
      amount: total,
      currency,
      status: 'pending',
    },
    context: { tenantId },
  })

  return NextResponse.json({ redirectUrl: result.redirectUrl, orderId: order.id })
}

// Cheap order-number seed; replace with a real per-tenant sequence if needed.
function order_seed(tenantId: string): string {
  return `${tenantId.slice(0, 6)}${process.hrtime.bigint().toString(36)}`
}
