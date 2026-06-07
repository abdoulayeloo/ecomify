import type { Block } from 'payload'

// Section definitions, modeled as Payload blocks. Each block is one section type
// the merchant can add/reorder/configure in the admin (the Theme Editor for
// free). The block `slug` is the key the section registry maps to a component.
// See references/theme-engine.md.

export const HeroBlock: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'subtitle', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'ctaText', type: 'text' },
    { name: 'ctaHref', type: 'text' },
  ],
}

export const ProductGridBlock: Block = {
  slug: 'product-grid',
  labels: { singular: 'Product grid', plural: 'Product grids' },
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'collection', type: 'relationship', relationTo: 'product-collections' },
    { name: 'columns', type: 'number', defaultValue: 3, min: 1, max: 6 },
    { name: 'limit', type: 'number', defaultValue: 9 },
  ],
}

export const RichTextBlock: Block = {
  slug: 'rich-text',
  labels: { singular: 'Rich text', plural: 'Rich text blocks' },
  fields: [{ name: 'content', type: 'richText' }],
}

// Every section block the platform ships. Pages.sections allows all of them.
export const sectionBlocks: Block[] = [HeroBlock, ProductGridBlock, RichTextBlock]
