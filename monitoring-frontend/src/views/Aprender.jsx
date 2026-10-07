import { useEffect, useRef, useState } from 'react'
import { ArrowDown, GraduationCap, Play } from 'lucide-react'
import { apiPost } from '../api.js'
import ExplainModal from '../components/ExplainModal.jsx'

const CONCEPTS = [
  {
    id: 'docker', title: '¿Qué es Docker?',
    text: 'Docker es un programa que empaqueta aplicaciones en contenedores: cajas aisladas con todo lo necesario para funcionar. La misma caja corre igual en tu portátil, en el servidor o en la nube.',
    flow: ['Tu app + dependencias', '↓ se empaqueta en', 'Imagen Docker', '↓ se ejecuta como', 'Contenedor (en marcha)'],
  },
  {
    id: 'contenedor', title: '¿Qué es un contenedor?',
    text: 'Un contenedor es una imagen Docker en ejecución. Es ligero (comparte el núcleo del sistema) y aislado: tiene su propio sistema de archivos, red y procesos. Si se cae, Docker lo puede reiniciar solo.',
    flow: ['Imagen (molde)', '↓ docker compose up', 'Contenedor (vivo)', '↓ si falla', 'restart: unless-stopped'],
  },
  {
    id: 'puerto', title: '¿Qué es un puerto?',
    text: 'Un servidor tiene una IP, pero ofrece muchos servicios a la vez. El puerto es el número que identifica a qué servicio llamas: 22 = SSH, 80 = web, 443 = web segura, 3002 = Uptime Kuma (en nuestro caso).',
    flow: ['IP del servidor', '+ puerto 8090', '↓', 'Educational Dashboard'],
  },
  {
    id: 'api', title: '¿Qué es una API?',
    text: 'Una API es un "menú" de operaciones que un programa ofrece a otros programas por HTTP. Nuestro frontend no habla con Uptime Kuma: habla con nuestra API (/api/monitors, /api/server…), que le devuelve JSON fácil de pintar.',
    flow: ['Frontend', '↓ GET /api/monitors', 'Monitoring API', '↓ traduce', 'Uptime Kuma'],
  },
  {
    id: 'http', title: '¿Qué es HTTP?',
    text: 'HTTP es el idioma de la web: el cliente pide (GET /) y el servidor responde con un código (200 OK, 404 no encontrado…) y contenido. HTTPS es lo mismo pero cifrado con TLS.',
    flow: ['GET /', '↓ por Internet', 'Servidor', '↓', 'HTTP/1.1 200 OK'],
  },
  {
    id: 'dns', title: '¿Qué es DNS?',
    text: 'El Sistema de Nombres de Dominio traduce nombres (google.com) a IPs (142.250.x.x). Es la agenda de Internet: sin DNS tendrías que memorizar números.',
    flow: ['google.com', '↓ pregunta DNS', 'Resolver', '↓ responde', '142.250.184.14'],
  },
  {
    id: 'tcp', title: '¿Qué es TCP?',
    text: 'TCP es el protocolo que garantiza que los datos lleguen completos y en orden. Antes de enviar nada, hace un saludo de 3 pasos: SYN → SYN-ACK → ACK (el "handshake").',
    flow: ['SYN →', '← SYN-ACK', 'ACK →', '↓', 'CONNECTED'],
  },
  {
    id: 'ping', title: '¿Qué es un ping?',
    text: 'Un ping envía un paquete ICMP de "¿estás ahí?" y mide cuánto tarda la respuesta. Sirve para saber si una máquina está viva y la latencia básica de la red, sin usar puertos.',
    flow: ['Echo Request →', '← Echo Reply', '↓', '23 ms'],
  },
  {
    id: 'uptime', title: '¿Qué significa uptime?',
    text: 'Porcentaje de tiempo que un servicio estuvo disponible. 99,9% ("tres nueves") permite ~8,7 horas de caída al año; 99,99% ("cuatro nueves"), solo ~52 minutos.',
    flow: ['Checks OK / checks totales', '↓ × 100', '99,98 % uptime'],
  },
  {
    id: 'latencia', title: '¿Qué significa latencia?',
    text: 'Es el tiempo que tarda una comunicación en ir desde nuestro servidor hasta el servicio monitorizado y obtener respuesta. Se mide en milisegundos. Más distancia y más saltos de red = más latencia.',
    flow: ['Petición sale', '↓ viaja…', 'Respuesta vuelve', '↓', '184 ms'],
  },
  {
    id: 'timeout', title: '¿Qué es un timeout?',
    text: 'Un timeout es rendirse: si no hay respuesta en X segundos, se deja de esperar y se marca el check como fallido. Evita que una petición colgada bloquee todo lo demás.',
    flow: ['Petición…', '↓ 30 s sin respuesta', 'TIMEOUT', '↓', 'Check fallido'],
  },
  {
    id: 'proxy', title: '¿Qué es un reverse proxy?',
    text: 'Un reverse proxy (nginx) se pone delante de tus servicios y reparte el tráfico: sirve los archivos estáticos y reenvía /api/* al backend. El exterior solo ve un puerto aunque haya varios servicios detrás.',
    flow: ['Navegador :8090', '↓ nginx', '├→ estáticos (frontend)', '└→ /api/* → backend :4000'],
  },
  {
    id: 'red-docker', title: '¿Cómo se comunican los contenedores?',
    text: 'Docker crea una red interna privada. Cada contenedor tiene un nombre DNS: desde el frontend se llega al backend con http://monitoring-api:4000, sin saber su IP (que puede cambiar en cada reinicio).',
    flow: ['monitoring-frontend', '↓ http://monitoring-api:4000', 'monitoring-api', '↓ red interna', 'uptime-kuma'],
  },
  {
    id: 'deteccion', title: '¿Cómo detecta Kuma una caída?',
    text: 'Uptime Kuma ejecuta cada check en bucle según su intervalo. Si un check falla, no se fía del primero: reintenta varias veces y solo entonces declara el incidente y (si lo configuras) envía la notificación.',
    flow: ['Check falla', '↓ reintentos', 'Sigue fallando → INCIDENTE', '↓ se recupera', 'RECOVERY'],
  },
  {
    id: 'donde-datos', title: '¿Dónde guarda Kuma la información?',
    text: 'En una base de datos SQLite dentro del contenedor, en /app/data. Como esa carpeta es un volumen Docker, los datos sobreviven aunque borres y recrees el contenedor. Nunca se toca esa base con Kuma en marcha.',
    flow: ['Cada check', '↓ se anota', 'SQLite en /app/data', '↓ volumen Docker', 'Persiste entre reinicios'],
  },
  {
    id: 'al-dashboard', title: '¿Cómo llegan los datos al dashboard?',
    text: 'El navegador pide /api/monitors a nuestra API; la API lee los datos de Uptime Kuma (vía su adaptador), los simplifica a JSON y el frontend los pinta como tarjetas y gráficos. Las credenciales de Kuma nunca salen del backend.',
    flow: ['Uptime Kuma', '↓ adaptador (backend)', 'Monitoring API', '↓ JSON por /api', 'Tu navegador'],
  },
]

