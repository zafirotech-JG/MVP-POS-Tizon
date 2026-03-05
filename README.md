# 🔥 Tizón V1 — POS para Asadero Colombiano

Sistema de punto de venta (POS) y gestión diseñado para asaderos en Colombia. MVP ligero, sin infraestructura costosa: el backend es Python puro y los datos viven en Google Sheets.

---

## Índice

1. [Arquitectura del Sistema](#arquitectura)
2. [Decisiones Técnicas](#decisiones-técnicas)
3. [Por qué no se usan Embeddings / Vectores](#por-qué-no-se-usan-embeddings--vectores)
4. [Modelo de Datos](#modelo-de-datos)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Cómo Ejecutar](#cómo-ejecutar)
7. [Despliegue en Producción](#despliegue-en-producción)
8. [Posibles Mejoras](#posibles-mejoras)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTE                             │
│           HTML / CSS / JS (SPA)                         │
│   POS  │  Inventario  │  Dashboard                      │
└────────────────────┬────────────────────────────────────┘
                     │  HTTP / JSON  (fetch API)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                              │
│              FastAPI (Python)                           │
│                                                         │
│  POST /api/ventas        GET /api/productos             │
│  PUT  /api/productos/:id GET /api/reportes/dia          │
│  DELETE /api/productos/:id                              │
└────────────────────┬────────────────────────────────────┘
                     │  gspread (OAuth2 Service Account)
                     ▼
┌─────────────────────────────────────────────────────────┐
│               BASE DE DATOS                             │
│             Google Sheets                               │
│                                                         │
│   Hoja: Productos   │   Hoja: Ventas                    │
└─────────────────────────────────────────────────────────┘
```

**Flujo de una venta:**
1. El cajero selecciona un producto en la grilla del POS.
2. Ajusta la cantidad con el stepper y elige el método de pago (pills).
3. El frontend hace `POST /api/ventas` con `{ producto_id, cantidad, metodo_pago }`.
4. FastAPI busca el producto en Sheets, calcula `total = precio × cantidad` **server-side**, y anexa una fila en la hoja `Ventas`.
5. El dashboard agrega las ventas del día por producto y por método de pago.

---

## Decisiones Técnicas

### FastAPI sobre Flask o Django
FastAPI ofrece validación automática con Pydantic, tipos nativos, documentación interactiva en `/docs` y rendimiento asíncrono potencial, todo con muy poco boilerplate. Para un MVP donde la velocidad de desarrollo importa más que el ecosistema maduro, supera a Django. Flask carece de validación de datos nativa.

### Google Sheets como base de datos
| Criterio | Google Sheets | SQLite | PostgreSQL |
|---|---|---|---|
| Coste | Gratis | Gratis | ~$7/mes (host) |
| Visualización datos | ✅ Nativa | ❌ Requiere tools | ❌ Requiere tools |
| Backups automáticos | ✅ Historial Google | ❌ Manual | ⚠️ Configurable |
| Escalabilidad | ~50k filas OK | Millones | Ilimitado |
| Requiere infra | ❌ No | ❌ No | ✅ Sí |

Para el volumen de un asadero pequeño (<200 ventas/día), Google Sheets es más práctico: el dueño puede ver y editar los datos directamente sin ningún panel admin adicional.

### SPA sin framework (Vanilla JS + ES Modules)
React o Vue añaden build steps, node_modules y complejidad de despliegue. Con ES Modules nativos y un diseño en capas (`api.js` → módulos → `app.js`), el proyecto se sirve como archivos estáticos directamente desde FastAPI sin compilación.

### Soft-delete en productos
En lugar de borrar filas de la hoja `Productos`, se marca `activo=FALSE`. Esto preserva la integridad referencial histórica: las ventas antiguas siguen teniendo nombre y precio coherentes aunque el producto ya no esté en el menú.

### Precio calculado server-side
El `total` de cada venta se calcula en el backend (`routes/ventas.py`), no en el cliente. Esto evita manipulación de precios desde el navegador y garantiza que el precio registrado sea el precio oficial del producto en el momento de la venta.

---

## Por qué no se usan Embeddings / Vectores

Este proyecto es un **sistema transaccional de dominio cerrado**, no un sistema de recuperación semántica ni de procesamiento de lenguaje natural. Los embeddings (vectores de alta dimensión generados por modelos de lenguaje) son la herramienta correcta cuando:

- Se necesita **búsqueda semántica** (ej: "busca platos similares a costilla").
- Se construye un **chatbot con RAG** que responde preguntas sobre documentos.
- Se hace **recomendación de productos** basada en comportamiento del usuario.

En Tizón V1, todos los datos son estructurados (IDs, precios, fechas, cantidades) y las consultas son exactas (`WHERE fecha = '2026-03-04'` equivalente). Introducir embeddings añadiría:

- **Coste**: llamadas a una API de embeddings (OpenAI, Cohere, etc.) o un modelo local.
- **Latencia**: generación de vectores en cada escritura.
- **Complejidad**: una base de datos vectorial (Pinecone, pgvector) además de Sheets.
- **Sin beneficio real**: no hay texto libre que clasificar ni búsqueda semántica que resolver.

> La regla es usar la herramienta más simple que resuelva el problema. Aquí: filtros de fecha y agregaciones numéricas.

---

## Modelo de Datos

### Hoja `Productos`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID (string) | Clave primaria, generado en backend |
| `nombre` | string | Nombre del producto en el menú |
| `precio` | number | Precio de venta en COP |
| `insumos` | string | Descripción libre de la receta |
| `activo` | string (`TRUE`/`FALSE`) | Soft-delete |

### Hoja `Ventas`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID (string) | Clave primaria de la transacción |
| `fecha` | datetime | `YYYY-MM-DD HH:MM:SS` |
| `producto_id` | UUID | FK → `Productos.id` |
| `producto_nombre` | string | Desnormalizado (snapshot del nombre) |
| `cantidad` | integer | Unidades vendidas |
| `precio_unitario` | number | Precio al momento de venta |
| `total` | number | `cantidad × precio_unitario` |
| `metodo_pago` | enum | `Efectivo`, `Nequi`, `Daviplata`, `Tarjeta` |

---

## Estructura del Proyecto

```
TizonV1/
├── backend/
│   ├── __init__.py
│   ├── main.py           # FastAPI app, CORS, static files
│   ├── models.py         # Pydantic schemas (validación de entrada/salida)
│   ├── sheets.py         # Capa de datos: CRUD sobre Google Sheets
│   └── routes/
│       ├── __init__.py
│       ├── productos.py  # GET / POST / PUT / DELETE /api/productos
│       ├── ventas.py     # POST /api/ventas
│       └── reportes.py   # GET /api/reportes/dia
├── frontend/
│   ├── index.html        # SPA shell — 3 módulos
│   ├── css/
│   │   └── styles.css    # Design system (mobile-first, dark/ember)
│   └── js/
│       ├── api.js        # Fetch wrapper centralizado
│       ├── app.js        # SPA router (sidebar + bottom nav)
│       ├── pos.js        # Módulo Punto de Venta
│       ├── inventario.js # Módulo Inventario / Menú
│       ├── dashboard.js  # Módulo Reportes / Cierre de caja
│       └── utils.js      # formatCOP, showToast
├── credentials/          # ⚠️ NO subir a Git
│   └── service_account.json
├── .env                  # ⚠️ NO subir a Git
├── .env.example          # Plantilla pública
├── .gitignore
├── Procfile              # Para Heroku / Railway
├── runtime.txt           # python-3.11
└── requirements.txt
```

---

## Cómo Ejecutar

### Pre-requisitos
- Python 3.11+
- Cuenta de Google con acceso a Google Sheets

### 1. Clonar y preparar el entorno

```bash
git clone <url-del-repo>
cd TizonV1
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configurar Google Cloud

1. Crear proyecto en [console.cloud.google.com](https://console.cloud.google.com)
2. Habilitar **Google Sheets API** y **Google Drive API**
3. Crear credencial → **Cuenta de servicio** → descargar JSON
4. Guardar como `credentials/service_account.json`

### 3. Preparar el Spreadsheet

1. Crear un Google Spreadsheet con dos hojas: `Productos` y `Ventas`
2. En **fila 1** de cada hoja, agregar las cabeceras exactas:

   **Productos:** `id | nombre | precio | insumos | activo`

   **Ventas:** `id | fecha | producto_id | producto_nombre | cantidad | precio_unitario | total | metodo_pago`

3. Compartir el Spreadsheet con el email del service account (con rol **Editor**)
4. Copiar el ID del Spreadsheet desde la URL

### 4. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:
```env
SPREADSHEET_ID=tu_id_aqui
CREDENTIALS_PATH=credentials/service_account.json
```

### 5. Ejecutar el servidor

```bash
# Desarrollo (con hot-reload)
uvicorn backend.main:app --reload

# Producción local
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Abrir **[http://localhost:8000](http://localhost:8000)**

La documentación interactiva de la API está en **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## Despliegue en Producción

El `Procfile` ya está configurado para Heroku y Railway:

```
web: uvicorn backend.main:app --host=0.0.0.0 --port=${PORT:-8000}
```

**Variables de entorno a configurar en la plataforma:**
- `SPREADSHEET_ID`
- `CREDENTIALS_PATH` → subir el JSON como variable o usar Secret Manager

> ⚠️ **Nunca** subas `.env` ni `credentials/service_account.json` a GitHub. Están en `.gitignore`.

---

## Posibles Mejoras

### Corto plazo
- [ ] **Autenticación básica**: login con usuario/contraseña para proteger el POS (FastAPI + JWT o sesiones simples)
- [ ] **Modo offline / PWA**: Service Worker para cachear productos y encolar ventas sin conexión
- [ ] **Búsqueda y filtro** en la grilla de productos del POS
- [ ] **Impresión de recibo** básico (WebPrint API o generación de PDF en el backend)

### Mediano plazo
- [ ] **Gráficas en el Dashboard**: ventas por hora, tendencia semanal (Chart.js)
- [ ] **Módulo de Gastos**: registrar costos de insumos para calcular margen bruto real
- [ ] **Alertas de inventario** cuando los insumos bajan de un umbral
- [ ] **Múltiples usuarios / roles**: cajero vs. administrador con permisos distintos
- [ ] **Migración a PostgreSQL**: cuando el volumen supere ~50k filas o se necesiten queries complejas

### Largo plazo
- [ ] **Análisis predictivo**: proyección de ventas por día/semana con regresión simple
- [ ] **Integración con Siigo o Alegra** para facturación electrónica DIAN
- [ ] **App nativa (React Native / Flutter)**: para una experiencia móvil más robusta con acceso offline real
- [ ] **Multi-sucursal**: separar datos por sede manteniendo un dashboard consolidado

---

## Licencia

MIT — libre de usar, modificar y distribuir.
