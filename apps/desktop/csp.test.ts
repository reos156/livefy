// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { productionCsp } from './vite.config'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
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
