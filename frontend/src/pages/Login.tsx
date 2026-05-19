import { FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, setToken, setUser } from "../services/api"

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")

  async function handleLogin(e: FormEvent) {
    e.preventDefault()

    try {
      setLoading(true)
      setErro("")

      const response = await api.post("/api/auth/login", {
        email,
        senha,
      })

      setToken(response.data.token)
      setUser(response.data.usuario)

      navigate("/")
      window.location.reload()
    } catch {
      setErro("E-mail ou senha inválidos.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-6">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-2xl md:grid-cols-[1fr_460px]">
        <div className="relative hidden overflow-hidden bg-red-600 p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-black blur-3xl" />
          </div>

          <div className="relative z-10">
            <img
              src="/logo.gif"
              alt="Logo"
              className="mb-10 h-24 w-auto object-contain"
            />

            <h1 className="max-w-md text-5xl font-black leading-tight tracking-tight">
              Desempenho Comercial
            </h1>

            <p className="mt-6 max-w-md text-sm leading-7 text-red-100">
              Acesse seu painel para acompanhar faturamento, metas,
              anunciantes, agências, carteira comercial e evolução dos PIs.
            </p>
          </div>

          <div className="relative z-10 rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
            <strong className="block text-base font-black">
              Painel Executivo
            </strong>

            <span className="mt-2 block text-sm leading-6 text-red-100">
              Gestão de performance, acompanhamento de metas e análise completa
              da carteira comercial.
            </span>
          </div>
        </div>

        <form
          className="flex flex-col justify-center p-6 sm:p-10 md:p-12"
          onSubmit={handleLogin}
        >
          <div className="mb-10 md:hidden">
            <img
              src="/logo.gif"
              alt="Logo"
              className="mb-5 h-20 w-auto object-contain"
            />

            <h1 className="text-4xl font-black tracking-tight text-zinc-950">
              Desempenho Comercial
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Entre para acessar seu painel comercial.
            </p>
          </div>

          <div className="mb-10 hidden md:block">
            <span className="mb-4 inline-flex rounded-full bg-red-50 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-red-700">
              Acesso restrito
            </span>

            <h2 className="text-4xl font-black tracking-tight text-zinc-950">
              Entrar na conta
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Informe seus dados para continuar.
            </p>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-zinc-700">
                E-mail
              </span>

              <input
                type="email"
                placeholder="seuemail@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-zinc-700">
                Senha
              </span>

              <input
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-50"
              />
            </label>
          </div>

          {erro && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-7 flex h-14 w-full items-center justify-center rounded-2xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="mt-8 text-center text-xs text-zinc-400">
            Sistema interno • Desempenho Comercial
          </div>
        </form>
      </section>
    </main>
  )
}