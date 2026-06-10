import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { api, getPisCached } from "../services/api"
import {
  AREAS_DJANANE,
  classificarAreaComercial,
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

type EstadualExecutivosPageProps = {
  escopo?: "estadual" | "privado"
}

type Meta = {
  executivo: string
  mes: string
  meta: number
}

type DesempenhoMensal = {
  nome: string
  meta: number
  vendido: number
  pis: number
  percentual: number
  falta: number
}

function corrigirNome(value?: string | null) {
  return String(value || "")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã£", "ã")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ã´", "ô")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã", "Á")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã“", "Ó")
    .replaceAll("Ãš", "Ú")
    .replaceAll("Ã‡", "Ç")
}

function chaveExecutivo(value?: string | null) {
  return normalizarTexto(corrigirNome(value))
}

function corProdutividade(percentual: number) {
  if (percentual >= 100) return "bg-emerald-500"
  if (percentual >= 50) return "bg-amber-400"
  return "bg-red-600"
}

function corSeloProdutividade(percentual: number) {
  if (percentual >= 100) return "bg-emerald-100 text-emerald-700"
  if (percentual >= 50) return "bg-amber-100 text-amber-700"
  return "bg-red-50 text-red-700"
}

export default function EstadualExecutivosPage({
  escopo = "estadual",
}: EstadualExecutivosPageProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const visaoPrivado = escopo === "privado"
  const rotaProdutividade = visaoPrivado
    ? "/admin/produtividade-executivos"
    : "/estadual/executivos"

  const [dados, setDados] = useState<PiGestao[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
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
        const [response, metasResponse] = await Promise.all([
          getPisCached(),
          api.get("/api/metas"),
        ])
        setDados(Array.isArray(response) ? (response as PiGestao[]) : [])
        setMetas(
          Array.isArray(metasResponse.data) ? (metasResponse.data as Meta[]) : []
        )
      } catch (error) {
        console.error(error)
        setDados([])
        setMetas([])
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [])

  const dadosPermitidos = useMemo(
    () =>
      dados.filter((item) =>
        visaoPrivado
          ? classificarAreaComercial(item) === "privado"
          : pertenceAoEscopoDjanane(item)
      ),
    [dados, visaoPrivado]
  )

  const anos = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...dadosPermitidos.map((item) => item.mes_venda),
            ...metas.map((item) => item.mes),
          ]
            .map((mes) => getMesAno(mes).ano)
            .filter(Boolean)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [dadosPermitidos, metas]
  )

  const meses = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...dadosPermitidos.map((item) => item.mes_venda),
            ...metas.map((item) => item.mes),
          ]
            .filter(
              (mes) =>
                !anoSelecionado || getMesAno(mes).ano === anoSelecionado
            )
            .filter(Boolean)
        )
      ).sort((a, b) => mesParaOrdem(b) - mesParaOrdem(a)),
    [dadosPermitidos, metas, anoSelecionado]
  )

  useEffect(() => {
    if (!visaoPrivado || mesSelecionado || metas.length === 0) return

    const ultimoMesComMeta = [...metas]
      .map((item) => item.mes)
      .filter(Boolean)
      .sort((a, b) => mesParaOrdem(b) - mesParaOrdem(a))[0]

    if (!ultimoMesComMeta) return

    const params = new URLSearchParams(searchParams)
    params.set("ano", getMesAno(ultimoMesComMeta).ano)
    params.set("mes", ultimoMesComMeta)
    params.delete("executivo")
    setSearchParams(params, { replace: true })
  }, [
    metas,
    mesSelecionado,
    searchParams,
    setSearchParams,
    visaoPrivado,
  ])

  const baseExecutivos = useMemo(
    () =>
      filtrarGestao(dadosPermitidos, {
        area: visaoPrivado ? "privado" : areaSelecionada,
        ano: anoSelecionado,
        mes: mesSelecionado,
      }),
    [
      dadosPermitidos,
      visaoPrivado,
      areaSelecionada,
      anoSelecionado,
      mesSelecionado,
    ]
  )

  const desempenhoMensal = useMemo<DesempenhoMensal[]>(() => {
    if (!mesSelecionado) return []

    const mapa = new Map<
      string,
      { nome: string; meta: number; vendido: number; pis: number }
    >()

    metas
      .filter((item) => item.mes === mesSelecionado)
      .forEach((item) => {
        const chave = chaveExecutivo(item.executivo)
        if (!chave) return
        const atual = mapa.get(chave) || {
          nome: corrigirNome(item.executivo),
          meta: 0,
          vendido: 0,
          pis: 0,
        }
        atual.meta += Number(item.meta || 0)
        mapa.set(chave, atual)
      })

    baseExecutivos.forEach((item) => {
      const chave = chaveExecutivo(item.executivo)
      if (!chave) return
      const atual = mapa.get(chave) || {
        nome: corrigirNome(item.executivo),
        meta: 0,
        vendido: 0,
        pis: 0,
      }
      atual.nome = corrigirNome(item.executivo)
      atual.vendido += Number(item.valor_liquido || 0)
      atual.pis += 1
      mapa.set(chave, atual)
    })

    const termo = normalizarTexto(buscaExecutivo)
    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        percentual: item.meta > 0 ? (item.vendido / item.meta) * 100 : 0,
        falta: Math.max(item.meta - item.vendido, 0),
      }))
      .filter((item) => !termo || normalizarTexto(item.nome).includes(termo))
      .sort((a, b) => b.percentual - a.percentual || b.vendido - a.vendido)
  }, [baseExecutivos, buscaExecutivo, mesSelecionado, metas])

  const executivos = useMemo(() => {
    if (mesSelecionado) {
      return desempenhoMensal.map((item) => ({
        nome: item.nome,
        liquido: item.vendido,
        bruto: 0,
        pis: item.pis,
      }))
    }

    const termo = normalizarTexto(buscaExecutivo)
    return criarRanking(baseExecutivos, "executivo", 500).filter(
      (item) => !termo || normalizarTexto(item.nome).includes(termo)
    )
  }, [baseExecutivos, buscaExecutivo, desempenhoMensal, mesSelecionado])

  const resumoEquipe = useMemo(
    () =>
      desempenhoMensal.reduce(
        (acc, item) => {
          acc.meta += item.meta
          acc.vendido += item.vendido
          acc.pis += item.pis
          return acc
        },
        { meta: 0, vendido: 0, pis: 0 }
      ),
    [desempenhoMensal]
  )
  const faltaEquipe = Math.max(resumoEquipe.meta - resumoEquipe.vendido, 0)
  const percentualEquipe =
    resumoEquipe.meta > 0 ? (resumoEquipe.vendido / resumoEquipe.meta) * 100 : 0

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

  const desempenhoExecutivo = desempenhoMensal.find(
    (item) => chaveExecutivo(item.nome) === chaveExecutivo(executivoSelecionado)
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

  const dadosHistoricoExecutivo = useMemo(() => {
    const baseHistorica = filtrarGestao(dadosPermitidos, {
      area: visaoPrivado ? "privado" : areaSelecionada,
      ano: anoSelecionado,
    })
    return baseHistorica.filter(
      (item) =>
        chaveExecutivo(item.executivo) === chaveExecutivo(executivoSelecionado)
    )
  }, [
    anoSelecionado,
    areaSelecionada,
    dadosPermitidos,
    executivoSelecionado,
    visaoPrivado,
  ])

  const evolucao = useMemo(
    () => agruparMeses(dadosHistoricoExecutivo).slice(-12),
    [dadosHistoricoExecutivo]
  )
  const maiorMes = Math.max(...evolucao.map((item) => item.liquido), 1)

  const historicoMensal = useMemo(() => {
    const mapa = new Map<
      string,
      { mes: string; vendido: number; meta: number; pis: number }
    >()

    agruparMeses(dadosHistoricoExecutivo).forEach((item) => {
      mapa.set(item.mes, {
        mes: item.mes,
        vendido: item.liquido,
        meta: 0,
        pis: item.pis,
      })
    })

    metas
      .filter(
        (item) =>
          chaveExecutivo(item.executivo) ===
            chaveExecutivo(executivoSelecionado) &&
          (!anoSelecionado || getMesAno(item.mes).ano === anoSelecionado)
      )
      .forEach((item) => {
        const atual = mapa.get(item.mes) || {
          mes: item.mes,
          vendido: 0,
          meta: 0,
          pis: 0,
        }
        atual.meta += Number(item.meta || 0)
        mapa.set(item.mes, atual)
      })

    return Array.from(mapa.values()).sort(
      (a, b) => mesParaOrdem(b.mes) - mesParaOrdem(a.mes)
    )
  }, [anoSelecionado, dadosHistoricoExecutivo, executivoSelecionado, metas])

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
    if (visaoPrivado) params.set("area", "privado")
    else if (areaSelecionada) params.set("area", areaSelecionada)
    if (anoSelecionado && !mes) params.set("ano", anoSelecionado)
    if (mes || mesSelecionado) params.set("mes", mes || mesSelecionado)
    const origemParams = searchParams.toString()
    params.set(
      "origem",
      `${rotaProdutividade}${origemParams ? `?${origemParams}` : ""}`
    )
    navigate(`/busca-pi?${params}`)
  }

  return (
    <main className="space-y-6 text-zinc-950">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-5 text-white shadow-sm sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-red-600" />
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-6 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-200 transition hover:border-red-500 hover:text-white sm:w-auto"
        >
          {visaoPrivado
            ? "Voltar para Dashboard Admin"
            : "Voltar para Visão Estadual"}
        </button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-black uppercase text-red-400">
              {visaoPrivado ? "Comercial Privado" : "Gestão de equipe"}
            </span>
            <h1 className="mt-2 text-2xl font-black sm:text-4xl">
              Produtividade por executivo
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              Selecione um executivo para analisar resultado, carteira e
              evolução mensal
              {visaoPrivado ? " somente do Comercial Privado." : "."}
            </p>
          </div>
          {executivoSelecionado && (
            <button
              type="button"
              onClick={() => abrirPis()}
              className="h-11 w-full rounded-xl bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-red-600 hover:text-white sm:w-auto"
            >
              Ver PIs do executivo
            </button>
          )}
        </div>
      </header>

      <section
        className={`grid gap-3 ${
          visaoPrivado
            ? "lg:grid-cols-[150px_180px_1fr_auto]"
            : "lg:grid-cols-[220px_150px_180px_1fr_auto]"
        }`}
      >
        {!visaoPrivado && (
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
        )}
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
          className="h-11 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-bold"
        >
          Limpar
        </button>
      </section>

      {!loading && mesSelecionado && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-5 sm:p-6">
            <span className="text-xs font-black uppercase text-red-700">
              Visão geral dos executivos
            </span>
            <h2 className="mt-2 text-2xl font-black">
              Resultado da equipe em {mesSelecionado}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Comparativo entre o valor líquido vendido e a meta mensal de cada
              executivo.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ResumoMensalCard
                label="Meta da equipe"
                value={money(resumoEquipe.meta)}
              />
              <ResumoMensalCard
                label="Vendido no mês"
                value={money(resumoEquipe.vendido)}
                destaque
              />
              <ResumoMensalCard
                label={faltaEquipe > 0 ? "Falta para a meta" : "Meta superada"}
                value={
                  faltaEquipe > 0
                    ? money(faltaEquipe)
                    : money(resumoEquipe.vendido - resumoEquipe.meta)
                }
              />
              <ResumoMensalCard
                label="Atingimento geral"
                value={`${percentualEquipe.toFixed(1)}%`}
              />
            </div>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {desempenhoMensal.map((item) => (
              <button
                type="button"
                key={item.nome}
                onClick={() => atualizarFiltro("executivo", item.nome)}
                className="rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-red-300 hover:bg-red-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{item.nome}</strong>
                    <span className="text-xs text-zinc-400">{item.pis} PIs</span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${corSeloProdutividade(
                      item.percentual
                    )}`}
                  >
                    {item.meta > 0
                      ? `${item.percentual.toFixed(1)}%`
                      : "Sem meta"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <MiniResumo label="Meta" value={money(item.meta)} />
                  <MiniResumo label="Vendido" value={money(item.vendido)} forte />
                  <MiniResumo
                    label="Falta"
                    value={item.falta > 0 ? money(item.falta) : "Alcançada"}
                  />
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={`h-full rounded-full ${corProdutividade(
                      item.percentual
                    )}`}
                    style={{ width: `${Math.min(item.percentual, 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[850px] border-collapse">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Executivo</th>
                  <th className="px-5 py-4 text-right">Meta</th>
                  <th className="px-5 py-4 text-right">Vendido</th>
                  <th className="px-5 py-4 text-right">Falta</th>
                  <th className="px-5 py-4">Produtividade</th>
                </tr>
              </thead>
              <tbody>
                {desempenhoMensal.map((item) => (
                  <tr
                    key={item.nome}
                    className="cursor-pointer border-t border-zinc-100 transition hover:bg-red-50"
                    onClick={() => atualizarFiltro("executivo", item.nome)}
                  >
                    <td className="px-5 py-4">
                      <strong className="block text-sm">{item.nome}</strong>
                      <span className="text-xs text-zinc-400">
                        {item.pis} PIs
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold">
                      {money(item.meta)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-black text-red-700">
                      {money(item.vendido)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold">
                      {item.falta > 0 ? money(item.falta) : "Meta alcançada"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-52 items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className={`h-full rounded-full ${corProdutividade(
                              item.percentual
                            )}`}
                            style={{
                              width: `${Math.min(item.percentual, 100)}%`,
                            }}
                          />
                        </div>
                        <b className="w-16 text-right text-sm">
                          {item.meta > 0
                            ? `${item.percentual.toFixed(1)}%`
                            : "Sem meta"}
                        </b>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-zinc-500">
          Carregando produtividade...
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-w-0 border-r-0 border-zinc-200 xl:border-r xl:pr-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black">Executivos</h2>
              <span className="text-xs font-bold text-zinc-400">
                {executivos.length}
              </span>
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2 xl:block xl:max-h-[720px] xl:space-y-2 xl:overflow-y-auto xl:pr-1">
              {executivos.map((item) => {
                const ativo = item.nome === executivoSelecionado
                return (
                  <button
                    type="button"
                    key={item.nome}
                    onClick={() => atualizarFiltro("executivo", item.nome)}
                    className={`w-[230px] shrink-0 snap-start rounded-xl border p-4 text-left transition xl:w-full ${
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
                    {mesSelecionado &&
                      (() => {
                        const desempenho = desempenhoMensal.find(
                          (registro) =>
                            chaveExecutivo(registro.nome) ===
                            chaveExecutivo(item.nome)
                        )
                        return desempenho ? (
                          <div className="mt-3">
                            <div className="mb-1 flex justify-between text-[10px] font-bold text-zinc-500">
                              <span>Meta {money(desempenho.meta)}</span>
                              <span>
                                {desempenho.meta > 0
                                  ? `${desempenho.percentual.toFixed(1)}%`
                                  : "Sem meta"}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className={`h-full rounded-full ${corProdutividade(
                                  desempenho.percentual
                                )}`}
                                style={{
                                  width: `${Math.min(
                                    desempenho.percentual,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : null
                      })()}
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

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
                  <div className="min-h-32 rounded-2xl bg-red-600 p-5 text-white sm:col-span-2 xl:col-span-2 xl:min-h-36">
                    <span className="text-sm text-red-100">
                      {mesSelecionado ? "Vendido no mês" : "Total líquido"}
                    </span>
                    <strong className="mt-3 block break-words text-3xl font-black">
                      {money(totalLiquido)}
                    </strong>
                  </div>
                  {mesSelecionado && (
                    <>
                      <div className="min-h-32 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-5 text-white xl:min-h-36">
                        <span className="text-sm text-zinc-300">Meta mensal</span>
                        <strong className="mt-3 block break-words text-2xl font-black">
                          {money(desempenhoExecutivo?.meta || 0)}
                        </strong>
                        <small className="mt-2 block text-red-100">
                          {desempenhoExecutivo?.meta
                            ? `${(
                                desempenhoExecutivo.percentual || 0
                              ).toFixed(1)}% alcançado`
                            : "Sem meta cadastrada"}
                        </small>
                      </div>
                      <div className="min-h-32 rounded-2xl border border-zinc-200 p-5 xl:min-h-36">
                        <span className="text-sm text-zinc-500">
                          {desempenhoExecutivo?.falta
                            ? "Falta para alcançar"
                            : "Resultado sobre a meta"}
                        </span>
                        <strong className="mt-3 block break-words text-2xl font-black">
                          {desempenhoExecutivo?.falta
                            ? money(desempenhoExecutivo.falta)
                            : money(
                                Math.max(
                                  (desempenhoExecutivo?.vendido || 0) -
                                    (desempenhoExecutivo?.meta || 0),
                                  0
                                )
                              )}
                        </strong>
                      </div>
                    </>
                  )}
                  <div className="min-h-32 rounded-2xl border border-zinc-200 p-5 xl:min-h-36">
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
                    Passe o mouse para ver o valor vendido e clique para abrir
                    as vendas.
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
                    <div className="flex h-52 min-w-[620px] items-end gap-3 border-b border-zinc-200 px-2 pb-8 sm:h-64">
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black">
                        Produtividade por mês
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Quanto vendeu, a meta definida e quanto faltou em cada
                        mês.
                      </p>
                    </div>
                    {anoSelecionado && (
                      <span className="text-sm font-black text-red-700">
                        Ano {anoSelecionado}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 md:hidden">
                    {historicoMensal.map((item) => {
                      const percentual =
                        item.meta > 0 ? (item.vendido / item.meta) * 100 : 0
                      const falta = Math.max(item.meta - item.vendido, 0)

                      return (
                        <button
                          type="button"
                          key={item.mes}
                          onClick={() => abrirPis(item.mes)}
                          className="rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-red-300 hover:bg-red-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <strong className="block text-base">
                                {item.mes}
                              </strong>
                              <span className="text-xs text-zinc-400">
                                {item.pis} PIs
                              </span>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${corSeloProdutividade(
                                percentual
                              )}`}
                            >
                              {item.meta > 0
                                ? `${percentual.toFixed(1)}%`
                                : "Sem meta"}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <MiniResumo
                              label="Vendido"
                              value={money(item.vendido)}
                              forte
                            />
                            <MiniResumo label="Meta" value={money(item.meta)} />
                            <MiniResumo
                              label="Falta"
                              value={
                                item.meta <= 0
                                  ? "Sem meta"
                                  : falta > 0
                                    ? money(falta)
                                    : "Alcançada"
                              }
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-5 hidden overflow-x-auto rounded-xl border border-zinc-200 md:block">
                    <table className="w-full min-w-[720px] border-collapse">
                      <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Mês</th>
                          <th className="px-4 py-3 text-right">Vendido</th>
                          <th className="px-4 py-3 text-right">Meta</th>
                          <th className="px-4 py-3 text-right">Falta</th>
                          <th className="px-4 py-3 text-right">Atingimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoMensal.map((item) => {
                          const percentual =
                            item.meta > 0
                              ? (item.vendido / item.meta) * 100
                              : 0
                          const falta = Math.max(item.meta - item.vendido, 0)

                          return (
                            <tr
                              key={item.mes}
                              className="cursor-pointer border-t border-zinc-100 transition hover:bg-red-50"
                              onClick={() => abrirPis(item.mes)}
                            >
                              <td className="px-4 py-3">
                                <b className="text-sm">{item.mes}</b>
                                <span className="ml-2 text-xs text-zinc-400">
                                  {item.pis} PIs
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-black text-red-700">
                                {money(item.vendido)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold">
                                {money(item.meta)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm">
                                {item.meta <= 0
                                  ? "Sem meta"
                                  : falta > 0
                                    ? money(falta)
                                    : "Meta alcançada"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${corSeloProdutividade(
                                    percentual
                                  )}`}
                                >
                                  {item.meta > 0
                                    ? `${percentual.toFixed(1)}%`
                                    : "-"}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
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

function ResumoMensalCard({
  label,
  value,
  destaque = false,
}: {
  label: string
  value: string
  destaque?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        destaque
          ? "bg-red-600 text-white"
          : "border border-zinc-200 bg-white text-zinc-950"
      }`}
    >
      <span className={`text-sm ${destaque ? "text-red-100" : "text-zinc-500"}`}>
        {label}
      </span>
      <strong className="mt-2 block break-words text-2xl font-black">
        {value}
      </strong>
    </div>
  )
}

function MiniResumo({
  label,
  value,
  forte = false,
}: {
  label: string
  value: string
  forte?: boolean
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <strong
        className={`mt-1 block break-words text-sm ${
          forte ? "text-red-700" : "text-zinc-800"
        }`}
      >
        {value}
      </strong>
    </div>
  )
}
