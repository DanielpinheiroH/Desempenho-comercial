import { useParams } from "react-router-dom"

export default function AdminSubperfilDetalhe() {
  const { subperfil } = useParams()

  return (
    <div className="admin-page">
      <section className="admin-home-hero">
        <div>
          <span className="eyebrow">Subperfil</span>
          <h1>{decodeURIComponent(subperfil || "")}</h1>
          <p>Vamos montar essa tela no próximo passo.</p>
        </div>
      </section>
    </div>
  )
}