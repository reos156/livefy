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
    categories: v.array(v.string()),
    paymentMethods: v.array(v.string()),
    personalWhatsapp: v.optional(v.string()),
    // Platform-owned identifiers: written outside this app and never accepted from
    // the client, so an operator cannot point the shop at a bot it does not own.
    tiktokBotHandle: v.optional(v.string()),
    whatsappBotNumber: v.optional(v.string()),
    wizardCompletedAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),
})
