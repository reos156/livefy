import { build } from 'vite'
await build({
  configFile: false,
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: { entry: 'electron/preload.cjs', formats: ['cjs'], fileName: () => 'preload.cjs' },
    rollupOptions: { external: ['electron'] },
    minify: false,
  },
})
