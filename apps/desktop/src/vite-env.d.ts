/// <reference types="vite/client" />
// The surface's own lifecycle, reported by the main process. `failed` carries the reason
// so the column can explain what happened instead of showing an empty rectangle.
type LiveSurfaceStatus =
  | { mounted: false; state: 'idle' }
  | { mounted: true; state: 'loading' | 'ready' }
  | { mounted: true; state: 'failed'; reason: string }

interface Window {
  livefySession?: {
    persistence(): Promise<'encrypted' | 'memory-only'>
    logout(): Promise<void>
    preserveAndQuit?(): Promise<void>
  }
  // Present only in the Electron shell. A rectangle, a channel handle and a status, never
  // a URL: main validates the handle and builds the address.
  livefyLive?: {
    mount(channel: string): Promise<LiveSurfaceStatus>
    setBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<boolean>
    unmount(): Promise<LiveSurfaceStatus>
    status(): Promise<LiveSurfaceStatus>
    onStatus(listener: (status: LiveSurfaceStatus) => void): () => void
  }
}