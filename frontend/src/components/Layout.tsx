import { NavLink, Outlet } from "react-router-dom"

import { clearToken, clearUser, getUser } from "../services/api"

export default function Layout() {
  const user = getUser()

  function sair() {
    clearToken()
    clearUser()
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-red-700 bg-red-600 shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 md:px-8">
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-xl font-black tracking-tight text-white">
              Desempenho Comercial
            </strong>

            <span className="truncate text-sm text-red-100">
              {user?.nome}
            </span>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? "rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm"
                  : "rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              }
            >
              Meu Perfil
            </NavLink>

            <NavLink
              to="/busca-pi"
              className={({ isActive }) =>
                isActive
                  ? "rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm"
                  : "rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              }
            >
              Busca de PI
            </NavLink>
          </nav>

          <button
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
            onClick={sair}
          >
            Sair
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-3 md:hidden">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "whitespace-nowrap rounded-xl bg-white px-4 py-2 text-xs font-bold text-red-600"
                : "whitespace-nowrap rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white"
            }
          >
            Meu Perfil
          </NavLink>

          <NavLink
            to="/busca-pi"
            className={({ isActive }) =>
              isActive
                ? "whitespace-nowrap rounded-xl bg-white px-4 py-2 text-xs font-bold text-red-600"
                : "whitespace-nowrap rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white"
            }
          >
            Busca de PI
          </NavLink>
        </div>
      </header>

      <main className="min-h-[calc(100vh-80px)] bg-zinc-50 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}