// Hero section. Receives its block data as `settings`. See references/theme-engine.md.
import type { SectionProps } from '../sectionRegistry'

export function Hero({ settings }: SectionProps) {
  const image = typeof settings.image === 'object' ? settings.image : null
  return (
    <section
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}
    >
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.alt ?? ''} style={{ maxWidth: '100%' }} />
      ) : null}
      {settings.title ? (
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem' }}>
          {settings.title}
        </h1>
      ) : null}
      {settings.subtitle ? <p>{settings.subtitle}</p> : null}
      {settings.ctaText ? (
        <a
          href={settings.ctaHref ?? '#'}
          style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary, #fff)',
            borderRadius: '0.5rem',
          }}
        >
          {settings.ctaText}
        </a>
      ) : null}
    </section>
  )
}
