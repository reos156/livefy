// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { attestedSource, attestedTemplateVariable, attestedVerdicts, attestedWrongAudience, authenticationRefusals, claimVerdict, classifyError, decodeClaims, errorParameter, expectations, isAuthenticationRefusal, main, pendingNegatives, runMain, smoke, target, transportFailure, untrustedNegatives, untrustedSources, usableUserCount, validateClaims, validateFixtureEmail } from './verify-clerk-dev.mjs'

const email = 'fixture@example.test'
const marker = 'livefy-h1-2c-test'
// A decodable, deliberately unsigned token. Its trailing segment is opaque here:
// this script decodes claims and must never claim to verify a signature.
function encoded(claims: unknown, signature = 'unverified-signature') {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`
}
// `base` is the pre-existing inventory of the instance: 0 for the historical empty
// instance, 2 for the DEV instance that holds real users (S10).
function fixture(lost: 'user' | 'session' | 'none' = 'none', foreign = false,
  mint: { aud?: unknown; jwt?: string; fail?: boolean } = {}, base = 0) {
  let user: any, session: any
  const calls: string[] = []
  const api = async (method: string, path: string, body?: any): Promise<any> => {
    calls.push(`${method} ${path}`)
    if (path === '/users/count') return { total_count: base + (user ? 1 : 0) }
    if (method === 'POST' && path === '/users') {
      user = { id: 'user_test', external_id: body.external_id, private_metadata: body.private_metadata }
      if (foreign) user.private_metadata = {}
      if (lost === 'user') throw new Error('response lost')
      return user
    }
    if (method === 'GET' && path.startsWith('/users?')) return user ? [user] : []
    if (method === 'GET' && path === '/users/user_test') return user
    if (method === 'POST' && path === '/sessions') {
      session = { id: 'sess_test', user_id: body.user_id, status: 'active' }
      if (lost === 'session') throw new Error('response lost')
      return session
    }
    if (method === 'GET' && path.startsWith('/sessions?')) return session ? [session] : []
    if (method === 'GET' && path === '/sessions/sess_test') return session
    if (path === '/sessions/sess_test/tokens') return { jwt: `header.${Buffer.from(JSON.stringify({ iss: target.issuer, aud: 'convex', sub: 'user_test' })).toString('base64url')}.signature` }
    if (path.startsWith('/sessions/sess_test/tokens/')) {
      // The attesting mint: a JWT template token, distinct from the session token.
      if (mint.fail) throw new Error('mint failed')
      if (mint.jwt) return { jwt: mint.jwt }
      return { jwt: encoded({ iss: target.issuer, aud: 'aud' in mint ? mint.aud : attestedTemplate, sub: 'user_test' }) }
    }
    if (path === '/sessions/sess_test/revoke') { session.status = 'revoked'; return session }
    if (method === 'DELETE' && path === '/users/user_test') { user = undefined; return { id: 'user_test', deleted: true } }
    throw new Error(`Unexpected operation ${method} ${path}`)
  }
  return { api, calls, user: () => user, session: () => session }
}
const query = async (token?: string) => {
  if (!token) throw new Error('Unauthorized')
  return { tokenIdentifier: `${target.issuer}|user_test` }
}

// Mirrors the audience/issuer control this feature expects the backend to apply.
// It is a mock of the query seam only; it is never evidence about the configured
// Convex deployment (that remains T5).
function guarded(options: { refusal?: string; acceptAll?: boolean } = {}) {
  const seen: string[] = []
  const query = async (token?: string) => {
    if (!token) throw new Error('Unauthorized')
    seen.push(token)
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    if (options.acceptAll) return { tokenIdentifier: `${claims.iss}|${claims.sub}` }
    const { issuerMatches, audienceMatches } = claimVerdict(claims)
    if (!issuerMatches || !audienceMatches) throw new Error(options.refusal ?? 'Unauthorized')
    return { tokenIdentifier: `${claims.iss}|${claims.sub}` }
  }
  return { query, seen }
}

// Genuinely decodable tokens of untrusted provenance carrying exactly one mismatch.
const untrustedIssuerToken = encoded({ iss: 'https://foreign-snake.clerk.accounts.dev', aud: 'convex', sub: 'user_other' })
const untrustedAudienceToken = encoded({ iss: target.issuer, aud: 'other', sub: 'user_test' })

// S9 attested path fixtures. The template name is always supplied by the test, as
// the operator must supply it: the script has no default template.
const attestedTemplate = 'livefy-h1-2c-wrong-aud'
const attestedMintedToken = encoded({ iss: target.issuer, aud: attestedTemplate, sub: 'user_test' })
const attestedVerdict = 'rejected: attested wrong-audience token refused by the query'
// The two refusal bodies a Convex deployment produces for a token it will not
// accept. `NoAuthProvider` is the body measured on DEV for a genuinely Clerk-signed
// token whose `aud` is not `convex`; `Unauthorized` is the bare refusal.
const noAuthProviderRefusal = JSON.stringify({ code: 'NoAuthProvider',
  message: `No auth provider found matching the given token. Check that your JWT's issuer and audience match one of your configured providers: [OIDC(domain=${target.issuer}, app_id=convex)]` })
const documentedRefusals = [
  ['the measured NoAuthProvider body', noAuthProviderRefusal],
  ['a bare Unauthorized refusal', 'Unauthorized'],
] as const
// Everything that is NOT an authentication refusal: a network failure, a
// 500-class body, an unrecognised refusal body, and an empty error.
const nonRefusals = [
  ['a network error', 'socket hang up'],
  ['a 500-class failure', JSON.stringify({ status: 'error', errorMessage: 'InternalServerError' })],
  ['an unrecognised refusal body', JSON.stringify({ code: 'InternalServerError', message: 'boom' })],
  ['an empty refusal', ''],
] as const

describe('runtime fixture email preflight', () => {
  it('forwards the supplied address unchanged and preserves ownership and cleanup', async () => {
    const f = fixture()
    const supplied = 'Synthetic.Base@example.test'
    const api = vi.fn(f.api)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await smoke(api, query, marker, supplied)
      const body = api.mock.calls.find(([method, path]) => method === 'POST' && path === '/users')?.[2]
      expect(body.email_address).toEqual([supplied])
      expect(body.external_id).toBe(marker)
      expect(body.private_metadata).toEqual({ h1_2c_fixture: marker })
      expect(f.user()).toBeUndefined()
      expect(f.session()?.status).toBe('revoked')
      expect(JSON.stringify([...log.mock.calls, ...errorLog.mock.calls])).not.toContain(supplied)
    } finally { log.mockRestore(); errorLog.mockRestore() }
  })
  it.each([undefined, '', 'missing-at', 'a@', '@example.test', 'a b@example.test',
    'a@example', 'a+alias@example.test', ' a@example.test', 'a@example.test\n', 'a..b@example.test'])
  ('rejects missing or malformed input with a fixed private error before any API call (%#)', async input => {
    const api = vi.fn()
    expect(() => validateFixtureEmail(input)).toThrow('Explicit valid base fixture email required; details suppressed')
    await expect(smoke(api, query, marker, input)).rejects.toThrow('Explicit valid base fixture email required; details suppressed')
    expect(api).not.toHaveBeenCalled()
    try { validateFixtureEmail(input) } catch (error) {
      expect((error as Error).message).toBe('Explicit valid base fixture email required; details suppressed')
      expect(JSON.stringify(error)).toBe('{}')
    }
  })
})

