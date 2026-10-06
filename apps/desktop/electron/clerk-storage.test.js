import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createTokenStorage } = require('./clerk-storage.cjs')

function fixture(available = true, backend = 'dpapi') {
  const records = new Map()
  const store = { get: key => records.get(key), set: (key, value) => records.set(key, value), delete: key => records.delete(key) }
  const safeStorage = {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: value => Buffer.from(`encrypted:${value}`),
    decryptString: value => {
      const text = value.toString()
      if (!text.startsWith('encrypted:')) throw new Error('corrupt')
      return text.slice(10)
    },
  }
  return { records, storage: createTokenStorage({ store, safeStorage }) }
}

describe('encrypted Clerk token storage', () => {
  it('persists encrypted owned records and removes valid owned records', async () => {
    const { storage, records } = fixture()
    await storage.setItem('token', 'credential')
    expect(JSON.stringify([...records.values()])).not.toContain('credential')
    expect(await storage.getItem('token')).toBe('credential')
    await storage.removeItem('token')
    expect(records.size).toBe(0)
  })
  it.each(['raw-secret', { version: 2, ciphertext: 'abc' }, { version: 1, ciphertext: 'bad' }, { owner: 'livefy-clerk', version: 1, ciphertext: 'YmFk' }])('preserves refused records on read, write and remove', async record => {
    const { storage, records } = fixture()
    records.set('token', record)
    expect(await storage.getItem('token')).toBeNull()
    await storage.setItem('token', 'replacement')
    await storage.removeItem('token')
    expect(records.get('token')).toEqual(record)
  })
  it('refuses the Linux basic_text backend even if reported available', async () => {
    const { storage, records } = fixture(true, 'basic_text')
    expect(storage.persistence).toBe('memory-only')
    await storage.setItem('token', 'credential')
    expect(records.size).toBe(0)
  })
  it('discloses memory-only mode without disk writes', async () => {
    const { storage, records } = fixture(false)
    expect(storage.persistence).toBe('memory-only')
    await storage.setItem('token', 'credential')
    expect(await storage.getItem('token')).toBe('credential')
    expect(records.size).toBe(0)
    await storage.removeItem('token')
    expect(await storage.getItem('token')).toBeNull()
  })
})
