import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'

// Animación educativa paso a paso de "cómo funciona este check", según el tipo de monitor.
const STEPS = {
  http: [
    { title: '1 · Resolver DNS', detail: 'example.com ↓ 93.184.216.34', text: 'El nombre del dominio se traduce a una dirección IP. Sin este paso, no sabríamos a qué máquina llamar.' },
    { title: '2 · Abrir conexión TCP', detail: 'Cliente —TCP→ Servidor :443', text: 'Se abre un canal fiable con el servidor en el puerto 443 (HTTPS).' },
    { title: '3 · TLS (cifrado)', detail: 'Client Hello → Server Hello → Certificate', text: 'Cliente y servidor negocian el cifrado y el servidor presenta su certificado.' },
    { title: '4 · Petición HTTP', detail: 'GET /', text: 'Ya con el canal cifrado, se envía la petición: qué recurso queremos.' },
    { title: '5 · Respuesta', detail: 'HTTP/1.1 200 OK', text: 'El servidor responde con un código de estado y el contenido.' },
    { title: '6 · Medición', detail: '184 ms', text: 'Uptime Kuma mide el tiempo total desde que empezó hasta recibir la respuesta: la latencia.' },
    { title: '7 · Resultado', detail: 'ONLINE', text: 'Si el código es aceptable y llegó a tiempo, el check se marca como OK.' },
  ],
  ping: [
    { title: '1 · ICMP Echo Request', detail: 'Oracle → Servidor', text: 'Se envía un pequeño paquete "¿estás ahí?" usando el protocolo ICMP.' },
    { title: '2 · Echo Reply', detail: 'Servidor → Oracle', text: 'El servidor responde automáticamente el mismo paquete.' },
    { title: '3 · Medición', detail: '23 ms', text: 'El tiempo de ida y vuelta es la latencia. Se repite con varios paquetes para calcular la media y la pérdida.' },
  ],
  tcp: [
    { title: '1 · SYN', detail: 'Oracle → Servidor', text: 'El cliente pide abrir una conexión TCP (paquete SYN).' },
    { title: '2 · SYN-ACK', detail: 'Servidor → Oracle', text: 'El servidor acepta y responde. Si el puerto está cerrado, aquí llegaría un rechazo.' },
    { title: '3 · ACK', detail: 'Oracle → Servidor', text: 'El cliente confirma. Conexión establecida: el puerto está abierto.' },
    { title: '4 · Medición', detail: '31 ms', text: 'El tiempo que tardó el handshake es la latencia TCP.' },
  ],
  dns: [
    { title: '1 · Pregunta al resolver', detail: '¿Qué IP tiene example.com?', text: 'Se consulta al servidor DNS configurado.' },
    { title: '2 · Registros A / AAAA', detail: '93.184.216.34', text: 'Direcciones IPv4 e IPv6 del dominio.' },
    { title: '3 · Otros registros', detail: 'CNAME · MX · TXT', text: 'Alias, servidores de correo y textos de verificación.' },
    { title: '4 · Resultado', detail: 'ONLINE', text: 'Si el dominio resuelve a una IP, el check DNS es correcto.' },
  ],
}

export default function CheckVisualizer({ type, url }) {
  const kind = STEPS[type] ? type : 'http'
  const steps = STEPS[kind]
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
    }, 1100)
  }

  const reset = () => {
    if (timer.current) clearInterval(timer.current)
    setRunning(false)
    setIdx(-1)
  }

  useEffect(() => () => timer.current && clearInterval(timer.current), [])

  return (
    <div>
      <p className="hint">
        Así comprueba Uptime Kuma <strong className="mono">{url}</strong> (tipo {kind.toUpperCase()}).
        Pulsa reproducir para verlo paso a paso.
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={start} disabled={running}>
          <Play size={16} /> {idx >= 0 ? 'Repetir' : 'Ver cómo funciona este check'}
        </button>
        {idx >= 0 && (
          <button className="btn ghost" onClick={reset} disabled={running}>
            <RotateCcw size={16} /> Reiniciar
          </button>
        )}
      </div>
      {idx >= 0 && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
      )}
      <div className="check-steps">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`check-step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}
          >
            <div>
              <h4>{s.title}</h4>
              <div className="mono" style={{ fontSize: 13, marginBottom: 4 }}>{s.detail}</div>
              <p>{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
