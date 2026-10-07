import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiGet, fmtTime } from '../api.js'
import LearningTip from '../components/LearningTip.jsx'

const COLORS = ['#5b9bff', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#f97316', '#14b8a6', '#ec4899']

export default function Latencia() {
  const [monitors, setMonitors] = useState([])
  const [selected, setSelected] = useState([])
  const [series, setSeries] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiGet('/monitors')
      .then(({ data }) => {
        const ms = data.monitors || []
        setMonitors(ms)
        setSelected(ms.slice(0, 4).map((m) => String(m.id)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.allSettled(
      selected.map((id) => apiGet(`/monitors/${id}/history?range=24h`)),
    ).then((results) => {
      if (!alive) return
      const map = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[selected[i]] = r.value.data.points || []
      })
      setSeries(map)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [selected])

  const toggle = (id) => {
    const s = String(id)
    setSelected((sel) => (sel.includes(s) ? sel.filter((x) => x !== s) : [...sel, s]))
  }

  // Une las series por timestamp para el gráfico multi-línea.
  const chartData = useMemo(() => {
    const byT = new Map()
    selected.forEach((id) => {
      const m = monitors.find((x) => String(x.id) === String(id))
      ;(series[id] || []).forEach((p) => {
        if (!byT.has(p.t)) byT.set(p.t, { t: p.t, label: fmtTime(p.t) })
        byT.get(p.t)[`m_${id}`] = p.status === 1 && p.ms != null ? p.ms : null
      })
    })
    return [...byT.values()].sort((a, b) => a.t - b.t)
  }, [series, selected, monitors])

  return (
    <div>
      <div className="page-head">
        <h1>Latencia</h1>
        <p>Compara la latencia de varios monitores en las últimas 24 horas, en un solo gráfico.</p>
      </div>

      <LearningTip title="Latencia">
        Es el tiempo que tarda una comunicación en ir desde nuestro servidor hasta el servicio
        monitorizado y obtener respuesta. Comparar varias curvas ayuda a distinguir si un pico
        es de un servicio concreto o de la red en general.
      </LearningTip>

      <div className="grid" style={{ gridTemplateColumns: '240px 1fr', alignItems: 'start' }}>
        <div className="card">
          <h3>Monitores</h3>
          {monitors.map((m, i) => (
            <label key={m.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={selected.includes(String(m.id))}
                onChange={() => toggle(m.id)}
              />
              <span className="color-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            </label>
          ))}
          {monitors.length === 0 && <p className="hint">Cargando monitores…</p>}
        </div>

        <div className="card">
          {loading && <div className="loading"><span className="spinner" /> Cargando series…</div>}
          {!loading && chartData.length === 0 && (
            <p className="hint">Selecciona al menos un monitor para comparar.</p>
          )}
          {!loading && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  minTickGap={50}
                />
                <YAxis
                  tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  unit=" ms"
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--code-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {selected.map((id, i) => {
                  const m = monitors.find((x) => String(x.id) === String(id))
                  return (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={`m_${id}`}
                      name={m ? m.name : id}
                      stroke={COLORS[monitors.findIndex((x) => String(x.id) === String(id)) % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
