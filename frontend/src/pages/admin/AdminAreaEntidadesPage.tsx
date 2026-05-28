import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { getPisCached } from "../../services/api"

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
  grupo: string
  campanha?: string
  agencia: string
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

type AreaTipo =
  | "privado"
  | "gestao-executiva"
  | "estadual"
  | "federal"
  | "gdf"

type PiTratado = Pi & {
  area_classificada: AreaTipo
}

type EntidadeResumo = {
  nome: string
  total: number
  bruto: number
  pis: number
  itens: PiTratado[]
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

  return nomes[area] || "Área comercial"
}

function classificarArea(item: Pi): AreaTipo {
  const perfil = normalizar(item.perfil_anunciante)
  const sub = normalizar(item.sub_perfil_anunciante)
  const executivo = normalizar(item.executivo)
  const grupo = normalizar(item.grupo)

  if (grupo === "federal" || perfil.includes("federal") || sub.includes("federal")) {
    return "federal"
  }

  if (executivo.includes("gestao executiva") || sub.includes("gestao executiva")) {
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

export default function AdminAreaEntidadesPage() {
  const { area, tipo } = useParams()
  const navigate = useNavigate()

  const areaAtual = area as AreaTipo
  const tipoAtual = tipo === "agencias" ? "agencias" : "anunciantes"
  const campo = tipoAtual === "agencias" ? "agencia" : "anunciante"

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [entidadeAberta, setEntidadeAberta] = useState<string | null>(null)
  const [piSelecionado, setPiSelecionado] = useState<PiTratado | null>(null)

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

  const dadosDaArea = useMemo(() => {
    return dadosTratados.filter((item) => item.area_classificada === areaAtual)
  }, [dadosTratados, areaAtual])

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosDaArea
          .map((item) => getAno(item.mes_venda))
          .filter((ano) => ano && ano !== "Sem ano")
      )
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosDaArea])

  const mesesDisponiveis = useMemo(() => {
    const meses = dadosDaArea
      .filter((item) => !anoSelecionado || getAno(item.mes_venda) === anoSelecionado)
      .map((item) => getMesNumero(item.mes_venda))
      .filter((mes) => mes && mes !== "Sem mês")

    return Array.from(new Set(meses)).sort((a, b) => Number(a) - Number(b))
  }, [dadosDaArea, anoSelecionado])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    return dadosDaArea.filter((item) => {
      const bateAno = !anoSelecionado || getAno(item.mes_venda) === anoSelecionado
      const bateMes = !mesSelecionado || getMesNumero(item.mes_venda) === mesSelecionado

      if (tipoAtual === "agencias" && isAgenciaDireta(item.agencia)) {
        return false
      }

      const texto = normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.campanha,
          item.produto,
          item.canal,
          item.mes_venda,
        ].join(" ")
      )

      return bateAno && bateMes && (!termo || texto.includes(termo))
    })
  }, [dadosDaArea, busca, anoSelecionado, mesSelecionado, tipoAtual])

  const entidades = useMemo<EntidadeResumo[]>(() => {
    const mapa = new Map<string, EntidadeResumo>()

    dadosFiltrados.forEach((item) => {
      const nome = String(item[campo] || "").trim() || "Não informado"

      const atual = mapa.get(nome) || {
        nome,
        total: 0,
        bruto: 0,
        pis: 0,
        itens: [],
      }

      atual.total += Number(item.valor_liquido || 0)
      atual.bruto += Number(item.valor_bruto || 0)
      atual.pis += 1
      atual.itens.push(item)

      mapa.set(nome, atual)
    })

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total)
  }, [dadosFiltrados, campo])

  const totalLiquido = entidades.reduce((acc, item) => acc + item.total, 0)
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

  function selecionarPi(pi: PiTratado) {
    setPiSelecionado(pi)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 text-zinc-950">
      <section className="rounded-[2rem] bg-zinc-950 p-8 text-white">
        <button
          type="button"
          onClick={() => navigate(`/admin/area/${areaAtual}`)}
          className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
        >
          Voltar para área
        </button>

        <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
          {nomeArea(areaAtual)}
        </span>

        <h1 className="mt-4 text-3xl font-black md:text-5xl">
          {tipoAtual === "agencias" ? "Agências" : "Anunciantes"}
        </h1>

        <p className="mt-2 text-zinc-300">
          Visualização consolidada por {tipoAtual === "agencias" ? "agência" : "anunciante"}.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label={tipoAtual === "agencias" ? "Total de agências" : "Total de anunciantes"}
          value={String(entidades.length)}
        />

        <KpiCard label="Total líquido" value={money(totalLiquido)} />

        <KpiCard label="Total bruto" value={money(totalBruto)} />
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
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
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            placeholder="Buscar por nome, PI, executivo, campanha..."
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

      {piSelecionado && (
        <PiDetalhe pi={piSelecionado} onClose={() => setPiSelecionado(null)} />
      )}

      {loading ? (
        <LoadingDashboard />
      ) : (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black">
                Lista de {tipoAtual === "agencias" ? "agências" : "anunciantes"}
              </h2>

              <p className="text-sm text-zinc-500">
                Clique em uma linha para ver os PIs relacionados. Clique em um PI para ver os detalhes.
              </p>
            </div>

            <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
              {totalPIs} PIs
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
                    className="rounded-2xl border border-zinc-200 bg-zinc-50"
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
                          {money(item.total)}
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
                                  onClick={() => selecionarPi(pi)}
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <span className="text-sm font-bold text-zinc-500">{label}</span>

      <strong className="mt-2 block break-words text-2xl font-black">
        {value}
      </strong>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <span className="block text-xs font-black uppercase tracking-wide text-zinc-500">
        {label}
      </span>

      <strong className="mt-1 block break-words text-sm font-black text-zinc-950">
        {value || "-"}
      </strong>
    </div>
  )
}

function PiDetalhe({
  pi,
  onClose,
}: {
  pi: PiTratado
  onClose: () => void
}) {
  return (
    <section className="rounded-[2rem] border border-red-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
            PI selecionado
          </span>

          <h2 className="mt-3 text-3xl font-black text-zinc-950">
            PI {pi.numero_pi}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Informações completas do PI.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="PI Matriz" value={pi.pi_matriz} />
        <InfoCard label="Número PI" value={pi.numero_pi} />
        <InfoCard label="Executivo" value={pi.executivo} />
        <InfoCard label="Diretoria" value={pi.diretoria} />
        <InfoCard label="Grupo" value={pi.grupo} />

        <InfoCard label="Anunciante" value={pi.anunciante} />
        <InfoCard label="Razão Social Anunciante" value={pi.razao_social_anunciante} />
        <InfoCard label="Codinome" value={pi.codinome} />
        <InfoCard label="CNPJ Anunciante" value={pi.cnpj_anunciante} />
        <InfoCard label="UF Cliente" value={pi.uf_cliente} />

        <InfoCard label="Campanha" value={pi.campanha} />
        <InfoCard label="Agência" value={pi.agencia} />
        <InfoCard label="Razão Social Agência" value={pi.razao_social_agencia} />
        <InfoCard label="CNPJ Agência" value={pi.cnpj_agencia} />
        <InfoCard label="UF Agência" value={pi.uf_agencia} />

        <InfoCard label="Data Inicial Veiculação" value={pi.data_inicial_veiculacao} />
        <InfoCard label="Data Final Veiculação" value={pi.data_final_veiculacao} />
        <InfoCard label="Mês Venda" value={pi.mes_venda} />
        <InfoCard label="Mês Inicial Veiculação" value={pi.mes_inicial_veiculacao} />

        <InfoCard label="Canal" value={pi.canal} />
        <InfoCard label="Perfil Anunciante" value={pi.perfil_anunciante} />
        <InfoCard label="Sub Perfil Anunciante" value={pi.sub_perfil_anunciante} />
        <InfoCard label="Produto" value={pi.produto} />

        <InfoCard label="Valor Bruto" value={money(pi.valor_bruto)} />
        <InfoCard label="Valor Líquido" value={money(pi.valor_liquido)} />
        <InfoCard label="Vencimento" value={pi.vencimento} />
        <InfoCard label="Data Venda" value={pi.data_venda} />
        <InfoCard
          label="Data Emissão/Recebimento PI"
          value={pi.data_emissao_recebimento_pi}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
          Observações
        </span>

        <p className="mt-2 text-sm text-zinc-700">
          {pi.observacoes || "Sem observações"}
        </p>
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