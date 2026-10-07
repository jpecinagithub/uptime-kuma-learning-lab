import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Play, Plug, Radio } from 'lucide-react'
import { apiPost } from '../api.js'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

function ProbarPuerto() {
  const [host, setHost] = useState('google.com')
  const [port, setPort] = useState('443')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const test = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/labs/tcp', { host, port: Number(port) })
      setResult(data)
    } catch (e) {
      setError(e.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const stateBadge = result ? (
    result.open ? <span className="badge green">Puerto abierto</span>
    : result.timeout ? <span className="badge yellow">Timeout</span>
    : <span className="badge red">Puerto cerrado</span>
  ) : null

  return (
    <div>
      <div className="form-row">
        <div className="grow">
          <label className="field-label">Host</label>
          <input className="input mono" value={host} onChange={(e) => setHost(e.target.value)} placeholder="google.com" />
        </div>
        <div style={{ width: 130 }}>
          <label className="field-label">Puerto</label>
          <input className="input mono" value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" inputMode="numeric" />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn primary" onClick={test} disabled={loading || !host.trim()}>
            <Plug size={16} /> {loading ? 'Probando…' : 'Probar'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="card">
          <div className="card-title-row">
            <h3 className="mono">{host}:{port}</h3>
            {stateBadge}
            {result.simulated && <span className="badge yellow">SIMULACIÓN EDUCATIVA</span>}
          </div>
          <div className="flow" style={{ maxWidth: 420, margin: '12px auto' }}>
            <div className="flow-node">Tu servidor Oracle</div>
            <div className="flow-arrow"><span className="hint">conexión TCP</span><ArrowDown size={18} /></div>
            <div className="flow-node mono">{host}:{port}</div>
          </div>
          <div className="kv"><span className="k">Resultado</span><span className="v">{result.open ? 'Abierto — el servidor aceptó la conexión' : result.timeout ? 'Timeout — no hubo respuesta a tiempo' : 'Cerrado — el servidor rechazó la conexión'}</span></div>
          <div className="kv"><span className="k">Latencia</span><span className="v">{result.latencyMs != null ? `${result.latencyMs} ms` : '—'}</span></div>
        </div>
      )}

      <div className="grid cols-2 section" style={{ marginTop: 16 }}>
        <div className="card"><h3>¿Qué es un puerto?</h3><p className="hint">Un servidor tiene una sola IP, pero ofrece muchos servicios. El puerto es el número que dice <em>qué</em> servicio quieres: 443 = web segura (HTTPS), 80 = web, 22 = SSH… Es como el número de apartamento dentro de un edificio.</p></div>
        <div className="card"><h3>Abierto / cerrado / timeout</h3><p className="hint"><strong>Abierto:</strong> hay un programa escuchando y aceptó tu conexión. <strong>Cerrado:</strong> el servidor respondió "aquí no hay nada". <strong>Timeout:</strong> nadie respondió a tiempo (puede haber un firewall tragándose los paquetes).</p></div>
      </div>
    </div>
  )
}

function Handshake() {
  const steps = [
    { t: 'SYN', d: 'Oracle → Servidor', x: 'El cliente pide abrir la conexión.' },
    { t: 'SYN-ACK', d: 'Servidor → Oracle', x: 'El servidor acepta: "vale, hablemos".' },
    { t: 'ACK', d: 'Oracle → Servidor', x: 'El cliente confirma. ¡Conectados!' },
  ]
  const [idx, setIdx] = useState(-1)
  const [running, setRunning] = useState(false)
  const timer = useRef(null)

  const start = () => {
    if (timer.current) clearInterval(timer.current)
    setIdx(0)
    setRunning(true)
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= steps.length - 1) {
          clearInterval(timer.current)
          setRunning(false)
          return i
        }
        return i + 1
      })
    }, 1200)
  }

  useEffect(() => () => timer.current && clearInterval(timer.current), [])

  return (
    <div>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={start} disabled={running}>
          <Play size={16} /> {idx >= 0 ? 'Repetir handshake' : 'Ver el handshake'}
        </button>
      </div>
      <div className="card">
        <div className="flow" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="flow-node">Oracle<small>cliente</small></div>
          {steps.map((s, i) => (
            <div key={s.t} style={{ opacity: idx >= i ? 1 : 0.3, transition: 'opacity .3s' }}>
              <div className="flow-arrow">
                <span className="badge blue mono">{s.t}</span>
              </div>
              <div className="hint" style={{ textAlign: 'center', marginBottom: 4 }}>{s.d} — {s.x}</div>
              {i < steps.length - 1 && <div className="flow-arrow"><ArrowDown size={16} /></div>}
            </div>
          ))}
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node" style={{ opacity: idx >= steps.length - 1 ? 1 : 0.3 }}>
            <span className="badge green">CONNECTED</span>
            <small>el puerto está abierto</small>
          </div>
        </div>
      </div>
      <LearningTip title="TCP handshake">
        Antes de enviar datos, TCP hace este saludo de 3 pasos (SYN → SYN-ACK → ACK).
        Es lo que mide un monitor TCP: si el saludo se completa, el puerto está abierto.
      </LearningTip>
    </div>
  )
}

