import type { CollectionConfig } from 'payload'

import { tenantScoped } from '../access/tenantScoped'

// Payment attempts. `providerRef` is the idempotency key (rule 2); `amount` is
// the expected total for the webhook amount-check (rule 3); `rawWebhook` stores
// the raw payload — invaluable in production debugging. Put RLS on this table.
// See references/payments.md.
export const Transactions: CollectionConfig = {
  slug: 'transactions',
  admin: { useAsTitle: 'providerRef' },
  access: {
    read: tenantScoped,
    create: tenantScoped,
    update: tenantScoped,
    delete: tenantScoped,
  },
  // The `tenant` field is added automatically by @payloadcms/plugin-multi-tenant.
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'provider', type: 'text' },
    { name: 'providerRef', type: 'text', index: true }, // idempotency key
    { name: 'amount', type: 'number' }, // expected amount, for rule 3
    { name: 'currency', type: 'text' },
    {
      name: 'status',
      type: 'select',
      options: ['pending', 'success', 'failed'],
      defaultValue: 'pending',
      index: true,
    },
    { name: 'rawWebhook', type: 'json' },
  ],
}
