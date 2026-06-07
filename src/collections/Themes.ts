import type { CollectionConfig } from 'payload'

// The registry of installable themes. A theme holds no store data — only the
// declaration of which sections it offers and the settings each exposes (the
// settings_schema.json equivalent). Themes are platform-global, not per-tenant.
// See references/theme-engine.md.
export const Themes: CollectionConfig = {
  slug: 'themes',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true, // a tenant must be able to read its assigned theme
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    // Available sections + their setting definitions (drives the theme editor).
    { name: 'schema', type: 'json' },
  ],
}
