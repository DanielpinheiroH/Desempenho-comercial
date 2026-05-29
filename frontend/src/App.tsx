import { Navigate, Route, Routes } from "react-router-dom"

import Layout from "./components/Layout.tsx"

import BuscaPI from "./pages/BuscaPi.tsx"
import Dashboard from "./pages/Dashboard.tsx"
import AdminAreaEntidadesPage from "./pages/admin/AdminAreaEntidadesPage.tsx"
import DetalheMes from "./pages/DetalheMes.tsx"

import Login from "./pages/Login.tsx"

import AdminAreaDetalhe from "./pages/AdminAreaDetalhe.tsx"
import AdminSubperfilDetalhe from "./pages/AdminSubperfilDetalhe.tsx"

import ExecutivoCarteira from "./pages/ExecutivoCarteira.tsx"
import AnoListaDetalhePage from "./pages/admin/AnoListaDetalhePage.tsx"

import AnoDetalhePage from "./pages/admin/AnoDetalhePage.tsx"
import MesDetalhePage from "./pages/admin/MesDetalhePage.tsx"
import AdminSubperfilPisPage from "./pages/admin/AdminSubperfilPisPage.tsx"
import AdminEntidadesPage from "./pages/admin/AdminEntidadesPage.tsx"
import VendasDoDia from "./pages/VendasDoDia.tsx"
import FederalEntidadesPage from "./pages/FederalEntidadesPage.tsx"

import { getUser } from "./services/api"

function App() {
  const token = localStorage.getItem("token")
  const user = getUser()

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />

        <Route path="/ano/:ano/:tipo" element={<AnoListaDetalhePage />} />
        <Route path="/admin/anunciantes" element={<AdminEntidadesPage tipo="anunciantes" />} />
        <Route path="/admin/agencias" element={<AdminEntidadesPage tipo="agencias" />} />

        <Route
          path="/vendas-do-dia"
          element={
            user?.role === "admin" ? <VendasDoDia /> : <Navigate to="/" />
          }
        />
<Route
  path="/federal/anunciantes"
  element={<FederalEntidadesPage tipo="anunciantes" />}
/>

<Route
  path="/federal/agencias"
  element={<FederalEntidadesPage tipo="agencias" />}
/>
        <Route path="/busca-pi" element={<BuscaPI />} />
        <Route path="/mes/:mes" element={<DetalheMes />} />
        <Route path="/ano/:ano" element={<AnoDetalhePage />} />
        <Route path="/admin/mes/:mes" element={<MesDetalhePage />} />
        <Route path="/admin/area/:area/:tipo" element={<AdminAreaEntidadesPage />} />
        <Route path="/admin/area/:area" element={<AdminAreaDetalhe />} />
        <Route path="/admin/subperfil/:subperfil" element={<AdminSubperfilDetalhe />} />
        <Route path="/admin/subperfil/:subperfil/pis" element={<AdminSubperfilPisPage />} />
        <Route path="/executivo-carteira" element={<ExecutivoCarteira />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App