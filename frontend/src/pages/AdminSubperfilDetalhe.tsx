import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

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
  agencia?: string
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
  valor_bruto: number
  valor_liquido: number
  vencimento?: string
  data_venda?: string
  data_emissao_recebimento_pi?: string
  observacoes?: string
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

function agruparRanking(dados: Pi[], campo: keyof Pi, limite = 10) {
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

export default function AdminSubperfilDetalhe() {
  const { subperfil } = useParams()
  const navigate = useNavigate()

  const subperfilAtual = decodeURIComponent(subperfil || "")

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [diretoriaSelecionada, setDiretoriaSelecionada] = useState("")
  const [anoAberto, setAnoAberto] = useState<string | null>(null)

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

  const dadosDoSubperfil = useMemo(() => {
    const alvo = normalizar(subperfilAtual)

    return dados.filter(
      (item) => normalizar(item.sub_perfil_anunciante) === alvo
    )
  }, [dados, subperfilAtual])

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosDoSubperfil
          .map((item) => getAno(item.mes_venda))
          .filter((ano) => ano && ano !== "Sem ano")
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosDoSubperfil])

  const diretorias = useMemo(() => {
    return Array.from(
      new Set(
        dadosDoSubperfil
          .map((item) => item.diretoria)
          .filter(Boolean)
      )
    ).sort() as string[]
  }, [dadosDoSubperfil])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    return dadosDoSubperfil.filter((item) => {
      const bateAno = !anoSelecionado || getAno(item.mes_venda) === anoSelecionado

      const bateDiretoria =
        !diretoriaSelecionada || item.diretoria === diretoriaSelecionada

      const texto = normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.diretoria,
          item.anunciante,
          item.razao_social_anunciante,
          item.agencia,
          item.campanha,
          item.produto,
          item.canal,
          item.mes_venda,
        ].join(" ")
      )

      const bateBusca = !termo || texto.includes(termo)

      return bateAno && bateDiretoria && bateBusca
    })
  }, [dadosDoSubperfil, busca, anoSelecionado, diretoriaSelecionada])

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalPIs = dadosFiltrados.length
  const ticketMedio = totalPIs > 0 ? totalLiquido / totalPIs : 0

  const topExecutivos = useMemo(
    () => agruparRanking(dadosFiltrados, "executivo", 10),
    [dadosFiltrados]
  )

  const topAgencias = useMemo(
    () => agruparRanking(dadosFiltrados, "agencia", 10),
    [dadosFiltrados]
  )

  const faturamentoPorAno = useMemo<AnoResumo[]>(() => {
    const mapaMes = new Map<string, MesResumo>()

    dadosFiltrados.forEach((item) => {
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

  function limparFiltros() {
    setBusca("")
    setAnoSelecionado("")
    setDiretoriaSelecionada("")
  }

  function alternarAno(ano: string) {
    setAnoAberto((atual) => (atual === ano ? null : ano))
  }

  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 text-zinc-950">
      <section className="rounded-[2rem] bg-zinc-950 p-8 text-white">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
        >
          Voltar ao dashboard
        </button>

        <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
          Subperfil
        </span>

        <h1 className="mt-4 text-3xl font-black md:text-5xl">
          {subperfilAtual}
        </h1>

        <p className="mt-2 text-zinc-300">
          Visão consolidada do subperfil.
        </p>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[160px_240px_1fr_auto]">
          <select
            value={anoSelecionado}
            onChange={(event) => setAnoSelecionado(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todos os anos</option>

            {anos.map((ano) => (
              <option value={ano} key={ano}>
                {ano}
              </option>
            ))}
          </select>

          <select
            value={diretoriaSelecionada}
            onChange={(event) => setDiretoriaSelecionada(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todas as diretorias</option>

            {diretorias.map((diretoria) => (
              <option value={diretoria} key={diretoria}>
                {diretoria}
              </option>
            ))}
          </select>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            placeholder="Buscar PI, executivo, anunciante, agência, campanha..."
          />

          <button
            type="button"
            onClick={limparFiltros}
            className="h-12 rounded-2xl border border-zinc-200 px-5 text-sm font-black text-zinc-700 transition hover:border-red-500 hover:bg-red-50 hover:text-red-700"
          >
            Limpar
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingDashboard />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total bruto"
              value={money(totalBruto)}
              helper="Receita bruta filtrada"
              variant="dark"
              compact
            />

            <KpiCard
              label="Total líquido"
              value={money(totalLiquido)}
              helper="Receita líquida filtrada"
              variant="red"
              compact
            />

            <button
              type="button"
              onClick={() =>
                navigate(`/admin/subperfil/${encodeURIComponent(subperfilAtual)}/pis`)
              }
              className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
            >
              <span className="text-sm font-bold text-zinc-500">
                Total de PIs
              </span>

              <strong className="mt-2 block text-2xl font-black text-zinc-950">
                {totalPIs}
              </strong>

              <small className="text-zinc-400">
                Clique para ver todos
              </small>
            </button>

            <KpiCard
              label="Ticket médio"
              value={money(ticketMedio)}
              helper="Média por PI"
              compact
            />
          </section>

          <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black">Faturamento por ano</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Clique em um ano para visualizar os meses consolidados.
                </p>
              </div>

              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                {faturamentoPorAno.length} anos
              </span>
            </div>

            {faturamentoPorAno.length === 0 ? (
              <EmptyState text="Nenhum faturamento encontrado." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block text-xl font-black text-zinc-950">
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

                            <strong className="mt-1 block break-words text-[10px] font-black leading-tight text-zinc-950">
                              {money(ano.liquido)}
                            </strong>
                          </div>

                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                              Bruto
                            </span>

                            <strong className="mt-1 block break-words text-[10px] font-black leading-tight text-zinc-700">
                              {money(ano.bruto)}
                            </strong>
                          </div>
                        </div>
                      </button>

                      {aberto && (
                        <div className="mt-5 border-t border-zinc-200 pt-5">
                          <button
                            type="button"
                            onClick={() => navigate(`/ano/${ano.ano}`)}
                            className="mb-5 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                          >
                            Ver ano completo
                          </button>

                          <div className="space-y-3">
                            {ano.meses
                              .sort((a, b) => a.mesNumero - b.mesNumero)
                              .map((mes) => (
                                <button
                                  key={mes.mes}
                                  type="button"
                                  onClick={() =>
                                    navigate(`/admin/mes/${mes.mes.replace("/", "-")}`)
                                  }
                                  className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-red-300 hover:bg-red-50"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <strong className="block text-base font-black text-zinc-950">
                                        {mes.mes}
                                      </strong>

                                      <small className="mt-1 block text-sm text-zinc-500">
                                        {mes.pis} PIs
                                      </small>
                                    </div>

                                    <div className="min-w-0 max-w-[96px] text-center">
                                      <b className="block break-words text-[9px] font-black leading-tight text-zinc-950">
                                        {money(mes.liquido)}
                                      </b>

                                      <small className="mt-1 block break-words text-[8px] leading-tight text-zinc-400">
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

          <section className="grid gap-6 xl:grid-cols-2">
            <RankingCard title="Top executivos do subperfil" items={topExecutivos} />
            <RankingCard title="Top agências do subperfil" items={topAgencias} />
          </section>
        </>
      )}
    </main>
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

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${classes[variant]}`}>
      <span className="text-sm font-bold opacity-80">{label}</span>

      <strong
        className={`mt-2 block break-words font-black leading-tight ${
          compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
        }`}
      >
        {value}
      </strong>

      <small className="opacity-70">{helper}</small>
    </div>
  )
}

function RankingCard({ title, items }: { title: string; items: RankingItem[] }) {
  const maior = items[0]?.total || 1

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ordenado por valor líquido.
        </p>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <EmptyState text="Nenhum dado encontrado." />
        ) : (
          items.map((item, index) => {
            const percent = Math.max((item.total / maior) * 100, 4)

            return (
              <div key={`${item.nome}-${index}`}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-red-600">
                      #{index + 1}
                    </span>

                    <strong className="block truncate text-sm text-zinc-950">
                      {item.nome}
                    </strong>

                    <small className="text-zinc-400">{item.pis} PIs</small>
                  </div>

                  <b className="shrink-0 text-sm text-zinc-950">
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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