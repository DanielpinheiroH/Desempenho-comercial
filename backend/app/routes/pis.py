import json
import unicodedata
from pathlib import Path
from fastapi import APIRouter, Header, HTTPException

from app.auth import verificar_token

router = APIRouter(prefix="/api/pis", tags=["PIs"])

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "dados.json"

DADOS_CACHE = None


def normalizar_legado(valor):
    return (
        str(valor or "")
        .strip()
        .lower()
        .replace("á", "a")
        .replace("à", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )


def normalizar(valor):
    texto = str(valor or "").strip().lower()
    texto = "".join(
        char
        for char in unicodedata.normalize("NFD", texto)
        if unicodedata.category(char) != "Mn"
    )

    return (
        texto.replace("Ã¡", "a")
        .replace("Ã ", "a")
        .replace("Ã£", "a")
        .replace("Ã¢", "a")
        .replace("Ã©", "e")
        .replace("Ãª", "e")
        .replace("Ã­", "i")
        .replace("Ã³", "o")
        .replace("Ã´", "o")
        .replace("Ãµ", "o")
        .replace("Ãº", "u")
        .replace("Ã§", "c")
    )


def mes_referencia(valor):
    try:
        mes, ano = str(valor or "").split("/")
        return int(f"{ano}{mes.zfill(2)}")
    except Exception:
        return 0


def eh_federal(item):
    grupo = normalizar(item.get("grupo"))
    perfil = normalizar(item.get("perfil_anunciante"))
    subperfil = normalizar(item.get("sub_perfil_anunciante"))
    diretoria = normalizar(item.get("diretoria"))

    return (
        grupo == "federal"
        or "federal" in perfil
        or "federal" in subperfil
        or "federal" in diretoria
        or "atendimento gov federal" in perfil
        or "atendimento gov federal" in subperfil
    )


def classificar_area(item):
    grupo = normalizar(item.get("grupo"))
    perfil = normalizar(item.get("perfil_anunciante"))
    subperfil = normalizar(item.get("sub_perfil_anunciante"))
    executivo = normalizar(item.get("executivo"))

    if grupo == "federal" or "federal" in perfil or "federal" in subperfil:
        return "federal"

    if "gestao executiva" in executivo or "gestao executiva" in subperfil:
        return "gestao-executiva"

    if "gdf" in subperfil or "cldf" in subperfil:
        return "gdf"

    if grupo == "estadual" or "estadual" in perfil:
        return "estadual"

    return "privado"


def eh_escopo_djanane(item):
    return classificar_area(item) in {"gestao-executiva", "gdf", "estadual"}


def aplicar_regras_comerciais(item):
    novo = dict(item)

    perfil = normalizar(novo.get("perfil_anunciante"))
    subperfil = normalizar(novo.get("sub_perfil_anunciante"))
    mes_venda = mes_referencia(novo.get("mes_venda"))

    # Regra Gabriel Moura:
    # A partir de 08/2025, tudo que for Atendimento Gov Federal
    # passa a ser tratado como Federal e com diretoria Gabriel Moura.
    if (
        mes_venda >= 202508
        and (
            "atendimento gov federal" in perfil
            or "atendimento gov federal" in subperfil
        )
    ):
        novo["grupo"] = "federal"
        novo["diretoria"] = "Gabriel Moura"

    return novo


def carregar_dados():
    global DADOS_CACHE

    if DADOS_CACHE is not None:
        return DADOS_CACHE

    with open(DATA_PATH, "r", encoding="utf-8") as file:
        dados = json.load(file)

    DADOS_CACHE = [aplicar_regras_comerciais(item) for item in dados]

    return DADOS_CACHE


def get_usuario_logado(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não enviado.")

    token = authorization.replace("Bearer ", "")
    usuario = verificar_token(token)

    if not usuario:
        raise HTTPException(status_code=401, detail="Token inválido.")

    return usuario


@router.get("")
def listar_pis(authorization: str | None = Header(default=None)):
    usuario = get_usuario_logado(authorization)
    dados = carregar_dados()

    role = usuario.get("role")
    grupos_usuario = [normalizar(g) for g in usuario.get("grupos", [])]
    executivo_usuario = normalizar(usuario.get("executivo"))

    if role == "admin":
        return dados

    # Gestores e usuários de grupo veem tudo do escopo comercial permitido.
    if role in ["gestor", "grupo"]:
        if "federal" in grupos_usuario or "estadual" in grupos_usuario:
            return [
                item
                for item in dados
                if ("federal" in grupos_usuario and eh_federal(item))
                or ("estadual" in grupos_usuario and eh_escopo_djanane(item))
                or (
                    normalizar(item.get("grupo")) in grupos_usuario
                    and normalizar(item.get("grupo"))
                    not in ["federal", "estadual"]
                )
            ]

        return [
            item
            for item in dados
            if normalizar(item.get("grupo")) in grupos_usuario
        ]

    # Executivo comum continua vendo apenas os próprios PIs.
    return [
        item
        for item in dados
        if normalizar(item.get("executivo")) == executivo_usuario
    ]
