import json
from pathlib import Path
from fastapi import APIRouter, Header, HTTPException

from app.auth import verificar_token

router = APIRouter(prefix="/api/pis", tags=["PIs"])

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "dados.json"


def normalizar(valor):
    return str(valor or "").strip().lower()


def carregar_dados():
    with open(DATA_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


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

    if role in ["gestor", "grupo"]:
        return [
            item for item in dados
            if normalizar(item.get("grupo")) in grupos_usuario
        ]

    return [
        item for item in dados
        if normalizar(item.get("executivo")) == executivo_usuario
    ]