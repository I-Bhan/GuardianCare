import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import {
  AlertTriangle, Users, RefreshCw, Clock, ShieldAlert,
  Heart, Activity, Star,
} from 'lucide-react'
import PatientRoster from '../components/PatientRoster'
import IncidentLog from '../components/IncidentLog'
import { formatReadingTime as fmt, riskInfo, useMonitoringStars, type StarList } from '../components/monitoring'
import { useAuth }      from '../hooks/useAuth'
import { useIncidents } from '../hooks/useIncidents'
import { supabase }     from '../lib/supabase'
import { fetchVitals, fetchPatients } from '../lib/api'
import type { Incident, VitalsReading, Patient } from '../lib/api'

// ── helpers ────────────────────────────────────────────────────────────────

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, sub, alert,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  sub?: string
  alert?: boolean
}) {
  return (
    <div className={'overview-cell' + (alert ? ' overview-alert' : '')}>
      <div className="overview-label"><span>{label}</span>{icon}</div>
      <div className="overview-reading"><strong>{value}</strong>{sub && <span>{sub}</span>}</div>
    </div>
  )
}

function PatientVitalCard({ v, stars }: { v: VitalsReading; stars: StarList }) {
  const metrics = [
    { label: 'HR',   name: 'Heart rate', value: v.heart_rate, unit: 'bpm' },
    { label: 'SpO₂', name: 'Oxygen', value: v.oxygen_saturation, unit: '%' },
    { label: 'Temp', name: 'Temperature', value: v.body_temperature, unit: '°C' },
    { label: 'BP',   name: 'Blood pressure', value: `${v.systolic_bp}/${v.diastolic_bp}`, unit: 'mmHg' },
  ]
  return (
    <div className="vital-tile">
      <div className="vital-head">
        <div>
          <p className="vital-name">{v.patient_name}</p>
          <p className="text-xs text-slate mt-0.5">{fmt(v.timestamp)}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${riskInfo(v.risk_level).css}`}>
          {riskInfo(v.risk_level).label}
        </span>
      </div>
      <div className="vital-measures">
        {metrics.sort((a, b) => Number(stars.has('metric:' + b.label)) - Number(stars.has('metric:' + a.label))).map((m) => (
          <div key={m.label} className="vital-measure">
            <span className="measure-label">{m.name}</span>
            <button type="button" className="monitor-star metric-star" title={'Prioritize ' + m.label + ' across patients'} aria-label={'Prioritize ' + m.label} aria-pressed={stars.has('metric:' + m.label)} onClick={() => stars.toggle('metric:' + m.label)}>
              <Star size={14} fill={stars.has('metric:' + m.label) ? 'currentColor' : 'none'} />
            </button>
            <span className="measure-value">{m.value}<small>{m.unit}</small></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  return user ? <AccountDashboard key={user.id} userId={user.id} /> : null
}

function AccountDashboard({ userId }: { userId: string }) {
  const stars = useMonitoringStars(userId)
  const { role, user } = useAuth()
  const { incidents, stats, loading, error, refresh } = useIncidents()

  const [assignedPatients, setAssignedPatients] = useState<string[]>([])
  const [allVitals,        setAllVitals]        = useState<VitalsReading[]>([])
  const [selectedPatient,  setSelectedPatient]  = useState<string>('')
  const [patients,         setPatients]         = useState<Patient[]>([])

  // ── non-admin: load assigned patients (works for caregiver & viewer) ───
  useEffect(() => {
    if (role === 'admin' || !user) return
    supabase
      .from('patient_assignments')
      .select('patient_name')
      .eq('caregiver_id', user.id)
      .then(({ data }) => {
        if (data) setAssignedPatients(data.map((r) => r.patient_name))
      })
  }, [role, user])

  // ── vitals & patients ───────────────────────────────────────────────────
  const loadVitals = useCallback(async () => {
    try {
      const res = await fetchVitals()
      setAllVitals(res.data)
    } catch { /* API not ready */ }
  }, [])

  const loadPatients = useCallback(async () => {
    try {
      const res = await fetchPatients()
      setPatients(res.data)
    } catch { /* API not ready */ }
  }, [])

  useEffect(() => {
    let active = true
    fetchVitals()
      .then(({ data }) => { if (active) setAllVitals(data) })
      .catch(() => { /* API not ready */ })
    fetchPatients()
      .then(({ data }) => { if (active) setPatients(data) })
      .catch(() => { /* API not ready */ })
    return () => { active = false }
  }, [])

  // ── derived data ────────────────────────────────────────────────────────
  const visibleIncidents: Incident[] =
    role === 'admin'
      ? incidents
      : incidents.filter((i) => assignedPatients.includes(i.name))

  const visiblePatients: Patient[] =
    role === 'admin'
      ? patients
      : patients.filter((p) => assignedPatients.includes(p.name))

  // latest reading per patient (for cards)
  const latestByPatient = new Map<string, VitalsReading>()
  for (const v of allVitals) {
    if (!latestByPatient.has(v.patient_name)) latestByPatient.set(v.patient_name, v)
  }
  const allLatestVitals = Array.from(latestByPatient.values())
  const latestVitals =
    role === 'admin'
      ? allLatestVitals
      : allLatestVitals.filter((v) => assignedPatients.includes(v.patient_name))

  // Only associate alerts with identified patients who have one matching registered name.
  const registeredCounts = new Map<string, number>()
  for (const p of visiblePatients) registeredCounts.set(p.name, (registeredCounts.get(p.name) ?? 0) + 1)
  const incidentReadings = new Map(latestVitals.filter(v =>
    v.patient_name && v.patient_name.toLowerCase() !== 'unknown' && registeredCounts.get(v.patient_name) === 1
  ).map(v => [v.patient_name, v]))
  const prioritizedVitals = [...latestVitals].sort((a, b) =>
    riskInfo(a.risk_level).rank - riskInfo(b.risk_level).rank || Date.parse(b.timestamp) - Date.parse(a.timestamp))

  // patient selector
  const patientNames = latestVitals.map((v) => v.patient_name)
  const activePatient = selectedPatient || patientNames[0] || ''

  // vitals trend for selected patient (last 20, oldest first for chart)
  const trendData = allVitals
    .filter((v) => v.patient_name === activePatient)
    .slice(0, 20)
    .reverse()
    .map((v) => ({
      time:  fmtTime(v.timestamp),
      HR:    v.heart_rate,
      SpO2:  v.oxygen_saturation,
      Temp:  v.body_temperature,
    }))

  // fall counts — exclude Unknown, sort descending
  const fallCounts = stats
    .filter((s) => s.name && s.name !== 'Unknown')
    .sort((a, b) => b.count - a.count)

  // today's high-risk count
  const todayHighRisk = allVitals.filter((v) => {
    const isToday = new Date(v.timestamp).toDateString() === new Date().toDateString()
    return isToday && v.risk_level === 'High Risk'
  }).length

  const handleRefresh = () => { refresh(); loadVitals(); loadPatients() }

  return (
    <div className="min-h-screen bg-offwhite">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="workspace-heading px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 workspace-refresh text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="care-overview">
          <StatCard
            icon={<AlertTriangle size={20} />}
            value={loading || error ? '—' : visibleIncidents.length}
            label="Total Incidents"
          />
          <StatCard
            icon={<Users size={20} />}
            value={loading || error ? '—' : fallCounts.length}
            label="Patients with incidents"
          />
          <StatCard
            icon={<Clock size={20} />}
            value={loading || error ? '—' : visibleIncidents.filter(i => new Date(i.timestamp).toDateString() === new Date().toDateString()).length}
            label="Today's Incidents"
          />
          <StatCard
            icon={<ShieldAlert size={20} />}
            value={todayHighRisk}
            label="High Risk Today"
            sub="vital readings"
            alert={todayHighRisk > 0}
          />
        </div>

        {/* ── Registered patients ────────────────────────────────────────── */}
        {visiblePatients.length > 0 && <PatientRoster patients={visiblePatients} />}

        {/* ── Patient vitals cards ────────────────────────────────────────── */}
        {latestVitals.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-ink mb-3 flex items-center gap-2">
              <Activity size={17} className="text-sage" /> Current Patient Status
            </h2>
            <p className="mb-3 text-sm text-slate">Highest risk first. Star a vital sign to show it first for every patient.</p>
            <div className="vital-grid">
              {prioritizedVitals.map((v) => (
                <PatientVitalCard key={v.patient_name} v={v} stars={stars} />
              ))}
            </div>
          </div>
        )}

        {/* ── Vitals trend chart ──────────────────────────────────────────── */}
        {trendData.length > 1 && (
          <div className="card">
            <div className="trend-heading">
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                <Heart size={17} className="text-sage" /> Vitals Trend
              </h2>
              {patientNames.length > 1 && (
                <>
                <label className="trend-picker">Patient
                  <select value={activePatient} onChange={e => setSelectedPatient(e.target.value)}>
                    {patientNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <div className="trend-patients">
                  {patientNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedPatient(name)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        activePatient === name
                          ? 'tone-sage border-sage'
                          : 'text-slate border-slate/30 hover:border-sage'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                </>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--text-soft)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--text-soft)" />
                <Tooltip cursor={{ stroke: 'var(--field-line)', fill: 'var(--surface-muted)' }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="HR"   stroke="var(--accent)" strokeWidth={2} dot={false} name="Heart Rate (bpm)" />
                <Line type="monotone" dataKey="SpO2" strokeDasharray="7 3" stroke="var(--chart-blue)" strokeWidth={2} dot={false} name="SpO₂ (%)" />
                <Line type="monotone" dataKey="Temp" strokeDasharray="2 3" stroke="var(--warning)" strokeWidth={2} dot={false} name="Temp (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Fall counts bar chart ───────────────────────────────────────── */}
        {fallCounts.length > 0 && (
          <div className="card">
            <h2 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
              <ShieldAlert size={17} className="text-sage" /> Fall Incidents per Patient
            </h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={fallCounts} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--text-soft)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-soft)" />
                <Tooltip cursor={{ stroke: 'var(--field-line)', fill: 'var(--surface-muted)' }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Falls" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Incidents log ───────────────────────────────────────────────── */}
        <IncidentLog incidents={visibleIncidents} readings={incidentReadings} stars={stars} loading={loading} error={error} />

      </div>
    </div>
  )
}
