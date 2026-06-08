import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps"
import { scaleLinear } from "d3-scale"

import { getPisCached, getUser } from "../services/api"

const MAPA_BRASIL_GEO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  uf_cliente?: string
  uf_agencia?: string
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

type MapaBase = "cliente" | "agencia"

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

type MapaUfResumo = {
  uf: string
  liquido: number
  bruto: number
  pis: number
}

type MapaTooltip = {
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

  return nomes[String(numero).padStart(2, "0")] || numero
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

function isAnoAPartirDe2022(mes?: string) {
  const ano = Number(getAno(mes))

  return Number.isFinite(ano) && ano >= 2022
}

function agruparRanking(dados: PiTratado[], campo: keyof PiTratado, limite = 8) {
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

export default function DashboardAdmin() {
  const user = getUser()
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [areaSelecionada, setAreaSelecionada] = useState<AreaTipo | "">("")
  const [anoAberto, setAnoAberto] = useState<string | null>(null)
  const [baseMapaDashboard, setBaseMapaDashboard] = useState<MapaBase>("cliente")
  const [ufMapaSelecionada, setUfMapaSelecionada] = useState("")
  const [mapaTooltip, setMapaTooltip] = useState<MapaTooltip | null>(null)

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

  const dadosTratados = useMemo<PiTratado[]>(() => {
    return dados.map((item) => ({
      ...item,
      area_classificada: classificarArea(item),
    }))
  }, [dados])

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosTratados
          .map((item) => getAno(item.mes_venda))
          .filter((ano) => ano && ano !== "Sem ano")
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosTratados])

  const mesesDisponiveis = useMemo(() => {
    const meses = dadosTratados
      .filter((item) => !anoSelecionado || getAno(item.mes_venda) === anoSelecionado)
      .map((item) => getMesNumero(item.mes_venda))
      .filter((mes) => mes && mes !== "Sem mês")

    return Array.from(new Set(meses)).sort((a, b) => Number(a) - Number(b))
  }, [dadosTratados, anoSelecionado])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    return dadosTratados.filter((item) => {
      const bateAno = !anoSelecionado || getAno(item.mes_venda) === anoSelecionado
      const bateMes = !mesSelecionado || getMesNumero(item.mes_venda) === mesSelecionado
      const bateArea = !areaSelecionada || item.area_classificada === areaSelecionada

      const texto = normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.grupo,
          item.perfil_anunciante,
          item.sub_perfil_anunciante,
          item.campanha,
          item.produto,
          item.canal,
          item.mes_venda,
          nomeArea(item.area_classificada),
        ].join(" ")
      )

      const bateBusca = !termo || texto.includes(termo)

      return bateAno && bateMes && bateArea && bateBusca
    })
  }, [dadosTratados, busca, anoSelecionado, mesSelecionado, areaSelecionada])

  const dadosDesde2022 = useMemo(() => {
    return dadosFiltrados.filter((item) => isAnoAPartirDe2022(item.mes_venda))
  }, [dadosFiltrados])

  const totalLiquidoDesde2022 = dadosDesde2022.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBrutoDesde2022 = dadosDesde2022.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalPIs = dadosFiltrados.length

  const ticketMedio =
    dadosDesde2022.length > 0 ? totalLiquidoDesde2022 / dadosDesde2022.length : 0

  const totalAnunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const totalAgencias = new Set(
    dadosFiltrados
      .map((item) => item.agencia)
      .filter((agencia) => agencia && !isAgenciaDireta(agencia))
  ).size

  const areas = useMemo(() => {
    const lista: AreaTipo[] = [
      "privado",
      "gestao-executiva",
      "estadual",
      "federal",
      "gdf",
    ]

    return lista.map((area) => {
      const itens = dadosFiltrados.filter(
        (item) => item.area_classificada === area
      )

      const total = itens.reduce(
        (acc, item) => acc + Number(item.valor_liquido || 0),
        0
      )

      const bruto = itens.reduce(
        (acc, item) => acc + Number(item.valor_bruto || 0),
        0
      )

      const percentual =
        totalLiquidoDesde2022 > 0 ? (total / totalLiquidoDesde2022) * 100 : 0

      return {
        area,
        nome: nomeArea(area),
        total,
        bruto,
        pis: itens.length,
        ticket: itens.length > 0 ? total / itens.length : 0,
        percentual,
      }
    })
  }, [dadosFiltrados, totalLiquidoDesde2022])

  const faturamentoPorAno = useMemo<AnoResumo[]>(() => {
    const mapaMes = new Map<string, MesResumo>()

    dadosFiltrados
      .filter((item) => isAnoAPartirDe2022(item.mes_venda))
      .forEach((item) => {
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

  const topAnunciantes = useMemo(
    () => agruparRanking(dadosFiltrados, "anunciante", 8),
    [dadosFiltrados]
  )

  const topAgencias = useMemo(() => {
    return agruparRanking(
      dadosFiltrados.filter((item) => !isAgenciaDireta(item.agencia)),
      "agencia",
      8
    )
  }, [dadosFiltrados])

  const mapaPorUf = useMemo(() => {
    const mapa = new Map<string, MapaUfResumo>()

    dadosFiltrados.forEach((item) => {
      const uf = String(
        baseMapaDashboard === "cliente" ? item.uf_cliente : item.uf_agencia
      )
        .trim()
        .toUpperCase()

      if (!/^[A-Z]{2}$/.test(uf)) return

      const atual = mapa.get(uf) || {
        uf,
        liquido: 0,
        bruto: 0,
        pis: 0,
      }

      atual.liquido += Number(item.valor_liquido || 0)
      atual.bruto += Number(item.valor_bruto || 0)
      atual.pis += 1

      mapa.set(uf, atual)
    })

    return mapa
  }, [dadosFiltrados, baseMapaDashboard])

  const rankingMapaUf = useMemo(() => {
    return Array.from(mapaPorUf.values()).sort(
      (a, b) => b.liquido - a.liquido
    )
  }, [mapaPorUf])

  const maiorValorMapa = rankingMapaUf[0]?.liquido || 0
  const ufResumoSelecionado = ufMapaSelecionada
    ? mapaPorUf.get(ufMapaSelecionada) || null
    : rankingMapaUf[0] || null
  const ufResumoTooltip = mapaTooltip
    ? mapaPorUf.get(mapaTooltip.uf) || null
    : null

  const corMapaUf = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, Math.max(maiorValorMapa, 1)])
      .range(["#fee2e2", "#dc2626"])
      .clamp(true)
  }, [maiorValorMapa])

  const subperfisGDF = useMemo(() => {
    const mapa = new Map<string, PiTratado[]>()

    dadosFiltrados
      .filter((item) => item.area_classificada === "gdf")
      .forEach((item) => {
        const sub = item.sub_perfil_anunciante || "Sem subperfil"
        mapa.set(sub, [...(mapa.get(sub) || []), item])
      })

    return Array.from(mapa.entries())
      .map(([nome, itens]) => ({
        nome,
        slug: encodeURIComponent(nome),
        total: itens.reduce(
          (acc, item) => acc + Number(item.valor_liquido || 0),
          0
        ),
        pis: itens.length,
      }))
      .sort((a, b) => b.total - a.total)
  }, [dadosFiltrados])

  const filtrosAtivos = Boolean(
    busca || anoSelecionado || mesSelecionado || areaSelecionada
  )

  function limparFiltros() {
    setBusca("")
    setAnoSelecionado("")
    setMesSelecionado("")
    setAreaSelecionada("")
  }

  function alterarAno(value: string) {
    setAnoSelecionado(value)
    setMesSelecionado("")
  }

  function alternarAno(ano: string) {
    setAnoAberto((atual) => (atual === ano ? null : ano))
  }

  function abrirAno(ano: string) {
    navigate(`/ano/${ano}`)
  }

  function abrirMes(mes: string) {
    navigate(`/admin/mes/${mes.replace("/", "-")}`)
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden space-y-5 bg-zinc-100 text-zinc-950">
      <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] bg-zinc-950 shadow-sm md:rounded-[2rem]">
        <div className="relative isolate min-w-0 p-4 text-white sm:p-6 lg:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_430px] xl:items-end">
            <div className="min-w-0">
              <span className="inline-flex max-w-full rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-100 sm:text-xs sm:tracking-[0.18em]">
                Painel administrativo
              </span>

              <h1 className="mt-4 max-w-full break-words text-2xl font-black tracking-tight sm:text-3xl md:text-5xl">
                Visão geral comercial
              </h1>

              <p className="mt-3 max-w-full break-words text-sm leading-6 text-zinc-300 md:text-base">
                Olá, {user?.nome || "Admin"}. Acompanhe faturamento, áreas,
                anunciantes, agências e indicadores comerciais em um só lugar.
              </p>

              <div className="mt-5 flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/busca-pi")}
                  className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 sm:w-auto"
                >
                  Abrir busca de PI
                </button>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white p-4 text-zinc-950 shadow-xl sm:p-5 md:rounded-[1.7rem]">
              <span className="text-sm font-bold text-zinc-500">
                Total líquido desde 2022
              </span>

              <strong className="mt-2 block max-w-full break-words text-xl font-black leading-tight sm:text-2xl md:text-3xl">
                {money(totalLiquidoDesde2022)}
              </strong>

              <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <MiniStat label="PIs filtrados" value={String(totalPIs)} />
                <MiniStat label="Ticket médio" value={money(ticketMedio)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[2rem]">
        <div className="mb-4 flex min-w-0 flex-col justify-between gap-2 md:flex-row md:items-end">
          <div className="min-w-0">
            <h2 className="text-lg font-black">Filtros do painel</h2>
            <p className="break-words text-sm text-zinc-500">
              Refine a visão por ano, mês, área comercial ou busca livre.
            </p>
          </div>

          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="w-full rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 sm:w-fit"
            >
              Limpar filtros ativos
            </button>
          )}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[150px_170px_230px_1fr_auto]">
          <select
            value={anoSelecionado}
            onChange={(event) => alterarAno(event.target.value)}
            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todos os anos</option>

            {anos.map((ano) => (
              <option value={ano} key={ano}>
                {ano}
              </option>
            ))}
          </select>

          <select
            value={mesSelecionado}
            onChange={(event) => setMesSelecionado(event.target.value)}
            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todos os meses</option>

            {mesesDisponiveis.map((mes) => (
              <option value={mes} key={mes}>
                {nomeMes(mes)}
              </option>
            ))}
          </select>

          <select
            value={areaSelecionada}
            onChange={(event) =>
              setAreaSelecionada(event.target.value as AreaTipo | "")
            }
            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todas as áreas</option>
            <option value="privado">Comercial Privado</option>
            <option value="gestao-executiva">Gestão Executiva</option>
            <option value="estadual">Comercial Estadual</option>
            <option value="federal">Comercial Federal</option>
            <option value="gdf">GDF / CLDF</option>
          </select>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 sm:col-span-2 xl:col-span-1"
            placeholder="Buscar executivo, PI, anunciante, agência, campanha, canal..."
          />

          <button
            type="button"
            onClick={limparFiltros}
            className="h-12 w-full rounded-2xl border border-zinc-200 px-5 text-sm font-black text-zinc-700 transition hover:border-red-500 hover:bg-red-50 hover:text-red-700 sm:col-span-2 xl:col-span-1"
          >
            Limpar
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingDashboard />
      ) : (
        <>
          <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total bruto"
              value={money(totalBrutoDesde2022)}
              helper="A partir de 2022"
              variant="dark"
              compact
            />

            <KpiCard
              label="Total líquido"
              value={money(totalLiquidoDesde2022)}
              helper="A partir de 2022"
              variant="red"
              compact
            />

            <KpiCard
              label="Total de PIs"
              value={String(totalPIs)}
              helper="Registros encontrados"
            />

            <KpiCard
              label="Ticket médio"
              value={money(ticketMedio)}
              helper="Média por PI desde 2022"
              compact
            />
          </section>

          <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ActionCard
              label="Anunciantes"
              title={String(totalAnunciantes)}
              helper="Clique para ver todos"
              onClick={() => navigate("/admin/anunciantes")}
            />

            <ActionCard
              label="Agências"
              title={String(totalAgencias)}
              helper="Clique para ver todas"
              onClick={() => navigate("/admin/agencias")}
            />

            <ActionCard
              label="Busca de PI"
              title="Abrir consulta"
              helper="Pesquisar registros"
              onClick={() => navigate("/busca-pi")}
            />

            <ActionCard
              label="Mapa do Brasil"
              title="Abrir mapa"
              helper="Investimentos por UF"
              onClick={() => navigate("/mapa-brasil")}
            />
          </section>

          <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:rounded-[2rem]">
            <div className="flex min-w-0 flex-col gap-4 border-b border-zinc-200 p-4 sm:p-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-black">Mapa do Brasil</h2>
                <p className="mt-1 break-words text-sm text-zinc-500">
                  Concentração geográfica do valor líquido no filtro atual.
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex rounded-2xl bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBaseMapaDashboard("cliente")
                      setUfMapaSelecionada("")
                    }}
                    className={`h-10 flex-1 rounded-xl px-4 text-xs font-black transition sm:flex-none ${
                      baseMapaDashboard === "cliente"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-white"
                    }`}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBaseMapaDashboard("agencia")
                      setUfMapaSelecionada("")
                    }}
                    className={`h-10 flex-1 rounded-xl px-4 text-xs font-black transition sm:flex-none ${
                      baseMapaDashboard === "agencia"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-white"
                    }`}
                  >
                    Agência
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/mapa-brasil")}
                  className="h-10 rounded-2xl bg-zinc-950 px-4 text-xs font-black text-white transition hover:bg-red-700"
                >
                  Abrir completo
                </button>
              </div>
            </div>

            <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="relative min-h-[520px] bg-zinc-50 p-3 sm:p-5">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    center: [-54, -15],
                    scale: 760,
                  }}
                  className="h-[500px] w-full"
                >
                  <Geographies geography={MAPA_BRASIL_GEO_URL}>
                    {({ geographies }: { geographies: GeographyItem[] }) =>
                      geographies.map((geo) => {
                        const uf = getUfFromGeography(geo.properties)
                        const resumo = mapaPorUf.get(uf)
                        const selecionado = ufMapaSelecionada === uf

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={(event) => {
                              setMapaTooltip({
                                uf,
                                x: event.clientX,
                                y: event.clientY,
                              })
                            }}
                            onMouseMove={(event) => {
                              setMapaTooltip((atual) =>
                                atual
                                  ? {
                                      ...atual,
                                      x: event.clientX,
                                      y: event.clientY,
                                    }
                                  : null
                              )
                            }}
                            onMouseLeave={() => setMapaTooltip(null)}
                            onClick={() => setUfMapaSelecionada(uf)}
                            style={{
                              default: {
                                fill: resumo
                                  ? corMapaUf(resumo.liquido)
                                  : "#f4f4f5",
                                stroke: selecionado ? "#18181b" : "#ffffff",
                                strokeWidth: selecionado ? 1.6 : 0.7,
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

                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-sm sm:left-auto sm:w-72">
                  <span className="text-xs font-black text-zinc-500">Menor</span>
                  <div className="h-3 flex-1 rounded-full bg-gradient-to-r from-red-100 to-red-600" />
                  <span className="text-xs font-black text-zinc-500">Maior</span>
                </div>
              </div>

              <aside className="border-t border-zinc-200 p-4 sm:p-5 xl:border-l xl:border-t-0">
                <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-red-700">
                        {ufMapaSelecionada ? "Selecionada" : "Maior UF"}
                      </span>
                      <strong className="block text-lg font-black text-zinc-950">
                        {ufResumoSelecionado?.uf || "--"}
                      </strong>
                    </div>
                    <b className="max-w-[160px] break-words text-right text-xs text-zinc-950">
                      {money(ufResumoSelecionado?.liquido || 0)}
                    </b>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-zinc-950">Top UFs</h3>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black text-zinc-500">
                      Top {Math.min(rankingMapaUf.length, 6)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {rankingMapaUf.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-sm font-semibold text-zinc-500">
                        Nenhuma UF encontrada.
                      </div>
                    ) : (
                      rankingMapaUf.slice(0, 6).map((item, index) => (
                        <button
                          type="button"
                          key={item.uf}
                          onClick={() => setUfMapaSelecionada(item.uf)}
                          className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                            ufMapaSelecionada === item.uf
                              ? "border-red-300 bg-red-50"
                              : "border-zinc-100 hover:border-red-200 hover:bg-red-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-black text-red-600">
                              #{index + 1}
                            </span>
                            <strong className="block text-sm font-black text-zinc-950">
                              {item.uf}
                            </strong>
                          </div>
                          <div className="min-w-0 text-right">
                            <b className="block max-w-[150px] break-words text-xs text-zinc-950">
                              {money(item.liquido)}
                            </b>
                            <small className="text-zinc-400">{item.pis} PIs</small>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>

            {mapaTooltip && (
              <div
                className="pointer-events-none fixed z-50 w-56 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-xl"
                style={{
                  left: Math.min(mapaTooltip.x + 14, window.innerWidth - 240),
                  top: Math.max(mapaTooltip.y - 28, 12),
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400">
                      Estado
                    </span>
                    <strong className="block text-xl font-black text-zinc-950">
                      {mapaTooltip.uf || "--"}
                    </strong>
                  </div>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">
                    {baseMapaDashboard === "cliente" ? "Cliente" : "Agência"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs font-semibold text-zinc-600">
                  <div className="flex justify-between gap-3">
                    <span>Líquido</span>
                    <b className="text-right text-zinc-950">
                      {money(ufResumoTooltip?.liquido || 0)}
                    </b>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Bruto</span>
                    <b className="text-right text-zinc-950">
                      {money(ufResumoTooltip?.bruto || 0)}
                    </b>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>PIs</span>
                    <b className="text-zinc-950">
                      {ufResumoTooltip?.pis || 0}
                    </b>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[2rem]">
            <div className="mb-5 flex min-w-0 flex-col justify-between gap-2 md:flex-row md:items-end">
              <div className="min-w-0">
                <h2 className="text-xl font-black">Áreas comerciais</h2>
                <p className="mt-1 break-words text-sm text-zinc-500">
                  Clique em uma área para abrir a tela detalhada.
                </p>
              </div>

              <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                {areas.length} áreas
              </span>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {areas.map((item) => (
                <button
                  type="button"
                  key={item.area}
                  onClick={() => navigate(`/admin/area/${item.area}`)}
                  className="group min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-red-300 hover:bg-white hover:shadow-md sm:p-5"
                >
                  <span className="block break-words text-sm font-black text-zinc-600 group-hover:text-red-700">
                    {item.nome}
                  </span>

                  <strong className="mt-2 block max-w-full break-words text-base font-black text-zinc-950 sm:text-lg">
                    {money(item.total)}
                  </strong>

                  <small className="mt-1 block text-zinc-400">
                    {item.pis} PIs • {item.percentual.toFixed(1)}%
                  </small>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-red-600"
                      style={{ width: `${Math.min(item.percentual, 100)}%` }}
                    />
                  </div>

                  <div className="mt-4 space-y-1 text-xs font-bold text-zinc-500">
                    <div className="break-words">Bruto: {money(item.bruto)}</div>
                    <div className="break-words">Ticket: {money(item.ticket)}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[2rem]">
            <div className="mb-5 flex min-w-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-black">Faturamento por ano</h2>

                <p className="mt-1 break-words text-sm text-zinc-500">
                  Clique em um ano para visualizar os meses consolidados.
                </p>
              </div>

              <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                {faturamentoPorAno.length} anos
              </span>
            </div>

            {faturamentoPorAno.length === 0 ? (
              <EmptyState text="Nenhum faturamento encontrado para os filtros selecionados." />
            ) : (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
                        className="w-full min-w-0 text-left"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block break-words text-xl font-black text-zinc-950">
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

                            <strong className="mt-1 block max-w-full break-words text-sm font-black leading-tight text-zinc-950">
                              {money(ano.liquido)}
                            </strong>
                          </div>

                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                              Bruto
                            </span>

                            <strong className="mt-1 block max-w-full break-words text-xs font-black leading-tight text-zinc-700">
                              {money(ano.bruto)}
                            </strong>
                          </div>
                        </div>
                      </button>

                      {aberto && (
                        <div className="mt-4 border-t border-zinc-200 pt-4">
                          <button
                            type="button"
                            onClick={() => abrirAno(ano.ano)}
                            className="mb-3 w-full rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white transition hover:bg-red-700"
                          >
                            Ver ano inteiro
                          </button>

                          <div className="space-y-2">
                            {ano.meses
                              .sort((a, b) => a.mesNumero - b.mesNumero)
                              .map((mes) => (
                                <button
                                  key={mes.mes}
                                  type="button"
                                  onClick={() => abrirMes(mes.mes)}
                                  className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-red-300 hover:bg-red-50"
                                >
                                  <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <strong className="block break-words text-sm font-black text-zinc-950">
                                        {mes.mes}
                                      </strong>

                                      <small className="text-zinc-500">
                                        {mes.pis} PIs
                                      </small>
                                    </div>

                                    <div className="min-w-0 text-right">
                                      <b className="block max-w-[120px] break-words text-[10px] font-black leading-tight text-zinc-950">
                                        {money(mes.liquido)}
                                      </b>

                                      <small className="mt-1 block max-w-[120px] break-words text-[9px] leading-tight text-zinc-400">
                                        Bruto: {money(mes.bruto)}
                                      </small>
                                    </div>
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

          <section className="grid min-w-0 gap-6 xl:grid-cols-2">
            <RankingCard
              title="Top anunciantes"
              items={topAnunciantes}
              action={{
                label: "Ver por mês",
                onClick: () => navigate("/admin/top-anunciantes-mes"),
              }}
            />
            <RankingCard
              title="Top agências"
              items={topAgencias}
              action={{
                label: "Ver por mês",
                onClick: () => navigate("/admin/top-agencias-mes"),
              }}
            />
          </section>

          {subperfisGDF.length > 0 && (
            <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[2rem]">
              <div className="mb-5 min-w-0">
                <h2 className="text-xl font-black">Subperfis GDF / CLDF</h2>
                <p className="mt-1 break-words text-sm text-zinc-500">
                  Abra uma visão separada por órgão ou subperfil.
                </p>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {subperfisGDF.map((item) => (
                  <button
                    type="button"
                    className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-red-300 hover:bg-white hover:shadow-md sm:p-5"
                    key={item.nome}
                    onClick={() => navigate(`/admin/subperfil/${item.slug}`)}
                  >
                    <span className="block break-words text-sm font-black text-zinc-600">
                      {item.nome}
                    </span>

                    <strong className="mt-2 block max-w-full break-words text-lg font-black sm:text-xl">
                      {money(item.total)}
                    </strong>

                    <small className="text-zinc-400">
                      {item.pis} PIs
                    </small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-zinc-100 p-3">
      <span className="block text-xs font-bold text-zinc-500">{label}</span>
      <strong className="mt-1 block max-w-full break-words text-sm font-black text-zinc-950">
        {value}
      </strong>
    </div>
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
    <div className={`min-w-0 overflow-hidden rounded-[1.5rem] border p-4 shadow-sm sm:p-5 ${classes[variant]}`}>
      <span className={`block text-sm font-bold ${labelClasses[variant]}`}>
        {label}
      </span>

      <strong
        className={`mt-2 block max-w-full break-words font-black leading-tight ${
          compact ? "text-lg sm:text-xl md:text-2xl" : "text-xl sm:text-2xl md:text-3xl"
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
      className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-red-300 hover:shadow-md sm:p-5"
    >
      <span className="block text-sm font-bold text-zinc-500">{label}</span>

      <strong className="mt-2 block break-words text-lg font-black text-zinc-950 sm:text-xl">
        {title}
      </strong>

      <small className="text-zinc-400">{helper}</small>
    </button>
  )
}

function RankingCard({
  title,
  items,
  action,
}: {
  title: string
  items: RankingItem[]
  action?: {
    label: string
    onClick: () => void
  }
}) {
  const maior = items[0]?.total || 1

  return (
    <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:rounded-[2rem]">
      <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 break-words text-sm text-zinc-500">
            Ordenado por valor líquido.
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white transition hover:bg-red-700"
            >
              {action.label}
            </button>
          )}

          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
            Top {items.length}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <EmptyState text="Nenhum dado encontrado." />
        ) : (
          items.map((item, index) => {
            const percent = Math.max((item.total / maior) * 100, 4)

            return (
              <div
                key={`${item.nome}-${index}`}
                className="min-w-0 rounded-2xl border border-transparent p-2 transition hover:border-zinc-100 hover:bg-zinc-50"
              >
                <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-red-600">
                      #{index + 1}
                    </span>

                    <strong className="block break-words text-sm text-zinc-950">
                      {item.nome}
                    </strong>

                    <small className="text-zinc-400">
                      {item.pis} PIs
                    </small>
                  </div>

                  <b className="max-w-[130px] shrink-0 break-words text-right text-xs text-zinc-950 sm:text-sm">
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
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
