import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { subscribeOffline, latestCacheTs, fmtTime } from '../api.js'

// Banner visible cuando se sirven datos de caché. Nunca muestra datos viejos como actuales.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [ts, setTs] = useState(0)

  useEffect(() => {
    const unsub = subscribeOffline((v) => {
      setOffline(v)
      if (v) setTs(latestCacheTs())
    })
    return unsub
  }, [])

  if (!offline) return null
  return (
    <div className="offline-banner">
      <WifiOff size={15} />
      Datos sin conexión{ts ? ` — última actualización ${fmtTime(ts)}` : ''}
    </div>
  )
}
