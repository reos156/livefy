import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ShopWizard } from './shop-wizard'
import type { ShopView } from './lib/shop-api'

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

afterEach(cleanup)

describe('shop wizard — required fields', () => {
  it('asks for a name, a description, one category and one payment method', async () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(screen.getByText('Ingresá el nombre de la tienda.')).toBeTruthy()
    expect(screen.getByText('Ingresá una descripción.')).toBeTruthy()
    expect(screen.getByText('Agregá al menos una categoría.')).toBeTruthy()
    expect(screen.getByText('Agregá al menos un medio de pago.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('marks the invalid control for assistive technology, not only by colour', () => {
    render(<ShopWizard onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    const name = screen.getByLabelText('Nombre de la tienda')
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(name.closest('[data-slot="field"]')?.getAttribute('data-invalid')).toBe('true')
  })

  it('rejects a list item that is only whitespace', () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} initial={shop} />)

    fireEvent.change(screen.getByLabelText('Categoría 1'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(screen.getByText('Completá o quitá el ítem vacío.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('shop wizard — list editing', () => {
  it('adds and removes a category, removing only the chosen one', () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} initial={shop} />)

    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }))
    expect(screen.getByLabelText('Categoría 2')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Categoría 2'), { target: { value: 'calzado' } })

    fireEvent.click(screen.getByRole('button', { name: 'Quitar categoría 1' }))
    expect(screen.queryByLabelText('Categoría 2')).toBeNull()
    expect((screen.getByLabelText('Categoría 1') as HTMLInputElement).value).toBe('calzado')
  })

  it('submits the edited shop with the optional personal WhatsApp left empty', () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} initial={shop} />)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tienda Uno',
      description: 'Ropa urbana',
      categories: ['ropa'],
      paymentMethods: ['transferencia'],
    })
  })

  it('includes the personal WhatsApp only when the operator typed one', () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} initial={shop} />)

    fireEvent.change(screen.getByLabelText('WhatsApp personal (opcional)'), { target: { value: '  +54 11 5555-0000  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tienda' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ personalWhatsapp: '+54 11 5555-0000' }))
  })
})

describe('shop wizard — platform-owned bot identifiers', () => {
  it('shows the identifiers the platform assigned and offers no way to edit them', () => {
    render(<ShopWizard onSubmit={vi.fn()} initial={shop} />)

    const tiktok = screen.getByText('Bot TikTok: @livefy_tienda_uno')
    const whatsapp = screen.getByText('WhatsApp bot: +54 11 4000-0001')
    expect(tiktok.closest('input')).toBeNull()
    expect(whatsapp.closest('input')).toBeNull()
    expect(screen.queryByLabelText(/bot tiktok/i)).toBeNull()
    expect(screen.queryByLabelText(/whatsapp bot/i)).toBeNull()
  })

  it('declares that the platform has not assigned them yet instead of inventing a value', () => {
    render(<ShopWizard onSubmit={vi.fn()} initial={{ ...shop, tiktokBotHandle: null, whatsappBotNumber: null }} />)

    expect(screen.getByText('Bot TikTok: pendiente de asignación')).toBeTruthy()
    expect(screen.getByText('WhatsApp bot: pendiente de asignación')).toBeTruthy()
  })
})

describe('shop wizard — footer controls', () => {
  it('does not submit the form when a footer control is clicked', () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} initial={shop} footer={<button>Sign out</button>} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('shop wizard — pending submission', () => {
  it('disables the submit control and paints the ring while the mutation runs', () => {
    const onSubmit = vi.fn()
    render(<ShopWizard onSubmit={onSubmit} initial={shop} pending />)

    const submit = screen.getByRole('button', { name: /Guardar tienda|Guardando/ })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.querySelector('[data-slot="spinner"]')).not.toBeNull()
    fireEvent.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('surfaces the submission failure the caller reports', () => {
    render(<ShopWizard onSubmit={vi.fn()} initial={shop} error="No pudimos guardar la tienda. Probá de nuevo." />)

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('No pudimos guardar la tienda. Probá de nuevo.')).toBeTruthy()
  })
})
