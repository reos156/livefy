import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { DashboardStats } from './lib/shop-api'

const state = vi.hoisted(() => ({ stats: undefined as DashboardStats | undefined }))
vi.mock('convex/react', () => ({ useQuery: () => state.stats }))

import { Panel } from './panel'

// Non-zero metrics on purpose: if the KPI row came back, the values would show up and the
// "no KPI row" assertions below would fail instead of passing by coincidence.
const stats: DashboardStats = {
  shopId: 'shop_1',
  shopName: 'Mundo Kawaii',
  liveConnection: null,
  metrics: { activeLives: 3, newLeads: 12, pendingLeads: 4, conversionRate: 0.42, estimatedSales: 1250000 },
  lives: [],
}

afterEach(() => {
  cleanup()
  Object.assign(state, { stats: undefined })
  document.documentElement.classList.remove('dark')
  delete window.livefyLive
  vi.unstubAllGlobals()
})

// jsdom has no layout, so the panel decides its breakpoint from `matchMedia`; the harness
// for it is a stub, and the assertions below are about the composition it produces.
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

function bridgeStub(mountFails = false) {
  const calls: string[] = []
  let emit: ((status: LiveSurfaceStatus) => void) | undefined
  const api = {
    status: vi.fn(async (): Promise<LiveSurfaceStatus> => ({ mounted: false, state: 'idle' })),
    mount: vi.fn(async (handle: string): Promise<LiveSurfaceStatus> => {
      calls.push('mount')
      if (mountFails) throw new Error('Denied')
      return { mounted: true, state: 'loading' }
    }),
    setBounds: vi.fn(async () => { calls.push('bounds'); return true }),
    unmount: vi.fn(async (): Promise<LiveSurfaceStatus> => { calls.push('unmount'); return { mounted: false, state: 'idle' } }),
    onStatus: (listener: (status: LiveSurfaceStatus) => void) => { emit = listener; return () => { emit = undefined } },
  }
  return { api, calls, emit: (status: LiveSurfaceStatus) => emit?.(status) }
}

function renderWithSurface(mountFails = false) {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const bridge = bridgeStub(mountFails)
  window.livefyLive = bridge.api
  state.stats = stats
  const view = render(<Panel onEditStore={() => {}} />)
  return { ...bridge, view }
}

function channelInput(): HTMLInputElement {
  return screen.getByLabelText('Canal de TikTok') as HTMLInputElement
}

function typeChannel(value: string) {
  fireEvent.change(channelInput(), { target: { value } })
}

function openLiveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Abrir el live' }) as HTMLButtonElement
}

function describedText(control: HTMLElement): string {
  const id = control.getAttribute('aria-describedby')
  expect(id).toBeTruthy()
  return document.getElementById(id as string)?.textContent ?? ''
}

describe('panel — the empty three-column dashboard', () => {
  it('waits on the dashboard query without painting the panel', () => {
    state.stats = undefined
    render(<Panel onEditStore={() => {}} />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('Mundo Kawaii')).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: 'Live de TikTok' })).toBeNull()
  })

  // S15: the five metrics stay in the dashboard contract and are no longer painted.
  it('renders no KPI row, even with metrics in the contract', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    for (const label of ['Lives activos', 'Leads nuevos', 'Pendientes', 'Conversión', 'Ventas estimadas']) {
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.queryByText('Sin datos todavía')).toBeNull()
    expect(screen.queryByText('0 %')).toBeNull()
    expect(screen.queryByText('42 %')).toBeNull()
    // The query result is still the contract the panel reads; only its rendering is gone.
    expect(state.stats?.metrics.activeLives).toBe(3)
    expect(screen.getByRole('heading', { level: 2, name: 'Live de TikTok' })).toBeTruthy()
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
    expect(describedText(cta)).toContain('La conexión de lives llega en la próxima etapa.')
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

  // The six-state chip list left the column on the human's request; the state stays
  // readable in the top bar badge, which is the only place it is announced now.
  it('drops the six-state legend and keeps the connection state in the top bar', () => {
    state.stats = { ...stats, liveConnection: 'connected' }
    render(<Panel onEditStore={() => {}} />)

    expect(screen.queryByRole('list', { name: 'Estados del live' })).toBeNull()
    for (const state of ['connected', 'reconnecting', 'offline', 'suspended-risk', 'disconnected', 'ended']) {
      expect(screen.queryByText(state)).toBeNull()
    }
    expect(screen.getByText('Conectado')).toBeTruthy()
    // The ingestor line and its note stay, which is what the column still owes the operator.
    expect(screen.getByText(/Ingestor:/)).toBeTruthy()
    expect(screen.getByText(/El login visual no autentica al ingestor/)).toBeTruthy()
  })
})

