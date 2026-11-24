import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'

// The production policy lives in electron/csp-policy.cjs so the build transform
// and the packaged renderer response header (electron/protocol.cjs) cannot drift.
const { productionCsp } = createRequire(import.meta.url)('./electron/csp-policy.cjs') as {
  productionCsp: (html: string) => string
}

export { productionCsp }

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [tailwindcss(), {
    name: 'local-production-csp',
    transformIndexHtml(html) {
      return command === 'build' ? productionCsp(html) : html
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom' },
}))
