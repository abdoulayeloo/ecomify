import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Tenants } from './collections/Tenants'
import { Domains } from './collections/Domains'
import { Themes } from './collections/Themes'
import { Pages } from './collections/Pages'
import { ProductCollections } from './collections/ProductCollections'
import { Products } from './collections/Products'
import { Orders } from './collections/Orders'
import { Transactions } from './collections/Transactions'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    // Tenancy
    Tenants,
    Domains,
    // Theme engine
    Themes,
    Pages,
    // Commerce
    ProductCollections,
    Products,
    Orders,
    // Payments
    Transactions,
  ],
  // Regional module ON: French default content locale, FCFA-oriented.
  localization: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    fallback: true,
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    // The plugin automates the admin-side tenant scoping UX on top of the
    // hand-rolled tenantScoped access already on each collection (second
    // seatbelt + a tenant selector in admin). See references/tenancy.md.
    multiTenantPlugin({
      tenantsSlug: 'tenants',
      collections: {
        pages: {},
        'product-collections': {},
        products: {},
        orders: {},
        transactions: {},
      },
    }),
  ],
})
