import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ShopWizard } from './shop-wizard'
import type { CatalogCategory, CatalogDialCode, CatalogPaymentMethod, ShopView } from './lib/shop-api'

const categories: CatalogCategory[] = [
  { slug: 'ropa', label: 'Ropa' },
  { slug: 'calzado', label: 'Calzado' },
  { slug: 'belleza', label: 'Belleza' },
]

const paymentMethods: CatalogPaymentMethod[] = [
  { slug: 'nequi', label: 'Nequi', description: 'Billetera · te llega al celular o por QR', requiresKey: false },
  { slug: 'llave-bre-b', label: 'Llave Bre-B', description: 'Transferencia inmediata, 24/7, entre bancos', requiresKey: true },
  { slug: 'daviplata', label: 'Daviplata', description: 'Billetera · celular', requiresKey: false },
]

const dialCodes: CatalogDialCode[] = [
  { iso2: 'CO', label: 'Colombia', dial: '+57' },
  { iso2: 'AR', label: 'Argentina', dial: '+54' },
  { iso2: 'MX', label: 'México', dial: '+52' },
]

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

afterEach(cleanup)

function renderWizard(props: Partial<Parameters<typeof ShopWizard>[0]> = {}) {
  const onSubmit = vi.fn()
  render(<ShopWizard categories={categories} paymentMethods={paymentMethods} dialCodes={dialCodes} onSubmit={onSubmit} {...props} />)
  return onSubmit
}

function fillStoreStep() {
  fireEvent.change(screen.getByLabelText('Nombre de la tienda'), { target: { value: 'Tienda Uno' } })
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Ropa urbana' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ropa' }))
}

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

function choosePayment(name: RegExp | string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('shop wizard — step 1 · Tu tienda', () => {
  it('blocks advancing until a name, a description and one category are there', () => {
    const onSubmit = renderWizard()

    next()

    expect(screen.getByText('Ingresá el nombre de la tienda.')).toBeTruthy()
    expect(screen.getByText('Ingresá una descripción.')).toBeTruthy()
    expect(screen.getByText('Elegí al menos una categoría.')).toBeTruthy()
    expect(screen.getByText('Paso 1 de 3')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('marks the invalid control for assistive technology, not only by colour', () => {
    renderWizard()

    next()

    const name = screen.getByLabelText('Nombre de la tienda')
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(name.closest('[data-slot="field"]')?.getAttribute('data-invalid')).toBe('true')
  })

  it('offers the catalogue categories as a chosen set, never as free text', () => {
    renderWizard()

    const ropa = screen.getByRole('button', { name: 'Ropa' })
    expect(ropa.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(ropa)
    expect(ropa.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('textbox', { name: /categoría 1/i })).toBeNull()
  })
})

describe('shop wizard — step 2 · Cómo te pagan', () => {
  it('blocks advancing without a payment method', () => {
    const onSubmit = renderWizard()
    fillStoreStep()
    next()

    next()

    expect(screen.getByText('Elegí al menos un medio de pago.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not ask for a Bre-B key while Bre-B is not selected', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/nequi/i)
    next()

    expect(screen.queryByLabelText('Tu llave Bre-B')).toBeNull()
    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
  })

  it('reveals the Bre-B key and refuses to advance without it', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/llave bre-b/i)
    expect(screen.getByLabelText('Tu llave Bre-B')).toBeTruthy()
    next()

    expect(screen.getByText('Ingresá tu llave Bre-B.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  })

  it('rejects a Bre-B key that is shorter than three characters', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/llave bre-b/i)
    fireEvent.change(screen.getByLabelText('Tu llave Bre-B'), { target: { value: 'ab' } })
    next()

    expect(screen.getByText('Revisá la llave: usá entre 3 y 40 caracteres, sin espacios.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  })
})

describe('shop wizard — step 3 · Contacto y bots', () => {
  it('blocks saving without a valid WhatsApp number', () => {
    const onSubmit = renderWizard()
    fillStoreStep()
    next()
    choosePayment(/nequi/i)
    next()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    expect(screen.getByText('Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(screen.getByText('Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the assembled payload with the chosen dial code', () => {
    const onSubmit = renderWizard()
    fillStoreStep()
    next()
    choosePayment(/llave bre-b/i)
    fireEvent.change(screen.getByLabelText('Tu llave Bre-B'), { target: { value: 'valentina.lopez' } })
    next()

    // Colombia is the default, so the operator only types the number…
    expect(screen.getByLabelText('Indicativo').textContent).toContain('+57')
    // …and picking another country is what the payload then carries.
    fireEvent.click(screen.getByLabelText('Indicativo'))
    const argentina = screen.getByRole('option', { name: '+54 · Argentina' })
    fireEvent.pointerDown(argentina)
    fireEvent.click(argentina)
    expect(screen.getByLabelText('Indicativo').textContent).toContain('+54')

    fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: '11 4000-0001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tienda Uno',
      description: 'Ropa urbana',
      categorySlugs: ['ropa'],
      paymentMethodSlugs: ['llave-bre-b'],
      breBKey: 'valentina.lopez',
      whatsapp: { dialCode: '+54', number: '1140000001' },
    })
  })

  it('shows the platform-owned bot identifiers as read-only, pending assignment included', () => {
    renderWizard({
      initial: { ...shop, tiktokBotHandle: null, whatsappBotNumber: null },
    })
    next()
    next()

    // One value per platform-owned identifier: TikTok's bot and the WhatsApp bot.
    expect(screen.getAllByText('pendiente de asignación')).toHaveLength(2)
    expect(screen.queryByRole('textbox', { name: /bot tiktok/i })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /whatsapp bot/i })).toBeNull()
  })
})

describe('shop wizard — progress', () => {
  it('announces the current step and moves the marker as the operator advances', () => {
    renderWizard()
    fillStoreStep()

    expect(screen.getByText('Paso 1 de 3')).toBeTruthy()
    expect(screen.getByText('1 · Tu tienda').closest('li')?.getAttribute('aria-current')).toBe('step')

    next()

    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
    expect(screen.getByText('2 · Cómo te pagan').closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(screen.getByText('1 · Tu tienda').closest('li')?.getAttribute('aria-current')).toBeNull()

    choosePayment(/nequi/i)
    next()

    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
    expect(screen.getByText('3 · Contacto y bots').closest('li')?.getAttribute('aria-current')).toBe('step')
  })
})

describe('shop wizard — pending submission', () => {
  it('disables the save control and paints the ring while the mutation runs', () => {
    const onSubmit = renderWizard({ initial: shop, pending: true })
    next()
    next()

    const submit = screen.getByRole('button', { name: /Guardar tienda|Guardando/ })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.querySelector('[data-slot="spinner"]')).not.toBeNull()
    fireEvent.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('surfaces the submission failure the caller reports', () => {
    renderWizard({ initial: shop, error: 'No pudimos guardar la tienda. Probá de nuevo.' })

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('No pudimos guardar la tienda. Probá de nuevo.')).toBeTruthy()
  })
})

describe('shop wizard — footer controls', () => {
  it('does not submit the form when a footer control is clicked', () => {
    const onSubmit = renderWizard({ initial: shop, footer: <button>Sign out</button> })
    next()
    next()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})