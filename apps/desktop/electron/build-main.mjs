// Bundles the Electron main process into dist/main.cjs.
//
// The packaged artifact ships no node_modules (electron-builder.yml), so every
// runtime dependency of the main process has to be inlined here: the sibling
// electron/*.cjs modules, @clerk/electron and electron-store. Only `electron`
// (provided by the runtime) and Node built-ins stay external. This mirrors
// electron/build-preload.mjs, which already bundles the preload the same way.
import { builtinModules } from 'node:module'
import { build } from 'vite'

// `@clerk/electron` imports its optional native passkeys peer dynamically
// (`import('@clerk/electron-passkeys')`) on the only path that needs it:
// createClerkBridge({ passkeys: true }). This app never enables passkeys and
// the package is not installed, so there is nothing to inline and the specifier
// must not survive into dist/main.cjs as a bare require (no node_modules ships
// with the artifact). It is replaced by an inert module that reports the native
// module as unavailable instead of throwing: a top-level throw here would run
// at startup, and the SDK only reaches this import when passkeys are enabled.
// Enabling native passkeys later means installing that package and removing
// this stub so it is bundled like every other dependency.
const unavailablePasskeysPeer = {
  name: 'livefy-unavailable-passkeys-peer',
  enforce: 'pre',
  resolveId: id => id === '@clerk/electron-passkeys' ? '\0livefy:unavailable-passkeys-peer' : null,
  load: id => id === '\0livefy:unavailable-passkeys-peer'
    ? 'export default { isAvailable: () => false, capabilities: () => ({ platformAuthenticator: false, securityKeys: false }) }'
    : null,
}

await build({
  configFile: false,
  // Config-level plugins respect `enforce`, so the stub resolves before Vite's
  // own resolver can fail on the missing optional peer.
  plugins: [unavailablePasskeysPeer],
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    target: 'node20',
    lib: { entry: 'electron/main.cjs', formats: ['cjs'], fileName: () => 'main.cjs' },
    rollupOptions: {
      // Electron runtime plus Node built-ins only; everything else is inlined.
      external: id => id === 'electron' || id.startsWith('node:') || builtinModules.includes(id),
      // One file: dist/main.cjs is the packaged entry, so nothing may be
      // emitted beside it for a lazy load to pick up at runtime.
      output: { inlineDynamicImports: true },
    },
    minify: false,
  },
})