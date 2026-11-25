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

// Every accepted method carries exactly one datum, and its kind decides the rule: a
// wallet captures a phone number, Bre-B a key and a savings account an account number.
const PHONE_SEPARATORS = /[\s.-]/g
const PHONE_DIGITS = /^[0-9]{7,15}$/
const KEY_VALUE = /^[A-Za-z0-9._@-]{3,40}$/
// Letters (accented included), digits, spaces and `.` `-` `#`: enough for
// "Bancolombia 123-456789-00" and no room for a value that cannot be an account.
const ACCOUNT_VALUE = /^[\p{L}0-9 .#-]{5,60}$/u

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
  | 'shop-payment-data-required'
  | 'shop-payment-data-unexpected'
  | 'shop-payment-data-duplicate'
  | 'shop-payment-data-invalid'
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

// The catalogue rows, not just their slugs: the datum of each method is validated
// against the kind the row declares.
async function knownPaymentMethods(ctx: MutationCtx, values: string[]) {
  if (values.length === 0) invalid('shop-payment-methods-required', 'paymentMethodSlugs')
  if (values.length > MAX_PAYMENT_METHODS) invalid('shop-list-too-long', 'paymentMethodSlugs')
  const slugs = values.map(value => value.trim())
  const rows: Doc<'paymentMethods'>[] = []
  for (const slug of slugs) {
    const row = await ctx.db
      .query('paymentMethods')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .first()
    if (!row) invalid('shop-payment-method-unknown', 'paymentMethodSlugs')
    rows.push(row)
  }
  return rows
}

function validDatum(kind: Doc<'paymentMethods'>['dataKind'], value: string) {
  if (kind === 'phone') return PHONE_DIGITS.test(value.replace(PHONE_SEPARATORS, ''))
  if (kind === 'key') return KEY_VALUE.test(value)
  return ACCOUNT_VALUE.test(value)
}

// Exactly one datum per accepted method and none for a method that is not selected, so
// a value cannot outlive the method it belongs to and cannot arrive without one. Each
// failure has its own code: the screen tells the operator which of the three it is.
function validPaymentData(selected: Doc<'paymentMethods'>[], data: { slug: string; value: string }[]) {
  const kinds = new Map(selected.map(row => [row.slug, row.dataKind]))
  const seen = new Set<string>()
  const accepted: { slug: string; value: string }[] = []
  for (const entry of data) {
    const slug = entry.slug.trim()
    const kind = kinds.get(slug)
    if (kind === undefined) invalid('shop-payment-data-unexpected', 'paymentData')
    if (seen.has(slug)) invalid('shop-payment-data-duplicate', 'paymentData')
    seen.add(slug)
    const value = entry.value.trim()
    if (!validDatum(kind, value)) invalid('shop-payment-data-invalid', 'paymentData')
    accepted.push({ slug, value })
  }
  for (const row of selected) {
    if (!seen.has(row.slug)) invalid('shop-payment-data-required', 'paymentData')
  }
  return accepted
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
const paymentDataView = v.array(v.object({ slug: v.string(), value: v.string() }))

const shopView = v.object({
  shopId: v.id('shops'),
  name: v.string(),
  description: v.string(),
  categorySlugs: v.array(v.string()),
  paymentMethodSlugs: v.array(v.string()),
  paymentData: paymentDataView,
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
    paymentData: shop.paymentData,
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
    paymentData: paymentDataView,
    whatsapp: whatsappView,
  },
  returns: shopView,
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx)
    const name = requiredText(args.name, 'shop-name-required', 'name', MAX_NAME)
    const description = requiredText(args.description, 'shop-description-required', 'description', MAX_DESCRIPTION)
    const categorySlugs = await knownCategories(ctx, args.categorySlugs)
    const paymentMethodRows = await knownPaymentMethods(ctx, args.paymentMethodSlugs)
    const paymentMethodSlugs = paymentMethodRows.map(row => row.slug)
    const paymentData = validPaymentData(paymentMethodRows, args.paymentData)
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
      paymentData,
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