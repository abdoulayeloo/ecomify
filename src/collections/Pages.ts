import type { CollectionConfig } from 'payload'

import { tenantScoped } from '../access/tenantScoped'
import { sectionBlocks } from '../theme/blocks'

// Per-tenant. Each page holds an ordered list of section instances — the
// Online-Store-2.0 JSON-template equivalent, modeled with Payload blocks.
// See references/theme-engine.md.
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'slug' },
  access: {
    read: tenantScoped,
    create: tenantScoped,
    update: tenantScoped,
    delete: tenantScoped,
  },
  // The `tenant` field is added automatically by @payloadcms/plugin-multi-tenant.
  fields: [
    { name: 'slug', type: 'text', required: true, index: true }, // 'home', 'about', ...
    { name: 'title', type: 'text' },
    { name: 'sections', type: 'blocks', blocks: sectionBlocks },
  ],
}
