import type { GenericId } from 'convex/values'
import type { MutationCtx as Context } from './_generated/server'
const zero = () => ({ users: 0, accounts: 0, sessions: 0, refreshTokens: 0, verificationCodes: 0, rateLimits: 0 })
function bounded<T>(rows: T[]): T[] {
  if (rows.length > 32) throw new Error('Fixture dependency bound exceeded')
  return rows
}
// Password-only smoke creates no OAuth verifiers (Auth 0.0.96 handleCredentials).
// Keep this tested helper after removing the temporary registered endpoint.
export async function cleanupFixture(ctx: Context, args: { email: string; userId?: GenericId<'users'> }) {
  if (!/^h1-smoke-[a-f0-9]{32}@example\.invalid$/.test(args.email)) throw new Error('Nonfixture marker refused')
  const user = args.userId ? await ctx.db.get(args.userId) : await ctx.db.query('users').withIndex('email', q => q.eq('email', args.email)).unique()
  if (user === null) return zero()
  if (user.email !== args.email || user.name !== undefined || user.phone !== undefined || user.image !== undefined || user.isAnonymous) throw new Error('Fixture identity mismatch')
  const accounts = bounded(await ctx.db.query('authAccounts').withIndex('userIdAndProvider', q => q.eq('userId', user._id)).take(33))
  if (accounts.some(a => a.provider !== 'password' || a.providerAccountId !== args.email)) throw new Error('Nonfixture account refused')
  const sessions = bounded(await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', user._id)).take(33))
  const refreshTokens = []
  for (const session of sessions) refreshTokens.push(...bounded(await ctx.db.query('authRefreshTokens').withIndex('sessionId', q => q.eq('sessionId', session._id)).take(33)))
  const verificationCodes = []
  const rateLimits = []
  for (const account of accounts) {
    verificationCodes.push(...bounded(await ctx.db.query('authVerificationCodes').withIndex('accountId', q => q.eq('accountId', account._id)).take(33)))
    rateLimits.push(...bounded(await ctx.db.query('authRateLimits').withIndex('identifier', q => q.eq('identifier', account._id)).take(33)))
  }
  for (const row of [...refreshTokens, ...verificationCodes, ...rateLimits, ...sessions, ...accounts]) await ctx.db.delete(row._id)
  await ctx.db.delete(user._id)
  return { users: 1, accounts: accounts.length, sessions: sessions.length, refreshTokens: refreshTokens.length, verificationCodes: verificationCodes.length, rateLimits: rateLimits.length }
}

// No registered Convex function remains. This helper is retained for local regression tests.
