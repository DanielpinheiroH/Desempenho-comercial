import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api, getToken } from "../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  perfil_anunciante?: string
  sub_perfil_anunciante?: string
  mes_venda: string
  data_venda?: string
  valor_bruto: number
  valor_liquido: number
}

type AreaTipo =
  | "privado"
  | "gestao-executiva"
  | "estadual"
  | "federal"
  | "gdf"

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function nomeArea(area: string) {
  const nomes: Record<string, string> = {
    privado: "Comercial Privado",
    "gestao-executiva": "Gestão Executiva",
    estadual: "Comercial Estadual",
    federal: "Comercial Federal",
    gdf: "GDF / CLDF",
  }

  return nomes[area] || area
}

function classificarArea(item: Pi): AreaTipo {
  const perfil = (item.perfil_anunciante || "").toUpperCase()
  const sub = (item.sub_perfil_anunciante || "").toUpperCase()
  const executivo = (item.executivo || "").toUpperCase()
  const grupo = (item.grupo || "").toLowerCase()

  if (grupo === "federal" || perfil.includes("FEDERAL") || sub.includes("FEDERAL")) {
    return "federal"
  }

  if (
    executivo.includes("GESTÃO EXECUTIVA") ||
    executivo.includes("GESTAO EXECUTIVA") ||
    sub.includes("GESTÃO EXECUTIVA") ||
    sub.includes("GESTAO EXECUTIVA")
  ) {
    return "gestao-executiva"
  }

  if (sub.includes("GDF") || sub.includes("CLDF")) {
    return "gdf"
  }

  if (grupo === "estadual" || perfil.includes("ESTADUAL")) {
    return "estadual"
  }

  return "privado"
}

