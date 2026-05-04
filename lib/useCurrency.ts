import { useState, useEffect } from 'react'

export type Currency = 'ARS' | 'USD' | 'EUR'

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('ARS')

  useEffect(() => {
    const saved = (localStorage.getItem('crm-currency') as Currency) || 'ARS'
    setCurrency(saved)
  }, [])

  function formatAmount(value: number): string {
    if (currency === 'USD') {
      if (value >= 1000000) return `USD ${(value / 1000000).toFixed(1)}M`
      if (value >= 1000)    return `USD ${(value / 1000).toFixed(0)}k`
      return `USD ${value.toLocaleString('en-US')}`
    }
    if (currency === 'EUR') {
      if (value >= 1000000) return `€ ${(value / 1000000).toFixed(1)}M`
      if (value >= 1000)    return `€ ${(value / 1000).toFixed(0)}k`
      return `€ ${value.toLocaleString('es-ES')}`
    }
    // ARS
    if (value >= 1000000) return `$ ${(value / 1000000).toFixed(1)}M`
    if (value >= 1000)    return `$ ${(value / 1000).toFixed(0)}k`
    return `$ ${value.toLocaleString('es-AR')}`
  }

  return { currency, formatAmount }
}
