// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { productionCsp } from './vite.config'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
describe('deployment CSP', () => {
  it('permits only exact deployment network origins and local dev websocket', () => {
    const connect = html.match(/connect-src ([^;]+)/)![1].split(' ')
    expect(connect).toEqual(["'self'", 'https://polite-parrot-887.convex.cloud', 'wss://polite-parrot-887.convex.cloud', 'https://polite-parrot-887.convex.site', 'ws://127.0.0.1:5173'])
    expect(html).not.toContain('unsafe-eval')
    expect(connect.join(' ')).not.toContain('*')
  })
  it('removes the Vite websocket in production while retaining deployment origins', () => {
    const production = productionCsp(html)
    expect(production).not.toContain('ws://127.0.0.1:5173')
    expect(production).toContain('wss://polite-parrot-887.convex.cloud')
  })
})
