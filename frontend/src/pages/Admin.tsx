import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Shield, CheckCircle, AlertCircle, UserPlus, Link2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { Profile, Role } from '../lib/supabase'

interface Patient { id: string; name: string; room: string }
interface Assignment { id: number; caregiver_id: string; patient_name: string }

export default function Admin() {
  const { role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [profiles, setProfiles]       = useState<Profile[]>([])
  const [patients, setPatients]       = useState<Patient[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [saving, setSaving]           = useState<string | null>(null)
  const [toast, setToast]             = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const [newName, setNewName] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [adding, setAdding]   = useState(false)

  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') { navigate('/dashboard'); return }
    loadData()
  }, [role, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    const [{ data: prof }, { data: assign }, patientsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('patient_assignments').select('*'),
      api.get<Patient[]>('/patients').catch(() => ({ data: [] as Patient[] })),
    ])
    setProfiles(prof ?? [])
    setAssignments(assign ?? [])
    setPatients(patientsRes.data)
  }

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const addPatient = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const name = newName.trim()
      const room = newRoom.trim()

      const res = await api.post<Patient>('/patients', { name, room })
      setPatients(p => [...p, res.data])
      setNewName('')
      setNewRoom('')
      showToast('ok', `Patient "${name}" added`)
    } catch {
      showToast('err', 'Failed to add patient')
    }
    setAdding(false)
  }

  const copyInviteLink = (patientName: string, patientId: string) => {
    const link = `${window.location.origin}/register?patient=${encodeURIComponent(patientName)}`
    navigator.clipboard.writeText(link)
    setCopiedId(patientId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const updateRole = async (userId: string, newRole: Role) => {
    setSaving(userId + '_role')
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setSaving(null)
    if (error) { showToast('err', 'Failed to update role'); return }
    setProfiles(p => p.map(x => x.id === userId ? { ...x, role: newRole } : x))
    showToast('ok', 'Role updated')
  }

  const getAssignment = (userId: string) =>
    assignments.find(a => a.caregiver_id === userId)?.patient_name ?? ''

  const updateAssignment = async (userId: string, patientName: string) => {
    setSaving(userId + '_patient')
    const existing = assignments.find(a => a.caregiver_id === userId)

    if (!patientName) {
      if (existing) {
        await supabase.from('patient_assignments').delete().eq('id', existing.id)
        setAssignments(a => a.filter(x => x.caregiver_id !== userId))
      }
      setSaving(null)
      showToast('ok', 'Assignment removed')
      return
    }

    if (existing) {
      const { error } = await supabase.from('patient_assignments')
        .update({ patient_name: patientName }).eq('id', existing.id)
      if (!error) setAssignments(a => a.map(x => x.caregiver_id === userId ? { ...x, patient_name: patientName } : x))
    } else {
      const { data, error } = await supabase.from('patient_assignments')
        .insert({ caregiver_id: userId, patient_name: patientName }).select().single()
      if (!error && data) setAssignments(a => [...a, data])
    }

    setSaving(null)
    showToast('ok', 'Patient assigned')
  }

  const roleColors: Record<Role, string> = {
    admin:     'bg-red-100 text-red-700',
    caregiver: 'bg-blue-100 text-blue-700',
    viewer:    'bg-slate-100 text-slate-600',
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <div className="bg-navy text-white px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Shield size={24} className="text-sage" />
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-slate text-sm mt-0.5">Manage patients, users, and family access</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
            ${toast.type === 'ok' ? 'bg-sage text-white' : 'bg-red-500 text-white'}`}>
            {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}

        {/* ── Patients ── */}
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-slate/10 flex items-center gap-2">
            <UserPlus size={18} className="text-sage" />
            <h2 className="font-semibold text-navy">Patients</h2>
          </div>

          <div className="divide-y divide-slate/10">
            {patients.map(pt => (
              <div key={pt.id} className="px-6 py-3 flex items-center justify-between hover:bg-cream/40">
                <div>
                  <p className="text-sm font-medium text-navy">{pt.name}</p>
                  {pt.room && <p className="text-xs text-slate">{pt.room}</p>}
                </div>
                <button
                  onClick={() => copyInviteLink(pt.name, pt.id)}
                  className="flex items-center gap-1.5 text-xs text-sage border border-sage/40 rounded-lg px-3 py-1.5 hover:bg-sage/10 transition-colors"
                >
                  {copiedId === pt.id ? <CheckCircle size={13} /> : <Link2 size={13} />}
                  {copiedId === pt.id ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>
            ))}
          </div>

          {/* Add patient form */}
          <div className="px-6 py-4 bg-cream/30 border-t border-slate/10">
            <p className="text-xs font-semibold text-slate uppercase tracking-wider mb-3">Add Patient</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Patient name"
                className="input-field text-sm"
                onKeyDown={e => e.key === 'Enter' && addPatient()}
              />
              <input
                type="text"
                value={newRoom}
                onChange={e => setNewRoom(e.target.value)}
                placeholder="Room (optional)"
                className="input-field text-sm w-36"
                onKeyDown={e => e.key === 'Enter' && addPatient()}
              />
              <button
                onClick={addPatient}
                disabled={adding || !newName.trim()}
                className="btn-primary flex items-center gap-1.5 text-sm px-4 disabled:opacity-50 whitespace-nowrap"
              >
                <Plus size={15} />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* ── Users ── */}
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-slate/10 flex items-center gap-2">
            <Users size={18} className="text-sage" />
            <h2 className="font-semibold text-navy">Users ({profiles.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Assigned Patient</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id} className="border-b border-slate/10 hover:bg-cream/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-navy">{p.full_name}</p>
                      <p className="text-xs text-slate">{p.id.slice(0, 8)}…</p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[p.role]}`}>
                          {p.role}
                        </span>
                        <select
                          value={p.role}
                          onChange={e => updateRole(p.id, e.target.value as Role)}
                          disabled={saving === p.id + '_role'}
                          className="text-xs border border-slate/30 rounded-md px-2 py-1 bg-offwhite text-navy focus:outline-none focus:ring-1 focus:ring-sage"
                        >
                          <option value="admin">admin</option>
                          <option value="caregiver">caregiver</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={getAssignment(p.id)}
                        onChange={e => updateAssignment(p.id, e.target.value)}
                        disabled={saving === p.id + '_patient'}
                        className="text-xs border border-slate/30 rounded-md px-2 py-1 bg-offwhite text-navy focus:outline-none focus:ring-1 focus:ring-sage"
                      >
                        <option value="">— No assignment —</option>
                        {patients.map(pt => (
                          <option key={pt.id} value={pt.name}>{pt.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
