// Storefront home (path "/"). Delegates to the same render loop as [...slug],
// resolving the tenant's `home` page. See references/theme-engine.md.
import StorePage from './[...slug]/page'

export default async function HomePage() {
  return StorePage({ params: Promise.resolve({ slug: [] }) })
}
