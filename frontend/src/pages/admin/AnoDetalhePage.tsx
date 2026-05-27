// ========================================
// src/pages/admin/AnoDetalhePage.tsx
// ========================================

import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api, getToken } from "../../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  campanha?: string
  produto?: string
  canal?: string
  mes_venda: string
  valor_bruto: number
  valor_liquido: number
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function getAno(mes?: string) {
  return String(mes || "").split("/")[1]
}

function getMesNumero(mes?: string) {
  return String(mes || "").split("/")[0]
}

function nomeMes(numero: string) {
  const nomes: Record<string, string> = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  }

  return nomes[numero] || numero
}

function isAgenciaDireta(value?: string | null) {
  const agencia = normalizar(value)

  return (
    agencia === "agencia direta" ||
    agencia === "agencia direto" ||
    agencia === "direto" ||
    agencia === "direta" ||
    agencia.includes("agencia direta")
  )
}

export default function AnoDetalhePage() {
  const { ano } = useParams()
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)

  async function carregarDados() {
    try {
      setLoading(true)

      const token = getToken()

      const response = await api.get("/api/pis", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setDados(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error(error)
      setDados([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const dadosAno = useMemo(() => {
    return dados.filter((item) => getAno(item.mes_venda) === ano)
  }, [dados, ano])

  const totalLiquido = dadosAno.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosAno.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const ticketMedio = dadosAno.length > 0 ? totalLiquido / dadosAno.length : 0

  const totalAnunciantes = new Set(
    dadosAno.map((item) => item.anunciante).filter(Boolean)
  ).size

  const totalAgencias = new Set(
    dadosAno
      .map((item) => item.agencia)
      .filter((agencia) => agencia && !isAgenciaDireta(agencia))
  ).size

  const meses = useMemo(() => {
    const mapa = new Map()

    dadosAno.forEach((item) => {
      const numero = getMesNumero(item.mes_venda)

      const atual =
        mapa.get(numero) || {
          numero,
          nome: nomeMes(numero),
          bruto: 0,
          liquido: 0,
          pis: 0,
        }

      atual.bruto += Number(item.valor_bruto || 0)
      atual.liquido += Number(item.valor_liquido || 0)
      atual.pis += 1

      mapa.set(numero, atual)
    })

    return Array.from(mapa.values()).sort(
      (a: any, b: any) => Number(a.numero) - Number(b.numero)
    )
  }, [dadosAno])

  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 p-5 text-zinc-950">
      <section className="overflow-hidden rounded-[2rem] bg-zinc-950 shadow-sm">
        <div className="relative isolate p-6 text-white md:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-6 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
          >
            Voltar
          </button>

          <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
            Consolidado anual
          </span>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Ano {ano}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                Visão geral do faturamento, PIs, anunciantes, agências e meses do ano.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <span className="block text-xs font-bold uppercase tracking-wide text-zinc-300">
                Total de PIs
              </span>

              <strong className="block text-3xl font-black text-white">
                {dadosAno.length}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Total líquido"
          value={money(totalLiquido)}
          helper="Valor líquido consolidado"
          variant="red"
        />

        <MetricCard
          label="Total bruto"
          value={money(totalBruto)}
          helper="Valor bruto consolidado"
          variant="dark"
        />

        <MetricCard
          label="Ticket médio"
          value={money(ticketMedio)}
          helper="Média por PI"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <NavigationCard
          label="PIs"
          value={String(dadosAno.length)}
          helper="Ver todos os PIs do ano"
          onClick={() => navigate(`/ano/${ano}/pis`)}
        />

        <NavigationCard
          label="Anunciantes"
          value={String(totalAnunciantes)}
          helper="Ver anunciantes do ano"
          onClick={() => navigate(`/ano/${ano}/anunciantes`)}
        />

        <NavigationCard
          label="Agências"
          value={String(totalAgencias)}
          helper="Ver agências do ano"
          onClick={() => navigate(`/ano/${ano}/agencias`)}
        />
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-black">Meses do ano</h2>

            <p className="text-sm text-zinc-500">
              Clique em um mês para abrir a visão detalhada dos PIs.
            </p>
          </div>

          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
            {meses.length} meses
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm font-semibold text-zinc-500">
            Carregando dados...
          </div>
        ) : meses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm font-semibold text-zinc-500">
            Nenhum mês encontrado para esse ano.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {meses.map((mes: any) => (
              <button
                key={mes.numero}
                type="button"
                onClick={() => navigate(`/admin/mes/${mes.numero}-${ano}`)}
                className="group rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-red-300 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-600 ring-1 ring-zinc-200">
                      {String(mes.numero).padStart(2, "0")}
                    </span>

                    <strong className="mt-3 block text-2xl font-black text-zinc-950">
                      {mes.nome}
                    </strong>

                    <small className="text-zinc-500">{mes.pis} PIs</small>
                  </div>

                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600 opacity-0 transition group-hover:opacity-100">
                    Abrir
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Líquido
                    </span>

                    <strong className="mt-1 block break-words text-sm font-black leading-tight text-zinc-950">
                      {money(mes.liquido)}
                    </strong>
                  </div>

                  <div className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Bruto
                    </span>

                    <strong className="mt-1 block break-words text-sm font-black leading-tight text-zinc-700">
                      {money(mes.bruto)}
                    </strong>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function MetricCard({
  label,
  value,
  helper,
  variant = "light",
}: {
  label: string
  value: string
  helper: string
  variant?: "light" | "dark" | "red"
}) {
  const classes = {
    light: "border-zinc-200 bg-white text-zinc-950",
    dark: "border-zinc-950 bg-zinc-950 text-white",
    red: "border-red-600 bg-red-600 text-white",
  }

  const helperClasses = {
    light: "text-zinc-400",
    dark: "text-zinc-400",
    red: "text-red-100",
  }

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${classes[variant]}`}>
      <span className="text-sm font-bold opacity-80">{label}</span>

      <strong className="mt-2 block break-words text-2xl font-black leading-tight md:text-3xl">
        {value}
      </strong>

      <small className={helperClasses[variant]}>{helper}</small>
    </div>
  )
}

function NavigationCard({
  label,
  value,
  helper,
  onClick,
}: {
  label: string
  value: string
  helper: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[1.5rem] border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-zinc-500">{label}</span>

          <strong className="mt-2 block text-3xl font-black text-zinc-950">
            {value}
          </strong>

          <small className="text-zinc-400">{helper}</small>
        </div>

        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600 opacity-0 transition group-hover:opacity-100">
          Abrir
        </span>
      </div>
    </button>
  )
}