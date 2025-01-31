"use client"

import { ReactNode, useEffect } from 'react'
import { useClaimsStore } from '../stores/claims-store'

interface ClaimsProviderProps {
  children: ReactNode
}

export function ClaimsProvider({ children }: ClaimsProviderProps) {
  const { fetchAllClaims } = useClaimsStore()

  useEffect(() => {
    fetchAllClaims()
  }, [fetchAllClaims])
  
  return <>{children}</>
} 