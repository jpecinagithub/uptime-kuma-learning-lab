import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, FlaskConical, ShieldAlert } from 'lucide-react'
import { apiGet, apiPost } from '../api.js'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

const MODES = [
  { id: 'normal', icon: '✅', label: 'Normal', desc: 'Responde HTTP 200 rápido.' },
  { id: 'slow', icon: '🐌', label: 'Respuesta lenta', desc: 'Tarda ~10 segundos en responder.' },
  { id: 'error500', icon: '🔴', label: 'HTTP 500', desc: 'Responde con error interno.' },
  { id: 'timeout', icon: '⏱️', label: 'Timeout', desc: 'Nunca responde a tiempo.' },
  { id: 'down', icon: '💥', label: 'Servicio caído', desc: 'No responde en absoluto.' },
]

export default function ChaosLab() {
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [explainOpen, setExplainOpen] = useState(false)

  const load = () => {
    apiGet('/chaos', { useCache: false })
      .then(({ data }) => setCurrent(data.mode || 'normal'))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setChaos = async (mode) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/chaos', { mode })
      setCurrent(data.mode || mode)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const currentInfo = MODES.find((m) => m.id === current)

  return (
    <div>
      <div className="page-head">
        <h1><FlaskConical size={22} style={{ verticalAlign: -4 }} /> Chaos Lab</h1>
        <p>Provoca fallos deliberados y observa cómo Uptime Kuma los detecta. La mejor forma de aprender.</p>
      </div>

      <div className="error-box" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--yellow-soft)', borderColor: 'var(--yellow)', color: 'var(--yellow)' }}>
        <ShieldAlert size={20} />
        <span><strong>Solo afecta a test-service.</strong> El Chaos Lab nunca toca servicios del sistema ni otros contenedores.</span>
      </div>

      <div className="section-head" style={{ marginTop: 16 }}>
        <h2>Modo actual: {currentInfo ? `${currentInfo.icon} ${currentInfo.label}` : '…'}</h2>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="grid cols-3 section">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`card clickable ${current === m.id ? '' : ''}`}
            style={current === m.id ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
            onClick={() => setChaos(m.id)}
            disabled={loading}
          >
            <div style={{ fontSize: 26 }}>{m.icon}</div>
            <h3 style={{ margin: '8px 0 4px' }}>{m.label}</h3>
            <p className="hint" style={{ margin: 0 }}>{m.desc}</p>
            {current === m.id && <span className="badge blue" style={{ marginTop: 8 }}>activo</span>}
          </button>
        ))}
      </div>

      <div className="card section">
        <h3>Qué vas a ver al provocar un fallo</h3>
        <div className="flow" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="flow-node">Chaos Lab<small>tú pulsas un botón</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node">test-service<small>empieza a fallar</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node">Uptime Kuma<small>detecta los checks fallidos</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node">Incidente<small>se crea y se registra</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node">Dashboard<small>la tarjeta se pone en rojo 🔴</small></div>
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>
          Prueba: activa <strong>💥 Servicio caído</strong>, espera 1–2 minutos y mira{' '}
          <Link to="/incidentes" style={{ color: 'var(--accent)', fontWeight: 600 }}>Incidentes</Link>.
          Después vuelve a <strong>✅ Normal</strong> y observa la recuperación.
        </p>
      </div>

      <LearningTip title="Por qué existe el Chaos Lab">
        En producción nadie quiere caídas, pero en un laboratorio son oro: te enseñan exactamente
        cómo se ve un timeout, un 500 o una caída total en los gráficos, y cuánto tarda el sistema
        en darse cuenta.
      </LearningTip>

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          <strong>test-service</strong> es una mini-aplicación que solo sabe responder de 5 formas.
          Cuando cambias su modo, la Monitoring API le dice "a partir de ahora responde así".
        </p>
        <p>
          Uptime Kuma tiene un monitor apuntando a test-service y lo comprueba cada pocos segundos.
          Cuando las respuestas empiezan a fallar, Kuma lo detecta, crea un incidente y este
          dashboard lo muestra en rojo. Todo el circuito es real: no hay nada simulado aquí
          (salvo que estés en MODO DEMO).
        </p>
      </ExplainModal>
    </div>
  )
}
