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

// NOVAS PÁGINAS
import AnoDetalhePage from "./pages/admin/AnoDetalhePage.tsx"
import MesDetalhePage from "./pages/admin/MesDetalhePage.tsx"
import AdminSubperfilPisPage from "./pages/admin/AdminSubperfilPisPage.tsx"
import AdminEntidadesPage from "./pages/admin/AdminEntidadesPage.tsx"
import VendasDoDia from "./pages/VendasDoDia.tsx"

function App() {
  const token = localStorage.getItem("token")

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
        {/* DASHBOARD */}
        <Route path="/" element={<Dashboard />} />
<Route path="/ano/:ano/:tipo" element={<AnoListaDetalhePage />} />
<Route path="/admin/anunciantes" element={<AdminEntidadesPage tipo="anunciantes" />} />
<Route path="/admin/agencias" element={<AdminEntidadesPage tipo="agencias" />} />
<Route path="/vendas-do-dia" element={<VendasDoDia />} />
        {/* BUSCA */}
        <Route
          path="/busca-pi"
          element={<BuscaPI />}
        />

        {/* DETALHES ANTIGOS */}
        <Route
          path="/mes/:mes"
          element={<DetalheMes />}
        />

        {/* NOVOS DETALHES ADMIN */}
        <Route
          path="/ano/:ano"
          element={<AnoDetalhePage />}
        />

        <Route
          path="/admin/mes/:mes"
          element={<MesDetalhePage />}
        />
        <Route
  path="/admin/area/:area/:tipo"
  element={<AdminAreaEntidadesPage />}
/>

        {/* ÁREAS */}
        <Route
          path="/admin/area/:area"
          element={<AdminAreaDetalhe />}
        />

        <Route
          path="/admin/subperfil/:subperfil"
          element={<AdminSubperfilDetalhe />}
        />
<Route
  path="/admin/subperfil/:subperfil/pis"
  element={<AdminSubperfilPisPage />}
/>
        {/* EXECUTIVO */}
        <Route
          path="/executivo-carteira"
          element={<ExecutivoCarteira />}
        />
      </Route>

      {/* FALLBACK */}
      <Route
        path="*"
        element={<Navigate to="/" />}
      />
    </Routes>
    
  )
}

export default App