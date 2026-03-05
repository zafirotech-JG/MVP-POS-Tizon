/**
 * Auth Module — Maneja el login y estado de sesión
 */

import { API } from "./api.js";
import { showToast } from "./utils.js";

export function initAuth() {
    bindEventos();
    verificarSesion();
}

function bindEventos() {
    document.getElementById("btn-login")?.addEventListener("click", handleLogin);
    document.getElementById("btn-logout-desktop")?.addEventListener("click", handleLogout);
    document.getElementById("btn-logout-mobile")?.addEventListener("click", handleLogout);

    // Submit con Enter
    document.getElementById("login-password")?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleLogin();
    });
}

function verificarSesion() {
    const token = localStorage.getItem("tizon_token");
    const overlay = document.getElementById("login-overlay");

    if (token) {
        overlay?.classList.remove("visible");
    } else {
        overlay?.classList.add("visible");
    }
}

async function handleLogin() {
    const username = document.getElementById("login-username")?.value.trim();
    const password = document.getElementById("login-password")?.value.trim();
    const btn = document.getElementById("btn-login");

    if (!username || !password) {
        showToast("Ingresa usuario y contraseña", "warning");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Ingresando...";

    try {
        const res = await API.auth.login(username, password);
        localStorage.setItem("tizon_token", res.access_token);
        showToast("Sesión iniciada correctamente", "success");

        // Limpiar campos y ocultar modal
        document.getElementById("login-password").value = "";
        document.getElementById("login-overlay").classList.remove("visible");

        // Recargar página para inicializar todo con el nuevo token
        window.location.reload();
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar";
    }
}

export function handleLogout() {
    localStorage.removeItem("tizon_token");
    window.location.reload();
}
