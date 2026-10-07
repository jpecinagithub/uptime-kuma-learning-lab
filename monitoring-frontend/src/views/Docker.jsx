import { useEffect, useState } from 'react'
import { Box, RefreshCw, Terminal } from 'lucide-react'
import { apiGet, fmtDateTime } from '../api.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

const SERVICES = ['uptime-kuma', 'monitoring-api', 'monitoring-frontend', 'test-service']
const LINE_OPTIONS = [100, 500, 1000]

const EXPECTED = [
  { name: 'uptime-kuma', port: ':3001', note: 'solo localhost (túnel SSH)' },
  { name: 'monitoring-api', port: ':4000', note: 'solo red interna Docker' },
  { name: 'monitoring-frontend', port: ':8090', note: 'público (dashboard)' },
  { name: 'test-service', port: 'interno', note: 'solo red interna Docker' },
]

export default function Docker() {
  const [docker, setDocker] = useState(null)
  const [error, setError] = useState(null)
  const [logService, setLogService] = useState('uptime-kuma')
  const [logLines, setLogLines] = useState(100)
  const [logs, setLogs] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)

  const loadDocker = () => {
    apiGet('/docker')
      .then(({ data }) => setDocker(data))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    loadDocker()
    const t = setInterval(loadDocker, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLogs = () => {
    setLogsLoading(true)
    apiGet(`/logs/${logService}?lines=${logLines}`, { useCache: false })
      .then(({ data }) => setLogs(data.lines || []))
      .catch((e) => setLogs([`Error: ${e.message}`]))
      .finally(() => setLogsLoading(false))
  }

  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logService, logLines])

  const byName = {}
  ;(docker?.containers || []).forEach((c) => {
    byName[c.name] = c
  })

  return (
    <div>
      <div className="page-head">
        <h1>Docker</h1>
        <p>¿Qué está corriendo en mi servidor? Visualiza los contenedores en tiempo real (solo lectura).</p>
      </div>

      <div className="section-head">
        <h2>Árbol del servidor</h2>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      <div className="card section">
        <div className="tree">
          <div className="tree-node"><strong>🖥️ Oracle VM</strong> <span className="hint">— tu servidor en la nube</span></div>
          <div className="tree-children">
            <div className="tree-node"><strong>🐳 Docker</strong> <span className="hint">— el motor de contenedores</span></div>
            <div className="tree-children">
              {EXPECTED.map((e) => {
                const c = byName[e.name]
                return (
                  <div className="tree-node" key={e.name}>
                    <span className="mono" style={{ fontWeight: 700 }}>{e.name}</span>{' '}
                    <span className="mono" style={{ color: 'var(--accent)' }}>{e.port}</span>{' '}
                    {c ? <StatusBadge status={c.state === 'running' ? 'up' : 'down'} /> : <span className="badge gray">sin datos</span>}{' '}
                    <span className="hint">— {e.note}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <LearningTip title="Contenedor">
        Un contenedor es como una caja ligera que lleva dentro una aplicación y todo lo que necesita
        para funcionar. Varias cajas pueden correr en el mismo servidor sin molestarse entre sí.
      </LearningTip>

      {error && <div className="error-box">No se pudo leer Docker: {error}</div>}

      <div className="section-head" style={{ marginTop: 8 }}>
        <h2>Contenedores</h2>
        <button className="btn ghost" onClick={loadDocker}><RefreshCw size={15} /> Actualizar</button>
      </div>
      <div className="grid cols-2 section">
        {(docker?.containers || []).map((c) => (
          <div className="card" key={c.name}>
            <div className="card-title-row">
              <Box size={18} color="var(--accent)" />
              <h3 className="mono">{c.name}</h3>
              <StatusBadge status={c.state === 'running' ? 'up' : 'down'} />
            </div>
            <div className="kv"><span className="k">Imagen</span><span className="v mono">{c.image}</span></div>
            <div className="kv"><span className="k">Estado</span><span className="v">{c.status}</span></div>
            <div className="kv"><span className="k">Uptime</span><span className="v">{c.uptime || '—'}</span></div>
            <div className="kv"><span className="k">CPU</span><span className="v">{c.cpuPct != null ? `${c.cpuPct.toFixed(1)} %` : '—'}</span></div>
            <div className="kv"><span className="k">RAM</span><span className="v">{c.memMb != null ? `${c.memMb.toFixed(0)} MB (${c.memPct != null ? c.memPct.toFixed(1) : '?'} %)` : '—'}</span></div>
            <div className="kv"><span className="k">Puertos</span><span className="v mono">{(c.ports || []).map((p) => (p.published ? `${p.published}→${p.target}` : `${p.target}`)).join(', ') || '—'}</span></div>
            <div className="kv"><span className="k">Creado</span><span className="v">{c.created ? fmtDateTime(c.created) : '—'}</span></div>
          </div>
        ))}
      </div>
      {docker && (docker.containers || []).length === 0 && (
        <div className="empty-state">No se detectaron contenedores.</div>
      )}

      <div className="section-head"><h2><Terminal size={17} style={{ verticalAlign: -3 }} /> Logs (solo lectura)</h2></div>
      <div className="card">
        <div className="form-row">
          <div>
            <label className="field-label">Servicio</label>
            <select className="select" value={logService} onChange={(e) => setLogService(e.target.value)}>
              {SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Líneas</label>
            <select className="select" value={logLines} onChange={(e) => setLogLines(Number(e.target.value))}>
              {LINE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn" onClick={loadLogs} disabled={logsLoading}>
              <RefreshCw size={15} /> {logsLoading ? 'Cargando…' : 'Recargar'}
            </button>
          </div>
        </div>
        <div className="logs-pre">{(logs || ['Pulsa recargar para ver los logs.']).join('\n')}</div>
        <p className="hint" style={{ marginTop: 8 }}>
          Solo lectura: desde aquí no se puede ejecutar ningún comando Docker ni borrar nada.
        </p>
      </div>

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          <strong>Docker</strong> es un programa que ejecuta aplicaciones dentro de
          <strong> contenedores</strong>: paquetes aislados con su propio sistema de archivos,
          pero que comparten el núcleo del servidor. Son mucho más ligeros que una máquina virtual.
        </p>
        <p>
          Nuestro laboratorio son 4 contenedores definidos en un archivo{' '}
          <span className="mono">docker-compose.yml</span>. Se comunican entre sí por una
          <strong> red interna de Docker</strong> usando sus nombres (por ejemplo{' '}
          <span className="mono">http://monitoring-api:4000</span>), sin depender de IPs fijas.
        </p>
        <p>
          La información de esta pantalla la obtiene la Monitoring API con un cliente Docker
          de <strong>solo lectura</strong>: puede ver estado, consumo y logs, pero nunca puede
          crear, parar ni borrar contenedores desde el navegador.
        </p>
      </ExplainModal>
    </div>
  )
}