describe('safe failure diagnostics', () => {
  it('projects an allowlisted parameter through the actual sanitized failure summary', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = async (method: string, path: string) => {
      if (method === 'POST') throw transportFailure({ stdout: JSON.stringify({ errors: [{
        code: 'form_param_format_invalid', meta: { param_name: 'email_address', value: 'sk_test_secret' },
        message: `user_secret sess_secret ${email}`,
      }] }) })
      return path === '/users/count' ? { total_count: 0 } : []
    }
    try {
      await expect(smoke(api, query, marker, email)).rejects.toThrow('details suppressed')
      const output = log.mock.calls.flat().join('\n')
      expect(JSON.parse(output).failure).toEqual({ stage: 'user-create', errorClass: 'form_param_format_invalid', errorParameter: 'email_address' })
      expect(output).not.toMatch(/sk_test_secret|user_secret|sess_secret|param_name|value|message/)
      expect(output).not.toContain(email)
    } finally { log.mockRestore() }
  })
  it('accepts only exact field names with conservative stream and entry conflicts', () => {
    const entry = (param_name: unknown, code = 'form_param_format_invalid') => ({ code,
      meta: { param_name, value: 'sk_test_secret' }, message: 'user_secret sess_secret' })
    const stream = (...errors: any[]) => JSON.stringify({ errors })
    for (const field of ['email_address', 'external_id', 'password', 'private_metadata']) {
      for (const key of ['stdout', 'stderr']) {
        const failure = transportFailure({ [key]: Buffer.from(stream(entry(field))) })
        expect(errorParameter(failure)).toBe(field)
        expect(`${failure.stack} ${JSON.stringify(failure)}`).not.toMatch(/sk_test_secret|user_secret|sess_secret|param_name|value/)
      }
    }
    const cases: [any, string][] = [
      [{ stdout: stream(entry('password')), stderr: stream(entry('password')) }, 'password'],
      [{ stdout: stream(entry('password')), stderr: stream(entry('email_address')) }, 'unclassified'],
      [{ stdout: stream(entry('password')), stderr: stream(entry('password', 'authorization_invalid')) }, 'unclassified'],
      [{ stdout: stream(entry('password'), entry('external_id')) }, 'unclassified'],
      [{ stdout: stream(entry(undefined), entry('password', 'unknown_code')) }, 'unclassified'],
      [{ stdout: stream(entry('password'), entry('email_address', 'unknown_code')) }, 'password'],
      [{ stdout: stream(entry('password')), stderr: 'malformed sk_test_secret' }, 'password'],
      [{ stdout: JSON.stringify({ error: entry('private_metadata') }) }, 'private_metadata'],
      [{ stdout: JSON.stringify({ error: { code: 'form_param_missing' } }) }, 'unclassified'],
    ]
    for (const field of [undefined, null, 1, {}, ['password'], 'unknown', 'email_address[0]',
      'private_metadata.h1_2c_fixture', 'Password', ' password', 'sk_test_secret', 'user_secret']) {
      cases.push([{ stdout: stream(entry(field)) }, 'unclassified'])
    }
    for (const [input, expected] of cases) {
      const failure = transportFailure(input)
      expect(errorParameter(failure)).toBe(expected)
      expect(JSON.stringify({ errorClass: classifyError(failure), errorParameter: errorParameter(failure), failure }) + failure.stack)
        .not.toMatch(/sk_test_secret|user_secret|sess_secret|unknown_code|param_name|h1_2c_fixture/)
    }
    expect(errorParameter(new Error('password'))).toBe('unclassified')
  })
  it('classifies synthetic stdout-only structured API failures', () => {
    expect(classifyError(transportFailure({ stdout: JSON.stringify({ errors: [{ code: 'form_param_format_invalid' }] }), stderr: '' }))).toBe('form_param_format_invalid')
  })
  it('resolves streams conservatively and never retains provider secrets', () => {
    const structured = (code: string) => JSON.stringify({ error: { code, message: 'sk_test_secret user_test sess_test' } })
    const cases: [any, string][] = [
      [{ stderr: structured('authorization_invalid') }, 'authorization_invalid'],
      [{ stdout: structured('form_param_missing'), stderr: structured('form_param_missing') }, 'form_param_missing'],
      [{ stdout: structured('form_param_missing'), stderr: structured('authorization_invalid') }, 'unclassified'],
      [{ stdout: 'malformed sk_test_secret', stderr: structured('rate_limit_exceeded') }, 'rate_limit_exceeded'],
      [{ stdout: structured('unknown_provider_code'), stderr: '' }, 'unclassified'],
      [{ stdout: 'form_param_missing', stderr: '{' }, 'unclassified'],
      [{ stdout: 'null', stderr: '[]' }, 'unclassified'],
      [{ code: 'ENOENT', message: 'sk_test_secret', spawnargs: ['user_test'] }, 'unclassified'],
      [undefined, 'unclassified'],
      [null, 'unclassified'],
    ]
    for (const [input, expected] of cases) {
      const failure = transportFailure(input)
      expect(classifyError(failure)).toBe(expected)
      expect(`${failure.stack} ${JSON.stringify(failure)}`).not.toMatch(/sk_test_secret|user_test|sess_test|unknown_provider_code/)
      expect(failure.message).toBe('Clerk operation failed; details suppressed')
    }
  })
  it('only exposes exact whitelisted structured classes, never message-shaped forgeries', () => {
    expect(classifyError(transportFailure({ stderr: JSON.stringify({ errors: [{ code: 'file_not_found', message: 'sk_test_secret user_test' }] }) }))).toBe('file_not_found')
    for (const code of ['sk_test_secret', 'user_test', 'sess_test', 'livefy_h1_fixture']) {
      expect(classifyError(transportFailure({ stderr: JSON.stringify({ error: { code } }) }))).toBe('unclassified')
    }
    expect(classifyError(new Error('file_not_found sk_test_secret'))).toBe('unclassified')
    expect(classifyError(transportFailure({ stderr: 'sk_test_secret token user_test' }))).toBe('unclassified')
  })
  it.each(['user', 'session'] as const)('labels lost %s creation without exposing provider data', async lost => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const f = fixture(lost)
      const api = async (method: string, path: string, body?: any) => {
        try { return await f.api(method, path, body) }
        catch { throw new Error('sk_test_secret token user_test sess_test livefy-h1-2c-test') }
      }
      await expect(smoke(api, query, marker, email)).rejects.toThrow('details suppressed')
      const output = log.mock.calls.map(call => call.join(' ')).join('\n')
      expect(JSON.parse(output)).toMatchObject({ failure: { stage: `${lost}-create`, errorClass: 'unclassified' }, cleanupComplete: true })
      expect(output).not.toMatch(/sk_test_secret|token|user_test|sess_test|livefy-h1-2c-test/)
    } finally { log.mockRestore() }
  })
  it.each(['user', 'session'] as const)('labels %s reconciliation failure and suppresses identifiers', async lost => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const f = fixture(lost)
      const api = async (method: string, path: string, body?: any) => {
        if (path.startsWith(`/${lost}s?`)) throw new Error('sk_test_secret user_test sess_test livefy-h1-2c-test')
        return f.api(method, path, body)
      }
      await expect(smoke(api, query, marker, email)).rejects.toThrow('cleanup incomplete')
      const output = log.mock.calls.map(call => call.join(' ')).join('\n')
      expect(JSON.parse(output)).toMatchObject({ cleanupComplete: false, cleanupFailure: { stage: `${lost}-reconcile`, errorClass: 'unclassified' } })
      expect(output).not.toMatch(/sk_test_secret|user_test|sess_test|livefy-h1-2c-test/)
      expect(f.calls.some(call => call.startsWith('DELETE'))).toBe(false)
    } finally { log.mockRestore() }
  })
})

