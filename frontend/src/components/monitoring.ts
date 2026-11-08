import { useState } from 'react'

export const formatReadingTime = (ts: string) => new Date(ts).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
})

const levels = [
  { label: 'High Risk', css: 'risk-high', rank: 0 },
  { label: 'Medium Risk', css: 'risk-medium', rank: 1 },
  { label: 'Low Risk', css: 'risk-low', rank: 2 },
]
export const riskInfo = (level?: string) => levels.find(item => item.label === level) ??
  { label: 'Not assessed', css: 'tone-neutral', rank: 3 }

// Dashboard is keyed by account; preferences contain only metric keys and incident IDs.
export function useMonitoringStars(userId: string) {
  const storageKey = 'gc:monitoring-stars:v1:' + userId
  const [keys, setKeys] = useState<Set<string>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return new Set(Array.isArray(saved) ? saved.filter(k => typeof k === 'string') : [])
    } catch { return new Set() }
  })
  return {
    has: (key: string) => keys.has(key),
    toggle: (key: string) => {
      const next = new Set(keys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setKeys(next)
      try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch { /* Session-only if storage unavailable. */ }
    },
  }
}
export type StarList = ReturnType<typeof useMonitoringStars>
