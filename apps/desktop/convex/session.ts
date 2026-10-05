import { queryGeneric, type DataModelFromSchemaDefinition, type QueryBuilder } from 'convex/server'
import { v } from 'convex/values'
import schema from './schema'
import { requireUser } from './lib/requireUser'

// Supported generic registration until authorized deployment codegen supplies
// the schema-specific generated server bindings.
const query: QueryBuilder<DataModelFromSchemaDefinition<typeof schema>, 'public'> = queryGeneric

export const current = query({
  args: {},
  returns: v.object({ userId: v.id('users') }),
  handler: async ctx => ({ userId: await requireUser(ctx) }),
})
