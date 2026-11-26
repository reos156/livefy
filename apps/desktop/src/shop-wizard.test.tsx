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
  {
    slug: 'nequi',
    label: 'Nequi',
    description: 'Billetera · te llega al celular o por QR',
    dataKind: 'phone',
    dataLabel: 'Tu Nequi',
    dataHint: 'El número con el que recibís los pagos.',
  },
  {
    slug: 'llave-bre-b',
    label: 'Llave Bre-B',
    description: 'Transferencia inmediata, 24/7, entre bancos',
    dataKind: 'key',
    dataLabel: 'Tu llave Bre-B',
    dataHint: 'Celular, documento o llave alfanumérica.',
  },
  {
    slug: 'daviplata',
    label: 'Daviplata',
    description: 'Billetera · celular',
    dataKind: 'phone',
    dataLabel: 'Tu Daviplata',
    dataHint: 'El número con el que recibís los pagos.',
  },
  {
    slug: 'transferencia-ahorros',
    label: 'Transferencia a cuenta de ahorros',
    description: 'Bancolombia, Davivienda y otros',
    dataKind: 'account',
    dataLabel: 'Tu cuenta',
    dataHint: 'Banco y número de cuenta.',
  },
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
  paymentData: [{ slug: 'nequi', value: '3005089676' }],
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
    // One instruction, read once: the step lead says it and the group does not repeat it.
    expect(screen.getAllByText('Marcá los medios que aceptás y cargá el dato de cada uno. Al menos uno.')).toHaveLength(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('reveals the datum of a selected method inside its own card and not the one of an unselected method', () => {
    renderWizard()
    fillStoreStep()
    next()

    // One card per catalogue method, in a two-column grid that folds to one column
    // when the wizard is narrow.
    const cards = document.querySelectorAll('[data-slot="payment-method"]')
    expect(cards.length).toBe(paymentMethods.length)
    const grid = cards[0].parentElement
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toContain('grid-cols-2')

    choosePayment(/nequi/i)

    // The datum opens inside the card of the method it belongs to, labelled and
    // hinted by the catalogue.
    const nequi = screen.getByRole('button', { name: /nequi/i })
    expect(nequi.getAttribute('aria-pressed')).toBe('true')
    const nequiCard = nequi.closest('[data-slot="payment-method"]') as HTMLElement
    expect(nequiCard.getAttribute('data-selected')).toBe('true')
    expect(within(nequiCard).getByLabelText('Tu Nequi')).toBeTruthy()
    expect(within(nequiCard).getByText('El número con el que recibís los pagos.')).toBeTruthy()

    // An unselected method stays a closed card: no label, no field.
    expect(screen.queryByLabelText('Tu llave Bre-B')).toBeNull()
    expect(screen.queryByLabelText('Tu cuenta')).toBeNull()
    const breB = screen.getByRole('button', { name: /llave bre-b/i })
    expect(breB.getAttribute('aria-pressed')).toBe('false')
    expect(within(breB.closest('[data-slot="payment-method"]') as HTMLElement).queryByRole('textbox')).toBeNull()

    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '3005089676' } })
    next()

    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
  })

  it('blocks step 2 while a selected method has no datum', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/nequi/i)
    next()

    expect(screen.getByText('Ingresá el dato de Nequi.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  })

  it('reveals the Bre-B key and refuses to advance without it', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/llave bre-b/i)
    expect(screen.getByLabelText('Tu llave Bre-B')).toBeTruthy()
    next()

    expect(screen.getByText('Ingresá el dato de Llave Bre-B.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  })

  it('rejects a Bre-B key shorter than three characters and accepts the boundary', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/llave bre-b/i)
    fireEvent.change(screen.getByLabelText('Tu llave Bre-B'), { target: { value: 'ab' } })
    next()

    expect(screen.getByText('Revisá la llave: usá entre 3 y 40 caracteres, sin espacios.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Tu llave Bre-B'), { target: { value: 'abc' } })
    next()

    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
  })

  it('rejects a phone datum outside its digit range and accepts the boundary', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/nequi/i)
    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '123456' } })
    next()

    expect(screen.getByText('Usá entre 7 y 15 dígitos.')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '1234567' } })
    next()

    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
  })

  it('rejects an account datum outside its length and accepts the boundary', () => {
    renderWizard()
    fillStoreStep()
    next()

    choosePayment(/transferencia a cuenta de ahorros/i)
    fireEvent.change(screen.getByLabelText('Tu cuenta'), { target: { value: '1234' } })
    next()

    expect(screen.getByText('Revisá la cuenta: usá entre 5 y 60 caracteres con letras, números, espacios y ".-#".')).toBeTruthy()
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Tu cuenta'), { target: { value: '12345' } })
    next()

    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
  })
})

