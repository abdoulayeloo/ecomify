import type { CollectionConfig } from 'payload'

// Maps a hostname to a tenant. This is the lookup the middleware uses on every
// request, so `hostname` is indexed and unique. See references/tenancy.md.
export const Domains: CollectionConfig = {
  slug: 'domains',
  admin: { useAsTitle: 'hostname' },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'hostname', type: 'text', required: true, unique: true, index: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'isPrimary', type: 'checkbox', defaultValue: false },
  ],
}
