// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { defineSchema, defineTable, makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'

const modules = { ...import.meta.glob('./**/*.ts') }
const migrateShopsToCatalogs = makeFunctionReference<'mutation'>('migrations:migrateShopsToCatalogs')

// Fixture-only schema: the migration exists to rewrite rows written under the previous
// shape, so the fixture database has to accept those fields. `schema.ts` no longer
// declares them, and the migration writes only the new shape.
const legacySchema = defineSchema({
  shops: defineTable({
    ownerId: v.string(),
    name: v.string(),
    description: v.string(),
    categories: v.optional(v.array(v.string())),
    paymentMethods: v.optional(v.array(v.string())),
    personalWhatsapp: v.optional(v.string()),
    categorySlugs: v.optional(v.array(v.string())),
    paymentMethodSlugs: v.optional(v.array(v.string())),
    breBKey: v.optional(v.string()),
    whatsapp: v.optional(v.object({ dialCode: v.string(), number: v.string() })),
    tiktokBotHandle: v.optional(v.string()),
    whatsappBotNumber: v.optional(v.string()),
    wizardCompletedAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),
  // The migration resolves an explicit international prefix against the catalogue, so
  // the fixture database needs it to behave like a seeded deployment.
  dialCodes: defineTable({
    iso2: v.string(),
    label: v.string(),
    dial: v.string(),
    order: v.number(),
  }).index('by_iso2', ['iso2']).index('by_order', ['order']),
})

const legacyShop = {
  ownerId: 'https://fixture.clerk.accounts.dev|user_first',
  name: 'Tienda Uno',
  description: 'Ropa urbana',
  categories: ['ropa', 'Ropa y Accesorios', 'calzado', 'belleza'],
  paymentMethods: ['nequi', 'Transferencia a cuenta de ahorros', 'llave bre-b'],
  personalWhatsapp: '+57 300 123-4567',
  tiktokBotHandle: '@livefy_tienda_uno',
  whatsappBotNumber: '+57 300 400 0001',
  wizardCompletedAt: 1,
  updatedAt: 1,
}

async function seededLegacy(rows: Record<string, unknown>[]) {
  const t = convexTest(legacySchema, modules)
  await t.run(async ctx => {
    for (const row of rows) await ctx.db.insert('shops', row as never)
    const dials = [
      { iso2: 'CO', label: 'Colombia', dial: '+57', order: 0 },
      { iso2: 'AR', label: 'Argentina', dial: '+54', order: 1 },
    ]
    for (const dial of dials) await ctx.db.insert('dialCodes', dial)
  })
  return t
}

async function shops(t: ReturnType<typeof convexTest>) {
  return t.run(async ctx => ctx.db.query('shops').collect())
}

describe('migrations.migrateShopsToCatalogs — existing shops move to the catalogues', () => {
  it('maps the known legacy values and writes only the new shape', async () => {
    const t = await seededLegacy([{ ...legacyShop }])
    const counts = await t.mutation(migrateShopsToCatalogs, {})

    expect(counts).toEqual({ migrated: 1, skipped: 0, unmapped: 0, droppedWhatsapp: 0 })
    const [row] = await shops(t)
    expect(row.categorySlugs).toEqual(['ropa-y-accesorios', 'calzado', 'belleza-y-cuidado-personal'])
    expect(row.paymentMethodSlugs).toEqual(['nequi', 'transferencia-ahorros', 'llave-bre-b'])
    // The contract keeps every digit the free-text field held, so a legacy number that
    // already carried its country code keeps it; the wizard shows it for correction.
    // The dial code moves to its own field: a legacy `+57 300 123-4567` must not keep
    // the country code inside the number.
    expect(row.whatsapp).toEqual({ dialCode: '+57', number: '3001234567' })
    // The old fields are gone and everything the platform owns survives.
    expect(Object.keys(row).sort()).toEqual([
      '_creationTime',
      '_id',
      'categorySlugs',
      'description',
      'name',
      'ownerId',
      'paymentMethodSlugs',
      'tiktokBotHandle',
      'updatedAt',
      'whatsapp',
      'whatsappBotNumber',
      'wizardCompletedAt',
    ])
    expect(row.tiktokBotHandle).toBe('@livefy_tienda_uno')
    expect(row.whatsappBotNumber).toBe('+57 300 400 0001')
  })

  it('drops the values with no catalogue match and counts them', async () => {
    const t = await seededLegacy([{
      ...legacyShop,
      categories: ['ropa', 'juguetes', 'zapatillas raras'],
      paymentMethods: ['nequi', 'efectivo', 'tarjeta'],
    }])

    expect(await t.mutation(migrateShopsToCatalogs, {})).toEqual({ migrated: 1, skipped: 0, unmapped: 4, droppedWhatsapp: 0 })
    const [row] = await shops(t)
    expect(row.categorySlugs).toEqual(['ropa-y-accesorios'])
    expect(row.paymentMethodSlugs).toEqual(['nequi'])
  })

  it('keeps every catalogue category a legacy shop already used', async () => {
    const t = await seededLegacy([{
      ...legacyShop,
      categories: ['mascotas', 'Tecnología y accesorios', 'otros'],
    }])

    expect(await t.mutation(migrateShopsToCatalogs, {})).toEqual({ migrated: 1, skipped: 0, unmapped: 0, droppedWhatsapp: 0 })
    const [row] = await shops(t)
    expect(row.categorySlugs).toEqual(['mascotas', 'tecnologia-y-accesorios', 'otros'])
  })

  it('keeps the country a legacy number declared instead of relocating it to Colombia', async () => {
    const t = await seededLegacy([{ ...legacyShop, personalWhatsapp: '+54 11 5555-0000' }])

    expect(await t.mutation(migrateShopsToCatalogs, {})).toEqual({ migrated: 1, skipped: 0, unmapped: 0, droppedWhatsapp: 0 })
    const [row] = await shops(t)
    expect(row.whatsapp).toEqual({ dialCode: '+54', number: '1155550000' })
  })

  it('leaves an empty WhatsApp when the legacy number has fewer than seven digits', async () => {
    const t = await seededLegacy([
      { ...legacyShop, personalWhatsapp: '+57 12-34' },
      { ...legacyShop, personalWhatsapp: undefined },
    ])

    expect(await t.mutation(migrateShopsToCatalogs, {})).toEqual({ migrated: 2, skipped: 0, unmapped: 0, droppedWhatsapp: 1 })
    const rows = await shops(t)
    expect(rows[0].whatsapp).toEqual({ dialCode: '+57', number: '' })
    expect(rows[1].whatsapp).toEqual({ dialCode: '+57', number: '' })
  })

  it('is safe on a second run and leaves migrated rows untouched', async () => {
    const t = await seededLegacy([{ ...legacyShop }])
    await t.mutation(migrateShopsToCatalogs, {})
    const afterFirst = await shops(t)

    expect(await t.mutation(migrateShopsToCatalogs, {})).toEqual({ migrated: 0, skipped: 1, unmapped: 0, droppedWhatsapp: 0 })
    expect(await shops(t)).toEqual(afterFirst)
  })
})