import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, normalizeStatus, fmtDateTime } from '../api.js'
import StatusBadge from '../components/StatusBadge.jsx'

const TYPE_LABEL = { http: 'HTTP', https: 'HTTP', ping: 'Ping', tcp: 'TCP', dns: 'DNS' }

export default function Monitores() {
  const [monitors, setMonitors] = useState(null)
  const [error, setError] = useState(null)
  const [fEstado, setFEstado] = useState('todos')
  const [fTipo, setFTipo] = useState('todos')

  useEffect(() => {
    let alive = true
    apiGet('/monitors')
      .then(({ data }) => alive && setMonitors(data.monitors || []))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  const tipos = useMemo(() => {
    const s = new Set((monitors || []).map((m) => (m.type || 'http').toLowerCase()))
    return ['todos', ...s]
  }, [monitors])

  const filtered = useMemo(
    () =>
      (monitors || []).filter((m) => {
        const est = normalizeStatus(m.status)
        if (fEstado !== 'todos' && est !== fEstado) return false
        if (fTipo !== 'todos' && (m.type || 'http').toLowerCase() !== fTipo) return false
        return true
      }),
    [monitors, fEstado, fTipo],
  )

  return (
    <div>
      <div className="page-head">
        <h1>Monitores</h1>
        <p>Todos los checks que Uptime Kuma ejecuta contra tus servicios.</p>
      </div>

      <div className="form-row">
        <div>
          <label className="field-label">Estado</label>
          <select className="select" value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="up">En línea</option>
            <option value="degraded">Degradado</option>
            <option value="down">Offline</option>
            <option value="unknown">Desconocido</option>
          </select>
        </div>
        <div>
          <label className="field-label">Tipo</label>
          <select className="select" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t === 'todos' ? 'Todos' : TYPE_LABEL[t] || t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-box">No se pudieron cargar los monitores: {error}</div>}
      {!monitors && !error && (
        <div className="loading"><span className="spinner" /> Cargando…</div>
      )}

      <div className="grid cols-2">
        {filtered.map((m) => (
          <Link key={m.id} to={`/monitores/${m.id}`} className="card clickable">
            <div className="card-title-row">
              <h3>{m.name}</h3>
              <StatusBadge status={m.status} />
            </div>
            <div className="mono hint" style={{ marginBottom: 8, wordBreak: 'break-all' }}>{m.url}</div>
            <div className="btn-row" style={{ marginTop: 6 }}>
              <span className="badge blue">{TYPE_LABEL[(m.type || 'http').toLowerCase()] || m.type}</span>
              <span className="hint">uptime {m.uptimePct != null ? `${m.uptimePct.toFixed(2)} %` : '—'}</span>
              <span className="hint">·</span>
              <span className="hint">{m.latencyMs != null ? `${m.latencyMs} ms` : '—'}</span>
              <span className="hint">·</span>
              <span className="hint">último check {fmtDateTime(m.lastCheck)}</span>
            </div>
          </Link>
        ))}
      </div>

      {monitors && filtered.length === 0 && (
        <div className="empty-state">Ningún monitor coincide con los filtros.</div>
      )}
    </div>
  )
}
