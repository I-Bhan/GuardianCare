import axios from 'axios'
import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8001'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export interface Incident {
  id: number
  name: string
  timestamp: string
  confidence: number
  snapshot?: string
}

export interface Stat {
  name: string
  count: number
}

export interface VitalsPayload {
  heart_rate: number
  oxygen_saturation: number
  systolic_bp: number
  diastolic_bp: number
  body_temperature: number
}

export interface VitalsResult {
  risk_level: string
  confidence: number
  details: string
}

export interface Patient {
  id: string
  name: string
  room: string
}

export interface VitalsReading {
  id: number
  patient_name: string
  heart_rate: number
  body_temperature: number
  oxygen_saturation: number
  systolic_bp: number
  diastolic_bp: number
  risk_level: string
  confidence: number
  timestamp: string
}

export const fetchPatients  = () => api.get<Patient[]>('/patients')
export const healthCheck    = () => api.get<{ status: string; models_loaded: boolean }>('/health')
export const fetchIncidents = () => api.get<Incident[]>('/incidents')
export const fetchStats     = () => api.get<Stat[]>('/stats')
export const fetchVitals    = () => api.get<VitalsReading[]>('/vitals')

export const fetchIncidentsByName = (name: string) =>
  api.get<Incident[]>(`/incidents/${name}`)

export const analyzeVitals = (payload: VitalsPayload) =>
  api.post<VitalsResult>('/analyze_vitals', payload)

export const processFrame = (base64Frame: string) =>
  api.post('/process_frame', { frame_b64: base64Frame })

export const processEvent = (payload: { frame_b64: string } & VitalsPayload) =>
  api.post('/process_event', payload)
