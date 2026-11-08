import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import type { Patient } from '../lib/api'

export default function PatientRoster({ patients }: { patients: Patient[] }) {
  const track = useRef<HTMLUListElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const [range, setRange] = useState('')
  useEffect(() => {
    const el = track.current
    if (!el) return
    function update() {
      if (!el) return
      const { scrollLeft, clientWidth, scrollWidth } = el
      setEdges({ start: scrollLeft < 2, end: scrollWidth - clientWidth - scrollLeft < 2 })
      const stride = (el.firstElementChild?.getBoundingClientRect().width ?? clientWidth) + parseFloat(getComputedStyle(el).columnGap)
      const first = Math.round(scrollLeft / stride) + 1
      const count = Math.round((clientWidth + parseFloat(getComputedStyle(el).columnGap)) / stride)
      setRange(first + '–' + Math.min(patients.length, first + count - 1) + ' of ' + patients.length)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => { observer.disconnect(); el.removeEventListener('scroll', update) }
  }, [patients.length])
  function move(direction: number) {
    const el = track.current
    if (el) el.scrollBy({left: direction * (el.clientWidth + parseFloat(getComputedStyle(el).columnGap)), behavior: 'auto'})
  }
  return <section aria-labelledby="roster-title">
    <div className="roster-head">
      <h2 id="roster-title"><Users size={17} />Registered Patients</h2>
      <div className="roster-pager"><span>{range}</span>
        <button type="button" aria-label="Previous patients" aria-controls="registered-roster" disabled={edges.start} onClick={() => move(-1)}><ChevronLeft size={16}/></button>
        <button type="button" aria-label="Next patients" aria-controls="registered-roster" disabled={edges.end} onClick={() => move(1)}><ChevronRight size={16}/></button>
      </div>
    </div>
    <ul ref={track} id="registered-roster" className="patient-roster" aria-label="Registered patients, scroll horizontally" tabIndex={0}
      onPointerDown={e => {
        if (e.pointerType !== 'mouse' || e.button !== 0 || edges.start && edges.end) return
        const el = e.currentTarget
        drag.current = { x: e.clientX, left: el.scrollLeft }
        el.dataset.dragging = 'true'
        el.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => { if (drag.current) e.currentTarget.scrollLeft = drag.current.left + drag.current.x - e.clientX }}
      onLostPointerCapture={e => {
        if (!drag.current) return
        const el = e.currentTarget
        const left = el.scrollLeft
        drag.current = null
        delete el.dataset.dragging
        el.scrollTo({ left, behavior: 'instant' })
      }}>
      {patients.map(p => <li key={p.id}><span className="roster-initial" aria-hidden="true">{Array.from(p.name.trim())[0]?.toLocaleUpperCase()}</span><div>
        <strong>{p.name}</strong><span>{p.room ? (/^\d+$/.test(p.room.trim()) ? 'Room ' + p.room : p.room) : 'No room assigned'}</span>
      </div></li>)}
    </ul>
  </section>
}
