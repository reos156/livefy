// @vitest-environment node
import { existsSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
describe('exclusive Clerk trust configuration', () => {
  it('uses the configured Clerk issuer and Convex audience only', async () => {
    vi.stubEnv('CLERK_JWT_ISSUER_DOMAIN', 'https://organic-snake-7233.clerk.accounts.dev')
    vi.stubEnv('CONVEX_SITE_URL', 'https://legacy.convex.site')
    const { default: config } = await import('./auth.config')
    expect(config.providers).toEqual([{
      domain: 'https://organic-snake-7233.clerk.accounts.dev', applicationID: 'convex',
    }])
  })
  it('does not fall back to the legacy issuer if Clerk configuration is missing', async () => {
    vi.stubEnv('CLERK_JWT_ISSUER_DOMAIN', undefined)
    vi.stubEnv('CONVEX_SITE_URL', 'https://legacy.convex.site')
    const { default: config } = await import('./auth.config')
    expect(config.providers[0].domain).toBeUndefined()
  })
  it('has no legacy auth module or HTTP routes', async () => {
    expect(existsSync(new URL('./auth.ts', import.meta.url))).toBe(false)
    const { default: http } = await import('./http')
    expect(http.getRoutes()).toEqual([])
  })
})
