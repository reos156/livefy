// TokenStorage adapter: only this versioned envelope may be changed on disk.
function createTokenStorage({ store, safeStorage }) {
  const persistent = safeStorage.isEncryptionAvailable() &&
    safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
  const memory = new Map()

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
    async getItem(key) {
      if (!persistent) return memory.get(key) ?? null
      return decode(store.get(key))
    },
    async setItem(key, value) {
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
      if (!persistent) {
        memory.delete(key)
        return
      }
      if (writable(key)) store.delete(key)
    },
  }
}
module.exports = { createTokenStorage }
