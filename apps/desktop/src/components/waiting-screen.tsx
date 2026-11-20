import { Spinner } from '@/components/kibo-ui/spinner'

// The wait is the ring alone on the shared shell background: no brand mark, no
// title and no card, so the cue never reads as a separate floating object next to
// the mark. Centring comes from the existing `.visual-shell` layout; the status is
// announced by this single hidden live region and never painted.
//
// Deliberately not an `Alert`: the Alert primitive carries `relative` and `w-full`,
// which beat `sr-only`'s `position:absolute` and `width:1px`, so a hidden Alert is
// clipped but still occupies its full width in the layout.
//
// Colour: the brand lime measures 14.72:1 on the dark shell but only 1.12:1 on the
// light one, where it would be invisible, so the ring is lime in the dark theme and
// the foreground role in the light theme.
export function WaitingScreen({ label }: { label: string }) {
  return <main className="visual-shell">
    <span role="status" className="sr-only">{label}</span>
    <Spinner variant="ring" size={28} className="text-foreground dark:text-primary" />
  </main>
}