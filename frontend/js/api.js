/**
 * Tizón V1 — API Layer
 * Centraliza todas las llamadas fetch hacia el backend FastAPI.
 */

const BASE_URL = ""; // vacío = mismo origen (FastAPI sirve el frontend)

async function request(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);
    const resp = await fetch(`${BASE_URL}${path}`, options);
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const msg = data?.detail || `Error HTTP ${resp.status}`;
        throw new Error(msg);
    }
    return data;
}

// ── Productos ──────────────────────────────────────────────────────
export const API = {
    productos: {
        listar: () => request("GET", "/api/productos"),
        crear: (data) => request("POST", "/api/productos", data),
        editar: (id, data) => request("PUT", `/api/productos/${id}`, data),
        eliminar: (id) => request("DELETE", `/api/productos/${id}`),
    },
    ventas: {
        registrar: (data) => request("POST", "/api/ventas", data),
    },
    reportes: {
        dia: (fecha = null) => {
            const qs = fecha ? `?fecha=${fecha}` : "";
            return request("GET", `/api/reportes/dia${qs}`);
        },
    },
};
