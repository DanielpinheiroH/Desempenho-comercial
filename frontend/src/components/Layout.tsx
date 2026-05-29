import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"

import { clearToken, clearUser, getUser } from "../services/api"

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export default function Layout() {
  const user = getUser()
  const [menuAberto, setMenuAberto] = useState(false)

  const grupos = Array.isArray(user?.grupos)
    ? user.grupos.map((grupo: string) => normalizar(grupo))
    : []

  const podeVerVendasDoDia =
    user?.role === "admin" ||
    grupos.includes("federal") ||
    grupos.includes("estadual")

  function sair() {
    clearToken()
    clearUser()
    window.location.href = "/login"
  }

  function fecharMenu() {
    setMenuAberto(false)
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm"
      : "rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "block rounded-xl bg-white px-4 py-3 text-sm font-bold text-red-600"
      : "block rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-red-700 bg-red-600 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-20 md:px-8">
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-base font-black tracking-tight text-white md:text-xl">
              Desempenho Comercial
            </strong>

            <span className="truncate text-xs text-red-100 md:text-sm">
              {user?.nome}
            </span>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <NavLink to="/" className={linkClass}>
              Meu Perfil
            </NavLink>

            <NavLink to="/busca-pi" className={linkClass}>
              Busca de PI
            </NavLink>

            {podeVerVendasDoDia && (
              <NavLink to="/vendas-do-dia" className={linkClass}>
                Vendas do Dia
              </NavLink>
            )}
          </nav>

          <div className="hidden md:block">
            <button
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
              onClick={sair}
            >
              Sair
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuAberto((atual) => !atual)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-2xl font-black text-red-600 md:hidden"
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          >
            {menuAberto ? "×" : "☰"}
          </button>
        </div>

        {menuAberto && (
          <div className="border-t border-white/10 px-4 pb-4 pt-3 md:hidden">
            <div className="space-y-2">
              <NavLink to="/" className={mobileLinkClass} onClick={fecharMenu}>
                Meu Perfil
              </NavLink>

              <NavLink
                to="/busca-pi"
                className={mobileLinkClass}
                onClick={fecharMenu}
              >
                Busca de PI
              </NavLink>

              {podeVerVendasDoDia && (
                <NavLink
                  to="/vendas-do-dia"
                  className={mobileLinkClass}
                  onClick={fecharMenu}
                >
                  Vendas do Dia
                </NavLink>
              )}

              <button
                type="button"
                onClick={sair}
                className="block w-full rounded-xl bg-white px-4 py-3 text-left text-sm font-bold text-red-600"
              >
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="min-h-[calc(100vh-64px)] bg-zinc-50 px-4 py-4 md:min-h-[calc(100vh-80px)] md:px-8 md:py-6">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}