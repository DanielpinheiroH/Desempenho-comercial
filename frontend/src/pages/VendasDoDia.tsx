import { useEffect, useMemo, useState } from "react"

import { api, getToken } from "../services/api"

type Pi = {
  pi_matriz?: string
  numero_pi: string
  anunciante: string
  razao_social_anunciante?: string
  codinome?: string
  cnpj_anunciante?: string
  uf_cliente?: string
  executivo: string
  diretoria?: string
  grupo?: string
  campanha?: string
  agencia: string
  razao_social_agencia?: string
  cnpj_agencia?: string
  uf_agencia?: string
  data_inicial_veiculacao?: string
  data_final_veiculacao?: string
  mes_venda: string
  mes_inicial_veiculacao?: string
  canal?: string
  perfil_anunciante?: string
  sub_perfil_anunciante?: string
  produto?: string
  data_venda?: string
  valor_bruto: number
  valor_liquido: number
  vencimento?: string
  data_emissao_recebimento_pi?: string
  observacoes?: string
}

type AreaTipo = "privado" | "gestao-executiva" | "estadual" | "federal" | "gdf"

type ResumoItem = {
  nome: string
  pis: number
  bruto: number
  liquido: number
}

type ModoFiltro = "periodo" | "mes"

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function mesAtualBR() {
  const hoje = new Date()
  const mes = String(hoje.getMonth() + 1).padStart(2, "0")
  const ano = String(hoje.getFullYear())

  return `${mes}/${ano}`
}

function isoParaBR(value: string) {
  if (!value) return ""

  const [ano, mes, dia] = value.split("-")

  return `${dia}/${mes}/${ano}`
}

