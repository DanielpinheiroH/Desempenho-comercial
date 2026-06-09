import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { getPisCached, getUser } from "../services/api"
import {
  classificarAreaComercial,
  nomeAreaComercial,
  normalizarTexto,
  pertenceAoEscopoDjanane,
  type AreaComercial,
} from "../utils/areasComerciais"

type Pi = {
  [key: string]: string | number | null | undefined
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  campanha: string
  valor_bruto?: number
  valor_liquido: number
}

const ITENS_POR_PAGINA = 500

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function normalizar(value?: string | number | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function normalizarForte(value?: string | number | null) {
  return normalizar(value).replace(/[^a-z0-9]/g, "")
}

function isAgenciaValida(value?: string | null) {
  const texto = normalizarForte(value)

  return Boolean(
    texto &&
      texto !== "direto" &&
      texto !== "direta" &&
      texto !== "semagencia" &&
      texto !== "naoinformado"
  )
}

function labelCampo(key: string) {
  const labels: Record<string, string> = {
    numero_pi: "PI",
    executivo: "Executivo",
    anunciante: "Anunciante",
    agencia: "Agência",
    grupo: "Grupo",
    campanha: "Campanha",
    produto: "Produto",
    canal: "Canal",
    perfil_anunciante: "Perfil do anunciante",
    sub_perfil_anunciante: "Subperfil do anunciante",
    mes_venda: "Mês da venda",
    valor_bruto: "Valor bruto",
    valor_liquido: "Valor líquido",
  }

  return labels[key] || key.replaceAll("_", " ")
}

function valorCampo(key: string, value: string | number | null | undefined) {
  if (key.includes("valor")) {
    return money(Number(value || 0))
  }

  return String(value || "-")
}

function textoBuscaPi(item: Pi) {
  return normalizarForte(
    [
      item.numero_pi,
      item.executivo,
      item.anunciante,
      item.agencia,
      item.campanha,
      item.grupo,
      item.produto,
      item.canal,
      item.perfil_anunciante,
      item.sub_perfil_anunciante,
      item.mes_venda,
    ].join(" ")
  )
}

function piBateComBusca(numeroPi: string, termo: string) {
  const piLimpo = normalizarForte(numeroPi)
  const termoLimpo = normalizarForte(termo)

  if (!termoLimpo) return true

  return piLimpo.includes(termoLimpo)
}

export default function BuscaPI() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = getUser()
  const [dados, setDados] = useState<Pi[]>([])
  const [busca, setBusca] = useState(() => searchParams.get("busca") || "")
  const [loading, setLoading] = useState(true)
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const areaSelecionada = (searchParams.get("area") || "") as
    | AreaComercial
    | ""
  const anoSelecionado = searchParams.get("ano") || ""
  const mesSelecionado = searchParams.get("mes") || ""
  const executivoSelecionado = searchParams.get("executivo") || ""
  const origem = searchParams.get("origem") || ""
  const gruposUsuario = Array.isArray(user?.grupos)
    ? user.grupos.map((grupo: string) => normalizarTexto(grupo))
    : []
  const usuarioEstadual =
    user?.role === "grupo" && gruposUsuario.includes("estadual")
  const retornoProdutividade = origem.startsWith("/estadual/executivos")
    ? origem
    : ""

  async function carregarDados() {
    try {
      setLoading(true)

      const dadosCache = await getPisCached()

      setDados(Array.isArray(dadosCache) ? (dadosCache as Pi[]) : [])
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

  useEffect(() => {
    setPaginaAtual(1)
  }, [
    busca,
    areaSelecionada,
    anoSelecionado,
    mesSelecionado,
    executivoSelecionado,
  ])

  const dadosDoContexto = useMemo(() => {
    const executivo = normalizarTexto(executivoSelecionado)

    return dados.filter((item) => {
      const ano = String(item.mes_venda || "").split("/")[1] || ""
      const bateEscopo =
        !usuarioEstadual || pertenceAoEscopoDjanane(item)
      const bateArea =
        !areaSelecionada ||
        classificarAreaComercial(item) === areaSelecionada
      const bateAno = !anoSelecionado || ano === anoSelecionado
      const bateMes = !mesSelecionado || item.mes_venda === mesSelecionado
      const bateExecutivo =
        !executivo || normalizarTexto(item.executivo) === executivo

      return bateEscopo && bateArea && bateAno && bateMes && bateExecutivo
    })
  }, [
    dados,
    areaSelecionada,
    anoSelecionado,
    mesSelecionado,
    executivoSelecionado,
    usuarioEstadual,
  ])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizarForte(busca)

    if (!termo) return dadosDoContexto

    return dadosDoContexto.filter((item) => {
      const batePi = piBateComBusca(item.numero_pi, busca)
      const bateTexto = textoBuscaPi(item).includes(termo)

      return batePi || bateTexto
    })
  }, [dadosDoContexto, busca])

  const totalPaginas = Math.max(
    1,
    Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA)
  )

  const dadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    const fim = inicio + ITENS_POR_PAGINA

    return dadosFiltrados.slice(inicio, fim)
  }, [dadosFiltrados, paginaAtual])

  const sugestoes = useMemo(() => {
    const termo = normalizarForte(busca)

    if (!termo || termo.length < 2) return []

    return dadosDoContexto
      .filter((item) => {
        const batePi = piBateComBusca(item.numero_pi, busca)
        const bateTexto = textoBuscaPi(item).includes(termo)

        return batePi || bateTexto
      })
      .slice(0, 50)
  }, [dadosDoContexto, busca])

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalPIs = dadosFiltrados.length

  const anunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const agencias = new Set(
    dadosFiltrados
      .map((item) => item.agencia)
      .filter((agencia) => isAgenciaValida(agencia))
  ).size

  const inicioExibicao =
    dadosFiltrados.length === 0 ? 0 : (paginaAtual - 1) * ITENS_POR_PAGINA + 1

  const fimExibicao = Math.min(
    paginaAtual * ITENS_POR_PAGINA,
    dadosFiltrados.length
  )

  function selecionarSugestao(item: Pi) {
    atualizarBusca(String(item.numero_pi || ""))
    setPiSelecionado(item)
    setMostrarSugestoes(false)
    setPaginaAtual(1)
  }

  function mudarPagina(novaPagina: number) {
    const paginaSegura = Math.min(Math.max(novaPagina, 1), totalPaginas)

    setPaginaAtual(paginaSegura)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function atualizarBusca(value: string) {
    setBusca(value)
    const params = new URLSearchParams(searchParams)

    if (value) params.set("busca", value)
    else params.delete("busca")

    setSearchParams(params, { replace: true })
  }

  function limparContexto() {
    setBusca("")
    setMostrarSugestoes(false)
    setPaginaAtual(1)
    setSearchParams({})
  }

  const possuiContexto =
    areaSelecionada ||
    anoSelecionado ||
    mesSelecionado ||
    executivoSelecionado

  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        {retornoProdutividade && (
          <button
            type="button"
            onClick={() => navigate(retornoProdutividade)}
            className="mb-6 h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-red-400 hover:text-red-700"
          >
            Voltar para produtividade
          </button>
        )}
        <span className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
          Consulta comercial
        </span>

        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          Busca de PI
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Consulte PIs, campanhas, anunciantes, agências, grupos e executivos.
          A busca ignora pontos, traços, barras e acentos.
        </p>

        {possuiContexto && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-zinc-500">
              Filtros recebidos:
            </span>
            {areaSelecionada && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                {nomeAreaComercial(areaSelecionada)}
              </span>
            )}
            {anoSelecionado && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                {anoSelecionado}
              </span>
            )}
            {mesSelecionado && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                {mesSelecionado}
              </span>
            )}
            {executivoSelecionado && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                {executivoSelecionado}
              </span>
            )}
            <button
              type="button"
              onClick={limparContexto}
              className="text-xs font-black text-red-700 hover:text-red-800"
            >
              Remover filtros
            </button>
          </div>
        )}
      </section>

      <section className="relative rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input
          className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
          placeholder="Buscar PI, cliente, campanha, agência, executivo..."
          value={busca}
          onChange={(e) => {
            atualizarBusca(e.target.value)
            setMostrarSugestoes(true)
          }}
          onFocus={() => setMostrarSugestoes(true)}
        />

        {mostrarSugestoes && sugestoes.length > 0 && (
          <div className="absolute left-5 right-5 top-[76px] z-40 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="border-b border-zinc-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-400">
              Sugestões
            </div>

            <div className="max-h-80 overflow-y-auto">
              {sugestoes.map((item, index) => (
                <button
                  key={`${item.numero_pi}-${index}`}
                  type="button"
                  onClick={() => selecionarSugestao(item)}
                  className="flex w-full flex-col gap-1 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-red-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                      PI {item.numero_pi}
                    </span>

                    <span className="text-xs font-semibold text-zinc-500">
                      {item.mes_venda || "-"}
                    </span>
                  </div>

                  <strong className="text-sm text-zinc-950">
                    {item.anunciante || "-"}
                  </strong>

                  <small className="text-zinc-500">
                    {item.executivo || "-"} • {item.agencia || "-"} •{" "}
                    {money(Number(item.valor_liquido || 0))}
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Carregando PIs...
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-red-600 p-5 text-white shadow-sm">
              <span className="text-sm text-red-100">Valor líquido</span>

              <strong className="mt-2 block break-words text-2xl font-black">
                {money(totalLiquido)}
              </strong>

              <small className="text-red-100">Resultado filtrado</small>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Total de PIs</span>

              <strong className="mt-2 block text-2xl font-black">
                {totalPIs}
              </strong>

              <small className="text-zinc-400">Registros encontrados</small>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Anunciantes</span>

              <strong className="mt-2 block text-2xl font-black">
                {anunciantes}
              </strong>

              <small className="text-zinc-400">Clientes únicos</small>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Agências</span>

              <strong className="mt-2 block text-2xl font-black">
                {agencias}
              </strong>

              <small className="text-zinc-400">Sem considerar direto</small>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black text-zinc-950">
                  Resultado da busca
                </h2>

                <p className="text-sm text-zinc-500">
                  {dadosFiltrados.length} PIs encontrados. Exibindo{" "}
                  {inicioExibicao} a {fimExibicao}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {busca && (
                  <button
                    type="button"
                    onClick={() => {
                      atualizarBusca("")
                      setMostrarSugestoes(false)
                      setPaginaAtual(1)
                    }}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
                  >
                    Limpar busca
                  </button>
                )}

                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-600">
                  Página {paginaAtual} de {totalPaginas}
                </div>
              </div>
            </div>

            {dadosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
                <strong className="block text-zinc-950">
                  Nenhum PI encontrado
                </strong>

                <p className="mt-2 text-sm text-zinc-500">
                  Tente pesquisar por outro termo.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                        <th className="px-3 py-3">PI</th>
                        <th className="px-3 py-3">Executivo</th>
                        <th className="px-3 py-3">Anunciante</th>
                        <th className="px-3 py-3">Agência</th>
                        <th className="px-3 py-3">Campanha</th>
                        <th className="px-3 py-3">Grupo</th>
                        <th className="px-3 py-3 text-right">Valor líquido</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-100">
                      {dadosPaginados.map((item, index) => (
                        <tr
                          key={`${item.numero_pi}-${paginaAtual}-${index}`}
                          className="cursor-pointer text-sm transition hover:bg-red-50"
                          onClick={() => {
                            setPiSelecionado(item)
                            setMostrarSugestoes(false)
                          }}
                        >
                          <td className="px-3 py-4 font-black text-red-600">
                            {item.numero_pi || "-"}
                          </td>

                          <td className="px-3 py-4 text-zinc-600">
                            {item.executivo || "-"}
                          </td>

                          <td className="px-3 py-4 font-semibold text-zinc-800">
                            {item.anunciante || "-"}
                          </td>

                          <td className="px-3 py-4 text-zinc-600">
                            {item.agencia || "-"}
                          </td>

                          <td className="px-3 py-4 text-zinc-600">
                            {item.campanha || "-"}
                          </td>

                          <td className="px-3 py-4 text-zinc-600">
                            {item.grupo || "-"}
                          </td>

                          <td className="px-3 py-4 text-right font-black text-zinc-950">
                            {money(Number(item.valor_liquido || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-5 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-semibold text-zinc-500">
                    Mostrando {inicioExibicao} a {fimExibicao} de{" "}
                    {dadosFiltrados.length} PIs.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={paginaAtual === 1}
                      onClick={() => mudarPagina(1)}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Primeira
                    </button>

                    <button
                      type="button"
                      disabled={paginaAtual === 1}
                      onClick={() => mudarPagina(paginaAtual - 1)}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>

                    <button
                      type="button"
                      disabled={paginaAtual === totalPaginas}
                      onClick={() => mudarPagina(paginaAtual + 1)}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Próxima
                    </button>

                    <button
                      type="button"
                      disabled={paginaAtual === totalPaginas}
                      onClick={() => mudarPagina(totalPaginas)}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Última
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {piSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPiSelecionado(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-6">
              <div>
                <span className="mb-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
                  Detalhes do PI
                </span>

                <h2 className="text-2xl font-black text-zinc-950">
                  PI {piSelecionado.numero_pi || "-"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {piSelecionado.anunciante || "-"} •{" "}
                  {piSelecionado.executivo || "-"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPiSelecionado(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-red-600 p-4 text-white">
                  <span className="text-xs font-bold uppercase tracking-wide text-red-100">
                    Valor líquido
                  </span>

                  <strong className="mt-2 block text-xl font-black">
                    {money(Number(piSelecionado.valor_liquido || 0))}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Valor bruto
                  </span>

                  <strong className="mt-2 block text-xl font-black text-zinc-950">
                    {money(Number(piSelecionado.valor_bruto || 0))}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Anunciante
                  </span>

                  <strong className="mt-2 block break-words text-sm font-black text-zinc-950">
                    {piSelecionado.anunciante || "-"}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Agência
                  </span>

                  <strong className="mt-2 block break-words text-sm font-black text-zinc-950">
                    {piSelecionado.agencia || "-"}
                  </strong>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(piSelecionado).map(([key, value]) => (
                  <div
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                    key={key}
                  >
                    <span className="block text-xs font-bold uppercase tracking-wide text-zinc-400">
                      {labelCampo(key)}
                    </span>

                    <strong className="mt-2 block break-words text-sm text-zinc-950">
                      {valorCampo(key, value)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