describe('token claims contract (S1, S2 unit negatives)', () => {
  it('answers issuer and audience against the configured expectations only', () => {
    expect(expectations).toEqual({ issuer: target.issuer, audience: 'convex' })
    expect(claimVerdict({ iss: target.issuer, aud: 'convex' })).toEqual({ issuerMatches: true, audienceMatches: true })
    expect(claimVerdict({ iss: target.issuer, aud: ['other', 'convex'] })).toEqual({ issuerMatches: true, audienceMatches: true })
    for (const aud of ['other', '', null, undefined, ['other'], ['convex-read'], 'CONVEX', {}, 1]) {
      expect(claimVerdict({ iss: target.issuer, aud }).audienceMatches).toBe(false)
    }
    for (const iss of ['https://other.example', `${target.issuer}/`, `${target.issuer}.evil`,
      'organic-snake-7233.clerk.accounts.dev', undefined, null, '']) {
      expect(claimVerdict({ iss, aud: 'convex' }).issuerMatches).toBe(false)
    }
  })
  it('decodes claims only, so an unverifiable signature never changes the answer', () => {
    const claims = { iss: target.issuer, aud: 'convex', sub: 'user_test' }
    expect(decodeClaims(encoded(claims, 'aaa_bbb'))).toEqual(claims)
    expect(claimVerdict(decodeClaims(encoded(claims, 'forged'))))
      .toEqual(claimVerdict(decodeClaims(encoded(claims, ''))))
  })
  it('rejects foreign issuer, audience and subject through validateClaims with its existing message', () => {
    const claims = { iss: target.issuer, aud: 'convex', sub: 'user_test' }
    expect(validateClaims(encoded(claims), 'user_test')).toEqual(claims)
    const arrayAudience = { ...claims, aud: ['other', 'convex'] }
    expect(validateClaims(encoded(arrayAudience), 'user_test')).toEqual(arrayAudience)
    for (const wrong of [{ ...claims, aud: 'other' }, { ...claims, aud: ['other'] },
      { ...claims, iss: 'https://other.example' }, { ...claims, sub: 'user_other' }]) {
      expect(() => validateClaims(encoded(wrong), 'user_test'))
        .toThrow('Issued token issuer, audience, or subject mismatch')
    }
  })
  it('rejects unreadable tokens without exposing their payload', () => {
    const unreadable = [undefined, null, '', 'header', 'a.b', 'a.b.c.d',
      `h.${Buffer.from('not json sk_live_secret').toString('base64url')}.s`,
      `h.${Buffer.from('[1]').toString('base64url')}.s`,
      `h.${Buffer.from('null').toString('base64url')}.s`]
    for (const input of unreadable) {
      expect(() => decodeClaims(input)).toThrow(/Missing issued JWT|Unreadable token claims/)
    }
    try { decodeClaims(`h.${Buffer.from('not json sk_live_secret').toString('base64url')}.s`) } catch (error) {
      expect(String(error)).not.toContain('sk_live_secret')
    }
  })
})

