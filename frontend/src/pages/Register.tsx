import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const patientName = searchParams.get('patient')

  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const [loading, setLoading]     = useState(false)

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name:    fullName,
          role:         patientName ? 'caregiver' : 'viewer',
          patient_name: patientName ?? null,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-offwhite flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-navy w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="text-sage" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-navy">Create an Account</h1>
          {patientName ? (
            <div className="mt-2 flex items-center gap-2 bg-sage/10 text-sage text-sm px-4 py-2 rounded-full font-medium">
              <UserCheck size={16} />
              Family of <span className="font-bold ml-1">{patientName}</span>
            </div>
          ) : (
            <p className="text-slate text-sm mt-1">Join GuardianCare</p>
          )}
        </div>

        <div className="card">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="mx-auto text-sage mb-3" size={40} />
              <p className="text-navy font-semibold mb-2">Account created!</p>
              <p className="text-slate text-sm mb-4">
                {patientName
                  ? `You're registered as a caregiver for ${patientName}.`
                  : 'Check your email to confirm your account.'}
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-11"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-navy transition-colors"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-navy font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
