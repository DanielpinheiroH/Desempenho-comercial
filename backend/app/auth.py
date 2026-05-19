import jwt
from datetime import datetime, timedelta

SECRET_KEY = "trocar-depois"
ALGORITHM = "HS256"


def criar_token(payload: dict):
    dados = payload.copy()
    dados["exp"] = datetime.utcnow() + timedelta(hours=8)
    return jwt.encode(dados, SECRET_KEY, algorithm=ALGORITHM)


def verificar_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None
