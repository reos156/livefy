// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { productionCsp } from './vite.config'
const require = createRequire(import.meta.url)
const policy = require('./electron/csp-policy.cjs')
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
const metaContent = (documentHtml: string) =>
  documentHtml.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)![1]

it('permits native Clerk hosts with only the accepted protect wildcard exception', () => {
  expect(html).toContain('https://organic-snake-7233.clerk.accounts.dev')
  expect(html).toContain('https://*.protect.clerk.com:*')
  expect(html).toContain('worker-src \'self\' blob:')
  expect(html).not.toContain('unsafe-eval')
  expect(html.match(/script-src ([^;]+)/)![1]).not.toContain('unsafe-inline')
  expect(html.match(/https?:\/\/[^ ;"*]+|https:\/\/\*[^ ;"]+/g)?.filter(origin => origin.includes('*')))
    .toEqual(['https://*.protect.clerk.com', 'https://*.protect.clerk.com:*', 'https://*.protect.clerk.com'])
})
it('removes development websocket in production', () => {
  expect(productionCsp(html)).not.toContain('ws://127.0.0.1:5173')
  expect(productionCsp(html)).toContain('wss://polite-parrot-887.convex.cloud')
})
it('builds the production policy from the single module the response header also uses', () => {
  expect(metaContent(html)).toBe(policy.META_CSP)
  expect(metaContent(productionCsp(html))).toBe(policy.PRODUCTION_CSP)
  expect(policy.productionCsp(html)).toBe(productionCsp(html))
})
