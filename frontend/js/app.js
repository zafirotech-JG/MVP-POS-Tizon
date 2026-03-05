/**
 * App entry point — SPA router
 * Maneja la navegación entre módulos tanto desde el sidebar (desktop)
 * como desde el bottom nav (mobile). Se agrega el selector universal
 * [data-seccion] para capturar ambos conjuntos de nav items.
 */

import { initPOS } from "./pos.js";
import { initInventario } from "./inventario.js";
import { initDashboard } from "./dashboard.js";

const modulos = {
    pos: { init: initPOS, initialized: false },
    inventario: { init: initInventario, initialized: false },
    dashboard: { init: initDashboard, initialized: false },
};

function mostrarSeccion(nombre) {
    // Ocultar todas las secciones
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));

    // Desmarcar todos los nav items (sidebar + bottom nav)
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

    // Mostrar sección y marcar nav items correspondientes
    document.getElementById(`seccion-${nombre}`)?.classList.add("active");
    document.querySelectorAll(`.nav-item[data-seccion="${nombre}"]`).forEach((n) => n.classList.add("active"));

    // Inicializar módulo (o recargar dashboard en cada visita)
    const modulo = modulos[nombre];
    if (modulo && (!modulo.initialized || nombre === "dashboard")) {
        modulo.init().catch(console.error);
        modulo.initialized = true;
    }
}

// Captura clicks en todos los nav-items (sidebar Y bottom nav)
document.querySelectorAll(".nav-item[data-seccion]").forEach((item) => {
    item.addEventListener("click", () => mostrarSeccion(item.dataset.seccion));
});

// Init Auth y Sección inicial
import { initAuth } from "./auth.js";
initAuth();
mostrarSeccion("pos");
