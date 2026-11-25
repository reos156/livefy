import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { CATEGORIES, DIAL_CODES, PAYMENT_METHODS } from './catalogSeed'

// Catalogues the configuration screen offers. Every row comes from the database, so
// adding a category, a payment method or a country is a data change, never a code
// change. The public shape carries only what the screen renders; `order` stays inside
// the query and is applied by the index.
export const categories = query({
  args: {},
  returns: v.array(v.object({ slug: v.string(), label: v.string() })),
  handler: async ctx => {
    const rows = await ctx.db.query('categories').withIndex('by_order').collect()
    return rows.map(({ slug, label }) => ({ slug, label }))
  },
})

export const paymentMethods = query({
  args: {},
  returns: v.array(v.object({
    slug: v.string(),
    label: v.string(),
    description: v.string(),
    requiresKey: v.boolean(),
  })),
  handler: async ctx => {
    const rows = await ctx.db.query('paymentMethods').withIndex('by_order').collect()
    return rows.map(({ slug, label, description, requiresKey }) => ({ slug, label, description, requiresKey }))
  },
})

export const dialCodes = query({
  args: {},
  returns: v.array(v.object({ iso2: v.string(), label: v.string(), dial: v.string() })),
  handler: async ctx => {
    const rows = await ctx.db.query('dialCodes').withIndex('by_order').collect()
    return rows.map(({ iso2, label, dial }) => ({ iso2, label, dial }))
  },
})

// Internal and argument-free on purpose: the values are the ones this module's seed
// carries, so nothing outside the app can rewrite a catalogue.
//
// Upserts by natural key (`slug` / `iso2`), which makes a second run patch the same
// rows instead of adding duplicates, and lets a corrected label reach every row.
export const seedCatalog = internalMutation({
  args: {},
  returns: v.object({ categories: v.number(), paymentMethods: v.number(), dialCodes: v.number() }),
  handler: async ctx => {
    for (const row of CATEGORIES) {
      const existing = await ctx.db
        .query('categories')
        .withIndex('by_slug', q => q.eq('slug', row.slug))
        .first()
      if (existing) await ctx.db.patch(existing._id, row)
      else await ctx.db.insert('categories', row)
    }
    for (const row of PAYMENT_METHODS) {
      const existing = await ctx.db
        .query('paymentMethods')
        .withIndex('by_slug', q => q.eq('slug', row.slug))
        .first()
      if (existing) await ctx.db.patch(existing._id, row)
      else await ctx.db.insert('paymentMethods', row)
    }
    for (const row of DIAL_CODES) {
      const existing = await ctx.db
        .query('dialCodes')
        .withIndex('by_iso2', q => q.eq('iso2', row.iso2))
        .first()
      if (existing) await ctx.db.patch(existing._id, row)
      else await ctx.db.insert('dialCodes', row)
    }
    return { categories: CATEGORIES.length, paymentMethods: PAYMENT_METHODS.length, dialCodes: DIAL_CODES.length }
  },
})