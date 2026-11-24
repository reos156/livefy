import { createContext, useContext, type ReactNode } from 'react'

const AuthConfigured = createContext(false)
export function useAuthConfigured() { return useContext(AuthConfigured) }
export function AuthConfiguration({ configured, children }: { configured: boolean; children: ReactNode }) {
  return <AuthConfigured.Provider value={configured}>{children}</AuthConfigured.Provider>
}
