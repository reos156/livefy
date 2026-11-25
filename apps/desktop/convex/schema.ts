import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Clerk owns accounts, credentials and sessions; Convex owns application data and
// authorization. `ownerId` is the server-validated `tokenIdentifier`, never a value
// a client can supply.
export default defineSchema({
  shops: defineTable({
    ownerId: v.string(),
    name: v.string(),
    description: v.string(),
    // Catalogue references, never free text: the screen offers the rows the app reads
    // from `categories` and `paymentMethods`, and the backend checks them on save.
    categorySlugs: v.array(v.string()),
    paymentMethodSlugs: v.array(v.string()),
    // Bre-B's key belongs to the shop, not to the catalogue entry (decision D-B).
    breBKey: v.optional(v.string()),
    // Mandatory contact number: the dial code is a `dialCodes` row and the number is
    // stored as digits only, both validated on save.
    whatsapp: v.object({ dialCode: v.string(), number: v.string() }),
    // Platform-owned identifiers: written outside this app and never accepted from
    // the client, so an operator cannot point the shop at a bot it does not own.
    tiktokBotHandle: v.optional(v.string()),
    whatsappBotNumber: v.optional(v.string()),
    wizardCompletedAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),

  // The configuration catalogues are data, not code (S5): the screen reads them with
  // `catalog.ts` and the seed in `catalogSeed.ts` owns their values.
  categories: defineTable({
    slug: v.string(),
    label: v.string(),
    order: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_order', ['order']),

  paymentMethods: defineTable({
    slug: v.string(),
    label: v.string(),
    description: v.string(),
    requiresKey: v.boolean(),
    order: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_order', ['order']),

  dialCodes: defineTable({
    iso2: v.string(),
    label: v.string(),
    dial: v.string(),
    order: v.number(),
  })
    .index('by_iso2', ['iso2'])
    .index('by_order', ['order']),
})