#!/usr/bin/env python3
"""Scaffold a multi-tenant Payload storefront platform skeleton.

Writes a minimal, TODO-marked project structure for the five pillars
(tenancy, theme, commerce, payments) plus optional regional stubs.
It only writes files — it does not install dependencies.

Usage:
    python scaffold.py --target ./my-platform --regional none
    python scaffold.py --target ./my-platform --regional senegal
"""
import argparse
import os
from pathlib import Path

FILES: dict[str, str] = {}

FILES["src/middleware.ts"] = """\
// Tenant resolution — see references/tenancy.md
import { NextResponse } from 'next/server'

export async function middleware(req: Request) {
  const host = (req.headers.get('host') ?? '').split(':')[0]
  const tenantId = await resolveTenant(host) // TODO: cache (Redis/LRU) -> DB on miss
  if (!tenantId) return new NextResponse('Unknown store', { status: 404 })
  const res = NextResponse.next()
  res.headers.set('x-tenant-id', tenantId)
  return res
}

async function resolveTenant(_host: string): Promise<string | null> {
  // TODO: look up `domains` collection by hostname; return tenant id or null
  return null
}

export const config = { matcher: ['/((?!_next|api/admin|favicon).*)'] }
"""

FILES["src/access/tenantScoped.ts"] = """\
// Forced tenant filter — see references/tenancy.md
import type { Where } from 'payload'

export const tenantScoped = (req: any): Where | boolean => {
  const tenantId = req?.context?.tenantId
  if (!tenantId) return false
  return { tenant: { equals: tenantId } }
}
"""

FILES["src/collections/tenants.ts"] = """\
// see references/tenancy.md
export const Tenants = {
  slug: 'tenants',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'status', type: 'select', options: ['active', 'suspended'], defaultValue: 'active' },
    { name: 'activeTheme', type: 'relationship', relationTo: 'themes' },
    { name: 'themeSettings', type: 'json' },
    {
      name: 'paymentConfig', type: 'group', fields: [
        { name: 'provider', type: 'select', options: ['paydunya', 'cinetpay', 'stripe'] },
        { name: 'credentials', type: 'json' }, // TODO: encrypt at rest (payments.md)
        { name: 'mode', type: 'select', options: ['test', 'live'], defaultValue: 'test' },
      ],
    },
  ],
}
"""

FILES["src/collections/domains.ts"] = """\
// see references/tenancy.md
export const Domains = {
  slug: 'domains',
  fields: [
    { name: 'hostname', type: 'text', required: true, unique: true, index: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'isPrimary', type: 'checkbox', defaultValue: false },
  ],
}
"""

FILES["src/collections/pages.ts"] = """\
// see references/theme-engine.md — sections modeled as Payload blocks
import { tenantScoped } from '../access/tenantScoped'

const HeroBlock = { slug: 'hero', fields: [
  { name: 'title', type: 'text' },
  { name: 'image', type: 'upload', relationTo: 'media' },
  { name: 'ctaText', type: 'text' },
] }

const ProductGridBlock = { slug: 'product-grid', fields: [
  { name: 'heading', type: 'text' },
  { name: 'collection', type: 'relationship', relationTo: 'collections' },
  { name: 'columns', type: 'number', defaultValue: 3, min: 1, max: 6 },
  { name: 'limit', type: 'number', defaultValue: 9 },
] }

export const Pages = {
  slug: 'pages',
  access: { read: tenantScoped, create: tenantScoped, update: tenantScoped, delete: tenantScoped },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'sections', type: 'blocks', blocks: [HeroBlock, ProductGridBlock] }, // TODO: add more sections
  ],
}
"""

