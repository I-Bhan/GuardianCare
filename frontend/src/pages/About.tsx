import { Shield, Brain, Camera, Heart, Bell, Database, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const stack = [
  { name: 'YOLOv8', role: 'Fall detection model' },
  { name: 'DeepFace', role: 'Face recognition' },
  { name: 'FastAPI', role: 'REST API backend' },
  { name: 'Scikit-learn', role: 'Vitals risk classifier' },
  { name: 'Supabase', role: 'Auth & database' },
  { name: 'React + TypeScript', role: 'Frontend' },
]

const pipeline = [
  {
    step: '01',
    icon: <Camera size={22} className="text-sage" />,
    title: 'Frame Capture',
    description: 'A live camera feed sends frames to the GuardianCare API for real-time analysis.',
  },
  {
    step: '02',
    icon: <Brain size={22} className="text-sage" />,
    title: 'Fall Detection',
    description: 'A custom-trained YOLO model scans each frame and flags falls above the confidence threshold.',
  },
  {
    step: '03',
    icon: <Shield size={22} className="text-sage" />,
    title: 'Face Recognition',
    description: 'DeepFace identifies the person from a known-faces database, personalizing the response.',
  },
  {
    step: '04',
    icon: <Heart size={22} className="text-sage" />,
    title: 'Vitals Assessment',
    description: 'A trained ML classifier evaluates heart rate, SpO2, blood pressure, and temperature risk.',
  },
  {
    step: '05',
    icon: <Bell size={22} className="text-sage" />,
    title: 'Instant Alert',
    description: 'A Telegram alert with a snapshot and patient name is dispatched to caregivers within seconds.',
  },
  {
    step: '06',
    icon: <Database size={22} className="text-sage" />,
    title: 'Incident Logging',
    description: 'Every event is logged to a SQLite database and accessible via the GuardianCare dashboard.',
  },
]

export default function About() {
  return (
    <div className="min-h-screen bg-offwhite">
      {/* Header */}
      <section className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-sage/20 text-sage text-sm px-4 py-1.5 rounded-full mb-6">
            <Shield size={14} /> About GuardianCare
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
            Technology That Protects
          </h1>
          <p className="text-slate text-lg leading-relaxed max-w-2xl mx-auto">
            GuardianCare is an AI-powered elder care monitoring system that fuses computer vision,
            biometric recognition, and health analytics into a single real-time decision pipeline —
            giving caregivers peace of mind around the clock.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold text-navy mb-4">Our Mission</h2>
            <p className="text-slate leading-relaxed mb-4">
              Falls are the leading cause of injury among older adults. GuardianCare was built to
              close the gap between an incident happening and a caregiver being notified — reducing
              that window from minutes to seconds.
            </p>
            <p className="text-slate leading-relaxed">
              By combining state-of-the-art AI with a simple, actionable alert system, we help
              families and care facilities provide safer environments without constant manual surveillance.
            </p>
          </div>
          <div className="card grid grid-cols-2 gap-4">
            {[
              { label: 'Detection Threshold', value: '75%' },
              { label: 'Alert Delivery', value: '< 5s' },
              { label: 'Vitals Metrics', value: '4' },
              { label: 'API Endpoints', value: '7' },
            ].map((s) => (
              <div key={s.label} className="bg-offwhite rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-sage">{s.value}</p>
                <p className="text-xs text-slate mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Pipeline */}
      <section className="bg-cream py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-navy mb-3">The AI Pipeline</h2>
            <p className="text-slate max-w-xl mx-auto">
              From a raw video frame to a caregiver alert — here's how every incident is handled.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pipeline.map((step) => (
              <div key={step.step} className="bg-offwhite rounded-xl p-6 border border-slate/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-sage">{step.step}</span>
                  <div className="bg-sage/10 p-2 rounded-lg">{step.icon}</div>
                </div>
                <h3 className="font-semibold text-navy mb-2">{step.title}</h3>
                <p className="text-slate text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-navy mb-3">Technology Stack</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {stack.map((tech) => (
            <div key={tech.name} className="card flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-sage flex-shrink-0" />
              <div>
                <p className="font-medium text-navy text-sm">{tech.name}</p>
                <p className="text-slate text-xs">{tech.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-navy text-white py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Questions or Support?</h2>
          <p className="text-slate mb-6 text-sm">
            GuardianCare is developed at Imam Abdulrahman Bin Faisal University.
            For support or access requests, contact your system administrator.
          </p>
          <Link to="/login" className="btn-primary inline-flex items-center gap-2">
            Sign In to Dashboard <ChevronRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
