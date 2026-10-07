import { useApp } from '../context.jsx'

// Siempre visible: distingue DATO REAL de SIMULACIÓN EDUCATIVA.
export default function ModeBadge() {
  const { effectiveMode } = useApp()
  if (effectiveMode === 'real') {
    return (
      <span className="badge green mode-badge">
        <span className="dot" />
        MODO REAL · datos de Uptime Kuma
      </span>
    )
  }
  return (
    <span className="badge yellow mode-badge">
      <span className="dot" />
      MODO DEMO · datos simulados
    </span>
  )
}
