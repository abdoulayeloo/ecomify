import type { CollectionConfig } from 'payload'

import { tenantScoped } from '../access/tenantScoped'

// Orders. Put Postgres RLS on this table as a second seatbelt (see
// migrations/0001_rls_money_tables.sql and references/tenancy.md). `unitPrice` is
// snapshotted per item so historical orders keep what was actually paid even if
// the product price later changes. See references/commerce.md.
export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: { useAsTitle: 'orderNumber' },
  access: {
    read: tenantScoped,
    create: tenantScoped,
    update: tenantScoped,
    delete: tenantScoped,
  },
  // The `tenant` field is added automatically by @payloadcms/plugin-multi-tenant.
  fields: [
    { name: 'orderNumber', type: 'text', index: true },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products' },
        { name: 'quantity', type: 'number' },
        { name: 'unitPrice', type: 'number' }, // snapshot at purchase time
      ],
    },
    { name: 'total', type: 'number', required: true }, // authoritative, server-computed
    { name: 'currency', type: 'text', required: true },
    {
      name: 'customer',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'phone', type: 'text' }, // first-class in the regional module
        { name: 'email', type: 'text' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'],
      defaultValue: 'pending',
      index: true,
    },
  ],
  // TODO (regional-senegal.md): afterChange hook firing an SMS/WhatsApp
  // notification job (Redis-backed) when status flips to paid/fulfilled.
}
