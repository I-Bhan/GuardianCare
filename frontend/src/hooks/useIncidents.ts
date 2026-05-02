import { useState, useEffect, useCallback } from 'react'
import { fetchIncidents, fetchStats } from '../lib/api'
import type { Incident, Stat } from '../lib/api'

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [incRes, statRes] = await Promise.all([fetchIncidents(), fetchStats()])
      setIncidents(incRes.data)
      setStats(statRes.data)
    } catch {
      setError('Failed to load data from GuardianCare server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { incidents, stats, loading, error, refresh: load }
}
