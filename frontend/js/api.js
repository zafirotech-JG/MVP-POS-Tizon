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

    // Inject JWT token if available
    const token = localStorage.getItem("tizon_token");
    if (token) {
        options.headers["Authorization"] = `Bearer ${token}`;
    }

    if (body) options.body = JSON.stringify(body);
    const resp = await fetch(`${BASE_URL}${path}`, options);
    const data = await resp.json().catch(() => null);

    if (resp.status === 401) {
        localStorage.removeItem("tizon_token");
        const overlay = document.getElementById("login-overlay");
        if (overlay) overlay.classList.add("visible");
        throw new Error(data?.detail || "Sesión expirada o no autorizada");
    }

    if (!resp.ok) {
        const msg = data?.detail || `Error HTTP ${resp.status}`;
        throw new Error(msg);
    }
    return data;
}

// ── Endpoints ──────────────────────────────────────────────────────
export const API = {
    auth: {
        login: (username, password) => request("POST", "/api/auth/login", { username, password }),
    },
    productos: {
        listar: async () => {
            const cached = sessionStorage.getItem("tizon_productos");
            if (cached) {
                // Stale-While-Revalidate: actualiza en background
                request("GET", "/api/productos").then(data => {
                    sessionStorage.setItem("tizon_productos", JSON.stringify(data));
                }).catch(() => { });
                return JSON.parse(cached);
            }
            // Primera carga
            const data = await request("GET", "/api/productos");
            sessionStorage.setItem("tizon_productos", JSON.stringify(data));
            return data;
        },
        crear: async (data) => {
            const res = await request("POST", "/api/productos", data);
            sessionStorage.removeItem("tizon_productos"); // Invalidar cache
            return res;
        },
        editar: async (id, data) => {
            const res = await request("PUT", `/api/productos/${id}`, data);
            sessionStorage.removeItem("tizon_productos"); // Invalidar cache
            return res;
        },
        eliminar: async (id) => {
            const res = await request("DELETE", `/api/productos/${id}`);
            sessionStorage.removeItem("tizon_productos"); // Invalidar cache
            return res;
        },
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
