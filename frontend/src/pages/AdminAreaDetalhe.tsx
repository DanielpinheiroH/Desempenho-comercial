import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api, getToken } from "../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  perfil_anunciante?: string
  sub_perfil_anunciante?: string
  campanha?: string
  produto?: string
  canal?: string
  mes_venda: string
  valor_bruto: number
  valor_liquido: number
}

type AreaTipo =
  | "privado"
  | "gestao-executiva"
  | "estadual"
  | "federal"
  | "gdf"

type PiTratado = Pi & {
  area_classificada: AreaTipo
}

type RankingItem = {
  nome: string
  total: number
  bruto: number
  pis: number
}

type MesResumo = {
  mes: string
  ano: string
  mesNumero: number
  bruto: number
  liquido: number
  pis: number
}

type AnoResumo = {
  ano: string
  bruto: number
  liquido: number
  pis: number
  meses: MesResumo[]
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
  return String(mes || "").split("/")[1] || "Sem ano"
}

function getMesNumero(mes?: string) {
  return String(mes || "").split("/")[0] || "Sem mês"
}

function nomeArea(area: AreaTipo) {
  const nomes: Record<AreaTipo, string> = {
    privado: "Comercial Privado",
    "gestao-executiva": "Gestão Executiva",
    estadual: "Comercial Estadual",
    federal: "Comercial Federal",
    gdf: "GDF / CLDF",
  }

  return nomes[area] || "Área comercial"
}

function classificarArea(item: Pi): AreaTipo {
  const perfil = normalizar(item.perfil_anunciante)
  const sub = normalizar(item.sub_perfil_anunciante)
  const executivo = normalizar(item.executivo)
  const grupo = normalizar(item.grupo)

  if (grupo === "federal" || perfil.includes("federal") || sub.includes("federal")) {
    return "federal"
  }

  if (
    executivo.includes("gestao executiva") ||
    sub.includes("gestao executiva")
  ) {
    return "gestao-executiva"
  }

  if (sub.includes("gdf") || sub.includes("cldf")) {
    return "gdf"
  }

  if (grupo === "estadual" || perfil.includes("estadual")) {
    return "estadual"
  }

  return "privado"
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

function agruparRanking(dados: PiTratado[], campo: keyof PiTratado, limite = 10) {
  const mapa = new Map<string, RankingItem>()

  dados.forEach((item) => {
    const nome = String(item[campo] || "").trim() || "Não informado"

    const atual = mapa.get(nome) || {
      nome,
      total: 0,
      bruto: 0,
      pis: 0,
    }

    atual.total += Number(item.valor_liquido || 0)
    atual.bruto += Number(item.valor_bruto || 0)
    atual.pis += 1

    mapa.set(nome, atual)
  })

  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limite)
}

