import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import PortDiagram from '../components/PortDiagram.jsx'
import LearningTip from '../components/LearningTip.jsx'

const NODES = {
  internet: {
    label: 'Internet',
    que: 'La red pública mundial a la que está conectado tu servidor.',
    funcion: 'Por aquí llegan las visitas a tu dashboard y salen los checks hacia tus webs.',
    comunica: 'A través de la IP pública del servidor y los puertos abiertos en el firewall.',
  },
  oracle: {
    label: 'Oracle Cloud',
    que: 'Tu máquina virtual (VPS) alquilada en la nube de Oracle: Ubuntu 24.04 en ARM.',
    funcion: 'Aloja todo el laboratorio: Docker, los 4 contenedores y sus volúmenes.',
    comunica: 'Tiene dos firewalls: el de Oracle Cloud (Security Lists) y el de Ubuntu. Solo el puerto 22 (SSH) y el 8090 (dashboard) están abiertos.',
  },
  api: {
    label: 'Monitoring API',
    que: 'Nuestro backend en Node.js + Express (puerto 4000, solo red interna Docker).',
    funcion: 'Intermediario: traduce los datos de Uptime Kuma, lee el sistema y Docker, y ejecuta los laboratorios con protección anti-SSRF.',
    comunica: 'Habla con Uptime Kuma por la red interna; el navegador le habla a ella vía /api (proxy nginx). Nunca expone credenciales.',
  },
  kuma: {
    label: 'Uptime Kuma',
    que: 'La herramienta open-source de monitorización (puerto 3001, solo localhost).',
    funcion: 'Ejecuta los checks (HTTP, ping, TCP, DNS) cada N segundos y guarda cada resultado en su base de datos SQLite.',
    comunica: 'Su panel admin solo es accesible por túnel SSH. La API le pregunta por sus datos mediante un adaptador aislado.',
  },
  docker: {
    label: 'Docker',
    que: 'El motor que ejecuta los contenedores en el servidor.',
    funcion: 'Aisla cada servicio en su "caja", les da red interna con DNS por nombre y reinicia los que se caen.',
    comunica: 'Los contenedores se llaman por nombre (monitoring-api, uptime-kuma…) dentro de la red interna, sin IPs fijas.',
  },
  webA: {
    label: 'Web A / Web B / API C',
    que: 'Tus servicios reales: webs, APIs o servidores que quieres vigilar.',
    funcion: 'Son el objetivo de los checks. Pueden estar en cualquier parte de Internet.',
    comunica: 'Uptime Kuma les hace peticiones periódicas desde el servidor Oracle y mide si responden y cuánto tardan.',
  },
}

export default function Arquitectura() {
  const [selected, setSelected] = useState('kuma')

  const node = (id, extra) => (
    <button
      key={id}
      className={`flow-node clickable${selected === id ? ' selected' : ''}`}
      onClick={() => setSelected(id)}
      style={extra}
    >
      {NODES[id].label}
    </button>
  )

  const info = NODES[selected]

  return (
    <div>
      <div className="page-head">
        <h1>Arquitectura</h1>
        <p>Pulsa cada elemento para entender qué es, qué función tiene y cómo se comunica.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        <div className="card">
          <div className="flow" style={{ maxWidth: 560, margin: '0 auto' }}>
            {node('internet')}
            <div className="flow-arrow"><ArrowDown size={18} /></div>
            {node('oracle')}
            <div className="flow-arrow"><ArrowDown size={18} /></div>
            <div className="flow-h">
              {node('api', { marginRight: 6 })}
              {node('kuma', { marginLeft: 6 })}
            </div>
            <div className="hint" style={{ textAlign: 'center', margin: '6px 0' }}>
              la API traduce los datos de Kuma para el dashboard
            </div>
            <div className="flow-arrow"><ArrowDown size={18} /></div>
            {node('docker')}
            <div className="flow-arrow"><ArrowDown size={18} /></div>
            <div className="flow-h">
              {node('webA')}
            </div>
            <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>
              (Web A, Web B, API C: los servicios que monitorizas, estén donde estén)
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'sticky', top: 90 }}>
          <h3 style={{ marginTop: 0 }}>{info.label}</h3>
          <p><strong>Qué es:</strong> <span className="hint">{info.que}</span></p>
          <p><strong>Función:</strong> <span className="hint">{info.funcion}</span></p>
          <p><strong>Cómo se comunica:</strong> <span className="hint">{info.comunica}</span></p>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 24 }}><h2>Puertos del sistema</h2></div>
      <div className="card section">
        <PortDiagram />
      </div>

      <LearningTip title="Reverse proxy">
        Un reverse proxy (aquí, nginx) recibe las peticiones del navegador y las reparte internamente:
        los estáticos los sirve él y /api/* lo reenvía a la Monitoring API. Así el navegador solo
        habla con un puerto (8090) aunque haya varios servicios detrás.
      </LearningTip>
    </div>
  )
}
