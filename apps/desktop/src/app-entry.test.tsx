import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ShopView } from './lib/shop-api'

const state = vi.hoisted(() => ({
  shop: undefined as ShopView | null | undefined,
  submitted: [] as unknown[],
  mutationError: null as Error | null,
}))

vi.mock('convex/react', () => ({
  useQuery: () => state.shop,
  useMutation: () => async (input: unknown) => {
    state.submitted.push(input)
    if (state.mutationError) throw state.mutationError
    return state.shop
  },
}))

import { AppEntry } from './app-entry'

const shop: ShopView = {
  shopId: 'shop_1',
  name: 'Tienda Uno',
  description: 'Ropa urbana',
  categories: ['ropa'],
  paymentMethods: ['transferencia'],
  personalWhatsapp: null,
  tiktokBotHandle: '@livefy_tienda_uno',
  whatsappBotNumber: '+54 11 4000-0001',
}

afterEach(() => {
  cleanup()
  Object.assign(state, { shop: undefined, submitted: [], mutationError: null })
})

describe('app entry — which screen the operator gets', () => {
  it('waits without painting a form while the shop query is unresolved', () => {
    state.shop = undefined
    render(<AppEntry />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar tienda' })).toBeNull()
  })

  it('opens the wizard when the operator has no shop yet', () => {
    state.shop = null
    render(<AppEntry />)

    expect(screen.getByRole('button', { name: 'Guardar tienda' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Conectá tu primer live' })).toBeNull()
  })

  it('leads a completed wizard to the exact first-live call to action', () => {
    state.shop = shop
    render(<AppEntry />)

    expect(screen.getByText('Tienda Uno')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Conectá tu primer live' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar tienda' })).toBeNull()
  })

  it('sends the wizard values through the mutation and then shows the call to action', async () => {
    state.shop = null
    const { rerender } = render(<AppEntry />)

    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar medio de pago' }))
    fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Tienda Nueva' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Ropa urbana' } })
    fireEvent.change(screen.getByLabelText('Categoría 1'), { target: { value: 'ropa' } })
    fireEvent.change(screen.getByLabelText('Medio de pago 1'), { target: { value: 'transferencia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    await Promise.resolve()

    expect(state.submitted).toHaveLength(1)
    expect(state.submitted[0]).toMatchObject({ name: 'Tienda Nueva', categories: ['ropa'], paymentMethods: ['transferencia'] })

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
    expect((screen.getByLabelText('Categoría 1') as HTMLInputElement).value).toBe('ropa')
    expect((screen.getByLabelText('Medio de pago 1') as HTMLInputElement).value).toBe('transferencia')

    fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Tienda Renombrada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    await Promise.resolve()

    expect(state.submitted).toHaveLength(1)
    expect(state.submitted[0]).toMatchObject({
      name: 'Tienda Renombrada',
      description: 'Ropa urbana',
      categories: ['ropa'],
      paymentMethods: ['transferencia'],
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

    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar medio de pago' }))
    fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Tienda Nueva' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Ropa urbana' } })
    fireEvent.change(screen.getByLabelText('Categoría 1'), { target: { value: 'ropa' } })
    fireEvent.change(screen.getByLabelText('Medio de pago 1'), { target: { value: 'transferencia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    // The failure lands after the mutation settles, not during the click handler.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('No pudimos guardar la tienda')
    expect((screen.getByLabelText('Nombre de la tienda') as HTMLInputElement).value).toBe('Tienda Nueva')
  })
})
