// Tenant resolution — maps an incoming Host header to a tenant id and forwards
// it downstream as `x-tenant-id`. See references/tenancy.md.
//
// Next.js 16 renamed the `middleware` convention to `proxy` (this file). Proxy
// defaults to the Node.js runtime. It resolves the tenant via an internal route
// (/api/internal/resolve-tenant) which does the cached DB lookup, keeping the DB
// connection out of the request hot path here.
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
  return resolve(req)
}

async function resolve(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0]

  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    console.error(
      '[proxy] INTERNAL_API_SECRET is not set — tenant resolution will fail. Add it to .env and restart.',
    )
  }

  const resolveUrl = new URL('/api/internal/resolve-tenant', req.url)
  resolveUrl.searchParams.set('host', host)

  let tenantId: string | null = null
  try {
    const res = await fetch(resolveUrl, {
      headers: { 'x-internal-secret': secret ?? '' },
    })
    if (res.ok) tenantId = (await res.json()).tenantId ?? null
  } catch {
    // Resolver unreachable — fall through to the 404 below.
  }

  if (!tenantId) return new NextResponse('Unknown store', { status: 404 })

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-tenant-id', tenantId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

// Skip Next internals, the Payload admin, and the Payload/internal API routes
// (those resolve tenancy themselves and must not 404 on an unknown host).
export const config = {
  matcher: ['/((?!_next|admin|api|favicon.ico).*)'],
}
