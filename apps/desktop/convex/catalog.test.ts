// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from './schema'
import { CATEGORIES, DIAL_CODES, PAYMENT_METHODS } from './catalogSeed'

const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const categories = makeFunctionReference<'query'>('catalog:categories')
const paymentMethods = makeFunctionReference<'query'>('catalog:paymentMethods')
const dialCodes = makeFunctionReference<'query'>('catalog:dialCodes')
const seedCatalog = makeFunctionReference<'mutation'>('catalog:seedCatalog')

describe('catalog queries — the screen reads the catalogues from the database', () => {
  it('returns the seeded categories in catalogue order', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(seedCatalog, {})

    expect(await t.query(categories, {})).toEqual(
      CATEGORIES.map(({ slug, label }) => ({ slug, label })),
    )
  })

  it('returns the seeded payment methods with their label, description and key flag', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(seedCatalog, {})

    expect(await t.query(paymentMethods, {})).toEqual(
      PAYMENT_METHODS.map(({ slug, label, description, requiresKey }) => ({ slug, label, description, requiresKey })),
    )
  })

  it('returns every seeded dial code in catalogue order', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(seedCatalog, {})

    const rows = await t.query(dialCodes, {})
    expect(rows).toEqual(DIAL_CODES.map(({ iso2, label, dial }) => ({ iso2, label, dial })))
    expect(rows).toHaveLength(244)
    expect(rows).toContainEqual({ iso2: 'CO', label: 'Colombia', dial: '+57' })
    expect(rows).toContainEqual({ iso2: 'MX', label: 'México', dial: '+52' })
    expect(rows).toContainEqual({ iso2: 'AR', label: 'Argentina', dial: '+54' })
    expect(rows).toContainEqual({ iso2: 'US', label: 'Estados Unidos', dial: '+1' })
    expect(rows).toContainEqual({ iso2: 'ES', label: 'España', dial: '+34' })
    expect(rows).toContainEqual({ iso2: 'BR', label: 'Brasil', dial: '+55' })
  })

  it('seeds once and stays the same size on a second run', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(seedCatalog, {})
    const first = await t.query(dialCodes, {})

    await t.mutation(seedCatalog, {})
    const rows = await t.run(async ctx => ({
      categories: await ctx.db.query('categories').collect(),
      paymentMethods: await ctx.db.query('paymentMethods').collect(),
      dialCodes: await ctx.db.query('dialCodes').collect(),
    }))

    expect(rows.categories).toHaveLength(CATEGORIES.length)
    expect(rows.paymentMethods).toHaveLength(PAYMENT_METHODS.length)
    expect(rows.dialCodes).toHaveLength(DIAL_CODES.length)
    expect(await t.query(categories, {})).toEqual(CATEGORIES.map(({ slug, label }) => ({ slug, label })))
    expect(await t.query(dialCodes, {})).toEqual(first)
  })
})