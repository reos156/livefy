import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'

export const target = Object.freeze({
  app: 'app_3KIbxIkDWq0jwZSzWrleQYbbJZb',
  instance: 'ins_3KIbxKXJ7GOHgO8hpx2JwSMG3jL',
  issuer: 'https://organic-snake-7233.clerk.accounts.dev',
  endpoint: 'https://polite-parrot-887.convex.cloud',
})

// All bodies and responses stay in memory. Never include provider error bodies:
// they may contain credentials, identifiers, or issued tokens.
const safeClasses = new Set(['file_not_found', 'resource_not_found', 'form_param_missing',
  'form_param_format_invalid', 'authentication_invalid', 'authorization_invalid', 'rate_limit_exceeded'])
const safeParameters = new Set(['email_address', 'external_id', 'password', 'private_metadata'])
const classifications = new WeakMap()
const parameters = new WeakMap()
export function errorParameter(error) {
  return error instanceof Error ? parameters.get(error) ?? 'unclassified' : 'unclassified'
}
function failureSummary(stage, error) {
  return { stage, errorClass: classifyError(error), errorParameter: errorParameter(error) }
}
export function classifyError(error) {
  return error instanceof Error ? classifications.get(error) ?? 'unclassified' : 'unclassified'
}
export function transportFailure(error) {
  const codes = new Set()
  const fields = new Set()
  for (const stream of ['stdout', 'stderr']) {
    try {
      const output = error?.[stream]
      if (typeof output !== 'string' && !Buffer.isBuffer(output)) continue
      const parsed = JSON.parse(String(output))
      const candidate = parsed?.error?.code ?? parsed?.errors?.[0]?.code
      if (safeClasses.has(candidate)) {
        codes.add(candidate)
        // Bind metadata to this class, never to an unknown-code sibling.
        const entries = [parsed?.error, ...(Array.isArray(parsed?.errors) ? parsed.errors : [])]
        for (const entry of entries) {
          if (entry?.code !== candidate) continue
          const field = entry?.meta?.param_name
          fields.add(safeParameters.has(field) ? field : 'unclassified')
        }
      }
    } catch { /* Unstructured output is never emitted or classified by message. */ }
  }
  // Conflicting allowlisted classes have no trustworthy stream precedence.
  const code = codes.size === 1 ? codes.values().next().value : 'unclassified'
  const failure = new Error('Clerk operation failed; details suppressed')
  classifications.set(failure, code)
  parameters.set(failure, code !== 'unclassified' && fields.size === 1
    ? fields.values().next().value : 'unclassified')
  return failure
}

function clerk(method, path, body, platform = false) {
  const args = ['api', path, '--app', target.app, '--instance', target.instance, '-X', method]
  if (platform) args.push('--platform')
  // The supported CLI reads piped JSON directly; /dev/stdin is not a file input.
  const options = { encoding: 'utf8', input: body === undefined ? undefined : JSON.stringify(body),
    stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 1024 * 1024 }
  try {
    if (method !== 'GET') execFileSync('clerk', [...args, '--dry-run'], options)
    return JSON.parse(execFileSync('clerk', [...args, '--yes'], options))
  } catch (error) {
    throw transportFailure(error)
  }
}

export function validateClaims(jwt, userId) {
  if (typeof jwt !== 'string' || jwt.split('.').length !== 3) throw new Error('Missing issued JWT')
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
  if (claims.iss !== target.issuer || claims.sub !== userId ||
      !(claims.aud === 'convex' || Array.isArray(claims.aud) && claims.aud.includes('convex'))) {
    throw new Error('Issued token issuer, audience, or subject mismatch')
  }
  return claims
}

export function ownsFixture(user, marker, userId) {
  return typeof userId === 'string' && user?.id === userId &&
    user.external_id === marker && user.private_metadata?.h1_2c_fixture === marker
}

// Conservative base-address syntax only: no aliases, trimming, or normalization.
// This checks syntax, not mailbox ownership; the operator supplies a controlled mailbox.
export function validateFixtureEmail(email) {
  if (typeof email !== 'string' || email.length > 254 ||
      !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email) ||
      /\s/.test(email) || email.split('@')[0].length > 64 ||
      email.split('@')[1].split('.').some(label => label.length > 63)) {
    throw new Error('Explicit valid base fixture email required; details suppressed')
  }
  return email
}

