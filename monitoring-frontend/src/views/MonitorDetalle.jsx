import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { apiGet, fmtDateTime } from '../api.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LatencyChart from '../components/LatencyChart.jsx'
import UptimeBlocks from '../components/UptimeBlocks.jsx'
import IncidentTimeline from '../components/IncidentTimeline.jsx'
import CheckVisualizer from '../components/CheckVisualizer.jsx'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

const RANGES = [
  { id: '1h', label: '1 hora' },
  { id: '6h', label: '6 horas' },
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
]

export default function MonitorDetalle() {
  const { id } = useParams()
  const [monitor, setMonitor] = useState(null)
  const [history, setHistory] = useState(null)
  const [history30, setHistory30] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [range, setRange] = useState('24h')
  const [error, setError] = useState(null)
  const [showCheck, setShowCheck] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setMonitor(null)
    setHistory(null)
    apiGet(`/monitors/${id}`)
      .then(({ data }) => alive && setMonitor(data.monitor))
      .catch((e) => alive && setError(e.message))
    apiGet(`/monitors/${id}/history?range=30d`)
      .then(({ data }) => alive && setHistory30(data.points || []))
      .catch(() => {})
    apiGet('/incidents?range=30d')
      .then(({ data }) => alive && setIncidents((data.incidents || []).filter((i) => String(i.monitorId) === String(id))))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    let alive = true
    setHistory(null)
    apiGet(`/monitors/${id}/history?range=${range}`)
      .then(({ data }) => alive && setHistory(data.points || []))
      .catch(() => alive && setHistory([]))
    return () => {
      alive = false
    }
  }, [id, range])

  if (error) return <div className="error-box">No se pudo cargar el monitor: {error}</div>
  if (!monitor) {
    return (
      <div className="loading"><span className="spinner" /> Cargando monitor…</div>
    )
  }

  const type = (monitor.type || 'http').toLowerCase()

  return (
    <div>
      <Link to="/monitores" className="hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={15} /> Volver a monitores
      </Link>

      <div className="page-head">
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <h1 style={{ margin: 0 }}>{monitor.name}</h1>
          <StatusBadge status={monitor.status} />
        </div>
        <p className="mono">{monitor.url}</p>
        {monitor.description && <p>{monitor.description}</p>}
      </div>

      <div className="grid cols-4 section">
        <div className="card"><div className="stat-label">Uptime</div><div className="stat-value">{monitor.uptimePct != null ? `${monitor.uptimePct.toFixed(2)} %` : '—'}</div></div>
        <div className="card"><div className="stat-label">Latencia actual</div><div className="stat-value">{monitor.latencyMs != null ? `${monitor.latencyMs} ms` : '—'}</div></div>
        <div className="card"><div className="stat-label">Latencia media</div><div className="stat-value">{monitor.avgLatencyMs != null ? `${monitor.avgLatencyMs} ms` : '—'}</div></div>
        <div className="card"><div className="stat-label">Intervalo / timeout</div><div className="stat-value">{monitor.intervalSec ?? '—'}s / {monitor.timeoutSec ?? '—'}s</div></div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Latencia en el tiempo</h2>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {RANGES.map((r) => (
              <button key={r.id} className={`tab${range === r.id ? ' active' : ''}`} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          {history === null ? (
            <div className="loading"><span className="spinner" /> Cargando…</div>
          ) : (
            <LatencyChart points={history} height={280} />
          )}
          <p className="hint" style={{ marginTop: 8 }}>
            Pasa el cursor sobre el gráfico: verás hora, latencia, estado y código HTTP de cada comprobación.
          </p>
        </div>
        <LearningTip title="Latencia">
          Es el tiempo que tarda una comunicación en ir desde nuestro servidor hasta el servicio
          monitorizado y obtener respuesta. Picos altos pueden indicar saturación o problemas de red.
        </LearningTip>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Disponibilidad · últimos 90 días</h2>
          <ExplainButton onClick={() => setExplainOpen(true)} />
        </div>
        <div className="card">
          {history30 === null ? (
            <div className="loading"><span className="spinner" /> Cargando…</div>
          ) : (
            <UptimeBlocks points={history30} />
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Incidentes recientes</h2></div>
        {incidents.length === 0 ? (
          <div className="card"><p className="hint">Sin incidentes en los últimos 30 días. 🎉</p></div>
        ) : (
          incidents.slice(0, 5).map((inc) => (
            <div key={inc.id} className={`card section incident-card${inc.end ? ' recovered' : ''}`} style={{ marginBottom: 12 }}>
              <div className="card-title-row">
                <h3>{inc.end ? 'Incidente resuelto' : 'Incidente en curso'}</h3>
                <span className="hint">{fmtDateTime(inc.start)}</span>
              </div>
              <IncidentTimeline events={inc.events} start={inc.start} end={inc.end} />
            </div>
          ))
        )}
        <LearningTip title="HTTP 500">
          El servidor respondió, pero tuvo un error interno. No es lo mismo que un timeout
          (no hubo respuesta a tiempo) ni que un DNS fallido (ni siquiera se encontró el servidor).
        </LearningTip>
      </div>

      <div className="section">
        <div className="section-head"><h2>Visualizador del check</h2></div>
        <div className="card">
          {!showCheck ? (
            <div className="btn-row">
              <button className="btn primary" onClick={() => setShowCheck(true)}>
                Ver cómo funciona este check
              </button>
              <span className="hint">Animación educativa paso a paso (tipo {type.toUpperCase()})</span>
            </div>
          ) : (
            <CheckVisualizer type={type} url={monitor.url} />
          )}
        </div>
      </div>

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          Cada bloque es un día. Uptime Kuma guarda <strong>cada comprobación</strong> (cada pocos
          segundos o minutos) en su base de datos SQLite, dentro del contenedor.
        </p>
        <p>
          Nuestra API agrupa esas comprobaciones por día: si casi todas fueron OK, el día sale
          <strong style={{ color: 'var(--green)' }}> verde</strong>; si hubo muchas lentas o con
          errores parciales, <strong style={{ color: 'var(--yellow)' }}> amarillo</strong>; si el
          servicio estuvo caído, <strong style={{ color: 'var(--red)' }}> rojo</strong>.
          Los días <strong style={{ color: 'var(--gray)' }}> grises</strong> no tienen datos
          (el monitor aún no existía o no se midió).
        </p>
        <div className="flow">
          <div className="flow-node">Checks cada N segundos<small>Uptime Kuma → servicio</small></div>
          <div className="flow-arrow">↓ se guardan</div>
          <div className="flow-node">Base de datos SQLite<small>dentro del contenedor uptime-kuma</small></div>
          <div className="flow-arrow">↓ la API los agrupa por día</div>
          <div className="flow-node">Bloques de colores<small>lo que ves aquí</small></div>
        </div>
      </ExplainModal>
    </div>
  )
}
