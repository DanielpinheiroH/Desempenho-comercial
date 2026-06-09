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
import AdminTopAnunciantesMesPage from "./pages/admin/AdminTopAnunciantesMesPage.tsx"
import AdminTopAgenciasMesPage from "./pages/admin/AdminTopAgenciasMesPage.tsx"
import MapaBrasil from "./pages/MapaBrasil.tsx"
import MapaBrasilUfPis from "./pages/MapaBrasilUfPis.tsx"
import EstadualAnuncianteDetalhePage from "./pages/EstadualAnuncianteDetalhePage.tsx"
import EstadualAnunciantesPage from "./pages/EstadualAnunciantesPage.tsx"
import EstadualAreaPage from "./pages/EstadualAreaPage.tsx"
import EstadualExecutivosPage from "./pages/EstadualExecutivosPage.tsx"

import { getUser } from "./services/api"

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function App() {
  const token = localStorage.getItem("token")
  const user = getUser()

  const grupos = Array.isArray(user?.grupos)
    ? user.grupos.map((grupo: string) => normalizar(grupo))
    : []

  const podeVerVendasDoDia =
    user?.role === "admin" ||
    grupos.includes("federal") ||
    grupos.includes("estadual")
  const podeVerGestaoEstadual =
    user?.role === "grupo" && grupos.includes("estadual")

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

        <Route
          path="/admin/anunciantes"
          element={<AdminEntidadesPage tipo="anunciantes" />}
        />

        <Route
          path="/admin/top-anunciantes-mes"
          element={
            user?.role === "admin" ? (
              <AdminTopAnunciantesMesPage />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        <Route
          path="/admin/agencias"
          element={<AdminEntidadesPage tipo="agencias" />}
        />

        <Route
          path="/admin/top-agencias-mes"
          element={
            user?.role === "admin" ? (
              <AdminTopAgenciasMesPage />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        <Route
          path="/vendas-do-dia"
          element={
            podeVerVendasDoDia ? <VendasDoDia /> : <Navigate to="/" />
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
        <Route
          path="/estadual/anunciantes"
          element={
            podeVerGestaoEstadual ? (
              <EstadualAnunciantesPage />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/estadual/anunciantes/:anunciante"
          element={
            podeVerGestaoEstadual ? (
              <EstadualAnuncianteDetalhePage />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/estadual/area/:area"
          element={
            podeVerGestaoEstadual ? <EstadualAreaPage /> : <Navigate to="/" />
          }
        />
        <Route
          path="/estadual/executivos"
          element={
            podeVerGestaoEstadual ? (
              <EstadualExecutivosPage />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route path="/mapa-brasil" element={<MapaBrasil />} />
        <Route path="/mapa-brasil/uf/:uf" element={<MapaBrasilUfPis />} />
        <Route path="/mes/:mes" element={<DetalheMes />} />
        <Route path="/ano/:ano" element={<AnoDetalhePage />} />
        <Route path="/admin/mes/:mes" element={<MesDetalhePage />} />

        <Route
          path="/admin/area/:area/:tipo"
          element={<AdminAreaEntidadesPage />}
        />

        <Route path="/admin/area/:area" element={<AdminAreaDetalhe />} />

        <Route
          path="/admin/subperfil/:subperfil"
          element={<AdminSubperfilDetalhe />}
        />

        <Route
          path="/admin/subperfil/:subperfil/pis"
          element={<AdminSubperfilPisPage />}
        />

        <Route path="/executivo-carteira" element={<ExecutivoCarteira />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App