describe('externally supplied untrusted tokens (S1, S2 seam, S3 pending)', () => {
  it('keeps both negatives explicit and pending when no untrusted token is supplied', async () => {
    const f = fixture()
    const g = guarded()
    const result = await smoke(f.api, g.query, marker, email)
    expect(result.wrongIssuer).toBe('pending: no authorized genuinely signed untrusted issuer source')
    expect(result.wrongAudience).toBe('pending: no authorized genuinely signed wrong-audience source')
    expect(pendingNegatives).toEqual({ issuer: result.wrongIssuer, audience: result.wrongAudience })
    expect(Object.isFrozen(pendingNegatives)).toBe(true)
    expect(g.seen).toEqual(['header.' + Buffer.from(JSON.stringify({ iss: target.issuer, aud: 'convex', sub: 'user_test' })).toString('base64url') + '.signature'])
  })
  it('treats unset or empty environment sources as not supplied', async () => {
    expect(untrustedSources({})).toEqual({ wrongIssuer: undefined, wrongAudience: undefined })
    expect(untrustedSources({ H1_2C_UNTRUSTED_ISSUER_JWT: '', H1_2C_UNTRUSTED_AUDIENCE_JWT: '' }))
      .toEqual({ wrongIssuer: undefined, wrongAudience: undefined })
    expect(untrustedSources({ H1_2C_UNTRUSTED_ISSUER_JWT: untrustedIssuerToken }))
      .toEqual({ wrongIssuer: untrustedIssuerToken, wrongAudience: undefined })
    expect(await untrustedNegatives(guarded().query, { wrongIssuer: '', wrongAudience: '' }))
      .toEqual({ wrongIssuer: pendingNegatives.issuer, wrongAudience: pendingNegatives.audience })
  })
  it('sends a supplied untrusted issuer token to the query and records the refusal without clearing pending', async () => {
    const f = fixture()
    const g = guarded()
    const result = await smoke(f.api, g.query, marker, email, { wrongIssuer: untrustedIssuerToken })
    expect(g.seen).toContain(untrustedIssuerToken)
    expect(result.wrongIssuer).toBe(`${pendingNegatives.issuer} (refused by the query, provenance unverified)`)
    expect(result.wrongAudience).toBe(pendingNegatives.audience)
    expect(result).toMatchObject({ validAccepted: true, anonymousRejected: true, usersAfter: 0 })
  })
  it('sends a supplied untrusted audience token to the query and records the refusal without clearing pending', async () => {
    const f = fixture()
    const g = guarded()
    const result = await smoke(f.api, g.query, marker, email, { wrongAudience: untrustedAudienceToken })
    expect(g.seen).toContain(untrustedAudienceToken)
    expect(result.wrongAudience).toBe(`${pendingNegatives.audience} (refused by the query, provenance unverified)`)
    expect(result.wrongIssuer).toBe(pendingNegatives.issuer)
  })
  it('S3: never clears pending for a locally forged token without disclosing unverified provenance', async () => {
    // Regression this pins: an unsigned token whose claims carried the intended
    // mismatch was refused for its signature and reported as a passed negative.
    const forged = encoded({ iss: target.issuer, aud: 'other', sub: 'user_test' })
    const f = fixture()
    const result = await smoke(f.api, guarded().query, marker, email, { wrongAudience: forged })
    expect(result.wrongAudience.startsWith(pendingNegatives.audience)).toBe(true)
    expect(result.wrongAudience).toContain('provenance unverified')
    expect(result.wrongAudience.startsWith('rejected:')).toBe(false)
  })
  it.each([
    ['issuer', { iss: 'https://foreign-snake.clerk.accounts.dev', aud: 'convex', sub: 'user_test' }],
    ['audience', { iss: target.issuer, aud: 'other', sub: 'user_test' }],
  ] as const)('S3: keeps the %s negative pending for a locally forged token and discloses unverified provenance', async (kind, claims) => {
    const forged = encoded(claims) // unsigned fixture: the third segment is not a signature
    const f = fixture()
    const result = await smoke(f.api, guarded().query, marker, email,
      kind === 'issuer' ? { wrongIssuer: forged } : { wrongAudience: forged })
    const reported = kind === 'issuer' ? result.wrongIssuer : result.wrongAudience
    const pending = kind === 'issuer' ? pendingNegatives.issuer : pendingNegatives.audience
    expect(reported.startsWith(pending)).toBe(true)
    expect(reported).toContain('(refused by the query, provenance unverified)')
    expect(reported.startsWith('rejected:')).toBe(false)
    expect(result.validAccepted).toBe(true)
  })
  it('never reports a pass when the untrusted token is accepted', async () => {
    const f = fixture()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(smoke(f.api, guarded({ acceptAll: true }).query, marker, email, { wrongIssuer: untrustedIssuerToken }))
        .rejects.toThrow('DEV verification failed; details suppressed')
      const output = log.mock.calls.flat().join('\n')
      expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'untrusted-negatives' } })
      expect(output).not.toMatch(/rejected:|pending:/)
      expect(output).not.toContain(untrustedIssuerToken)
    } finally { log.mockRestore() }
  })
  it('never reports a pass when the refusal is inconclusive', async () => {
    const f = fixture()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(smoke(f.api, guarded({ refusal: 'socket hang up' }).query, marker, email, { wrongIssuer: untrustedIssuerToken }))
        .rejects.toThrow('DEV verification failed; details suppressed')
      const output = log.mock.calls.flat().join('\n')
      expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'untrusted-negatives' } })
      expect(output).not.toMatch(/rejected:|pending:/)
    } finally { log.mockRestore() }
  })
  it('keeps a supplied token pending when the query refuses it with NoAuthProvider', async () => {
    const f = fixture()
    const result = await smoke(f.api, guarded({ refusal: noAuthProviderRefusal }).query, marker, email,
      { wrongAudience: untrustedAudienceToken })
    expect(result.wrongAudience).toBe(`${pendingNegatives.audience} (refused by the query, provenance unverified)`)
    expect(result.wrongAudience.startsWith('rejected:')).toBe(false)
    expect(result.wrongAudience).not.toBe(attestedVerdict)
  })
  it.each(nonRefusals)('still aborts when the supplied token is refused with %s, which is not a refusal', async (_label, refusal) => {
    const f = fixture()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(smoke(f.api, guarded({ refusal }).query, marker, email, { wrongAudience: untrustedAudienceToken }))
        .rejects.toThrow('DEV verification failed; details suppressed')
      const output = log.mock.calls.flat().join('\n')
      expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'untrusted-negatives' } })
      expect(output).not.toMatch(/rejected:|pending:/)
    } finally { log.mockRestore() }
  })
  it('refuses a supplied token that does not carry the intended mismatch', async () => {
    const matching = encoded({ iss: target.issuer, aud: 'convex', sub: 'user_test' })
    await expect(untrustedNegatives(guarded().query, { wrongIssuer: matching }))
      .rejects.toThrow('Supplied untrusted issuer token does not carry a foreign issuer with the expected audience')
    await expect(untrustedNegatives(guarded().query, { wrongAudience: matching }))
      .rejects.toThrow('Supplied untrusted audience token does not carry a foreign audience with the expected issuer')
    await expect(untrustedNegatives(guarded().query, { wrongIssuer: untrustedAudienceToken }))
      .rejects.toThrow('Supplied untrusted issuer token does not carry a foreign issuer with the expected audience')
  })
})

// The injected seam `main()` uses: a Clerk dispatcher, an OIDC discovery fetch and
// a Convex query. Nothing here reaches Clerk or Convex.
function mainIo(overrides: { argv?: string[]; env?: Record<string, string | undefined>; base?: number } = {}) {
  const f = fixture('none', false, {}, overrides.base ?? 0)
  const g = guarded()
  const dispatch = vi.fn((method: string, path: string, body?: any, platform?: boolean) => {
    if (platform) {
      return { application_id: target.app, instances: [{ instance_id: target.instance, environment_type: 'development' }] }
    }
    return f.api(method, path, body)
  })
  const discovery = vi.fn(async () => ({ json: async () => ({ issuer: target.issuer }) }))
  return {
    io: { argv: overrides.argv ?? ['node', 'verify-clerk-dev.mjs', '--one-authorized-fixture'],
      env: overrides.env ?? { H1_2C_FIXTURE_EMAIL: email },
      clerk: dispatch, fetch: discovery, query: g.query },
    f, g, dispatch, discovery,
  }
}

