import { ConvexError, v } from 'convex/values'
import { internalMutation } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// Shops written before the catalogues existed still hold free text (decision D-D:
// those rows are migrated, never dropped). The old fields are no longer in the schema,
// so the migration reads them through this shape and writes only the new one.
type LegacyShop = Doc<'shops'> & {
  categories?: string[]
  paymentMethods?: string[]
  personalWhatsapp?: string
}

// Every legacy value the catalogues can place. Anything else is dropped and counted:
// guessing a category for the operator would be worse than leaving the wizard to ask.
const CATEGORY_MAP: Record<string, string> = {
  'ropa': 'ropa-y-accesorios',
  'ropa y accesorios': 'ropa-y-accesorios',
  'calzado': 'calzado',
  'belleza': 'belleza-y-cuidado-personal',
  'belleza y cuidado personal': 'belleza-y-cuidado-personal',
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

function whatsappFromLegacy(personalWhatsapp: string | undefined) {
  const digits = (personalWhatsapp ?? '').replace(/[^0-9]/g, '')
  // The dial code lives in its own field, so a legacy value typed as `+57 300 123-4567`
  // must not store the country code twice. Only a Colombian number is normalised, and
  // only when what remains is still a full-length number.
  const country = DEFAULT_DIAL_CODE.slice(1)
  const national = digits.startsWith(country) && digits.length - country.length === 10
    ? digits.slice(country.length)
    : digits
  return {
    dialCode: DEFAULT_DIAL_CODE,
    number: national.length >= MIN_WHATSAPP_DIGITS ? national : '',
  }
}

// Internal and argument-free: the operator never triggers it, and it can be run twice
// without duplicating or re-dropping anything. `unmapped` counts dropped values (not
// rows), `skipped` counts rows already in the new shape.
export const migrateShopsToCatalogs = internalMutation({
  args: {},
  returns: v.object({ migrated: v.number(), skipped: v.number(), unmapped: v.number() }),
  handler: async ctx => {
    const shops = (await ctx.db.query('shops').collect()) as LegacyShop[]
    let migrated = 0
    let skipped = 0
    let unmapped = 0

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

      // `replace` writes exactly this shape, which is what removes the old fields and
      // keeps everything the platform owns intact.
      await ctx.db.replace(shop._id, {
        ownerId: shop.ownerId,
        name: shop.name,
        description: shop.description,
        categorySlugs: categories.slugs,
        paymentMethodSlugs: paymentMethods.slugs,
        whatsapp: whatsappFromLegacy(shop.personalWhatsapp),
        ...(shop.tiktokBotHandle === undefined ? {} : { tiktokBotHandle: shop.tiktokBotHandle }),
        ...(shop.whatsappBotNumber === undefined ? {} : { whatsappBotNumber: shop.whatsappBotNumber }),
        wizardCompletedAt: shop.wizardCompletedAt,
        updatedAt: shop.updatedAt,
      })
      migrated += 1
    }

    return { migrated, skipped, unmapped }
  },
})