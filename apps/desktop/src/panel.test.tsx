import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { DashboardStats } from './lib/shop-api'

const state = vi.hoisted(() => ({ stats: undefined as DashboardStats | undefined }))
vi.mock('convex/react', () => ({ useQuery: () => state.stats }))

import { Panel } from './panel'

const stats: DashboardStats = {
  shopId: 'shop_1',
  shopName: 'Mundo Kawaii',
  liveConnection: null,
  metrics: { activeLives: 0, newLeads: 0, pendingLeads: 0, conversionRate: 0, estimatedSales: 0 },
  lives: [],
}

afterEach(() => {
  cleanup()
  Object.assign(state, { stats: undefined })
  document.documentElement.classList.remove('dark')
  delete window.livefyLive
  vi.unstubAllGlobals()
})

describe('panel — the empty three-column dashboard', () => {
  it('waits on the dashboard query without painting the panel', () => {
    state.stats = undefined
    render(<Panel onEditStore={() => {}} />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('Lives activos')).toBeNull()
  })

  it('shows the five metrics at zero with their no-data footer', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    for (const label of ['Lives activos', 'Leads nuevos', 'Pendientes', 'Conversión', 'Ventas estimadas']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getAllByText('Sin datos todavía')).toHaveLength(5)
    expect(screen.getByText('0 %')).toBeTruthy()
    expect(screen.getByText('$0')).toBeTruthy()
  })

  it('names the three columns of the workspace', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    for (const heading of ['Live de TikTok', 'Productos', 'Leads']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy()
    }
  })

  it('leaves the first-live call to action disabled and explains why', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    const cta = screen.getByRole('button', { name: 'Conectá tu primer live' }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    const describedBy = cta.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toContain('La conexión de lives llega en la próxima etapa.')
  })

  it('keeps the live-ending action disabled while no live is connected', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    expect((screen.getByRole('button', { name: 'Finalizar live' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders the unimplemented destinations as disabled and the reachable ones as enabled', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    for (const label of ['Leads', 'Ventas', 'Productos']) {
      const item = screen.getByRole('button', { name: new RegExp(`^${label}`) }) as HTMLButtonElement
      expect(item.disabled).toBe(true)
      expect(item.getAttribute('aria-disabled')).toBe('true')
      expect(item.textContent).toContain('pronto')
    }
    for (const label of ['Panel', 'Tienda']) {
      const item = screen.getByRole('button', { name: label }) as HTMLButtonElement
      expect(item.disabled).toBe(false)
      expect(item.getAttribute('aria-disabled')).toBeNull()
    }
    expect(screen.getByRole('button', { name: 'Panel' }).getAttribute('aria-current')).toBe('page')
  })
})

describe('panel — dashboard chrome', () => {
  it('collapses the sidebar to an icon rail that keeps every item named, and expands it back', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)
    const sidebar = screen.getByRole('complementary', { name: 'Principal' })

    // Expanded: the labels and their group headings are visible text.
    expect(within(sidebar).getByText('Leads')).toBeTruthy()
    expect(within(sidebar).getByText('Operación')).toBeTruthy()

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Contraer barra lateral' }))

    expect(within(sidebar).queryByText('Leads')).toBeNull()
    expect(within(sidebar).queryByText('Operación')).toBeNull()
    for (const name of ['Panel', 'Leads', 'Ventas', 'Productos', 'Tienda']) {
      expect(within(sidebar).getByRole('button', { name })).toBeTruthy()
    }

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Expandir barra lateral' }))

    expect(within(sidebar).getByText('Leads')).toBeTruthy()
    expect(within(sidebar).getByText('Operación')).toBeTruthy()
  })

  it('states which shop the panel is showing, without offering a switcher', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    expect(screen.getByText('Mundo Kawaii')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mundo Kawaii/ })).toBeNull()
    expect(screen.queryByText(/única tienda/i)).toBeNull()
  })

  it('flips the document theme from the top bar and announces its own state', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    const toggle = screen.getByRole('button', { name: 'Cambiar a tema oscuro' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(toggle)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    const flipped = screen.getByRole('button', { name: 'Cambiar a tema claro' })
    expect(flipped.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(flipped)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('opens the account menu with exactly the three entries', async () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Menú de la cuenta' }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Panel', 'Modo oscuro', 'Log out'])
  })

  it('carries no notification control, because nothing can be notified', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    expect(screen.queryByRole('button', { name: /Notificaciones/ })).toBeNull()
  })
})

// The live surface is a rectangle the main process fills with third-party content. These
// assertions are about the renderer's only two jobs: ask for it, and say what is happening
// without pretending the content is part of this document.
describe('panel — the live surface', () => {
  function bridgeStub() {
    const calls: string[] = []
    let emit: ((status: LiveSurfaceStatus) => void) | undefined
    const api = {
      status: vi.fn(async (): Promise<LiveSurfaceStatus> => ({ mounted: false, state: 'idle' })),
      mount: vi.fn(async (): Promise<LiveSurfaceStatus> => { calls.push('mount'); return { mounted: true, state: 'loading' } }),
      setBounds: vi.fn(async () => { calls.push('bounds'); return true }),
      unmount: vi.fn(async (): Promise<LiveSurfaceStatus> => { calls.push('unmount'); return { mounted: false, state: 'idle' } }),
      onStatus: (listener: (status: LiveSurfaceStatus) => void) => { emit = listener; return () => { emit = undefined } },
    }
    return { api, calls, emit: (status: LiveSurfaceStatus) => emit?.(status) }
  }

  function renderWithSurface() {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const bridge = bridgeStub()
    window.livefyLive = bridge.api
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)
    return bridge
  }

  it('offers the live only where the native surface exists', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    const cta = screen.getByRole('button', { name: 'Conectá tu primer live' }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Abrir el live de TikTok' })).toBeNull()
  })

  it('asks main to mount, after reporting where the rectangle sits', async () => {
    const bridge = renderWithSurface()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir el live de TikTok' }))

    await act(async () => {})
    expect(bridge.api.mount).toHaveBeenCalledOnce()
    expect(bridge.api.setBounds).toHaveBeenCalled()
    // Position before the guest exists, or the first paint lands at the window origin.
    expect(bridge.calls.indexOf('bounds')).toBeLessThan(bridge.calls.indexOf('mount'))
  })

  it('announces loading and then leaves the rectangle to the native view', async () => {
    const bridge = renderWithSurface()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir el live de TikTok' }))
    expect(await screen.findByText('Cargando TikTok…')).toBeTruthy()

    act(() => bridge.emit({ mounted: true, state: 'ready' }))

    expect(screen.queryByText('Cargando TikTok…')).toBeNull()
    expect(screen.queryByText('Ningún live conectado')).toBeNull()
  })

  it('names a failed load instead of showing an empty rectangle', async () => {
    const bridge = renderWithSurface()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir el live de TikTok' }))
    await act(async () => {})
    act(() => bridge.emit({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' }))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('NAME_NOT_RESOLVED')
    expect(screen.getByRole('region', { name: 'Superficie del live de TikTok' })).toBeTruthy()
  })

  it('closes the surface when the operator asks', async () => {
    const bridge = renderWithSurface()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir el live de TikTok' }))
    await act(async () => {})
    act(() => bridge.emit({ mounted: true, state: 'ready' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor' }))
    await act(async () => {})

    expect(bridge.api.unmount).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Abrir el live de TikTok' })).toBeTruthy()
  })
})