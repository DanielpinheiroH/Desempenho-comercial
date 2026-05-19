import { Navigate, Route, Routes } from "react-router-dom"

import Layout from "./components/Layout.tsx"
import BuscaPI from "./pages/BuscaPi.tsx"
import Dashboard from "./pages/Dashboard.tsx"
import DetalheMes from "./pages/DetalheMes.tsx"
import Login from "./pages/Login.tsx"
import AdminAreaDetalhe from "./pages/AdminAreaDetalhe.tsx"
import AdminSubperfilDetalhe from "./pages/AdminSubperfilDetalhe.tsx"
import ExecutivoCarteira from "./pages/ExecutivoCarteira.tsx" 

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
        <Route path="/" element={<Dashboard />} />
        <Route path="/mes/:mes" element={<DetalheMes />} />
        <Route path="/busca-pi" element={<BuscaPI />} />
        <Route path="/admin/area/:area" element={<AdminAreaDetalhe />} />
<Route path="/admin/subperfil/:subperfil" element={<AdminSubperfilDetalhe />} />
<Route path="/executivo-carteira" element={<ExecutivoCarteira />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App