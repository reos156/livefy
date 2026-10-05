import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'

export function productionCsp(html: string) {
  return html.replace(' ws://127.0.0.1:5173', '')
}

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
