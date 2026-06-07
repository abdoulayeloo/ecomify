// Rich text section. The `content` is Lexical JSON; render it with
// @payloadcms/richtext-lexical's React renderer when you wire real output.
// See references/theme-engine.md.
import type { SectionProps } from '../sectionRegistry'

export function RichText({ settings }: SectionProps) {
  return (
    <section style={{ padding: '2rem 1.5rem' }}>
      {/* TODO: render `settings.content` (Lexical JSON) with the official
          RichText converter from @payloadcms/richtext-lexical/react. */}
      <pre style={{ display: 'none' }}>{JSON.stringify(settings.content)}</pre>
    </section>
  )
}
