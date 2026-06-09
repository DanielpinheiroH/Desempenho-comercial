import { Fragment, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, getToken, getUser } from "../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
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

type Visualizacao = "clientes" | "agencias"
type Ordenacao = "novo" | "velho"

type CarteiraItem = {
  nome: string
  quantidade: number
  valorLiquido: number
  ultimoMes: string
  ordem: number
}

const MESES = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Fev" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Abr" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Ago" },
  { value: "09", label: "Set" },
  { value: "10", label: "Out" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dez" },
]

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

function usuarioVeGrupoEstadual(user: any) {
  const grupos = Array.isArray(user?.grupos)
    ? user.grupos.map((grupo: string) => normalizar(grupo))
    : []

  return user?.role === "grupo" && grupos.includes("estadual")
}

function getMesAno(value?: string) {
  const [mes, ano] = String(value || "").split("/")
  return { mes, ano }
}

function mesParaOrdem(value?: string) {
  const { mes, ano } = getMesAno(value)
  return Number(`${ano || "0"}${mes || "0"}`)
}

function isAgenciaValida(value?: string | null) {
  const texto = normalizar(value)

  return Boolean(
    texto &&
      texto !== "direto" &&
      texto !== "direta" &&
      texto !== "sem agencia" &&
      texto !== "sem agência" &&
      texto !== "nao informado" &&
      texto !== "não informado"
  )
}

