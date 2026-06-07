import type { CollectionConfig } from 'payload'

import { tenantScoped } from '../access/tenantScoped'

// Product groupings ("categories"). Slug is `product-collections` to avoid
// clashing with Payload's own "collection" term. See references/commerce.md.
export const ProductCollections: CollectionConfig = {
  slug: 'product-collections',
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
    // Self-relation for hierarchy (parent category).
    { name: 'parent', type: 'relationship', relationTo: 'product-collections' },
  ],
}