function ViajeCheck() {
  const [url, setUrl] = useState('https://example.com')
  const [steps, setSteps] = useState(null)
  const [idx, setIdx] = useState(-1)
  const [running, setRunning] = useState(false)
  const [simulated, setSimulated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  const run = async () => {
    if (timer.current) clearInterval(timer.current)
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/check-journey', { url })
      setSteps(data.steps || [])
      setSimulated(data.mode === 'simulated')
      setIdx(0)
      setRunning(true)
      const total = (data.steps || []).length
      timer.current = setInterval(() => {
        setIdx((i) => {
          if (i >= total - 1) {
            clearInterval(timer.current)
            setRunning(false)
            return i
          }
          return i + 1
        })
      }, 900)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => timer.current && clearInterval(timer.current), [])

  const STEP_LABELS = {
    dns: 'DNS', tcp: 'TCP', tls: 'TLS', http: 'HTTP', response: 'Respuesta',
    oracle: 'Oracle', internet: 'Internet', server: 'Servidor objetivo',
    kuma: 'Uptime Kuma', db: 'Base de datos', dashboard: 'Dashboard',
  }

  const accumulated = steps ? steps.slice(0, idx + 1).reduce((a, s) => a + (s.ms || 0), 0) : 0
  const total = steps ? steps.reduce((a, s) => a + (s.ms || 0), 0) : 0

  return (
    <div className="card section">
      <div className="card-title-row">
        <h3>🧳 Viaje de un Check</h3>
        {simulated && <span className="badge yellow">SIMULACIÓN EDUCATIVA</span>}
      </div>
      <p className="hint">Sigue el viaje completo de una comprobación, paso a paso y con tiempos.</p>
      <div className="form-row">
        <div className="grow">
          <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <button className="btn primary" onClick={run} disabled={loading || running || !url.trim()}>
          <Play size={16} /> {loading ? 'Midiendo…' : '▶ Ejecutar check'}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {steps && (
        <div>
          <div className="check-steps">
            {steps.map((s, i) => (
              <div key={i} className={`check-step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
                <div style={{ flex: 1 }}>
                  <h4>{STEP_LABELS[s.key] || s.key}</h4>
                  {s.ms != null && <div className="mono" style={{ fontSize: 13 }}>+{s.ms} ms</div>}
                </div>
                {i <= idx && s.ms != null && (
                  <div className="hint" style={{ alignSelf: 'center' }}>
                    acumulado {steps.slice(0, i + 1).reduce((a, x) => a + (x.ms || 0), 0)} ms
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="kv" style={{ marginTop: 8 }}>
            <span className="k">Tiempo acumulado</span>
            <span className="v mono">{accumulated} ms</span>
          </div>
          <div className="kv">
            <span className="k"><strong>TOTAL</strong></span>
            <span className="v mono"><strong>{total} ms</strong></span>
          </div>
          {simulated && (
            <p className="hint" style={{ marginTop: 8 }}>
              Tiempos simulados con fines educativos: ilustran el orden y la magnitud relativa de cada fase,
              no son mediciones reales de esta URL.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Aprender() {
  const [openId, setOpenId] = useState(null)
  const concept = CONCEPTS.find((c) => c.id === openId)

  return (
    <div>
      <div className="page-head">
        <h1><GraduationCap size={22} style={{ verticalAlign: -4 }} /> Aprender</h1>
        <p>
          La academia del laboratorio: conceptos explicados de forma sencilla, cada uno con su
          "¿Qué está ocurriendo aquí?" y su mini diagrama.
        </p>
      </div>

      <ViajeCheck />

      <div className="section-head"><h2>Conceptos</h2></div>
      <div className="concept-grid section">
        {CONCEPTS.map((c) => (
          <div key={c.id} className="card concept-card" onClick={() => setOpenId(c.id)}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14.5 }}>{c.title}</h3>
            <p className="hint" style={{ margin: 0 }}>{c.text.slice(0, 90)}…</p>
            <span className="explain-btn">¿Qué está ocurriendo aquí?</span>
          </div>
        ))}
      </div>

      <ExplainModal open={!!concept} onClose={() => setOpenId(null)} title={concept?.title || ''}>
        {concept && (
          <div>
            <p>{concept.text}</p>
            <div className="flow" style={{ maxWidth: 440, margin: '0 auto' }}>
              {concept.flow.map((f, i) =>
                f.startsWith('↓') || f.startsWith('├') || f.startsWith('└') || f.startsWith('←') ? (
                  <div key={i} className="hint mono" style={{ textAlign: 'center', padding: '2px 0' }}>{f}</div>
                ) : (
                  <div key={i}>
                    <div className="flow-node mono" style={{ fontSize: 13 }}>{f}</div>
                    {i < concept.flow.length - 1 && !concept.flow[i + 1].startsWith('↓') && (
                      <div className="flow-arrow"><ArrowDown size={16} /></div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </ExplainModal>
    </div>
  )
}
