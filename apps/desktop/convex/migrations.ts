import { v } from 'convex/values'
import { internalMutation, type MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// Shops written before the catalogues existed still hold free text (decision D-D:
// those rows are migrated, never dropped). The old fields are no longer in the schema,
// so the migration reads them through this shape and writes only the new one.
type LegacyShop = Doc<'shops'> & {
  categories?: string[]
  paymentMethods?: string[]
  personalWhatsapp?: string
}

// Every legacy value the catalogues can place. The ten catalogue slugs are all covered,
// so a legacy shop keeps any category that still exists; anything the catalogues do not
// contain is dropped and counted. Guessing for the operator would be worse than asking.
const CATEGORY_MAP: Record<string, string> = {
  'ropa': 'ropa-y-accesorios',
  'ropa y accesorios': 'ropa-y-accesorios',
  'belleza': 'belleza-y-cuidado-personal',
  'belleza y cuidado personal': 'belleza-y-cuidado-personal',
  'calzado': 'calzado',
  'hogar': 'hogar-y-cocina',
  'hogar y cocina': 'hogar-y-cocina',
  'tecnologia': 'tecnologia-y-accesorios',
  'tecnología': 'tecnologia-y-accesorios',
  'tecnologia y accesorios': 'tecnologia-y-accesorios',
  'tecnología y accesorios': 'tecnologia-y-accesorios',
  'alimentos': 'alimentos-y-bebidas',
  'alimentos y bebidas': 'alimentos-y-bebidas',
  'deportes': 'deportes-y-aire-libre',
  'deportes y aire libre': 'deportes-y-aire-libre',
  'bebes': 'bebes-y-ninos',
  'bebés': 'bebes-y-ninos',
  'bebes y ninos': 'bebes-y-ninos',
  'bebés y niños': 'bebes-y-ninos',
  'mascotas': 'mascotas',
  'otros': 'otros',
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  'nequi': 'nequi',
  'transferencia': 'transferencia-ahorros',
  'transferencia a cuenta de ahorros': 'transferencia-ahorros',
  'daviplata': 'daviplata',
  'llave bre-b': 'llave-bre-b',
  'bre-b': 'llave-bre-b',
}

// The shop was created from Colombia, so its legacy number is read as Colombian; rows
// that end up without a usable number get an empty WhatsApp the wizard requires on the
// next save.
const DEFAULT_DIAL_CODE = '+57'
const MIN_WHATSAPP_DIGITS = 7

function mapLegacyValues(values: string[] | undefined, catalogue: Record<string, string>) {
  const slugs: string[] = []
  let unmapped = 0
  for (const value of values ?? []) {
    const slug = catalogue[value.trim().toLowerCase()]
    if (slug === undefined) {
      unmapped += 1
      continue
    }
    if (!slugs.includes(slug)) slugs.push(slug)
  }
  return { slugs, unmapped }
}

// A legacy number may carry an explicit international prefix, and the operator was free
// to type any country into it. Reading every value as Colombian would relocate a
// `+54 11 5555-0000` to Colombia and duplicate its digits, so the explicit prefix wins
// when the catalogue knows it; without a prefix the shop is read as Colombian, which is
// the only default this migration can defend.
const LEADING_DIAL = /^\s*\+(\d{1,4})/

async function whatsappFromLegacy(
  ctx: MutationCtx,
  personalWhatsapp: string | undefined,
): Promise<{ whatsapp: { dialCode: string; number: string }; dropped: boolean }> {
  const typed = (personalWhatsapp ?? '').trim()
  let dialCode = DEFAULT_DIAL_CODE
  let rest = typed

  const leading = LEADING_DIAL.exec(typed)
  if (leading) {
    const candidate = `+${leading[1]}`
    const known = await ctx.db
      .query('dialCodes')
      .filter(q => q.eq(q.field('dial'), candidate))
      .first()
    if (known) {
      dialCode = candidate
      rest = typed.slice(leading[0].length)
    }
  }

  let digits = rest.replace(/[^0-9]/g, '')
  // No explicit prefix: a Colombian mobile typed with its country code loses it, so the
  // dial code is not stored twice.
  const country = DEFAULT_DIAL_CODE.slice(1)
  if (!leading && digits.startsWith(country) && digits.length - country.length === 10) {
    digits = digits.slice(country.length)
  }

  const number = digits.length >= MIN_WHATSAPP_DIGITS && digits.length <= 15 ? digits : ''
  return { whatsapp: { dialCode, number }, dropped: number === '' }
}

// Internal and argument-free: the operator never triggers it, and it can be run twice
// without duplicating or re-dropping anything. `unmapped` counts dropped catalogue
// values (not rows), `droppedWhatsapp` counts legacy numbers too short to keep, so a
// value is never removed without being reported, and `skipped` counts rows already in
// the new shape.
export const migrateShopsToCatalogs = internalMutation({
  args: {},
  returns: v.object({ migrated: v.number(), skipped: v.number(), unmapped: v.number(), droppedWhatsapp: v.number() }),
  handler: async ctx => {
    const shops = (await ctx.db.query('shops').collect()) as LegacyShop[]
    let migrated = 0
    let skipped = 0
    let unmapped = 0
    let droppedWhatsapp = 0

    for (const shop of shops) {
      const holdsLegacyFields =
        shop.categories !== undefined ||
        shop.paymentMethods !== undefined ||
        shop.personalWhatsapp !== undefined
      if (!holdsLegacyFields) {
        skipped += 1
        continue
      }

      const categories = mapLegacyValues(shop.categories, CATEGORY_MAP)
      const paymentMethods = mapLegacyValues(shop.paymentMethods, PAYMENT_METHOD_MAP)
      unmapped += categories.unmapped + paymentMethods.unmapped
      const { whatsapp, dropped } = await whatsappFromLegacy(ctx, shop.personalWhatsapp)
      if (shop.personalWhatsapp && dropped) droppedWhatsapp += 1

      // `replace` writes exactly this shape, which is what removes the old fields and
      // keeps everything the platform owns intact.
      await ctx.db.replace(shop._id, {
        ownerId: shop.ownerId,
        name: shop.name,
        description: shop.description,
        categorySlugs: categories.slugs,
        paymentMethodSlugs: paymentMethods.slugs,
        whatsapp,
        ...(shop.tiktokBotHandle === undefined ? {} : { tiktokBotHandle: shop.tiktokBotHandle }),
        ...(shop.whatsappBotNumber === undefined ? {} : { whatsappBotNumber: shop.whatsappBotNumber }),
        wizardCompletedAt: shop.wizardCompletedAt,
        updatedAt: shop.updatedAt,
      })
      migrated += 1
    }

    return { migrated, skipped, unmapped, droppedWhatsapp }
  },
})