// S9: a negative may be reported as passed only from a token this script minted
// itself through a named JWT template. Every assertion below drives the mock
// transport and the mock query seam; none is evidence about Clerk or the
// configured Convex deployment, which stays T5.
async function failedSmoke(f: ReturnType<typeof fixture>, query: (token?: string) => Promise<any>,
  extra: { untrusted?: any; attested?: any } = {}) {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(smoke(f.api, query, marker, email, extra.untrusted ?? {}, extra.attested ?? {}))
      .rejects.toThrow('DEV verification failed; details suppressed')
    return log.mock.calls.flat().join('\n')
  } finally { log.mockRestore() }
}

describe('authentication refusal predicate (S9 and S3 boundary)', () => {
  it('names exactly the two documented refusal codes', () => {
    expect(authenticationRefusals).toEqual(['Unauthorized', 'NoAuthProvider'])
    expect(Object.isFrozen(authenticationRefusals)).toBe(true)
  })
  it('accepts the two documented refusal codes and nothing else', () => {
    expect(isAuthenticationRefusal(new Error('Unauthorized'))).toBe(true)
    expect(isAuthenticationRefusal(new Error(JSON.stringify({ code: 'Unauthorized', message: 'Unauthenticated' })))).toBe(true)
    // The body measured on DEV for a genuinely signed wrong-audience token.
    expect(isAuthenticationRefusal(new Error(noAuthProviderRefusal))).toBe(true)
  })
  it('rejects an unknown error and never a generic thrown value', () => {
    const nonErrors: unknown[] = [undefined, null, 'Unauthorized', noAuthProviderRefusal, 401, true,
      { message: 'Unauthorized' }, { message: noAuthProviderRefusal }, { code: 'NoAuthProvider' },
      ['Unauthorized'], () => 'Unauthorized']
    for (const thrown of nonErrors) expect(isAuthenticationRefusal(thrown)).toBe(false)
    const unknown: unknown[] = ['', ' ', 'socket hang up', 'InternalServerError', '500 Internal Server Error',
      JSON.stringify({ code: 'InternalServerError', message: 'boom' }),
      JSON.stringify({ status: 'error', errorMessage: 'InternalServerError' }),
      JSON.stringify({ message: 'Unauthorized' }),
      JSON.stringify({ error: { code: 'NoAuthProvider' } }),
      JSON.stringify({ code: 'NoAuthProviderX' }), JSON.stringify({ code: 1 }),
      'NotUnauthorized', 'NoAuthProvider Unauthorized', 'Unauthorized\nNoAuthProvider', '{"code":', '[]', 'null']
    for (const message of unknown) expect(isAuthenticationRefusal(new Error(message))).toBe(false)
  })
})

