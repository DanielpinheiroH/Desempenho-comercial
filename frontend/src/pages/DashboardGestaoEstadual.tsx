import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { getPisCached, getUser } from "../services/api"
import {
  AREAS_DJANANE,
  classificarAreaComercial,
  nomeAreaComercial,
  normalizarTexto,
  pertenceAoEscopoDjanane,
  type AreaComercial,
} from "../utils/areasComerciais"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo?: string
  perfil_anunciante?: string
  sub_perfil_anunciante?: string
  campanha?: string
  mes_venda: string
  uf_cliente?: string
  valor_bruto: number
  valor_liquido: number
}

type AreaResumo = {
  area: AreaComercial
  pis: number
  liquido: number
  bruto: number
  anunciantes: number
}

type RankingItem = {
  nome: string
  liquido: number
  pis: number
}

const AREA_STYLES: Record<
  string,
  { accent: string }
> = {
  "gestao-executiva": {
    accent: "text-zinc-800",
  },
  gdf: {
    accent: "text-amber-700",
  },
  estadual: {
    accent: "text-red-700",
  },
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getMesAno(value?: string) {
  const [mes, ano] = String(value || "").split("/")
  return { mes, ano }
}

function mesParaOrdem(value?: string) {
  const { mes, ano } = getMesAno(value)
  return Number(`${ano || "0"}${mes || "0"}`)
}

function mesCurto(value: string) {
  const nomes: Record<string, string> = {
    "01": "Jan",
    "02": "Fev",
    "03": "Mar",
    "04": "Abr",
    "05": "Mai",
    "06": "Jun",
    "07": "Jul",
    "08": "Ago",
    "09": "Set",
    "10": "Out",
    "11": "Nov",
    "12": "Dez",
  }
  const { mes, ano } = getMesAno(value)
  return `${nomes[mes] || mes}/${String(ano || "").slice(-2)}`
}

function agenciaValida(value?: string | null) {
  const texto = normalizarTexto(value)
  return Boolean(
    texto &&
      texto !== "direto" &&
      texto !== "direta" &&
      texto !== "agencia direta" &&
      texto !== "sem agencia" &&
      texto !== "nao informado"
  )
}

function criarRanking(
  dados: Pi[],
  campo: "executivo" | "anunciante" | "agencia",
  limite = 7
) {
  const mapa = new Map<string, RankingItem>()

  dados.forEach((item) => {
    const nome = String(item[campo] || "").trim()
    if (!nome || (campo === "agencia" && !agenciaValida(nome))) return

    const atual = mapa.get(nome) || { nome, liquido: 0, pis: 0 }
    atual.liquido += Number(item.valor_liquido || 0)
    atual.pis += 1
    mapa.set(nome, atual)
  })

  return Array.from(mapa.values())
    .sort((a, b) => b.liquido - a.liquido)
    .slice(0, limite)
}

function Ranking({
  titulo,
  itens,
}: {
  titulo: string
  itens: RankingItem[]
}) {
  const maior = Math.max(...itens.map((item) => item.liquido), 1)

  return (
    <section className="border-t border-zinc-200 pt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-zinc-950">{titulo}</h2>
        <span className="text-xs font-bold text-zinc-400">
          {itens.length} posições
        </span>
      </div>

      <div className="space-y-4">
        {itens.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum dado encontrado.</p>
        ) : (
          itens.map((item, index) => (
            <div key={item.nome}>
              <div className="mb-2 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-red-600">
                    #{index + 1}
                  </span>
                  <strong className="block truncate text-sm text-zinc-800">
                    {item.nome}
                  </strong>
                </div>
                <div className="shrink-0 text-right">
                  <b className="block text-sm text-zinc-950">
                    {money(item.liquido)}
                  </b>
                  <small className="text-zinc-400">{item.pis} PIs</small>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-red-600"
                  style={{ width: `${Math.max((item.liquido / maior) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default function DashboardGestaoEstadual() {
  const navigate = useNavigate()
  const user = getUser()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [mesHover, setMesHover] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDados() {
      try {
        setLoading(true)
        const response = await getPisCached()
        setDados(Array.isArray(response) ? (response as Pi[]) : [])
      } catch (error) {
        console.error(error)
        setDados([])
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [])

  const dadosPermitidos = useMemo(
    () => dados.filter((item) => pertenceAoEscopoDjanane(item)),
    [dados]
  )

  const anos = useMemo(
    () =>
      Array.from(
        new Set(
          dadosPermitidos
            .map((item) => getMesAno(item.mes_venda).ano)
            .filter(Boolean)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [dadosPermitidos]
  )

  const meses = useMemo(() => {
    return Array.from(
      new Set(
        dadosPermitidos
          .filter(
            (item) =>
              !anoSelecionado ||
              getMesAno(item.mes_venda).ano === anoSelecionado
          )
          .map((item) => item.mes_venda)
          .filter(Boolean)
      )
    ).sort((a, b) => mesParaOrdem(b) - mesParaOrdem(a))
  }, [dadosPermitidos, anoSelecionado])

  const dadosBase = useMemo(() => {
    const termo = normalizarTexto(busca)

    return dadosPermitidos.filter((item) => {
      const { ano } = getMesAno(item.mes_venda)
      const bateAno = !anoSelecionado || ano === anoSelecionado
      const bateMes = !mesSelecionado || item.mes_venda === mesSelecionado
      const bateBusca =
        !termo ||
        normalizarTexto(
          [
            item.numero_pi,
            item.executivo,
            item.anunciante,
            item.agencia,
            item.campanha,
            item.perfil_anunciante,
            item.sub_perfil_anunciante,
          ].join(" ")
        ).includes(termo)

      return bateAno && bateMes && bateBusca
    })
  }, [dadosPermitidos, busca, anoSelecionado, mesSelecionado])

  const dadosFiltrados = dadosBase

  const resumoAreas = useMemo<AreaResumo[]>(() => {
    return AREAS_DJANANE.map((area) => {
      const itens = dadosBase.filter(
        (item) => classificarAreaComercial(item) === area
      )

      return {
        area,
        pis: itens.length,
        liquido: itens.reduce(
          (total, item) => total + Number(item.valor_liquido || 0),
          0
        ),
        bruto: itens.reduce(
          (total, item) => total + Number(item.valor_bruto || 0),
          0
        ),
        anunciantes: new Set(
          itens.map((item) => item.anunciante).filter(Boolean)
        ).size,
      }
    })
  }, [dadosBase])

  const totalLiquidoBase = dadosBase.reduce(
    (total, item) => total + Number(item.valor_liquido || 0),
    0
  )
  const totalLiquido = dadosFiltrados.reduce(
    (total, item) => total + Number(item.valor_liquido || 0),
    0
  )
  const totalBruto = dadosFiltrados.reduce(
    (total, item) => total + Number(item.valor_bruto || 0),
    0
  )
  const totalPis = dadosFiltrados.length
  const ticketMedio = totalPis ? totalLiquido / totalPis : 0
  const totalAnunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const evolucaoMensal = useMemo(() => {
    const mapa = new Map<string, { mes: string; liquido: number; pis: number }>()

    dadosFiltrados.forEach((item) => {
      const mes = item.mes_venda || "Sem mês"
      const atual = mapa.get(mes) || { mes, liquido: 0, pis: 0 }
      atual.liquido += Number(item.valor_liquido || 0)
      atual.pis += 1
      mapa.set(mes, atual)
    })

    return Array.from(mapa.values())
      .sort((a, b) => mesParaOrdem(a.mes) - mesParaOrdem(b.mes))
      .slice(-12)
  }, [dadosFiltrados])

  const maiorMes = Math.max(
    ...evolucaoMensal.map((item) => item.liquido),
    1
  )
  const ultimoMes = evolucaoMensal[evolucaoMensal.length - 1]
  const penultimoMes = evolucaoMensal[evolucaoMensal.length - 2]
  const variacaoMensal =
    ultimoMes && penultimoMes && penultimoMes.liquido
      ? ((ultimoMes.liquido - penultimoMes.liquido) / penultimoMes.liquido) *
        100
      : null

  const topAnunciantes = useMemo(
    () => criarRanking(dadosFiltrados, "anunciante"),
    [dadosFiltrados]
  )
  const topAgencias = useMemo(
    () => criarRanking(dadosFiltrados, "agencia"),
    [dadosFiltrados]
  )

  function limparFiltros() {
    setBusca("")
    setAnoSelecionado("")
    setMesSelecionado("")
  }

  function abrirPis() {
    const params = new URLSearchParams()
    if (anoSelecionado) params.set("ano", anoSelecionado)
    if (mesSelecionado) params.set("mes", mesSelecionado)
    if (busca) params.set("busca", busca)

    navigate(`/busca-pi${params.toString() ? `?${params}` : ""}`)
  }

  function abrirArea(area: AreaComercial) {
    const params = new URLSearchParams()
    if (anoSelecionado) params.set("ano", anoSelecionado)
    if (mesSelecionado) params.set("mes", mesSelecionado)
    if (busca) params.set("busca", busca)

    navigate(
      `/estadual/area/${area}${params.toString() ? `?${params}` : ""}`
    )
  }

  function abrirAnunciantes() {
    const params = new URLSearchParams()
    if (anoSelecionado) params.set("ano", anoSelecionado)
    if (mesSelecionado) params.set("mes", mesSelecionado)
    if (busca) params.set("busca", busca)

    navigate(
      `/estadual/anunciantes${params.toString() ? `?${params}` : ""}`
    )
  }

  function abrirMes(mes: string) {
    const params = new URLSearchParams({ mes })
    if (busca) params.set("busca", busca)
    navigate(`/busca-pi?${params}`)
  }

  const filtrosAtivos = busca || anoSelecionado || mesSelecionado

  return (
    <main className="space-y-6 text-zinc-950">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 px-6 py-7 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-red-600" />
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <span className="text-xs font-black uppercase text-red-400">
              Gestão comercial estadual
            </span>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
              <h1 className="text-4xl font-black text-white sm:text-5xl">
                Visão Estadual
              </h1>
              <span className="text-base font-bold text-zinc-300">
                {user?.nome || "Djanane Rodrigues"}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
              Visão consolidada de Gestão Executiva, GDF / CLDF e Governo
              Estadual. Governo Federal e Comercial Privado permanecem fora
              deste painel.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-zinc-300">
              <span className="border-l-2 border-red-500 pl-2">
                Gestão Executiva
              </span>
              <span className="border-l-2 border-amber-500 pl-2">
                GDF / CLDF
              </span>
              <span className="border-l-2 border-white pl-2">
                Governo Estadual
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/estadual/executivos")}
            className="h-12 shrink-0 rounded-xl bg-white px-6 text-sm font-black text-zinc-950 transition hover:bg-red-600 hover:text-white"
          >
            Produtividade por executivo
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">Filtros do painel</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Atualize todos os indicadores e gráficos ao mesmo tempo.
            </p>
          </div>
          {filtrosAtivos && (
            <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-700">
              Visão filtrada
            </span>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-[160px_180px_1fr_auto]">
          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
            value={anoSelecionado}
            onChange={(event) => {
              setAnoSelecionado(event.target.value)
              setMesSelecionado("")
            }}
          >
            <option value="">Todos os anos</option>
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
            value={mesSelecionado}
            onChange={(event) => setMesSelecionado(event.target.value)}
          >
            <option value="">Todos os meses</option>
            {meses.map((mes) => (
              <option key={mes} value={mes}>
                {mes}
              </option>
            ))}
          </select>

          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
            placeholder="Pesquisar PI, executivo, anunciante, agência ou campanha"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />

          <button
            type="button"
            onClick={limparFiltros}
            disabled={!filtrosAtivos}
            className="h-11 rounded-xl border border-zinc-200 px-5 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpar
          </button>
        </div>
      </section>

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-zinc-500">
          Carregando visão gerencial...
        </div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-12">
            <div className="relative min-h-40 overflow-hidden rounded-2xl bg-red-600 p-6 text-white shadow-sm xl:col-span-6">
              <div className="absolute right-0 top-0 h-full w-2 bg-red-800/40" />
              <span className="text-sm text-red-100">Total líquido</span>
              <strong className="mt-4 block break-words text-3xl font-black leading-tight sm:text-4xl">
                {money(totalLiquido)}
              </strong>
              <small className="mt-3 block text-red-100">
                Resultado do filtro atual
              </small>
            </div>
            <div className="relative min-h-40 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-6 text-white shadow-sm xl:col-span-6">
              <div className="absolute right-0 top-0 h-full w-2 bg-red-300/60" />
              <span className="text-sm text-red-100">Total bruto</span>
              <strong className="mt-4 block break-words text-3xl font-black leading-tight sm:text-4xl">
                {money(totalBruto)}
              </strong>
              <small className="mt-3 block text-red-100">
                Valor comercializado
              </small>
            </div>
            <button
              type="button"
              onClick={abrirPis}
              className="min-h-32 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:bg-red-50 xl:col-span-4"
            >
              <span className="text-sm text-zinc-500">PIs</span>
              <strong className="mt-2 block text-2xl font-black">
                {totalPis}
              </strong>
              <small className="text-zinc-400">
                Abrir registros encontrados
              </small>
            </button>
            <div className="min-h-32 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-4">
              <span className="text-sm text-zinc-500">Ticket médio</span>
              <strong className="mt-2 block break-words text-xl font-black">
                {money(ticketMedio)}
              </strong>
              <small className="text-zinc-400">Valor líquido por PI</small>
            </div>
            <button
              type="button"
              onClick={abrirAnunciantes}
              className="min-h-32 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:bg-red-50 xl:col-span-4"
            >
              <span className="text-sm text-zinc-500">Anunciantes</span>
              <strong className="mt-2 block text-2xl font-black">
                {totalAnunciantes}
              </strong>
              <small className="text-zinc-400">Abrir visão de clientes</small>
            </button>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Composição do resultado</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Clique em uma área para abrir sua análise exclusiva.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {resumoAreas.map((item) => {
                const style = AREA_STYLES[item.area]
                const participacao =
                  totalLiquidoBase > 0
                    ? (item.liquido / totalLiquidoBase) * 100
                    : 0

                return (
                  <button
                    type="button"
                    key={item.area}
                    onClick={() => abrirArea(item.area)}
                    className="min-h-44 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`text-xs font-black uppercase ${style.accent}`}
                        >
                          {nomeAreaComercial(item.area)}
                        </span>
                        <strong className="mt-3 block break-words text-2xl font-black">
                          {money(item.liquido)}
                        </strong>
                      </div>
                      <span className="text-xl font-black">
                        {participacao.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-5 flex justify-between gap-3 text-xs font-semibold opacity-75">
                      <span>{item.pis} PIs</span>
                      <span>Abrir análise</span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-red-600"
                        style={{ width: `${participacao}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">Evolução mensal</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Últimos 12 meses dentro do filtro atual.
                  </p>
                </div>
                {variacaoMensal !== null && (
                  <div className="text-right">
                    <span className="text-xs font-bold text-zinc-400">
                      Variação do último mês
                    </span>
                    <strong
                      className={`block text-lg font-black ${
                        variacaoMensal >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {variacaoMensal >= 0 ? "+" : ""}
                      {variacaoMensal.toFixed(1)}%
                    </strong>
                  </div>
                )}
              </div>

              <div className="mb-4 min-h-20 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                {mesHover ? (
                  (() => {
                    const item = evolucaoMensal.find(
                      (mes) => mes.mes === mesHover
                    )
                    return item ? (
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <span className="text-xs font-black uppercase text-red-700">
                            {item.mes}
                          </span>
                          <strong className="mt-1 block text-xl font-black">
                            {money(item.liquido)}
                          </strong>
                        </div>
                        <span className="text-sm font-bold text-zinc-600">
                          {item.pis} PIs
                        </span>
                      </div>
                    ) : null
                  })()
                ) : (
                  <div>
                    <span className="text-xs font-black uppercase text-zinc-400">
                      Detalhes do mês
                    </span>
                    <p className="mt-1 text-sm text-zinc-500">
                      Passe o mouse sobre uma barra para ver valor e PIs.
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full overflow-x-auto pb-2">
                <div className="flex h-64 min-w-[620px] items-end gap-3 border-b border-zinc-200 px-2 pb-8">
                  {evolucaoMensal.map((item) => (
                    <button
                      type="button"
                      key={item.mes}
                      onMouseEnter={() => setMesHover(item.mes)}
                      onMouseLeave={() => setMesHover(null)}
                      onFocus={() => setMesHover(item.mes)}
                      onBlur={() => setMesHover(null)}
                      onClick={() => abrirMes(item.mes)}
                      className="group relative flex h-full min-w-10 flex-1 items-end justify-center"
                    >
                      <div
                        className="w-full max-w-12 rounded-t-lg bg-red-200 transition group-hover:bg-red-600"
                        style={{
                          height: `${Math.max(
                            (item.liquido / maiorMes) * 100,
                            4
                          )}%`,
                        }}
                      />
                      <span className="absolute -bottom-6 text-[10px] font-bold text-zinc-500">
                        {mesCurto(item.mes)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </section>

          <section className="grid gap-7 xl:grid-cols-2">
            <Ranking titulo="Anunciantes" itens={topAnunciantes} />
            <Ranking titulo="Agências" itens={topAgencias} />
          </section>
        </>
      )}
    </main>
  )
}
