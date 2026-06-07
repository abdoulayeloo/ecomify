// Internal-only tenant resolver hit by the proxy (src/proxy.ts). Runs on the
// Node runtime so it can use the Payload local API. Guarded by a shared secret so
// it can't be called from outside. See references/tenancy.md.
import { NextResponse } from 'next/server'

import { resolveTenant } from '../../../../tenancy/resolveTenant'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const expected = process.env.INTERNAL_API_SECRET
  // Fail loudly on misconfiguration rather than returning a silent 403 that
  // surfaces downstream as a generic "Unknown store" 404. A common foot-gun:
  // the env var missing or the dev server started before .env was complete.
  if (!expected) {
    console.error(
      '[resolve-tenant] INTERNAL_API_SECRET is not set. Add it to .env and restart the dev server.',
    )
    return new NextResponse('server misconfigured: INTERNAL_API_SECRET missing', { status: 500 })
  }

  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== expected) {
    return new NextResponse('forbidden', { status: 403 })
  }

  const host = new URL(req.url).searchParams.get('host') ?? ''
  const tenantId = await resolveTenant(host)
  return NextResponse.json({ tenantId })
}
