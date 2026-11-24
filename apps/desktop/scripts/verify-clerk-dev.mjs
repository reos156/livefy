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

// The only audience and issuer this script accepts. `applicationID: 'convex'`
// in convex/auth.config.ts is what enforces the audience server-side.
export const expectations = Object.freeze({ issuer: target.issuer, audience: 'convex' })

// Decodes a JWT payload into claims. This is deliberately not a signature check:
// this script cannot and must not impersonate the JWKS verifier that Convex is.
export function decodeClaims(jwt) {
  if (typeof jwt !== 'string' || jwt.split('.').length !== 3) throw new Error('Missing issued JWT')
  let claims
  try { claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()) } catch {
    throw new Error('Unreadable token claims')
  }
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) {
    throw new Error('Unreadable token claims')
  }
  return claims
}

// Answers whether decoded claims match the configured issuer and audience.
export function claimVerdict(claims, expected = expectations) {
  const audience = claims && typeof claims === 'object' ? claims.aud : undefined
  return {
    issuerMatches: claims?.iss === expected.issuer,
    audienceMatches: audience === expected.audience ||
      (Array.isArray(audience) && audience.includes(expected.audience)),
  }
}

export function validateClaims(jwt, userId) {
  const claims = decodeClaims(jwt)
  const { issuerMatches, audienceMatches } = claimVerdict(claims)
  if (!issuerMatches || !audienceMatches || typeof userId !== 'string' || claims.sub !== userId) {
    throw new Error('Issued token issuer, audience, or subject mismatch')
  }
  return claims
}

// The two error texts that mean "the deployment refused this token's
// authentication". Convex answers a token it will not accept with a 401 whose body
// this client surfaces verbatim as the error message: either the bare
// `Unauthorized` refusal or the structured `{"code":"NoAuthProvider",...}` body
// measured on DEV for a genuinely Clerk-signed token whose `aud` is not `convex`.
// Nothing else is a refusal: an unknown code, a prose message that merely mentions
// one, a transport failure, a 500-class body and any non-Error thrown value all stay
// inconclusive, so they abort the run instead of producing a security verdict.
export const authenticationRefusals = Object.freeze(['Unauthorized', 'NoAuthProvider'])

// The compared text: a structured body is judged by its `code` value only, never by
// the prose of its `message` field; a bare refusal is compared whole.
function refusalCode(message) {
  const text = message.trim()
  try {
    const parsed = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return typeof parsed.code === 'string' ? parsed.code : undefined
    }
  } catch { /* Not a structured body: compared as plain text below. */ }
  return text
}

export function isAuthenticationRefusal(error) {
  return error instanceof Error && typeof error.message === 'string' &&
    authenticationRefusals.includes(refusalCode(error.message))
}

// S3: a negative that was not actually exercised stays explicitly pending. These
// exact strings must not be replaced by a pass. The only exception is the attested
// S9 mint below, which reports its own distinct verdict and never reuses these.
export const pendingNegatives = Object.freeze({
  issuer: 'pending: no authorized genuinely signed untrusted issuer source',
  audience: 'pending: no authorized genuinely signed wrong-audience source',
})

// S9: a negative may be reported as passed only from a token this script minted
// itself from the authorized instance through a named JWT template. That mint
// attests provenance: Clerk signs the token with the trusted key of the configured
// issuer, so the only difference from an accepted token is `aud`. The verdict is
// deliberately not the bare `rejected:` prefix, and it is unreachable from any
// environment-supplied token.
export const attestedVerdicts = Object.freeze({
  wrongAudience: 'rejected: attested wrong-audience token refused by the query',
})

// The template name is an operator input with no default: a built-in default could
// point a different instance's template at this run. An unset or empty variable
// leaves the attested negative unrequested, which keeps the audience gate pending
// exactly as S3 requires.
export const attestedTemplateVariable = 'H1_2C_WRONG_AUDIENCE_TEMPLATE'

export function validateTemplateName(template) {
  if (typeof template !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(template)) {
    throw new Error('Explicit JWT template name required for the attested negative; details suppressed')
  }
  return template
}

export function attestedSource(env = process.env) {
  const template = env[attestedTemplateVariable]
  if (template === undefined || template === '') return {}
  return { template: validateTemplateName(template) }
}

// A foreign audience is present, non-empty, and never the configured one. This is
// the guard that stops a template still carrying `aud: convex` (a configuration
// error) from masquerading as evidence.
function carriesForeignAudience(audience) {
  const values = Array.isArray(audience) ? audience : [audience]
  return values.length > 0 && values.every(value => typeof value === 'string' && value !== '')
}

