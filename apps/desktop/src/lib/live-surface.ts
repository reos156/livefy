import { useCallback, useEffect, useRef, useState } from 'react'

// The surface lives in the main process. The renderer owns two things only: where the
// rectangle goes and what to say while it loads, plus the channel the operator asked for.
// A missing bridge means the browser build, where the surface does not exist and the
// column must say so instead of pretending.
type Bounds = { x: number; y: number; width: number; height: number }

function toBounds(rect: DOMRect): Bounds {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

export function useLiveSurface() {
  const bridge = typeof window === 'undefined' ? undefined : window.livefyLive
  const [status, setStatus] = useState<LiveSurfaceStatus>({ mounted: false, state: 'idle' })
  const frame = useRef<HTMLDivElement | null>(null)

  // Main reports every transition, so a failed load surfaces as a reason instead of an
  // empty rectangle. The read on mount covers a surface that was already running.
  useEffect(() => {
    if (!bridge) return
    let current = true
    void bridge.status().then(next => { if (current) setStatus(next) }).catch(() => {})
    const off = bridge.onStatus(next => setStatus(next))
    return () => {
      current = false
      off?.()
    }
  }, [bridge])

  const report = useCallback((): Bounds | undefined => {
    const element = frame.current
    if (!bridge || !element) return undefined
    const bounds = toBounds(element.getBoundingClientRect())
    void bridge.setBounds(bounds)
    return bounds
  }, [bridge])

  // Any layout change moves the rectangle: the sidebar collapsing, the window resizing, the
  // page scrolling. The observer covers the first two, the listeners the third.
  useEffect(() => {
    if (!bridge) return
    const element = frame.current
    if (!element) return
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => { report() })
    observer?.observe(element)
    const onViewportChange = () => { report() }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [bridge, report])

  const mount = useCallback(async (channel: string) => {
    if (!bridge) return
    // Position before creating the guest: it must never paint at the window origin first.
    report()
    try {
      setStatus(await bridge.mount(channel))
    } catch {
      // Main refused the channel or the bridge broke. That is a failed surface, not a
      // silently empty rectangle; the renderer cannot tell whether the guest exists.
      setStatus({ mounted: true, state: 'failed', reason: 'rechazo del proceso principal' })
    }
    report()
  }, [bridge, report])

  const unmount = useCallback(async () => {
    if (!bridge) return
    setStatus(await bridge.unmount())
  }, [bridge])

  // The guest is a sibling of this document, not a child of it, so nothing about a renderer
  // teardown closes it: routing to another screen unmounts the panel without a document
  // reload, and the surface would stay attached at its old rectangle, playing audio and
  // swallowing pointer events over the next screen. The effect runs once; this is its
  // release. It deliberately touches no state, because the component is going away.
  useEffect(() => {
    if (!bridge) return
    return () => {
      void bridge.unmount().catch(() => {})
    }
  }, [bridge])

  // A failed guest is replaced, not repaired: the renderer owns no part of it, so retrying
  // means releasing it and mounting a fresh one for the channel that failed.
  const restart = useCallback(async (channel: string) => {
    if (!bridge) return
    await unmount()
    await mount(channel)
  }, [bridge, mount, unmount])

  return { available: Boolean(bridge), status, frame, report, mount, unmount, restart }
}
