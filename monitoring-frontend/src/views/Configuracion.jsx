import { useState } from 'react'
import { GraduationCap, Moon, RefreshCw, Sun, Terminal } from 'lucide-react'
import { useApp } from '../context.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import LearningTip from '../components/LearningTip.jsx'

const SSH_CMD = 'ssh -L 3002:127.0.0.1:3002 ubuntu@TU_IP_ORACLE'

export default function Configuracion() {
  const {
    mode, setMode, effectiveMode, learning, toggleLearning,
    theme, setTheme, health, refreshHealth,
  } = useApp()
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    setRefreshing(true)
    await refreshHealth()
    setRefreshing(false)
  }

  const modeInfo = {
    auto: 'El backend decide solo: usa datos reales si Uptime Kuma está conectado; si no, datos simulados.',
    demo: 'Fuerza datos simulados siempre. Ideal para explorar sin Uptime Kuma.',
    real: 'Fuerza datos reales. Si Uptime Kuma no está disponible, verás un error honesto (no datos inventados).',
  }

  return (
    <div>
      <div className="page-head">
        <h1>Configuración</h1>
        <p>Modo de datos, aprendizaje, tema y estado del sistema.</p>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Modo de datos</h3>
          <p className="hint">Elige de dónde vienen los datos del dashboard.</p>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            {['auto', 'demo', 'real'].map((m) => (
              <button
                key={m}
                className={`btn${mode === m ? ' primary' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'auto' ? 'Automático' : m === 'demo' ? 'DEMO' : 'REAL'}
              </button>
            ))}
          </div>
          <p className="hint">{modeInfo[mode]}</p>
          <p className="hint">
            Modo efectivo ahora:{' '}
            <span className={`badge ${effectiveMode === 'real' ? 'green' : 'yellow'}`}>
              {effectiveMode === 'real' ? 'MODO REAL · datos de Uptime Kuma' : 'MODO DEMO · datos simulados'}
            </span>
          </p>
        </div>

        <div className="card">
          <h3>Apariencia y aprendizaje</h3>
          <div className="kv">
            <span className="k"><GraduationCap size={15} style={{ verticalAlign: -2 }} /> 🎓 Modo aprendizaje</span>
            <span className="v">
              <button className={`btn${learning ? ' primary' : ''}`} onClick={toggleLearning}>
                {learning ? 'Activado' : 'Desactivado'}
              </button>
            </span>
          </div>
          <div className="kv">
            <span className="k">{theme === 'dark' ? <Moon size={15} style={{ verticalAlign: -2 }} /> : <Sun size={15} style={{ verticalAlign: -2 }} />} Tema</span>
            <span className="v">
              <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? 'Oscuro' : 'Claro'}
              </button>
            </span>
          </div>
          <LearningTip title="Modo aprendizaje">
            Cuando está activo, cada sección muestra explicaciones cortas como esta. Pruébalo
            recorriendo el Dashboard y los laboratorios.
          </LearningTip>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h3>Estado del backend</h3>
            <button className="btn ghost" onClick={doRefresh} disabled={refreshing}>
              <RefreshCw size={15} /> {refreshing ? '…' : 'Actualizar'}
            </button>
          </div>
          {!health && <p className="hint">Sin conexión con la API.</p>}
          {health && (
            <div>
              <div className="kv"><span className="k">Estado</span><span className="v"><StatusBadge status={health.status === 'ok' ? 'up' : 'down'} /></span></div>
              <div className="kv"><span className="k">Versión API</span><span className="v mono">{health.version || '—'}</span></div>
              <div className="kv"><span className="k">Uptime Kuma</span><span className="v"><StatusBadge status={health.uptimeKuma ? 'up' : 'down'} /></span></div>
              <div className="kv"><span className="k">Versión Kuma</span><span className="v mono">{health.kumaVersion || '—'}</span></div>
              <div className="kv"><span className="k">Docker</span><span className="v"><StatusBadge status={health.docker ? 'up' : 'down'} /></span></div>
              <div className="kv"><span className="k">Servidor</span><span className="v"><StatusBadge status={health.server ? 'up' : 'down'} /></span></div>
            </div>
          )}
        </div>

        <div className="card">
          <h3><Terminal size={16} style={{ verticalAlign: -2 }} /> Túnel SSH a Uptime Kuma</h3>
          <p className="hint">
            El panel de administración de Uptime Kuma solo escucha en localhost del servidor.
            Ábrelo en tu ordenador con un túnel SSH cifrado:
          </p>
          <div className="code-block">{SSH_CMD}</div>
          <p className="hint">
            Después abre en tu navegador <span className="mono">http://localhost:3002</span>.
            Lo que escribas ahí viaja cifrado por SSH hasta el servidor.
          </p>
          <hr className="divider" />
          <h3>Documentación</h3>
          <p className="hint">
            En el repositorio del proyecto encontrarás: README, INSTALL, ARCHITECTURE,
            SECURITY, BACKUP, UPDATE, LEARNING y TROUBLESHOOTING.
          </p>
          <a
            className="btn"
            href="https://github.com/jpecinagithub/uptime-kuma-learning-lab"
            target="_blank"
            rel="noreferrer"
          >
            Ver repositorio en GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