export default function AdminAreaDetalhe() {
  const navigate = useNavigate()
  const { area = "privado" } = useParams()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [anoSelecionado, setAnoSelecionado] = useState("")
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [busca, setBusca] = useState("")

  async function carregarDados() {
    try {
      const token = getToken()

      const response = await api.get("/api/pis", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setDados(response.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const dadosArea = useMemo(() => {
    return dados
      .map((item) => ({
        ...item,
        area_classificada: classificarArea(item),
      }))
      .filter((item) => item.area_classificada === area)
  }, [dados, area])

  const anos = useMemo(() => {
    return Array.from(
      new Set(dadosArea.map((item) => item.mes_venda?.split("/")[1]).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a))
  }, [dadosArea])

  const meses = useMemo(() => {
    const base = anoSelecionado
      ? dadosArea.filter((item) => item.mes_venda?.split("/")[1] === anoSelecionado)
      : dadosArea

    return Array.from(new Set(base.map((item) => item.mes_venda).filter(Boolean))).sort(
      (a, b) => {
        const [mesA, anoA] = a.split("/")
        const [mesB, anoB] = b.split("/")
        return new Date(Number(anoB), Number(mesB) - 1).getTime() -
          new Date(Number(anoA), Number(mesA) - 1).getTime()
      }
    )
  }, [dadosArea, anoSelecionado])

  const dadosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return dadosArea.filter((item) => {
      const ano = item.mes_venda?.split("/")[1]

      const bateAno = !anoSelecionado || ano === anoSelecionado
      const bateMes = !mesSelecionado || item.mes_venda === mesSelecionado
      const bateBusca =
        !termo ||
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.perfil_anunciante,
          item.sub_perfil_anunciante,
          item.mes_venda,
          item.data_venda,
        ]
          .join(" ")
          .toLowerCase()
          .includes(termo)

      return bateAno && bateMes && bateBusca
    })
  }, [dadosArea, anoSelecionado, mesSelecionado, busca])

  const totalBruto = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalPIs = dadosFiltrados.length
  const ticketMedio = totalPIs > 0 ? totalLiquido / totalPIs : 0

  const porPerfil = useMemo(() => {
    const mapa = new Map<string, Pi[]>()

    dadosFiltrados.forEach((item) => {
      const perfil = item.perfil_anunciante || "Sem perfil"
      mapa.set(perfil, [...(mapa.get(perfil) || []), item])
    })

    return Array.from(mapa.entries())
      .map(([perfil, itens]) => ({
        perfil,
        bruto: itens.reduce((acc, item) => acc + Number(item.valor_bruto || 0), 0),
        liquido: itens.reduce((acc, item) => acc + Number(item.valor_liquido || 0), 0),
        pis: itens.length,
      }))
      .sort((a, b) => b.liquido - a.liquido)
  }, [dadosFiltrados])

  const porDia = useMemo(() => {
    const mapa = new Map<string, Pi[]>()

    dadosFiltrados.forEach((item) => {
      const dia = item.data_venda || "Sem data"
      mapa.set(dia, [...(mapa.get(dia) || []), item])
    })

    return Array.from(mapa.entries())
      .map(([dia, itens]) => ({
        dia,
        liquido: itens.reduce((acc, item) => acc + Number(item.valor_liquido || 0), 0),
        pis: itens.length,
      }))
      .slice(0, 20)
  }, [dadosFiltrados])

  return (
    <div className="admin-page">
      <section className="admin-home-hero">
        <div>
          <span className="eyebrow">Detalhe da área</span>
          <h1>{nomeArea(area)}</h1>
          <p>Resumo detalhado por período, perfil do anunciante, vendas por dia e PIs.</p>
        </div>

        <div className="admin-home-total">
          <span>Total líquido</span>
          <strong>{money(totalLiquido)}</strong>
          <small>{totalPIs} PIs encontrados</small>
        </div>
      </section>

      <button className="back-button" onClick={() => navigate("/")}>
        Voltar para o painel
      </button>

      <section className="admin-filters-pro">
        <select
          value={anoSelecionado}
          onChange={(event) => {
            setAnoSelecionado(event.target.value)
            setMesSelecionado("")
          }}
        >
          <option value="">Todos os anos</option>
          {anos.map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>

        <select value={mesSelecionado} onChange={(event) => setMesSelecionado(event.target.value)}>
          <option value="">Todos os meses</option>
          {meses.map((mes) => (
            <option key={mes} value={mes}>
              {mes}
            </option>
          ))}
        </select>

        <input
          placeholder="Pesquisar PI, anunciante, executivo, agência..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
      </section>

      {loading ? (
        <div className="loading-card">Carregando dados...</div>
      ) : (
        <>
          <section className="admin-home-kpis">
            <div>
              <span>Valor bruto</span>
              <strong>{money(totalBruto)}</strong>
            </div>

            <div>
              <span>Valor líquido</span>
              <strong>{money(totalLiquido)}</strong>
            </div>

            <div>
              <span>Total de PIs</span>
              <strong>{totalPIs}</strong>
            </div>

            <div>
              <span>Ticket médio</span>
              <strong>{money(ticketMedio)}</strong>
            </div>
          </section>

          <section className="admin-table-panel">
            <div className="admin-section-heading inside">
              <div>
                <h2>Resumo por perfil do anunciante</h2>
                <p>Modelo consolidado igual ao relatório comercial.</p>
              </div>
            </div>

            <div className="commercial-summary-table">
              <div className="commercial-summary-header">
                <strong>Perfil Anunciante</strong>
                <strong>Valor bruto</strong>
                <strong>Valor líquido</strong>
              </div>

              {porPerfil.map((item) => (
                <div className="commercial-summary-row" key={item.perfil}>
                  <span>{item.perfil}</span>
                  <b>{money(item.bruto)}</b>
                  <b>{money(item.liquido)}</b>
                </div>
              ))}

              <div className="commercial-summary-total">
                <strong>Total Comercial</strong>
                <strong>{money(totalBruto)}</strong>
                <strong>{money(totalLiquido)}</strong>
              </div>
            </div>
          </section>

          <section className="admin-grid-pro">
            <div className="admin-panel-pro">
              <div className="admin-section-heading inside">
                <div>
                  <h2>Vendas por dia</h2>
                  <p>Resumo diário dentro do filtro atual.</p>
                </div>
              </div>

              <div className="daily-sales-list">
                {porDia.map((item) => (
                  <div className="daily-sales-row" key={item.dia}>
                    <div>
                      <strong>{item.dia}</strong>
                      <span>{item.pis} PIs</span>
                    </div>

                    <b>{money(item.liquido)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-panel-pro">
              <div className="admin-section-heading inside">
                <div>
                  <h2>PIs recentes</h2>
                  <p>Últimos registros dentro da área.</p>
                </div>
              </div>

              <div className="admin-pi-list">
                {dadosFiltrados.slice(0, 15).map((item, index) => (
                  <div className="admin-pi-row" key={`${item.numero_pi}-${index}`}>
                    <div>
                      <strong>PI {item.numero_pi}</strong>
                      <span>{item.anunciante}</span>
                    </div>

                    <b>{money(item.valor_liquido)}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="admin-table-panel">
            <div className="admin-section-heading inside">
              <div>
                <h2>Todos os PIs da área</h2>
                <p>{dadosFiltrados.length} registros encontrados.</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>PI</th>
                    <th>Executivo</th>
                    <th>Perfil</th>
                    <th>Subperfil</th>
                    <th>Anunciante</th>
                    <th>Agência</th>
                    <th>Mês</th>
                    <th>Data venda</th>
                    <th>Valor bruto</th>
                    <th>Valor líquido</th>
                  </tr>
                </thead>

                <tbody>
                  {dadosFiltrados.map((item, index) => (
                    <tr key={`${item.numero_pi}-${index}`}>
                      <td>{item.numero_pi}</td>
                      <td>{item.executivo}</td>
                      <td>{item.perfil_anunciante}</td>
                      <td>{item.sub_perfil_anunciante}</td>
                      <td>{item.anunciante}</td>
                      <td>{item.agencia}</td>
                      <td>{item.mes_venda}</td>
                      <td>{item.data_venda || "-"}</td>
                      <td>{money(item.valor_bruto)}</td>
                      <td>{money(item.valor_liquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}