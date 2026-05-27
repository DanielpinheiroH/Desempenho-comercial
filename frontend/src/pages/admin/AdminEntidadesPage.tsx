import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, getToken } from "../../services/api"

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

type Props = {
  tipo: "anunciantes" | "agencias"
}

type Entidade = {
  nome: string
  pis: number
  liquido: number
  bruto: number
  itens: Pi[]
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

export default function AdminEntidadesPage({ tipo }: Props) {
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [entidadeAberta, setEntidadeAberta] = useState<string | null>(null)

  const titulo = tipo === "agencias" ? "Agências" : "Anunciantes"
  const singular = tipo === "agencias" ? "agência" : "anunciante"
  const campo = tipo === "agencias" ? "agencia" : "anunciante"

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

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dados
          .map((item) => getAno(item.mes_venda))
          .filter((ano) => ano && ano !== "Sem ano")
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dados])

  const mesesDisponiveis = useMemo(() => {
    const meses = dados
      .filter((item) => !anoSelecionado || getAno(item.mes_venda) === anoSelecionado)
      .map((item) => getMesNumero(item.mes_venda))
      .filter((mes) => mes && mes !== "Sem mês")

    return Array.from(new Set(meses)).sort((a, b) => Number(a) - Number(b))
  }, [dados, anoSelecionado])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    return dados.filter((item) => {
      const bateAno = !anoSelecionado || getAno(item.mes_venda) === anoSelecionado
      const bateMes = !mesSelecionado || getMesNumero(item.mes_venda) === mesSelecionado

      if (tipo === "agencias" && isAgenciaDireta(item.agencia)) {
        return false
      }

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
        ].join(" ")
      )

      return bateAno && bateMes && (!termo || texto.includes(termo))
    })
  }, [dados, busca, anoSelecionado, mesSelecionado, tipo])

  const entidades = useMemo<Entidade[]>(() => {
    const mapa = new Map<string, Entidade>()

    dadosFiltrados.forEach((item) => {
      const nome = String(item[campo] || "").trim() || "Não informado"

      const atual = mapa.get(nome) || {
        nome,
        pis: 0,
        liquido: 0,
        bruto: 0,
        itens: [],
      }

      atual.pis += 1
      atual.liquido += Number(item.valor_liquido || 0)
      atual.bruto += Number(item.valor_bruto || 0)
      atual.itens.push(item)

      mapa.set(nome, atual)
    })

    return Array.from(mapa.values()).sort((a, b) => b.liquido - a.liquido)
  }, [dadosFiltrados, campo])

  const totalLiquido = entidades.reduce((acc, item) => acc + item.liquido, 0)
  const totalBruto = entidades.reduce((acc, item) => acc + item.bruto, 0)
  const totalPIs = dadosFiltrados.length

  function alterarAno(value: string) {
    setAnoSelecionado(value)
    setMesSelecionado("")
  }

  function limparFiltros() {
    setBusca("")
    setAnoSelecionado("")
    setMesSelecionado("")
  }

  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 p-5 text-zinc-950">
      <section className="overflow-hidden rounded-[2rem] bg-zinc-950 shadow-sm">
        <div className="relative isolate p-6 text-white md:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-6 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
          >
            Voltar
          </button>

          <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
            Visão geral
          </span>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            {titulo}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
            Visualização consolidada de {singular}s com quantidade de PIs,
            faturamento bruto e faturamento líquido.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label={`Total de ${titulo.toLowerCase()}`}
          value={String(entidades.length)}
          helper="Registros únicos"
        />

        <MetricCard
          label="Total de PIs"
          value={String(totalPIs)}
          helper="PIs encontrados"
        />

        <MetricCard
          label="Total líquido"
          value={money(totalLiquido)}
          helper="Valor líquido filtrado"
          variant="red"
        />

        <MetricCard
          label="Total bruto"
          value={money(totalBruto)}
          helper="Valor bruto filtrado"
          variant="dark"
        />
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black">Filtros</h2>
          <p className="text-sm text-zinc-500">
            Filtre por ano, mês ou busca livre.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-[160px_170px_1fr_auto]">
          <select
            value={anoSelecionado}
            onChange={(event) => alterarAno(event.target.value)}
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
            value={mesSelecionado}
            onChange={(event) => setMesSelecionado(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            <option value="">Todos os meses</option>

            {mesesDisponiveis.map((mes) => (
              <option value={mes} key={mes}>
                {nomeMes(mes)}
              </option>
            ))}
          </select>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            placeholder={`Buscar ${singular}, PI, executivo, campanha...`}
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
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black">Lista de {titulo.toLowerCase()}</h2>
              <p className="text-sm text-zinc-500">
                Clique em um item para visualizar os PIs relacionados.
              </p>
            </div>

            <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
              {entidades.length} registros
            </span>
          </div>

          <div className="space-y-3">
            {entidades.length === 0 ? (
              <EmptyState text="Nenhum dado encontrado." />
            ) : (
              entidades.map((item, index) => {
                const aberto = entidadeAberta === item.nome

                return (
                  <div
                    key={`${item.nome}-${index}`}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setEntidadeAberta((atual) =>
                          atual === item.nome ? null : item.nome
                        )
                      }
                      className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-red-50 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-black text-red-600">
                          #{index + 1}
                        </span>

                        <strong className="mt-1 block break-words text-base font-black text-zinc-950">
                          {item.nome}
                        </strong>

                        <small className="text-zinc-500">
                          {item.pis} PIs
                        </small>
                      </div>

                      <div className="text-left md:text-right">
                        <b className="block text-sm font-black text-zinc-950">
                          {money(item.liquido)}
                        </b>

                        <small className="text-xs text-zinc-500">
                          Bruto: {money(item.bruto)}
                        </small>
                      </div>
                    </button>

                    {aberto && (
                      <div className="border-t border-zinc-200 bg-white p-4">
                        <div className="overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                                <th className="px-4 py-3">PI</th>
                                <th className="px-4 py-3">Mês</th>
                                <th className="px-4 py-3">Executivo</th>
                                <th className="px-4 py-3">Anunciante</th>
                                <th className="px-4 py-3">Agência</th>
                                <th className="px-4 py-3 text-right">Líquido</th>
                                <th className="px-4 py-3 text-right">Bruto</th>
                              </tr>
                            </thead>

                            <tbody>
                              {item.itens.map((pi, piIndex) => (
                                <tr
                                  key={`${pi.numero_pi}-${piIndex}`}
                                  className="cursor-pointer border-b border-zinc-100 hover:bg-red-50"
                                  onClick={() =>
                                    navigate(`/admin/mes/${pi.mes_venda.replace("/", "-")}`)
                                  }
                                >
                                  <td className="px-4 py-3 font-black text-red-600">
                                    {pi.numero_pi}
                                  </td>

                                  <td className="px-4 py-3 text-zinc-500">
                                    {pi.mes_venda}
                                  </td>

                                  <td className="px-4 py-3 text-zinc-700">
                                    {pi.executivo || "-"}
                                  </td>

                                  <td className="px-4 py-3 text-zinc-700">
                                    {pi.anunciante || "-"}
                                  </td>

                                  <td className="px-4 py-3 text-zinc-700">
                                    {pi.agencia || "-"}
                                  </td>

                                  <td className="px-4 py-3 text-right font-black">
                                    {money(pi.valor_liquido)}
                                  </td>

                                  <td className="px-4 py-3 text-right font-black text-zinc-600">
                                    {money(pi.valor_bruto)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}
    </main>
  )
}

function MetricCard({
  label,
  value,
  helper,
  variant = "light",
}: {
  label: string
  value: string
  helper: string
  variant?: "light" | "dark" | "red"
}) {
  const classes = {
    light: "border-zinc-200 bg-white text-zinc-950",
    dark: "border-zinc-950 bg-zinc-950 text-white",
    red: "border-red-600 bg-red-600 text-white",
  }

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${classes[variant]}`}>
      <span className="text-sm font-bold opacity-80">{label}</span>

      <strong className="mt-2 block break-words text-2xl font-black leading-tight">
        {value}
      </strong>

      <small className="opacity-70">{helper}</small>
    </div>
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
      {Array.from({ length: 4 }).map((_, index) => (
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
