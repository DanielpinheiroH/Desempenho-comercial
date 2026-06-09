import { getUser } from "../services/api"

import DashboardExecutivo from "./DashboardExecutivo"
import DashboardGestaoEstadual from "./DashboardGestaoEstadual"

export default function DashboardEstadual() {
  const user = getUser()

  if (user?.role === "grupo") {
    return <DashboardGestaoEstadual />
  }

  return <DashboardExecutivo />
}
