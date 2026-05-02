import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Activity, Eye, Bell, ChevronRight,
  AlertTriangle, Users, Zap
} from 'lucide-react'
import { fetchStats, fetchIncidents } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    icon: <Shield size={28} className="text-sage" />,
    title: 'Fall Detection',
    description: 'Real-time YOLO-powered fall detection from live camera feeds with high accuracy.',
  },
  {
    icon: <Activity size={28} className="text-sage" />,
    title: 'Vital Monitoring',
    description: 'AI risk classification for heart rate, SpO2, blood pressure, and temperature.',
  },
  {
    icon: <Eye size={28} className="text-sage" />,
    title: 'Face Recognition',
    description: 'DeepFace identification of who fell, enabling instant personalized response.',
  },
  {
    icon: <Bell size={28} className="text-sage" />,
    title: 'Real-time Alerts',
    description: 'Telegram notifications with snapshots delivered seconds after an incident.',
  },
]

export default function Home() {
  const { user } = useAuth()
  const [totalIncidents, setTotalIncidents] = useState<number | null>(null)
  const [totalPatients, setTotalPatients] = useState<number | null>(null)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    Promise.all([fetchIncidents(), fetchStats()])
      .then(([incRes, statRes]) => {
        setTotalIncidents(incRes.data.length)
        setTotalPatients(statRes.data.length)
      })
      .catch(() => setStatsError(true))
  }, [])

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 bg-sage/20 text-sage text-sm px-4 py-1.5 rounded-full mb-6">
            <Zap size={14} /> AI-Powered Elder Care
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Protecting Loved Ones<br />
            <span className="text-sage">24 / 7</span>
          </h1>
          <p className="text-slate text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
            GuardianCare combines computer vision, face recognition, and health
            monitoring to detect emergencies and alert caregivers in real time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {user ? (
              <Link to="/dashboard" className="btn-primary flex items-center gap-2">
                Go to Dashboard <ChevronRight size={18} />
              </Link>
            ) : (
              <Link to="/login" className="btn-primary flex items-center gap-2">
                Get Started <ChevronRight size={18} />
              </Link>
            )}
            <Link to="/about" className="btn-outline">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <AlertTriangle size={20} className="text-sage" />,
              label: 'Total Incidents',
              value: statsError ? '—' : totalIncidents !== null ? totalIncidents : '...',
            },
            {
              icon: <Users size={20} className="text-sage" />,
              label: 'Monitored Patients',
              value: statsError ? '—' : totalPatients !== null ? totalPatients : '...',
            },
            {
              icon: <Activity size={20} className="text-sage" />,
              label: 'System Status',
              value: statsError ? 'Offline' : 'Active',
            },
          ].map((stat) => (
            <div key={stat.label} className="card flex items-center gap-4">
              <div className="bg-sage/10 p-3 rounded-lg">{stat.icon}</div>
              <div>
                <p className="text-2xl font-bold text-navy">{String(stat.value)}</p>
                <p className="text-sm text-slate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-navy mb-3">How GuardianCare Works</h2>
          <p className="text-slate max-w-xl mx-auto">
            A complete AI pipeline that runs in real time — from detection to alert in seconds.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="card hover:shadow-md transition-shadow duration-200">
              <div className="bg-sage/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-navy mb-2">{f.title}</h3>
              <p className="text-slate text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy text-white py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-slate mb-8">
            Sign in to your GuardianCare account to monitor incidents and patient vitals.
          </p>
          {user ? (
            <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
              Go to Dashboard <ChevronRight size={18} />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary inline-flex items-center gap-2">
              Sign In <ChevronRight size={18} />
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
