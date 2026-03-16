/**
 * Tizón V1 — API Layer
 * Centraliza todas las llamadas fetch hacia el backend FastAPI.
 */

const BASE_URL = "https://tizon-mvp.up.railway.app";

async function request(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };

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
        login: async (username, password) => {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Error en el inicio de sesión");
            return data;
        },
    },

    productos: {
        listar: async () => {
            const cached = sessionStorage.getItem("tizon_productos");
            if (cached) {
                // Stale-While-Revalidate
                request("GET", "/api/productos").then(data => {
                    sessionStorage.setItem("tizon_productos", JSON.stringify(data));
                }).catch(() => { });
                return JSON.parse(cached);
            }
            const data = await request("GET", "/api/productos");
            sessionStorage.setItem("tizon_productos", JSON.stringify(data));
            return data;
        },
        crear: (data) => request("POST", "/api/productos", data).then(r => { sessionStorage.removeItem("tizon_productos"); return r; }),
        editar: (id, data) => request("PUT", `/api/productos/${id}`, data).then(r => { sessionStorage.removeItem("tizon_productos"); return r; }),
        eliminar: (id) => request("DELETE", `/api/productos/${id}`).then(r => { sessionStorage.removeItem("tizon_productos"); return r; }),
    },

    ventas: {
        registrar: (data) => request("POST", "/api/ventas", data),
    },

    reportes: {
        dia: (fecha = null) => {
            let sanitizedFecha = fecha;

            // 🛡️ LIMPIEZA DE FECHA: Evita el error 500 por formatos raros como "2026-03-16:1"
            if (sanitizedFecha) {
                if (sanitizedFecha instanceof Date) {
                    sanitizedFecha = sanitizedFecha.toISOString().split('T')[0];
                } else if (typeof sanitizedFecha === 'string') {
                    // Tomamos solo los primeros 10 caracteres (YYYY-MM-DD)
                    sanitizedFecha = sanitizedFecha.slice(0, 10);
                }
            }

            const qs = sanitizedFecha ? `?fecha=${sanitizedFecha}` : "";
            // Usamos la ruta limpia sin barra final para evitar el 307
            return request("GET", `/api/reportes/dia${qs}`);
        },
    },
};