# Commerce: catalog, cart, orders

The shared commerce data model, partitioned by tenant. Every collection here
carries a `tenant` field and uses the `tenantScoped` access from `tenancy.md`.

## Collections

### `collections` (product groupings — "categories")
Name clashes with Payload's own term; call the slug `product-collections` if it
confuses. Fields: `tenant`, `title`, `slug`, optional `parent` (self-relation
for hierarchy).

### `products`
```ts
{
  slug: 'products',
  access: { /* tenantScoped */ },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'description', type: 'richText' },
    { name: 'price', type: 'number', required: true },   // store in minor units to avoid float bugs
    { name: 'currency', type: 'text', defaultValue: 'USD' }, // 'XOF' if regional module on
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'collection', type: 'relationship', relationTo: 'collections' },
    { name: 'stock', type: 'number', defaultValue: 0 },
    { name: 'status', type: 'select', options: ['draft','active','archived'], defaultValue: 'draft' },
  ],
}
```

Store prices in **minor units** (cents, or for XOF the smallest practical unit)
as integers. Floating-point money is a recurring source of off-by-a-cent bugs.

### `orders`
```ts
{
  slug: 'orders',
  access: { /* tenantScoped — and put RLS on this table, see tenancy.md */ },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'orderNumber', type: 'text', index: true },
    { name: 'items', type: 'array', fields: [
      { name: 'product', type: 'relationship', relationTo: 'products' },
      { name: 'quantity', type: 'number' },
      { name: 'unitPrice', type: 'number' }, // snapshot at purchase time
    ]},
    { name: 'total', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true },
    { name: 'customer', type: 'group', fields: [
      { name: 'name', type: 'text' }, { name: 'phone', type: 'text' }, { name: 'email', type: 'text' },
    ]},
    { name: 'status', type: 'select',
      options: ['pending','paid','fulfilled','cancelled','refunded'], defaultValue: 'pending' },
  ],
}
```

Snapshot `unitPrice` into each order item. If a merchant edits a product's price
later, historical orders must keep what the customer actually paid.

## Cart

Cart can be client-side state for a simple build (no collection), or a
server-side `carts` collection if you need abandoned-cart recovery or
cross-device persistence. Start client-side; add the collection when a feature
demands it. Either way, **recompute the total server-side** at checkout from
current product prices — never trust a client-sent total.

## Checkout flow (sets up payment)

1. Client posts cart (product ids + quantities) to a checkout route handler.
2. Server resolves tenant, loads those products *scoped to the tenant*,
   recomputes the authoritative total, checks stock.
3. Server creates an `order` with status `pending`.
4. Server calls the tenant's `PaymentProvider.initiate()` (see `payments.md`)
   with the authoritative amount and the order id, gets back a redirect URL or
   token, returns it to the client.
5. Order flips to `paid` later, only via webhook. Checkout does NOT mark it paid.

The boundary between this file and `payments.md` is step 4: commerce produces a
`pending` order and hands the amount to the payment layer.

## Search: Meilisearch per tenant

Index products into Meilisearch on create/update via a Payload `afterChange`
hook. Namespace per tenant so searches never cross stores — either one index per
tenant (`products_<tenantId>`) or a single index with a `tenant` filter applied
on every query. One-index-with-filter is simpler to operate; per-tenant-index
isolates better and lets you tune per store. For most platforms, single index +
mandatory `tenant` filter is the right default.

```ts
hooks: {
  afterChange: [async ({ doc }) => {
    await meili.index('products').addDocuments([{
      id: doc.id, tenant: doc.tenant, title: doc.title, /* ... */
    }])
  }],
  afterDelete: [async ({ doc }) => { await meili.index('products').deleteDocument(doc.id) }],
}
```

Always include `tenant` in the indexed document and add it to Meilisearch's
`filterableAttributes`, then force `filter: \`tenant = ${tenantId}\`` on every
storefront query. A forgotten filter here leaks one store's catalog into
another's search results.
