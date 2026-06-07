# Theme engine

The Shopify-style customization system. The principle: **theme = code, store
content = data, layout = JSON configuration.** These three never touch. One
theme renders any store because it holds no data — only components that consume
data, and configuration that decides which components appear with which
settings. This is the React/JSON equivalent of Shopify's Liquid + sections +
settings_schema.

## Collections

### `themes`
The registry of available themes. Each declares which section types it offers
and the settings each exposes (the `settings_schema.json` equivalent).

```ts
{
  slug: 'themes',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'schema', type: 'json' }, // available sections + their setting definitions
  ],
}
```

### `pages`
Per-tenant. Each page holds an ordered list of section instances. This is the
Online-Store-2.0 JSON-template equivalent, modeled with Payload **blocks** so the
admin UI gives you add/reorder/configure for free — your built-in Theme Editor.

```ts
{
  slug: 'pages',
  access: { /* tenantScoped — see tenancy.md */ },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'slug', type: 'text', required: true }, // 'home', 'about', ...
    { name: 'sections', type: 'blocks', blocks: [HeroBlock, ProductGridBlock, TestimonialsBlock /* ... */] },
  ],
}
```

Each block is a typed section. Example:

```ts
const ProductGridBlock = {
  slug: 'product-grid',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'collection', type: 'relationship', relationTo: 'collections' },
    { name: 'columns', type: 'number', defaultValue: 3, min: 1, max: 6 },
    { name: 'limit', type: 'number', defaultValue: 9 },
  ],
}
```

## The section registry (maps section type -> React component)

```ts
import { Hero } from './sections/Hero'
import { ProductGrid } from './sections/ProductGrid'
import { Testimonials } from './sections/Testimonials'

export const sectionRegistry = {
  'hero': Hero,
  'product-grid': ProductGrid,
  'testimonials': Testimonials,
} as const
```

Each section component receives its `settings` (from the block data) and fetches
its own dynamic data, always scoped by tenant:

```tsx
async function ProductGrid({ settings, tenantId }) {
  const { docs } = await payload.find({
    collection: 'products',
    where: { tenant: { equals: tenantId }, collection: { equals: settings.collection } },
    limit: settings.limit,
  })
  return <Grid columns={settings.columns} products={docs} />
}
```

## The render loop (replaces Liquid)

One generic Next.js route reconstructs any store by reading the page's sections
and mapping each to its component.

```tsx
// app/[...slug]/page.tsx  (tenant comes from middleware via headers())
export default async function StorePage({ params }) {
  const tenantId = headers().get('x-tenant-id')
  const tenant = await getTenant(tenantId)
  const page = await getPage(tenantId, params.slug?.join('/') || 'home')

  return (
    <ThemeProvider settings={tenant.themeSettings}>
      {page.sections.map((section, i) => {
        const Component = sectionRegistry[section.blockType]
        return Component ? <Component key={i} settings={section} tenantId={tenantId} /> : null
      })}
    </ThemeProvider>
  )
}
```

That `.map()` is the templating engine. Where Shopify interprets Liquid at
runtime, you map JSON to React — type-safe and faster.

## Design tokens via CSS variables (NOT dynamic classes)

Inject per-tenant tokens as CSS custom properties, then reference them in
components.

```tsx
function ThemeProvider({ settings, children }) {
  return (
    <div style={{
      '--color-primary': settings.primaryColor,
      '--color-bg': settings.bgColor,
      '--font-heading': settings.headingFont,
    } as React.CSSProperties}>
      {children}
    </div>
  )
}
```

### The Tailwind pitfall (this WILL bite you)

`className={`grid-cols-${settings.columns}`}` silently fails — Tailwind's JIT
purges classes it can't statically see, so the dynamic class never makes it into
the build. Two fixes:
- **Safelist** the finite set: `safelist: ['grid-cols-1','grid-cols-2',...,'grid-cols-6']` in `tailwind.config`.
- Or use **inline style** for genuinely open-ended values:
  `style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)` }}`.

Use the safelist for a small known range, inline style for arbitrary values.

## Why this design

A theme with no data is sellable/installable across thousands of stores. The
settings layer turns a theme into a no-code-customizable product: the developer
exposes options in the block schema; the merchant tweaks them in the Payload
admin without touching code. That separation is the whole game.
