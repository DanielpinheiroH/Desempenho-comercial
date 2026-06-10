import { useEffect, useMemo, useState } from "react"
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps"
import { scaleLinear } from "d3-scale"
import { useNavigate } from "react-router-dom"

import { api, getToken, getUser } from "../services/api"

const GEO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"

type BaseMapa = "cliente" | "agencia"

type Pi = {
  numero_pi?: string | null
  uf_cliente?: string | null
  uf_agencia?: string | null
  valor_liquido?: number | string | null
  valor_bruto?: number | string | null
  perfil_anunciante?: string | null
  sub_perfil_anunciante?: string | null
  mes_venda?: string | null
  executivo?: string | null
  anunciante?: string | null
  agencia?: string | null
  campanha?: string | null
  produto?: string | null
  canal?: string | null
}

type UfResumo = {
  uf: string
  liquido: number
  bruto: number
  pis: number
}

type TooltipState = {
  uf: string
  x: number
  y: number
}

type GeographyItem = {
  rsmKey: string
  properties: Record<string, string | number | undefined>
}

const UF_NAME_TO_SIGLA: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
}

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function onlyNumber(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getAno(mes?: string | null) {
  const value = String(mes || "").trim()
  const match = value.match(/\b(20\d{2}|19\d{2})\b/)

  if (match) return match[1]

  const partes = value.split("/")
  return partes[1]?.trim() || ""
}

function getMes(mes?: string | null) {
  const value = String(mes || "").trim()
  const partes = value.split("/")

  if (partes[0] && /^\d{1,2}$/.test(partes[0])) {
    return partes[0].padStart(2, "0")
  }

  return ""
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

function getUfFromGeography(properties: GeographyItem["properties"]) {
  const candidates = [
    properties.sigla,
    properties.uf,
    properties.UF,
    properties.postal,
    properties.abbrev,
  ]

  const sigla = candidates
    .map((item) => String(item || "").trim().toUpperCase())
    .find((item) => /^[A-Z]{2}$/.test(item))

  if (sigla) return sigla

  const name = normalizar(
    String(properties.name || properties.nome || properties.NAME || "")
  )

  return UF_NAME_TO_SIGLA[name] || ""
}

function getUf(item: Pi, baseMapa: BaseMapa) {
  const value = baseMapa === "cliente" ? item.uf_cliente : item.uf_agencia
  return String(value || "").trim().toUpperCase()
}

export default function MapaBrasil() {
  const navigate = useNavigate()
  const user = getUser()
  const executivoAtual = user?.executivo || user?.nome || ""
  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
  const [baseMapa, setBaseMapa] = useState<BaseMapa>("cliente")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [perfilSelecionado, setPerfilSelecionado] = useState("")
  const [subperfilSelecionado, setSubperfilSelecionado] = useState("")
  const [ufSelecionada, setUfSelecionada] = useState("")
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const dadosDoEscopo = useMemo(() => {
    if (user?.role !== "executivo") return dados

    const executivoNormalizado = normalizar(executivoAtual)
    return dados.filter(
      (item) => normalizar(item.executivo) === executivoNormalizado
    )
  }, [dados, executivoAtual, user?.role])

  useEffect(() => {
    async function carregarDados() {
      try {
        setLoading(true)
        setErro("")

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
        setErro("Não foi possível carregar os dados comerciais.")
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [])

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosDoEscopo.map((item) => getAno(item.mes_venda)).filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosDoEscopo])

  const meses = useMemo(() => {
    return Array.from(
      new Set(
        dadosDoEscopo
          .filter(
            (item) => !anoSelecionado || getAno(item.mes_venda) === anoSelecionado
          )
          .map((item) => getMes(item.mes_venda))
          .filter(Boolean)
      )
    ).sort((a, b) => Number(a) - Number(b))
  }, [dadosDoEscopo, anoSelecionado])

  const perfis = useMemo(() => {
    return Array.from(
      new Set(
        dadosDoEscopo
          .map((item) => String(item.perfil_anunciante || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [dadosDoEscopo])

  const subperfis = useMemo(() => {
    return Array.from(
      new Set(
        dadosDoEscopo
          .filter(
            (item) =>
              !perfilSelecionado ||
              item.perfil_anunciante === perfilSelecionado
          )
          .map((item) => String(item.sub_perfil_anunciante || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [dadosDoEscopo, perfilSelecionado])

  const dadosFiltrados = useMemo(() => {
    return dadosDoEscopo.filter((item) => {
      const bateAno = !anoSelecionado || getAno(item.mes_venda) === anoSelecionado
      const bateMes = !mesSelecionado || getMes(item.mes_venda) === mesSelecionado
      const batePerfil =
        !perfilSelecionado || item.perfil_anunciante === perfilSelecionado
      const bateSubperfil =
        !subperfilSelecionado ||
        item.sub_perfil_anunciante === subperfilSelecionado
      const possuiUf = /^[A-Z]{2}$/.test(getUf(item, baseMapa))

      return bateAno && bateMes && batePerfil && bateSubperfil && possuiUf
    })
  }, [
    dadosDoEscopo,
    anoSelecionado,
    mesSelecionado,
    perfilSelecionado,
    subperfilSelecionado,
    baseMapa,
  ])

  const resumoPorUf = useMemo(() => {
    const mapa = new Map<string, UfResumo>()

    dadosFiltrados.forEach((item) => {
      const uf = getUf(item, baseMapa)
      const atual = mapa.get(uf) || {
        uf,
        liquido: 0,
        bruto: 0,
        pis: 0,
      }

      atual.liquido += onlyNumber(item.valor_liquido)
      atual.bruto += onlyNumber(item.valor_bruto)
      atual.pis += 1

      mapa.set(uf, atual)
    })

    return mapa
  }, [dadosFiltrados, baseMapa])

  const rankingUfs = useMemo(() => {
    return Array.from(resumoPorUf.values()).sort(
      (a, b) => b.liquido - a.liquido
    )
  }, [resumoPorUf])

  const maiorLiquidoUf = rankingUfs[0]?.liquido || 0

  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, Math.max(maiorLiquidoUf, 1)])
      .range(["#fee2e2", "#dc2626"])
      .clamp(true)
  }, [maiorLiquidoUf])

  const totais = useMemo(() => {
    const liquido = dadosFiltrados.reduce(
      (acc, item) => acc + onlyNumber(item.valor_liquido),
      0
    )
    const bruto = dadosFiltrados.reduce(
      (acc, item) => acc + onlyNumber(item.valor_bruto),
      0
    )
    const ufs = new Set(dadosFiltrados.map((item) => getUf(item, baseMapa))).size

    return {
      liquido,
      bruto,
      pis: dadosFiltrados.length,
      ufs,
    }
  }, [dadosFiltrados, baseMapa])

  const estadoSelecionado = ufSelecionada
    ? resumoPorUf.get(ufSelecionada) || null
    : null

  const estadoTooltip = tooltip ? resumoPorUf.get(tooltip.uf) : null

  function limparFiltros() {
    setAnoSelecionado("")
    setMesSelecionado("")
    setPerfilSelecionado("")
    setSubperfilSelecionado("")
    setUfSelecionada("")
  }

  function alterarAno(value: string) {
    setAnoSelecionado(value)
    setMesSelecionado("")
    setUfSelecionada("")
  }

  function alterarPerfil(value: string) {
    setPerfilSelecionado(value)
    setSubperfilSelecionado("")
    setUfSelecionada("")
  }

  function alterarBase(value: BaseMapa) {
    setBaseMapa(value)
    setUfSelecionada("")
  }

  const filtrosAtivos = Boolean(
    anoSelecionado ||
      mesSelecionado ||
      perfilSelecionado ||
      subperfilSelecionado ||
      ufSelecionada
  )

  function abrirUf(uf: string) {
    const params = new URLSearchParams({ base: baseMapa })

    if (anoSelecionado) params.set("ano", anoSelecionado)
    if (mesSelecionado) params.set("mes", mesSelecionado)
    if (perfilSelecionado) params.set("perfil", perfilSelecionado)
    if (subperfilSelecionado) params.set("subperfil", subperfilSelecionado)

    navigate(`/mapa-brasil/uf/${uf}?${params.toString()}`)
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-100 p-4 text-zinc-950 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-5">
        <section className="overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950 text-white shadow-sm md:rounded-[2rem]">
          <div className="p-5 sm:p-7 lg:p-8">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:border-red-400/60 hover:bg-white/15"
            >
              ← Voltar ao dashboard
            </button>

            <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-red-100">
              Desempenho Comercial
            </span>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-black tracking-tight sm:text-4xl">
                  Mapa do Brasil
                </h1>
                <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-zinc-300 sm:text-base">
                  Visualização geográfica dos investimentos e faturamentos por
                  estado, com leitura por UF do cliente ou da agência.
                </p>
              </div>

              <div className="flex rounded-2xl bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => alterarBase("cliente")}
                  className={`h-10 flex-1 rounded-xl px-4 text-sm font-black transition sm:flex-none ${
                    baseMapa === "cliente"
                      ? "bg-red-600 text-white"
                      : "text-zinc-200 hover:bg-white/10"
                  }`}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => alterarBase("agencia")}
                  className={`h-10 flex-1 rounded-xl px-4 text-sm font-black transition sm:flex-none ${
                    baseMapa === "agencia"
                      ? "bg-red-600 text-white"
                      : "text-zinc-200 hover:bg-white/10"
                  }`}
                >
                  Agência
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Valor Líquido Total"
            value={money(totais.liquido)}
            variant="red"
          />
          <KpiCard label="Valor Bruto Total" value={money(totais.bruto)} />
          <KpiCard label="Quantidade de PIs" value={String(totais.pis)} />
          <KpiCard label="Quantidade de UFs" value={String(totais.ufs)} />
        </section>

        <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[2rem]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-black">Filtros</h2>
              <p className="text-sm text-zinc-500">
                Refine o mapa por período, perfil e subperfil.
              </p>
            </div>

            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="h-10 rounded-xl bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Ano"
              value={anoSelecionado}
              onChange={alterarAno}
              options={anos.map((ano) => ({ label: ano, value: ano }))}
              placeholder="Todos os anos"
            />
            <FilterSelect
              label="Mês"
              value={mesSelecionado}
              onChange={(value) => {
                setMesSelecionado(value)
                setUfSelecionada("")
              }}
              options={meses.map((mes) => ({
                label: nomeMes(mes),
                value: mes,
              }))}
              placeholder="Todos os meses"
            />
            <FilterSelect
              label="Perfil"
              value={perfilSelecionado}
              onChange={alterarPerfil}
              options={perfis.map((perfil) => ({
                label: perfil,
                value: perfil,
              }))}
              placeholder="Todos os perfis"
            />
            <FilterSelect
              label="Subperfil"
              value={subperfilSelecionado}
              onChange={(value) => {
                setSubperfilSelecionado(value)
                setUfSelecionada("")
              }}
              options={subperfis.map((subperfil) => ({
                label: subperfil,
                value: subperfil,
              }))}
              placeholder="Todos os subperfis"
            />
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : erro ? (
          <EmptyState text={erro} />
        ) : (
          <>
          <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-3 shadow-sm sm:p-5 md:rounded-[2rem]">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">Investimento por UF</h2>
                  <p className="text-sm text-zinc-500">
                    Estados em vermelho mais intenso concentram maior valor
                    líquido.
                  </p>
                </div>
                <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                  Base: {baseMapa === "cliente" ? "Cliente" : "Agência"}
                </span>
              </div>

              <div className="relative min-h-[460px] w-full overflow-hidden rounded-2xl bg-zinc-50 sm:min-h-[640px] 2xl:min-h-[720px]">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    center: [-54, -15],
                    scale: 760,
                  }}
                  className="h-full min-h-[460px] w-full sm:min-h-[640px] 2xl:min-h-[720px]"
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }: { geographies: GeographyItem[] }) =>
                      geographies.map((geo) => {
                        const uf = getUfFromGeography(geo.properties)
                        const resumo = resumoPorUf.get(uf)
                        const selecionado = ufSelecionada === uf
                        const fill = resumo ? colorScale(resumo.liquido) : "#f4f4f5"

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={(event) => {
                              setTooltip({
                                uf,
                                x: event.clientX,
                                y: event.clientY,
                              })
                            }}
                            onMouseMove={(event) => {
                              setTooltip((atual) =>
                                atual
                                  ? {
                                      ...atual,
                                      x: event.clientX,
                                      y: event.clientY,
                                    }
                                  : null
                              )
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={() => setUfSelecionada(uf)}
                            style={{
                              default: {
                                fill,
                                stroke: selecionado ? "#18181b" : "#ffffff",
                                strokeWidth: selecionado ? 1.4 : 0.7,
                                outline: "none",
                              },
                              hover: {
                                fill: resumo ? "#b91c1c" : "#e4e4e7",
                                stroke: "#18181b",
                                strokeWidth: 1,
                                cursor: "pointer",
                                outline: "none",
                              },
                              pressed: {
                                fill: "#991b1b",
                                outline: "none",
                              },
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ComposableMap>

                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-sm sm:left-auto sm:right-4 sm:w-72">
                  <span className="text-xs font-black text-zinc-500">Menor</span>
                  <div className="h-3 flex-1 rounded-full bg-gradient-to-r from-red-100 to-red-600" />
                  <span className="text-xs font-black text-zinc-500">Maior</span>
                </div>
              </div>
            </div>

            <StatePanel
              resumo={estadoSelecionado}
              totalLiquido={totais.liquido}
              onClose={() => setUfSelecionada("")}
            />
          </section>

          {estadoSelecionado && (
            <button
              type="button"
              onClick={() => abrirUf(estadoSelecionado.uf)}
              className="rounded-[1.5rem] border border-red-100 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:bg-red-50 md:rounded-[2rem]"
            >
              <span className="text-xs font-black uppercase text-red-600">
                UF selecionada
              </span>
              <strong className="mt-1 block text-xl font-black text-zinc-950">
                Ver todos os PIs de {estadoSelecionado.uf}
              </strong>
              <p className="mt-1 text-sm text-zinc-500">
                Abre a página dedicada com anunciantes, agências, todos os PIs e modal de detalhes.
              </p>
            </button>
          )}
          </>
        )}

        <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:rounded-[2rem]">
          <div className="flex flex-col gap-1 border-b border-zinc-200 p-4 sm:p-5">
            <h2 className="text-lg font-black">Ranking de UFs</h2>
            <p className="text-sm text-zinc-500">
              Ordenado por valor líquido no filtro atual.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-black">UF</th>
                  <th className="px-4 py-3 font-black">Valor Líquido</th>
                  <th className="px-4 py-3 font-black">Valor Bruto</th>
                  <th className="px-4 py-3 font-black">Participação</th>
                  <th className="px-4 py-3 text-right font-black">
                    Quantidade PIs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rankingUfs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={5}>
                      Nenhuma UF encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  rankingUfs.map((item) => {
                    const percentual =
                      totais.liquido > 0 ? (item.liquido / totais.liquido) * 100 : 0

                    return (
                      <tr
                        key={item.uf}
                        className="cursor-pointer transition hover:bg-red-50"
                        onClick={() => abrirUf(item.uf)}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-zinc-950 px-3 text-sm font-black text-white">
                            {item.uf}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-black text-zinc-950">
                          {money(item.liquido)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-700">
                          {money(item.bruto)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-[150px] items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full bg-red-600"
                                style={{ width: `${Math.min(percentual, 100)}%` }}
                              />
                            </div>
                            <b className="w-14 text-right text-xs text-red-700">
                              {percentual.toFixed(1)}%
                            </b>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-black text-red-700">
                          {item.pis}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-xl"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 240),
            top: Math.max(tooltip.y - 24, 12),
          }}
        >
          <strong className="block text-base font-black text-zinc-950">
            {tooltip.uf || "UF"}
          </strong>
          <div className="mt-2 space-y-1 text-xs font-semibold text-zinc-600">
            <div>Líquido: {money(estadoTooltip?.liquido || 0)}</div>
            <div>Bruto: {money(estadoTooltip?.bruto || 0)}</div>
            <div>PIs: {estadoTooltip?.pis || 0}</div>
            <div>
              Participação:{" "}
              {totais.liquido > 0 && estadoTooltip
                ? `${((estadoTooltip.liquido / totais.liquido) * 100).toFixed(1)}%`
                : "0.0%"}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function KpiCard({
  label,
  value,
  variant = "light",
}: {
  label: string
  value: string
  variant?: "light" | "red"
}) {
  const className =
    variant === "red"
      ? "border-red-600 bg-red-600 text-white"
      : "border-zinc-200 bg-white text-zinc-950"

  return (
    <div className={`min-w-0 overflow-hidden rounded-[1.5rem] border p-4 shadow-sm sm:p-5 ${className}`}>
      <span
        className={`block text-sm font-bold ${
          variant === "red" ? "text-red-100" : "text-zinc-500"
        }`}
      >
        {label}
      </span>
      <strong className="mt-2 block break-words text-xl font-black leading-tight sm:text-2xl">
        {value}
      </strong>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  placeholder: string
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-black uppercase text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatePanel({
  resumo,
  totalLiquido,
  onClose,
}: {
  resumo: UfResumo | null
  totalLiquido: number
  onClose: () => void
}) {
  if (!resumo) {
    return (
      <aside className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white p-5 text-center shadow-sm md:rounded-[2rem] xl:sticky xl:top-6 xl:h-fit">
        <strong className="block text-lg font-black text-zinc-950">
          Selecione um estado
        </strong>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Clique em uma UF no mapa ou no ranking para abrir os detalhes
          comerciais daquele estado.
        </p>
      </aside>
    )
  }

  const percentual = totalLiquido > 0 ? (resumo.liquido / totalLiquido) * 100 : 0

  return (
    <aside className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm md:rounded-[2rem] xl:sticky xl:top-6 xl:h-fit">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase text-red-600">
            Estado selecionado
          </span>
          <h2 className="text-3xl font-black text-zinc-950">{resumo.uf}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-xl bg-zinc-100 px-3 text-xs font-black text-zinc-600 transition hover:bg-red-50 hover:text-red-700"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-3">
        <PanelMetric label="Total líquido" value={money(resumo.liquido)} />
        <PanelMetric label="Total bruto" value={money(resumo.bruto)} />
        <PanelMetric label="Quantidade de PIs" value={String(resumo.pis)} />
        <PanelMetric label="Participação no filtro" value={`${percentual.toFixed(1)}%`} />
      </div>
    </aside>
  )
}

function PanelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <span className="block text-xs font-black uppercase text-zinc-500">
        {label}
      </span>
      <strong className="mt-1 block break-words text-lg font-black text-zinc-950">
        {value}
      </strong>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <section className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white p-8 text-center text-sm font-semibold text-zinc-500 shadow-sm md:rounded-[2rem]">
      {text}
    </section>
  )
}

function LoadingState() {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[520px] animate-pulse rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:rounded-[2rem]" />
      <div className="h-[520px] animate-pulse rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:rounded-[2rem]" />
    </section>
  )
}

