/// <reference types="vite/client" />
interface Window {
  livefySession?: { persistence(): Promise<'encrypted' | 'memory-only'> }
}
