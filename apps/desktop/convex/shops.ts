import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireUser } from './lib/requireUser'

// Bounds keep one shop document predictable and small. Categories and payment methods
// are catalogue references now, so the backend checks each slug exists instead of
// accepting free text.
const MAX_NAME = 80
const MAX_DESCRIPTION = 500
const MAX_CATEGORIES = 10
const MAX_PAYMENT_METHODS = 4

// Bre-B's key is validated as part of the method (decision D-B) and belongs to the
// shop, not to the catalogue entry.
const BRE_B_METHOD = 'llave-bre-b'
const MIN_BRE_B_KEY = 3
const MAX_BRE_B_KEY = 40
const BRE_B_KEY = /^[A-Za-z0-9._@-]+$/

// The contact WhatsApp is mandatory; only its digits are stored, next to the dial code
// the operator chose from the `dialCodes` catalogue.
const WHATSAPP_SEPARATORS = /[\s-]/g
const WHATSAPP_DIGITS = /^[0-9]{7,15}$/

type ValidationCode =
  | 'shop-name-required'
  | 'shop-description-required'
  | 'shop-field-too-long'
  | 'shop-categories-required'
  | 'shop-payment-methods-required'
  | 'shop-list-too-long'
  | 'shop-category-unknown'
  | 'shop-payment-method-unknown'
  | 'shop-breb-key-required'
  | 'shop-breb-key-invalid'
  | 'shop-breb-key-unexpected'
  | 'shop-dial-code-unknown'
  | 'shop-whatsapp-invalid'

// A stable code per failure instead of prose: the screen owns the operator-facing copy.
function invalid(code: ValidationCode, field: string): never {
  throw new ConvexError({ code, field })
}

function requiredText(value: string, code: ValidationCode, field: string, max: number) {
  const text = value.trim()
  if (text.length === 0) invalid(code, field)
  if (text.length > max) invalid('shop-field-too-long', field)
  return text
}

// Reading the catalogue instead of a constant is what lets the app change its options
// without a deploy (S5); a slug the table does not hold is rejected, not stored.
async function knownCategories(ctx: MutationCtx, values: string[]) {
  if (values.length === 0) invalid('shop-categories-required', 'categorySlugs')
  if (values.length > MAX_CATEGORIES) invalid('shop-list-too-long', 'categorySlugs')
  const slugs = values.map(value => value.trim())
  for (const slug of slugs) {
    const row = await ctx.db
      .query('categories')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .first()
    if (!row) invalid('shop-category-unknown', 'categorySlugs')
  }
  return slugs
}

async function knownPaymentMethods(ctx: MutationCtx, values: string[]) {
  if (values.length === 0) invalid('shop-payment-methods-required', 'paymentMethodSlugs')
  if (values.length > MAX_PAYMENT_METHODS) invalid('shop-list-too-long', 'paymentMethodSlugs')
  const slugs = values.map(value => value.trim())
  for (const slug of slugs) {
    const row = await ctx.db
      .query('paymentMethods')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .first()
    if (!row) invalid('shop-payment-method-unknown', 'paymentMethodSlugs')
  }
  return slugs
}

// Required exactly while `llave-bre-b` is selected: without the method the key must not
// be there, so a stale value cannot outlive the payment method it belongs to.
function validBreBKey(paymentMethodSlugs: string[], value: string | undefined) {
  const text = (value ?? '').trim()
  if (!paymentMethodSlugs.includes(BRE_B_METHOD)) {
    if (text.length > 0) invalid('shop-breb-key-unexpected', 'breBKey')
    return undefined
  }
  if (text.length === 0) invalid('shop-breb-key-required', 'breBKey')
  if (text.length < MIN_BRE_B_KEY || text.length > MAX_BRE_B_KEY) invalid('shop-breb-key-invalid', 'breBKey')
  if (!BRE_B_KEY.test(text)) invalid('shop-breb-key-invalid', 'breBKey')
  return text
}

