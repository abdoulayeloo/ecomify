import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  const users = await payload.find({ collection: 'users', limit: 10, overrideAccess: true, depth: 0 })
  for (const u of users.docs) {
    console.log(`user #${u.id} ${u.email} | tenants=${JSON.stringify((u as any).tenants)}`)
  }
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