describe('panel — the channel field', () => {
  it('labels the handle field, keeps the arroba out of the input and shows it as an adornment', () => {
    renderWithSurface()

    expect(channelInput().value).toBe('')
    expect(channelInput().getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('@').getAttribute('aria-hidden')).toBe('true')
  })

  it('disables the open button while the field is empty and says what is missing', () => {
    renderWithSurface()

    const button = openLiveButton()
    expect(button.disabled).toBe(true)
    expect(describedText(button)).toContain('Escribí el handle')
  })

  it('disables the open button while the handle is invalid and states the rule', () => {
    renderWithSurface()

    for (const invalid of ['a', 'a'.repeat(25), '@mundokawaii', 'mundo kawaii', 'mundo-kawaii']) {
      typeChannel(invalid)
      expect(openLiveButton().disabled).toBe(true)
      expect(describedText(openLiveButton())).toContain('entre 2 y 24 caracteres')
    }
  })

  it('enables the open button for a valid handle and sends only the handle to main', async () => {
    const bridge = renderWithSurface()

    typeChannel('  mundokawaii  ')
    expect(openLiveButton().disabled).toBe(false)
    fireEvent.click(openLiveButton())
    await act(async () => {})

    expect(bridge.api.mount).toHaveBeenCalledWith('mundokawaii')
  })

  it('keeps the last handle typed while the panel stays mounted', async () => {
    const bridge = renderWithSurface()

    typeChannel('mundokawaii')
    fireEvent.click(openLiveButton())
    await act(async () => {})
    act(() => bridge.emit({ mounted: true, state: 'ready' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor' }))
    await act(async () => {})

    expect(channelInput().value).toBe('mundokawaii')
    expect(openLiveButton().disabled).toBe(false)
  })
})

// The live surface is a rectangle the main process fills with third-party content. These
// assertions are about the renderer's only two jobs: ask for it, and say what is happening
// without pretending the content is part of this document.
describe('panel — the live surface', () => {
  async function orderLive() {
    typeChannel('mundokawaii')
    fireEvent.click(openLiveButton())
    await act(async () => {})
  }

  it('offers the live only where the native surface exists', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    const cta = screen.getByRole('button', { name: 'Conectá tu primer live' }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Abrir el live' })).toBeNull()
  })

  it('asks main to mount, after reporting where the rectangle sits', async () => {
    const bridge = renderWithSurface()

    await orderLive()

    expect(bridge.api.mount).toHaveBeenCalledOnce()
    expect(bridge.api.setBounds).toHaveBeenCalled()
    // Position before the guest exists, or the first paint lands at the window origin.
    expect(bridge.calls.indexOf('bounds')).toBeLessThan(bridge.calls.indexOf('mount'))
  })

  // S16: `ready` is what the document reaching `dom-ready` publishes, so the caption must
  // end there and not wait for a second event that may never arrive.
  it('ends the loading caption as soon as the document is ready', async () => {
    const bridge = renderWithSurface()

    await orderLive()
    expect(await screen.findByText('Cargando TikTok…')).toBeTruthy()

    act(() => bridge.emit({ mounted: true, state: 'ready' }))

    expect(screen.queryByText('Cargando TikTok…')).toBeNull()
    expect(screen.queryByText('Ningún live conectado')).toBeNull()
  })

  it('names a failed load instead of showing an empty rectangle', async () => {
    const bridge = renderWithSurface()

    await orderLive()
    act(() => bridge.emit({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' }))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('NAME_NOT_RESOLVED')
    expect(screen.getByRole('region', { name: 'Superficie del live de TikTok' })).toBeTruthy()
    // A failure is not an empty column: the empty state would contradict the alert.
    expect(screen.queryByText('Ningún live conectado')).toBeNull()
  })

  it('names a channel main refused, instead of leaving the rectangle loading', async () => {
    renderWithSurface(true)

    typeChannel('mundokawaii')
    fireEvent.click(openLiveButton())
    await act(async () => {})

    expect(screen.getByRole('alert').textContent).toContain('rechazo del proceso principal')
    expect(screen.queryByText('Cargando TikTok…')).toBeNull()
  })

  // The copy says "reintentá"; without a control that sentence asks for something the
  // operator cannot do. The retry releases the failed guest and mounts a fresh one.
  it('offers a retry that recreates the surface after a failure', async () => {
    const bridge = renderWithSurface()

    await orderLive()
    act(() => bridge.emit({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await act(async () => {})

    expect(bridge.calls.filter(call => call !== 'bounds')).toEqual(['mount', 'unmount', 'mount'])
    // The retry asks for the channel that failed, not for whatever the field holds now.
    expect(bridge.api.mount).toHaveBeenLastCalledWith('mundokawaii')
    // The retry re-attaches, so the explicit close is still there afterwards.
    expect(screen.getByRole('button', { name: 'Cerrar visor' })).toBeTruthy()
  })

  it('states the empty column only before the operator asks for the live', async () => {
    renderWithSurface()

    expect(screen.getByText('Ningún live conectado')).toBeTruthy()

    await orderLive()

    expect(screen.getByText('Cargando TikTok…')).toBeTruthy()
    expect(screen.queryByText('Ningún live conectado')).toBeNull()
  })

  it('announces loading through exactly one status element', async () => {
    renderWithSurface()

    await orderLive()

    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(1)
    expect(statuses[0].textContent).toContain('Cargando TikTok…')
    // The spinner is decoration next to the sentence, not a second announcement.
    expect(statuses[0].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  // S13: jsdom has no layout, so the composition is the artifact: the viewer claims the
  // rest of the column and keeps a floor, so no resize can leave it with zero height.
  it('leaves the viewer the remaining height of the column, without an inner scroll', async () => {
    renderWithSurface()

    const viewer = screen.getByRole('region', { name: 'Superficie del live de TikTok' })
    const classes = viewer.className.split(/\s+/)
    expect(classes).toContain('flex-1')
    expect(classes).toContain('min-h-40')
    expect(classes).not.toContain('overflow-auto')

    const body = viewer.parentElement as HTMLElement
    const bodyClasses = body.className.split(/\s+/)
    expect(bodyClasses).toContain('flex-col')
    expect(bodyClasses).toContain('min-h-0')
    expect(bodyClasses).not.toContain('overflow-auto')
  })

  // Client-side routing swaps the panel out without reloading the document, so nothing
  // else would ever detach the guest: it would keep playing and swallowing pointer events
  // over the next screen at its old rectangle, with no visible control to close it.
  it('releases the surface when the panel unmounts', async () => {
    const bridge = renderWithSurface()

    await orderLive()
    act(() => bridge.emit({ mounted: true, state: 'ready' }))

    bridge.view.unmount()
    await act(async () => {})

    expect(bridge.api.unmount).toHaveBeenCalledOnce()
  })

  it('closes the surface when the operator asks', async () => {
    const bridge = renderWithSurface()

    await orderLive()
    act(() => bridge.emit({ mounted: true, state: 'ready' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor' }))
    await act(async () => {})

    expect(bridge.api.unmount).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Abrir el live' })).toBeTruthy()
  })
})

// S14: the operator decides how much each column weighs. The separators are the only
// controls for that, so their ARIA contract and their keyboard steps are the behaviour.
describe('panel — the draggable distribution', () => {
  function separator(label: string): HTMLElement {
    return screen.getByRole('separator', { name: label })
  }

  function value(element: HTMLElement): number {
    return Number(element.getAttribute('aria-valuenow'))
  }

  it('renders two vertical separators between the three columns', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(2)
    for (const element of separators) {
      expect(element.getAttribute('aria-orientation')).toBe('vertical')
      expect(element.getAttribute('tabindex')).toBe('0')
      expect(value(element)).toBeGreaterThan(0)
      expect(Number(element.getAttribute('aria-valuemin'))).toBeGreaterThan(0)
      expect(Number(element.getAttribute('aria-valuemax'))).toBeGreaterThan(value(element))
      expect(element.getAttribute('aria-valuetext')).toBe(`${value(element)} píxeles`)
    }
    expect(separators.map(element => element.getAttribute('aria-label'))).toEqual([
      'Ancho de la columna Live de TikTok',
      'Ancho de la columna Productos',
    ])
  })

  it('moves 16 px with the arrow keys and 48 px with Shift', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)
    const live = separator('Ancho de la columna Live de TikTok')
    const before = value(live)

    fireEvent.keyDown(live, { key: 'ArrowRight' })
    expect(value(live)).toBe(before + 16)

    fireEvent.keyDown(live, { key: 'ArrowRight', shiftKey: true })
    expect(value(live)).toBe(before + 64)

    fireEvent.keyDown(live, { key: 'ArrowLeft' })
    expect(value(live)).toBe(before + 48)
  })

  it('redistributes the pair, so one column only gives what the next one takes', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)
    const live = separator('Ancho de la columna Live de TikTok')
    const products = separator('Ancho de la columna Productos')
    const beforeLive = value(live)
    const beforeProducts = value(products)

    fireEvent.keyDown(live, { key: 'ArrowRight' })

    expect(value(live)).toBe(beforeLive + 16)
    expect(value(products)).toBe(beforeProducts - 16)
  })

  it('clamps every separator at its minimum width', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    for (const [label, min] of [
      ['Ancho de la columna Live de TikTok', 340],
      ['Ancho de la columna Productos', 240],
    ] as const) {
      const element = separator(label)
      expect(Number(element.getAttribute('aria-valuemin'))).toBe(min)
      for (let press = 0; press < 40; press += 1) fireEvent.keyDown(element, { key: 'ArrowLeft' })
      expect(value(element)).toBe(min)
    }
  })

  it('clamps at the ceiling it announces, so ARIA never promises more than the drag gives', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)
    const live = separator('Ancho de la columna Live de TikTok')

    for (let press = 0; press < 60; press += 1) fireEvent.keyDown(live, { key: 'ArrowRight' })

    expect(value(live)).toBe(Number(live.getAttribute('aria-valuemax')))
  })

  it('follows a drag with the pointer', () => {
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)
    const live = separator('Ancho de la columna Live de TikTok')
    const before = value(live)

    fireEvent(live, new MouseEvent('pointerdown', { clientX: 500, bubbles: true }))
    fireEvent(live, new MouseEvent('pointermove', { clientX: 540, bubbles: true }))
    fireEvent(live, new MouseEvent('pointerup', { clientX: 540, bubbles: true }))
    expect(value(live)).toBe(before + 40)

    // A move after the pointer is released must not keep resizing.
    fireEvent(live, new MouseEvent('pointermove', { clientX: 600, bubbles: true }))
    expect(value(live)).toBe(before + 40)
  })

  // The artboard's breakpoint: one column, and the separators have nothing to separate.
  it('stacks the columns and drops the separators below the narrow breakpoint', () => {
    stubMatchMedia(true)
    state.stats = stats
    render(<Panel onEditStore={() => {}} />)

    expect(screen.queryAllByRole('separator')).toHaveLength(0)
    const workspace = document.querySelector('[data-slot="workspace"]') as HTMLElement
    expect(workspace.className.split(/\s+/)).toContain('grid-cols-1')
    for (const heading of ['Live de TikTok', 'Productos', 'Leads']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy()
    }
  })
})

// jsdom has no layout, so the measured width is forced on the grid and a `resize` event runs
// the same code path the window resize does. The invariants below are the ones the split
// promises the operator, and every one of them was broken by a fit that clamped to 1 px
// instead of to each column's minimum.
describe('panel — the split keeps its own numbers', () => {
  function stubLayout(width: number) {
    stubMatchMedia(false)
    const bridge = renderWithSurface()
    const workspace = document.querySelector('[data-slot="workspace"]') as HTMLElement
    let measured = width
    Object.defineProperty(workspace, 'clientWidth', { configurable: true, get: () => measured })
    function measure(next = measured) {
      measured = next
      act(() => { window.dispatchEvent(new Event('resize')) })
    }
    measure()
    return { ...bridge, workspace, measure }
  }

  // The template is the artifact: three tracks and the two rails between them. The third
  // column is the remainder, so a wrong fit shows up as a wrong remainder instead of
  // disappearing off the end of the row.
  function tracks(workspace: HTMLElement, measured: number): [number, number, number] {
    const parts = workspace.style.gridTemplateColumns.split(/\s+/)
    expect(parts).toHaveLength(6)
    expect(parts.slice(4)).toEqual(['minmax(0,', '1fr)'])
    const [live, railOne, products, railTwo] = parts.slice(0, 4).map(part => Number.parseFloat(part))
    expect(railOne).toBe(10)
    expect(railTwo).toBe(10)
    return [live, products, measured - live - products - 20]
  }

  function rail(element: HTMLElement, name: 'aria-valuemin' | 'aria-valuemax' | 'aria-valuenow'): number {
    return Number(element.getAttribute(name))
  }

  it('keeps every column at its minimum and every rail inside its own range after a resize', () => {
    const { workspace } = stubLayout(932)

    const [live, products, leads] = tracks(workspace, 932)
    expect(live).toBeGreaterThanOrEqual(340)
    expect(products).toBeGreaterThanOrEqual(240)
    expect(leads).toBeGreaterThanOrEqual(260)
    // The measured width is spent exactly: no gap and no horizontal overflow.
    expect(live + products + leads + 20).toBe(932)

    const [first, second] = screen.getAllByRole('separator')
    for (const element of [first, second]) {
      expect(rail(element, 'aria-valuenow')).toBeGreaterThanOrEqual(rail(element, 'aria-valuemin'))
      expect(rail(element, 'aria-valuenow')).toBeLessThanOrEqual(rail(element, 'aria-valuemax'))
    }
    // Each rail reports the column it splits, and its ceiling is what the next column can
    // give up: what the drag and the keys actually deliver.
    expect(rail(first, 'aria-valuenow')).toBe(live)
    expect(rail(second, 'aria-valuenow')).toBe(products)
    expect(rail(first, 'aria-valuemax')).toBe(live + products - 240)
    expect(rail(second, 'aria-valuemax')).toBe(products + leads - 260)
  })

  it('delivers the step the arrows announce, and stops exactly on the bound', () => {
    stubLayout(932)
    const [live, second] = screen.getAllByRole('separator')
    const min = rail(live, 'aria-valuemin')
    const max = rail(live, 'aria-valuemax')

    // An arrow right never shrinks a column, not even one step away from the ceiling: the
    // step used to be spent pulling a value that had drifted past its own maximum back in.
    const startedAt = rail(live, 'aria-valuenow')
    fireEvent.keyDown(live, { key: 'ArrowRight' })
    expect(rail(live, 'aria-valuenow')).toBeGreaterThanOrEqual(startedAt)
    expect(rail(live, 'aria-valuenow')).toBe(Math.min(startedAt + 16, max))

    // `Shift` moves a whole 48 px of the pair it splits, not the 19 px the ceiling allowed.
    const secondStart = rail(second, 'aria-valuenow')
    fireEvent.keyDown(second, { key: 'ArrowRight', shiftKey: true })
    expect(rail(second, 'aria-valuenow')).toBe(Math.min(secondStart + 48, rail(second, 'aria-valuemax')))
    expect(rail(second, 'aria-valuenow')).toBeGreaterThan(secondStart)
    expect(rail(second, 'aria-valuenow')).toBeGreaterThanOrEqual(rail(second, 'aria-valuemin'))
  })

  it('delivers a full step from the floor, and stops exactly on the ceiling', () => {
    stubLayout(932)
    const [live] = screen.getAllByRole('separator')
    const min = rail(live, 'aria-valuemin')

    for (let press = 0; press < 10; press += 1) fireEvent.keyDown(live, { key: 'ArrowLeft' })
    expect(rail(live, 'aria-valuenow')).toBe(min)

    // A whole step, not a residue of a value that had drifted out of range.
    fireEvent.keyDown(live, { key: 'ArrowRight' })
    expect(rail(live, 'aria-valuenow')).toBe(min + 16)
    fireEvent.keyDown(live, { key: 'ArrowLeft', shiftKey: true })
    expect(rail(live, 'aria-valuenow')).toBe(min)
    fireEvent.keyDown(live, { key: 'ArrowRight', shiftKey: true })
    expect(rail(live, 'aria-valuenow')).toBe(min + 48)

    // From there the ceiling is the only thing left: the bound is reached, never passed.
    fireEvent.keyDown(live, { key: 'ArrowRight' })
    expect(rail(live, 'aria-valuenow')).toBe(Math.min(min + 64, rail(live, 'aria-valuemax')))
    expect(rail(live, 'aria-valuenow')).toBeLessThanOrEqual(rail(live, 'aria-valuemax'))
  })

  // Below the width where all three minimums fit there is no honest split: the tracks would
  // have to break a minimum or overflow the row. The workspace stacks there instead, and
  // the split comes back as soon as the measured width can hold all three again.
  it('stacks instead of breaking its minimums when the measured width cannot hold all three', () => {
    const { workspace, measure } = stubLayout(800)

    expect(screen.queryAllByRole('separator')).toHaveLength(0)
    expect(workspace.className.split(/\s+/)).toContain('grid-cols-1')

    measure(1400)

    const [live, products, leads] = tracks(workspace, 1400)
    expect(live).toBeGreaterThanOrEqual(340)
    expect(products).toBeGreaterThanOrEqual(240)
    expect(leads).toBeGreaterThanOrEqual(260)
    expect(live + products + leads + 20).toBe(1400)
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })

  // The resize event fires far more often than the layout actually changes, and the fit is
  // applied to the widths it produced last time. Re-measuring the same width must not walk
  // the columns down towards their minimums.
  it('is idempotent across repeated measurements of the same width', () => {
    const { workspace, measure } = stubLayout(1400)
    const first = tracks(workspace, 1400)

    measure()
    measure()

    expect(tracks(workspace, 1400)).toEqual(first)
  })
})