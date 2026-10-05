// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from './schema'

// convex-test uses an _generated key only to locate the module root.
// Alias the real schema loader without creating fictitious generated files.
const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const session = makeFunctionReference<'query'>('session:current')
describe('trusted session', () => {
  it('rejects anonymous callers', async () => {
    await expect(convexTest(schema, modules).query(session, {})).rejects.toThrow('Unauthorized')
  })
  it('returns only the existing authenticated user ID', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(ctx => ctx.db.insert('users', { email: 'private@example.test' }))
    const result = await t.withIdentity({ subject: `${id}|test-session` }).query(session, {})
    expect(result).toEqual({ userId: id })
  })
  it('rejects a deleted user identity', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async ctx => {
      const id = await ctx.db.insert('users', {})
      await ctx.db.delete(id)
      return id
    })
    await expect(t.withIdentity({ subject: `${id}|test-session` }).query(session, {})).rejects.toThrow('Unauthorized')
  })
  it('rejects client-supplied user IDs', async () => {
    await expect(convexTest(schema, modules).query(session, { userId: 'forged' })).rejects.toThrow()
  })
})
