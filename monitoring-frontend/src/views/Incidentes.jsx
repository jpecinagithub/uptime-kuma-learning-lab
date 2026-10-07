import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { apiGet, fmtDateTime, fmtDuration } from '../api.js'
import IncidentTimeline from '../components/IncidentTimeline.jsx'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

const RANGES = [
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
]

export default function Incidentes() {
  const [incidents, setIncidents] = useState(null)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('7d')
  const [open, setOpen] = useState({})
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setIncidents(null)
    apiGet(`/incidents?range=${range}`)
      .then(({ data }) => alive && setIncidents(data.incidents || []))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [range])

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div>
      <div className="page-head">
        <h1>Incidentes</h1>
        <p>Historial de caídas y recuperaciones detectadas por Uptime Kuma.</p>
      </div>

      <div className="section-head">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {RANGES.map((r) => (
            <button key={r.id} className={`tab${range === r.id ? ' active' : ''}`} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      <LearningTip title="Incidente">
        Un incidente empieza cuando Uptime Kuma confirma que un servicio no responde (tras varios
        intentos fallidos, no a la primera) y termina cuando el servicio vuelve a responder.
      </LearningTip>

      {error && <div className="error-box">No se pudieron cargar los incidentes: {error}</div>}
      {incidents === null && !error && (
        <div className="loading"><span className="spinner" /> Cargando…</div>
      )}

      {(incidents || []).map((inc) => {
        const isOpen = !!open[inc.id]
        return (
          <div key={inc.id} className={`card incident-card${inc.end ? ' recovered' : ''}`} style={{ marginBottom: 12 }}>
            <button className="expand-head" onClick={() => toggle(inc.id)}>
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span style={{ fontSize: 22 }}>{inc.end ? '🟢' : '🔴'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  <Link to={`/monitores/${inc.monitorId}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)' }}>
                    {inc.monitorName}
                  </Link>
                </div>
                <div className="hint">
                  {fmtDateTime(inc.start)}
                  {inc.end ? ` → ${fmtDateTime(inc.end)}` : ' → en curso'}
                  {inc.durationMs != null && <> · duración {fmtDuration(inc.durationMs)}</>}
                </div>
              </div>
              <span className={`badge ${inc.end ? 'green' : 'red'}`}>
                {inc.end ? 'Recuperado' : 'En curso'}
              </span>
            </button>
            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <IncidentTimeline events={inc.events} start={inc.start} end={inc.end} />
              </div>
            )}
          </div>
        )
      })}

      {incidents && incidents.length === 0 && (
        <div className="empty-state">Sin incidentes en este periodo. 🎉</div>
      )}

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>Así detecta Uptime Kuma una caída, paso a paso:</p>
        <div className="flow">
          <div className="flow-node">1 · Un check falla<small>timeout, HTTP 500, DNS…</small></div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">2 · Reintentos de confirmación<small>no se declara la caída al primer fallo</small></div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">3 · Se crea el incidente<small>empieza a contar el tiempo caído</small></div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">4 · Notificación<small>email, Telegram, Discord… (configurable)</small></div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">5 · Recuperación<small>el servicio responde → incidente cerrado</small></div>
        </div>
        <p>
          En esta pantalla ves el <strong>DOWN ↓ INCIDENT ↓ RECOVERY</strong> completo de cada
          incidente, con sus eventos y su duración total.
        </p>
      </ExplainModal>
    </div>
  )
}
