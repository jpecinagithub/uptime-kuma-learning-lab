import { useEffect } from 'react'
import { X, HelpCircle } from 'lucide-react'

// Modal genérico para "¿Qué está ocurriendo aquí?": explicación sencilla + diagrama (children).
export default function ExplainModal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <HelpCircle size={22} color="var(--accent)" />
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Botón estándar "¿Qué está ocurriendo aquí?"
export function ExplainButton({ onClick }) {
  return (
    <button className="explain-btn" onClick={onClick}>
      <HelpCircle size={15} />
      ¿Qué está ocurriendo aquí?
    </button>
  )
}