// Mints the wrong-audience token from the fixture session through the named
// template and exercises it. Every precondition fails closed: a missing or invalid
// template, a failed mint, a minted token that is not foreign in `aud`, and a query
// that accepts it all abort the run instead of reporting a verdict.
export async function attestedWrongAudience(query, api, sessionId, template) {
  const name = validateTemplateName(template)
  // Non-GET: the shared Clerk helper dry-runs this path before the real request.
  const minted = await api('POST', `/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(name)}`, {})
  const claims = decodeClaims(minted?.jwt)
  const { issuerMatches, audienceMatches } = claimVerdict(claims)
  if (!issuerMatches) throw new Error('Attested wrong-audience token was not issued by the configured issuer')
  if (audienceMatches || !carriesForeignAudience(claims.aud)) {
    throw new Error('Attested wrong-audience token does not carry a foreign audience')
  }
  try {
    await query(minted.jwt)
  } catch (error) {
    if (!isAuthenticationRefusal(error)) {
      throw new Error('Attested wrong-audience token rejection was inconclusive')
    }
    return attestedVerdicts.wrongAudience
  }
  throw new Error('Attested wrong-audience token was accepted')
}

// Externally supplied tokens of untrusted provenance. This script never mints them
// on this path and never verifies a signature.
export function untrustedSources(env = process.env) {
  return {
    wrongIssuer: env.H1_2C_UNTRUSTED_ISSUER_JWT || undefined,
    wrongAudience: env.H1_2C_UNTRUSTED_AUDIENCE_JWT || undefined,
  }
}

// A supplied token of unverified provenance cannot close S1/S2. Convex refuses a
// forged or locally minted token because its signature does not match the JWKS of
// the configured domain, and that refusal is indistinguishable from a genuine
// issuer or audience rejection. The refusal is therefore recorded as a diagnostic
// while the gate stays explicitly pending, and no supplied token is ever reported
// as a pass. The attested mint in `attestedWrongAudience` is the only path that can
// close a negative, and it never accepts an input from here.
function unauditedNegative(kind) {
  const base = kind === 'issuer' ? pendingNegatives.issuer : pendingNegatives.audience
  return `${base} (refused by the query, provenance unverified)`
}

// A supplied token is exercised against the query whenever it carries exactly the
// intended mismatch. Anything else is a failure, never a pass, and a refusal never
// clears the pending state above.
async function exerciseNegative(query, jwt, kind) {
  if (typeof jwt !== 'string' || jwt === '') {
    return kind === 'issuer' ? pendingNegatives.issuer : pendingNegatives.audience
  }
  const { issuerMatches, audienceMatches } = claimVerdict(decodeClaims(jwt))
  const attributable = kind === 'issuer' ? !issuerMatches && audienceMatches : issuerMatches && !audienceMatches
  if (!attributable) {
    const expected = kind === 'issuer' ? 'audience' : 'issuer'
    throw new Error(`Supplied untrusted ${kind} token does not carry a foreign ${kind} with the expected ${expected}`)
  }
  try {
    await query(jwt)
  } catch (error) {
    if (!isAuthenticationRefusal(error)) {
      throw new Error(`Untrusted ${kind} token rejection was inconclusive`)
    }
    return unauditedNegative(kind)
  }
  throw new Error(`Untrusted ${kind} token was accepted`)
}

export async function untrustedNegatives(query, sources = {}) {
  return {
    wrongIssuer: await exerciseNegative(query, sources.wrongIssuer, 'issuer'),
    wrongAudience: await exerciseNegative(query, sources.wrongAudience, 'audience'),
  }
}

export function ownsFixture(user, marker, userId) {
  return typeof userId === 'string' && user?.id === userId &&
    user.external_id === marker && user.private_metadata?.h1_2c_fixture === marker
}