export default function AdminAreaDetalhe() {
  const { area } = useParams()
  const navigate = useNavigate()

  const areaAtual = area as AreaTipo

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [anoAberto, setAnoAberto] = useState<string | null>(null)

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

  const dadosTratados = useMemo<PiTratado[]>(() => {
    return dados.map((item) => ({
      ...item,
      area_classificada: classificarArea(item),
    }))
  }, [dados])

  const dadosDaArea = useMemo(() => {
    return dadosTratados.filter((item) => item.area_classificada === areaAtual)
  }, [dadosTratados, areaAtual])

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosDaArea
          .map((item) => getAno(item.mes_venda))
          .filter((ano) => ano && ano !== "Sem ano")
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosDaArea])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    return dadosDaArea.filter((item) => {
      const bateAno = !anoSelecionado || getAno(item.mes_venda) === anoSelecionado

      const texto = normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.campanha,
          item.produto,
          item.canal,
          item.mes_venda,
          item.perfil_anunciante,
          item.sub_perfil_anunciante,
        ].join(" ")
      )

      const bateBusca = !termo || texto.includes(termo)

      return bateAno && bateBusca
    })
  }, [dadosDaArea, busca, anoSelecionado])

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalPIs = dadosFiltrados.length

  const ticketMedio = totalPIs > 0 ? totalLiquido / totalPIs : 0

  const totalAnunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const totalAgencias = new Set(
    dadosFiltrados
      .map((item) => item.agencia)
      .filter((agencia) => agencia && !isAgenciaDireta(agencia))
  ).size

  const topAnunciantes = useMemo(
    () => agruparRanking(dadosFiltrados, "anunciante", 10),
    [dadosFiltrados]
  )

  const topAgencias = useMemo(
    () =>
      agruparRanking(
        dadosFiltrados.filter((item) => !isAgenciaDireta(item.agencia)),
        "agencia",
        10
      ),
    [dadosFiltrados]
  )

  const faturamentoPorAno = useMemo<AnoResumo[]>(() => {
    const mapaMes = new Map<string, MesResumo>()

    dadosFiltrados.forEach((item) => {
      const mes = item.mes_venda || "Sem mês"
      const ano = getAno(mes)
      const mesNumero = Number(getMesNumero(mes) || 99)

      const atual = mapaMes.get(mes) || {
        mes,
        ano,
        mesNumero,
        bruto: 0,
        liquido: 0,
        pis: 0,
      }

      atual.bruto += Number(item.valor_bruto || 0)
      atual.liquido += Number(item.valor_liquido || 0)
      atual.pis += 1

      mapaMes.set(mes, atual)
    })

    const meses = Array.from(mapaMes.values()).sort((a, b) => {
      if (a.ano !== b.ano) return Number(b.ano) - Number(a.ano)
      return a.mesNumero - b.mesNumero
    })

    const mapaAno = new Map<string, AnoResumo>()

    meses.forEach((mes) => {
      const atual = mapaAno.get(mes.ano) || {
        ano: mes.ano,
        bruto: 0,
        liquido: 0,
        pis: 0,
        meses: [],
      }

      atual.bruto += mes.bruto
      atual.liquido += mes.liquido
      atual.pis += mes.pis
      atual.meses.push(mes)

      mapaAno.set(mes.ano, atual)
    })

    return Array.from(mapaAno.values()).sort(
      (a, b) => Number(b.ano) - Number(a.ano)
    )
  }, [dadosFiltrados])

  function limparFiltros() {
    setBusca("")
    setAnoSelecionado("")
  }

  function alternarAno(ano: string) {
    setAnoAberto((atual) => (atual === ano ? null : ano))
  }

  if (!areaAtual) {
    return (
      <main className="min-h-screen bg-zinc-100 p-5 text-zinc-950">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
          Área não encontrada.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 text-zinc-950">
      <section className="overflow-hidden rounded-[2rem] bg-zinc-950 shadow-sm">
        <div className="relative isolate p-5 text-white sm:p-7 lg:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
          >
            Voltar ao dashboard
          </button>

          <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
            Área comercial
          </span>

          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
            {nomeArea(areaAtual)}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300 md:text-base">
            Visão consolidada da área com faturamento, anunciantes, agências e evolução mensal.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <select
            value={anoSelecionado}
            onChange={(event) => setAnoSelecionado(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todos os anos</option>

            {anos.map((ano) => (
              <option value={ano} key={ano}>
                {ano}
              </option>
            ))}
          </select>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            placeholder="Buscar PI, executivo, anunciante, agência, campanha..."
          />

          <button
            type="button"
            onClick={limparFiltros}
            className="h-12 rounded-2xl border border-zinc-200 px-5 text-sm font-black text-zinc-700 transition hover:border-red-500 hover:bg-red-50 hover:text-red-700"
          >
            Limpar
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingDashboard />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total bruto"
              value={money(totalBruto)}
              helper="Receita bruta filtrada"
              variant="dark"
              compact
            />

            <KpiCard
              label="Total líquido"
              value={money(totalLiquido)}
              helper="Receita líquida filtrada"
              variant="red"
              compact
            />

            <ActionCard
              label="Total de PIs"
              title={String(totalPIs)}
              helper="Clique para ver todos"
              onClick={() => navigate(`/admin/area/${areaAtual}/pis`)}
            />

            <KpiCard
              label="Ticket médio"
              value={money(ticketMedio)}
              helper="Média por PI"
              compact
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <ActionCard
              label="Anunciantes"
              title={String(totalAnunciantes)}
              helper="Clique para ver todos"
              onClick={() => navigate(`/admin/area/${areaAtual}/anunciantes`)}
            />

            <ActionCard
              label="Agências"
              title={String(totalAgencias)}
              helper="Clique para ver todas"
              onClick={() => navigate(`/admin/area/${areaAtual}/agencias`)}
            />
          </section>

          <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black">Faturamento por ano</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Clique em um ano para visualizar os meses consolidados.
                </p>
              </div>

              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                {faturamentoPorAno.length} anos
              </span>
            </div>

            {faturamentoPorAno.length === 0 ? (
              <EmptyState text="Nenhum faturamento encontrado." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {faturamentoPorAno.map((ano) => {
                  const aberto = anoAberto === ano.ano

                  return (
                    <div
                      key={ano.ano}
                      className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <button
                        type="button"
                        onClick={() => alternarAno(ano.ano)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block text-xl font-black text-zinc-950">
                              {ano.ano}
                            </strong>

                            <small className="block text-zinc-400">
                              {ano.pis} PIs
                            </small>
                          </div>

                          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-red-600">
                            {aberto ? "Fechar" : "Abrir"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                              Líquido
                            </span>

                            <strong className="mt-1 block break-all text-xs font-black leading-tight text-zinc-950">
                              {money(ano.liquido)}
                            </strong>
                          </div>

                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                              Bruto
                            </span>

                            <strong className="mt-1 block break-all text-[11px] font-black leading-tight text-zinc-700">
                              {money(ano.bruto)}
                            </strong>
                          </div>
                        </div>
                      </button>

                      {aberto && (
                        <div className="mt-4 border-t border-zinc-200 pt-4">
                          <div className="space-y-2">
                            {ano.meses
                              .sort((a, b) => a.mesNumero - b.mesNumero)
                              .map((mes) => (
                                <button
                                  key={mes.mes}
                                  type="button"
                                  onClick={() =>
  navigate(
    `/admin/mes/${mes.mes.replace("/", "-")}?area=${areaAtual}`
  )
}
                                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-red-300 hover:bg-red-50"
                                >
                                  <strong className="block text-sm font-black text-zinc-950">
                                    {mes.mes}
                                  </strong>

                                  <small className="text-zinc-500">
                                    {mes.pis} PIs
                                  </small>

                                  <div className="mt-2 text-center">
                                    <b className="block break-all text-[9px] font-black leading-tight text-zinc-950">
                                      {money(mes.liquido)}
                                    </b>

                                    <small className="mt-1 block break-all text-[8px] leading-tight text-zinc-400">
                                      Bruto: {money(mes.bruto)}
                                    </small>
                                  </div>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <RankingCard title="Top anunciantes da área" items={topAnunciantes} />
            <RankingCard title="Top agências da área" items={topAgencias} />
          </section>
        </>
      )}
    </main>
  )
}

function KpiCard({
  label,
  value,
  helper,
  variant = "light",
  compact = false,
}: {
  label: string
  value: string
  helper: string
  variant?: "light" | "dark" | "red"
  compact?: boolean
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

  const labelClasses = {
    light: "text-zinc-500",
    dark: "text-zinc-300",
    red: "text-red-100",
  }

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${classes[variant]}`}>
      <span className={`text-sm font-bold ${labelClasses[variant]}`}>
        {label}
      </span>

      <strong
        className={`mt-2 block break-words font-black leading-tight ${
          compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
        }`}
      >
        {value}
      </strong>

      <small className={helperClasses[variant]}>{helper}</small>
    </div>
  )
}

function ActionCard({
  label,
  title,
  helper,
  onClick,
}: {
  label: string
  title: string
  helper: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
    >
      <span className="text-sm font-bold text-zinc-500">{label}</span>

      <strong className="mt-2 block break-words text-2xl font-black text-zinc-950">
        {title}
      </strong>

      <small className="text-zinc-400">{helper}</small>
    </button>
  )
}

function RankingCard({
  title,
  items,
}: {
  title: string
  items: RankingItem[]
}) {
  const maior = items[0]?.total || 1

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ordenado por valor líquido.
        </p>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <EmptyState text="Nenhum dado encontrado." />
        ) : (
          items.map((item, index) => {
            const percent = Math.max((item.total / maior) * 100, 4)

            return (
              <div key={`${item.nome}-${index}`}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-red-600">
                      #{index + 1}
                    </span>

                    <strong className="block truncate text-sm text-zinc-950">
                      {item.nome}
                    </strong>

                    <small className="text-zinc-400">
                      {item.pis} PIs
                    </small>
                  </div>

                  <b className="shrink-0 text-sm text-zinc-950">
                    {money(item.total)}
                  </b>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-red-600"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm font-semibold text-zinc-500">
      {text}
    </div>
  )
}

function LoadingDashboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-36 animate-pulse rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-24 rounded-full bg-zinc-200" />
          <div className="mt-5 h-8 w-40 rounded-full bg-zinc-200" />
          <div className="mt-4 h-3 w-28 rounded-full bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}