describe('S9 attested wrong-audience negative (mock transport, not JWT evidence)', () => {
  it('reports the explicit attested verdict only for the token it minted through the named template', async () => {
    const f = fixture()
    const g = guarded()
    const result = await smoke(f.api, g.query, marker, email, {}, { template: attestedTemplate })
    expect(f.calls).toContain(`POST /sessions/sess_test/tokens/${attestedTemplate}`)
    expect(g.seen).toContain(attestedMintedToken)
    expect(result.wrongAudience).toBe(attestedVerdict)
    expect(result.wrongIssuer).toBe(pendingNegatives.issuer)
    expect(result).toMatchObject({ validAccepted: true, anonymousRejected: true, sessionRevoked: true, usersAfter: 0 })
    expect(f.user()).toBeUndefined()
    expect(f.session()?.status).toBe('revoked')
    expect(attestedVerdicts.wrongAudience).toBe(attestedVerdict)
    expect(attestedVerdict.startsWith('rejected:')).toBe(true)
    expect(attestedVerdict).not.toContain('pending:')
    expect(attestedVerdict).not.toBe(pendingNegatives.audience)
  })
  it('sends the minted token to the query while the issuer negative stays pending', async () => {
    const f = fixture()
    const g = guarded()
    const result = await smoke(f.api, g.query, marker, email, {}, { template: attestedTemplate })
    expect(g.seen).toEqual([
      `header.${Buffer.from(JSON.stringify({ iss: target.issuer, aud: 'convex', sub: 'user_test' })).toString('base64url')}.signature`,
      attestedMintedToken,
    ])
    expect(result.wrongIssuer).toBe(pendingNegatives.issuer)
    expect(g.seen.every(token => token !== untrustedAudienceToken)).toBe(true)
  })
  it.each([undefined, '', ' ', 'livefy/wrong-aud', 'livefy h1 aud', `${attestedTemplate}\n`, 'x'.repeat(129)])
  ('refuses to mint without an explicit valid template name (%#)', async template => {
    const f = fixture()
    const g = guarded()
    await expect(attestedWrongAudience(g.query, f.api, 'sess_test', template as string))
      .rejects.toThrow('Explicit JWT template name required for the attested negative; details suppressed')
    expect(f.calls).toEqual([])
    expect(g.seen).toEqual([])
  })
  it('takes the template name only from an explicit input and treats unset or empty as not requested', () => {
    expect(attestedTemplateVariable).toBe('H1_2C_WRONG_AUDIENCE_TEMPLATE')
    expect(attestedSource({})).toEqual({})
    expect(attestedSource({ [attestedTemplateVariable]: '' })).toEqual({})
    expect(attestedSource({ [attestedTemplateVariable]: attestedTemplate })).toEqual({ template: attestedTemplate })
    for (const bad of [' ', 'livefy/wrong-aud', 'x'.repeat(129)]) {
      expect(() => attestedSource({ [attestedTemplateVariable]: bad }))
        .toThrow('Explicit JWT template name required for the attested negative; details suppressed')
    }
  })
  it('fails the run when the attesting mint fails', async () => {
    const f = fixture('none', false, { fail: true })
    const output = await failedSmoke(f, guarded().query, { attested: { template: attestedTemplate } })
    expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'attested-negative' } })
    expect(output).not.toMatch(/rejected:|pending:/)
    expect(f.user()).toBeUndefined()
    expect(f.session()?.status).toBe('revoked')
  })
  it.each([
    ['the configured audience', 'convex'],
    ['a missing audience', undefined],
    ['an empty audience', ''],
    ['a blank entry in an audience array', ['']],
    ['an audience array that still contains the configured audience', ['other', 'convex']],
    ['a non-string audience', { value: 'other' }],
  ] as const)('fails closed when the minted token carries %s', async (_label, aud) => {
    const f = fixture('none', false, { aud })
    const output = await failedSmoke(f, guarded().query, { attested: { template: attestedTemplate } })
    expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'attested-negative' } })
    expect(output).not.toMatch(/rejected:|pending:/)
    expect(output).not.toContain(attestedTemplate)
  })
  it('refuses a misconfigured template before handing its token to the query', async () => {
    const f = fixture('none', false, { aud: 'convex' })
    const g = guarded()
    await expect(attestedWrongAudience(g.query, f.api, 'sess_test', attestedTemplate))
      .rejects.toThrow('Attested wrong-audience token does not carry a foreign audience')
    expect(g.seen).toEqual([])
  })
  it('fails closed when the minted token is not from the configured issuer', async () => {
    const foreign = encoded({ iss: 'https://foreign-snake.clerk.accounts.dev', aud: 'other', sub: 'user_test' })
    const f = fixture('none', false, { jwt: foreign })
    const g = guarded()
    await expect(attestedWrongAudience(g.query, f.api, 'sess_test', attestedTemplate))
      .rejects.toThrow('Attested wrong-audience token was not issued by the configured issuer')
    expect(g.seen).toEqual([])
  })
  it('fails the run when the query accepts the attested token', async () => {
    const f = fixture()
    const accepting = guarded({ acceptAll: true }).query
    await expect(attestedWrongAudience(accepting, f.api, 'sess_test', attestedTemplate))
      .rejects.toThrow('Attested wrong-audience token was accepted')
    const output = await failedSmoke(fixture(), accepting, { attested: { template: attestedTemplate } })
    expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'attested-negative' } })
    expect(output).not.toMatch(/rejected:|pending:/)
  })
  it('fails the run when the attested refusal is inconclusive', async () => {
    const f = fixture()
    const inconclusive = guarded({ refusal: 'socket hang up' }).query
    await expect(attestedWrongAudience(inconclusive, f.api, 'sess_test', attestedTemplate))
      .rejects.toThrow('Attested wrong-audience token rejection was inconclusive')
    const output = await failedSmoke(fixture(), inconclusive, { attested: { template: attestedTemplate } })
    expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'attested-negative' } })
    expect(output).not.toMatch(/rejected:|pending:/)
  })
  it.each(documentedRefusals)('reports the attested verdict when the minted token is refused with %s', async (_label, refusal) => {
    const f = fixture()
    const g = guarded({ refusal })
    const result = await smoke(f.api, g.query, marker, email, {}, { template: attestedTemplate })
    expect(g.seen).toContain(attestedMintedToken)
    expect(result.wrongAudience).toBe(attestedVerdict)
    expect(result.wrongIssuer).toBe(pendingNegatives.issuer)
    expect(result).toMatchObject({ validAccepted: true, anonymousRejected: true, sessionRevoked: true })
    expect(f.user()).toBeUndefined()
  })
  it.each(nonRefusals)('still aborts the attested run when the refusal is %s, which is not a refusal', async (_label, refusal) => {
    const f = fixture()
    const inconclusive = guarded({ refusal }).query
    await expect(attestedWrongAudience(inconclusive, f.api, 'sess_test', attestedTemplate))
      .rejects.toThrow('Attested wrong-audience token rejection was inconclusive')
    const output = await failedSmoke(fixture(), inconclusive, { attested: { template: attestedTemplate } })
    expect(JSON.parse(output)).toMatchObject({ cleanupComplete: true, failure: { stage: 'attested-negative' } })
    expect(output).not.toMatch(/rejected:|pending:/)
  })
  it('refuses contradictory wrong-audience sources instead of choosing one silently', async () => {
    const f = fixture()
    const g = guarded()
    await expect(smoke(f.api, g.query, marker, email, { wrongAudience: untrustedAudienceToken },
      { template: attestedTemplate })).rejects.toThrow('Conflicting wrong-audience sources')
    expect(f.calls).toEqual([])
    expect(g.seen).toEqual([])
  })
  it('wires the attested template from the environment into the production dispatch seam', async () => {
    const { io, dispatch, g } = mainIo({ env: { H1_2C_FIXTURE_EMAIL: email, H1_2C_WRONG_AUDIENCE_TEMPLATE: attestedTemplate } })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await main(io)
      expect(dispatch.mock.calls).toContainEqual(['POST', `/sessions/sess_test/tokens/${attestedTemplate}`, {}])
      expect(g.seen).toContain(attestedMintedToken)
      const line = String(log.mock.calls[0][0])
      expect(JSON.parse(line).wrongAudience).toBe(attestedVerdict)
      expect(JSON.parse(line).wrongIssuer).toBe(pendingNegatives.issuer)
      expect(errorLog).not.toHaveBeenCalled()
    } finally { log.mockRestore(); errorLog.mockRestore() }
  })
  it('fails the invocation before any Clerk call when the template name is malformed', async () => {
    const { io, dispatch } = mainIo({ env: { H1_2C_FIXTURE_EMAIL: email, H1_2C_WRONG_AUDIENCE_TEMPLATE: 'livefy/wrong-aud' } })
    await expect(main(io)).rejects.toThrow('Explicit JWT template name required for the attested negative; details suppressed')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('keeps the environment-supplied audience token pending even when the attested path is enabled', async () => {
    const f = fixture()
    const g = guarded()
    // The attested path and the environment path are separate inputs; the
    // environment source alone can never pass, with or without a template.
    const result = await smoke(f.api, g.query, marker, email, { wrongIssuer: untrustedIssuerToken }, { template: attestedTemplate })
    expect(result.wrongIssuer).toBe(`${pendingNegatives.issuer} (refused by the query, provenance unverified)`)
    expect(result.wrongIssuer.startsWith('rejected:')).toBe(false)
    expect(result.wrongAudience).toBe(attestedVerdict)
  })
})

