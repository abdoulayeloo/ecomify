import type { CollectionConfig } from 'payload'

import { encryptCredentials } from '../payments/crypto'

// The store itself. One row per merchant. See references/tenancy.md.
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: { useAsTitle: 'name' },
  access: {
    // Only platform staff manage tenants — never a storefront request.
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      options: ['active', 'suspended'],
      defaultValue: 'active',
      required: true,
    },
    { name: 'activeTheme', type: 'relationship', relationTo: 'themes' },
    // Per-tenant design tokens: colors, fonts, logo. Consumed by ThemeProvider.
    { name: 'themeSettings', type: 'json' },
    {
      name: 'paymentConfig',
      type: 'group',
      fields: [
        {
          name: 'provider',
          type: 'select',
          options: ['paydunya', 'cinetpay', 'stripe'],
        },
        {
          // ENCRYPTED at rest with PAYMENT_ENC_KEY (see payments/crypto.ts).
          // Decrypted only at point of use when building a provider.
          name: 'credentials',
          type: 'json',
          access: {
            // Never expose ciphertext (or anything) over the API read path.
            read: () => false,
          },
          hooks: {
            beforeChange: [
              ({ value }) => (value == null ? value : encryptCredentials(value)),
            ],
          },
        },
        {
          name: 'mode',
          type: 'select',
          options: ['test', 'live'],
          defaultValue: 'test',
        },
      ],
    },
    // Regional defaults (Senegal module ON): FCFA + French.
    { name: 'defaultCurrency', type: 'text', defaultValue: 'XOF' },
    { name: 'defaultLocale', type: 'text', defaultValue: 'fr' },
  ],
}
