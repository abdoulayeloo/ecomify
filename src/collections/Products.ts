import type { CollectionConfig } from 'payload'

import { tenantScoped } from '../access/tenantScoped'

// Catalog. Prices are stored in MINOR UNITS as integers to avoid float money
// bugs (for XOF/FCFA, which has no minor unit in practice, store integer FCFA).
// See references/commerce.md.
export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'title' },
  access: {
    read: tenantScoped,
    create: tenantScoped,
    update: tenantScoped,
    delete: tenantScoped,
  },
  // The `tenant` field is added automatically by @payloadcms/plugin-multi-tenant.
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'description', type: 'richText' },
    { name: 'price', type: 'number', required: true }, // minor units (integer)
    { name: 'currency', type: 'text', defaultValue: 'XOF' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'collection', type: 'relationship', relationTo: 'product-collections' },
    { name: 'stock', type: 'number', defaultValue: 0 },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'active', 'archived'],
      defaultValue: 'draft',
    },
  ],
  // TODO (commerce.md): afterChange/afterDelete hooks to index into Meilisearch
  // with a mandatory `tenant` filterable attribute (single index + tenant filter).
}
