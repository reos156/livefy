// Pinned DEV-only operations. Never print captured CLI output or secret values.
import { spawnSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const target = 'polite-parrot-887'
export const url = `https://${target}.convex.cloud`
export const cwd = fileURLToPath(new URL('../', import.meta.url))
export function environment() {
  if (process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_DEPLOYMENT_TOKEN) throw new Error('Inherited deployment credential refused')
  const env = { ...process.env, CONVEX_DEPLOYMENT: `dev:${target}`, VITE_CONVEX_URL: url }
  delete env.CONVEX_DEPLOY_KEY
  delete env.CONVEX_DEPLOYMENT_TOKEN
  return env
}
export function capturedCli(args, input) {
  return spawnSync('bun', ['x', '--no-install', 'convex', ...args], {
    cwd, env: environment(), input, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
  })
}
export function cli(args, input) {
  const result = capturedCli(args, input)
  if (result.status !== 0) throw new Error(`Convex command failed (exit ${result.status ?? 'unavailable'}); output withheld`)
  return (result.stdout ?? '') + (result.stderr ?? '')
}
export function verifyTarget() {
  const output = cli(['deployments'])
  for (const expected of ['Team: reos156', 'Project: livefy', `Deployment: ${target}`, 'Type: dev']) {
    if (!output.split('\n').some(line => line.trim() === expected)) throw new Error('CLI target mismatch')
  }
  console.log('target verified: reos156/livefy DEV polite-parrot-887')
}
export function announce(operation) {
  console.log(`target: dev (${target}, reos156/livefy) — ${operation}`)
}
function signingPresence() {
  const names = new Set(cli(['env', '--deployment', target, 'list', '--names-only']).split(/\s+/))
  return [names.has('JWT_PRIVATE_KEY'), names.has('JWKS')]
}
function configureSigning() {
  const [privateExists, publicExists] = signingPresence()
  console.log(JSON.stringify({ jwtPrivateKeyPresent: privateExists, jwksPresent: publicExists }))
  if (privateExists !== publicExists) throw new Error('Partial signing configuration; refusing changes')
  if (privateExists) return console.log('Existing complete signing configuration preserved')
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const jwks = JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), use: 'sig', alg: 'RS256' }] })
  // One bulk stdin operation, without --force: installed CLI refuses conflicts.
  announce('set ONLY JWT_PRIVATE_KEY/JWKS if still absent; no overwrite')
  cli(['env', '--deployment', target, 'set'], `JWT_PRIVATE_KEY="${pem}"\nJWKS='${jwks}'\n`)
  if (!signingPresence().every(Boolean)) throw new Error('Signing existence verification failed')
  console.log('Signing variables configured; values withheld')
}
export function push() {
  verifyTarget()
  announce('bun x --no-install convex dev --once')
  cli(['dev', '--once'])
  console.log('DEV push succeeded')
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    verifyTarget()
    if (process.argv[2] === '--push-only') push()
    else if (process.argv.length === 2) { configureSigning(); push() }
    else throw new Error('Unsupported activation option')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Activation failed; details withheld')
    process.exitCode = 1
  }
}
