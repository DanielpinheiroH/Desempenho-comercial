import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { getPisCached } from "../services/api"
import {
  AREAS_DJANANE,
  nomeAreaComercial,
  normalizarTexto,
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
} from "../utils/gestaoEstadualDados"

export default function EstadualExecutivosPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [dados, setDados] = useState<PiGestao[]>([])
  const [loading, setLoading] = useState(true)
  const [mesHover, setMesHover] = useState<string | null>(null)

  const areaSelecionada = (searchParams.get("area") || "") as
    | AreaComercial
    | ""
  const anoSelecionado = searchParams.get("ano") || ""
  const mesSelecionado = searchParams.get("mes") || ""
  const buscaExecutivo = searchParams.get("busca") || ""
  const executivoSelecionado = searchParams.get("executivo") || ""

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

  const meses = useMemo(
    () =>
      Array.from(
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
      ).sort((a, b) => mesParaOrdem(b) - mesParaOrdem(a)),
    [dadosPermitidos, anoSelecionado]
  )

  const baseExecutivos = useMemo(
    () =>
      filtrarGestao(dadosPermitidos, {
        area: areaSelecionada,
        ano: anoSelecionado,
        mes: mesSelecionado,
      }),
    [dadosPermitidos, areaSelecionada, anoSelecionado, mesSelecionado]
  )

  const executivos = useMemo(() => {
    const termo = normalizarTexto(buscaExecutivo)
    return criarRanking(baseExecutivos, "executivo", 500).filter(
      (item) => !termo || normalizarTexto(item.nome).includes(termo)
    )
  }, [baseExecutivos, buscaExecutivo])

  useEffect(() => {
    if (!executivoSelecionado && executivos[0]?.nome) {
      const params = new URLSearchParams(searchParams)
      params.set("executivo", executivos[0].nome)
      setSearchParams(params, { replace: true })
    }
  }, [executivoSelecionado, executivos, searchParams, setSearchParams])

  const dadosExecutivo = useMemo(
    () =>
      filtrarGestao(baseExecutivos, {
        executivo: executivoSelecionado,
      }),
    [baseExecutivos, executivoSelecionado]
  )

  const totalLiquido = dadosExecutivo.reduce(
    (total, item) => total + Number(item.valor_liquido || 0),
    0
  )
  const totalBruto = dadosExecutivo.reduce(
    (total, item) => total + Number(item.valor_bruto || 0),
    0
  )
  const totalPis = dadosExecutivo.length
  const ticketMedio = totalPis ? totalLiquido / totalPis : 0
  const anunciantes = new Set(
    dadosExecutivo.map((item) => item.anunciante).filter(Boolean)
  ).size
  const agencias = new Set(
    dadosExecutivo.map((item) => item.agencia).filter(Boolean)
  ).size

  const evolucao = useMemo(
    () => agruparMeses(dadosExecutivo).slice(-12),
    [dadosExecutivo]
  )
  const maiorMes = Math.max(...evolucao.map((item) => item.liquido), 1)
  const topAnunciantes = criarRanking(dadosExecutivo, "anunciante", 6)

  function atualizarFiltro(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams)
    if (valor) params.set(chave, valor)
    else params.delete(chave)
    if (chave !== "executivo") params.delete("executivo")
    if (chave === "ano") params.delete("mes")
    setSearchParams(params)
  }

  function abrirPis(mes?: string) {
    const params = new URLSearchParams()
    if (executivoSelecionado) params.set("executivo", executivoSelecionado)
    if (areaSelecionada) params.set("area", areaSelecionada)
    if (anoSelecionado && !mes) params.set("ano", anoSelecionado)
    if (mes || mesSelecionado) params.set("mes", mes || mesSelecionado)
    const origemParams = searchParams.toString()
    params.set(
      "origem",
      `/estadual/executivos${origemParams ? `?${origemParams}` : ""}`
    )
    navigate(`/busca-pi?${params}`)
  }

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-black uppercase text-red-400">
              Gestão de equipe
            </span>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Produtividade por executivo
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              Selecione um executivo para analisar resultado, carteira e
              evolução mensal.
            </p>
          </div>
          {executivoSelecionado && (
            <button
              type="button"
              onClick={() => abrirPis()}
              className="h-11 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-red-600 hover:text-white"
            >
              Ver PIs do executivo
            </button>
          )}
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[220px_150px_180px_1fr_auto]">
        <select
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          value={areaSelecionada}
          onChange={(event) => atualizarFiltro("area", event.target.value)}
        >
          <option value="">Todas as áreas</option>
          {AREAS_DJANANE.map((area) => (
            <option key={area} value={area}>
              {nomeAreaComercial(area)}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
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
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
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
          className="h-11 rounded-xl border border-zinc-200 px-4 text-sm"
          placeholder="Localizar executivo"
          value={buscaExecutivo}
          onChange={(event) => atualizarFiltro("busca", event.target.value)}
        />
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className="h-11 rounded-xl border border-zinc-200 px-5 text-sm font-bold"
        >
          Limpar
        </button>
      </section>

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-zinc-500">
          Carregando produtividade...
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-r-0 border-zinc-200 xl:border-r xl:pr-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black">Executivos</h2>
              <span className="text-xs font-bold text-zinc-400">
                {executivos.length}
              </span>
            </div>
            <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
              {executivos.map((item) => {
                const ativo = item.nome === executivoSelecionado
                return (
                  <button
                    type="button"
                    key={item.nome}
                    onClick={() => atualizarFiltro("executivo", item.nome)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      ativo
                        ? "border-red-600 bg-red-50"
                        : "border-zinc-200 hover:border-red-300"
                    }`}
                  >
                    <strong className="block truncate text-sm">
                      {item.nome}
                    </strong>
                    <div className="mt-2 flex justify-between gap-3 text-xs">
                      <span className="text-zinc-500">{item.pis} PIs</span>
                      <b>{money(item.liquido)}</b>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            {!executivoSelecionado ? (
              <div className="py-20 text-center text-zinc-500">
                Selecione um executivo para abrir o desempenho.
              </div>
            ) : (
              <>
                <div>
                  <span className="text-xs font-black uppercase text-red-700">
                    Executivo selecionado
                  </span>
                  <h2 className="mt-2 text-2xl font-black">
                    {executivoSelecionado}
                  </h2>
                </div>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="min-h-36 rounded-2xl bg-red-600 p-5 text-white sm:col-span-2 xl:col-span-2">
                    <span className="text-sm text-red-100">Total líquido</span>
                    <strong className="mt-3 block break-words text-3xl font-black">
                      {money(totalLiquido)}
                    </strong>
                  </div>
                  <div className="min-h-36 rounded-2xl border border-zinc-200 p-5">
                    <span className="text-sm text-zinc-500">Total bruto</span>
                    <strong className="mt-3 block break-words text-2xl font-black">
                      {money(totalBruto)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirPis()}
                    className="rounded-2xl border border-zinc-200 p-5 text-left hover:border-red-400 hover:bg-red-50"
                  >
                    <span className="text-sm text-zinc-500">PIs</span>
                    <strong className="mt-2 block text-2xl font-black">
                      {totalPis}
                    </strong>
                  </button>
                  <div className="rounded-2xl border border-zinc-200 p-5">
                    <span className="text-sm text-zinc-500">Ticket médio</span>
                    <strong className="mt-2 block break-words text-xl font-black">
                      {money(ticketMedio)}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 p-5">
                    <span className="text-sm text-zinc-500">
                      Anunciantes / Agências
                    </span>
                    <strong className="mt-2 block text-2xl font-black">
                      {anunciantes} / {agencias}
                    </strong>
                  </div>
                </section>

                <section className="border-t border-zinc-200 pt-5">
                  <h3 className="text-lg font-black">Evolução mensal</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Passe o mouse para ver o valor e clique para abrir as vendas.
                  </p>
                  <div className="mt-5 min-h-20 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    {mesHover ? (
                      (() => {
                        const item = evolucao.find(
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
                      <p className="text-sm text-zinc-500">
                        Passe o mouse sobre uma barra para ver valor e PIs.
                      </p>
                    )}
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
                          onClick={() => abrirPis(item.mes)}
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
                </section>

                <section className="border-t border-zinc-200 pt-5">
                  <div className="max-w-3xl">
                    <h3 className="mb-4 text-base font-black">
                      Principais anunciantes
                    </h3>
                    <div className="space-y-3">
                      {topAnunciantes.map((item, index) => (
                        <div
                          key={item.nome}
                          className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3"
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-black text-red-600">
                              #{index + 1}
                            </span>
                            <strong className="block truncate text-sm">
                              {item.nome}
                            </strong>
                          </div>
                          <div className="shrink-0 text-right">
                            <b className="block text-sm">
                              {money(item.liquido)}
                            </b>
                            <small className="text-zinc-400">
                              {item.pis} PIs
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
