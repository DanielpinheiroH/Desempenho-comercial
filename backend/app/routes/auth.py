import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import criar_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])

BASE_DIR = Path(__file__).resolve().parents[2]
USERS_PATH = BASE_DIR / "data" / "usuarios.json"


class LoginIn(BaseModel):
    email: str
    senha: str


def carregar_usuarios():
    with open(USERS_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


@router.post("/login")
def login(data: LoginIn):
    usuarios = carregar_usuarios()

    usuario = next(
        (
            user
            for user in usuarios
            if user.get("email", "").lower() == data.email.lower()
            and user.get("senha", "") == data.senha
        ),
        None,
    )

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="E-mail ou senha inválidos.",
        )

    token = criar_token(
        {
            "email": usuario["email"],
            "nome": usuario["nome"],
            "role": usuario["role"],
            "grupos": usuario.get("grupos", []),
            "executivo": usuario.get("executivo"),
        }
    )

    return {
        "token": token,
        "usuario": {
            "email": usuario["email"],
            "nome": usuario["nome"],
            "role": usuario["role"],
            "grupos": usuario.get("grupos", []),
            "executivo": usuario.get("executivo"),
        },
    }