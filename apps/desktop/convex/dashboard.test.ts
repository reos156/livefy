// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from './schema'

const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const getDashboardStats = makeFunctionReference<'query'>('dashboard:getDashboardStats')
const completeWizard = makeFunctionReference<'mutation'>('shops:completeWizard')
const seedCatalog = makeFunctionReference<'mutation'>('catalog:seedCatalog')

const ISSUER = 'https://fixture.clerk.accounts.dev'
const operator = (subject: string) => ({ issuer: ISSUER, subject, tokenIdentifier: `${ISSUER}|${subject}` })
const first = operator('user_first')
const second = operator('user_second')

const wizardInput = {
  name: 'Tienda Uno',
  description: 'Ropa urbana',
  categorySlugs: ['ropa-y-accesorios'],
  paymentMethodSlugs: ['transferencia-ahorros'],
  paymentData: [{ slug: 'transferencia-ahorros', value: 'Bancolombia 123-456789-00' }],
  whatsapp: { dialCode: '+57', number: '3001234567' },
}

describe('dashboard.getDashboardStats — identity-owned dashboard read', () => {
  it('rejects anonymous callers', async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(getDashboardStats, {})).rejects.toThrow('Unauthorized')
  })

  it('reports zeroed metrics and no live for a configured shop, writing nothing', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(seedCatalog, {})
    const caller = t.withIdentity(first)
    const shop = await caller.mutation(completeWizard, wizardInput)

    expect(await caller.query(getDashboardStats, {})).toEqual({
      shopId: shop.shopId,
      shopName: 'Tienda Uno',
      liveConnection: null,
      metrics: {
        activeLives: 0,
        newLeads: 0,
        pendingLeads: 0,
        conversionRate: 0,
        estimatedSales: 0,
      },
      lives: [],
    })
    expect(await t.run(async ctx => ctx.db.query('shops').collect())).toHaveLength(1)
  })

  it('reads the shop of the authenticated identity and refuses a client-supplied identifier', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(seedCatalog, {})
    const firstShop = await t.withIdentity(first).mutation(completeWizard, wizardInput)
    const secondShop = await t.withIdentity(second).mutation(completeWizard, { ...wizardInput, name: 'Tienda Dos' })
    const caller = t.withIdentity(first)

    expect(await caller.query(getDashboardStats, {})).toMatchObject({
      shopId: firstShop.shopId,
      shopName: 'Tienda Uno',
    })

    await expect(caller.query(getDashboardStats, { shopId: secondShop.shopId })).rejects.toThrow()
    await expect(caller.query(getDashboardStats, { ownerId: second.tokenIdentifier })).rejects.toThrow()
    expect(await caller.query(getDashboardStats, {})).toMatchObject({
      shopId: firstShop.shopId,
      shopName: 'Tienda Uno',
    })
  })
})