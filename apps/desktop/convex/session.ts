import { query } from './_generated/server'
import { v } from 'convex/values'
import { requireUser } from './lib/requireUser'

export const current = query({
  args: {},
  returns: v.object({ tokenIdentifier: v.string() }),
  handler: async ctx => ({ tokenIdentifier: await requireUser(ctx) }),
})
