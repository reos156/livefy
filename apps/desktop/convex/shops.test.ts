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
  paymentData: [{ slug: 'nequi', value: '3001234567' }],
  whatsapp: { dialCode: '+57', number: '3001234567' },
}

// Both wallet methods capture a phone number and the savings account captures an
// account number, so every kind is reachable from the same fixture.
const everyMethod = ['nequi', 'llave-bre-b', 'daviplata', 'transferencia-ahorros']

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
      paymentData: [{ slug: 'nequi', value: '3001234567' }],
      whatsapp: { dialCode: '+57', number: '3001234567' },
      tiktokBotHandle: null,
      whatsappBotNumber: null,
    })
    // One datum per accepted method: the single Bre-B key is gone.
    expect(shop).not.toHaveProperty('breBKey')
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
      paymentData: [{ slug: ' nequi ', value: '  3001234567  ' }],
      whatsapp: { dialCode: '+57', number: ' 300-123 4567 ' },
    })

    expect(shop.name).toBe('Tienda Uno')
    expect(shop.description).toBe('Ropa urbana')
    expect(shop.categorySlugs).toEqual(['ropa-y-accesorios', 'calzado'])
    expect(shop.paymentMethodSlugs).toEqual(['nequi'])
    expect(shop.paymentData).toEqual([{ slug: 'nequi', value: '3001234567' }])
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
    ['an unknown payment method', { paymentMethodSlugs: ['efectivo'], paymentData: [{ slug: 'efectivo', value: '3001234567' }] }, { code: 'shop-payment-method-unknown', field: 'paymentMethodSlugs' }],
    ['no payment method', { paymentMethodSlugs: [], paymentData: [] }, { code: 'shop-payment-methods-required', field: 'paymentMethodSlugs' }],
    ['no payment datum at all', { paymentData: [] }, { code: 'shop-payment-data-required', field: 'paymentData' }],
    ['a method without its datum', { paymentMethodSlugs: ['nequi', 'daviplata'], paymentData: [{ slug: 'nequi', value: '3001234567' }] }, { code: 'shop-payment-data-required', field: 'paymentData' }],
    ['a datum for a method that is not selected', { paymentData: [{ slug: 'nequi', value: '3001234567' }, { slug: 'daviplata', value: '3001234568' }] }, { code: 'shop-payment-data-unexpected', field: 'paymentData' }],
    ['a duplicated datum slug', { paymentData: [{ slug: 'nequi', value: '3001234567' }, { slug: 'nequi', value: '3001234568' }] }, { code: 'shop-payment-data-duplicate', field: 'paymentData' }],
    ['a blank datum value', { paymentData: [{ slug: 'nequi', value: '   ' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a phone datum with six digits', { paymentData: [{ slug: 'nequi', value: '300123' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a phone datum with sixteen digits', { paymentData: [{ slug: 'nequi', value: '3'.repeat(16) }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a phone datum with letters', { paymentData: [{ slug: 'nequi', value: '300abc4567' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a Daviplata number with six digits', { paymentMethodSlugs: ['daviplata'], paymentData: [{ slug: 'daviplata', value: '300123' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a Bre-B key shorter than three characters', { paymentMethodSlugs: ['llave-bre-b'], paymentData: [{ slug: 'llave-bre-b', value: 'ab' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a Bre-B key longer than forty characters', { paymentMethodSlugs: ['llave-bre-b'], paymentData: [{ slug: 'llave-bre-b', value: 'a'.repeat(41) }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['a Bre-B key with unsupported characters', { paymentMethodSlugs: ['llave-bre-b'], paymentData: [{ slug: 'llave-bre-b', value: 'llave bre-b#' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['an account with four characters', { paymentMethodSlugs: ['transferencia-ahorros'], paymentData: [{ slug: 'transferencia-ahorros', value: '1234' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['an account with sixty-one characters', { paymentMethodSlugs: ['transferencia-ahorros'], paymentData: [{ slug: 'transferencia-ahorros', value: 'x'.repeat(61) }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
    ['an account with unsupported characters', { paymentMethodSlugs: ['transferencia-ahorros'], paymentData: [{ slug: 'transferencia-ahorros', value: 'Bancolombia 123/456' }] }, { code: 'shop-payment-data-invalid', field: 'paymentData' }],
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

  it('accepts the shortest datum of every kind', async () => {
    const t = await seeded()
    const shop = await t.withIdentity(first).mutation(completeWizard, {
      ...wizardInput,
      paymentMethodSlugs: everyMethod,
      paymentData: [
        { slug: 'nequi', value: '3001234' },
        { slug: 'llave-bre-b', value: 'a.b' },
        { slug: 'daviplata', value: '3001234' },
        { slug: 'transferencia-ahorros', value: '12345' },
      ],
    })

    expect(shop.paymentData).toEqual([
      { slug: 'nequi', value: '3001234' },
      { slug: 'llave-bre-b', value: 'a.b' },
      { slug: 'daviplata', value: '3001234' },
      { slug: 'transferencia-ahorros', value: '12345' },
    ])
  })

  it('accepts the longest datum of every kind', async () => {
    const t = await seeded()
    const key = `${'a_b-c.@'.repeat(6).slice(0, 39)}9`
    const account = `Bancolombia ${'1'.repeat(47)}#`
    expect(account).toHaveLength(60)

    const shop = await t.withIdentity(first).mutation(completeWizard, {
      ...wizardInput,
      paymentMethodSlugs: everyMethod,
      paymentData: [
        { slug: 'nequi', value: '1'.repeat(15) },
        { slug: 'llave-bre-b', value: key },
        { slug: 'daviplata', value: '1'.repeat(15) },
        { slug: 'transferencia-ahorros', value: account },
      ],
    })

    expect(shop.paymentData).toEqual([
      { slug: 'nequi', value: '1'.repeat(15) },
      { slug: 'llave-bre-b', value: key },
      { slug: 'daviplata', value: '1'.repeat(15) },
      { slug: 'transferencia-ahorros', value: account },
    ])
  })

  it('counts a phone datum ignoring the spaces, dashes and dots it was typed with', async () => {
    const t = await seeded()
    const shop = await t.withIdentity(first).mutation(completeWizard, {
      ...wizardInput,
      paymentData: [{ slug: 'nequi', value: ' 300 508-9676. ' }],
    })

    // Only the surrounding space is trimmed: the separators are the operator's.
    expect(shop.paymentData).toEqual([{ slug: 'nequi', value: '300 508-9676.' }])
  })

  it('stores each datum only while its method stays selected', async () => {
    const t = await seeded()
    const caller = t.withIdentity(first)
    const withKey = await caller.mutation(completeWizard, {
      ...wizardInput,
      paymentMethodSlugs: ['llave-bre-b', 'nequi'],
      paymentData: [
        { slug: 'llave-bre-b', value: '  @livefy.tienda  ' },
        { slug: 'nequi', value: '3001234567' },
      ],
    })
    expect(withKey.paymentData).toEqual([
      { slug: 'llave-bre-b', value: '@livefy.tienda' },
      { slug: 'nequi', value: '3001234567' },
    ])

    const withoutKey = await caller.mutation(completeWizard, wizardInput)
    expect(withoutKey.paymentData).toEqual([{ slug: 'nequi', value: '3001234567' }])
    const rows = await t.run(async ctx => ctx.db.query('shops').collect())
    expect(rows[0].paymentData).toEqual([{ slug: 'nequi', value: '3001234567' }])
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
      paymentData: [{ slug: 'daviplata', value: '3009998877' }],
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
        paymentData: [{ slug: 'nequi', value: '3001234567' }],
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