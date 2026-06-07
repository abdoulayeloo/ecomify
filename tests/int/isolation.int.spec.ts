// The isolation test — guards the platform's worst failure mode: cross-tenant
// leakage. Create two tenants, seed each a product, then assert that a query
// carrying tenant A's context returns ONLY A's row and CANNOT fetch B's by id.
// Keep this green. See references/tenancy.md.
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload
let tenantA: string
let tenantB: string
let productB: string

describe('tenant isolation', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const a = await payload.create({
      collection: 'tenants',
      data: { name: 'Store A', status: 'active' },
      overrideAccess: true,
    })
    const b = await payload.create({
      collection: 'tenants',
      data: { name: 'Store B', status: 'active' },
      overrideAccess: true,
    })
    tenantA = String(a.id)
    tenantB = String(b.id)

    await payload.create({
      collection: 'products',
      data: { tenant: Number(tenantA), title: 'A widget', slug: 'a-widget', price: 1000, currency: 'XOF', status: 'active' },
      overrideAccess: true,
    })
    const pb = await payload.create({
      collection: 'products',
      data: { tenant: Number(tenantB), title: 'B widget', slug: 'b-widget', price: 2000, currency: 'XOF', status: 'active' },
      overrideAccess: true,
    })
    productB = String(pb.id)
  })

  it('a find scoped to tenant A returns only A rows', async () => {
    const { docs } = await payload.find({
      collection: 'products',
      context: { tenantId: tenantA },
      overrideAccess: false, // exercise the tenantScoped access control
    })
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.every((d) => String(d.tenant) === tenantA)).toBe(true)
  })

  it("tenant A cannot fetch tenant B's product by id", async () => {
    await expect(
      payload.findByID({
        collection: 'products',
        id: productB,
        context: { tenantId: tenantA },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
