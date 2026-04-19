import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface PrivacyContextValue {
  isPrivate: boolean
  togglePrivacy: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

const STORAGE_KEY = 'memovia_privacy'

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isPrivate))
    } catch {
      // ignore
    }
  }, [isPrivate])

  const togglePrivacy = () => setIsPrivate(prev => !prev)

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
