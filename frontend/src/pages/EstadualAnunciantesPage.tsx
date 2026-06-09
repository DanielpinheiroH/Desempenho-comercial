import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { getPisCached } from "../services/api"
import {
  AREAS_DJANANE,
  classificarAreaComercial,
  nomeAreaComercial,
  normalizarTexto,
  pertenceAoEscopoDjanane,
  type AreaComercial,
} from "../utils/areasComerciais"
import {
  agenciaValida,
  filtrarGestao,
  getMesAno,
  mesParaOrdem,
  money,
  type PiGestao,
} from "../utils/gestaoEstadualDados"

type AnuncianteResumo = {
  nome: string
  liquido: number
  bruto: number
  pis: number
  agencias: number
  executivos: number
  areas: AreaComercial[]
}

type Ordenacao = "liquido" | "pis" | "nome"

export default function EstadualAnunciantesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dados, setDados] = useState<PiGestao[]>([])
  const [loading, setLoading] = useState(true)

  const areaSelecionada = (searchParams.get("area") || "") as
    | AreaComercial
    | ""
  const anoSelecionado = searchParams.get("ano") || ""
  const mesSelecionado = searchParams.get("mes") || ""
  const busca = searchParams.get("busca") || ""
  const ordenacao = (searchParams.get("ordem") || "liquido") as Ordenacao

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

  const baseFiltrada = useMemo(
    () =>
      filtrarGestao(dadosPermitidos, {
        area: areaSelecionada,
        ano: anoSelecionado,
        mes: mesSelecionado,
      }),
    [dadosPermitidos, areaSelecionada, anoSelecionado, mesSelecionado]
  )

  const dadosVisiveis = useMemo(() => {
    const termo = normalizarTexto(busca)
    return baseFiltrada.filter(
      (item) =>
        !termo || normalizarTexto(item.anunciante).includes(termo)
    )
  }, [baseFiltrada, busca])

  const anunciantes = useMemo(() => {
    const mapa = new Map<
      string,
      AnuncianteResumo & {
        listaAgencias: Set<string>
        listaExecutivos: Set<string>
        listaAreas: Set<AreaComercial>
      }
    >()

    dadosVisiveis.forEach((item) => {
      const nome = String(item.anunciante || "").trim()
      if (!nome) return

      const atual = mapa.get(nome) || {
        nome,
        liquido: 0,
        bruto: 0,
        pis: 0,
        agencias: 0,
        executivos: 0,
        areas: [],
        listaAgencias: new Set<string>(),
        listaExecutivos: new Set<string>(),
        listaAreas: new Set<AreaComercial>(),
      }

      atual.liquido += Number(item.valor_liquido || 0)
      atual.bruto += Number(item.valor_bruto || 0)
      atual.pis += 1
      if (agenciaValida(item.agencia)) atual.listaAgencias.add(item.agencia)
      if (item.executivo) atual.listaExecutivos.add(item.executivo)
      atual.listaAreas.add(classificarAreaComercial(item))
      mapa.set(nome, atual)
    })

    const resultado = Array.from(mapa.values())
      .map((item) => ({
        nome: item.nome,
        liquido: item.liquido,
        bruto: item.bruto,
        pis: item.pis,
        agencias: item.listaAgencias.size,
        executivos: item.listaExecutivos.size,
        areas: Array.from(item.listaAreas),
      }))

    return resultado.sort((a, b) => {
      if (ordenacao === "nome") return a.nome.localeCompare(b.nome, "pt-BR")
      if (ordenacao === "pis") return b.pis - a.pis
      return b.liquido - a.liquido
    })
  }, [dadosVisiveis, ordenacao])

  const totalLiquido = dadosVisiveis.reduce(
    (total, item) => total + Number(item.valor_liquido || 0),
    0
  )
  const totalPis = dadosVisiveis.length
  const mediaAnunciante = anunciantes.length
    ? totalLiquido / anunciantes.length
    : 0

  function atualizarFiltro(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams)
    if (valor) params.set(chave, valor)
    else params.delete(chave)
    if (chave === "ano") params.delete("mes")
    setSearchParams(params)
  }

  function abrirAnunciante(anunciante: string) {
    navigate(`/estadual/anunciantes/${encodeURIComponent(anunciante)}`)
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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-black uppercase text-red-400">
              Carteira estadual
            </span>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Visão de anunciantes
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              Compare faturamento, quantidade de PIs, áreas atendidas e
              amplitude da carteira de cada anunciante.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-l-2 border-red-600 pl-4 text-xs font-bold text-zinc-300">
            <span>Gestão Executiva</span>
            <span>GDF / CLDF</span>
            <span>Governo Estadual</span>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">Explorar carteira</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Filtre e ordene os anunciantes para comparar resultados.
            </p>
          </div>
          {(areaSelecionada ||
            anoSelecionado ||
            mesSelecionado ||
            busca ||
            ordenacao !== "liquido") && (
            <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-700">
              Filtros ativos
            </span>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_150px_180px_minmax(240px,1fr)_170px_auto]">
          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
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
            placeholder="Buscar anunciante"
            value={busca}
            onChange={(event) => atualizarFiltro("busca", event.target.value)}
          />
          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
            value={ordenacao}
            onChange={(event) => atualizarFiltro("ordem", event.target.value)}
          >
            <option value="liquido">Maior líquido</option>
            <option value="pis">Mais PIs</option>
            <option value="nome">Nome A-Z</option>
          </select>
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
          Carregando anunciantes...
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-h-36 rounded-2xl bg-red-600 p-5 text-white shadow-sm">
              <span className="text-sm text-red-100">Anunciantes</span>
              <strong className="mt-2 block text-3xl font-black">
                {anunciantes.length}
              </strong>
              <small className="text-red-100">No filtro atual</small>
            </div>
            <div className="min-h-36 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Total líquido</span>
              <strong className="mt-2 block break-words text-xl font-black">
                {money(totalLiquido)}
              </strong>
              <small className="text-zinc-400">Resultado consolidado</small>
            </div>
            <div className="min-h-36 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">
                Média por anunciante
              </span>
              <strong className="mt-2 block break-words text-xl font-black">
                {money(mediaAnunciante)}
              </strong>
              <small className="text-zinc-400">Valor líquido médio</small>
            </div>
            <div className="min-h-36 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-5 text-white shadow-sm">
              <span className="text-sm text-red-100">PIs</span>
              <strong className="mt-2 block text-3xl font-black">
                {totalPis}
              </strong>
              <small className="text-red-100">Vendas relacionadas</small>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black">Anunciantes encontrados</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Clique em um anunciante para abrir sua análise completa.
                </p>
              </div>
              <span className="text-sm font-bold text-zinc-500">
                {anunciantes.length} resultados
              </span>
            </div>

            {anunciantes.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-zinc-500">
                Nenhum anunciante encontrado com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead className="bg-zinc-100 text-[11px] font-black uppercase text-zinc-500">
                    <tr>
                      <th className="px-5 py-3">Anunciante</th>
                      <th className="px-4 py-3">Áreas</th>
                      <th className="px-4 py-3 text-right">Líquido</th>
                      <th className="px-4 py-3 text-right">Bruto</th>
                      <th className="px-4 py-3 text-center">PIs</th>
                      <th className="px-4 py-3 text-center">Agências</th>
                      <th className="px-4 py-3 text-center">Executivos</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {anunciantes.map((item, index) => (
                      <tr
                        key={item.nome}
                        onClick={() => abrirAnunciante(item.nome)}
                        className="cursor-pointer hover:bg-red-50/50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-black text-zinc-500">
                              {index + 1}
                            </span>
                            <strong className="max-w-[280px] text-sm">
                              {item.nome}
                            </strong>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {item.areas.map((area) => (
                              <span
                                key={area}
                                className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600"
                              >
                                {nomeAreaComercial(area)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-black">
                          {money(item.liquido)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-zinc-600">
                          {money(item.bruto)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold">
                          {item.pis}
                        </td>
                        <td className="px-4 py-4 text-center text-sm">
                          {item.agencias}
                        </td>
                        <td className="px-4 py-4 text-center text-sm">
                          {item.executivos}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              abrirAnunciante(item.nome)
                            }}
                            className="h-9 rounded-lg bg-zinc-950 px-4 text-xs font-black text-white transition hover:bg-red-600"
                          >
                            Abrir análise
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
