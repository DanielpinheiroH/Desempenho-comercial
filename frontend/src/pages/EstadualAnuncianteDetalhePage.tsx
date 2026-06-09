import { useEffect, useMemo, useState } from "react"
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import { getPisCached } from "../services/api"
import {
  classificarAreaComercial,
  normalizarTexto,
  pertenceAoEscopoDjanane,
} from "../utils/areasComerciais"
import {
  agruparMeses,
  mesCurto,
  mesParaOrdem,
  money,
  type PiGestao,
} from "../utils/gestaoEstadualDados"

const ITENS_POR_PAGINA = 25

function InfoPi({
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
      className={`min-w-0 rounded-xl border p-4 ${
        destaque
          ? "border-red-200 bg-red-50"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <span className="text-[10px] font-black uppercase text-zinc-400">
        {label}
      </span>
      <strong
        className={`mt-1 block break-words text-sm ${
          destaque ? "text-red-700" : "text-zinc-800"
        }`}
      >
        {value || "-"}
      </strong>
    </div>
  )
}

function labelCampoPi(key: string) {
  const labels: Record<string, string> = {
    numero_pi: "PI",
    mes_venda: "Mês da venda",
    valor_bruto: "Valor bruto",
    valor_liquido: "Valor líquido",
    perfil_anunciante: "Perfil do anunciante",
    sub_perfil_anunciante: "Subperfil do anunciante",
    uf_cliente: "UF do cliente",
    uf_agencia: "UF da agência",
  }

  return (
    labels[key] ||
    key
      .replaceAll("_", " ")
      .replace(/^\w/, (letra) => letra.toUpperCase())
  )
}

function valorCampoPi(key: string, value: string | number) {
  if (key === "valor_bruto" || key === "valor_liquido") {
    return money(Number(value || 0))
  }

  return String(value)
}

export default function EstadualAnuncianteDetalhePage() {
  const navigate = useNavigate()
  const { anunciante = "" } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dados, setDados] = useState<PiGestao[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [piSelecionado, setPiSelecionado] = useState<PiGestao | null>(null)
  const [mesHover, setMesHover] = useState<string | null>(null)

  const nomeAnunciante = anunciante
  const mesSelecionado = searchParams.get("mes") || ""

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

  const dadosDoAnunciante = useMemo(() => {
    const nomeNormalizado = normalizarTexto(nomeAnunciante)
    return dados.filter(
      (item) =>
        pertenceAoEscopoDjanane(item) &&
        normalizarTexto(item.anunciante) === nomeNormalizado
    )
  }, [dados, nomeAnunciante])

  const meses = useMemo(
    () =>
      Array.from(
        new Set(
          dadosDoAnunciante
            .map((item) => item.mes_venda)
            .filter(Boolean)
        )
      ).sort((a, b) => mesParaOrdem(b) - mesParaOrdem(a)),
    [dadosDoAnunciante]
  )

  const dadosFiltrados = useMemo(
    () =>
      dadosDoAnunciante
        .filter(
          (item) => !mesSelecionado || item.mes_venda === mesSelecionado
        )
      .sort(
        (a, b) =>
          mesParaOrdem(b.mes_venda) - mesParaOrdem(a.mes_venda) ||
          Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0)
      ),
    [dadosDoAnunciante, mesSelecionado]
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
  const evolucao = useMemo(
    () => agruparMeses(dadosFiltrados).slice(-12),
    [dadosFiltrados]
  )
  const maiorMes = Math.max(...evolucao.map((item) => item.liquido), 1)

  const totalPaginas = Math.max(
    1,
    Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA)
  )
  const dadosPaginados = dadosFiltrados.slice(
    (pagina - 1) * ITENS_POR_PAGINA,
    pagina * ITENS_POR_PAGINA
  )

  const camposPiSelecionado = piSelecionado
    ? Object.entries(piSelecionado)
        .filter(
          ([, value]) =>
            value !== null && value !== undefined && String(value).trim() !== ""
        )
        .sort(([campoA], [campoB]) => {
          const prioridade = [
            "numero_pi",
            "valor_liquido",
            "valor_bruto",
            "mes_venda",
            "anunciante",
            "agencia",
            "executivo",
            "campanha",
          ]
          const posicaoA = prioridade.indexOf(campoA)
          const posicaoB = prioridade.indexOf(campoB)
          return (
            (posicaoA === -1 ? prioridade.length : posicaoA) -
            (posicaoB === -1 ? prioridade.length : posicaoB)
          )
        })
    : []

  useEffect(() => {
    setPagina(1)
  }, [mesSelecionado])

  function selecionarMes(valor: string) {
    const params = new URLSearchParams()
    if (valor) params.set("mes", valor)
    setSearchParams(params)
  }

  function voltarParaAnunciantes() {
    navigate("/estadual/anunciantes")
  }

  return (
    <main className="space-y-6 text-zinc-950">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-red-600" />
        <button
          type="button"
          onClick={voltarParaAnunciantes}
          className="mb-7 h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-200 transition hover:border-red-500 hover:text-white"
        >
          Voltar para anunciantes
        </button>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-black uppercase text-red-400">
              Análise de carteira
            </span>
            <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">
              {nomeAnunciante}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              PIs, evolução financeira e responsáveis deste anunciante dentro
              do escopo estadual da Djanane.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 border-l-2 border-red-600 pl-4 text-sm">
            <div>
              <span className="block text-xs text-zinc-400">PIs históricos</span>
              <strong className="text-xl">{dadosDoAnunciante.length}</strong>
            </div>
            <div>
              <span className="block text-xs text-zinc-400">Áreas ativas</span>
              <strong className="text-xl">
                {
                  new Set(
                    dadosDoAnunciante.map((item) =>
                      classificarAreaComercial(item)
                    )
                  ).size
                }
              </strong>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-zinc-500">
          Carregando carteira do anunciante...
        </div>
      ) : dadosDoAnunciante.length === 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
          <h2 className="text-xl font-black">Anunciante não encontrado</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Não há PIs estaduais disponíveis para este anunciante.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-h-36 rounded-2xl bg-red-600 p-5 text-white shadow-sm">
              <span className="text-sm text-red-100">Total líquido</span>
              <strong className="mt-3 block break-all text-xl font-black leading-tight sm:text-2xl">
                {money(totalLiquido)}
              </strong>
              <small className="mt-3 block text-red-100">
                Resultado do anunciante
              </small>
            </div>
            <div className="min-h-36 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Total bruto</span>
              <strong className="mt-3 block break-words text-2xl font-black">
                {money(totalBruto)}
              </strong>
              <small className="mt-3 block text-zinc-400">
                Valor comercializado
              </small>
            </div>
            <div className="min-h-36 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">PIs encontrados</span>
              <strong className="mt-3 block text-3xl font-black">
                {totalPis}
              </strong>
              <small className="mt-3 block text-zinc-400">
                Conforme os filtros atuais
              </small>
            </div>
            <div className="min-h-36 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Ticket médio</span>
              <strong className="mt-3 block break-words text-2xl font-black">
                {money(ticketMedio)}
              </strong>
              <small className="mt-3 block text-zinc-400">
                Valor líquido por PI
              </small>
            </div>
          </section>

          <section>
            <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">Evolução mensal</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Clique em uma barra para filtrar o mês.
                  </p>
                </div>
                <div className="flex min-h-12 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <select
                    aria-label="Selecionar mês do gráfico"
                    className="h-10 min-w-44 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
                    value={mesSelecionado}
                    onChange={(event) =>
                      selecionarMes(event.target.value)
                    }
                  >
                    <option value="">Todos os meses</option>
                    {meses.map((mes) => (
                      <option key={mes} value={mes}>
                        {mes}
                      </option>
                    ))}
                  </select>
                  {mesHover &&
                    (() => {
                      const item = evolucao.find(
                        (mes) => mes.mes === mesHover
                      )
                      return item ? (
                        <>
                          <strong className="block text-sm">
                            {money(item.liquido)}
                          </strong>
                          <span className="text-xs text-zinc-500">
                            {item.mes} · {item.pis} PIs
                          </span>
                        </>
                      ) : null
                    })()}
                </div>
              </div>
              <div className="mt-5 w-full overflow-x-auto pb-2">
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
                        className={`w-full max-w-12 rounded-t-md transition ${
                          mesSelecionado === item.mes
                            ? "bg-red-600"
                            : "bg-zinc-300 group-hover:bg-red-500"
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
            </div>

          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black">PIs do anunciante</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Selecione uma linha para consultar todos os detalhes.
                </p>
              </div>
              <span className="text-sm font-bold text-zinc-500">
                {dadosFiltrados.length} registros
              </span>
            </div>

            {dadosPaginados.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-zinc-500">
                Nenhum PI encontrado com os filtros atuais.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-left">
                    <thead className="bg-zinc-50 text-[11px] font-black uppercase text-zinc-500">
                      <tr>
                        <th className="px-5 py-3">PI</th>
                        <th className="px-4 py-3">Mês</th>
                        <th className="px-4 py-3">Campanha</th>
                        <th className="px-4 py-3">Agência</th>
                        <th className="px-4 py-3">Executivo</th>
                        <th className="px-4 py-3 text-right">Bruto</th>
                        <th className="px-5 py-3 text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dadosPaginados.map((item, index) => (
                        <tr
                          key={`${item.numero_pi}-${index}`}
                          onClick={() => setPiSelecionado(item)}
                          className="cursor-pointer text-sm transition hover:bg-red-50"
                        >
                          <td className="px-5 py-4 font-black text-red-700">
                            {item.numero_pi || "-"}
                          </td>
                          <td className="px-4 py-4 text-zinc-600">
                            {item.mes_venda || "-"}
                          </td>
                          <td className="max-w-64 truncate px-4 py-4 font-semibold">
                            {item.campanha || item.produto || "-"}
                          </td>
                          <td className="max-w-52 truncate px-4 py-4 text-zinc-600">
                            {item.agencia || "-"}
                          </td>
                          <td className="max-w-44 truncate px-4 py-4 text-zinc-600">
                            {item.executivo || "-"}
                          </td>
                          <td className="px-4 py-4 text-right text-zinc-600">
                            {money(Number(item.valor_bruto || 0))}
                          </td>
                          <td className="px-5 py-4 text-right font-black">
                            {money(Number(item.valor_liquido || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between gap-4 border-t border-zinc-200 px-5 py-4">
                    <span className="text-xs font-bold text-zinc-500">
                      Página {pagina} de {totalPaginas}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pagina === 1}
                        onClick={() => setPagina((atual) => atual - 1)}
                        className="h-9 rounded-lg border border-zinc-200 px-4 text-xs font-black disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={pagina === totalPaginas}
                        onClick={() => setPagina((atual) => atual + 1)}
                        className="h-9 rounded-lg bg-zinc-950 px-4 text-xs font-black text-white disabled:opacity-40"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {piSelecionado && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/60 p-3 sm:items-center sm:p-6"
          onClick={() => setPiSelecionado(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <span className="text-xs font-black uppercase text-red-700">
                  Detalhes do PI
                </span>
                <h2 className="mt-1 text-2xl font-black">
                  PI {piSelecionado.numero_pi || "-"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPiSelecionado(null)}
                className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-black hover:border-red-400 hover:text-red-700"
              >
                Fechar
              </button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {camposPiSelecionado.map(([key, value]) => (
                <InfoPi
                  key={key}
                  label={labelCampoPi(key)}
                  value={valorCampoPi(key, value as string | number)}
                  destaque={key === "valor_liquido"}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