FILES["src/collections/products.ts"] = """\
// see references/commerce.md — prices in minor units (integers)
import { tenantScoped } from '../access/tenantScoped'

export const Products = {
  slug: 'products',
  access: { read: tenantScoped, create: tenantScoped, update: tenantScoped, delete: tenantScoped },
  hooks: { beforeChange: [({ req, data }: any) => ({ ...data, tenant: req?.context?.tenantId })] },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'description', type: 'richText' },
    { name: 'price', type: 'number', required: true },
    { name: 'currency', type: 'text', defaultValue: '__CURRENCY__' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'collection', type: 'relationship', relationTo: 'collections' },
    { name: 'stock', type: 'number', defaultValue: 0 },
    { name: 'status', type: 'select', options: ['draft', 'active', 'archived'], defaultValue: 'draft' },
  ],
}
"""

FILES["src/collections/orders.ts"] = """\
// see references/commerce.md — put Postgres RLS on this table (tenancy.md)
import { tenantScoped } from '../access/tenantScoped'

export const Orders = {
  slug: 'orders',
  access: { read: tenantScoped, create: tenantScoped, update: tenantScoped, delete: tenantScoped },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'orderNumber', type: 'text', index: true },
    { name: 'items', type: 'array', fields: [
      { name: 'product', type: 'relationship', relationTo: 'products' },
      { name: 'quantity', type: 'number' },
      { name: 'unitPrice', type: 'number' },
    ] },
    { name: 'total', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true },
    { name: 'customer', type: 'group', fields: [
      { name: 'name', type: 'text' }, { name: 'phone', type: 'text' }, { name: 'email', type: 'text' },
    ] },
    { name: 'status', type: 'select',
      options: ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'], defaultValue: 'pending' },
  ],
}
"""

FILES["src/collections/transactions.ts"] = """\
// see references/payments.md — providerRef is the idempotency key
import { tenantScoped } from '../access/tenantScoped'

export const Transactions = {
  slug: 'transactions',
  access: { read: tenantScoped, create: tenantScoped, update: tenantScoped, delete: tenantScoped },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'provider', type: 'text' },
    { name: 'providerRef', type: 'text', index: true },
    { name: 'amount', type: 'number' },
    { name: 'currency', type: 'text' },
    { name: 'status', type: 'select', options: ['pending', 'success', 'failed'], defaultValue: 'pending' },
    { name: 'rawWebhook', type: 'json' },
  ],
}
"""

FILES["src/payments/PaymentProvider.ts"] = """\
// Provider-agnostic payment interface — see references/payments.md
export interface InitiateParams {
  orderId: string; tenantId: string; amount: number; currency: string;
  customer: { name?: string; phone?: string; email?: string }; callbackUrl: string;
}
export interface InitiateResult { redirectUrl: string; providerRef: string }
export interface WebhookEvent { providerRef: string; status: 'success' | 'failed' | 'pending'; amount: number }
export type PaymentStatus = 'success' | 'failed' | 'pending' | 'unknown'

export interface PaymentProvider {
  initiate(p: InitiateParams): Promise<InitiateResult>
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null
  getStatus(providerRef: string): Promise<PaymentStatus>
}

// TODO: implement providerFactory(name, credentials) returning a PaymentProvider
"""

FILES["src/theme/sectionRegistry.ts"] = """\
// Maps section type -> React component — see references/theme-engine.md
// import { Hero } from './sections/Hero'
// import { ProductGrid } from './sections/ProductGrid'

export const sectionRegistry: Record<string, any> = {
  // hero: Hero,
  // 'product-grid': ProductGrid,
  // TODO: register each section component, keyed by its block slug
}
"""

FILES["src/app/[...slug]/page.tsx"] = """\
// Render loop (replaces Liquid) — see references/theme-engine.md
import { headers } from 'next/headers'
import { sectionRegistry } from '../../theme/sectionRegistry'

export default async function StorePage({ params }: { params: { slug?: string[] } }) {
  const tenantId = (await headers()).get('x-tenant-id')!
  const tenant = await getTenant(tenantId)            // TODO
  const page = await getPage(tenantId, params.slug?.join('/') || 'home') // TODO

  return (
    <div /* ThemeProvider injects CSS vars from tenant.themeSettings */>
      {page.sections.map((section: any, i: number) => {
        const Component = sectionRegistry[section.blockType]
        return Component ? <Component key={i} settings={section} tenantId={tenantId} /> : null
      })}
    </div>
  )
}

async function getTenant(_id: string): Promise<any> { return { themeSettings: {} } } // TODO
async function getPage(_t: string, _s: string): Promise<any> { return { sections: [] } } // TODO
"""

