// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { claimVerdict, classifyError, decodeClaims, errorParameter, expectations, main, pendingNegatives, runMain, smoke, target, transportFailure, untrustedNegatives, untrustedSources, validateClaims, validateFixtureEmail } from './verify-clerk-dev.mjs'

const email = 'fixture@example.test'
const marker = 'livefy-h1-2c-test'
// A decodable, deliberately unsigned token. Its trailing segment is opaque here:
// this script decodes claims and must never claim to verify a signature.
function encoded(claims: unknown, signature = 'unverified-signature') {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`
}
function fixture(lost: 'user' | 'session' | 'none' = 'none', foreign = false) {
  let user: any, session: any
  const calls: string[] = []
  const api = async (method: string, path: string, body?: any): Promise<any> => {
    calls.push(`${method} ${path}`)
    if (path === '/users/count') return { total_count: user ? 1 : 0 }
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
function mainIo(overrides: { argv?: string[]; env?: Record<string, string | undefined> } = {}) {
  const f = fixture()
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
        usersAfter: 0, wrongIssuer: pendingNegatives.issuer, wrongAudience: pendingNegatives.audience })
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
