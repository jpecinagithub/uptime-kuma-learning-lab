import { NavLink, Outlet } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Box,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Moon,
  Network,
  Plug,
  Server,
  Settings,
  Sun,
} from 'lucide-react'
import { useApp } from '../context.jsx'
import ModeBadge from './ModeBadge.jsx'
import OfflineBanner from './OfflineBanner.jsx'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/monitores', label: 'Monitores', icon: Activity },
  { to: '/incidentes', label: 'Incidentes', icon: AlertTriangle },
  { to: '/latencia', label: 'Latencia', icon: Gauge },
  { to: '/servidor', label: 'Servidor Oracle', icon: Server },
  { to: '/docker', label: 'Docker', icon: Box },
  { to: '/http-lab', label: 'HTTP Lab', icon: Globe },
  { to: '/dns-lab', label: 'DNS Lab', icon: Network },
  { to: '/tcp-lab', label: 'TCP Lab', icon: Plug },
  { to: '/chaos', label: 'Chaos Lab', icon: FlaskConical },
  { to: '/arquitectura', label: 'Arquitectura', icon: GitBranch },
  { to: '/aprender', label: 'Aprender', icon: GraduationCap },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Activity size={20} />
      </div>
      <div>
        <div className="brand-name">Monitoring Lab</div>
        <div className="brand-sub">Aprende cómo Internet sabe si un servicio está funcionando.</div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { theme, setTheme, learning, toggleLearning } = useApp()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <n.icon size={19} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </aside>

      <div className="main">
        <OfflineBanner />
        <header className="topbar">
          <span className="topbar-title">Monitoring Lab</span>
          <ModeBadge />
          <span className="topbar-spacer" />
          <button
            className={`icon-btn${learning ? ' on' : ''}`}
            onClick={toggleLearning}
            title="🎓 Modo aprendizaje: muestra explicaciones contextuales"
            aria-label="Modo aprendizaje"
          >
            <GraduationCap size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <n.icon size={19} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
