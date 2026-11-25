// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from './schema'

const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const current = makeFunctionReference<'query'>('shops:current')
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
  paymentMethodSlugs: ['nequi'],
  whatsapp: { dialCode: '+57', number: '3001234567' },
}

// The catalogues are data, so every case starts from a seeded database: the backend
// validates against the rows, never against a list compiled into the function.
async function seeded() {
  const t = convexTest(schema, modules)
  await t.mutation(seedCatalog, {})
  return t
}

// The code and field are the contract the screen translates into operator copy.
async function rejection(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return (error as { data?: unknown }).data
  }
  throw new Error('the backend accepted an invalid submission')
}

describe('shops.completeWizard — catalogue-backed shop configuration', () => {
  it('rejects anonymous callers on both functions', async () => {
    const t = await seeded()
    await expect(t.query(current, {})).rejects.toThrow('Unauthorized')
    await expect(t.mutation(completeWizard, wizardInput)).rejects.toThrow('Unauthorized')
  })

  it('creates one shop owned by the authenticated identity and returns the public view', async () => {
    const t = await seeded()
    const shop = await t.withIdentity(first).mutation(completeWizard, wizardInput)

    expect(shop).toMatchObject({
      name: 'Tienda Uno',
      description: 'Ropa urbana',
      categorySlugs: ['ropa-y-accesorios'],
      paymentMethodSlugs: ['nequi'],
      breBKey: null,
      whatsapp: { dialCode: '+57', number: '3001234567' },
      tiktokBotHandle: null,
      whatsappBotNumber: null,
    })
    expect(typeof shop.shopId).toBe('string')
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerId).toBe(first.tokenIdentifier)
  })

  it('trims the operator inputs and stores the WhatsApp number as digits', async () => {
    const t = await seeded()
    const shop = await t.withIdentity(first).mutation(completeWizard, {
      name: '  Tienda Uno  ',
      description: '  Ropa urbana  ',
      categorySlugs: [' ropa-y-accesorios ', 'calzado'],
      paymentMethodSlugs: [' nequi '],
      whatsapp: { dialCode: '+57', number: ' 300-123 4567 ' },
    })

    expect(shop.name).toBe('Tienda Uno')
    expect(shop.description).toBe('Ropa urbana')
    expect(shop.categorySlugs).toEqual(['ropa-y-accesorios', 'calzado'])
    expect(shop.paymentMethodSlugs).toEqual(['nequi'])
    expect(shop.whatsapp).toEqual({ dialCode: '+57', number: '3001234567' })
  })

  it('refuses a client-supplied shop or owner identity', async () => {
    const t = await seeded()
    const caller = t.withIdentity(first)
    const created = await caller.mutation(completeWizard, wizardInput)

    await expect(caller.mutation(completeWizard, { ...wizardInput, shopId: created.shopId })).rejects.toThrow()
    await expect(caller.mutation(completeWizard, { ...wizardInput, ownerId: second.tokenIdentifier })).rejects.toThrow()
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerId).toBe(first.tokenIdentifier)
  })

  it.each([
    ['an unknown category', { categorySlugs: ['ropa-y-accesorios', 'juguetes'] }, { code: 'shop-category-unknown', field: 'categorySlugs' }],
    ['no category', { categorySlugs: [] }, { code: 'shop-categories-required', field: 'categorySlugs' }],
    ['an unknown payment method', { paymentMethodSlugs: ['efectivo'] }, { code: 'shop-payment-method-unknown', field: 'paymentMethodSlugs' }],
    ['no payment method', { paymentMethodSlugs: [] }, { code: 'shop-payment-methods-required', field: 'paymentMethodSlugs' }],
    ['a missing Bre-B key', { paymentMethodSlugs: ['llave-bre-b'] }, { code: 'shop-breb-key-required', field: 'breBKey' }],
    ['a blank Bre-B key', { paymentMethodSlugs: ['llave-bre-b'], breBKey: '   ' }, { code: 'shop-breb-key-required', field: 'breBKey' }],
    ['a Bre-B key shorter than three characters', { paymentMethodSlugs: ['llave-bre-b'], breBKey: 'ab' }, { code: 'shop-breb-key-invalid', field: 'breBKey' }],
    ['a Bre-B key longer than forty characters', { paymentMethodSlugs: ['llave-bre-b'], breBKey: 'a'.repeat(41) }, { code: 'shop-breb-key-invalid', field: 'breBKey' }],
    ['a Bre-B key with unsupported characters', { paymentMethodSlugs: ['llave-bre-b'], breBKey: 'llave bre-b#' }, { code: 'shop-breb-key-invalid', field: 'breBKey' }],
    ['a Bre-B key without the Bre-B method', { breBKey: '@llave' }, { code: 'shop-breb-key-unexpected', field: 'breBKey' }],
    ['an unknown dial code', { whatsapp: { dialCode: '+999', number: '3001234567' } }, { code: 'shop-dial-code-unknown', field: 'dialCode' }],
    ['a WhatsApp number with fewer than seven digits', { whatsapp: { dialCode: '+57', number: '300 123' } }, { code: 'shop-whatsapp-invalid', field: 'number' }],
    ['a WhatsApp number with more than fifteen digits', { whatsapp: { dialCode: '+57', number: '1'.repeat(16) } }, { code: 'shop-whatsapp-invalid', field: 'number' }],
    ['a WhatsApp number with letters', { whatsapp: { dialCode: '+57', number: '300abc4567' } }, { code: 'shop-whatsapp-invalid', field: 'number' }],
    ['an empty WhatsApp number', { whatsapp: { dialCode: '+57', number: '' } }, { code: 'shop-whatsapp-invalid', field: 'number' }],
    ['a name beyond its bound', { name: 'x'.repeat(81) }, { code: 'shop-field-too-long', field: 'name' }],
    ['a description beyond its bound', { description: 'x'.repeat(501) }, { code: 'shop-field-too-long', field: 'description' }],
  ])('rejects %s and leaves the stored shop unchanged', async (_case, invalid, expected) => {
    const t = await seeded()
    const caller = t.withIdentity(first)
    const before = await caller.mutation(completeWizard, wizardInput)

    expect(await rejection(() => caller.mutation(completeWizard, { ...wizardInput, ...invalid }))).toEqual(expected)
    expect(await caller.query(current, {})).toEqual(before)
    expect(await t.run(async ctx => ctx.db.query('shops').collect())).toHaveLength(1)
  })

  it.each([
    ['more than ten categories', { categorySlugs: Array.from({ length: 11 }, () => 'otros') }],
    ['more than four payment methods', { paymentMethodSlugs: Array.from({ length: 5 }, () => 'nequi') }],
  ])('rejects %s and leaves the stored shop unchanged', async (_case, invalid) => {
    const t = await seeded()
    const caller = t.withIdentity(first)
    const before = await caller.mutation(completeWizard, wizardInput)

    expect(await rejection(() => caller.mutation(completeWizard, { ...wizardInput, ...invalid })))
      .toEqual({ code: 'shop-list-too-long', field: Object.keys(invalid)[0] })
    expect(await caller.query(current, {})).toEqual(before)
  })

  it('accepts the documented boundaries of the Bre-B key and the WhatsApp number', async () => {
    const t = await seeded()
    const caller = t.withIdentity(first)

    const shortest = await caller.mutation(completeWizard, {
      ...wizardInput,
      paymentMethodSlugs: ['llave-bre-b'],
      breBKey: 'a.b',
      whatsapp: { dialCode: '+57', number: '3001234' },
    })
    expect(shortest.breBKey).toBe('a.b')
    expect(shortest.whatsapp.number).toBe('3001234')

    const longest = await caller.mutation(completeWizard, {
      ...wizardInput,
      paymentMethodSlugs: ['llave-bre-b'],
      breBKey: `${'a_b-c.@'.repeat(6).slice(0, 39)}9`,
      whatsapp: { dialCode: '+57', number: '1'.repeat(15) },
    })
    expect(longest.breBKey).toBe(`${'a_b-c.@'.repeat(6).slice(0, 39)}9`)
    expect(longest.whatsapp.number).toBe('1'.repeat(15))
  })

  it('stores the Bre-B key only while the Bre-B method stays selected', async () => {
    const t = await seeded()
    const caller = t.withIdentity(first)
    const withKey = await caller.mutation(completeWizard, {
      ...wizardInput,
      paymentMethodSlugs: ['llave-bre-b', 'nequi'],
      breBKey: '  @livefy.tienda  ',
    })
    expect(withKey.breBKey).toBe('@livefy.tienda')

    const withoutKey = await caller.mutation(completeWizard, wizardInput)
    expect(withoutKey.breBKey).toBeNull()
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows[0].breBKey).toBeUndefined()
  })

  it('edits the existing shop instead of creating a second one', async () => {
    const t = await seeded()
    const caller = t.withIdentity(first)
    const created = await caller.mutation(completeWizard, wizardInput)
    const before = await t.run(async ctx => (await ctx.db.query('shops').collect())[0])
    // Real time must move on for `updatedAt` to prove the edit wrote the document.
    await new Promise(resolve => setTimeout(resolve, 5))
    const edited = await caller.mutation(completeWizard, {
      name: 'Tienda Dos',
      description: 'Ropa urbana y calzado',
      categorySlugs: ['ropa-y-accesorios', 'calzado'],
      paymentMethodSlugs: ['daviplata'],
      whatsapp: { dialCode: '+57', number: '3009998877' },
    })

    expect(edited.shopId).toBe(created.shopId)
    expect(edited.name).toBe('Tienda Dos')
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows).toHaveLength(1)
    // The first completion timestamp survives the edit; only `updatedAt` moves.
    expect(rows[0].wizardCompletedAt).toBe(before.wizardCompletedAt)
    expect(rows[0].updatedAt).toBeGreaterThan(before.updatedAt)
  })

  it('keeps each operator isolated on its own shop', async () => {
    const t = await seeded()
    const firstShop = await t.withIdentity(first).mutation(completeWizard, wizardInput)
    const secondShop = await t.withIdentity(second).mutation(completeWizard, { ...wizardInput, name: 'Tienda Dos' })

    expect(secondShop.shopId).not.toBe(firstShop.shopId)
    expect((await t.withIdentity(first).query(current, {}))?.name).toBe('Tienda Uno')
    expect((await t.withIdentity(second).query(current, {}))?.name).toBe('Tienda Dos')
  })

  it('returns null for an authenticated operator without a shop', async () => {
    const t = await seeded()
    expect(await t.withIdentity(first).query(current, {})).toBeNull()
  })
})

