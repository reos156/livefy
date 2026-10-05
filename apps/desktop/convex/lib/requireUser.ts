import { getAuthUserId } from '@convex-dev/auth/server'
import type { DataModelFromSchemaDefinition, GenericQueryCtx } from 'convex/server'
import { ConvexError } from 'convex/values'
import schema from '../schema'

type DataModel = DataModelFromSchemaDefinition<typeof schema>

/** Require both a verified identity and a user that still exists. */
export async function requireUser(ctx: GenericQueryCtx<DataModel>) {
  const userId = await getAuthUserId(ctx)
  if (userId === null || await ctx.db.get(userId) === null) {
    throw new ConvexError('Unauthorized')
  }
  return userId
}
