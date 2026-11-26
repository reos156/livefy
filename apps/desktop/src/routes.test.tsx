import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { readFileSync } from 'node:fs'
vi.mock('./platform/auth', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  isNativePlatform: () => true,
  AuthUi: () => <p>Official Clerk launchers</p>,
}))
const state = vi.hoisted(() => ({ isLoading: false, isAuthenticated: false, isRefreshing: false }))
const authHook = vi.hoisted(() => vi.fn())
const listeners = vi.hoisted(() => new Set<() => void>())
// What the backend answers, per query the renderer subscribes to. The stored shop stays
// `null` by default, which keeps an unconfigured operator on the wizard.
const data = vi.hoisted(() => ({
  shop: null as unknown,
  stats: undefined as unknown,
  categories: [] as unknown,
  paymentMethods: [] as unknown,
  dialCodes: [] as unknown,
  mutation: vi.fn(async () => null),
}))
vi.mock('convex/react', async () => {
  const { useReducer, useEffect } = await import('react')
  // The renderer subscribes with real function references; the name inside one is the only
  // stable key a mock can read without importing the module under test.
  const referenced = (ref: object) => {
    const [symbol] = Object.getOwnPropertySymbols(ref)
    return (ref as Record<symbol, string>)[symbol]
  }
  const answers: Record<string, () => unknown> = {
    'shops:current': () => data.shop,
    'dashboard:getDashboardStats': () => data.stats,
    'catalog:categories': () => data.categories,
    'catalog:paymentMethods': () => data.paymentMethods,
    'catalog:dialCodes': () => data.dialCodes,
  }
  return { useConvexAuth: () => {
    authHook()
    const [, update] = useReducer(value => value + 1, 0)
    useEffect(() => { listeners.add(update); return () => { listeners.delete(update) } }, [])
    return state
  },
  useQuery: (ref: object) => answers[referenced(ref)]?.(),
  useMutation: () => data.mutation }
})
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
import { AuthConfiguration } from './lib/auth'
import { createAppRouter } from './routes'
import type { CatalogCategory, CatalogDialCode, CatalogPaymentMethod, DashboardStats, ShopView } from './lib/shop-api'
afterEach(() => {
  cleanup(); vi.clearAllMocks(); vi.restoreAllMocks()
  Object.assign(state, { isLoading: false, isAuthenticated: false, isRefreshing: false })
  Object.assign(data, { shop: null, stats: undefined, categories: [], paymentMethods: [], dialCodes: [] })
})
it('bootstraps memory navigation independently of Clerk hash and reloads publicly', async () => {
  const source = readFileSync('src/main.tsx', 'utf8')
  expect(source).toContain("createMemoryHistory({ initialEntries: ['/'] })")
  expect(source).not.toContain('createHashHistory')
  const hash = window.location.hash
  window.location.hash = '#/sign-in/reset-password'
  const history = createMemoryHistory({ initialEntries: ['/'] })
  history.push('/app')
  expect(window.location.hash).toBe('#/sign-in/reset-password')
  history.back()
  expect(history.location.pathname).toBe('/')
  expect(createMemoryHistory({ initialEntries: ['/'] }).location.pathname).toBe('/')
  window.location.hash = hash
})
function setup(path: string, configured = true) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const view = render(<AuthConfiguration configured={configured}><RouterProvider router={router} /></AuthConfiguration>)
  return { router, ...view }
}
it('rejects anonymous direct navigation and provides a public return', async () => {
  const { router } = setup('/app')
  const required = await screen.findByText('Authentication required')
  // A real refusal stays fully visible; only transient waits are announced-only.
  expect(required.closest('.sr-only')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Configurá tu tienda' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Return to access' }))
  expect(await screen.findByRole('heading', { name: 'Livefy' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/')
})
it.each(['loading', 'refresh', 'unavailable'] as const)('blocks composed private route when %s', async mode => {
  Object.assign(state, { isAuthenticated: true, isLoading: mode === 'loading', isRefreshing: mode === 'refresh' })
  setup('/app', mode !== 'unavailable')
  const status = await screen.findByRole('status')
  if (mode === 'unavailable') {
    expect(await screen.findByText('Authentication unavailable')).toBeTruthy()
    expect(status.closest('.sr-only')).toBeNull()
    // A refusal is explained in text; it is not a silent wait.
    expect(screen.queryByTitle('Loading...')).toBeNull()
    // A refusal keeps the shell, the brand mark and the title.
    expect(await screen.findByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
    expect(screen.getByText('L').getAttribute('aria-hidden')).toBe('true')
  } else {
    expect(status.textContent).toBe('Checking backend access')
    expect(status.classList.contains('sr-only')).toBe(true)
    // The wait paints the ring alone: no title, no brand mark, no card around it.
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByText('L')).toBeNull()
    expect(screen.getByRole('main').querySelector('[data-slot="card"]')).toBeNull()
    expect(screen.getByRole('main').classList.contains('visual-shell')).toBe(true)
    // The sr-only status stays the only live region.
    expect(screen.getByTitle('Loading...').closest('svg')).not.toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  }
  expect(screen.queryByRole('heading', { name: 'Configurá tu tienda' })).toBeNull()
  if (mode === 'unavailable') expect(authHook).not.toHaveBeenCalled()
})
it('enters the app by itself on a confirmed session and removes private content on auth loss', async () => {
  state.isAuthenticated = true
  const { router } = setup('/')
  // No click and no intermediate screen: the confirmed session lands on the private app.
  expect(await screen.findByRole('heading', { name: 'Configurá tu tienda' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app')
  // The way out lives inside the app now that the landing offers nothing.
  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy()
  act(() => {
    state.isAuthenticated = false
    listeners.forEach(update => update())
  })
  expect(await screen.findByText('Authentication required')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Configurá tu tienda' })).toBeNull()
})
it('does not enter before backend confirmation', async () => {
  const { router } = setup('/')
  expect(await screen.findByText('Official Clerk launchers')).toBeTruthy()
  expect(router.state.location.pathname).toBe('/')
})

// An operator with a stored shop: the panel opens, the wizard only opens when asked for.
const storedShop: ShopView = {
  shopId: 'shop_1',
  name: 'Mundo Kawaii',
  description: 'Accesorios y papelería',
  categorySlugs: ['accesorios'],
  paymentMethodSlugs: ['nequi'],
  paymentData: [{ slug: 'nequi', value: '3005089676' }],
  whatsapp: { dialCode: '+57', number: '3001234567' },
  tiktokBotHandle: null,
  whatsappBotNumber: null,
}
const categories: CatalogCategory[] = [{ slug: 'accesorios', label: 'Accesorios' }]
const paymentMethods: CatalogPaymentMethod[] = [{
  slug: 'nequi',
  label: 'Nequi',
  description: 'Billetera · te llega al celular o por QR',
  dataKind: 'phone',
  dataLabel: 'Tu Nequi',
  dataHint: 'El número con el que recibís los pagos.',
}]
const dialCodes: CatalogDialCode[] = [{ iso2: 'CO', label: 'Colombia', dial: '+57' }]
const dashboardStats: DashboardStats = {
  shopId: 'shop_1',
  shopName: 'Mundo Kawaii',
  liveConnection: null,
  metrics: { activeLives: 0, newLeads: 0, pendingLeads: 0, conversionRate: 0, estimatedSales: 0 },
  lives: [],
}
function withStoredShop() {
  state.isAuthenticated = true
  Object.assign(data, { shop: storedShop, stats: dashboardStats, categories, paymentMethods, dialCodes })
}

it('opens the store form from the panel and returns to it when the edit is saved', async () => {
  withStoredShop()
  const { router } = setup('/app')

  fireEvent.click(await screen.findByRole('button', { name: 'Editar tienda' }))

  expect(await screen.findByRole('heading', { name: 'Configurá tu tienda' })).toBeTruthy()
  // The form owns a path of its own, and it opens prefilled with the stored shop.
  expect(router.state.location.pathname).toBe('/app/store')
  expect((screen.getByLabelText('Nombre de la tienda') as HTMLInputElement).value).toBe('Mundo Kawaii')
  expect(screen.queryByRole('heading', { level: 1, name: 'Panel' })).toBeNull()
  // The way out of the session stays reachable from the form itself.
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('Paso 2 de 3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('Paso 3 de 3')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

  // Finishing the edit lands on the panel again, at its own path.
  expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app')
  expect(data.mutation).toHaveBeenCalledTimes(1)

  // The sidebar entry reaches the same surface.
  fireEvent.click(screen.getByRole('button', { name: 'Tienda' }))
  expect(await screen.findByText('Paso 1 de 3')).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app/store')

  // Leaving the form without saving also returns to the panel.
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app')
  expect(data.mutation).toHaveBeenCalledTimes(1)
})

// The human sees the edit bounce back to the panel on the way from step 2 to step 3, with
// nothing clicked but `Continuar`. This drives the real router through that exact move so a
// bounce inside the routed surface fails here instead of only in Electron.
it('keeps the store form on step 3 when the operator advances from step 2', async () => {
  withStoredShop()
  const { router } = setup('/app')

  fireEvent.click(await screen.findByRole('button', { name: 'Editar tienda' }))
  expect(await screen.findByText('Paso 1 de 3')).toBeTruthy()
  expect(router.state.location.href).toBe('/app/store?paso=1')

  // Step 1 is prefilled with the stored shop, so the gating is already satisfied.
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('Paso 2 de 3')).toBeTruthy()
  expect(router.state.location.href).toBe('/app/store?paso=2')
  // The stored datum answers step 2's gating, so the third step is one click away.
  expect((screen.getByLabelText('Tu Nequi') as HTMLInputElement).value).toBe('3005089676')

  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('Paso 3 de 3')).toBeTruthy()

  // Still the form, on its own path and its third step; the panel did not take over.
  expect(screen.getByLabelText('Número de WhatsApp')).toBeTruthy()
  expect(screen.queryByRole('heading', { level: 1, name: 'Panel' })).toBeNull()
  expect(router.state.location.href).toBe('/app/store?paso=3')
  // Advancing never saves: the save is what returns the operator to the panel.
  expect(data.mutation).not.toHaveBeenCalled()
})

it('keeps the store form and its step through a transient backend refresh', async () => {
  withStoredShop()
  const { router } = setup('/app')

  fireEvent.click(await screen.findByRole('button', { name: 'Editar tienda' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('Paso 2 de 3')).toBeTruthy()
  // Changing step never saves: whatever the form loses now was lost to a remount.
  expect(data.mutation).not.toHaveBeenCalled()

  act(() => {
    state.isRefreshing = true
    listeners.forEach(update => update())
  })
  expect(screen.getByRole('status').textContent).toBe('Checking backend access')

  act(() => {
    state.isRefreshing = false
    listeners.forEach(update => update())
  })

  // Nothing was saved, so whatever the form lost, it lost to the remount.
  expect(data.mutation).not.toHaveBeenCalled()
  // The refresh is transient: the surface and the step it was on survive it.
  expect(screen.queryByRole('heading', { level: 1, name: 'Panel' })).toBeNull()
  expect(await screen.findByText('Paso 2 de 3')).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app/store')
  expect(data.mutation).not.toHaveBeenCalled()
})
