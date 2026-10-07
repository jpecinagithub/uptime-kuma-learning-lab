import { ArrowDown } from 'lucide-react'

// Diagrama de puertos (§35): distingue puerto público, localhost e interno Docker.
const ROWS = [
  {
    from: 'Internet',
    via: ':22',
    to: 'SSH',
    scope: 'publico',
    scopeLabel: 'Puerto público',
    desc: 'Administración del servidor por SSH.',
  },
  {
    from: 'Navegador',
    via: ':8090',
    to: 'Educational Dashboard',
    scope: 'publico',
    scopeLabel: 'Puerto público',
    desc: 'El frontend "Monitoring Lab". Único puerto nuevo que se abre al exterior.',
  },
  {
    from: 'localhost (túnel SSH)',
    via: ':3002',
    to: 'Uptime Kuma',
    scope: 'localhost',
    scopeLabel: 'Solo localhost',
    desc: 'El panel de Uptime Kuma NUNCA se expone a Internet. Acceso con: ssh -L 3002:127.0.0.1:3002 ubuntu@IP',
  },
  {
    from: 'Red interna Docker',
    via: ':4000',
    to: 'Monitoring API',
    scope: 'interno',
    scopeLabel: 'Interno Docker',
    desc: 'Solo accesible entre contenedores (nombre DNS: monitoring-api). El navegador llega vía proxy /api.',
  },
]

const SCOPE_CLS = { publico: 'red', localhost: 'yellow', interno: 'blue' }

export default function PortDiagram() {
  return (
    <div className="flow">
      {ROWS.map((r, i) => (
        <div key={i}>
          <div className="flow-node" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{r.from}</div>
              <div className="mono" style={{ fontSize: 16, color: 'var(--accent)' }}>{r.via}</div>
              <div style={{ fontWeight: 700 }}>{r.to}</div>
              <small>{r.desc}</small>
            </div>
            <span className={`badge ${SCOPE_CLS[r.scope]}`}>{r.scopeLabel}</span>
          </div>
          {i < ROWS.length - 1 && (
            <div className="flow-arrow">
              <ArrowDown size={18} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
