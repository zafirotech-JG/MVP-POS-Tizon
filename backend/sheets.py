"""
Capa de acceso a Google Sheets para Tizón V1 POS

Estructura del Spreadsheet:
  - Hoja "Productos": id | nombre | precio | insumos | activo
  - Hoja "Ventas":    id | fecha | producto_id | producto_nombre |
                      cantidad | precio_unitario | total | metodo_pago
"""
import os
import uuid
from datetime import datetime, date
from typing import List, Optional

import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Cabeceras esperadas — DEBEN coincidir con la hoja de Google Sheets
HEADERS_PRODUCTOS = ["id", "nombre", "precio", "insumos", "activo"]
HEADERS_VENTAS = [
    "id", "fecha", "producto_id", "producto_nombre",
    "cantidad", "precio_unitario", "total", "metodo_pago"
]


def _get_client() -> gspread.Client:
    """Retorna un cliente autenticado de gspread."""
    credentials_path = os.getenv("CREDENTIALS_PATH", "service_account.json")
    creds = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
    return gspread.authorize(creds)


def _open_sheet(sheet_name: str) -> gspread.Worksheet:
    """Abre una hoja del spreadsheet configurado en .env."""
    client = _get_client()
    spreadsheet_id = os.getenv("SPREADSHEET_ID")
    if not spreadsheet_id:
        raise RuntimeError("SPREADSHEET_ID no está definido en el archivo .env")
    spreadsheet = client.open_by_key(spreadsheet_id)
    try:
        worksheet = spreadsheet.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        # Crear la hoja si no existe y agregar cabeceras
        worksheet = spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=20)
        headers = HEADERS_PRODUCTOS if sheet_name == "Productos" else HEADERS_VENTAS
        worksheet.append_row(headers)
    return worksheet


# ══════════════════════════════════════════════
#  PRODUCTOS
# ══════════════════════════════════════════════

def get_productos() -> List[dict]:
    """Retorna todos los productos activos."""
    ws = _open_sheet("Productos")
    records = ws.get_all_records()
    return [r for r in records if str(r.get("activo", "TRUE")).upper() == "TRUE"]


def get_all_productos_raw() -> List[dict]:
    """Retorna todos los productos (incluyendo inactivos)."""
    ws = _open_sheet("Productos")
    return ws.get_all_records()


def add_producto(nombre: str, precio: float, insumos: str) -> dict:
    """Agrega un nuevo producto y retorna el registro creado."""
    ws = _open_sheet("Productos")
    nuevo_id = str(uuid.uuid4())
    row = [nuevo_id, nombre, precio, insumos, "TRUE"]
    ws.append_row(row)
    return {
        "id": nuevo_id,
        "nombre": nombre,
        "precio": precio,
        "insumos": insumos,
        "activo": True,
    }


def update_producto(producto_id: str, nombre: str, precio: float, insumos: str) -> Optional[dict]:
    """Actualiza nombre, precio e insumos de un producto. Retorna None si no existe."""
    ws = _open_sheet("Productos")
    records = ws.get_all_records()
    for i, record in enumerate(records, start=2):  # fila 1 = cabecera
        if record["id"] == producto_id:
            ws.update(f"B{i}:D{i}", [[nombre, precio, insumos]])
            return {"id": producto_id, "nombre": nombre, "precio": precio, "insumos": insumos, "activo": True}
    return None


def delete_producto(producto_id: str) -> bool:
    """Soft-delete: marca activo=FALSE. Retorna True si encontró el producto."""
    ws = _open_sheet("Productos")
    records = ws.get_all_records()
    headers = ws.row_values(1)
    activo_col = headers.index("activo") + 1  # 1-indexed

    for i, record in enumerate(records, start=2):
        if record["id"] == producto_id:
            ws.update_cell(i, activo_col, "FALSE")
            return True
    return False


# ══════════════════════════════════════════════
#  VENTAS
# ══════════════════════════════════════════════

def add_venta(
    producto_id: str,
    producto_nombre: str,
    cantidad: int,
    precio_unitario: float,
    metodo_pago: str,
) -> dict:
    """Registra una venta y retorna el registro creado."""
    ws = _open_sheet("Ventas")
    venta_id = str(uuid.uuid4())
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total = round(cantidad * precio_unitario, 2)

    row = [venta_id, fecha, producto_id, producto_nombre, cantidad, precio_unitario, total, metodo_pago]
    ws.append_row(row)

    return {
        "id": venta_id,
        "fecha": fecha,
        "producto_id": producto_id,
        "producto_nombre": producto_nombre,
        "cantidad": cantidad,
        "precio_unitario": precio_unitario,
        "total": total,
        "metodo_pago": metodo_pago,
    }


def get_ventas_por_fecha(fecha_str: str) -> List[dict]:
    """
    Retorna todas las ventas de una fecha específica (YYYY-MM-DD).
    Filtra por los primeros 10 caracteres del campo 'fecha'.
    """
    ws = _open_sheet("Ventas")
    records = ws.get_all_records()
    return [r for r in records if str(r.get("fecha", "")).startswith(fecha_str)]
