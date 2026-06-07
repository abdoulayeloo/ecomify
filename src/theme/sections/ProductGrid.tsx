// Product grid section. Fetches its own data, ALWAYS scoped by tenant.
// Note the inline `gridTemplateColumns` — a dynamic Tailwind class like
// `grid-cols-${n}` would be purged at build time (the safelist pitfall).
// See references/theme-engine.md.
import { getPayload, type Where } from 'payload'

import config from '../../payload.config'
import type { SectionProps } from '../sectionRegistry'

export async function ProductGrid({ settings, tenantId }: SectionProps) {
  const payload = await getPayload({ config })
  const columns = settings.columns ?? 3

  const where: Where = { tenant: { equals: tenantId }, status: { equals: 'active' } }
  if (settings.collection) where.collection = { equals: settings.collection }

  const { docs } = await payload.find({
    collection: 'products',
    where,
    limit: settings.limit ?? 9,
    context: { tenantId },
  })

  return (
    <section style={{ padding: '2rem 1.5rem' }}>
      {settings.heading ? (
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>{settings.heading}</h2>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '1rem',
        }}
      >
        {docs.map((p) => (
          <article key={String(p.id)}>
            <h3>{p.title}</h3>
            <p>
              {p.price} {p.currency}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
