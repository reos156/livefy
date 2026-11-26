import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// The stored shop and the catalogues the entry screen reads. A `null` shop is a
// first-run operator, which the screen must still take to the form.
const data = vi.hoisted(() => ({
  shop: null as unknown,
  categories: [] as unknown,
  paymentMethods: [] as unknown,
  dialCodes: [] as unknown,
  mutation: vi.fn(async () => null),
}))
vi.mock('convex/react', async () => {
  // The renderer subscribes with real function references; the name inside one is the only
  // stable key a mock can read.
  const referenced = (ref: object) => {
    const [symbol] = Object.getOwnPropertySymbols(ref)
    return (ref as Record<symbol, string>)[symbol]
  }
  const answers: Record<string, () => unknown> = {
    'shops:current': () => data.shop,
    'catalog:categories': () => data.categories,
    'catalog:paymentMethods': () => data.paymentMethods,
    'catalog:dialCodes': () => data.dialCodes,
  }
  return { useQuery: (ref: object) => answers[referenced(ref)]?.(), useMutation: () => data.mutation }
})

import { AppEntry } from './app-entry'
import type { CatalogCategory, CatalogDialCode, CatalogPaymentMethod } from './lib/shop-api'

const categories: CatalogCategory[] = [{ slug: 'ropa', label: 'Ropa' }]
const paymentMethods: CatalogPaymentMethod[] = [{
  slug: 'nequi',
  label: 'Nequi',
  description: 'Billetera · te llega al celular o por QR',
  dataKind: 'phone',
  dataLabel: 'Tu Nequi',
  dataHint: 'El número con el que recibís los pagos.',
}]
const dialCodes: CatalogDialCode[] = [{ iso2: 'CO', label: 'Colombia', dial: '+57' }]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Object.assign(data, { shop: null, categories: [], paymentMethods: [], dialCodes: [] })
})

describe('app entry — first run', () => {
  it('keeps an operator without a shop on the form instead of the panel', async () => {
    Object.assign(data, { categories, paymentMethods, dialCodes })
    render(<AppEntry />)

    expect(await screen.findByRole('heading', { name: 'Configurá tu tienda' })).toBeTruthy()
    expect(screen.getByText('Paso 1 de 3')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Panel' })).toBeNull()
  })

  it('still saves the first shop through the create-or-update mutation', async () => {
    Object.assign(data, { categories, paymentMethods, dialCodes })
    render(<AppEntry />)

    await screen.findByRole('heading', { name: 'Configurá tu tienda' })
    fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Mundo Kawaii' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Accesorios y papelería' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ropa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(await screen.findByRole('button', { name: /nequi/i }))
    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '300 508 9676' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.change(await screen.findByLabelText('Número de WhatsApp'), { target: { value: '3001234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(data.mutation).toHaveBeenCalledTimes(1)
    expect(data.mutation).toHaveBeenCalledWith({
      name: 'Mundo Kawaii',
      description: 'Accesorios y papelería',
      categorySlugs: ['ropa'],
      paymentMethodSlugs: ['nequi'],
      paymentData: [{ slug: 'nequi', value: '300 508 9676' }],
      whatsapp: { dialCode: '+57', number: '3001234567' },
    })
  })
})