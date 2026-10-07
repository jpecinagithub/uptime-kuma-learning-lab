import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './views/Dashboard.jsx'
import Monitores from './views/Monitores.jsx'
import MonitorDetalle from './views/MonitorDetalle.jsx'
import Incidentes from './views/Incidentes.jsx'
import Latencia from './views/Latencia.jsx'
import Servidor from './views/Servidor.jsx'
import Docker from './views/Docker.jsx'
import HttpLab from './views/HttpLab.jsx'
import TcpLab from './views/TcpLab.jsx'
import DnsLab from './views/DnsLab.jsx'
import ChaosLab from './views/ChaosLab.jsx'
import Arquitectura from './views/Arquitectura.jsx'
import Aprender from './views/Aprender.jsx'
import Configuracion from './views/Configuracion.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="monitores" element={<Monitores />} />
        <Route path="monitores/:id" element={<MonitorDetalle />} />
        <Route path="incidentes" element={<Incidentes />} />
        <Route path="latencia" element={<Latencia />} />
        <Route path="servidor" element={<Servidor />} />
        <Route path="docker" element={<Docker />} />
        <Route path="http-lab" element={<HttpLab />} />
        <Route path="dns-lab" element={<DnsLab />} />
        <Route path="tcp-lab" element={<TcpLab />} />
        <Route path="chaos" element={<ChaosLab />} />
        <Route path="arquitectura" element={<Arquitectura />} />
        <Route path="aprender" element={<Aprender />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
