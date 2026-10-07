// Tarjeta de estadística con icono, valor y barra de progreso opcional.
export default function StatCard({ icon, label, value, sub, pct, color }) {
  const barColor = color || 'var(--accent)'
  return (
    <div className="card">
      <div className="stat-card">
        <div className="stat-icon">{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
      </div>
      {pct != null && (
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: barColor }} />
        </div>
      )}
    </div>
  )
}