function brParaDate(value?: string) {
  if (!value) return null

  const [dia, mes, ano] = String(value).split("/")

  if (!dia || !mes || !ano) return null

  return new Date(Number(ano), Number(mes) - 1, Number(dia))
}

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function classificarArea(item: Pi): AreaTipo {
  const perfil = normalizar(item.perfil_anunciante)
  const sub = normalizar(item.sub_perfil_anunciante)
  const executivo = normalizar(item.executivo)
  const grupo = normalizar(item.grupo)

  if (grupo === "federal" || perfil.includes("federal") || sub.includes("federal")) {
    return "federal"
  }

  if (executivo.includes("gestao executiva") || sub.includes("gestao executiva")) {
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

function nomeArea(area: AreaTipo) {
  const nomes: Record<AreaTipo, string> = {
    privado: "Comercial Privado",
    "gestao-executiva": "Gestão Executiva",
    estadual: "Comercial Estadual",
    federal: "Comercial Federal",
    gdf: "GDF / CLDF",
  }

  return nomes[area]
}

function agrupar(dados: Pi[], getNome: (item: Pi) => string): ResumoItem[] {
  const mapa = new Map<string, ResumoItem>()

  dados.forEach((item) => {
    const nome = getNome(item) || "Não informado"

    const atual = mapa.get(nome) || {
      nome,
      pis: 0,
      bruto: 0,
      liquido: 0,
    }

    atual.pis += 1
    atual.bruto += Number(item.valor_bruto || 0)
    atual.liquido += Number(item.valor_liquido || 0)

    mapa.set(nome, atual)
  })

  return Array.from(mapa.values()).sort((a, b) => b.liquido - a.liquido)
}

function ordenarPerfis(items: ResumoItem[]) {
  const ordem = [
    "privado",
    "atendimento gov. federal",
    "governo estadual",
    "secom - df",
    "brb - df",
    "caesb - df",
    "ceb - df",
    "detran - df",
    "cldf",
    "gestao executiva",
    "gestão executiva",
  ]

  return [...items].sort((a, b) => {
    const nomeA = normalizar(a.nome)
    const nomeB = normalizar(b.nome)

    const indexA = ordem.findIndex((item) => nomeA.includes(normalizar(item)))
    const indexB = ordem.findIndex((item) => nomeB.includes(normalizar(item)))

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1

    return b.liquido - a.liquido
  })
}

export default function VendasDoDia() {
  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [modoFiltro, setModoFiltro] = useState<ModoFiltro>("periodo")
  const [dataInicio, setDataInicio] = useState(hojeISO())
  const [dataFim, setDataFim] = useState(hojeISO())
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualBR())
  const [busca, setBusca] = useState("")
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)

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

  const mesesDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        dados
          .map((item) => item.mes_venda)
          .filter(Boolean)
      )
    ).sort((a, b) => {
      const [mesA, anoA] = String(a).split("/")
      const [mesB, anoB] = String(b).split("/")

      const valorA = Number(`${anoA}${mesA}`)
      const valorB = Number(`${anoB}${mesB}`)

      return valorB - valorA
    })
  }, [dados])

  const periodoLabel =
    modoFiltro === "mes"
      ? `Mês ${mesSelecionado}`
      : dataInicio === dataFim
        ? isoParaBR(dataInicio)
        : `${isoParaBR(dataInicio)} até ${isoParaBR(dataFim)}`

  const vendasFiltradas = useMemo(() => {
    const inicio = brParaDate(isoParaBR(dataInicio))
    const fim = brParaDate(isoParaBR(dataFim))
    const termo = normalizar(busca)

    return dados.filter((item) => {
      const dataVenda = brParaDate(item.data_venda)

      const batePeriodo =
        modoFiltro === "mes"
          ? item.mes_venda === mesSelecionado
          : Boolean(dataVenda && inicio && fim && dataVenda >= inicio && dataVenda <= fim)

      const texto = normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.diretoria,
          item.grupo,
          item.perfil_anunciante,
          item.sub_perfil_anunciante,
          item.campanha,
          item.produto,
          item.canal,
          item.data_venda,
          item.mes_venda,
        ].join(" ")
      )

      return batePeriodo && (!termo || texto.includes(termo))
    })
  }, [dados, dataInicio, dataFim, mesSelecionado, busca, modoFiltro])

  const totalLiquido = vendasFiltradas.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = vendasFiltradas.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const ticketMedio =
    vendasFiltradas.length > 0 ? totalLiquido / vendasFiltradas.length : 0

  const areas = useMemo(() => {
    return agrupar(vendasFiltradas, (item) => nomeArea(classificarArea(item)))
  }, [vendasFiltradas])

  const subperfis = useMemo(() => {
    return agrupar(
      vendasFiltradas,
      (item) => item.sub_perfil_anunciante || "Sem subperfil"
    )
  }, [vendasFiltradas])

  const perfisAnunciante = useMemo(() => {
  return ordenarPerfis(
    agrupar(
      vendasFiltradas,
      (item) =>
        item.sub_perfil_anunciante ||
        item.perfil_anunciante ||
        item.grupo ||
        "Não informado"
    )
  )
}, [vendasFiltradas])

  function aplicarHoje() {
    const hoje = hojeISO()

    setModoFiltro("periodo")
    setDataInicio(hoje)
    setDataFim(hoje)
  }

  function aplicarMesAtual() {
    setModoFiltro("mes")
    setMesSelecionado(mesAtualBR())
  }

  function selecionarPi(item: Pi) {
    setPiSelecionado(item)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-zinc-950 shadow-sm">
        <div className="relative isolate p-6 text-white md:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-red-100">
            Vendas
          </span>

          <h1 className="mt-4 text-4xl font-black md:text-5xl">
            Vendas do período
          </h1>

          <p className="mt-2 text-zinc-300">{periodoLabel}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModoFiltro("periodo")}
            className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
              modoFiltro === "periodo"
                ? "bg-red-600 text-white"
                : "border border-zinc-200 text-zinc-700 hover:border-red-500 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            Dia ou período
          </button>

          <button
            type="button"
            onClick={() => setModoFiltro("mes")}
            className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
              modoFiltro === "mes"
                ? "bg-red-600 text-white"
                : "border border-zinc-200 text-zinc-700 hover:border-red-500 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            Vendas do mês
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[180px_180px_180px_1fr_auto_auto_auto]">
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Data inicial
            </label>

            <input
              type="date"
              disabled={modoFiltro === "mes"}
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none disabled:bg-zinc-100 disabled:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Data final
            </label>

            <input
              type="date"
              disabled={modoFiltro === "mes"}
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none disabled:bg-zinc-100 disabled:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Mês
            </label>

            <select
              disabled={modoFiltro === "periodo"}
              value={mesSelecionado}
              onChange={(event) => {
                setModoFiltro("mes")
                setMesSelecionado(event.target.value)
              }}
              className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none disabled:bg-zinc-100 disabled:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            >
              {mesesDisponiveis.map((mes) => (
                <option key={mes} value={mes}>
                  {mes}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Busca
            </label>

            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar PI, executivo, anunciante, agência, setor..."
              className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>

          <button
            type="button"
            onClick={aplicarHoje}
            className="self-end rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={aplicarMesAtual}
            className="self-end rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
          >
            Mês atual
          </button>

          <button
            type="button"
            onClick={() => setBusca("")}
            className="self-end rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-black text-zinc-700 transition hover:border-red-500 hover:bg-red-50 hover:text-red-700"
          >
            Limpar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card label="Total líquido" value={money(totalLiquido)} variant="red" />
        <Card label="Total bruto" value={money(totalBruto)} variant="dark" />
        <Card label="PIs vendidos" value={String(vendasFiltradas.length)} />
        <Card label="Ticket médio" value={money(ticketMedio)} />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-red-700 bg-white shadow-sm">
        <div className="bg-red-700 px-5 py-3 text-center text-xl font-black text-white">
          {periodoLabel}
        </div>

        <div className="grid grid-cols-[1fr_220px_220px] bg-red-700 text-white">
          <div className="border-r border-white/40 px-4 py-2 text-center text-lg font-black">
            Perfil Anunciante
          </div>

          <div className="border-r border-white/40 px-4 py-2 text-center text-lg font-black">
            Valor bruto
          </div>

          <div className="px-4 py-2 text-center text-lg font-black">
            Valor líquido
          </div>
        </div>

        {perfisAnunciante.length === 0 ? (
          <EmptyState text="Nenhuma venda encontrada para o período." />
        ) : (
          <>
            {perfisAnunciante.map((item, index) => (
              <div
                key={`${item.nome}-${index}`}
                className={`grid grid-cols-[1fr_220px_220px] text-sm ${
                  index % 2 === 0 ? "bg-red-50" : "bg-white"
                }`}
              >
                <div className="border-r border-white px-3 py-1 font-black">
                  {item.nome}
                </div>

                <div className="border-r border-white px-3 py-1 text-right font-black">
                  {money(item.bruto)}
                </div>

                <div className="px-3 py-1 text-right font-black">
                  {money(item.liquido)}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-[1fr_220px_220px] bg-red-700 text-lg font-black text-white">
              <div className="border-r border-white/40 px-3 py-2">
                Total Comercial
              </div>

              <div className="border-r border-white/40 px-3 py-2 text-right">
                {money(totalBruto)}
              </div>

              <div className="px-3 py-2 text-right">
                {money(totalLiquido)}
              </div>
            </div>
          </>
        )}
      </section>

      {piSelecionado && (
        <section className="rounded-[2rem] border border-red-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                PI selecionado
              </span>

              <h2 className="mt-3 text-3xl font-black text-zinc-950">
                PI {piSelecionado.numero_pi}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setPiSelecionado(null)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              Fechar
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="PI Matriz" value={piSelecionado.pi_matriz} />
            <InfoCard label="Número PI" value={piSelecionado.numero_pi} />
            <InfoCard label="Data venda" value={piSelecionado.data_venda} />
            <InfoCard label="Executivo" value={piSelecionado.executivo} />
            <InfoCard label="Diretoria" value={piSelecionado.diretoria} />
            <InfoCard label="Grupo" value={piSelecionado.grupo} />
            <InfoCard label="Anunciante" value={piSelecionado.anunciante} />
            <InfoCard label="Razão Social Anunciante" value={piSelecionado.razao_social_anunciante} />
            <InfoCard label="CNPJ Anunciante" value={piSelecionado.cnpj_anunciante} />
            <InfoCard label="Campanha" value={piSelecionado.campanha} />
            <InfoCard label="Agência" value={piSelecionado.agencia} />
            <InfoCard label="Canal" value={piSelecionado.canal} />
            <InfoCard label="Perfil Anunciante" value={piSelecionado.perfil_anunciante} />
            <InfoCard label="Sub Perfil Anunciante" value={piSelecionado.sub_perfil_anunciante} />
            <InfoCard label="Produto" value={piSelecionado.produto} />
            <InfoCard label="Valor bruto" value={money(piSelecionado.valor_bruto)} />
            <InfoCard label="Valor líquido" value={money(piSelecionado.valor_liquido)} />
            <InfoCard label="Vencimento" value={piSelecionado.vencimento} />
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <ResumoCard title="Áreas comerciais" items={areas} />
        <ResumoCard title="Subperfis" items={subperfis} />
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-black">Lista de vendas</h2>

            <p className="text-sm text-zinc-500">
              Clique em um PI para visualizar as informações completas.
            </p>
          </div>

          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
            {vendasFiltradas.length} PIs
          </span>
        </div>

        {loading ? (
          <EmptyState text="Carregando..." />
        ) : vendasFiltradas.length === 0 ? (
          <EmptyState text="Nenhuma venda encontrada para esse período." />
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">PI</th>
                  <th className="px-4 py-3">Data venda</th>
                  <th className="px-4 py-3">Mês venda</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Subperfil</th>
                  <th className="px-4 py-3">Executivo</th>
                  <th className="px-4 py-3">Anunciante</th>
                  <th className="px-4 py-3">Agência</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                </tr>
              </thead>

              <tbody>
                {vendasFiltradas.map((item, index) => (
                  <tr
                    key={`${item.numero_pi}-${index}`}
                    onClick={() => selecionarPi(item)}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-red-50"
                  >
                    <td className="px-4 py-3 font-black text-red-600">
                      {item.numero_pi}
                    </td>

                    <td className="px-4 py-3">{item.data_venda || "-"}</td>
                    <td className="px-4 py-3">{item.mes_venda || "-"}</td>

                    <td className="px-4 py-3 font-semibold">
                      {nomeArea(classificarArea(item))}
                    </td>

                    <td className="px-4 py-3">{item.perfil_anunciante || "-"}</td>
                    <td className="px-4 py-3">{item.sub_perfil_anunciante || "-"}</td>
                    <td className="px-4 py-3">{item.executivo}</td>
                    <td className="px-4 py-3">{item.anunciante}</td>
                    <td className="px-4 py-3">{item.agencia}</td>

                    <td className="px-4 py-3 text-right font-black">
                      {money(item.valor_liquido)}
                    </td>

                    <td className="px-4 py-3 text-right font-black text-zinc-600">
                      {money(item.valor_bruto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function Card({
  label,
  value,
  variant = "light",
}: {
  label: string
  value: string
  variant?: "light" | "dark" | "red"
}) {
  const classes = {
    light: "border-zinc-200 bg-white text-zinc-950",
    dark: "border-zinc-950 bg-zinc-950 text-white",
    red: "border-red-600 bg-red-600 text-white",
  }

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${classes[variant]}`}>
      <span className="text-sm font-bold opacity-80">{label}</span>

      <strong className="mt-2 block break-words text-2xl font-black">
        {value}
      </strong>
    </div>
  )
}

function ResumoCard({
  title,
  items,
}: {
  title: string
  items: ResumoItem[]
}) {
  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{title}</h2>

          <p className="text-sm text-zinc-500">
            Ordenado por valor líquido.
          </p>
        </div>

        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
          {items.length}
        </span>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <EmptyState text="Nenhum dado encontrado." />
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.nome}-${index}`}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-black text-red-600">
                    #{index + 1}
                  </span>

                  <strong className="mt-1 block break-words text-sm font-black text-zinc-950">
                    {item.nome}
                  </strong>

                  <small className="text-zinc-500">
                    {item.pis} PIs
                  </small>
                </div>

                <div className="text-right">
                  <b className="block text-sm font-black">
                    {money(item.liquido)}
                  </b>

                  <small className="text-xs text-zinc-500">
                    Bruto: {money(item.bruto)}
                  </small>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <span className="block text-xs font-black uppercase tracking-wide text-zinc-500">
        {label}
      </span>

      <strong className="mt-1 block break-words text-sm font-black text-zinc-950">
        {value || "-"}
      </strong>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm font-semibold text-zinc-500">
      {text}
    </div>
  )
}