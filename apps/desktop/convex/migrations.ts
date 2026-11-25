import { v } from 'convex/values'
import { internalMutation, type MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// Shops written before the catalogues existed still hold free text (decision D-D:
// those rows are migrated, never dropped). The old fields are no longer in the schema,
// so the migration reads them through this shape and writes only the current one. A row
// saved after the catalogue migration but before a payment method captured its own datum
// holds slugs and a WhatsApp already, and only its single Bre-B key is left to map.
type ShopRow = Doc<'shops'>
type LegacyShop =
  Partial<Pick<ShopRow, 'categorySlugs' | 'paymentMethodSlugs' | 'whatsapp' | 'paymentData'>> &
  Omit<ShopRow, 'categorySlugs' | 'paymentMethodSlugs' | 'whatsapp' | 'paymentData'> & {
    categories?: string[]
    paymentMethods?: string[]
    personalWhatsapp?: string
    breBKey?: string
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

// The method the single legacy key belonged to.
const BRE_B_METHOD = 'llave-bre-b'

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
// values (not rows), `droppedWhatsapp` counts legacy numbers too short to keep and
// `droppedPaymentKey` counts a legacy Bre-B key whose method was not among the migrated
// ones, so a value is never removed without being reported; `skipped` counts rows already
// in the current shape.
export const migrateShopsToCatalogs = internalMutation({
  args: {},
  returns: v.object({
    migrated: v.number(),
    skipped: v.number(),
    unmapped: v.number(),
    droppedWhatsapp: v.number(),
    droppedPaymentKey: v.number(),
  }),
  handler: async ctx => {
    const shops = (await ctx.db.query('shops').collect()) as LegacyShop[]
    let migrated = 0
    let skipped = 0
    let unmapped = 0
    let droppedWhatsapp = 0
    let droppedPaymentKey = 0

    for (const shop of shops) {
      const holdsLegacyFields =
        shop.categories !== undefined ||
        shop.paymentMethods !== undefined ||
        shop.personalWhatsapp !== undefined
      // A row that already holds every current field is done; one that only lacks the
      // datum list still has a key to carry, so it is migrated too.
      if (!holdsLegacyFields && shop.paymentData !== undefined) {
        skipped += 1
        continue
      }

      let categorySlugs = shop.categorySlugs ?? []
      let paymentMethodSlugs = shop.paymentMethodSlugs ?? []
      let whatsapp = shop.whatsapp ?? { dialCode: DEFAULT_DIAL_CODE, number: '' }
      if (holdsLegacyFields) {
        const categories = mapLegacyValues(shop.categories, CATEGORY_MAP)
        const paymentMethods = mapLegacyValues(shop.paymentMethods, PAYMENT_METHOD_MAP)
        unmapped += categories.unmapped + paymentMethods.unmapped
        categorySlugs = categories.slugs
        paymentMethodSlugs = paymentMethods.slugs
        const legacy = await whatsappFromLegacy(ctx, shop.personalWhatsapp)
        whatsapp = legacy.whatsapp
        if (shop.personalWhatsapp && legacy.dropped) droppedWhatsapp += 1
      }

      // The key the previous shape held becomes the datum of the method it was captured
      // for. A key whose method is not selected anymore is dropped, and counted, because
      // no screen may receive a payment through it.
      const paymentData = [...(shop.paymentData ?? [])]
      const key = (shop.breBKey ?? '').trim()
      if (key.length > 0) {
        if (!paymentMethodSlugs.includes(BRE_B_METHOD)) droppedPaymentKey += 1
        else if (!paymentData.some(entry => entry.slug === BRE_B_METHOD)) {
          paymentData.push({ slug: BRE_B_METHOD, value: key })
        }
      }

      // `replace` writes exactly this shape, which is what removes the old fields and
      // keeps everything the platform owns intact.
      await ctx.db.replace(shop._id, {
        ownerId: shop.ownerId,
        name: shop.name,
        description: shop.description,
        categorySlugs,
        paymentMethodSlugs,
        paymentData,
        whatsapp,
        ...(shop.tiktokBotHandle === undefined ? {} : { tiktokBotHandle: shop.tiktokBotHandle }),
        ...(shop.whatsappBotNumber === undefined ? {} : { whatsappBotNumber: shop.whatsappBotNumber }),
        wizardCompletedAt: shop.wizardCompletedAt,
        updatedAt: shop.updatedAt,
      })
      migrated += 1
    }

    return { migrated, skipped, unmapped, droppedWhatsapp, droppedPaymentKey }
  },
})
