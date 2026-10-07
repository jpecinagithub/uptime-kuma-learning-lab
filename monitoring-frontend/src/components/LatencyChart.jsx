import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtTime, pointStatusLabel } from '../api.js'

const STATUS_TEXT = { up: 'OK', down: 'Caída', degraded: 'Degradado', unknown: 'Sin datos' }
const STATUS_COLOR = {
  up: 'var(--green)',
  down: 'var(--red)',
  degraded: 'var(--yellow)',
  unknown: 'var(--gray)',
}

function LatencyTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  const st = pointStatusLabel(p.status)
  return (
    <div
      style={{
        background: 'var(--code-bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
      }}
    >
      <div className="mono" style={{ fontWeight: 700 }}>{fmtTime(p.t, { day: '2-digit', month: '2-digit' })} · {fmtTime(p.t)}</div>
      <div>
        Latencia: <strong>{p.ms != null ? `${p.ms} ms` : '—'}</strong>
      </div>
      <div>
        Estado: <strong style={{ color: STATUS_COLOR[st] }}>{STATUS_TEXT[st]}</strong>
      </div>
      {p.code != null && <div className="mono">HTTP {p.code}</div>}
      {p.msg && <div className="hint">{p.msg}</div>}
    </div>
  )
}

// Gráfico temporal de latencia (eje X tiempo, eje Y ms).
export default function LatencyChart({ points, height = 260 }) {
  const data = (points || []).map((p) => ({ ...p, label: fmtTime(p.t) }))
  if (data.length === 0) return <p className="hint">Sin datos de latencia para este rango.</p>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="latFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b9bff" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#5b9bff" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={46}
          unit=" ms"
        />
        <Tooltip content={<LatencyTooltip />} />
        <Area
          type="monotone"
          dataKey="ms"
          stroke="#5b9bff"
          strokeWidth={2}
          fill="url(#latFill)"
          connectNulls={false}
          dot={false}
          activeDot={{ r: 4 }}
          name="Latencia"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