describe('main() invocation contract', () => {
  it('requires the explicit single-fixture flag on the real argv before any Clerk call', async () => {
    const saved = process.argv
    const { io, dispatch, discovery } = mainIo()
    try {
      for (const argv of [['node', 'verify-clerk-dev.mjs'], ['node', 'verify-clerk-dev.mjs', '--all'],
        ['node', 'verify-clerk-dev.mjs', '--one-authorized-fixture', 'extra'],
        ['node', 'verify-clerk-dev.mjs', '--one-authorized-fixture ']]) {
        process.argv = argv
        await expect(main({ ...io, argv: undefined })).rejects.toThrow('Explicit single-fixture invocation required')
      }
    } finally { process.argv = saved }
    expect(dispatch).not.toHaveBeenCalled()
    expect(discovery).not.toHaveBeenCalled()
  })
  it('rejects inherited deployment credentials before any Clerk call', async () => {
    const { io, dispatch, discovery } = mainIo()
    for (const key of ['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_ADMIN_KEY', 'CONVEX_SELF_HOSTED_URL']) {
      await expect(main({ ...io, env: { H1_2C_FIXTURE_EMAIL: email, [key]: 'inherited' } }))
        .rejects.toThrow('Inherited deployment credentials are not allowed')
    }
    expect(dispatch).not.toHaveBeenCalled()
    expect(discovery).not.toHaveBeenCalled()
  })
  it('writes one success JSON line to stdout and leaves the exit code untouched', async () => {
    const { io, dispatch } = mainIo()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const savedExit = process.exitCode
    process.exitCode = undefined
    try {
      await main(io)
      expect(log).toHaveBeenCalledTimes(1)
      expect(errorLog).not.toHaveBeenCalled()
      const line = String(log.mock.calls[0][0])
      expect(JSON.parse(line)).toEqual({ validAccepted: true, anonymousRejected: true, sessionRevoked: true,
        usersBefore: 0, usersAfter: 0, wrongIssuer: pendingNegatives.issuer, wrongAudience: pendingNegatives.audience })
      expect(line).not.toContain(email)
      expect(line.split('\n')).toHaveLength(1)
      expect(process.exitCode).toBeUndefined()
      expect(dispatch.mock.calls[0]).toEqual(['GET', `/platform/applications/${target.app}`, undefined, true])
    } finally { log.mockRestore(); errorLog.mockRestore(); process.exitCode = savedExit }
  })
  it('sets process.exitCode = 1 and writes the sanitized failure summary to stderr when rejected', async () => {
    const { io } = mainIo({ argv: ['node', 'verify-clerk-dev.mjs'] })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const savedExit = process.exitCode
    process.exitCode = undefined
    try {
      await expect(runMain(() => main({ ...io, env: { H1_2C_FIXTURE_EMAIL: 'not-an-email' } }))).resolves.toBeUndefined()
      expect(process.exitCode).toBe(1)
      expect(log).not.toHaveBeenCalled()
      expect(errorLog).toHaveBeenCalledTimes(2)
      expect(JSON.parse(String(errorLog.mock.calls[0][0])))
        .toEqual({ stage: 'invocation', errorClass: 'unclassified', errorParameter: 'unclassified' })
      expect(errorLog.mock.calls[1][0]).toBe('Stop: inspect cleanup evidence before any separately authorized retry.')
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain('not-an-email')
    } finally { log.mockRestore(); errorLog.mockRestore(); process.exitCode = savedExit }
  })
})

describe('exact fixture cleanup (mock transport, not JWT evidence)', () => {
  it.each(['user', 'session'] as const)('reconciles a lost %s response without retrying creation', async lost => {
    const f = fixture(lost)
    await expect(smoke(f.api, query, marker, email)).rejects.toThrow('details suppressed')
    expect(f.user()).toBeUndefined()
    if (lost === 'session') expect(f.session()?.status).toBe('revoked')
    expect(f.calls.filter(x => x === 'POST /users')).toHaveLength(1)
    expect(f.calls.filter(x => x === 'POST /sessions')).toHaveLength(lost === 'session' ? 1 : 0)
  })
  it('accepts the intended identity, rejects anonymous, and cleans up', async () => {
    const f = fixture()
    expect(await smoke(f.api, query, marker, email)).toMatchObject({ validAccepted: true, anonymousRejected: true, usersAfter: 0 })
    expect(f.user()).toBeUndefined()
    expect(f.session()?.status).toBe('revoked')
    await expect(smoke(f.api, query, marker, email)).rejects.toThrow('already used')
  })
  it('refuses cleanup without both exact ownership markers', async () => {
    const f = fixture('user', true)
    await expect(smoke(f.api, query, marker, email)).rejects.toThrow('cleanup incomplete')
    expect(f.calls.some(x => x.startsWith('DELETE'))).toBe(false)
  })
  it('cleans up if the issued token lacks the required audience', async () => {
    const f = fixture()
    const api = async (method: string, path: string, body?: any) => path.endsWith('/tokens')
      ? { jwt: `header.${Buffer.from(JSON.stringify({ iss: target.issuer, sub: 'user_test' })).toString('base64url')}.signature` }
      : f.api(method, path, body)
    await expect(smoke(api, query, marker, email)).rejects.toThrow('details suppressed')
    expect(f.user()).toBeUndefined()
    expect(f.session()?.status).toBe('revoked')
  })
})

// S10: the preflight records the initial inventory instead of requiring an empty
// instance, and a run passes only when BOTH halves of one verdict hold: the final
// count equals the initial count AND the owned fixture is absent by external_id.
// These wrappers bend exactly one half so each half can be observed on its own.
function counts(api: (method: string, path: string, body?: any) => Promise<any>,
  before: number, after: number) {
  let reads = 0
  return async (method: string, path: string, body?: any): Promise<any> => {
    if (path === '/users/count') { reads += 1; return { total_count: reads === 1 ? before : after } }
    return api(method, path, body)
  }
}
// Reports the deletion as confirmed while the owned user stays readable by the
// external_id read: the delta half can pass while the absence half fails.
function surviving(f: ReturnType<typeof fixture>) {
  return async (method: string, path: string, body?: any): Promise<any> => {
    if (method === 'DELETE') return { id: 'user_test', deleted: true }
    return f.api(method, path, body)
  }
}
const fixtureQuery = `GET /users?external_id=${encodeURIComponent(marker)}&limit=2`

async function failedRun(api: (method: string, path: string, body?: any) => Promise<any>,
  queryImpl: (token?: string) => Promise<any>, reason: string) {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await expect(smoke(api, queryImpl, marker, email)).rejects.toThrow(reason)
    return { summary: JSON.parse(String(errorLog.mock.calls.flat()[0])), log, errorLog }
  } finally { errorLog.mockRestore(); log.mockRestore() }
}

