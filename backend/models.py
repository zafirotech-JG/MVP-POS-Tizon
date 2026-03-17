"""
Modelos Pydantic para Tizón V1 POS
"""
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MetodoPago(str, Enum):
    efectivo = "Efectivo"
    nequi = "Nequi"
    daviplata = "Daviplata"
    tarjeta = "Tarjeta"


# ─────────────── PRODUCTOS ───────────────

class ProductoCreate(BaseModel):
    nombre: str
    precio: float
    insumos: Optional[str] = ""
    categoria: str = "General"

    @field_validator("precio")
    @classmethod
    def precio_positivo(cls, v):
        if v <= 0:
            raise ValueError("El precio debe ser mayor a 0")
        return v

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v):
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("categoria")
    @classmethod
    def categoria_no_vacia(cls, v):
        if not v.strip():
            raise ValueError("La categoría es obligatoria")
        return v.strip()


class ProductoOut(BaseModel):
    id: str
    nombre: str
    precio: float
    insumos: str
    categoria: str
    activo: bool


class CategoriaCreate(BaseModel):
    nombre: str

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v):
        if not v.strip():
            raise ValueError("El nombre de la categoría no puede estar vacío")
        return v.strip()


class CategoriaOut(BaseModel):
    id: str
    nombre: str
    activo: bool


# ─────────────── VENTAS ───────────────

class VentaCreate(BaseModel):
    producto_id: str
    cantidad: int
    metodo_pago: MetodoPago

    @field_validator("cantidad")
    @classmethod
    def cantidad_positiva(cls, v):
        if v <= 0:
            raise ValueError("La cantidad debe ser al menos 1")
        return v


class VentaOut(BaseModel):
    id: str
    fecha: str
    producto_id: str
    producto_nombre: str
    cantidad: int
    precio_unitario: float
    total: float
    metodo_pago: str


# ─────────────── REPORTES ───────────────

class ReporteProducto(BaseModel):
    producto_nombre: str
    cantidad_total: int
    total_ingresos: float


class ResumenCaja(BaseModel):
    total_dia: float
    efectivo: float
    nequi: float
    daviplata: float
    tarjeta: float


class ReporteDia(BaseModel):
    fecha: str
    productos: List[ReporteProducto]
    resumen_caja: ResumenCaja