describe('platform-owned bot identifiers', () => {
  it('preserves the values the platform set and never takes them from the client', async () => {
    const t = await seeded()
    await t.run(async ctx => {
      await ctx.db.insert('shops', {
        ownerId: first.tokenIdentifier,
        name: 'Tienda Uno',
        description: 'Ropa urbana',
        categorySlugs: ['ropa-y-accesorios'],
        paymentMethodSlugs: ['nequi'],
        whatsapp: { dialCode: '+57', number: '3001234567' },
        tiktokBotHandle: '@livefy_tienda_uno',
        whatsappBotNumber: '+57 300 400 0001',
        wizardCompletedAt: 1,
        updatedAt: 1,
      })
    })
    const caller = t.withIdentity(first)

    const shop = await caller.mutation(completeWizard, { ...wizardInput, name: 'Tienda Renombrada' })
    expect(shop.name).toBe('Tienda Renombrada')
    expect(shop.tiktokBotHandle).toBe('@livefy_tienda_uno')
    expect(shop.whatsappBotNumber).toBe('+57 300 400 0001')

    await expect(caller.mutation(completeWizard, { ...wizardInput, tiktokBotHandle: '@atacante' })).rejects.toThrow()
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows[0].tiktokBotHandle).toBe('@livefy_tienda_uno')
  })
})