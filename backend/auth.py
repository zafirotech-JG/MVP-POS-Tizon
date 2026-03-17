"""
Auth utilities — JWT creation & verification
Estrategia: un único usuario administrador definido en .env.
Sin base de datos; las credenciales viven en variables de entorno.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# ── Configuración ────────────────────────────────────────────────────────
SECRET_KEY    = os.getenv("SECRET_KEY", "cambia-este-secreto-en-produccion")
ALGORITHM     = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8           # duración de una jornada laboral

ADMIN_USER     = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "tizon")  # contraseña en texto plano en .env

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


# ── Helpers de contraseña ────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


# ── Token ────────────────────────────────────────────────────────────────
def create_access_token(subject: str) -> str:
    """Genera un JWT firmado con expiración de ACCESS_TOKEN_EXPIRE_HOURS."""
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── Dependency FastAPI ────────────────────────────────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    """
    Dependency que valida el JWT en el header Authorization: Bearer <token>.
    Lanza 401 si el token es inválido o está ausente.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado. Inicia sesión nuevamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user: str = payload.get("sub", "")
        if not user:
            raise unauthorized
        return user
    except JWTError:
        raise unauthorized
