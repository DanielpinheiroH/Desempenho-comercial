import { getUser } from "../services/api"

import DashboardAdmin from "./DashboardAdmin"
import DashboardEstadual from "./DashboardEstadual"
import DashboardExecutivo from "./DashboardExecutivo"
import DashboardFederal from "./DashboardFederal"

export default function Dashboard() {
  const user = getUser()

  if (user?.role === "admin") {
    return <DashboardAdmin />
  }

  if (user?.role === "grupo" && user?.grupos?.includes("federal")) {
    return <DashboardFederal />
  }

  if (user?.grupos?.includes("estadual")) {
    return <DashboardEstadual />
  }

  return <DashboardExecutivo />
}