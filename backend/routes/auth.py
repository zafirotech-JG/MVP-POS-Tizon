"""
Ruta de autenticación (Login)
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.auth import ADMIN_USER, ADMIN_PASSWORD, create_access_token

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    """Autentica al administrador y devuelve un JWT."""
    # Validación súper simple contra las credenciales en duro del .env
    if data.username != ADMIN_USER or data.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )
    
    token = create_access_token(subject=data.username)
    return {"access_token": token, "token_type": "bearer"}
