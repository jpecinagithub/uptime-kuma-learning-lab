import { useMemo, useState } from 'react'

// Visualización tipo GitHub contributions: últimos 90 días.
// verde = disponible, amarillo = degradado, rojo = caída, gris = sin datos.
// Agrega los points del history (30d) por día; los días sin datos quedan en gris.
export default function UptimeBlocks({ points }) {
  const [hover, setHover] = useState(null)

  const days = useMemo(() => {
    const buckets = {}
    ;(points || []).forEach((p) => {
      const d = new Date(p.t)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!buckets[key]) buckets[key] = { t: d, total: 0, up: 0, latSum: 0, latN: 0, incidents: 0 }
      const b = buckets[key]
      b.total++
      if (p.status === 1) {
        b.up++
        if (p.ms != null) {
          b.latSum += p.ms
          b.latN++
        }
      } else if (p.status === 0) {
        b.incidents++
      }
    })
    const out = []
    const today = new Date()
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const b = buckets[key]
      if (!b || b.total === 0) {
        out.push({ date: d, cls: 'unknown', uptime: null, latency: null, incidents: 0 })
      } else {
        const upPct = (b.up / b.total) * 100
        const cls = upPct >= 99 ? 'up' : upPct >= 95 ? 'degraded' : 'down'
        out.push({
          date: d,
          cls,
          uptime: upPct,
          latency: b.latN ? Math.round(b.latSum / b.latN) : null,
          incidents: b.incidents > 0 ? 1 : 0, // aproximación: días con alguna caída
        })
      }
    }
    return out
  }, [points])

  return (
    <div>
      <div className="uptime-blocks">
        {days.map((d, i) => (
          <div
            key={i}
            className={`ublock ${d.cls}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <div className="ublock-tip">
                <div className="mono" style={{ fontWeight: 700 }}>
                  {d.date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                </div>
                {d.uptime == null ? (
                  <div>Sin datos</div>
                ) : (
                  <div>
                    Uptime {d.uptime.toFixed(1)}%
                    {d.latency != null && <> · {d.latency} ms</>}
                    {d.incidents > 0 && <> · con caídas</>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="blocks-legend">
        <span><span className="legend-sq" style={{ background: 'var(--green)' }} /> disponible</span>
        <span><span className="legend-sq" style={{ background: 'var(--yellow)' }} /> degradado</span>
        <span><span className="legend-sq" style={{ background: 'var(--red)' }} /> caída</span>
        <span><span className="legend-sq" style={{ background: 'var(--gray)', opacity: 0.4 }} /> sin datos</span>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Últimos 90 días · los días sin mediciones se muestran en gris (sin datos)
      </p>
    </div>
  )
}
