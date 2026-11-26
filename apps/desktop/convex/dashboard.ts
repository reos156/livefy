import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import { requireUser } from './lib/requireUser'

// S9: the six states the panel distinguishes. A `null` connection means the operator
// has no live, not a seventh state.
const liveConnection = v.union(
  v.literal('connected'),
  v.literal('reconnecting'),
  v.literal('offline'),
  v.literal('suspended-risk'),
  v.literal('disconnected'),
  v.literal('ended'),
)

// S1 + D-D: the five metrics are final now, so neither this query nor the screen has
// to change shape when their real sources land.
const metrics = v.object({
  activeLives: v.number(),
  // 0..1; the screen formats it as a percentage.
  conversionRate: v.number(),
  newLeads: v.number(),
  pendingLeads: v.number(),
  // Whole Colombian pesos.
  estimatedSales: v.number(),
})

// Read-only aggregate for the operator's dashboard. Ownership comes from the
// authenticated identity only: `args` is empty on purpose, so the client cannot name
// another shop (S3).
export const getDashboardStats = query({
  args: {},
  returns: v.object({
    shopId: v.id('shops'),
    shopName: v.string(),
    liveConnection: v.union(liveConnection, v.null()),
    metrics,
    lives: v.array(v.object({ liveId: v.string(), status: liveConnection })),
  }),
  handler: async ctx => {
    const ownerId = await requireUser(ctx)
    const shop = await ctx.db
      .query('shops')
      .withIndex('by_owner', q => q.eq('ownerId', ownerId))
      .first()
    if (!shop) throw new ConvexError({ code: 'shop-not-found', field: 'shopId' })

    // D-B: this round delivers the dashboard in its empty form only, so no `lives`
    // and no `leads` tables exist yet. Every metric is zero and the list is empty
    // because those sources are absent, not because a number was guessed. R3 (lives)
    // and R4 (leads) fill them without changing the shape above.
    return {
      shopId: shop._id,
      shopName: shop.name,
      liveConnection: null,
      metrics: {
        activeLives: 0,
        newLeads: 0,
        pendingLeads: 0,
        conversionRate: 0,
        estimatedSales: 0,
      },
      lives: [],
    }
  },
})