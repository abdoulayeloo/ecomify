// Injects per-tenant design tokens as CSS custom properties. Components reference
// them as `var(--color-primary)` etc. — NOT as dynamic Tailwind classes, which
// get purged at build time. See references/theme-engine.md.
import type { CSSProperties, ReactNode } from 'react'

export interface ThemeSettings {
  primaryColor?: string
  onPrimaryColor?: string
  bgColor?: string
  textColor?: string
  headingFont?: string
  bodyFont?: string
}

export function ThemeProvider({
  settings,
  children,
}: {
  settings: ThemeSettings | null | undefined
  children: ReactNode
}) {
  const s = settings ?? {}
  const vars = {
    '--color-primary': s.primaryColor ?? '#111827',
    '--color-on-primary': s.onPrimaryColor ?? '#ffffff',
    '--color-bg': s.bgColor ?? '#ffffff',
    '--color-text': s.textColor ?? '#111827',
    '--font-heading': s.headingFont ?? 'system-ui, sans-serif',
    '--font-body': s.bodyFont ?? 'system-ui, sans-serif',
  } as CSSProperties

  return (
    <div style={{ ...vars, fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      {children}
    </div>
  )
}
