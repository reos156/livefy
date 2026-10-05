import { Button } from '@/components/ui/button'

export function AccessLanding() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Livefy</h1>
      <p className="text-muted-foreground">
        Email and password access is not available yet. This desktop preview does not collect credentials.
      </p>
      <Button disabled>Sign in — coming soon</Button>
    </main>
  )
}
