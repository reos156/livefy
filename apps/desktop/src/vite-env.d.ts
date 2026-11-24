/// <reference types="vite/client" />
interface Window {
  livefySession?: {
    persistence(): Promise<'encrypted' | 'memory-only'>
    logout(): Promise<void>
    preserveAndQuit?(): Promise<void>
  }
}
