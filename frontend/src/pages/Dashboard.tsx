import { getUser } from "../services/api"

import DashboardAdmin from "./DashboardAdmin"
import DashboardEstadual from "./DashboardEstadual"
import DashboardExecutivo from "./DashboardExecutivo"
import DashboardFederal from "./DashboardFederal"

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export default function Dashboard() {
  const user = getUser()

  const grupos = Array.isArray(user?.grupos)
    ? user.grupos.map((g: string) => normalizar(g))
    : []

  if (user?.role === "admin") {
    return <DashboardAdmin />
  }

  if (
    user?.role === "grupo" &&
    grupos.includes("federal")
  ) {
    return <DashboardFederal />
  }

  if (grupos.includes("estadual")) {
    return <DashboardEstadual />
  }

  return <DashboardExecutivo />
}