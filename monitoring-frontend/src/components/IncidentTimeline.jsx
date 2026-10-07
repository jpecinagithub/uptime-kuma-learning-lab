import { fmtDateTime, fmtDuration, pointStatusLabel } from '../api.js'

// Línea temporal de un incidente: DOWN ↓ INCIDENT ↓ RECOVERY, con duración.
export default function IncidentTimeline({ events, start, end }) {
  if (!events || events.length === 0) {
    return <p className="hint">Sin eventos registrados.</p>
  }
  const duration = start != null && end != null ? fmtDuration(end - start) : null
  return (
    <div>
      <div className="timeline">
        {events.map((e, i) => {
          const cls = pointStatusLabel(e.status)
          return (
            <div className="tl-item" key={i}>
              <span className={`tl-dot ${cls}`} />
              <div className="tl-time">{fmtDateTime(e.t)}</div>
              <div className="tl-msg">
                {e.status === 1 && '🟢 Servicio recuperado'}
                {e.status === 0 && '🔴 Caída'}
                {e.status === 2 && '🟡 Degradado'}
                {e.status === 3 && '⚪ Mantenimiento'}
                {e.code != null && <span className="mono"> · HTTP {e.code}</span>}
                {e.msg && <span className="hint"> · {e.msg}</span>}
              </div>
            </div>
          )
        })}
      </div>
      {duration && (
        <p className="hint" style={{ marginTop: 10 }}>
          Duración del incidente: <strong style={{ color: 'var(--text)' }}>{duration}</strong>
        </p>
      )}
    </div>
  )
}
