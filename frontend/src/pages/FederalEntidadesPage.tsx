import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { getPisCached } from "../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  mes_venda: string
  valor_bruto: number
  valor_liquido: number
}

type Props = {
  tipo?: "anunciantes" | "agencias"
}

type EntidadeTipo = "anunciantes" | "agencias"

type EntidadeResumo = {
  nome: string
  total: number
  bruto: number
  quantidade: number
  ultimoMes: string
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

function mesRef(mes?: string) {
  const [mm, yyyy] = String(mes || "").split("/")
  return Number(`${yyyy || "0"}${String(mm || "0").padStart(2, "0")}`)
}

function ordenarPorLancamento(a: Pi, b: Pi) {
  const dataA = mesRef(a.mes_venda)
  const dataB = mesRef(b.mes_venda)

  if (dataA !== dataB) return dataB - dataA

  return String(b.numero_pi || "").localeCompare(String(a.numero_pi || ""))
}

function agruparEntidades(
  dados: Pi[],
  campo: "anunciante" | "agencia"
): EntidadeResumo[] {
  const mapa = new Map<string, EntidadeResumo>()

  dados.forEach((item) => {
    if (campo === "agencia" && !isAgenciaValida(item.agencia)) return

    const nome = String(item[campo] || "").trim() || "Não informado"

    const atual = mapa.get(nome) || {
      nome,
      total: 0,
      bruto: 0,
      quantidade: 0,
      ultimoMes: "",
      itens: [],
    }

    atual.total += Number(item.valor_liquido || 0)
    atual.bruto += Number(item.valor_bruto || 0)
    atual.quantidade += 1
    atual.itens.push(item)
    atual.itens.sort(ordenarPorLancamento)
    atual.ultimoMes = atual.itens[0]?.mes_venda || ""

    mapa.set(nome, atual)
  })

  return Array.from(mapa.values()).sort((a, b) => {
    const dataA = mesRef(a.ultimoMes)
    const dataB = mesRef(b.ultimoMes)

    if (dataA !== dataB) return dataB - dataA

    return b.total - a.total
  })
}

function clientesUnicos(itens: Pi[]) {
  return Array.from(
    new Set(
      itens
        .map((pi) => pi.anunciante)
        .filter(Boolean)
    )
  )
}

export default function FederalEntidadesPage({ tipo = "anunciantes" }: Props) {
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [tipoSelecionado, setTipoSelecionado] = useState<EntidadeTipo>(tipo)
  const [entidadeAberta, setEntidadeAberta] = useState<string | null>(null)

  async function carregarDados() {
    try {
      setLoading(true)

      const pis = await getPisCached()

      setDados(Array.isArray(pis) ? (pis as Pi[]) : [])
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
    setTipoSelecionado(tipo)
  }, [tipo])

  const dadosFederal = useMemo(() => {
    return dados.filter((item) => normalizar(item.grupo) === "federal")
  }, [dados])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    const listaOrdenada = [...dadosFederal].sort(ordenarPorLancamento)

    if (!termo) return listaOrdenada

    return listaOrdenada.filter((item) =>
      normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.mes_venda,
        ].join(" ")
      ).includes(termo)
    )
  }, [dadosFederal, busca])

  const entidades = useMemo(() => {
    return agruparEntidades(
      dadosFiltrados,
      tipoSelecionado === "anunciantes" ? "anunciante" : "agencia"
    )
  }, [dadosFiltrados, tipoSelecionado])

  const ultimosInvestimentos = useMemo(() => {
    return dadosFiltrados.slice(0, 15)
  }, [dadosFiltrados])

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalPIs = dadosFiltrados.length

  function trocarTipo(tipoNovo: EntidadeTipo) {
    setTipoSelecionado(tipoNovo)
    setEntidadeAberta(null)
  }

  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
        >
          Voltar
        </button>

        <span className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
          Comercial Federal
        </span>

        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          Clientes e Agências do Federal
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Visualização consolidada com últimos investimentos, PIs em ordem de
          lançamento, faturamento bruto e líquido.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Registros" value={String(entidades.length)} />
        <KpiCard label="PIs" value={String(totalPIs)} />
        <KpiCard label="Líquido" value={money(totalLiquido)} />
        <KpiCard label="Bruto" value={money(totalBruto)} />
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => trocarTipo("anunciantes")}
              className={
                tipoSelecionado === "anunciantes"
                  ? "rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm"
                  : "rounded-xl px-4 py-3 text-sm font-black text-zinc-600 transition hover:bg-white"
              }
            >
              Cliente
            </button>

            <button
              type="button"
              onClick={() => trocarTipo("agencias")}
              className={
                tipoSelecionado === "agencias"
                  ? "rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm"
                  : "rounded-xl px-4 py-3 text-sm font-black text-zinc-600 transition hover:bg-white"
              }
            >
              Agência
            </button>
          </div>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
            placeholder="Buscar PI, cliente, agência, executivo ou mês..."
          />
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Carregando dados...
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black">Últimos investimentos</h2>

                <p className="text-sm text-zinc-500">
                  PIs mais recentes do Federal, em ordem de lançamento.
                </p>
              </div>

              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
                {ultimosInvestimentos.length} últimos
              </span>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3">PI</th>
                    <th className="px-4 py-3">Mês</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Agência</th>
                    <th className="px-4 py-3">Executivo</th>
                    <th className="px-4 py-3 text-right">Líquido</th>
                    <th className="px-4 py-3 text-right">Bruto</th>
                  </tr>
                </thead>

                <tbody>
                  {ultimosInvestimentos.map((pi, index) => (
                    <tr
                      key={`${pi.numero_pi}-${index}`}
                      className="border-b border-zinc-100 hover:bg-red-50"
                    >
                      <td className="px-4 py-3 font-black text-red-600">
                        {pi.numero_pi}
                      </td>

                      <td className="px-4 py-3 text-zinc-500">
                        {pi.mes_venda}
                      </td>

                      <td className="px-4 py-3 font-semibold text-zinc-800">
                        {pi.anunciante || "-"}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {pi.agencia || "-"}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {pi.executivo || "-"}
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
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black">
                  {tipoSelecionado === "anunciantes" ? "Clientes" : "Agências"}
                </h2>

                <p className="text-sm text-zinc-500">
                  Clique em um item para visualizar uma visão consolidada.
                </p>
              </div>

              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
                {entidades.length} registros
              </span>
            </div>

            <div className="space-y-3">
              {entidades.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                  Nenhum registro encontrado.
                </div>
              ) : (
                entidades.map((item, index) => {
                  const aberto = entidadeAberta === item.nome
                  const clientes = clientesUnicos(item.itens)

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
                        className="flex w-full flex-col gap-3 p-5 text-left transition hover:bg-red-50 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-black text-red-600">
                            #{index + 1}
                          </span>

                          <strong className="mt-1 block break-words text-base font-black text-zinc-950">
                            {item.nome}
                          </strong>

                          <small className="text-zinc-500">
                            {item.quantidade} PIs • Último:{" "}
                            {item.ultimoMes || "-"}
                          </small>
                        </div>

                        <div className="text-left md:text-right">
                          <b className="block text-sm font-black text-zinc-950">
                            {tipoSelecionado === "agencias"
                              ? `Trouxe: ${money(item.total)}`
                              : money(item.total)}
                          </b>

                          <small className="text-xs text-zinc-500">
                            Bruto: {money(item.bruto)}
                          </small>

                          {tipoSelecionado === "agencias" && (
                            <small className="mt-1 block font-bold text-red-600">
                              {clientes.length} clientes atendidos
                            </small>
                          )}
                        </div>
                      </button>

                      {aberto && tipoSelecionado === "agencias" && (
                        <div className="border-t border-zinc-200 bg-white p-5">
                          <div className="grid gap-4 md:grid-cols-4">
                            <ResumoCard titulo="Trouxe líquido" valor={money(item.total)} />
                            <ResumoCard titulo="Trouxe bruto" valor={money(item.bruto)} />
                            <ResumoCard titulo="PIs" valor={String(item.quantidade)} />
                            <ResumoCard titulo="Clientes" valor={String(clientes.length)} />
                          </div>

                          <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <h3 className="text-sm font-black uppercase tracking-wide text-zinc-500">
                                Clientes dessa agência
                              </h3>

                              <div className="mt-4 space-y-2">
                                {clientes.slice(0, 20).map((cliente, clienteIndex) => (
                                  <div
                                    key={`${cliente}-${clienteIndex}`}
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                                  >
                                    {cliente}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-wide text-zinc-500">
                                  Últimos PIs dessa agência
                                </h3>

                                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-500">
                                  {item.itens.length} registros
                                </span>
                              </div>

                              <div className="overflow-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                                      <th className="px-4 py-3">PI</th>
                                      <th className="px-4 py-3">Cliente</th>
                                      <th className="px-4 py-3">Mês</th>
                                      <th className="px-4 py-3">Executivo</th>
                                      <th className="px-4 py-3 text-right">
                                        Líquido
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {item.itens.slice(0, 30).map((pi, piIndex) => (
                                      <tr
                                        key={`${pi.numero_pi}-${piIndex}`}
                                        className="border-b border-zinc-100 hover:bg-red-50"
                                      >
                                        <td className="px-4 py-3 font-black text-red-600">
                                          {pi.numero_pi}
                                        </td>

                                        <td className="px-4 py-3 font-semibold text-zinc-800">
                                          {pi.anunciante || "-"}
                                        </td>

                                        <td className="px-4 py-3 text-zinc-600">
                                          {pi.mes_venda}
                                        </td>

                                        <td className="px-4 py-3 text-zinc-600">
                                          {pi.executivo || "-"}
                                        </td>

                                        <td className="px-4 py-3 text-right font-black">
                                          {money(pi.valor_liquido)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {aberto && tipoSelecionado === "anunciantes" && (
                        <div className="border-t border-zinc-200 bg-white p-4">
                          <div className="overflow-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                                  <th className="px-4 py-3">PI</th>
                                  <th className="px-4 py-3">Mês</th>
                                  <th className="px-4 py-3">Cliente</th>
                                  <th className="px-4 py-3">Agência</th>
                                  <th className="px-4 py-3">Executivo</th>
                                  <th className="px-4 py-3 text-right">
                                    Líquido
                                  </th>
                                  <th className="px-4 py-3 text-right">
                                    Bruto
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {item.itens.map((pi, piIndex) => (
                                  <tr
                                    key={`${pi.numero_pi}-${piIndex}`}
                                    className="border-b border-zinc-100 hover:bg-red-50"
                                  >
                                    <td className="px-4 py-3 font-black text-red-600">
                                      {pi.numero_pi}
                                    </td>

                                    <td className="px-4 py-3 text-zinc-500">
                                      {pi.mes_venda}
                                    </td>

                                    <td className="px-4 py-3 text-zinc-700">
                                      {pi.anunciante || "-"}
                                    </td>

                                    <td className="px-4 py-3 text-zinc-700">
                                      {pi.agencia || "-"}
                                    </td>

                                    <td className="px-4 py-3 text-zinc-700">
                                      {pi.executivo || "-"}
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
        </>
      )}
    </main>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <span className="text-sm text-zinc-500">{label}</span>

      <strong className="mt-2 block break-words text-2xl font-black">
        {value}
      </strong>
    </div>
  )
}

function ResumoCard({
  titulo,
  valor,
}: {
  titulo: string
  valor: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
        {titulo}
      </span>

      <strong className="mt-2 block break-words text-xl font-black text-zinc-950">
        {valor}
      </strong>
    </div>
  )
}