// S10: the inventory is a baseline, not a requirement of emptiness. Only a
// non-negative integer count is usable; anything else fails closed, because a run
// that cannot read the baseline cannot prove the cleanup delta.
export function usableUserCount(response) {
  const count = response?.total_count
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('User count read did not yield a usable number')
  }
  return count
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
export async function smoke(api, query, marker = `livefy-h1-2c-${randomUUID()}`, email, untrusted = {}, attested = {}) {
  validateFixtureEmail(email)
  // The attested mint and an environment-supplied audience token are two different
  // sources for one negative; choosing one silently would misreport provenance.
  if (attested.template && untrusted.wrongAudience) {
    throw new Error('Conflicting wrong-audience sources; use the attested template alone')
  }
  if (used.has(api)) throw new Error('Fixture transport already used')
  used.add(api)
  if (!/^livefy-h1-2c-[a-zA-Z0-9-]+$/.test(marker)) throw new Error('Invalid fixture marker')
  // S10: the preflight records the initial inventory instead of requiring an empty
  // instance. A failed or unusable read still fails closed here, before any fixture
  // is created, so a preflight failure never has anything to clean up.
  let usersBefore
  try {
    usersBefore = usableUserCount(await api('GET', '/users/count'))
  } catch (error) {
    console.error(JSON.stringify({ failure: failureSummary('initial-inventory', error), cleanupComplete: true, fixtureAttempted: false }))
    throw new Error('DEV preflight failed; details suppressed')
  }
  let userId, sessionId, createAttempted = false, sessionAttempted = false
  let failure, cleanupFailure
  let usersAfter, fixtureAbsent
  let stage = 'user-create'
  let cleanupStage = 'user-reconcile'
  let validAccepted = false, anonymousRejected = false
  let reported = { wrongIssuer: pendingNegatives.issuer, wrongAudience: pendingNegatives.audience }
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
    // S9: the only negative this script may report as passed, because here it
    // controls and attests the token's provenance.
    stage = 'attested-negative'
    const attestedAudience = attested.template
      ? await attestedWrongAudience(query, api, sessionId, attested.template)
      : undefined
    // Externally supplied untrusted tokens stay pending (S3); the fixture token is
    // never reused as a negative.
    stage = 'untrusted-negatives'
    reported = await untrustedNegatives(query, untrusted)
    if (attestedAudience) reported = { ...reported, wrongAudience: attestedAudience }
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
      // S10: one verdict with two halves, both read before either is judged. The
      // count delta alone is not proof and the absent-fixture read alone is not
      // proof, so a run fails unless the inventory is back to its baseline AND the
      // owned fixture is absent by external_id.
      cleanupStage = 'cleanup-inventory'
      usersAfter = usableUserCount(await api('GET', '/users/count'))
      const countRestored = usersAfter === usersBefore
      // Read the absent-fixture half even when the count half already failed: the
      // operator needs both halves of the verdict, not only the first failure.
      cleanupStage = 'cleanup-fixture-absence'
      const response = await api('GET', `/users?external_id=${encodeURIComponent(marker)}&limit=2`)
      const users = Array.isArray(response) ? response : response.data
      if (!Array.isArray(users) || users.length > 1) throw new Error('Ambiguous fixture absence reconciliation')
      fixtureAbsent = users.length === 0
      if (!countRestored) {
        cleanupStage = 'cleanup-inventory'
        throw new Error('Cleanup inventory delta is not zero')
      }
      if (!fixtureAbsent) throw new Error('Owned fixture user survived cleanup')
    } catch (error) { cleanupFailure = failureSummary(cleanupStage, error) }
  }
  if (cleanupFailure) {
    // Say plainly which half of the S10 verdict failed: a restored count, an absent
    // fixture, neither, or a half that could not be read at all (`null`).
    console.error(JSON.stringify({ cleanupComplete: false, failure, cleanupFailure,
      cleanupChecks: { countRestored: usersAfter === undefined ? null : usersAfter === usersBefore,
        fixtureAbsent: fixtureAbsent === undefined ? null : fixtureAbsent } }))
    throw new Error('Fixture cleanup incomplete; stop and inspect exact owned fixture')
  }
  if (failure) {
    console.error(JSON.stringify({ cleanupComplete: true, failure, userReconciled: !!userId, sessionRevoked: !!sessionId, usersBefore, usersAfter }))
    throw new Error('DEV verification failed; details suppressed')
  }
  return { validAccepted, anonymousRejected, sessionRevoked: true, usersBefore, usersAfter, ...reported }
}

// Production query seam: the only place a token is handed to the backend.
function convexQuery(token) {
  const client = new ConvexHttpClient(target.endpoint)
  if (token) client.setAuth(token)
  return client.query(makeFunctionReference('session:current'), {})
}

let mainStage = 'invocation'
// `io` is the testable seam for the invocation contract: argv, environment and the
// three transports. Real runs use process.argv/process.env and the live transports.
export async function main(io = {}) {
  const argv = io.argv ?? process.argv
  const env = io.env ?? process.env
  const dispatch = io.clerk ?? clerk
  const fetchImpl = io.fetch ?? fetch
  const query = io.query ?? convexQuery
  mainStage = 'invocation'
  if (argv.length !== 3 || argv[2] !== '--one-authorized-fixture') throw new Error('Explicit single-fixture invocation required')
  if (['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_ADMIN_KEY', 'CONVEX_SELF_HOSTED_URL'].some(k => env[k])) {
    throw new Error('Inherited deployment credentials are not allowed')
  }
  const email = validateFixtureEmail(env.H1_2C_FIXTURE_EMAIL)
  const attested = attestedSource(env)
  mainStage = 'target-metadata'
  const metadata = dispatch('GET', `/platform/applications/${target.app}`, undefined, true)
  if (metadata.application_id !== target.app || !metadata.instances.some(
    x => x.instance_id === target.instance && x.environment_type === 'development')) throw new Error('Clerk DEV target mismatch')
  mainStage = 'issuer-discovery'
  const discovery = await (await fetchImpl(`${target.issuer}/.well-known/openid-configuration`)).json()
  if (discovery.issuer !== target.issuer) throw new Error('OIDC issuer mismatch')
  mainStage = 'smoke'
  console.log(JSON.stringify(await smoke(dispatch, query, undefined, email, untrustedSources(env), attested)))
}

// The module-level exit contract: one sanitized summary line plus the stop line on
// stderr and a failing exit code, never a success line.
export async function runMain(invoke = main) {
  try { await invoke() } catch (error) {
    console.error(JSON.stringify(failureSummary(mainStage, error)))
    console.error('Stop: inspect cleanup evidence before any separately authorized retry.')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runMain()
}
