import { useState } from 'react'
import { ArrowDown, Search } from 'lucide-react'
import { apiPost } from '../api.js'
import LearningTip from '../components/LearningTip.jsx'
import ExplainModal, { ExplainButton } from '../components/ExplainModal.jsx'

const TYPE_INFO = {
  A: 'Dirección IPv4 del dominio. Es el registro más usado: dice "este nombre vive en esta IP".',
  AAAA: 'Dirección IPv6 del dominio. La versión moderna del registro A, con direcciones larguísimas.',
  CNAME: 'Alias: "este nombre es en realidad este otro nombre". Muy usado en subdominios.',
  MX: 'Servidores de correo del dominio, con prioridad. Sin MX, el email no sabría a dónde ir.',
  TXT: 'Textos libres: se usan para verificar propiedad (Google, Microsoft…) y contra el spam (SPF, DKIM).',
  NS: 'Servidores de nombres autoritativos del dominio.',
  SOA: 'Información técnica de la zona DNS (quién la mantiene, tiempos de refresco).',
}

export default function DnsLab() {
  const [domain, setDomain] = useState('openai.com')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [explainOpen, setExplainOpen] = useState(false)

  const lookup = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/labs/dns', { domain })
      setResult(data)
    } catch (e) {
      setError(e.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const records = result?.records || {}

  return (
    <div>
      <div className="page-head">
        <h1>DNS Lab</h1>
        <p>Consulta los registros DNS reales de cualquier dominio público y entiende qué significa cada uno.</p>
      </div>

      <div className="section-head">
        <h2>Consulta DNS</h2>
        <ExplainButton onClick={() => setExplainOpen(true)} />
      </div>

      <div className="form-row">
        <div className="grow">
          <label className="field-label">Dominio</label>
          <input className="input mono" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="openai.com" />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn primary" onClick={lookup} disabled={loading || !domain.trim()}>
            <Search size={16} /> {loading ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="card section">
          <div className="card-title-row">
            <h3 className="mono">{result.domain}</h3>
            {result.simulated && <span className="badge yellow">SIMULACIÓN EDUCATIVA</span>}
          </div>
          <div className="tree">
            <div className="tree-node"><strong>🌐 {result.domain}</strong></div>
            <div className="tree-children">
              <div className="tree-node"><strong>🔍 DNS Resolver</strong> <span className="hint">— pregunta por cada tipo de registro</span></div>
              <div className="tree-children">
                {Object.keys(records).length === 0 && <p className="hint">Sin registros para este dominio.</p>}
                {Object.entries(records).map(([type, values]) => (
                  <div className="tree-node" key={type} style={{ marginBottom: 10 }}>
                    <span className="badge blue mono">{type}</span>
                    <div className="logs-pre" style={{ maxHeight: 120, marginTop: 6 }}>
                      {(values || []).join('\n') || '—'}
                    </div>
                    <p className="hint" style={{ margin: '6px 0 0' }}>{TYPE_INFO[type] || 'Registro DNS.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flow-arrow"><ArrowDown size={18} /></div>
          <p className="hint" style={{ textAlign: 'center' }}>
            Con la IP del registro A, el navegador ya puede abrir la conexión TCP. Así empieza toda visita web.
          </p>
        </div>
      )}

      <LearningTip title="DNS">
        El Sistema de Nombres de Dominio es la agenda de Internet: traduce nombres legibles
        (openai.com) a direcciones IP (números). Cada tipo de registro responde a una pregunta
        distinta sobre el dominio.
      </LearningTip>

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} title="¿Qué está ocurriendo aquí?">
        <p>
          Al pulsar "Consultar", la <strong>Monitoring API</strong> pregunta a un resolver DNS real
          por los registros del dominio y te los muestra agrupados por tipo. Son datos reales,
          no inventados.
        </p>
        <p>
          Un monitor DNS de Uptime Kuma hace algo parecido de forma periódica: pregunta
          "¿qué IP tiene este dominio?" y si la respuesta cambia o falla, lo marca como incidente.
        </p>
      </ExplainModal>
    </div>
  )
}
