import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Shield, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setHasSession(Boolean(data.session))
      setChecking(false)
    }).catch(() => {
      if (active) setChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return
        if (event === 'PASSWORD_RECOVERY' || session) {
          setHasSession(true)
          setChecking(false)
        }
      }
    )
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError(updateError.message)
    else setSuccess(true)
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-offwhite flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-navy w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="text-sage" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
        </div>
        <div className="card">
          {checking ? (
            <p className="text-slate text-sm">Checking your reset link...</p>
          ) : success ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-sage"><CheckCircle size={18} /> Password updated.</p>
              <Link to="/dashboard" className="btn-primary inline-block">Go to Dashboard</Link>
            </div>
          ) : !hasSession ? (
            <div className="space-y-4">
              <p className="text-slate text-sm">This reset link is invalid or has expired. Request a new one from the sign in page.</p>
              <Link to="/login" className="btn-primary inline-block">Back to Sign In</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <p className="flex items-center gap-2 state-danger text-sm"><AlertCircle size={16} /> {error}</p>}
              <label className="block text-sm font-medium text-ink">
                New password
                <input className="input-field mt-1.5" type="password" minLength={8} required
                  value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label className="block text-sm font-medium text-ink">
                Confirm password
                <input className="input-field mt-1.5" type="password" minLength={8} required
                  value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
              <button className="btn-primary w-full" type="submit" disabled={saving}>
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
