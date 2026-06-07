// Maps a section block slug -> its React component. This `.map()` lookup in the
// render loop is the templating engine (the React/JSON equivalent of Liquid).
// Keys MUST match the block slugs in theme/blocks.ts. See references/theme-engine.md.
import type { ComponentType } from 'react'

import { Hero } from './sections/Hero'
import { ProductGrid } from './sections/ProductGrid'
import { RichText } from './sections/RichText'

// Settings is the block instance data; shape varies per section, so it's loose.
export interface SectionProps {
  settings: Record<string, any>
  tenantId: string
}

export const sectionRegistry: Record<string, ComponentType<SectionProps>> = {
  hero: Hero,
  'product-grid': ProductGrid,
  'rich-text': RichText,
  // TODO: register each new section here, keyed by its block slug.
}
