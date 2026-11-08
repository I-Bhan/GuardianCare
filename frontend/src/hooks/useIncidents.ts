import { useState, useEffect, useCallback } from 'react'
import { isAxiosError } from 'axios'
import { fetchIncidents, fetchStats } from '../lib/api'
import type { Incident, Stat } from '../lib/api'

async function fetchIncidentData() {
  const [incRes, statRes] = await Promise.all([fetchIncidents(), fetchStats()])
  return { incidents: incRes.data, stats: statRes.data }
}

function loadError(err: unknown) {
  if (isAxiosError(err)) {
    if (!err.response) return 'Cannot reach GuardianCare. Check the connection and try Refresh.'
    if (err.response.status === 401) return 'Your session could not be verified. Sign in again.'
    if (err.response.status === 503) return 'GuardianCare is temporarily unavailable. Try Refresh in a moment.'
  }
  return 'Could not load incident data. Try Refresh.'
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchIncidentData()
      setIncidents(data.incidents)
      setStats(data.stats)
    } catch (err) {
      setError(loadError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchIncidentData()
      .then((data) => {
        if (!active) return
        setIncidents(data.incidents)
        setStats(data.stats)
      })
      .catch((err) => {
        if (active) setError(loadError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return { incidents, stats, loading, error, refresh: load }
}
