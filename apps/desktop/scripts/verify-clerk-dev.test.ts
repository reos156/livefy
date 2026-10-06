// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { classifyError, errorParameter, smoke, target, transportFailure, validateFixtureEmail } from './verify-clerk-dev.mjs'

const email = 'fixture@example.test'
const marker = 'livefy-h1-2c-test'
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
