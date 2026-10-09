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
  return { records, store, safeStorage, storage: createTokenStorage({ store, safeStorage }) }
}

describe('encrypted Clerk token storage', () => {
  const key = '__clerk_client_jwt'
  it('restores encrypted credentials through a fresh adapter, then fences logout writes', async () => {
    const { storage, store, safeStorage } = fixture()
    await storage.setItem(key, 'client-token')
    const restarted = createTokenStorage({ store, safeStorage })
    expect(await restarted.getItem(key)).toBe('client-token')
    await restarted.logout()
    await restarted.setItem(key, 'delayed-response')
    expect(await restarted.getItem(key)).toBeNull()
    expect(await createTokenStorage({ store, safeStorage }).getItem(key)).toBeNull()
  })
  it('preserves an existing decryptable credential without replacement and fences SDK access', async () => {
    const { storage, store, safeStorage } = fixture()
    await storage.setItem(key, 'original')
    const original = store.get(key)
    await storage.preserve()
    expect(await storage.getItem(key)).toBeNull()
    await storage.setItem(key, 'late')
    await storage.removeItem(key)
    expect(await storage.getItem(key)).toBeNull()
    expect(store.get(key)).toBe(original)
    expect(await createTokenStorage({ store, safeStorage }).getItem(key)).toBe('original')
  })
  it.each([undefined, 'unowned', { owner: 'livefy-clerk', version: 1, ciphertext: 'YmFk' }, { owner: 'livefy-clerk', version: 1, ciphertext: 'ZW5jcnlwdGVkOg==' }])('refuses preservation without an owned decryptable credential (%j)', async record => {
    const { storage, store, records } = fixture()
    if (record !== undefined) records.set(key, record)
    await expect(storage.preserve()).rejects.toThrow('Local logout incomplete')
    await storage.setItem(key, 'late')
    await storage.removeItem(key)
    expect(await storage.getItem(key)).toBeNull()
    expect(store.get(key)).toBe(record)
  })
  it('keeps the record on preservation failure and permits safe deletion retry', async () => {
    const { storage, store, safeStorage } = fixture()
    await storage.setItem(key, 'original')
    const original = store.get(key)
    const decrypt = safeStorage.decryptString
    safeStorage.decryptString = () => { throw new Error('unavailable') }
    await expect(storage.preserve()).rejects.toThrow()
    expect(store.get(key)).toBe(original)
    safeStorage.decryptString = decrypt
    await storage.logout()
    expect(store.get(key)).toBeUndefined()
  })
  it.each([[false, 'dpapi'], [true, 'basic_text']])('refuses preservation without encryption capability (%s/%s)', async (available, backend) => {
    const { storage, store, safeStorage } = fixture()
    await storage.setItem(key, 'original')
    const original = store.get(key)
    safeStorage.isEncryptionAvailable = () => available
    safeStorage.getSelectedStorageBackend = () => backend
    await expect(createTokenStorage({ store, safeStorage }).preserve()).rejects.toThrow('Local logout incomplete')
    expect(store.get(key)).toBe(original)
    await expect(storage.preserve()).rejects.toThrow('Local logout incomplete')
    expect(await storage.getItem(key)).toBeNull()
    expect(store.get(key)).toBe(original)
  })
  it('propagates encryption failure without overwriting the previous record', async () => {
    const { storage, records, safeStorage } = fixture()
    await storage.setItem(key, 'original')
    const original = records.get(key)
    safeStorage.encryptString = () => { throw new Error('encryption failed') }
    await expect(storage.setItem(key, 'replacement')).rejects.toThrow()
    expect(records.get(key)).toEqual(original)
  })
  it('fails closed on deletion failure and allows a deletion retry', async () => {
    const { storage, store } = fixture()
    await storage.setItem(key, 'original')
    const remove = store.delete
    store.delete = () => { throw new Error('disk failure') }
    await expect(storage.logout()).rejects.toThrow()
    expect(await storage.getItem(key)).toBeNull()
    await storage.setItem(key, 'late')
    store.delete = remove
    await storage.logout()
    expect(store.get(key)).toBeUndefined()
  })
  it('preserves refused logout records and reports failure', async () => {
    const { storage, records } = fixture()
    records.set(key, 'unowned')
    await expect(storage.logout()).rejects.toThrow()
    expect(records.get(key)).toBe('unowned')
    expect(await storage.getItem(key)).toBeNull()
  })
  it('clears memory-only credentials and fences subsequent writes', async () => {
    const { storage } = fixture(false)
    await storage.setItem(key, 'original')
    await storage.logout()
    await storage.setItem(key, 'late')
    expect(await storage.getItem(key)).toBeNull()
  })
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
