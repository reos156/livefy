import type { ReactNode } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'

// Presentation only: callers retain ownership of access and session state.
export function VisualShell({ title, children }: { title: string; children: ReactNode }) {
  return <main className="visual-shell">
    <Card className="w-full max-w-[30rem] wrap-anywhere">
      <CardHeader className="flex flex-row items-center gap-3.5">
        <span className="visual-mark" aria-hidden="true">L</span>
        <CardTitle><h1>{title}</h1></CardTitle>
      </CardHeader>
      <CardContent className="visual-content">{children}</CardContent>
    </Card>
  </main>
}
