import { useState } from 'react'
import { ArrowDown, Search } from 'lucide-react'
import { apiPost } from '../api.js'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

const STATUS_CODES = [
  { code: 200, text: 'Todo bien. El servidor devolvió lo pedido.' },
  { code: 301, text: 'Redirección permanente: "esto se mudó para siempre, ve a esta otra URL".' },
  { code: 302, text: 'Redirección temporal: "por ahora ve a esta otra URL".' },
  { code: 400, text: 'Petición mal formada: el servidor no entendió lo que le pediste.' },
  { code: 401, text: 'No autorizado: falta identificarte (login / token).' },
  { code: 403, text: 'Prohibido: sabes quién eres, pero no tienes permiso.' },
  { code: 404, text: 'No encontrado: esa página o recurso no existe.' },
  { code: 429, text: 'Demasiadas peticiones: el servidor te pide que vayas más despacio.' },
  { code: 500, text: 'Error interno del servidor: algo se rompió dentro.' },
  { code: 502, text: 'Puerta de enlace mala: el intermediario no obtuvo respuesta válida.' },
  { code: 503, text: 'Servicio no disponible: saturado o en mantenimiento.' },
  { code: 504, text: 'Timeout de la puerta de enlace: el de atrás tardó demasiado.' },
]

function Field({ label, value, explain }) {
  return (
    <div className="kv" style={{ alignItems: 'flex-start' }}>
      <span className="k" style={{ minWidth: 130 }}>{label}</span>
      <span className="v" style={{ fontWeight: 500 }}>
        <div className="mono">{value ?? '—'}</div>
        <div className="hint" style={{ fontWeight: 400, marginTop: 2 }}>{explain}</div>
      </span>
    </div>
  )
}

function Analizar() {
  const [url, setUrl] = useState('https://example.com')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/labs/http', { url })
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
          <label className="field-label">URL a analizar</label>
          <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn primary" onClick={analyze} disabled={loading || !url.trim()}>
            <Search size={16} /> {loading ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="card">
          <div className="card-title-row">
            <h3>Resultado del análisis</h3>
            {result.simulated && <span className="badge yellow">SIMULACIÓN EDUCATIVA</span>}
          </div>
          <Field label="DNS → IP" value={result.ip} explain="El dominio traducido a dirección IP. Es el primer paso de cualquier conexión." />
          <Field label="HTTPS" value={result.https ? 'Sí 🔒' : 'No'} explain="Si la conexión va cifrada con TLS (candado del navegador)." />
          <Field label="Código de estado" value={result.statusCode != null ? `HTTP ${result.statusCode}` : '—'} explain="Lo que respondió el servidor: 200 = todo bien, 404 = no existe, 500 = error interno…" />
          <Field label="Tiempo de respuesta" value={result.timeMs != null ? `${result.timeMs} ms` : '—'} explain="Cuánto tardó en responder: la latencia de esta petición concreta." />
          <Field label="Content-Type" value={result.headers?.['content-type']} explain="Qué tipo de contenido devolvió: HTML, JSON, imagen…" />
          <Field label="Servidor" value={result.headers?.server} explain="El software que atiende (a veces lo ocultan por seguridad)." />
          <Field label="Redirecciones" value={(result.redirects || []).length ? result.redirects.join(' → ') : 'Ninguna'} explain="Si la URL te mandó a otra dirección antes de responder (301/302)." />
          {result.headers && (
            <>
              <hr className="divider" />
              <h3 style={{ marginBottom: 8 }}>Cabeceras principales</h3>
              <div className="logs-pre" style={{ maxHeight: 220 }}>
                {Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
              </div>
              <p className="hint" style={{ marginTop: 8 }}>
                Las cabeceras son metadatos que acompañan a la respuesta: el navegador las usa
                para saber cómo tratar el contenido, pero no se muestran en la página.
              </p>
            </>
          )}
          <p className="hint" style={{ marginTop: 10 }}>
            El análisis lo hace el backend: tu navegador nunca ejecuta código de la web analizada.
          </p>
        </div>
      )}

      <LearningTip title="DNS">
        El Sistema de Nombres de Dominio traduce nombres como example.com a direcciones IP.
        Es como la agenda de contactos de Internet.
      </LearningTip>
    </div>
  )
}

function MonitorHttp() {
  return (
    <div>
      <div className="card section">
        <h3>Cómo viaja una petición HTTP</h3>
        <div className="flow">
          <div className="flow-node mono">GET https://miweb.com</div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node">Internet<small>la petición viaja por la red</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node">Servidor<small>recibe la petición y la procesa</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node mono">HTTP 200<small>código de estado</small></div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <div className="flow-node mono">184 ms<small>tiempo total: la latencia</small></div>
        </div>
      </div>

      <div className="section-head"><h2>Guía de códigos HTTP</h2></div>
      <div className="grid cols-3">
        {STATUS_CODES.map((s) => {
          const cls = s.code < 300 ? 'green' : s.code < 400 ? 'blue' : s.code < 500 ? 'yellow' : 'red'
          return (
            <div className="card" key={s.code}>
              <span className={`badge ${cls} mono`} style={{ fontSize: 15 }}>{s.code}</span>
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--text-dim)' }}>{s.text}</p>
            </div>
          )
        })}
      </div>
      <LearningTip title="Códigos HTTP">
        El primer dígito manda: 2xx = éxito, 3xx = "ve a otro sitio", 4xx = error tuyo (cliente),
        5xx = error del servidor. Con eso ya puedes leer casi cualquier código.
      </LearningTip>
    </div>
  )
}

export default function HttpLab() {
  const [tab, setTab] = useState('analizar')
  const [explainOpen, setExplainOpen] = useState(false)

  return (
    <div>
      <div className="page-head">
        <h1>HTTP Lab</h1>
        <p>Analiza cualquier web pública y entiende qué ocurre en una petición HTTP.</p>
      </div>

      <div className="section-head">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab${tab === 'analizar' ? ' active' : ''}`} onClick={() => setTab('analizar')}>Analizar</button>
          <button className={`tab${tab === 'monitor' ? ' active' : ''}`} onClick={() => setTab('monitor')}>Monitor HTTP</button>
        </div>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      {tab === 'analizar' ? <Analizar /> : <MonitorHttp />}

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          Cuando escribes una URL y pulsas "Analizar", la <strong>Monitoring API</strong> (no tu
          navegador) hace una petición real a esa web y te devuelve los datos importantes:
          la IP, si usa HTTPS, el código de estado, cuánto tardó y las cabeceras.
        </p>
        <p>
          Por seguridad, el backend <strong>bloquea direcciones privadas</strong> (localhost,
          redes internas, metadatos de la nube): este laboratorio es para aprender con webs
          públicas, no una herramienta para espiar la red interna.
        </p>
      </ExplainModal>
    </div>
  )
}
