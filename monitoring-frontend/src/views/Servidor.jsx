import { useEffect, useState } from 'react'
import { Cpu, MemoryStick, HardDrive, Clock, Activity, ArrowDown, ArrowUp, Box } from 'lucide-react'
import { apiGet, fmtBytes } from '../api.js'
import StatCard from '../components/StatCard.jsx'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

export default function Servidor() {
  const [server, setServer] = useState(null)
  const [docker, setDocker] = useState(null)
  const [error, setError] = useState(null)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.allSettled([apiGet('/server'), apiGet('/docker')]).then(([s, d]) => {
      if (!alive) return
      if (s.status === 'fulfilled') setServer(s.value.data)
      else setError(s.reason?.message)
      if (d.status === 'fulfilled') setDocker(d.value.data)
    })
    const t = setInterval(() => {
      apiGet('/server').then(({ data }) => alive && setServer(data)).catch(() => {})
    }, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  if (error && !server) return <div className="error-box">No se pudo leer el servidor: {error}</div>
  if (!server) {
    return (
      <div className="loading"><span className="spinner" /> Leyendo el servidor Oracle…</div>
    )
  }

  const containers = docker?.containers?.length ?? '—'
  const up = server.uptime || {}

  return (
    <div>
      <div className="page-head">
        <h1>Servidor Oracle</h1>
        <p>
          Estado real de tu máquina Oracle Cloud. Estos datos los mide la Monitoring API
          directamente del sistema operativo (no son simulados).
        </p>
      </div>

      <div className="section-head">
        <h2>Oracle Server</h2>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      <div className="grid cols-4 section">
        <StatCard icon={<Cpu size={20} />} label="CPU" value={`${server.cpu?.pct ?? '—'} %`} sub={`${server.cpu?.cores ?? '?'} núcleos`} pct={server.cpu?.pct} color={server.cpu?.pct > 80 ? 'var(--red)' : 'var(--accent)'} />
        <StatCard icon={<MemoryStick size={20} />} label="RAM" value={`${server.mem?.usedGb ?? '—'} / ${server.mem?.totalGb ?? '?'} GB`} pct={server.mem?.pct} color={server.mem?.pct > 85 ? 'var(--red)' : 'var(--accent)'} />
        <StatCard icon={<HardDrive size={20} />} label="Disco" value={`${server.disk?.usedGb ?? '—'} / ${server.disk?.totalGb ?? '?'} GB`} pct={server.disk?.pct} color={server.disk?.pct > 85 ? 'var(--red)' : 'var(--accent)'} />
        <StatCard icon={<Clock size={20} />} label="Uptime" value={up.days != null ? `${up.days} días` : '—'} sub={up.days != null ? `${up.hours}h ${up.mins}m encendido` : ''} />
        <StatCard icon={<Activity size={20} />} label="Carga (load)" value={server.load ? server.load.map((l) => Number(l).toFixed(2)).join(' · ') : '—'} sub="media 1 / 5 / 15 min" />
        <StatCard icon={<ArrowDown size={20} />} label="Red recibida" value={fmtBytes(server.net?.rxBytes)} sub="total acumulado" />
        <StatCard icon={<ArrowUp size={20} />} label="Red enviada" value={fmtBytes(server.net?.txBytes)} sub="total acumulado" />
        <StatCard icon={<Box size={20} />} label="Contenedores" value={containers} sub="corriendo en Docker" />
      </div>

      <LearningTip title="Load average">
        La "carga" indica cuántos procesos están esperando CPU. En un servidor de 4 núcleos,
        una carga de 4.00 significa que está al 100%. Si sube mucho más, todo va lento.
      </LearningTip>

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          La Monitoring API lee estos números directamente del sistema operativo con llamadas
          del propio Node.js (sin ejecutar comandos arbitrarios): uso de CPU, memoria, disco,
          tiempo encendido y tráfico de red.
        </p>
        <div className="flow">
          <div className="flow-node">Sistema operativo Ubuntu<small>CPU, RAM, disco, red</small></div>
          <div className="flow-arrow">↓ la API los lee (solo lectura)</div>
          <div className="flow-node">Monitoring API<small>GET /api/server</small></div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">Esta pantalla<small>se actualiza cada 15 segundos</small></div>
        </div>
        <p>
          Por seguridad, el frontend <strong>nunca puede pedirle al servidor que ejecute comandos</strong>:
          solo recibe estos números ya calculados.
        </p>
      </ExplainModal>
    </div>
  )
}
