"""
Capa de acceso a Google Sheets para Tizón V1 POS

Estructura del Spreadsheet:
  - Hoja "Productos":   id | nombre | precio | insumos | categoria | activo
  - Hoja "Ventas":      id | fecha | producto_id | producto_nombre |
                         cantidad | precio_unitario | total | metodo_pago
  - Hoja "Categorias":  id | nombre | activo
"""
import os
import uuid
import json
from datetime import datetime, date
from typing import List, Optional
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Cabeceras esperadas — DEBEN coincidir con la hoja de Google Sheets
HEADERS_PRODUCTOS = ["id", "nombre", "precio", "insumos", "categoria", "activo"]
HEADERS_VENTAS = [
    "id", "fecha", "producto_id", "producto_nombre",
    "cantidad", "precio_unitario", "total", "metodo_pago"
]
HEADERS_CATEGORIAS = ["id", "nombre", "activo"]


def _get_client() -> gspread.Client:
    """
    Obtiene un cliente autenticado de gspread.
    - Railway (nube): GOOGLE_CREDENTIALS_JSON contiene el JSON del service account.
    - Local:          CREDENTIALS_PATH en .env apunta al archivo JSON de credenciales.
    """
    # 1. Railway: variable de entorno con JSON inline
    google_env = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    if google_env.strip().startswith("{"):
        try:
            creds_dict = json.loads(google_env.strip())
            if "private_key" in creds_dict:
                creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
            creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            return gspread.authorize(creds)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"GOOGLE_CREDENTIALS_JSON no es JSON válido: {e}")

    # 2. Local: ruta al archivo de credenciales desde .env
    creds_path = os.getenv("CREDENTIALS_PATH", "")
    if creds_path:
        project_root = Path(__file__).resolve().parent.parent
        creds_file = project_root / creds_path
        if creds_file.exists():
            creds = Credentials.from_service_account_file(str(creds_file), scopes=SCOPES)
            return gspread.authorize(creds)
        raise FileNotFoundError(
            f"Archivo de credenciales no encontrado: {creds_file}\n"
            f"Verifica CREDENTIALS_PATH en .env (actual: '{creds_path}')"
        )

    raise RuntimeError(
        "No se encontraron credenciales de Google. "
        "Configura GOOGLE_CREDENTIALS_JSON (Railway) o CREDENTIALS_PATH (local) en .env"
    )


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
        if sheet_name == "Productos":
            headers = HEADERS_PRODUCTOS
        elif sheet_name == "Categorias":
            headers = HEADERS_CATEGORIAS
        else:
            headers = HEADERS_VENTAS
        worksheet.append_row(headers)
    return worksheet


def _ensure_productos_categoria_header(ws: gspread.Worksheet) -> None:
    """Garantiza que la hoja Productos tenga la columna 'categoria'."""
    headers = ws.row_values(1)
    if "categoria" in headers:
        return
    ws.add_cols(1)
    categoria_col = len(headers) + 1
    ws.update_cell(1, categoria_col, "categoria")


def _get_productos_headers(ws: gspread.Worksheet) -> List[str]:
    """Retorna headers actuales de Productos, garantizando columna categoria."""
    _ensure_productos_categoria_header(ws)
    return ws.row_values(1)


# ══════════════════════════════════════════════
#  PRODUCTOS
# ══════════════════════════════════════════════

def get_productos() -> List[dict]:
    """Retorna todos los productos activos."""
    ws = _open_sheet("Productos")
    _ensure_productos_categoria_header(ws)
    records = ws.get_all_records()
    activos = [r for r in records if str(r.get("activo", "TRUE")).upper() == "TRUE"]
    for item in activos:
        item["categoria"] = str(item.get("categoria", "General") or "General")
    return activos


def get_all_productos_raw() -> List[dict]:
    """Retorna todos los productos (incluyendo inactivos)."""
    ws = _open_sheet("Productos")
    _ensure_productos_categoria_header(ws)
    records = ws.get_all_records()
    for item in records:
        item["categoria"] = str(item.get("categoria", "General") or "General")
    return records


def add_producto(nombre: str, precio: float, insumos: str, categoria: str) -> dict:
    """Agrega un nuevo producto y retorna el registro creado."""
    ws = _open_sheet("Productos")
    headers = _get_productos_headers(ws)
    nuevo_id = str(uuid.uuid4())

    values_by_header = {
        "id": nuevo_id,
        "nombre": nombre,
        "precio": precio,
        "insumos": insumos,
        "categoria": categoria,
        "activo": "TRUE",
    }
    row = [values_by_header.get(h, "") for h in headers]
    ws.append_row(row)
    return {
        "id": nuevo_id,
        "nombre": nombre,
        "precio": precio,
        "insumos": insumos,
        "categoria": categoria,
        "activo": True,
    }


def update_producto(producto_id: str, nombre: str, precio: float, insumos: str, categoria: str) -> Optional[dict]:
    """Actualiza nombre, precio, insumos y categoría. Retorna None si no existe."""
    ws = _open_sheet("Productos")
    headers = _get_productos_headers(ws)
    records = ws.get_all_records()

    col_nombre = headers.index("nombre") + 1 if "nombre" in headers else None
    col_precio = headers.index("precio") + 1 if "precio" in headers else None
    col_insumos = headers.index("insumos") + 1 if "insumos" in headers else None
    col_categoria = headers.index("categoria") + 1 if "categoria" in headers else None

    for i, record in enumerate(records, start=2):  # fila 1 = cabecera
        if record["id"] == producto_id:
            if col_nombre:
                ws.update_cell(i, col_nombre, nombre)
            if col_precio:
                ws.update_cell(i, col_precio, precio)
            if col_insumos:
                ws.update_cell(i, col_insumos, insumos)
            if col_categoria:
                ws.update_cell(i, col_categoria, categoria)
            return {
                "id": producto_id,
                "nombre": nombre,
                "precio": precio,
                "insumos": insumos,
                "categoria": categoria,
                "activo": True,
            }
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


def get_categorias() -> List[dict]:
    """Retorna categorías activas."""
    ws = _open_sheet("Categorias")
    records = ws.get_all_records()
    return [r for r in records if str(r.get("activo", "TRUE")).upper() == "TRUE"]


def add_categoria(nombre: str) -> dict:
    """Crea una categoría; si ya existe activa, la retorna sin duplicar."""
    ws = _open_sheet("Categorias")
    records = ws.get_all_records()
    nombre_normalizado = nombre.strip().lower()

    for r in records:
        if str(r.get("nombre", "")).strip().lower() == nombre_normalizado:
            if str(r.get("activo", "TRUE")).upper() != "TRUE":
                headers = ws.row_values(1)
                activo_col = headers.index("activo") + 1
                for i, record in enumerate(records, start=2):
                    if record.get("id") == r.get("id"):
                        ws.update_cell(i, activo_col, "TRUE")
                        break
            return {
                "id": str(r.get("id")),
                "nombre": str(r.get("nombre")),
                "activo": True,
            }

    categoria_id = str(uuid.uuid4())
    ws.append_row([categoria_id, nombre.strip(), "TRUE"])
    return {"id": categoria_id, "nombre": nombre.strip(), "activo": True}


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
