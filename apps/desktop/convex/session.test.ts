// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from './schema'

const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const session = makeFunctionReference<'query'>('session:current')

describe('trusted Clerk identity contract (not JWT validation)', () => {
  it('rejects anonymous callers', async () => {
    await expect(convexTest(schema, modules).query(session, {})).rejects.toThrow('Unauthorized')
  })
  it('returns only the server-validated tokenIdentifier without a legacy user', async () => {
    const t = convexTest(schema, modules)
    const tokenIdentifier = 'https://organic-snake-7233.clerk.accounts.dev|user_fixture'
    const result = await t.withIdentity({
      issuer: 'https://organic-snake-7233.clerk.accounts.dev',
      subject: 'user_fixture',
      tokenIdentifier,
      email: 'private@example.test',
    }).query(session, {})
    expect(result).toEqual({ tokenIdentifier })
    expect(Object.keys(schema.tables)).toEqual([])
  })
  it('uses the supplied verified identifier rather than reconstructing it', async () => {
    const t = convexTest(schema, modules)
    const result = await t.withIdentity({ subject: 'same-subject', tokenIdentifier: 'opaque-verified-identifier' }).query(session, {})
    expect(result).toEqual({ tokenIdentifier: 'opaque-verified-identifier' })
  })
  it.each(['userId', 'tokenIdentifier', 'email'])('rejects caller-supplied %s', async key => {
    await expect(convexTest(schema, modules).query(session, { [key]: 'forged' })).rejects.toThrow()
  })
})
