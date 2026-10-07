import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, fmtDateTime } from '../api.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

function Sparkline({ points }) {
  if (!points || points.length === 0) return <div className="hint" style={{ fontSize: 12 }}>Sin datos 24h</div>
  const w = 220
  const h = 44
  const vals = points.map((p) => (p.ms != null && p.status === 1 ? p.ms : null))
  const max = Math.max(...vals.filter((v) => v != null), 1)
  const step = w / Math.max(points.length - 1, 1)
  let d = ''
  vals.forEach((v, i) => {
    const x = (i * step).toFixed(1)
    if (v == null) return
    const y = (h - 4 - (v / max) * (h - 10)).toFixed(1)
    d += `${d ? 'L' : 'M'}${x},${y} `
  })
  const downCount = points.filter((p) => p.status === 0).length
  const color = downCount > 0 ? 'var(--red)' : 'var(--green)'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="spark" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  )
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState(null)
  const [histories, setHistories] = useState({})
  const [error, setError] = useState(null)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    let alive = true
    apiGet('/monitors')
      .then(({ data }) => {
        if (!alive) return
        setMonitors(data.monitors || [])
        // Sparklines 24h en paralelo
        Promise.allSettled(
          (data.monitors || []).map((m) => apiGet(`/monitors/${m.id}/history?range=24h`)),
        ).then((results) => {
          if (!alive) return
          const map = {}
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') map[data.monitors[i].id] = r.value.data.points || []
          })
          setHistories(map)
        })
      })
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>Estado en tiempo real de tus servicios monitorizados, con datos de Uptime Kuma.</p>
      </div>

      <div className="section-head">
        <h2>Servicios monitorizados</h2>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      <LearningTip title="Uptime">
        Porcentaje de tiempo durante el cual el servicio ha estado disponible. Un 99,9% suena perfecto,
        pero significa unas 8,7 horas caído al año.
      </LearningTip>
      <LearningTip title="Latencia">
        Es el tiempo que tarda una comunicación en ir desde nuestro servidor hasta el servicio
        monitorizado y obtener respuesta. Se mide en milisegundos (ms).
      </LearningTip>

      {error && <div className="error-box">No se pudieron cargar los monitores: {error}</div>}
      {!monitors && !error && (
        <div className="loading"><span className="spinner" /> Cargando monitores…</div>
      )}

      <div className="grid cols-3">
        {(monitors || []).map((m) => (
          <Link key={m.id} to={`/monitores/${m.id}`} className="card clickable">
            <div className="card-title-row">
              <h3>{m.name}</h3>
              <StatusBadge status={m.status} />
            </div>
            <div className="mono hint" style={{ marginBottom: 10, wordBreak: 'break-all' }}>{m.url}</div>
            <div className="kv"><span className="k">Uptime</span><span className="v">{m.uptimePct != null ? `${m.uptimePct.toFixed(2)} %` : '—'}</span></div>
            <div className="kv"><span className="k">Latencia actual</span><span className="v">{m.latencyMs != null ? `${m.latencyMs} ms` : '—'}</span></div>
            <div className="kv"><span className="k">Latencia media</span><span className="v">{m.avgLatencyMs != null ? `${m.avgLatencyMs} ms` : '—'}</span></div>
            <div className="kv"><span className="k">Última comprobación</span><span className="v">{fmtDateTime(m.lastCheck)}</span></div>
            <div className="kv"><span className="k">Incidentes</span><span className="v">{m.incidents ?? '—'}</span></div>
            <div className="kv"><span className="k">Último incidente</span><span className="v">{m.lastIncident ? fmtDateTime(m.lastIncident) : '—'}</span></div>
            <Sparkline points={histories[m.id]} />
          </Link>
        ))}
      </div>

      {monitors && monitors.length === 0 && (
        <div className="empty-state">Aún no hay monitores configurados en Uptime Kuma.</div>
      )}

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          Uptime Kuma comprueba cada servicio cada pocos segundos (o minutos, según lo configures):
          hace una petición HTTP, un ping o una conexión TCP y anota <strong>cuánto tardó</strong> y
          <strong> si respondió bien</strong>. Esos resultados se guardan en su base de datos.
        </p>
        <p>
          Este dashboard no habla con Uptime Kuma directamente: le pregunta a nuestra
          <strong> Monitoring API</strong> (/api/monitors), que traduce los datos internos de Kuma
          a un formato sencillo. Cada tarjeta muestra el último estado conocido más un resumen
          de las últimas 24 horas.
        </p>
        <div className="flow">
          <div className="flow-node">Tus servicios<small>webs, APIs, servidores</small></div>
          <div className="flow-arrow">↓ Uptime Kuma los comprueba</div>
          <div className="flow-node">Uptime Kuma<small>guarda cada check en su base de datos</small></div>
          <div className="flow-arrow">↓ Monitoring API traduce</div>
          <div className="flow-node">Este dashboard<small>tarjetas, gráficos e incidentes</small></div>
        </div>
      </ExplainModal>
    </div>
  )
}
