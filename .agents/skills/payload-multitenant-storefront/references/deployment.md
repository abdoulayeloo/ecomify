# Deployment & infrastructure

Wiring the one-app-many-stores platform onto a host. Reference setup is Coolify
+ Caddy on a VPS; substitute freely (the only hard requirement is "one app, one
partitioned database").

## Services

| Service | Role | Shared or per-tenant |
| --- | --- | --- |
| App (Next.js + Payload) | The single deployment serving all stores | Shared |
| PostgreSQL | Primary datastore, partitioned by tenant | Shared (one DB, tenant column + RLS) |
| Redis | Cache + Payload job queue | Shared |
| Meilisearch | Product search | Shared (tenant-filtered index) |
| MinIO / S3 | Media storage | Shared bucket, keys prefixed per tenant |
| Caddy | Reverse proxy, HTTPS, domain routing | Shared |

## Domain routing (the multi-store entry point)

Two kinds of hostname must reach the same app:
- **Platform subdomains** — `store-a.yourplatform.com`, via a wildcard.
- **Custom merchant domains** — `boutique-a.com`, added per merchant.

Caddy handles both. Wildcard needs DNS-01 ACME (a DNS provider API) because
HTTP-01 can't validate wildcards.

```
*.yourplatform.com {
  reverse_proxy app:3000
  tls { dns <your-dns-provider> }   # DNS-01 for wildcard certs
}

# custom domains: one block, or on-demand TLS to avoid editing Caddy per merchant
:443 {
  reverse_proxy app:3000
  tls { on_demand }
}
```

On-demand TLS lets a merchant point their domain at your server and get a cert
automatically — but **gate it** with an `ask` endpoint so Caddy only issues
certs for hostnames you recognize (query your `domains` collection), or you
become an open cert mint.

```
{
  on_demand_tls { ask http://app:3000/api/domains/verify }
}
```

The app's `/api/domains/verify?domain=` returns 200 if the hostname exists in
the `domains` collection, else 4xx. This ties cert issuance to real tenants.

## Environment layout

Per-app env (not per-tenant — tenant config lives in the DB):

```
DATABASE_URL=postgres://...
REDIS_URL=redis://...
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=...
S3_ENDPOINT=http://minio:9000
S3_BUCKET=platform-media
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
PAYLOAD_SECRET=...
PAYMENT_ENC_KEY=...   # 32-byte hex, master key for per-tenant credential encryption
```

Per-tenant settings (theme, payment credentials, active theme) are rows in
Postgres, never env vars — that's the point of multi-tenancy.

## S3 / MinIO via Payload

Use `@payloadcms/storage-s3`. One bucket, keys prefixed by tenant so media is
organized and listable per store:

```ts
s3Storage({
  collections: { media: { prefix: ({ req }) => `tenants/${req.context?.tenantId}/` } },
  bucket: process.env.S3_BUCKET,
  config: { endpoint: process.env.S3_ENDPOINT, region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! } },
})
```

`forcePathStyle: true` is required for MinIO. Confirm the exact adapter option
names against the current `@payloadcms/storage-s3` docs — they shift between
versions.

## Coolify notes

- Run Postgres, Redis, Meilisearch, MinIO as managed services; the app as a
  Docker app pointing at them by internal hostname.
- For the proxy: either Coolify's built-in proxy or a dedicated Caddy container.
  A dedicated Caddy gives you the wildcard + on-demand TLS control above; the
  built-in proxy is simpler but less flexible for custom-domain-per-tenant.
- Raise the proxy timeout for long-running webhook/API calls if needed.
- These operational details change with Coolify versions — verify current
  behavior in Coolify's docs rather than trusting a fixed recipe.

## Deploy-time checks

After deploying, run the three acceptance proofs from `architecture.md`:
two domains render distinct stores; cross-tenant API read returns nothing;
a test payment flips an order to paid only on webhook.
