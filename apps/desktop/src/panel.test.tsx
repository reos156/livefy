import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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