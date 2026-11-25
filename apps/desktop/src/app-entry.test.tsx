import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { CatalogCategory, CatalogDialCode, CatalogPaymentMethod, ShopView } from './lib/shop-api'

const state = vi.hoisted(() => ({
  shop: undefined as ShopView | null | undefined,
  categories: undefined as CatalogCategory[] | undefined,
  paymentMethods: undefined as CatalogPaymentMethod[] | undefined,
  dialCodes: undefined as CatalogDialCode[] | undefined,
  submitted: [] as unknown[],
  mutationError: null as Error | null,
}))

const categories: CatalogCategory[] = [
  { slug: 'ropa', label: 'Ropa' },
  { slug: 'calzado', label: 'Calzado' },
]

const paymentMethods: CatalogPaymentMethod[] = [
  { slug: 'nequi', label: 'Nequi', description: 'Billetera · te llega al celular o por QR', requiresKey: false },
  { slug: 'llave-bre-b', label: 'Llave Bre-B', description: 'Transferencia inmediata, 24/7, entre bancos', requiresKey: true },
]

const dialCodes: CatalogDialCode[] = [
  { iso2: 'CO', label: 'Colombia', dial: '+57' },
  { iso2: 'AR', label: 'Argentina', dial: '+54' },
]

// The three catalogue queries and `shops:current` share one `useQuery`, so the mock
// answers by the reference the screen passed — the same identity the backend exposes.
vi.mock('convex/react', async () => {
  const api = await import('./lib/shop-api')
  return {
    useQuery: (ref: unknown) => {
      if (ref === api.shopFunctions.current) return state.shop
      if (ref === api.catalogFunctions.categories) return state.categories
      if (ref === api.catalogFunctions.paymentMethods) return state.paymentMethods
      if (ref === api.catalogFunctions.dialCodes) return state.dialCodes
      return undefined
    },
    useMutation: () => async (input: unknown) => {
      state.submitted.push(input)
      if (state.mutationError) throw state.mutationError
      return state.shop
    },
  }
})

import { AppEntry } from './app-entry'

const shop: ShopView = {
  shopId: 'shop_1',
  name: 'Tienda Uno',
  description: 'Ropa urbana',
  categorySlugs: ['ropa'],
  paymentMethodSlugs: ['nequi'],
  breBKey: null,
  whatsapp: { dialCode: '+57', number: '3001234567' },
  tiktokBotHandle: '@livefy_tienda_uno',
  whatsappBotNumber: '3001234567',
}

function reset() {
  Object.assign(state, {
    shop: undefined,
    categories,
    paymentMethods,
    dialCodes,
    submitted: [],
    mutationError: null,
  })
}

afterEach(() => {
  cleanup()
  reset()
})

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

function fillWizard() {
  fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Tienda Nueva' } })
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Ropa urbana' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ropa' }))
  next()
  fireEvent.click(screen.getByRole('button', { name: /nequi/i }))
  next()
  fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: '300 123-4567' } })
}

describe('app entry — which screen the operator gets', () => {
  it('waits without painting a form while the shop query is unresolved', () => {
    state.shop = undefined
    render(<AppEntry />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
  })

  it('opens the wizard when the operator has no shop yet', () => {
    state.shop = null
    render(<AppEntry />)

    expect(screen.getByText('Paso 1 de 3')).toBeTruthy()
    // The save action only exists on the last step, so step 1 cannot save anything.
    expect(screen.queryByRole('button', { name: 'Guardar tienda' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Conectá tu primer live' })).toBeNull()
  })

  it('leads a completed wizard to the exact first-live call to action', () => {
    state.shop = shop
    state.categories = categories
    state.paymentMethods = paymentMethods
    render(<AppEntry />)

    expect(screen.getByText('Tienda Uno')).toBeTruthy()
    // The stored view carries slugs; the operator reads labels and never the internals.
    expect(screen.getByText('Ropa')).toBeTruthy()
    expect(screen.getByText('Nequi')).toBeTruthy()
    expect(screen.queryByText('ropa')).toBeNull()
    expect(screen.queryByText('nequi')).toBeNull()
    expect(screen.getByRole('button', { name: 'Conectá tu primer live' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar tienda' })).toBeNull()
  })

  it('sends the assembled wizard payload through the mutation and then shows the call to action', async () => {
    state.shop = null
    const { rerender } = render(<AppEntry />)

    fillWizard()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    await Promise.resolve()

    expect(state.submitted).toHaveLength(1)
    expect(state.submitted[0]).toEqual({
      name: 'Tienda Nueva',
      description: 'Ropa urbana',
      categorySlugs: ['ropa'],
      paymentMethodSlugs: ['nequi'],
      whatsapp: { dialCode: '+57', number: '3001234567' },
    })

    state.shop = { ...shop, name: 'Tienda Nueva' }
    rerender(<AppEntry />)
    expect(screen.getByRole('button', { name: 'Conectá tu primer live' })).toBeTruthy()
  })

  it('reopens the wizard from the summary prefilled with the stored shop and saves an edit', async () => {
    state.shop = shop
    const { rerender } = render(<AppEntry />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar datos de la tienda' }))

    expect((screen.getByLabelText('Nombre de la tienda') as HTMLInputElement).value).toBe('Tienda Uno')
    expect((screen.getByLabelText('Descripción') as HTMLInputElement).value).toBe('Ropa urbana')
    expect(screen.getByRole('button', { name: 'Ropa' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Tienda Renombrada' } })
    next()
    expect(screen.getByRole('button', { name: /nequi/i }).getAttribute('aria-pressed')).toBe('true')
    next()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    await Promise.resolve()

    expect(state.submitted).toHaveLength(1)
    expect(state.submitted[0]).toEqual({
      name: 'Tienda Renombrada',
      description: 'Ropa urbana',
      categorySlugs: ['ropa'],
      paymentMethodSlugs: ['nequi'],
      whatsapp: { dialCode: '+57', number: '3001234567' },
    })

    state.shop = { ...shop, name: 'Tienda Renombrada' }
    rerender(<AppEntry />)
    expect(screen.getByRole('button', { name: 'Conectá tu primer live' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar tienda' })).toBeNull()
  })

  it('reports a failed save without dropping back to a blank form', async () => {
    state.shop = null
    state.mutationError = new Error('network')
    render(<AppEntry />)

    fillWizard()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    // The failure lands after the mutation settles, not during the click handler.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('No pudimos guardar la tienda')
    // The flow keeps the step and every typed value instead of dropping back to a blank form.
    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
    expect((screen.getByLabelText('Número de WhatsApp') as HTMLInputElement).value).toBe('300 123-4567')
  })
})