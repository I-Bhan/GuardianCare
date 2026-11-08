import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Activity, Eye, Bell,
  HeartPulse
} from 'lucide-react'
import { fetchStats, fetchIncidents, healthCheck } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

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
  const [systemStatus, setSystemStatus] = useState('Checking...')

  useEffect(() => {
    let active = true
    const check = () => {
      healthCheck()
        .then(({ data }) => {
          if (active) setSystemStatus(data.models_loaded ? 'Active' : 'Starting')
        })
        .catch(() => {
          if (active) setSystemStatus('Offline')
        })
    }
    check()
    const interval = window.setInterval(check, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([fetchIncidents(), fetchStats()])
      .then(([incRes, statRes]) => {
        if (!active) return
        setTotalIncidents(incRes.data.length)
        setTotalPatients(statRes.data.length)
      })
      .catch(() => {
        if (active) setStatsError(true)
      })
    return () => { active = false }
  }, [user])

  const preview = user ? [
    ['Total incidents', totalIncidents], ['Monitored patients', totalPatients],
  ] : [
    ['Heart rate', '72 bpm'], ['Oxygen saturation', '98%'], ['Temperature', '36.6 °C'],
  ]

  return (
    <div className="care-home">
      <section className="hero">
        <div className="wrap hero-copy">
          <h1>GuardianCare monitoring platform</h1>
          <p>Monitor vital signs, review falls, and follow caregiver alerts from one dashboard.</p>
          <div className="hero-actions">
            <Link className="btn-primary" to={user ? '/dashboard' : '/login'}>{user ? 'Open dashboard' : 'Sign in to GuardianCare'}</Link>
            <a className="btn-outline" href="#services">Explore services</a>
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="product-shot" aria-label={user ? 'Care overview' : 'Illustrative dashboard preview'}>
          <div className="shot-nav" aria-hidden="true"><span className="active">Care overview</span><span>Vital signs</span><span>Incidents</span></div>
          <div className="shot-main">
            <div className="shot-title">
              <strong>{user ? 'Care overview' : 'Patient monitoring preview'}</strong>
              <span className={'health-state ' + (systemStatus === 'Active' ? 'is-active' : '')}>System {systemStatus.toLowerCase()}</span>
            </div>
            <div className="shot-facts">{preview.map(([label, value]) =>
              <div key={label}><span>{label}</span><b>{(user && statsError) ? '—' : value ?? '…'}</b></div>)}</div>
            <div className="source-note"><HeartPulse size={16} />{user ? 'Open the dashboard to review patient activity.' : 'Example readings · Sign in to view your patients.'}</div>
          </div>
        </section>
        <section className="section" id="services">
          <div className="section-head"><h2>Monitoring services</h2></div>
          <div className="services">{features.map(f => <article key={f.title} className="service">{f.icon}<h3>{f.title}</h3><p>{f.description}</p></article>)}</div>
        </section>
        <section className="cta-band">
          <div><h2>Caregiver dashboard</h2><p>Review patient readings and recent incidents.</p></div>
          <Link className="btn-primary" to={user ? '/dashboard' : '/login'}>{user ? 'Open dashboard' : 'Sign in'}</Link>
        </section>
        <footer className="site-footer"><span>GuardianCare</span><Link to="/about">About GuardianCare</Link></footer>
      </div>
    </div>
  )
}
