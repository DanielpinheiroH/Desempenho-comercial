import { useEffect, useMemo, useState } from "react"
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

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
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

export default function DashboardAdmin() {
  const user = getUser()
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)

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

  const dadosTratados = useMemo(() => {
    return dados.map((item) => ({
      ...item,
      area_classificada: classificarArea(item),
    }))
  }, [dados])

  const totalLiquido = dadosTratados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosTratados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalPIs = dadosTratados.length

  const ticketMedio = totalPIs > 0 ? totalLiquido / totalPIs : 0

  const areas = useMemo(() => {
    const lista: AreaTipo[] = [
      "privado",
      "gestao-executiva",
      "estadual",
      "federal",
      "gdf",
    ]

    return lista.map((area) => {
      const itens = dadosTratados.filter((item) => item.area_classificada === area)

      const total = itens.reduce(
        (acc, item) => acc + Number(item.valor_liquido || 0),
        0
      )

      const bruto = itens.reduce(
        (acc, item) => acc + Number(item.valor_bruto || 0),
        0
      )

      return {
        area,
        nome: nomeArea(area),
        total,
        bruto,
        pis: itens.length,
        ticket: itens.length > 0 ? total / itens.length : 0,
      }
    })
  }, [dadosTratados])

  const subperfisGDF = useMemo(() => {
    const mapa = new Map<string, Pi[]>()

    dadosTratados
      .filter((item) => item.area_classificada === "gdf")
      .forEach((item) => {
        const sub = item.sub_perfil_anunciante || "Sem subperfil"
        mapa.set(sub, [...(mapa.get(sub) || []), item])
      })

    return Array.from(mapa.entries())
      .map(([nome, itens]) => ({
        nome,
        slug: encodeURIComponent(nome),
        total: itens.reduce((acc, item) => acc + Number(item.valor_liquido || 0), 0),
        pis: itens.length,
      }))
      .sort((a, b) => b.total - a.total)
  }, [dadosTratados])

  return (
    <div className="admin-page">
      <section className="admin-home-hero">
        <div>
          <span className="eyebrow">Painel administrativo</span>
          <h1>Visão geral comercial</h1>
          <p>
            Olá, {user?.nome}. Selecione uma área para visualizar faturamento,
            produtividade, perfis, subperfis e PIs.
          </p>
        </div>

        <div className="admin-home-total">
          <span>Total líquido geral</span>
          <strong>{money(totalLiquido)}</strong>
          <small>{totalPIs} PIs no sistema</small>
        </div>
      </section>

      {loading ? (
        <div className="loading-card">Carregando dados...</div>
      ) : (
        <>
          <section className="admin-home-kpis">
            <div>
              <span>Total bruto</span>
              <strong>{money(totalBruto)}</strong>
            </div>

            <div>
              <span>Total líquido</span>
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

          <section className="admin-section-heading">
            <div>
              <h2>Áreas comerciais</h2>
              <p>Clique em uma área para abrir a tela detalhada.</p>
            </div>
          </section>

          <section className="admin-home-area-grid">
            {areas.map((item) => (
              <button
                type="button"
                className="admin-home-area-card"
                key={item.area}
                onClick={() => navigate(`/admin/area/${item.area}`)}
              >
                <span>{item.nome}</span>
                <strong>{money(item.total)}</strong>
                <small>{item.pis} PIs lançados</small>

                <div className="admin-home-area-meta">
                  <b>Bruto: {money(item.bruto)}</b>
                  <b>Ticket: {money(item.ticket)}</b>
                </div>
              </button>
            ))}
          </section>

          {subperfisGDF.length > 0 && (
            <>
              <section className="admin-section-heading">
                <div>
                  <h2>Subperfis GDF / CLDF</h2>
                  <p>Abra uma visão separada por órgão ou subperfil.</p>
                </div>
              </section>

              <section className="admin-subprofile-grid">
                {subperfisGDF.map((item) => (
                  <button
                    type="button"
                    className="admin-subprofile-card"
                    key={item.nome}
                    onClick={() => navigate(`/admin/subperfil/${item.slug}`)}
                  >
                    <span>{item.nome}</span>
                    <strong>{money(item.total)}</strong>
                    <small>{item.pis} PIs</small>
                  </button>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}