async function validWhatsapp(ctx: MutationCtx, whatsapp: { dialCode: string; number: string }) {
  const dial = await ctx.db
    .query('dialCodes')
    .filter(q => q.eq(q.field('dial'), whatsapp.dialCode))
    .first()
  if (!dial) invalid('shop-dial-code-unknown', 'dialCode')
  const digits = whatsapp.number.replace(WHATSAPP_SEPARATORS, '')
  if (!WHATSAPP_DIGITS.test(digits)) invalid('shop-whatsapp-invalid', 'number')
  // The stored dial code is the catalogue one, so the pair can always be rebuilt.
  return { dialCode: dial.dial, number: digits }
}

const whatsappView = v.object({ dialCode: v.string(), number: v.string() })

const shopView = v.object({
  shopId: v.id('shops'),
  name: v.string(),
  description: v.string(),
  categorySlugs: v.array(v.string()),
  paymentMethodSlugs: v.array(v.string()),
  breBKey: v.union(v.string(), v.null()),
  whatsapp: whatsappView,
  tiktokBotHandle: v.union(v.string(), v.null()),
  whatsappBotNumber: v.union(v.string(), v.null()),
})

function toView(shop: Doc<'shops'>) {
  return {
    shopId: shop._id,
    name: shop.name,
    description: shop.description,
    categorySlugs: shop.categorySlugs,
    paymentMethodSlugs: shop.paymentMethodSlugs,
    breBKey: shop.breBKey ?? null,
    whatsapp: shop.whatsapp,
    tiktokBotHandle: shop.tiktokBotHandle ?? null,
    whatsappBotNumber: shop.whatsappBotNumber ?? null,
  }
}

// One shop per authenticated operator: every read starts from `requireUser`, so a
// client can never name the shop it wants to read.
export const current = query({
  args: {},
  returns: v.union(shopView, v.null()),
  handler: async ctx => {
    const ownerId = await requireUser(ctx)
    const owner = await ctx.db
      .query('shops')
      .withIndex('by_owner', q => q.eq('ownerId', ownerId))
      .first()
    return owner ? toView(owner) : null
  },
})

// Create-or-update: the first completion creates the shop, and every later call edits
// it, which is what lets the operator change the information afterwards.
export const completeWizard = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    categorySlugs: v.array(v.string()),
    paymentMethodSlugs: v.array(v.string()),
    breBKey: v.optional(v.string()),
    whatsapp: whatsappView,
  },
  returns: shopView,
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx)
    const name = requiredText(args.name, 'shop-name-required', 'name', MAX_NAME)
    const description = requiredText(args.description, 'shop-description-required', 'description', MAX_DESCRIPTION)
    const categorySlugs = await knownCategories(ctx, args.categorySlugs)
    const paymentMethodSlugs = await knownPaymentMethods(ctx, args.paymentMethodSlugs)
    const breBKey = validBreBKey(paymentMethodSlugs, args.breBKey)
    const whatsapp = await validWhatsapp(ctx, args.whatsapp)

    const existing = await ctx.db
      .query('shops')
      .withIndex('by_owner', q => q.eq('ownerId', ownerId))
      .first()

    const now = Date.now()
    // Ownership invariant: `ownerId` is server-derived and written only when the shop is
    // created, never on an edit. The platform-owned bot identifiers are absent from these
    // arguments too, so no later completion can rewrite either of them.
    const operatorFields = {
      name,
      description,
      categorySlugs,
      paymentMethodSlugs,
      breBKey,
      whatsapp,
      updatedAt: now,
    }

    const shopId = existing
      ? (await ctx.db.patch(existing._id, operatorFields), existing._id)
      : await ctx.db.insert('shops', { ...operatorFields, ownerId, wizardCompletedAt: now })

    const saved = await ctx.db.get(shopId)
    if (!saved) throw new ConvexError({ code: 'shop-not-found', field: 'shopId' })
    return toView(saved)
  },
})