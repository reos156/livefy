// TokenStorage adapter: only this versioned envelope may be changed on disk.
function createTokenStorage({ store, safeStorage }) {
  const persistent = safeStorage.isEncryptionAvailable() &&
    safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
  const memory = new Map()
  let fenced = false

  function decode(record) {
    if (!record || typeof record !== 'object' || record.version !== 1 ||
        record.owner !== 'livefy-clerk' ||
        Object.keys(record).sort().join(',') !== 'ciphertext,owner,version' ||
        typeof record.ciphertext !== 'string' || !record.ciphertext) return null
    try {
      const bytes = Buffer.from(record.ciphertext, 'base64')
      if (bytes.toString('base64') !== record.ciphertext) return null
      return safeStorage.decryptString(bytes)
    } catch {
      return null
    }
  }

  function writable(key) {
    const record = store.get(key)
    return record === undefined || decode(record) !== null
  }

  return {
    persistence: persistent ? 'encrypted' : 'memory-only',
    async preserve() {
      fenced = true
      memory.clear()
      // This verifies local durability only; remote removal is the renderer's responsibility.
      const credential = persistent && safeStorage.isEncryptionAvailable() &&
        safeStorage.getSelectedStorageBackend?.() !== 'basic_text' && decode(store.get('__clerk_client_jwt'))
      if (typeof credential !== 'string' || !credential) throw new Error('Local logout incomplete')
    },
    async logout() {
      // Fence before touching disk: even failed deletion must exclude late SDK writes.
      fenced = true
      memory.clear()
      const key = '__clerk_client_jwt'
      const record = store.get(key)
      if (record === undefined) return
      if (!persistent || decode(record) === null) throw new Error('Local logout incomplete')
      store.delete(key)
      if (store.get(key) !== undefined) throw new Error('Local logout incomplete')
    },
    async getItem(key) {
      if (fenced) return null
      if (!persistent) return memory.get(key) ?? null
      return decode(store.get(key))
    },
    async setItem(key, value) {
      if (fenced) return
      if (!persistent) {
        memory.set(key, value)
        return
      }
      if (!writable(key)) return
      // Encryption failures never fall back to plaintext or overwrite existing data.
      const ciphertext = safeStorage.encryptString(value).toString('base64')
      store.set(key, { owner: 'livefy-clerk', version: 1, ciphertext })
    },
    async removeItem(key) {
      if (fenced) return
      if (!persistent) {
        memory.delete(key)
        return
      }
      if (writable(key)) store.delete(key)
    },
  }
}
module.exports = { createTokenStorage }