function labelCampo(key: string) {
  const labels: Record<string, string> = {
    numero_pi: "PI",
    executivo: "Executivo",
    anunciante: "Anunciante",
    agencia: "Agência",
    grupo: "Grupo",
    perfil_anunciante: "Perfil do anunciante",
    sub_perfil_anunciante: "Subperfil do anunciante",
    campanha: "Campanha",
    produto: "Produto",
    canal: "Canal",
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

function gerarLista(
  dados: Pi[],
  campo: "anunciante" | "agencia",
  ignorarDireto = false,
  ordenacao: Ordenacao
): CarteiraItem[] {
  const mapa = new Map<string, CarteiraItem>()

  dados.forEach((item) => {
    const nome = String(item[campo] || "").trim()

    if (!nome) return
    if (ignorarDireto && !isAgenciaValida(nome)) return

    const ordemItem = mesParaOrdem(item.mes_venda)
    const atual = mapa.get(nome)

    if (!atual) {
      mapa.set(nome, {
        nome,
        quantidade: 1,
        valorLiquido: Number(item.valor_liquido || 0),
        ultimoMes: item.mes_venda || "-",
        ordem: ordemItem,
      })
      return
    }

    const novoEhMaisRecente = ordemItem > atual.ordem

    mapa.set(nome, {
      ...atual,
      quantidade: atual.quantidade + 1,
      valorLiquido: atual.valorLiquido + Number(item.valor_liquido || 0),
      ultimoMes: novoEhMaisRecente ? item.mes_venda : atual.ultimoMes,
      ordem: novoEhMaisRecente ? ordemItem : atual.ordem,
    })
  })

  return Array.from(mapa.values()).sort((a, b) =>
    ordenacao === "novo" ? b.ordem - a.ordem : a.ordem - b.ordem
  )
}

function gerarTop(
  dados: Pi[],
  campo: "anunciante" | "agencia",
  ignorarDireto = false
) {
  const mapa = new Map<string, number>()

  dados.forEach((item) => {
    const nome = String(item[campo] || "").trim()

    if (!nome) return
    if (ignorarDireto && !isAgenciaValida(nome)) return

    mapa.set(nome, (mapa.get(nome) || 0) + Number(item.valor_liquido || 0))
  })

  return Array.from(mapa.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
}

function TopCard({
  title,
  items,
}: {
  title: string
  items: { nome: string; total: number }[]
}) {
  const maior = Math.max(...items.map((item) => item.total), 1)

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-black text-zinc-950">{title}</h2>
        <span className="text-xs font-bold text-zinc-400">Top 8</span>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-500">
            Nenhum dado encontrado.
          </div>
        ) : (
          items.map((item, index) => {
            const percent = Math.max((item.total / maior) * 100, 5)

            return (
              <div key={`${item.nome}-${index}`}>
                <div className="mb-2 flex justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-zinc-400">
                      #{index + 1}
                    </span>

                    <strong className="block truncate text-sm text-zinc-800">
                      {item.nome}
                    </strong>
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

export default function ExecutivoCarteira() {
  const navigate = useNavigate()
  const user = getUser()
  const executivoAtual = user?.executivo || user?.nome || ""
  const visaoGrupoEstadual = usuarioVeGrupoEstadual(user)

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([])
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("clientes")
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("novo")
  const [itemAberto, setItemAberto] = useState<string | null>(null)
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)

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

  const dadosEscopo = useMemo(() => {
    if (visaoGrupoEstadual) return dados

    const executivoNorm = normalizar(executivoAtual)

    return dados.filter(
      (item) => normalizar(item.executivo) === executivoNorm
    )
  }, [dados, executivoAtual, visaoGrupoEstadual])

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosEscopo
          .map((item) => getMesAno(item.mes_venda).ano)
          .filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosEscopo])

  function toggleMes(mes: string) {
    setMesesSelecionados((atual) =>
      atual.includes(mes)
        ? atual.filter((m) => m !== mes)
        : [...atual, mes]
    )
  }

  function limparFiltros() {
    setBusca("")
    setAnoSelecionado("")
    setMesesSelecionados([])
    setItemAberto(null)
    setPiSelecionado(null)
  }

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    return dadosEscopo.filter((item) => {
      const { mes, ano } = getMesAno(item.mes_venda)

      const bateAno = !anoSelecionado || ano === anoSelecionado

      const bateMes =
        mesesSelecionados.length === 0 || mesesSelecionados.includes(mes)

      const textoBusca = normalizar(
        [
          item.anunciante,
          item.agencia,
          item.grupo,
          item.perfil_anunciante,
          item.sub_perfil_anunciante,
          item.numero_pi,
          item.campanha,
          item.produto,
          item.canal,
        ].join(" ")
      )

      const bateBusca = !termo || textoBusca.includes(termo)

      return bateAno && bateMes && bateBusca
    })
  }, [dadosEscopo, busca, anoSelecionado, mesesSelecionados])

  const clientes = useMemo(
    () => gerarLista(dadosFiltrados, "anunciante", false, ordenacao),
    [dadosFiltrados, ordenacao]
  )

  const agencias = useMemo(
    () => gerarLista(dadosFiltrados, "agencia", true, ordenacao),
    [dadosFiltrados, ordenacao]
  )

  const topClientes = useMemo(
    () => gerarTop(dadosFiltrados, "anunciante"),
    [dadosFiltrados]
  )

  const topAgencias = useMemo(
    () => gerarTop(dadosFiltrados, "agencia", true),
    [dadosFiltrados]
  )

  const listaAtual = visualizacao === "clientes" ? clientes : agencias

  const filtrosAtivos =
    busca || anoSelecionado || mesesSelecionados.length > 0

  function alternarItem(nome: string) {
    setItemAberto((atual) => (atual === nome ? null : nome))
  }

  function pisDoItem(nome: string) {
    return dadosFiltrados
      .filter((item) => {
        if (visualizacao === "clientes") {
          return item.anunciante === nome
        }

        return item.agencia === nome
      })
      .sort((a, b) => mesParaOrdem(b.mes_venda) - mesParaOrdem(a.mes_venda))
  }

  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
        >
          ← Voltar
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <span className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
              {visaoGrupoEstadual
                ? "Gestão Executiva + Governo Estadual / GDF"
                : "Clientes e agências"}
            </span>

            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Olá, {user?.nome || "Executivo"}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              {visaoGrupoEstadual
                ? "Visualize a carteira completa de Gestão Executiva, Governo Estadual e GDF por clientes e agências, sem Governo Federal e Comercial Privado."
                : "Visualize sua carteira completa por clientes e agências. Clique em um cliente ou agência para ver todos os PIs vinculados."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <span className="text-sm font-medium text-zinc-500">
                Clientes
              </span>
              <strong className="mt-2 block text-4xl font-black">
                {clientes.length}
              </strong>
              <small className="text-zinc-400">únicos</small>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <span className="text-sm font-medium text-zinc-500">
                Agências
              </span>
              <strong className="mt-2 block text-4xl font-black">
                {agencias.length}
              </strong>
              <small className="text-zinc-400">sem direto</small>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-red-500"
            value={anoSelecionado}
            onChange={(event) => {
              setAnoSelecionado(event.target.value)
              setItemAberto(null)
              setPiSelecionado(null)
            }}
          >
            <option value="">Todos os anos</option>

            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>

          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
            placeholder="Pesquisar cliente, agência, PI ou campanha..."
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value)
              setItemAberto(null)
              setPiSelecionado(null)
            }}
          />

          <button
            type="button"
            onClick={limparFiltros}
            disabled={!filtrosAtivos}
            className="h-11 rounded-xl border border-zinc-200 px-5 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {MESES.map((mes) => {
            const ativo = mesesSelecionados.includes(mes.value)

            return (
              <button
                key={mes.value}
                type="button"
                className={
                  ativo
                    ? "rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
                    : "rounded-full bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200"
                }
                onClick={() => {
                  toggleMes(mes.value)
                  setItemAberto(null)
                  setPiSelecionado(null)
                }}
              >
                {mes.label}
              </button>
            )
          })}
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Carregando dados da carteira...
        </div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <TopCard title="Top anunciantes" items={topClientes} />
            <TopCard title="Top agências" items={topAgencias} />
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black">Visualização completa</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Clique em um registro para abrir todos os PIs vinculados. Na
                  lista de PIs, clique no PI para ver os detalhes.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex rounded-2xl bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVisualizacao("clientes")
                      setItemAberto(null)
                      setPiSelecionado(null)
                    }}
                    className={
                      visualizacao === "clientes"
                        ? "rounded-xl bg-white px-5 py-2 text-sm font-bold text-red-600 shadow-sm"
                        : "rounded-xl px-5 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-900"
                    }
                  >
                    Clientes
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVisualizacao("agencias")
                      setItemAberto(null)
                      setPiSelecionado(null)
                    }}
                    className={
                      visualizacao === "agencias"
                        ? "rounded-xl bg-white px-5 py-2 text-sm font-bold text-red-600 shadow-sm"
                        : "rounded-xl px-5 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-900"
                    }
                  >
                    Agências
                  </button>
                </div>

                <div className="flex rounded-2xl bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setOrdenacao("novo")}
                    className={
                      ordenacao === "novo"
                        ? "rounded-xl bg-white px-5 py-2 text-sm font-bold text-red-600 shadow-sm"
                        : "rounded-xl px-5 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-900"
                    }
                  >
                    Mais novo
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrdenacao("velho")}
                    className={
                      ordenacao === "velho"
                        ? "rounded-xl bg-white px-5 py-2 text-sm font-bold text-red-600 shadow-sm"
                        : "rounded-xl px-5 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-900"
                    }
                  >
                    Mais velho
                  </button>
                </div>
              </div>
            </div>

            {listaAtual.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
                <strong>Nenhum registro encontrado</strong>
                <p className="mt-2 text-sm text-zinc-500">
                  Tente limpar os filtros ou pesquisar por outro termo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-400">
                      <th className="px-3 py-3">
                        {visualizacao === "clientes" ? "Cliente" : "Agência"}
                      </th>
                      <th className="whitespace-nowrap px-3 py-3">Reg.</th>
                      <th className="whitespace-nowrap px-3 py-3">Último</th>
                      <th className="whitespace-nowrap px-3 py-3 text-right">
                        Valor
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {listaAtual.map((item, index) => {
                      const aberto = itemAberto === item.nome
                      const pis = pisDoItem(item.nome)

                      return (
                        <Fragment key={`${item.nome}-${index}`}>
                          <tr
                            className={
                              aberto
                                ? "cursor-pointer bg-red-50 text-sm"
                                : "cursor-pointer text-sm transition hover:bg-zinc-50"
                            }
                            onClick={() => alternarItem(item.nome)}
                          >
                            <td className="px-3 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={
                                    aberto
                                      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white"
                                      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-black text-red-600"
                                  }
                                >
                                  {index + 1}
                                </div>

                                <div className="min-w-0">
                                  <strong className="block truncate">
                                    {item.nome}
                                  </strong>

                                  <span className="text-xs text-zinc-400">
                                    {aberto
                                      ? "Clique para fechar"
                                      : "Clique para ver os PIs"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-3 py-4 text-zinc-600">
                              {item.quantidade}
                            </td>

                            <td className="whitespace-nowrap px-3 py-4 text-zinc-600">
                              {item.ultimoMes || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-4 text-right font-black">
                              {money(item.valorLiquido)}
                            </td>
                          </tr>

                          {aberto && (
                            <tr>
                              <td colSpan={4} className="bg-zinc-50 px-3 py-4">
                                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                  <div>
                                    <strong className="text-sm text-zinc-950">
                                      PIs vinculados a {item.nome}
                                    </strong>

                                    <p className="text-xs text-zinc-500">
                                      {pis.length} registros encontrados.
                                    </p>
                                  </div>

                                  <span className="text-xs font-bold text-zinc-500">
                                    Total: {money(item.valorLiquido)}
                                  </span>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                                  <table className="w-full min-w-[720px] border-collapse">
                                    <thead>
                                      <tr className="border-b border-zinc-200 bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                                        <th className="px-3 py-2">PI</th>
                                        <th className="px-3 py-2">Mês</th>
                                        <th className="px-3 py-2">
                                          Anunciante
                                        </th>
                                        <th className="px-3 py-2">Agência</th>
                                        <th className="px-3 py-2">Campanha</th>
                                        <th className="px-3 py-2">Grupo</th>
                                        <th className="px-3 py-2 text-right">
                                          Valor
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody className="divide-y divide-zinc-100">
                                      {pis.map((pi, piIndex) => (
                                        <tr
                                          key={`${pi.numero_pi}-${pi.mes_venda}-${piIndex}`}
                                          className="cursor-pointer text-[13px] transition hover:bg-red-50"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            setPiSelecionado(pi)
                                          }}
                                        >
                                          <td className="whitespace-nowrap px-3 py-2 font-black text-red-600">
                                            {pi.numero_pi || "-"}
                                          </td>

                                          <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                                            {pi.mes_venda || "-"}
                                          </td>

                                          <td className="max-w-[180px] truncate px-3 py-2 font-medium text-zinc-700">
                                            {pi.anunciante || "-"}
                                          </td>

                                          <td className="max-w-[150px] truncate px-3 py-2 text-zinc-600">
                                            {pi.agencia || "-"}
                                          </td>

                                          <td className="max-w-[240px] truncate px-3 py-2 text-zinc-600">
                                            {pi.campanha || "-"}
                                          </td>

                                          <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                                            {pi.grupo || "-"}
                                          </td>

                                          <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-zinc-950">
                                            {money(pi.valor_liquido)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
            onClick={(event) => event.stopPropagation()}
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
                  {piSelecionado.mes_venda || "-"}
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
                    {money(piSelecionado.valor_liquido)}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Valor bruto
                  </span>

                  <strong className="mt-2 block text-xl font-black text-zinc-950">
                    {money(piSelecionado.valor_bruto)}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Mês
                  </span>

                  <strong className="mt-2 block text-xl font-black text-zinc-950">
                    {piSelecionado.mes_venda || "-"}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Executivo
                  </span>

                  <strong className="mt-2 block text-sm font-black text-zinc-950">
                    {piSelecionado.executivo || "-"}
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