describe('S10 inventory delta contract (mock transport, not JWT evidence)', () => {
  it('passes on a non-empty instance when the count is restored and the fixture is absent', async () => {
    const f = fixture('none', false, {}, 2)
    const g = guarded()
    const result = await smoke(f.api, g.query, marker, email)
    // Both halves of the verdict, reported: the DEV instance starts with 2 real users.
    expect(result).toEqual({ validAccepted: true, anonymousRejected: true, sessionRevoked: true,
      usersBefore: 2, usersAfter: 2, wrongIssuer: pendingNegatives.issuer,
      wrongAudience: pendingNegatives.audience })
    expect(f.calls.filter(call => call === 'GET /users/count')).toHaveLength(2)
    expect(f.calls[0]).toBe('GET /users/count')
    expect(f.calls.at(-1)).toBe(fixtureQuery)
    expect(f.user()).toBeUndefined()
    expect(f.session()?.status).toBe('revoked')
  })
  it('still passes and reports 0 before and after when the instance started empty', async () => {
    const f = fixture()
    expect(await smoke(f.api, guarded().query, marker, email))
      .toMatchObject({ validAccepted: true, usersBefore: 0, usersAfter: 0 })
    expect(f.user()).toBeUndefined()
  })
  it('fails when the final count does not equal the initial count', async () => {
    const f = fixture('none', false, {}, 2)
    const { summary, log } = await failedRun(counts(f.api, 2, 3), guarded().query,
      'Fixture cleanup incomplete; stop and inspect exact owned fixture')
    // The fixture is absent, so the absence half holds; the count delta is not zero.
    expect(summary).toMatchObject({ cleanupComplete: false,
      cleanupFailure: { stage: 'cleanup-inventory', errorClass: 'unclassified', errorParameter: 'unclassified' },
      cleanupChecks: { countRestored: false, fixtureAbsent: true } })
    expect(summary.usersAfter).toBeUndefined()
    expect(log).not.toHaveBeenCalled()
  })
  it('fails when the count is restored but the owned fixture user is still present', async () => {
    const f = fixture('none', false, {}, 2)
    const { summary, log } = await failedRun(counts(surviving(f), 2, 2), guarded().query,
      'Fixture cleanup incomplete; stop and inspect exact owned fixture')
    // The delta is zero, so the count half holds; the fixture survives.
    expect(summary).toMatchObject({ cleanupComplete: false,
      cleanupFailure: { stage: 'cleanup-fixture-absence', errorClass: 'unclassified', errorParameter: 'unclassified' },
      cleanupChecks: { countRestored: true, fixtureAbsent: false } })
    expect(summary.usersAfter).toBeUndefined()
    expect(log).not.toHaveBeenCalled()
  })
  it('fails closed before the fixture when the initial count read fails', async () => {
    const api = vi.fn(async (method: string, path: string) => {
      if (path === '/users/count') {
        throw transportFailure({ stderr: JSON.stringify({ error: { code: 'rate_limit_exceeded' } }) })
      }
      throw new Error(`Unexpected operation ${method} ${path}`)
    })
    const { summary } = await failedRun(api, guarded().query, 'DEV preflight failed; details suppressed')
    expect(summary).toEqual({ failure: { stage: 'initial-inventory', errorClass: 'rate_limit_exceeded',
      errorParameter: 'unclassified' }, cleanupComplete: true, fixtureAttempted: false })
    expect(api.mock.calls).toEqual([['GET', '/users/count']])
  })
  it.each([{}, { total_count: undefined }, { total_count: null }, { total_count: '2' },
    { total_count: -1 }, { total_count: 1.5 }, { total_count: Number.NaN },
    { total_count: Number.POSITIVE_INFINITY }, {}, undefined, null])
  ('fails closed before the fixture when the initial count is unusable (%#)', async payload => {
    const api = vi.fn(async (method: string, path: string) => {
      if (path === '/users/count') return payload
      throw new Error(`Unexpected operation ${method} ${path}`)
    })
    const { summary } = await failedRun(api, guarded().query, 'DEV preflight failed; details suppressed')
    expect(summary).toEqual({ failure: { stage: 'initial-inventory', errorClass: 'unclassified',
      errorParameter: 'unclassified' }, cleanupComplete: true, fixtureAttempted: false })
    expect(api.mock.calls).toEqual([['GET', '/users/count']])
  })
  it('accepts only a non-negative integer as a usable initial count', () => {
    for (const count of [0, 1, 2, 137]) expect(usableUserCount({ total_count: count })).toBe(count)
    for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '0', null, undefined, {}]) {
      expect(() => usableUserCount({ total_count: count }))
        .toThrow('User count read did not yield a usable number')
    }
    expect(() => usableUserCount(undefined)).toThrow('User count read did not yield a usable number')
  })
  it('fails closed when the final count read is unusable instead of treating it as no change', async () => {
    const f = fixture('none', false, {}, 2)
    let reads = 0
    const api = async (method: string, path: string, body?: any) => {
      if (path === '/users/count') { reads += 1; return reads === 1 ? { total_count: 2 } : {} }
      return f.api(method, path, body)
    }
    const { summary } = await failedRun(api, guarded().query,
      'Fixture cleanup incomplete; stop and inspect exact owned fixture')
    expect(summary).toMatchObject({ cleanupComplete: false,
      cleanupFailure: { stage: 'cleanup-inventory', errorClass: 'unclassified' } })
    expect(summary.cleanupChecks).toEqual({ countRestored: null, fixtureAbsent: null })
  })
  it('does not claim either half of the verdict when the cleanup failed before them', async () => {
    // Ownership is refused, so the inventory and absence reads never run: both
    // halves are reported as not evaluated instead of as failures or as clean.
    const f = fixture('user', true)
    const { summary } = await failedRun(f.api, guarded().query,
      'Fixture cleanup incomplete; stop and inspect exact owned fixture')
    expect(summary.cleanupFailure.stage).toBe('user-reconcile')
    expect(summary.cleanupChecks).toEqual({ countRestored: null, fixtureAbsent: null })
    // Only the preflight read ran; the cleanup inventory read never did.
    expect(f.calls.filter(call => call === 'GET /users/count')).toHaveLength(1)
  })
  it('reports both counts in the success line the operator reads', async () => {
    const { io } = mainIo({ base: 2 })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await main(io)
      expect(log).toHaveBeenCalledTimes(1)
      expect(errorLog).not.toHaveBeenCalled()
      expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({ validAccepted: true,
        anonymousRejected: true, sessionRevoked: true, usersBefore: 2, usersAfter: 2,
        wrongIssuer: pendingNegatives.issuer, wrongAudience: pendingNegatives.audience })
    } finally { log.mockRestore(); errorLog.mockRestore() }
  })
})
