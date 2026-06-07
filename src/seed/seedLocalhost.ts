// Seed a demo store reachable at http://localhost:3000.
// Creates: a tenant, a `localhost` domain mapping, a theme, and a `home` page
// with a hero so the storefront render loop has something to show locally.
//
// Run:  npx tsx src/seed/seedLocalhost.ts
// Idempotent: re-running updates the same records instead of duplicating.
import 'dotenv/config' // tsx doesn't auto-load .env the way Next does
import { getPayload } from 'payload'

import config from '../payload.config'

async function upsert<T extends Record<string, any>>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: any,
  where: any,
  data: T,
): Promise<{ id: number }> {
  const existing = await payload.find({ collection, where, limit: 1, overrideAccess: true })
  if (existing.docs[0]) {
    const updated = await payload.update({
      collection,
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
    return updated as { id: number }
  }
  const created = await payload.create({ collection, data, overrideAccess: true })
  return created as { id: number }
}

async function main() {
  const payload = await getPayload({ config })

  // 1. Theme (platform-global).
  const theme = await upsert(
    payload,
    'themes',
    { slug: { equals: 'default' } },
    { name: 'Default', slug: 'default', schema: {} },
  )

  // 2. Tenant with demo design tokens + payment config (test mode).
  const tenant = await upsert(
    payload,
    'tenants',
    { name: { equals: 'Demo Store' } },
    {
      name: 'Demo Store',
      status: 'active',
      activeTheme: theme.id,
      themeSettings: {
        primaryColor: '#2563eb',
        bgColor: '#ffffff',
        textColor: '#111827',
        headingFont: 'Georgia, serif',
      },
      defaultCurrency: 'XOF',
      defaultLocale: 'fr',
    },
  )

  // 3. Domain mapping localhost -> tenant (this is what the proxy resolves).
  await upsert(
    payload,
    'domains',
    { hostname: { equals: 'localhost' } },
    { hostname: 'localhost', tenant: tenant.id, isPrimary: true },
  )

  // 4. A `home` page with a hero section, scoped to the tenant.
  await upsert(
    payload,
    'pages',
    { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
    {
      slug: 'home',
      title: 'Accueil',
      tenant: tenant.id, // plugin-managed field, set explicitly here
      sections: [
        {
          blockType: 'hero',
          title: 'Bienvenue chez Demo Store',
          subtitle: 'Votre boutique multi-tenant fonctionne 🎉',
          ctaText: 'Voir les produits',
          ctaHref: '/products',
        },
      ],
    },
  )

  // 5. Associate every existing admin user with this tenant. The
  //    plugin-multi-tenant hides tenant-scoped collections (orders, pages,
  //    products, transactions, ...) from the admin UI unless the logged-in user
  //    has the tenant in their `tenants` array. Users created BEFORE the plugin
  //    was installed have an empty array, so we backfill it here.
  const { docs: users } = await payload.find({
    collection: 'users',
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })
  for (const user of users) {
    const current = ((user as any).tenants ?? []) as Array<{ tenant: number | { id: number } }>
    const has = current.some(
      (t) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant) === tenant.id,
    )
    if (has) continue
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { tenants: [...current, { tenant: tenant.id }] } as any,
      overrideAccess: true,
    })
    // eslint-disable-next-line no-console
    console.log(`Linked user ${user.email} -> tenant #${tenant.id}`)
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded: tenant #${tenant.id} -> http://localhost:3000  (domain "localhost", page "home")`,
  )
  process.exit(0)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
