// Disposable password-only API proof. All credentials and identifiers stay in memory.
import { randomBytes } from 'node:crypto'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { announce, capturedCli, target, url, verifyTarget } from './activate-auth-dev.mjs'
const current = makeFunctionReference('session:current')
const cleanupName = 'h1SmokeCleanup:removeFixture'
const countsKeys = ['users', 'accounts', 'sessions', 'refreshTokens', 'verificationCodes', 'rateLimits']
function cleanup(email, userId) {
  announce('bounded INTERNAL exact-fixture cleanup')
  const result = capturedCli(['run', '--deployment', target, cleanupName, JSON.stringify({ email, ...(userId ? { userId } : {}) })])
  if (result.status !== 0) throw new Error('Bounded cleanup failed; output withheld')
  let counts
  try { counts = JSON.parse(result.stdout) } catch { throw new Error('Cleanup response invalid; output withheld') }
  if (Object.keys(counts).length !== countsKeys.length || !countsKeys.every(key => Number.isInteger(counts[key]) && counts[key] >= 0)) throw new Error('Cleanup counts invalid')
  console.log(JSON.stringify({ cleanupCounts: counts }))
  return counts
}
async function smoke() {
  verifyTarget()
  const email = `h1-smoke-${randomBytes(16).toString('hex')}@example.invalid`
  const password = randomBytes(32).toString('base64url')
  if (Object.values(cleanup(email)).some(Boolean)) throw new Error('Random fixture collision; stopped before signup')
  const client = new ConvexHttpClient(url, { logger: false })
  const anonymous = new ConvexHttpClient(url, { logger: false })
  let attempted = false, userId, authenticated = false, smokePassed = false
  try {
    announce('create one random disposable password account')
    attempted = true
    const result = await client.action(makeFunctionReference('auth:signIn'), { provider: 'password', params: { flow: 'signUp', email, password } })
    const token = result?.tokens?.token
    if (typeof token !== 'string') throw new Error('No token')
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    if (payload.iss !== `https://${target}.convex.site` || payload.aud !== 'convex' || typeof payload.sub !== 'string') throw new Error('Token target mismatch')
    userId = payload.sub.split('|')[0]
    client.setAuth(token)
    authenticated = true
    const identity = await client.query(current, {})
    if (identity.userId !== userId) throw new Error('Identity mismatch')
    console.log('Authenticated session: PASS (matches signed signup user)')
    let rejected = false
    try { await anonymous.query(current, {}) } catch (error) { rejected = /Unauthorized/.test(String(error)) }
    if (!rejected) throw new Error('Anonymous rejection failed')
    console.log('Anonymous session: PASS (Unauthorized)')
    smokePassed = true
  } catch {
    console.error('Auth smoke failed; raw Auth output withheld')
  } finally {
    if (authenticated) {
      announce('sign out disposable session')
      try { await client.action(makeFunctionReference('auth:signOut'), {}); console.log('Fixture sign-out: PASS') }
      catch { console.error('Fixture sign-out failed; bounded cleanup still required'); smokePassed = false }
      client.clearAuth()
    }
    if (attempted) {
      try {
        const counts = cleanup(email, userId)
        if (smokePassed && (counts.users !== 1 || counts.accounts !== 1)) throw new Error('Fixture identity/deletion count mismatch')
        // Repeat indexed exact-marker lookup proves no fixture user remains.
        if (Object.values(cleanup(email)).some(Boolean)) throw new Error('Residual fixture records')
        console.log('Fixture cleanup: PASS (exact marker verified, user/account removed, repeat zero)')
      } catch {
        console.error('Fixture cleanup: UNCONFIRMED; raw output withheld')
        process.exitCode = 1
        return
      }
    }
  }
  if (!smokePassed) process.exitCode = 1
}
function verifyRemoved() {
  verifyTarget()
  announce('probe removed INTERNAL cleanup with nonexistent random marker')
  const result = capturedCli(['run', '--deployment', target, cleanupName, JSON.stringify({ email: `h1-smoke-${randomBytes(16).toString('hex')}@example.invalid` })])
  if (result.status === 0 || !/Could not find (?:public )?function|Function .*not found/i.test((result.stdout ?? '') + (result.stderr ?? ''))) throw new Error('Cleanup endpoint removal unconfirmed; output withheld')
  console.log('Cleanup endpoint absent: PASS')
}
try {
  if (process.argv[2] === '--verify-removed') verifyRemoved()
  else if (process.argv.length === 2) await smoke()
  else throw new Error('Unsupported smoke option')
} catch {
  console.error('Smoke command failed; sensitive output withheld')
  process.exitCode = 1
}
