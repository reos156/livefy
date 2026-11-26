import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'

// Presentation only: callers retain ownership of access and session state, and of
// the wait cue they paint inside the content slot.
// `wide` is opt-in: one form carries a two-column card grid that does not fit the
// single-column width every other screen uses, so it widens alone and the rest is untouched.
export function VisualShell({ title, children, providerSurface = false, wide = false }: {
  title: string; children: ReactNode; providerSurface?: boolean; wide?: boolean
}) {
  const mark = <span className="visual-mark" aria-hidden="true">L</span>
  // Opt-in: the provider owns its card and typography. Other screens stay unchanged.
  if (providerSurface) return <main className="visual-shell">
    <section className="provider-surface">
      <header className="flex items-center gap-3.5">
        {mark}
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  </main>
  return <main className="visual-shell">
    <Card className={cn('w-full wrap-anywhere', wide ? 'max-w-[64rem]' : 'max-w-[30rem]')}>
      <CardHeader className="flex flex-row items-center gap-3.5">
        {mark}
        <CardTitle><h1>{title}</h1></CardTitle>
      </CardHeader>
      <CardContent className="visual-content">{children}</CardContent>
    </Card>
  </main>
}
