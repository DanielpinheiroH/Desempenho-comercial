import { useEffect, useMemo, useState } from "react"
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import { getPisCached } from "../services/api"
import {
  AREAS_DJANANE,
  classificarAreaComercial,
  nomeAreaComercial,
  pertenceAoEscopoDjanane,
  type AreaComercial,
} from "../utils/areasComerciais"
import {
  agruparMeses,
  criarRanking,
  filtrarGestao,
  getMesAno,
  mesCurto,
  mesParaOrdem,
  money,
  type PiGestao,
  type RankingGestao,
} from "../utils/gestaoEstadualDados"

function RankingArea({
  titulo,
  itens,
}: {
  titulo: string
  itens: RankingGestao[]
}) {
  const maior = Math.max(...itens.map((item) => item.liquido), 1)

  return (
    <section className="border-t border-zinc-200 pt-5">
      <h2 className="mb-4 text-base font-black">{titulo}</h2>
      <div className="space-y-4">
        {itens.map((item, index) => (
          <div key={item.nome}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-red-600">
                  #{index + 1}
                </span>
                <strong className="block truncate text-sm">{item.nome}</strong>
              </div>
              <div className="shrink-0 text-right">
                <b className="block text-sm">{money(item.liquido)}</b>
                <small className="text-zinc-400">{item.pis} PIs</small>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-red-600"
                style={{
                  width: `${Math.max((item.liquido / maior) * 100, 3)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function EstadualAreaPage() {
  const navigate = useNavigate()
  const { area } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const areaAtual = (area || "") as AreaComercial
  const areaValida = AREAS_DJANANE.includes(areaAtual)

  const [dados, setDados] = useState<PiGestao[]>([])
  const [loading, setLoading] = useState(true)
  const [mesHover, setMesHover] = useState<string | null>(null)

  const anoSelecionado = searchParams.get("ano") || ""
  const mesSelecionado = searchParams.get("mes") || ""
  const busca = searchParams.get("busca") || ""

  useEffect(() => {
    async function carregarDados() {
      try {
        setLoading(true)
        const response = await getPisCached()
        setDados(Array.isArray(response) ? (response as PiGestao[]) : [])
      } catch (error) {
        console.error(error)
        setDados([])
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [])

  const dadosDaArea = useMemo(
    () =>
      dados.filter(
        (item) =>
          pertenceAoEscopoDjanane(item) &&
          classificarAreaComercial(item) === areaAtual
      ),
    [dados, areaAtual]
  )

  const anos = useMemo(
    () =>
      Array.from(
        new Set(
          dadosDaArea
            .map((item) => getMesAno(item.mes_venda).ano)
            .filter(Boolean)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [dadosDaArea]
  )

  const meses = useMemo(
    () =>
      Array.from(
        new Set(
          dadosDaArea
            .filter(
              (item) =>
                !anoSelecionado ||
                getMesAno(item.mes_venda).ano === anoSelecionado
            )
            .map((item) => item.mes_venda)
            .filter(Boolean)
        )
      ).sort((a, b) => mesParaOrdem(b) - mesParaOrdem(a)),
    [dadosDaArea, anoSelecionado]
  )

  const dadosFiltrados = useMemo(
    () =>
      filtrarGestao(dadosDaArea, {
        ano: anoSelecionado,
        mes: mesSelecionado,
        busca,
      }),
    [dadosDaArea, anoSelecionado, mesSelecionado, busca]
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
  const anunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const dadosDaEvolucao = useMemo(
    () =>
      filtrarGestao(dadosDaArea, {
        ano: anoSelecionado,
        busca,
      }),
    [dadosDaArea, anoSelecionado, busca]
  )
  const evolucao = useMemo(
    () => agruparMeses(dadosDaEvolucao).slice(-12),
    [dadosDaEvolucao]
  )
  const maiorMes = Math.max(...evolucao.map((item) => item.liquido), 1)
  const topAnunciantes = useMemo(
    () => criarRanking(dadosFiltrados, "anunciante", 8),
    [dadosFiltrados]
  )
  const topAgencias = useMemo(
    () => criarRanking(dadosFiltrados, "agencia", 8),
    [dadosFiltrados]
  )
  const executivos = criarRanking(dadosFiltrados, "executivo", 100).length
  const mesEmDestaque =
    evolucao.find((item) => item.mes === mesHover) ||
    evolucao.find((item) => item.mes === mesSelecionado) ||
    evolucao[evolucao.length - 1]

  function atualizarFiltro(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams)
    if (valor) params.set(chave, valor)
    else params.delete(chave)
    if (chave === "ano") params.delete("mes")
    setSearchParams(params)
  }

  function abrirPis(mes?: string) {
    const params = new URLSearchParams({ area: areaAtual })
    if (anoSelecionado && !mes) params.set("ano", anoSelecionado)
    if (mes || mesSelecionado) params.set("mes", mes || mesSelecionado)
    if (busca) params.set("busca", busca)
    navigate(`/busca-pi?${params}`)
  }

  function abrirAnunciantes() {
    const params = new URLSearchParams({ area: areaAtual })
    if (anoSelecionado) params.set("ano", anoSelecionado)
    if (mesSelecionado) params.set("mes", mesSelecionado)
    navigate(`/estadual/anunciantes?${params}`)
  }

  function selecionarMes(mes: string) {
    atualizarFiltro("mes", mes)
    setMesHover(null)
  }

  if (!areaValida) return <Navigate to="/" />

  return (
    <main className="space-y-6 text-zinc-950">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-red-600" />
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-7 h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-200 transition hover:border-red-500 hover:text-white"
        >
          Voltar para Visão Estadual
        </button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-black uppercase text-red-400">
              Análise exclusiva
            </span>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              {nomeAreaComercial(areaAtual)}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              Resultado, evolução e carteira de anunciantes exclusivamente
              desta área comercial.
            </p>
          </div>
          <button
            type="button"
            onClick={() => abrirPis()}
            className="h-11 shrink-0 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-red-600 hover:text-white"
          >
            Abrir Busca de PI
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-black">Filtros da área</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Atualize indicadores, rankings e evolução mensal.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[160px_180px_1fr_auto]">
          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
            value={anoSelecionado}
            onChange={(event) => atualizarFiltro("ano", event.target.value)}
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
            onChange={(event) => atualizarFiltro("mes", event.target.value)}
          >
            <option value="">Todos os meses</option>
            {meses.map((mes) => (
              <option key={mes} value={mes}>
                {mes}
              </option>
            ))}
          </select>
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-red-500"
            placeholder="Pesquisar nesta área"
            value={busca}
            onChange={(event) => atualizarFiltro("busca", event.target.value)}
          />
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="h-11 rounded-xl border border-zinc-300 bg-white px-5 text-sm font-bold transition hover:border-red-400 hover:text-red-700"
          >
            Limpar
          </button>
        </div>
      </section>

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-zinc-500">
          Carregando análise...
        </div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-12">
            <div className="min-h-40 rounded-2xl bg-red-600 p-6 text-white shadow-sm xl:col-span-6">
              <span className="text-sm text-red-100">Total líquido</span>
              <strong className="mt-4 block break-words text-3xl font-black leading-tight sm:text-4xl">
                {money(totalLiquido)}
              </strong>
            </div>
            <div className="min-h-40 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-6 text-white shadow-sm xl:col-span-6">
              <span className="text-sm text-zinc-300">Total bruto</span>
              <strong className="mt-4 block break-words text-3xl font-black leading-tight sm:text-4xl">
                {money(totalBruto)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => abrirPis()}
              className="min-h-28 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:bg-red-50 xl:col-span-3"
            >
              <span className="text-sm text-zinc-500">PIs</span>
              <strong className="mt-2 block text-2xl font-black">
                {totalPis}
              </strong>
            </button>
            <div className="min-h-28 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3">
              <span className="text-sm text-zinc-500">Ticket médio</span>
              <strong className="mt-2 block break-words text-xl font-black">
                {money(ticketMedio)}
              </strong>
            </div>
            <button
              type="button"
              onClick={abrirAnunciantes}
              className="min-h-28 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:bg-red-50 xl:col-span-3"
            >
              <span className="text-sm text-zinc-500">Anunciantes</span>
              <strong className="mt-2 block text-2xl font-black">
                {anunciantes}
              </strong>
              <small className="text-zinc-400">Ver anunciantes da área</small>
            </button>
            <div className="min-h-28 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3">
              <span className="text-sm text-zinc-500">Executivos</span>
              <strong className="mt-2 block text-2xl font-black">
                {executivos}
              </strong>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Evolução mensal</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Passe o mouse para consultar e clique para selecionar o mês.
                </p>
              </div>
              {mesSelecionado && (
                <button
                  type="button"
                  onClick={() => selecionarMes("")}
                  className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-black text-zinc-700 transition hover:border-red-400 hover:text-red-700"
                >
                  Voltar para todos os meses
                </button>
              )}
            </div>
            <div className="mt-5 grid h-20 grid-cols-[minmax(0,1fr)_90px] items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4">
              <div className="min-w-0">
                <span className="block text-xs font-black uppercase text-red-700">
                  {mesEmDestaque?.mes || "Sem dados"}
                </span>
                <strong className="mt-1 block truncate text-xl font-black">
                  {mesEmDestaque ? money(mesEmDestaque.liquido) : money(0)}
                </strong>
              </div>
              <span className="text-right text-sm font-bold text-zinc-600">
                {mesEmDestaque?.pis || 0} PIs
              </span>
            </div>
            <div className="mt-4 w-full overflow-x-auto pb-2">
              <div className="flex h-64 min-w-[620px] items-end gap-3 border-b border-zinc-200 px-2 pb-8">
                {evolucao.map((item) => (
                  <button
                    type="button"
                    key={item.mes}
                    onMouseEnter={() => setMesHover(item.mes)}
                    onMouseLeave={() => setMesHover(null)}
                    onFocus={() => setMesHover(item.mes)}
                    onBlur={() => setMesHover(null)}
                    onClick={() => selecionarMes(item.mes)}
                    className="group relative flex h-full min-w-10 flex-1 items-end justify-center"
                  >
                    <div
                      className={`w-full max-w-12 rounded-t-lg transition ${
                        mesSelecionado === item.mes
                          ? "bg-red-600"
                          : "bg-red-200 group-hover:bg-red-500"
                      }`}
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
          </section>

          <section className="grid gap-7 xl:grid-cols-2">
            <RankingArea titulo="Top anunciantes" itens={topAnunciantes} />
            <RankingArea titulo="Top agências" itens={topAgencias} />
          </section>

        </>
      )}
    </main>
  )
}
