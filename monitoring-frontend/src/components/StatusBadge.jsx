import { normalizeStatus } from '../api.js'

const LABELS = {
  up: 'En línea',
  down: 'Offline',
  degraded: 'Degradado',
  unknown: 'Desconocido',
}

// Insignia de estado: verde / rojo / amarillo / gris.
export default function StatusBadge({ status, size }) {
  const n = normalizeStatus(status)
  const cls = n === 'up' ? 'green' : n === 'down' ? 'red' : n === 'degraded' ? 'yellow' : 'gray'
  return (
    <span className={`badge ${cls}`} style={size ? { fontSize: size } : undefined}>
      <span className="dot" />
      {LABELS[n]}
    </span>
  )
}
