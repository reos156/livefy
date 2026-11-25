import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireUser } from './lib/requireUser'

// Bounds keep one shop document predictable and small. The scope document names the
// fields but no catalogue, so categories and payment methods stay free entry.
const MAX_NAME = 80
const MAX_DESCRIPTION = 500
const MAX_LIST_ITEMS = 10
const MAX_LIST_ITEM = 40
const MAX_WHATSAPP = 32

type ValidationCode =
  | 'shop-name-required'
  | 'shop-description-required'
  | 'shop-categories-required'
  | 'shop-payment-methods-required'
  | 'shop-field-too-long'
  | 'shop-item-empty'
  | 'shop-item-too-long'
  | 'shop-list-too-long'

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

function requiredItems(values: string[], code: ValidationCode, field: string) {
  if (values.length === 0) invalid(code, field)
  if (values.length > MAX_LIST_ITEMS) invalid('shop-list-too-long', field)
  const items = values.map(value => value.trim())
  if (items.some(item => item.length === 0)) invalid('shop-item-empty', field)
  if (items.some(item => item.length > MAX_LIST_ITEM)) invalid('shop-item-too-long', field)
  return items
}

function optionalWhatsapp(value: string | undefined) {
  if (value === undefined) return undefined
  const text = value.trim()
  if (text.length === 0) return undefined
  if (text.length > MAX_WHATSAPP) invalid('shop-field-too-long', 'personalWhatsapp')
  return text
}

const shopView = v.object({
  shopId: v.id('shops'),
  name: v.string(),
  description: v.string(),
  categories: v.array(v.string()),
  paymentMethods: v.array(v.string()),
  personalWhatsapp: v.union(v.string(), v.null()),
  tiktokBotHandle: v.union(v.string(), v.null()),
  whatsappBotNumber: v.union(v.string(), v.null()),
})

function toView(shop: Doc<'shops'>) {
  return {
    shopId: shop._id,
    name: shop.name,
    description: shop.description,
    categories: shop.categories,
    paymentMethods: shop.paymentMethods,
    personalWhatsapp: shop.personalWhatsapp ?? null,
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
    categories: v.array(v.string()),
    paymentMethods: v.array(v.string()),
    personalWhatsapp: v.optional(v.string()),
  },
  returns: shopView,
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx)
    const name = requiredText(args.name, 'shop-name-required', 'name', MAX_NAME)
    const description = requiredText(args.description, 'shop-description-required', 'description', MAX_DESCRIPTION)
    const categories = requiredItems(args.categories, 'shop-categories-required', 'categories')
    const paymentMethods = requiredItems(args.paymentMethods, 'shop-payment-methods-required', 'paymentMethods')
    const personalWhatsapp = optionalWhatsapp(args.personalWhatsapp)

    const existing = await ctx.db
      .query('shops')
      .withIndex('by_owner', q => q.eq('ownerId', ownerId))
      .first()

    const now = Date.now()
    // Ownership invariant: `ownerId` is server-derived and written only when the shop is
    // created, never on an edit. The platform-owned bot identifiers are absent from these
    // arguments too, so no later completion can rewrite either of them.
    const operatorFields = { name, description, categories, paymentMethods, personalWhatsapp, updatedAt: now }

    const shopId = existing
      ? (await ctx.db.patch(existing._id, operatorFields), existing._id)
      : await ctx.db.insert('shops', { ...operatorFields, ownerId, wizardCompletedAt: now })

    const saved = await ctx.db.get(shopId)
    if (!saved) throw new ConvexError({ code: 'shop-not-found', field: 'shopId' })
    return toView(saved)
  },
})