function Ping() {
  const [host, setHost] = useState('google.com')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/labs/ping', { host })
      setResult(data)
    } catch (e) {
      setError(e.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="form-row">
        <div className="grow">
          <label className="field-label">Host</label>
          <input className="input mono" value={host} onChange={(e) => setHost(e.target.value)} placeholder="google.com" />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn primary" onClick={run} disabled={loading || !host.trim()}>
            <Radio size={16} /> {loading ? 'Haciendo ping…' : 'Ping'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="card">
          <div className="card-title-row">
            <h3>Ping a <span className="mono">{host}</span></h3>
            {result.simulated && <span className="badge yellow">SIMULACIÓN EDUCATIVA</span>}
          </div>
          <div className="flow" style={{ maxWidth: 420, margin: '12px auto' }}>
            <div className="flow-node">Oracle</div>
            <div className="flow-arrow"><span className="hint">ICMP Echo Request</span><ArrowDown size={18} /></div>
            <div className="flow-node">Servidor</div>
            <div className="flow-arrow"><span className="hint">Echo Reply</span><ArrowDown size={18} /></div>
            <div className="flow-node">Oracle<small>respuesta recibida</small></div>
          </div>
          {(result.packets || []).map((p, i) => (
            <div className="kv" key={i}>
              <span className="k">Paquete {i + 1}</span>
              <span className="v">{p.ms != null ? `${p.ms} ms` : 'perdido ✗'}</span>
            </div>
          ))}
          <div className="kv"><span className="k"><strong>Media</strong></span><span className="v"><strong>{result.avgMs != null ? `${result.avgMs} ms` : '—'}</strong></span></div>
          <div className="kv"><span className="k">Pérdida de paquetes</span><span className="v">{result.lossPct != null ? `${result.lossPct} %` : '—'}</span></div>
        </div>
      )}

      <div className="grid cols-3 section" style={{ marginTop: 16 }}>
        <div className="card"><h3>Latencia</h3><p className="hint">Tiempo de ida y vuelta del paquete. Depende sobre todo de la distancia física y la calidad de la red.</p></div>
        <div className="card"><h3>Packet loss</h3><p className="hint">Porcentaje de paquetes que nunca volvieron. Un 0% es lo normal; pérdidas altas indican red saturada o inestable.</p></div>
        <div className="card"><h3>Timeout</h3><p className="hint">Si un paquete no vuelve en unos segundos, se da por perdido. Muchos timeouts seguidos = el host no responde.</p></div>
      </div>
    </div>
  )
}

export default function TcpLab() {
  const [tab, setTab] = useState('puerto')
  const [explainOpen, setExplainOpen] = useState(false)

  return (
    <div>
      <div className="page-head">
        <h1>TCP Lab</h1>
        <p>Prueba puertos, visualiza el handshake TCP y haz ping a cualquier host público.</p>
      </div>

      <div className="section-head">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab${tab === 'puerto' ? ' active' : ''}`} onClick={() => setTab('puerto')}>Probar puerto</button>
          <button className={`tab${tab === 'handshake' ? ' active' : ''}`} onClick={() => setTab('handshake')}>Handshake</button>
          <button className={`tab${tab === 'ping' ? ' active' : ''}`} onClick={() => setTab('ping')}>Ping</button>
        </div>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      {tab === 'puerto' && <ProbarPuerto />}
      {tab === 'handshake' && <Handshake />}
      {tab === 'ping' && <Ping />}

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          <strong>TCP</strong> es el protocolo que garantiza que los datos lleguen completos y en orden
          (lo usan la web, el email, SSH…). Antes de enviar nada, cliente y servidor se saludan con
          el <strong>handshake de 3 pasos</strong>.
        </p>
        <p>
          Un monitor TCP no pide ninguna página: solo intenta completar ese saludo contra un puerto.
          Si lo consigue, el servicio "escucha"; si no, algo falla. El <strong>ping</strong> es aún
          más básico: usa ICMP para medir si la máquina responde y cuánto tarda, sin puertos.
        </p>
      </ExplainModal>
    </div>
  )
}
