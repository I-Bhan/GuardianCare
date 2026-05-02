import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import {
  AlertTriangle, Users, RefreshCw, Clock, ShieldAlert,
  Heart, Thermometer, Wind, Activity, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useIncidents } from '../hooks/useIncidents'
import { supabase }     from '../lib/supabase'
import { fetchVitals, fetchPatients } from '../lib/api'
import type { Incident, VitalsReading, Patient } from '../lib/api'

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

function riskBadge(level: string) {
  if (level === 'High Risk')   return 'bg-red-100   text-red-700   border-red-200'
  if (level === 'Medium Risk') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

function riskBorder(level: string) {
  if (level === 'High Risk')   return 'border-l-red-400'
  if (level === 'Medium Risk') return 'border-l-amber-400'
  return 'border-l-emerald-400'
}

// ── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, sub, color,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  sub?: string
  color: string
}) {
  return (
    <div className={`card flex items-center gap-4 border-l-4 ${color}`}>
      <div className="bg-navy/5 p-3 rounded-xl">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-navy leading-none">{value}</p>
        <p className="text-sm text-slate mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function PatientVitalCard({ v }: { v: VitalsReading }) {
  const metrics = [
    { icon: <Heart size={13} />,       label: 'HR',   value: `${v.heart_rate} bpm` },
    { icon: <Wind size={13} />,        label: 'SpO₂', value: `${v.oxygen_saturation}%` },
    { icon: <Thermometer size={13} />, label: 'Temp', value: `${v.body_temperature}°C` },
    { icon: <Activity size={13} />,    label: 'BP',   value: `${v.systolic_bp}/${v.diastolic_bp}` },
  ]
  return (
    <div className={`card border-l-4 ${riskBorder(v.risk_level)} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-navy text-sm">{v.patient_name}</p>
          <p className="text-xs text-slate mt-0.5">{fmt(v.timestamp)}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${riskBadge(v.risk_level)}`}>
          {v.risk_level}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center gap-1.5 text-xs text-slate">
            <span className="text-navy/50">{m.icon}</span>
            <span className="font-medium text-navy">{m.value}</span>
            <span className="text-slate/60">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IncidentRow({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        className="border-b border-slate/10 hover:bg-cream/40 cursor-pointer transition-colors"
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3 text-sm font-medium text-navy">{incident.name}</td>
        <td className="px-4 py-3 text-sm text-slate">{fmt(incident.timestamp)}</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium border border-red-100">
            <AlertTriangle size={11} /> Alert
          </span>
        </td>
        <td className="px-4 py-3 text-slate">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </td>
      </tr>
      {open && incident.snapshot && (
        <tr className="bg-cream/30">
          <td colSpan={4} className="px-4 py-3">
            <img
              src={`data:image/jpeg;base64,${incident.snapshot}`}
              alt="snapshot"
              className="max-h-48 rounded-lg object-contain border border-slate/20"
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ── main ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile, role, user } = useAuth()
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

  useEffect(() => { loadVitals(); loadPatients() }, [loadVitals, loadPatients])

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
      <div className="bg-navy text-white px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-slate text-sm mt-1">
              Welcome back, <span className="text-white font-medium">{profile?.full_name}</span>
              <span className="ml-2 bg-sage/20 text-sage text-xs px-2 py-0.5 rounded-full uppercase tracking-wide">
                {role}
              </span>
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<AlertTriangle size={20} className="text-red-500" />}
            value={incidents.length}
            label="Total Incidents"
            color="border-l-red-400"
          />
          <StatCard
            icon={<Users size={20} className="text-blue-500" />}
            value={fallCounts.length}
            label="Monitored Patients"
            color="border-l-blue-400"
          />
          <StatCard
            icon={<Clock size={20} className="text-amber-500" />}
            value={visibleIncidents.filter(i => new Date(i.timestamp).toDateString() === new Date().toDateString()).length}
            label="Today's Incidents"
            color="border-l-amber-400"
          />
          <StatCard
            icon={<ShieldAlert size={20} className="text-emerald-600" />}
            value={todayHighRisk}
            label="High Risk Today"
            sub="from vitals"
            color="border-l-emerald-400"
          />
        </div>

        {/* ── Registered patients ────────────────────────────────────────── */}
        {visiblePatients.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-navy mb-3 flex items-center gap-2">
              <Users size={17} className="text-sage" /> Registered Patients
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {visiblePatients.map((p) => (
                <div key={p.id} className="card flex items-center gap-3 p-4">
                  <div className="bg-sage/10 p-2.5 rounded-xl shrink-0">
                    <Users size={16} className="text-sage" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-navy text-sm truncate">{p.name}</p>
                    {p.room
                      ? <p className="text-xs text-slate">{p.room}</p>
                      : <p className="text-xs text-slate/50">No room</p>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Patient vitals cards ────────────────────────────────────────── */}
        {latestVitals.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-navy mb-3 flex items-center gap-2">
              <Activity size={17} className="text-sage" /> Current Patient Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestVitals.map((v) => (
                <PatientVitalCard key={v.patient_name} v={v} />
              ))}
            </div>
          </div>
        )}

        {/* ── Vitals trend chart ──────────────────────────────────────────── */}
        {trendData.length > 1 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-navy flex items-center gap-2">
                <Heart size={17} className="text-sage" /> Vitals Trend
              </h2>
              {patientNames.length > 1 && (
                <div className="flex gap-1">
                  {patientNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedPatient(name)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        activePatient === name
                          ? 'bg-navy text-white border-navy'
                          : 'text-slate border-slate/30 hover:border-navy/40'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="HR"   stroke="#ef4444" strokeWidth={2} dot={false} name="Heart Rate (bpm)" />
                <Line type="monotone" dataKey="SpO2" stroke="#3b82f6" strokeWidth={2} dot={false} name="SpO₂ (%)" />
                <Line type="monotone" dataKey="Temp" stroke="#f59e0b" strokeWidth={2} dot={false} name="Temp (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Fall counts bar chart ───────────────────────────────────────── */}
        {fallCounts.length > 0 && (
          <div className="card">
            <h2 className="text-base font-semibold text-navy mb-4 flex items-center gap-2">
              <ShieldAlert size={17} className="text-sage" /> Fall Incidents per Patient
            </h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={fallCounts} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" fill="#5e8c7a" radius={[4, 4, 0, 0]} name="Falls" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Incidents log ───────────────────────────────────────────────── */}
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-slate/10 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy flex items-center gap-2">
              <AlertTriangle size={17} className="text-sage" /> Incidents Log
            </h2>
            <span className="text-xs text-slate bg-slate/10 px-2 py-0.5 rounded-full">
              {visibleIncidents.length} records
            </span>
          </div>

          {error && (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-red-500 font-medium">{error}</p>
              <p className="text-xs text-slate mt-1">Make sure the GuardianCare API server is running.</p>
            </div>
          )}

          {!error && loading && (
            <div className="px-6 py-10 text-center">
              <div className="w-6 h-6 border-2 border-sage border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate">Loading incidents…</p>
            </div>
          )}

          {!error && !loading && visibleIncidents.length === 0 && (
            <div className="px-6 py-10 text-center text-slate text-sm">
              No incidents recorded yet.
            </div>
          )}

          {!error && !loading && visibleIncidents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream/60 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Patient</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {visibleIncidents.map((inc) => (
                    <IncidentRow key={inc.id} incident={inc} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