FILES["src/app/api/webhooks/[provider]/[tenantId]/route.ts"] = """\
// Tenant-scoped webhook handler — see references/payments.md (the four rules)
export async function POST(req: Request, { params }: { params: { provider: string; tenantId: string } }) {
  const raw = await req.text()
  const provider = await getProviderForTenant(params.tenantId) // TODO
  const event = provider.verifyWebhook(raw, req.headers)       // 1. signature
  if (!event) return new Response('invalid signature', { status: 401 })

  // 2. idempotency: skip if providerRef already processed
  // 3. amount: compare event.amount to the order's authoritative total
  // 4. (reconciliation handled by a separate sweep job)
  // On success: flip the order to 'paid', store rawWebhook, notify.

  return new Response('ok', { status: 200 })
}

async function getProviderForTenant(_t: string): Promise<any> { throw new Error('TODO') }
"""

REGIONAL_SENEGAL = {
    "src/payments/providers/PayDunyaProvider.ts": """\
// PayDunya implementation — see references/regional-senegal.md
// Verify endpoints/fields against current PayDunya docs.
import type { PaymentProvider, InitiateParams, InitiateResult, WebhookEvent, PaymentStatus } from '../PaymentProvider'

export class PayDunyaProvider implements PaymentProvider {
  constructor(private creds: { masterKey: string; privateKey: string; token: string }) {}
  async initiate(_p: InitiateParams): Promise<InitiateResult> { throw new Error('TODO') }
  verifyWebhook(_raw: string, _h: Headers): WebhookEvent | null { throw new Error('TODO') }
  async getStatus(_ref: string): Promise<PaymentStatus> { return 'unknown' }
}
""",
    "src/payments/providers/CinetPayProvider.ts": """\
// CinetPay implementation — see references/regional-senegal.md
import type { PaymentProvider, InitiateParams, InitiateResult, WebhookEvent, PaymentStatus } from '../PaymentProvider'

export class CinetPayProvider implements PaymentProvider {
  constructor(private creds: { apiKey: string; siteId: string }) {}
  async initiate(_p: InitiateParams): Promise<InitiateResult> { throw new Error('TODO') }
  verifyWebhook(_raw: string, _h: Headers): WebhookEvent | null { throw new Error('TODO') }
  async getStatus(_ref: string): Promise<PaymentStatus> { return 'unknown' }
}
""",
    "REGIONAL.md": """\
# Regional module: Senegal — ENABLED

This skeleton was generated with `--regional senegal`:
- default currency XOF (FCFA), default locale French
- PayDunya + CinetPay provider stubs under src/payments/providers/
- See references/regional-senegal.md for the mobile-money flow, the four
  webhook rules, SMS/WhatsApp notifications, and the regulatory note.
""",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--regional", choices=["none", "senegal"], default="none")
    args = ap.parse_args()

    root = Path(args.target)
    currency = "XOF" if args.regional == "senegal" else "USD"

    files = dict(FILES)
    if args.regional == "senegal":
        files.update(REGIONAL_SENEGAL)

    written = 0
    for rel, content in files.items():
        content = content.replace("__CURRENCY__", currency)
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        written += 1

    print(f"Scaffolded {written} files into {root}/ (regional={args.regional}, currency={currency})")
    print("Next: read the reference file for each pillar and fill in the TODOs.")
    print("This script wrote files only — install Payload, Next.js, and adapters separately.")


if __name__ == "__main__":
    main()
