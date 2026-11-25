// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from './schema'

const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const current = makeFunctionReference<'query'>('shops:current')
const completeWizard = makeFunctionReference<'mutation'>('shops:completeWizard')

const ISSUER = 'https://fixture.clerk.accounts.dev'
const operator = (subject: string) => ({ issuer: ISSUER, subject, tokenIdentifier: `${ISSUER}|${subject}` })
const first = operator('user_first')
const second = operator('user_second')

const wizardInput = {
  name: 'Tienda Uno',
  description: 'Ropa urbana',
  categories: ['ropa'],
  paymentMethods: ['transferencia'],
}

describe('shops.completeWizard — identity-owned shop creation', () => {
  it('rejects anonymous callers on both functions', async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(current, {})).rejects.toThrow('Unauthorized')
    await expect(t.mutation(completeWizard, wizardInput)).rejects.toThrow('Unauthorized')
  })

  it('creates one shop owned by the authenticated identity and returns the public view', async () => {
    const t = convexTest(schema, modules)
    const shop = await t.withIdentity(first).mutation(completeWizard, wizardInput)

    expect(shop).toMatchObject({
      name: 'Tienda Uno',
      description: 'Ropa urbana',
      categories: ['ropa'],
      paymentMethods: ['transferencia'],
      personalWhatsapp: null,
      tiktokBotHandle: null,
      whatsappBotNumber: null,
    })
    expect(typeof shop.shopId).toBe('string')
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerId).toBe(first.tokenIdentifier)
  })

  it('trims every operator-supplied value before storing it', async () => {
    const t = convexTest(schema, modules)
    const shop = await t.withIdentity(first).mutation(completeWizard, {
      name: '  Tienda Uno  ',
      description: '  Ropa urbana  ',
      categories: ['  ropa  ', ' calzado '],
      paymentMethods: [' transferencia '],
      personalWhatsapp: '  +54 11 5555-0000  ',
    })

    expect(shop.name).toBe('Tienda Uno')
    expect(shop.description).toBe('Ropa urbana')
    expect(shop.categories).toEqual(['ropa', 'calzado'])
    expect(shop.paymentMethods).toEqual(['transferencia'])
    expect(shop.personalWhatsapp).toBe('+54 11 5555-0000')
  })

  it('refuses a client-supplied shop or owner identity', async () => {
    const t = convexTest(schema, modules)
    const caller = t.withIdentity(first)
    const created = await caller.mutation(completeWizard, wizardInput)

    await expect(caller.mutation(completeWizard, { ...wizardInput, shopId: created.shopId })).rejects.toThrow()
    await expect(caller.mutation(completeWizard, { ...wizardInput, ownerId: second.tokenIdentifier })).rejects.toThrow()
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerId).toBe(first.tokenIdentifier)
  })

  it.each([
    ['name', { ...wizardInput, name: '   ' }],
    ['description', { ...wizardInput, description: '' }],
    ['categories', { ...wizardInput, categories: [] }],
    ['categories', { ...wizardInput, categories: ['ropa', '  '] }],
    ['paymentMethods', { ...wizardInput, paymentMethods: [] }],
  ])('rejects an invalid %s and leaves the stored shop unchanged', async (_field, invalid) => {
    const t = convexTest(schema, modules)
    const caller = t.withIdentity(first)
    const before = await caller.mutation(completeWizard, wizardInput)

    await expect(caller.mutation(completeWizard, invalid)).rejects.toThrow()
    expect(await caller.query(current, {})).toEqual(before)
  })

  it('rejects values beyond the documented bounds', async () => {
    const t = convexTest(schema, modules)
    const caller = t.withIdentity(first)
    const long = 'x'.repeat(81)

    await expect(caller.mutation(completeWizard, { ...wizardInput, name: long })).rejects.toThrow()
    await expect(caller.mutation(completeWizard, {
      ...wizardInput,
      categories: Array.from({ length: 11 }, (_, index) => `categoria-${index}`),
    })).rejects.toThrow()
  })

  it('edits the existing shop instead of creating a second one', async () => {
    const t = convexTest(schema, modules)
    const caller = t.withIdentity(first)
    const created = await caller.mutation(completeWizard, wizardInput)
    const before = await t.run(async ctx => (await ctx.db.query('shops').collect())[0])
    // Real time must move on for `updatedAt` to prove the edit wrote the document.
    await new Promise(resolve => setTimeout(resolve, 5))
    const edited = await caller.mutation(completeWizard, {
      name: 'Tienda Dos',
      description: 'Ropa urbana y calzado',
      categories: ['ropa', 'calzado'],
      paymentMethods: ['transferencia', 'efectivo'],
    })

    expect(edited.shopId).toBe(created.shopId)
    expect(edited.name).toBe('Tienda Dos')
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows).toHaveLength(1)
    // The first completion timestamp survives the edit; only `updatedAt` moves.
    expect(rows[0].wizardCompletedAt).toBe(before.wizardCompletedAt)
    expect(rows[0].updatedAt).toBeGreaterThan(before.updatedAt)
  })

  it('clears the optional personal WhatsApp when the operator removes it', async () => {
    const t = convexTest(schema, modules)
    const caller = t.withIdentity(first)
    await caller.mutation(completeWizard, { ...wizardInput, personalWhatsapp: '+54 11 5555-0000' })
    const cleared = await caller.mutation(completeWizard, wizardInput)

    expect(cleared.personalWhatsapp).toBeNull()
  })

  it('keeps each operator isolated on its own shop', async () => {
    const t = convexTest(schema, modules)
    const firstShop = await t.withIdentity(first).mutation(completeWizard, wizardInput)
    const secondShop = await t.withIdentity(second).mutation(completeWizard, { ...wizardInput, name: 'Tienda Dos' })

    expect(secondShop.shopId).not.toBe(firstShop.shopId)
    expect((await t.withIdentity(first).query(current, {}))?.name).toBe('Tienda Uno')
    expect((await t.withIdentity(second).query(current, {}))?.name).toBe('Tienda Dos')
  })

  it('returns null for an authenticated operator without a shop', async () => {
    const t = convexTest(schema, modules)
    expect(await t.withIdentity(first).query(current, {})).toBeNull()
  })
})

describe('platform-owned bot identifiers', () => {
  it('preserves the values the platform set and never takes them from the client', async () => {
    const t = convexTest(schema, modules)
    await t.run(async ctx => {
      await ctx.db.insert('shops', {
        ownerId: first.tokenIdentifier,
        name: 'Tienda Uno',
        description: 'Ropa urbana',
        categories: ['ropa'],
        paymentMethods: ['transferencia'],
        tiktokBotHandle: '@livefy_tienda_uno',
        whatsappBotNumber: '+54 11 4000-0001',
        wizardCompletedAt: 1,
        updatedAt: 1,
      })
    })
    const caller = t.withIdentity(first)

    const shop = await caller.mutation(completeWizard, { ...wizardInput, name: 'Tienda Renombrada' })
    expect(shop.name).toBe('Tienda Renombrada')
    expect(shop.tiktokBotHandle).toBe('@livefy_tienda_uno')
    expect(shop.whatsappBotNumber).toBe('+54 11 4000-0001')

    await expect(caller.mutation(completeWizard, { ...wizardInput, tiktokBotHandle: '@atacante' })).rejects.toThrow()
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows[0].tiktokBotHandle).toBe('@livefy_tienda_uno')
  })
})
