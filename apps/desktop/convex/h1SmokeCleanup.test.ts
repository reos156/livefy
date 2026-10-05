// @vitest-environment node
/// <reference types="vite/client" />
import { expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { cleanupFixture } from './h1SmokeCleanup'
const modules = { ...import.meta.glob('./**/*.ts'), './_generated/schema.ts': () => import('./schema') }
const email = `h1-smoke-${'a'.repeat(32)}@example.invalid`
it('refuses nonfixture and wrong marker without changing users', async () => {
  const t = convexTest(schema, modules)
  const id = await t.run(ctx => ctx.db.insert('users', { email }))
  for (const marker of ['real@example.com', `h1-smoke-${'b'.repeat(32)}@example.invalid`]) {
    await expect(t.run(ctx => cleanupFixture(ctx, { email: marker, userId: id }))).rejects.toThrow()
  }
  expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull()
})
it('refuses other providers and oversized dependency sets before deletion', async () => {
  for (const scenario of ['provider', 'bound']) {
    const t = convexTest(schema, modules)
    const id = await t.run(async ctx => {
      const user = await ctx.db.insert('users', { email })
      if (scenario === 'provider') await ctx.db.insert('authAccounts', { userId: user, provider: 'oauth', providerAccountId: email })
      else for (let i = 0; i < 33; i++) await ctx.db.insert('authSessions', { userId: user, expirationTime: Date.now() + 60000 })
      return user
    })
    await expect(t.run(ctx => cleanupFixture(ctx, { email, userId: id }))).rejects.toThrow()
    expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull()
  }
})
it('deletes exact fixture dependencies only and proves idempotence', async () => {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ctx => {
    const user = await ctx.db.insert('users', { email })
    const other = await ctx.db.insert('users', { email: `h1-smoke-${'b'.repeat(32)}@example.invalid` })
    const account = await ctx.db.insert('authAccounts', { userId: user, provider: 'password', providerAccountId: email })
    const session = await ctx.db.insert('authSessions', { userId: user, expirationTime: Date.now() + 60000 })
    const refresh = await ctx.db.insert('authRefreshTokens', { sessionId: session, expirationTime: Date.now() + 60000 })
    const code = await ctx.db.insert('authVerificationCodes', { accountId: account, provider: 'password', code: 'test', expirationTime: Date.now() + 60000 })
    const limit = await ctx.db.insert('authRateLimits', { identifier: account, lastAttemptTime: Date.now(), attemptsLeft: 9 })
    const otherAccount = await ctx.db.insert('authAccounts', { userId: other, provider: 'password', providerAccountId: 'other' })
    return { user, other, account, session, refresh, code, limit, otherAccount }
  })
  expect(await t.run(ctx => cleanupFixture(ctx, { email, userId: ids.user }))).toEqual({ users: 1, accounts: 1, sessions: 1, refreshTokens: 1, verificationCodes: 1, rateLimits: 1 })
  await t.run(async ctx => {
    for (const id of [ids.user, ids.account, ids.session, ids.refresh, ids.code, ids.limit]) expect(await ctx.db.get(id)).toBeNull()
    expect(await ctx.db.get(ids.other)).not.toBeNull()
    expect(await ctx.db.get(ids.otherAccount)).not.toBeNull()
  })
  expect((await t.run(ctx => cleanupFixture(ctx, { email, userId: ids.user }))).users).toBe(0)
})
