import type { DataModelFromSchemaDefinition, GenericQueryCtx } from 'convex/server'
import { ConvexError } from 'convex/values'
import schema from '../schema'

type DataModel = DataModelFromSchemaDefinition<typeof schema>

/** Return only Convex's server-validated identity, never a caller-provided key. */
export async function requireUser(ctx: GenericQueryCtx<DataModel>) {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw new ConvexError('Unauthorized')
  return identity.tokenIdentifier
}