// A transport may be used once only; there are no create retries or fallback users.
const used = new WeakSet()
export async function smoke(api, query, marker = `livefy-h1-2c-${randomUUID()}`, email) {
  validateFixtureEmail(email)
  if (used.has(api)) throw new Error('Fixture transport already used')
  used.add(api)
  if (!/^livefy-h1-2c-[a-zA-Z0-9-]+$/.test(marker)) throw new Error('Invalid fixture marker')
  try {
    if ((await api('GET', '/users/count')).total_count !== 0) throw new Error('DEV users appeared; stopping')
  } catch (error) {
    console.error(JSON.stringify({ failure: failureSummary('initial-inventory', error), cleanupComplete: true, fixtureAttempted: false }))
    throw new Error('DEV preflight failed; details suppressed')
  }
  let userId, sessionId, createAttempted = false, sessionAttempted = false
  let failure, cleanupFailure
  let stage = 'user-create'
  let cleanupStage = 'user-reconcile'
  let validAccepted = false, anonymousRejected = false
  try {
    createAttempted = true
    const user = await api('POST', '/users', {
      external_id: marker,
      email_address: [email],
      password: `Aa1!${randomBytes(24).toString('hex')}`,
      private_metadata: { h1_2c_fixture: marker },
    })
    stage = 'user-ownership'
    userId = user.id
    if (!ownsFixture(user, marker, userId)) throw new Error('Fixture ownership mismatch')
    stage = 'session-create'
    sessionAttempted = true
    const session = await api('POST', '/sessions', { user_id: userId })
    stage = 'session-ownership'
    sessionId = session.id
    if (typeof sessionId !== 'string' || session.user_id !== userId) throw new Error('Session ownership mismatch')
    stage = 'token-create'
    const token = await api('POST', `/sessions/${sessionId}/tokens`, {})
    stage = 'token-claims'
    const claims = validateClaims(token.jwt, userId)
    stage = 'authenticated-query'
    const result = await query(token.jwt)
    if (Object.keys(result).length !== 1 || result.tokenIdentifier !== `${claims.iss}|${claims.sub}`) {
      throw new Error('Backend identity mismatch')
    }
    validAccepted = true
    stage = 'anonymous-query'
    try { await query() } catch (error) {
      if (String(error.message).includes('Unauthorized')) anonymousRejected = true
      else throw new Error('Anonymous request failed for an unrelated reason')
    }
    if (!anonymousRejected) throw new Error('Anonymous access accepted')
  } catch (error) { failure = failureSummary(stage, error) }
  finally {
    // Delete only the exact marker-owned user, even when the live checks fail.
    try {
      if (!userId && createAttempted) {
        const response = await api('GET', `/users?external_id=${encodeURIComponent(marker)}&limit=2`)
        const users = Array.isArray(response) ? response : response.data
        if (!Array.isArray(users) || users.length > 1) throw new Error('Ambiguous fixture reconciliation')
        if (users.length === 1) {
          if (!ownsFixture(users[0], marker, users[0].id)) throw new Error('Reconciled fixture ownership mismatch')
          userId = users[0].id
        }
      }
      if (userId) {
        cleanupStage = 'user-ownership'
        const user = await api('GET', `/users/${userId}`)
        if (!ownsFixture(user, marker, userId)) throw new Error('Cleanup ownership mismatch')
        if (!sessionId && sessionAttempted) {
          cleanupStage = 'session-reconcile'
          const response = await api('GET', `/sessions?user_id=${encodeURIComponent(userId)}&limit=2`)
          const sessions = Array.isArray(response) ? response : response.data
          if (!Array.isArray(sessions) || sessions.length > 1) throw new Error('Ambiguous session reconciliation')
          if (sessions.length === 1) {
            if (sessions[0].user_id !== userId) throw new Error('Reconciled session ownership mismatch')
            sessionId = sessions[0].id
          }
        }
        if (sessionId) {
          cleanupStage = 'session-ownership'
          const session = await api('GET', `/sessions/${sessionId}`)
          if (session.user_id !== userId) throw new Error('Cleanup session ownership mismatch')
          cleanupStage = 'session-revoke'
          const revoked = await api('POST', `/sessions/${sessionId}/revoke`)
          if (revoked.id !== sessionId || revoked.status !== 'revoked') throw new Error('Session revoke not confirmed')
        }
        cleanupStage = 'user-delete'
        const deleted = await api('DELETE', `/users/${userId}`)
        if (deleted.id !== userId || deleted.deleted !== true) throw new Error('User deletion not confirmed')
      }
      cleanupStage = 'cleanup-inventory'
      if ((await api('GET', '/users/count')).total_count !== 0) throw new Error('Cleanup aggregate not empty')
    } catch (error) { cleanupFailure = failureSummary(cleanupStage, error) }
  }
  if (cleanupFailure) {
    console.error(JSON.stringify({ cleanupComplete: false, failure, cleanupFailure }))
    throw new Error('Fixture cleanup incomplete; stop and inspect exact owned fixture')
  }
  if (failure) {
    console.error(JSON.stringify({ cleanupComplete: true, failure, userReconciled: !!userId, sessionRevoked: !!sessionId, usersAfter: 0 }))
    throw new Error('DEV verification failed; details suppressed')
  }
  return { validAccepted, anonymousRejected, sessionRevoked: true, usersAfter: 0,
    wrongIssuer: 'pending: no authorized genuinely signed untrusted issuer source',
    wrongAudience: 'pending: no authorized genuinely signed wrong-audience source' }
}

let mainStage = 'invocation'
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--one-authorized-fixture') throw new Error('Explicit single-fixture invocation required')
  if (['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_ADMIN_KEY', 'CONVEX_SELF_HOSTED_URL'].some(k => process.env[k])) {
    throw new Error('Inherited deployment credentials are not allowed')
  }
  const email = validateFixtureEmail(process.env.H1_2C_FIXTURE_EMAIL)
  mainStage = 'target-metadata'
  const metadata = clerk('GET', `/platform/applications/${target.app}`, undefined, true)
  if (metadata.application_id !== target.app || !metadata.instances.some(
    x => x.instance_id === target.instance && x.environment_type === 'development')) throw new Error('Clerk DEV target mismatch')
  mainStage = 'issuer-discovery'
  const discovery = await (await fetch(`${target.issuer}/.well-known/openid-configuration`)).json()
  if (discovery.issuer !== target.issuer) throw new Error('OIDC issuer mismatch')
  const query = async token => {
    const client = new ConvexHttpClient(target.endpoint)
    if (token) client.setAuth(token)
    return client.query(makeFunctionReference('session:current'), {})
  }
  mainStage = 'smoke'
  console.log(JSON.stringify(await smoke(clerk, query, undefined, email)))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify(failureSummary(mainStage, error)))
    console.error('Stop: inspect cleanup evidence before any separately authorized retry.')
    process.exitCode = 1
  })
}
