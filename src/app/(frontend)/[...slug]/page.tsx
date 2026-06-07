// The render loop — reconstructs any store from its page sections. One generic
// route serves every tenant; the tenant comes from middleware via headers().
// This `.map()` over sections is the templating engine. See references/theme-engine.md.
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '../../../payload.config'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { sectionRegistry } from '../../../theme/sectionRegistry'

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) notFound() // middleware should always set this for storefront paths

  const payload = await getPayload({ config })

  const [tenant, pageResult] = await Promise.all([
    payload.findByID({ collection: 'tenants', id: tenantId, depth: 0 }).catch(() => null),
    payload.find({
      collection: 'pages',
      where: { tenant: { equals: tenantId }, slug: { equals: slug?.join('/') || 'home' } },
      limit: 1,
      depth: 1,
      context: { tenantId },
    }),
  ])

  const page = pageResult.docs[0]
  if (!tenant || !page) notFound()

  const sections = (page.sections ?? []) as Array<{ blockType: string } & Record<string, any>>

  return (
    <ThemeProvider settings={(tenant as any).themeSettings}>
      {sections.map((section, i) => {
        const Component = sectionRegistry[section.blockType]
        return Component ? <Component key={i} settings={section} tenantId={tenantId} /> : null
      })}
    </ThemeProvider>
  )
}
