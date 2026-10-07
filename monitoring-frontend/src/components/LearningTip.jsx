import { GraduationCap } from 'lucide-react'
import { useApp } from '../context.jsx'

// Pequeña explicación contextual. Solo se muestra con 🎓 Modo aprendizaje activo.
export default function LearningTip({ title, children }) {
  const { learning } = useApp()
  if (!learning) return null
  return (
    <div className="learning-tip">
      <GraduationCap size={18} />
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  )
}