describe('shop wizard — step 3 · Contacto', () => {
  it('blocks saving without a valid WhatsApp number', () => {
    const onSubmit = renderWizard()
    fillStoreStep()
    next()
    choosePayment(/nequi/i)
    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '3005089676' } })
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
      paymentData: [{ slug: 'llave-bre-b', value: 'valentina.lopez' }],
      whatsapp: { dialCode: '+54', number: '1140000001' },
    })
    expect(Object.hasOwn(onSubmit.mock.calls[0][0], 'breBKey')).toBe(false)
  })

  it('sends a datum for exactly the selected methods', () => {
    const onSubmit = renderWizard()
    fillStoreStep()
    next()

    choosePayment(/nequi/i)
    choosePayment(/llave bre-b/i)
    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '300 508 9676' } })
    fireEvent.change(screen.getByLabelText('Tu llave Bre-B'), { target: { value: 'valentina.lopez' } })
    next()

    fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: '3001234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tienda Uno',
      description: 'Ropa urbana',
      categorySlugs: ['ropa'],
      paymentMethodSlugs: ['nequi', 'llave-bre-b'],
      paymentData: [
        { slug: 'nequi', value: '300 508 9676' },
        { slug: 'llave-bre-b', value: 'valentina.lopez' },
      ],
      whatsapp: { dialCode: '+57', number: '3001234567' },
    })
    expect(Object.hasOwn(onSubmit.mock.calls[0][0], 'breBKey')).toBe(false)
  })

  it('enters the step without accusing an untouched number', () => {
    renderWizard({ initial: { ...shop, whatsapp: { dialCode: '+57', number: '' } } })
    next()
    next()

    // Nothing typed yet: the step opens clean, no verdict and no invalid control.
    expect(screen.queryByText('Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.')).toBeNull()
    expect(screen.getByLabelText('Número de WhatsApp').getAttribute('aria-invalid')).toBeNull()
  })

  it('clears the verdict as soon as the operator corrects the value', () => {
    renderWizard({ initial: { ...shop, whatsapp: { dialCode: '+57', number: '' } } })
    next()
    next()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))
    expect(screen.getByText('Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.')).toBeTruthy()

    // The message describes the value that failed; a corrected number must not keep it.
    fireEvent.change(screen.getByLabelText('Número de WhatsApp'), { target: { value: '3005089676' } })
    expect(screen.queryByText('Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.')).toBeNull()
    expect(screen.getByLabelText('Número de WhatsApp').getAttribute('aria-invalid')).toBeNull()
  })

  it('no longer shows the platform-owned bot identifiers on this screen', () => {
    renderWizard({
      initial: { ...shop, tiktokBotHandle: null, whatsappBotNumber: null },
    })
    next()
    next()

    // The bot identifiers left this screen by request; the platform still owns them.
    expect(screen.queryByText(/bot tiktok/i)).toBeNull()
    expect(screen.queryByText(/pendiente de asignación/i)).toBeNull()
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
    fireEvent.change(screen.getByLabelText('Tu Nequi'), { target: { value: '3005089676' } })
    next()

    expect(screen.getByText('Paso 3 de 3')).toBeTruthy()
    expect(screen.getByText('3 · Contacto').closest('li')?.getAttribute('aria-current')).toBe('step')
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