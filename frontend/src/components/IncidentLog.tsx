import { Fragment, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Search, Star } from 'lucide-react'
import type { Incident, VitalsReading } from '../lib/api'
import { riskInfo, formatReadingTime, type StarList } from './monitoring'

interface Props {
  incidents: Incident[]
  readings: Map<string, VitalsReading>
  stars: StarList
  loading: boolean
  error: string | null
}

export default function IncidentLog({ incidents, readings, stars, loading, error }: Props) {
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('All')
  const [order, setOrder] = useState('risk')
  const [onlyStars, setOnlyStars] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const rows = incidents.map(incident => {
    const reading = readings.get(incident.name)
    return { incident, reading, level: riskInfo(reading?.risk_level) }
  }).filter(({ incident, level }) =>
    incident.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (risk === 'All' || level.label === risk) && (!onlyStars || stars.has('incident:' + incident.id))
  ).sort((a, b) => (order === 'risk' ? a.level.rank - b.level.rank : 0) ||
    Date.parse(b.incident.timestamp) - Date.parse(a.incident.timestamp) || b.incident.id - a.incident.id)

  return <section aria-labelledby="incident-log-title" className="card overflow-hidden p-0">
    <header className="px-5 pt-4 flex items-center justify-between gap-3">
      <h2 id="incident-log-title" className="font-semibold flex items-center gap-2"><AlertTriangle size={17} className="text-sage" />Incidents Log</h2>
      {!loading && !error && <span role="status" className="text-xs text-slate">{rows.length} of {incidents.length} records</span>}
    </header>
    <p className="px-5 pt-1 text-sm text-slate">Risk reflects the patient’s latest available vitals, not the severity of the incident.</p>
    <div className="log-controls">
      <label className="log-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search incidents by patient" placeholder="Search patient name" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select className="log-select" aria-label="Filter by latest patient risk" value={risk} onChange={e => setRisk(e.target.value)}>
        {['All','High Risk','Medium Risk','Low Risk','Not assessed'].map(v => <option key={v} value={v}>{v === 'All' ? 'All risk levels' : v}</option>)}
      </select>
      <select className="log-select" aria-label="Sort incidents" value={order} onChange={e => setOrder(e.target.value)}>
        <option value="risk">Highest risk first</option><option value="recent">Newest first</option>
      </select>
      <button type="button" className="log-filter" aria-pressed={onlyStars} onClick={() => setOnlyStars(!onlyStars)}><Star size={15} fill={onlyStars ? 'currentColor' : 'none'} />Starred</button>
    </div>
    {error ? <p role="alert" className="log-empty state-danger">{error}</p> : loading ? <p className="log-empty">Loading incidents…</p> :
      !rows.length ? <div className="log-empty">{incidents.length ? <>No matching incidents. <button className="text-sage underline" onClick={() => {setQuery(''); setRisk('All'); setOnlyStars(false)}}>Clear filters</button></> : 'No incidents recorded yet.'}</div> :
      <div className="overflow-x-auto"><table className="log-table"><thead><tr><th><span className="sr-only">Star</span></th><th>Patient</th><th>Incident time</th><th>Latest vitals risk</th><th><span className="sr-only">Snapshot</span></th></tr></thead>
      <tbody>{rows.map(({incident: i, level, reading}) => {
        const key = 'incident:' + i.id, starred = stars.has(key), open = expanded === i.id
        return <Fragment key={i.id}><tr>
          <td><button className="monitor-star" title={starred ? 'Remove star' : 'Star incident'} aria-label={'Star incident for ' + i.name + ', ' + formatReadingTime(i.timestamp)} aria-pressed={starred} onClick={() => stars.toggle(key)}><Star size={17} fill={starred ? 'currentColor' : 'none'} /></button></td>
          <td className="font-medium">{i.name}</td><td className="text-slate">{formatReadingTime(i.timestamp)}</td>
          <td><span className={'log-risk ' + level.css} title={reading ? 'Vitals recorded ' + formatReadingTime(reading.timestamp) : undefined}>{level.label}</span></td>
          <td>{i.snapshot && <button className="monitor-star" aria-label={'Snapshot for ' + i.name} aria-expanded={open} onClick={() => setExpanded(open ? null : i.id)}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>}</td>
        </tr>{open && i.snapshot && <tr><td colSpan={5}><img className="max-h-48 rounded-lg" src={`data:image/jpeg;base64,${i.snapshot}`} alt={'Incident snapshot for ' + i.name} /></td></tr>}</Fragment>
      })}</tbody></table></div>}
  </section>
}
