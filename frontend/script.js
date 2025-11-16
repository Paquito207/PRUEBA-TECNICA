const apiUrl = "http://localhost:8080/api/tareas";

let currentSort = "fecha";
let currentOrder = "asc";
let currentSearch = "";
const selectedIds = new Set();
let cachedTareas = []; // cache local para validaciones y evitar fetchs extra
let currentView = "lista"; // lista | mini
let currentPage = 1;
let pageSize = Number(localStorage.getItem("pageSize") || 10);
let tareasCacheCargadas = false;


document.getElementById("btnVistaLista").onclick = () => {
  currentView = "lista";
  aplicarVista();
};

document.getElementById("btnVistaMini").onclick = () => {
  currentView = "mini";
  aplicarVista();
};
// Evita submits accidentales: todos los botones reciben type="button" si no tienen type.
// Mantén los <button type="submit"> que ya tengas (p. ej. el de agregar).
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button").forEach(b => {
    if (!b.hasAttribute("type")) b.setAttribute("type", "button");
  });
});

/* ============================
  Aplicar vista seleccionada
============================ */
function aplicarVista() {
  const ul = document.getElementById("listaTareas");
  if (!ul) return;

  ul.classList.remove("lista", "mini");
  ul.classList.add(currentView);

  document
    .getElementById("btnVistaLista")
    .classList.toggle("view-btn-active", currentView === "lista");
  document
    .getElementById("btnVistaMini")
    .classList.toggle("view-btn-active", currentView === "mini");
}

/* ============================
  Eventos DOMContentLoaded
============================ */
document.addEventListener("DOMContentLoaded", () => {
  /*si se desea hacer peticiones por btn ( quita o comenta sortSelect y orderSelect que estan enseguida ) "no olvides descomentar el btn en el html" */
  /*document.getElementById("btnOrdenar").onclick = (e) => {
    e.preventDefault();
    currentSort = document.getElementById("sortSelect").value;
    currentOrder = document.getElementById("orderSelect").value;
    listarTareas(true);
  };*/
document.getElementById("sortSelect").addEventListener("change", () => {
  currentSort = document.getElementById("sortSelect").value;
  currentPage = 1;
  listarTareas(true);
});
document.getElementById("orderSelect").addEventListener("change", () => {
  currentOrder = document.getElementById("orderSelect").value;
  currentPage = 1;
  listarTareas(true);
});

  const SEARCH_DEBOUNCE_MS = 160;
let __searchTimer = null;

["searchInputHeader", "searchInputMain"].forEach(id => {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    currentPage = 1;

    clearTimeout(__searchTimer);
    __searchTimer = setTimeout(() => {
      listarTareas();
    }, SEARCH_DEBOUNCE_MS);
  });
});


  document.getElementById("formTarea").onsubmit = async (e) => {
    e.preventDefault();
    const descripcion = document.getElementById("descripcion").value.trim();
    const prioridad = document.getElementById("prioridad").value;
    if (!descripcion) {
      showNotification("La descripción es obligatoria.", "error");
      return;
    }

    // validación duplicado local (case-insensitive)
    const existe = cachedTareas.some(
      (t) =>
        (t.descripcion || "").trim().toLowerCase() === descripcion.toLowerCase()
    );
    if (existe) {
      showNotification("Ya existe una tarea con esa descripción.", "error");
      return;
    }

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion, prioridad }),
      });

      const body = await safeJson(res);
      if (!res.ok) {
        showNotification(body?.error || "Error al crear tarea", "error");
        return;
      }

      showNotification(body?.message || "Tarea creada", "success");
      document.getElementById("descripcion").value = "";
      document.getElementById("prioridad").value = "Media";
      listarTareas();
    } catch (err) {
      showNotification("Error al crear tarea: " + err, "error");
    }
  };

  document.getElementById("btnMarcarSeleccionadas").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      showNotification("No hay tareas seleccionadas.", "info");
      return;
    }
    if (!(await confirmAction({
  title: "Marcar completadas",
  message: "Marcar las tareas seleccionadas como completadas?",
  confirmText: "Marcar",
  cancelText: "Cancelar"
}))) return;

  };

  document.getElementById("btnMarcarPendientes").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      showNotification("No hay tareas seleccionadas.", "info");
      return;
    }
    if (!(await confirmAction({
  title: "Marcar pendientes",
  message: "Marcar las tareas seleccionadas como pendientes?",
  confirmText: "Marcar",
  cancelText: "Cancelar"
}))) return;

  };

  document.getElementById("btnEliminarSeleccionadas").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      showNotification("No hay tareas seleccionadas.", "info");
      return;
    }
    if (!(await confirmAction({
  title: "Eliminar tareas",
  message: `¿Eliminar ${selectedIds.size} tarea(s)? Esta acción no se puede deshacer.`,
  confirmText: "Eliminar",
  cancelText: "Cancelar",
  danger: true
}))) return;


    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`${apiUrl}/batch/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        showNotification(body?.error || "Error al eliminar", "error");
        return;
      }
      showNotification(body?.message || "Tareas eliminadas", "success");
      selectedIds.clear();
      document.getElementById("selectAll").checked = false;
      listarTareas();
    } catch (err) {
      showNotification("Error al eliminar seleccionadas: " + err, "error");
    }
  };

  document.getElementById("btnAplicarPrioridad").onclick = async (e) => {
    e.preventDefault();
    const prioridad = document.getElementById("selCambiarPrioridad").value;
    if (!prioridad) {
      showNotification("Seleccione una prioridad.", "info");
      return;
    }
    if (selectedIds.size === 0) {
      showNotification("No hay tareas seleccionadas.", "info");
      return;
    }
    if (!(await confirmAction({
  title: "Cambiar prioridad",
  message: `Cambiar prioridad de las seleccionadas a "${prioridad}"?`,
  confirmText: "Cambiar",
  cancelText: "Cancelar"
}))) return;


    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`${apiUrl}/batch/prioridad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, prioridad }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        showNotification(body?.error || "Error al cambiar prioridad", "error");
        return;
      }
      showNotification(body?.message || "Prioridad cambiada", "success");
      selectedIds.clear();
      document.getElementById("selectAll").checked = false;
      document.getElementById("selCambiarPrioridad").value = "";
      listarTareas();
    } catch (err) {
      showNotification("Error al cambiar prioridad: " + err, "error");
    }
  };

  document.getElementById("btnExportCSV").onclick = (e) => {
    e.preventDefault();
    exportData("csv");
  };
  document.getElementById("btnExportJSON").onclick = (e) => {
    e.preventDefault();
    exportData("json");
  };

  document.getElementById("selectAll").addEventListener("change", (e) => {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll(".sel-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = checked;
      const id = Number(cb.dataset.id);
      if (checked) selectedIds.add(id);
      else selectedIds.delete(id);
    });
  });

  document.getElementById("pageSizeSelect").value = pageSize;
  document.getElementById("pageSizeSelect").onchange = () => {
    pageSize = Number(document.getElementById("pageSizeSelect").value);
    localStorage.setItem("pageSize", pageSize);
    currentPage = 1;
    listarTareas();
  };

  listarTareas();
  aplicarVista();
});

function crearVerMas(descEl, texto) {
  const limite = 120; // caracteres aproximados antes de mostrar botón
  if (texto.length <= limite) return;

  const btn = document.createElement("button");
  btn.className = "ver-mas-btn";
  btn.textContent = "Ver más";

  btn.onclick = () => {
    const expanded = descEl.classList.toggle("expanded");
    btn.textContent = expanded ? "Ver menos" : "Ver más";
  };

  return btn;
}

// safe parse JSON helper
async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// mostrar notificación simple (toast)
// ---------- Configuración ----------
const NOTIF_KEY = "pendingNotifications";
const NOTIF_RECENT_KEY = "recentNotifications"; // cache corta para evitar repetidos
const DEFAULT_THROTTLE_MS = 4000; // tiempo mínimo entre notificaciones idénticas (para tipos que se throttlean)
const SUCCESS_THROTTLE_MS = 6000; // valor disponible si se quisiera usar, pero por defecto success no se throttlea

// ---------- Storage helpers ----------
// ahora usamos localStorage para sobrevivir a recargas completas
function _readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function _writeJSON(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr || []));
  } catch (e) {}
}

// Pendientes (persistencia explícita)
function _readPending() {
  return _readJSON(NOTIF_KEY);
}
function _writePending(arr) {
  _writeJSON(NOTIF_KEY, arr);
}
function _addPending(n) {
  const arr = (_readPending() || []).filter((x) => x && x.id);
  // evitar duplicados por id
  if (!arr.some((x) => x.id === n.id)) arr.push(n);
  _writePending(arr);
}
function _removePendingById(id) {
  const arr = (_readPending() || []).filter((x) => !(x && x.id === id));
  _writePending(arr);
}
function _clearExpiredPending() {
  const now = Date.now();
  const arr = (_readPending() || []).filter(
    (n) => n && n.expiry && n.expiry > now
  );
  _writePending(arr);
}

// Recent cache para throttle (también en localStorage para sobrevivir a reloads cortos)
function _readRecent() {
  return _readJSON(NOTIF_RECENT_KEY);
}
function _writeRecent(arr) {
  _writeJSON(NOTIF_RECENT_KEY, arr);
}
function _cleanupRecent() {
  const now = Date.now();
  const arr = (_readRecent() || []).filter(
    (r) => r && r.expiry && r.expiry > now
  );
  _writeRecent(arr);
}
function _isRecent(hash) {
  _cleanupRecent();
  const arr = _readRecent();
  return arr.some((r) => r.hash === hash);
}
function _markRecent(hash, ms) {
  if (!ms || ms <= 0) return;
  _cleanupRecent();
  const arr = _readRecent();
  arr.push({ hash, expiry: Date.now() + ms });
  _writeRecent(arr);
}

// simple hash: tipo+mensaje+titulo -> base64 (no criptográfico, suficiente para dedupe)
function _notifHash(message, type, title) {
  const s = `${type}|${title || ""}|${message}`;
  try {
    return btoa(unescape(encodeURIComponent(s))).slice(0, 128);
  } catch (e) {
    return String(s).slice(0, 128);
  }
}

// helper escape (si ya la tienes en tu proyecto, úsala; la dejo por completitud)
function escapeHtml(unsafe) {
  if (!unsafe && unsafe !== 0) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- showNotification mejorada con throttle y persistencia opcional ----------
/**
 * showNotification(message, type = "info", ttl = 4000, title = "", options = {})
 * options:
 *   - persist: boolean (por defecto false) -> guarda en localStorage para rehidratar tras reload
 *   - id: string -> id opcional para control externo
 *   - rehydrated: boolean -> interno para rehidratación (evita volver a guardar)
 */
function showNotification(
  message,
  type = "info",
  ttl = 4000,
  title = "",
  options = {}
) {
  options = options || {};

  // Decide throttle: por diseño actual queremos QUE LAS 'success' NO sean bloqueadas/agrupadas
  const throttledTypes = ["info", "error"]; // tipos que sí se throttlean; 'success' queda fuera
  const throttleMs = throttledTypes.includes(type) ? DEFAULT_THROTTLE_MS : 0;

  // for success ensure a minimum visible ttl
  if (type === "success") ttl = Math.max(ttl, 3000);

  // si rehidratado no persistas; persist si options.persist === true
  // además: para garantizar que success sobrevivan a recargas, los persistimos automáticamente
  const shouldPersist =
    !options.rehydrated && (options.persist === true || type === "success");

  const container = document.getElementById("notif-container");
  if (!container) return alert(message);

  // limpiar pending expirados
  _clearExpiredPending();

  // dedupe throttle: evita mostrar el mismo mensaje repetido en corto periodo
  const hash = _notifHash(message, type, title);
  if (throttleMs > 0 && _isRecent(hash)) {
    // ya se mostró hace poco: ignorar (solo para tipos throttled)
    return;
  }
  // marca como reciente ahora para bloquear repetidos inmediatos (solo si aplicamos throttle)
  if (throttleMs > 0) _markRecent(hash, throttleMs);

  // Generar id
  const id =
    options.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Persistir solo si explicitado o si es success (para sobrevivir recarga)
  if (shouldPersist) {
    try {
      _addPending({
        id,
        message,
        type,
        title: title || "",
        expiry: Date.now() + ttl,
        hash,
      });
    } catch (e) {
      /* no fatal */
    }
  }

  // Límite visual
  const MAX = 6;
  while (container.children.length >= MAX) container.children[0].remove();

  // Crear elemento
  const el = document.createElement("div");
  el.className = `notif ${type} enter`;
  el.dataset.notifId = id;
  el.dataset.notifHash = hash;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  el.tabIndex = 0;

  const icons = {
    info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1"/></svg>`,
    success: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  el.innerHTML = `
    <div class="icon">${icons[type] || icons.info}</div>
    <div class="content">
      ${title ? `<div class="title">${escapeHtml(title)}</div>` : ""}
      <div class="message">${escapeHtml(message)}</div>
    </div>
    <button class="close-btn" aria-label="Cerrar notificación" title="Cerrar">&times;</button>
    <div class="progress"><i></i></div>
  `;

  container.appendChild(el);

  // anim entry
  requestAnimationFrame(() => {
    el.classList.remove("enter");
    el.classList.add("enter", "active");
    requestAnimationFrame(() => el.classList.add("active"));
  });

  const progress = el.querySelector(".progress > i");
  let remaining = ttl;
  let start = performance.now();
  let timeoutId = null;
  let removed = false;

  function removeNow() {
    if (removed) return;
    removed = true;
    // quitar del storage si existía
    try {
      _removePendingById(id);
    } catch (e) {}
    el.classList.add("exit");
    setTimeout(() => {
      el.remove();
    }, 220);
  }

  function startProgress(duration) {
    progress.style.transition = `width ${duration}ms linear`;
    progress.style.width = "100%";
    requestAnimationFrame(() => (progress.style.width = "0%"));
    timeoutId = setTimeout(removeNow, duration);
    start = performance.now();
    remaining = duration;
  }

  el.addEventListener("mouseenter", () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      const elapsed = performance.now() - start;
      remaining = Math.max(0, remaining - elapsed);
      const computed = window.getComputedStyle(progress).width;
      progress.style.transition = "";
      progress.style.width = computed;
    }
  });
  el.addEventListener("mouseleave", () => {
    if (!removed && remaining > 8) startProgress(remaining);
    else if (!removed && remaining <= 8) removeNow();
  });

  el.querySelector(".close-btn").addEventListener("click", () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    removeNow();
  });

  // start
  requestAnimationFrame(() => startProgress(ttl));
}

// ---------- Rehidratación al cargar (rehydrate) ----------
function rehydratePendingNotifications() {
  const now = Date.now();
  const arr = (_readPending() || []).filter(
    (n) => n && n.expiry && n.expiry > now
  );
  if (!arr.length) {
    localStorage.removeItem(NOTIF_KEY);
    return;
  }

  arr.forEach((n) => {
    const remaining = Math.max(0, n.expiry - now);
    // NO marcamos recent para 'success' (queremos que puedan repetirse) y además
    // showNotification omite throttle para success por configuración arriba.
    // re-llamamos showNotification con rehydrated:true para NO volver a guardar en storage
    showNotification(n.message, n.type, remaining, n.title || "", {
      persist: false,
      id: n.id,
      rehydrated: true,
    });
    // finalmente removemos la entrada persistente (evita rehidratación repetida)
    _removePendingById(n.id);
  });

  _clearExpiredPending();
}

// Inicializar en DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  _cleanupRecent(); // limpiar antiguos
  rehydratePendingNotifications();
});

// helper para escapar texto (seguridad XSS si se usa texto arbitrario)
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ordenarLocal(arr) {
  const dir = currentOrder === "asc" ? 1 : -1;

  const peso = { baja: 1, media: 2, alta: 3 };

  return [...arr].sort((a, b) => {
    let x, y;

    switch (currentSort) {
      case "fecha": {
        const fa = Number(new Date(a.fechaCreacion ?? a.fecha ?? 0)) || 0;
        const fb = Number(new Date(b.fechaCreacion ?? b.fecha ?? 0)) || 0;
        x = fa;
        y = fb;
        break;
      }

      case "prioridad": {
        x = peso[(a.prioridad || "").toLowerCase()] || 0;
        y = peso[(b.prioridad || "").toLowerCase()] || 0;
        break;
      }

      case "descripcion": {
        x = (a.descripcion || "").toLowerCase();
        y = (b.descripcion || "").toLowerCase();
        break;
      }

      default: {
        x = a[currentSort];
        y = b[currentSort];
        if (typeof x === "string") x = x.toLowerCase();
        if (typeof y === "string") y = y.toLowerCase();

        if (x == null) x = "";
        if (y == null) y = "";
      }
    }

    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;

    // -----------------------------
    // DESEMPATE FIJO Y MUY ROBUSTO
    // -----------------------------

    // 1. fecha de creación siempre válida
    const d1 = Number(new Date(a.fechaCreacion ?? 0)) || 0;
    const d2 = Number(new Date(b.fechaCreacion ?? 0)) || 0;
    if (d1 !== d2) return d2 - d1; // más reciente primero

    // 2. desempate final por id (evita "flotantes")
    const idA = a.id ?? 0;
    const idB = b.id ?? 0;
    return idA - idB;
  });
}


function actualizarContadores() {
  const total = cachedTareas.length;
  const pendientes = cachedTareas.filter(t => !t.completada).length;

  document.getElementById("total").textContent = `Total: ${total}`;
  document.getElementById("pendientes").textContent = `Pendientes: ${pendientes}`;

  document.getElementById("totalSidebar").textContent = `Total: ${total}`;
  document.getElementById("pendientesSidebar").textContent = `Pendientes: ${pendientes}`;
}

/* ============================
  Listado de tareas con paginación
============================ */
const pageOptions = [5, 10, 20, 50]; // opciones para el selector

/* ============================
  Listado de tareas con paginación
============================ */
/* ----------------- Overlay helpers + focus-trap (reemplazar versiones previas) ----------------- */
const offlineOverlay = document.getElementById("offlineOverlay");
const offlineMessageEl = document.getElementById("offlineMessage");
const btnRetry = document.getElementById("btnRetry");
const appRoot = document.querySelector(".app");

let __previouslyFocused = null;
let __focusTrapHandler = null;

function _getFocusableWithin(el) {
  return Array.from(
    el.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex], [contenteditable]'
    )
  ).filter((n) => n.tabIndex >= 0);
}

function showOfflineOverlay(message) {
  if (offlineMessageEl && message) offlineMessageEl.textContent = message;
  if (!offlineOverlay) return;

  // mostrar overlay y bloquear app
  offlineOverlay.removeAttribute("hidden");
  document.body.classList.add("offline-active");
  appRoot?.classList.add("offline-blocked");
  // accesibilidad: guardar foco y mover foco al primer elemento interactivo del overlay
  __previouslyFocused = document.activeElement;
  const focusables = _getFocusableWithin(offlineOverlay);
  if (focusables.length) {
    // asegurar que el retry esté enabled
    btnRetry?.removeAttribute("disabled");
    focusables[0].focus();
  } else {
    offlineOverlay.querySelector(".offline-card")?.focus();
  }

  // instalar focus-trap: ciclo de tab dentro del overlay
  __focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const focusables = _getFocusableWithin(offlineOverlay);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const currently = document.activeElement;
    if (!e.shiftKey && currently === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && currently === first) {
      e.preventDefault();
      last.focus();
    }
  };
  document.addEventListener("keydown", __focusTrapHandler, true);

  // Prevent touch/scroll leakage on some mobile browsers (extra guard)
  document.addEventListener("touchmove", _preventScrollWhileOffline, { passive: false });
}

function hideOfflineOverlay() {
  if (!offlineOverlay) return;
  offlineOverlay.setAttribute("hidden", "true");
  document.body.classList.remove("offline-active");
  appRoot?.classList.remove("offline-blocked");

  // restore focus
  try {
    if (__previouslyFocused && typeof __previouslyFocused.focus === "function") {
      __previouslyFocused.focus();
    }
  } catch (e) {}

  // remove focus trap
  if (__focusTrapHandler) {
    document.removeEventListener("keydown", __focusTrapHandler, true);
    __focusTrapHandler = null;
  }
  document.removeEventListener("touchmove", _preventScrollWhileOffline, { passive: false });
}

function _preventScrollWhileOffline(e) {
  e.preventDefault();
}

/* ----------------- fetchWithTimeout (igual) ----------------- */
async function fetchWithTimeout(url, opts = {}, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* ----------------- btnRetry: intenta reconectar PERO NUNCA OCULTA EL OVERLAY DIRECTAMENTE  ----------------- */
btnRetry?.addEventListener("click", async () => {
  if (!btnRetry) return;
  // evitar múltiples clicks
  btnRetry.setAttribute("disabled", "true");
  btnRetry.setAttribute("aria-busy", "true");
  offlineMessageEl.textContent = "Intentando reconectar...";

  // Intentaremos obtener las tareas forzando fetch; listarTareas(true) está preparada para
  // ocultar el overlay SOLO si consigue respuesta válida del servidor.
  try {
    await listarTareas(true);
    // si listarTareas tuvo éxito, será quien oculte el overlay; aquí sólo limpiamos atributos.
  } catch (err) {
    // listarTareas ya muestra overlay/mensaje en caso de fallo; reactivar botón para nuevo intento
    btnRetry.removeAttribute("disabled");
    btnRetry.removeAttribute("aria-busy");
    // actualizar mensaje si es necesario (listarTareas ya llama showNotification)
    offlineMessageEl.textContent = "No se pudo reconectar. Intentar de nuevo.";
  }
});

/* ----------------- online/offline events: NUNCA ocultar overlay automáticamente al 'online' ----------------- */
window.addEventListener("offline", () => {
  showOfflineOverlay("Parece que estás desconectado. Revisa tu conexión a internet.");
});

window.addEventListener("online", async () => {
  // no quitamos overlay aquí; intentamos forzar una reconexión segura
  if (!offlineOverlay || offlineOverlay.hasAttribute("hidden")) return;
  offlineMessageEl.textContent = "Volviste online. Verificando conexión con el servidor...";
  // deshabilitar retry momentáneamente (evitar floods)
  btnRetry?.setAttribute("disabled", "true");
  try {
    await listarTareas(true); // listarTareas ocultará overlay si la verificación es OK
  } catch (e) {
    btnRetry?.removeAttribute("disabled");
    offlineMessageEl.textContent = "No se pudo conectar al servidor. Intenta de nuevo.";
  }
});

/* --------------------- Modificación de listarTareas ---------------------
   Reemplaza la parte donde haces: const res = await fetch(apiUrl);
   por la siguiente implementación completa (sustituye tu función listarTareas por ésta).
*/
let isLoadingTareas = false;
async function listarTareas(forceFetch = false) {
  try {
    const emptyState = document.getElementById("emptyState");

    // Ocultar siempre antes de iniciar la carga
    if (emptyState) emptyState.style.display = "none";

    if (forceFetch) {
      isLoadingTareas = true;
    }

    // === FETCH SOLO CUANDO SE NECESITE ===
    if (!tareasCacheCargadas || forceFetch) {
      let res;
      try {
        // ajusta el timeout (ms) si quieres ser más estricto
        res = await fetchWithTimeout(apiUrl, {}, 6000);
      } catch (err) {
        // error de red o timeout -> mostrar overlay y notificación
        const msg = navigator.onLine
          ? "No se pudo conectar al servidor. Comprueba que el backend esté levantado."
          : "Sin conexión a internet.";
        showNotification(msg, "error");
        showOfflineOverlay(msg);
        isLoadingTareas = false;
        return; // salimos; no intentamos parsear body
      }

      const body = await safeJson(res);

      if (!res.ok) {
        const errMsg = body?.error || `Error ${res.status} al obtener tareas.`;
        showNotification(errMsg, "error");
        showOfflineOverlay(errMsg);
        isLoadingTareas = false;
        return;
      }

      // éxito -> ocultar overlay si estaba visible
      hideOfflineOverlay();

      cachedTareas = body?.tareas ?? [];
      tareasCacheCargadas = true;
    }

    isLoadingTareas = false;

    // === COPIA SEGURA ===
    let tareas = [...cachedTareas];

    // === BÚSQUEDA ===
    if (currentSearch.trim() !== "") {
      const q = currentSearch.toLowerCase();
      tareas = tareas.filter((t) =>
        (t.descripcion || "").toLowerCase().includes(q)
      );
    }

    // === ORDEN ===
    tareas = ordenarLocal(tareas);

    // ====================================================
    // EMPTY STATES — SOLO SE MUESTRA ACÁ Y NINGÚN OTRO LUGAR
    // ====================================================

    // No hay tareas en absoluto
    if (cachedTareas.length === 0) {
      emptyState.innerHTML = `
        <div>No hay tareas todavía</div>
        <div style="font-size: 13px; color: var(--muted)">
          Agrega tu primera tarea usando el campo en el sidebar.
        </div>
      `;
      emptyState.style.display = "block";
      renderList([]);
      renderPagination(1);
      return;
    }

    // No hay coincidencias
    if (tareas.length === 0) {
      emptyState.innerHTML = `
        <div>Sin resultados</div>
        <div style="font-size: 13px; color: var(--muted)">
          No se encontraron tareas que coincidan con tu búsqueda.
        </div>
      `;
      emptyState.style.display = "block";
      renderList([]);
      renderPagination(1);
      return;
    }

    // Hay tareas → ocultar mensaje
    emptyState.style.display = "none";

    // === PAGINACIÓN ===
    const totalItems = tareas.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    renderList(tareas.slice(start, end));
    renderPagination(totalPages);
    actualizarContadores();
  } catch (err) {
    isLoadingTareas = false;
    const msg = err?.name === "AbortError"
      ? "La petición tardó demasiado y fue cancelada."
      : "Error al obtener tareas: " + String(err);
    showNotification(msg, "error");
    showOfflineOverlay(msg);
  }
}



/* ============================
  Cálculo de botones visibles según tamaño ventana
============================ */
function getMaxVisibleButtons() {
  const w = window.innerWidth;
  if (w <= 480) return 5;
  if (w <= 768) return 7;
  return 11;
}

/* ============================
  Renderizado de controles de paginación
============================ */
function renderPagination(totalPages) {
  const container = document.getElementById("paginationControls");
  if (!container) return;
  container.innerHTML = "";

  // Aseguramos estilos programáticos útiles
  container.style.overflowX = "auto";
  container.style.whiteSpace = "nowrap";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.gap = "6px";

  // botón anterior (navega página)
  const prev = document.createElement("button");
  prev.textContent = "«";
  prev.disabled = currentPage === 1;
  prev.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      listarTareas();
    }
  };
  container.appendChild(prev);

  const maxButtons = Math.max(3, getMaxVisibleButtons()); // seguridad mínima
  // calculamos ventana centrada en currentPage
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let end = start + maxButtons - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxButtons + 1);
  }

  // helper para crear botones de página
  function createPageBtn(i) {
    const b = document.createElement("button");
    b.textContent = i;
    if (i === currentPage) b.classList.add("active");
    b.onclick = () => {
      if (currentPage !== i) {
        currentPage = i;
        listarTareas();
      }
    };
    return b;
  }

  // Si hay páginas antes de la ventana, mostrar 1 y un "..." que salte ventana atrás
  if (start > 1) {
    container.appendChild(createPageBtn(1));
    if (start > 2) {
      const dot = document.createElement("button");
      dot.textContent = "...";
      dot.title = "Ir a páginas anteriores";
      dot.onclick = () => {
        currentPage = Math.max(1, start - maxButtons);
        listarTareas();
      };
      container.appendChild(dot);
    }
  }

  // botones en la ventana actual
  for (let i = start; i <= end; i++) {
    container.appendChild(createPageBtn(i));
  }

  // Si hay páginas después de la ventana, mostrar "..." y última página
  if (end < totalPages) {
    if (end < totalPages - 1) {
      const dot2 = document.createElement("button");
      dot2.textContent = "...";
      dot2.title = "Ir a páginas siguientes";
      dot2.onclick = () => {
        currentPage = Math.min(totalPages, end + maxButtons);
        listarTareas();
      };
      container.appendChild(dot2);
    }
    container.appendChild(createPageBtn(totalPages));
  }

  // botón siguiente (navega página)
  const next = document.createElement("button");
  next.textContent = "»";
  next.disabled = currentPage === totalPages;
  next.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      listarTareas();
    }
  };
  container.appendChild(next);

  // Hacemos scroll para centrar el botón activo (efecto slider)
  requestAnimationFrame(() => {
    const active = container.querySelector("button.active");
    if (active) {
      // preferimos scrollIntoView para UX; si el contenedor no permite, no rompe nada
      try {
        active.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      } catch (e) {
        /* ignorar */
      }
    }
  });
}

// re-render ligero al redimensionar (debounced) para recalcular cantidad de botones
let __pagResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(__pagResizeTimer);
  __pagResizeTimer = setTimeout(() => {
    // si la lista ya está cargada, volvemos a listar para forzar renderPagination
    listarTareas();
  }, 120);
});

/* ============================
  Renderizado de la lista de tareas
============================ */
function renderList(tareas) {
  const ul = document.getElementById("listaTareas");
  ul.innerHTML = "";

  document.getElementById("total").textContent = `Total: ${tareas.length}`;
  document.getElementById("pendientes").textContent = `Pendientes: ${
    tareas.filter((t) => !t.completada).length
  }`;

  document.getElementById("emptyState").style.display =
    tareas.length === 0 ? "block" : "none";

  tareas.forEach((t) => {
    const li = document.createElement("li");
    li.className = t.completada ? "completed" : "";

    // Checkbox selección
    const sel = document.createElement("input");
    sel.type = "checkbox";
    sel.className = "sel-checkbox";
    sel.dataset.id = t.id;
    sel.checked = selectedIds.has(t.id);
    sel.addEventListener("change", (e) => {
      const id = Number(e.target.dataset.id);
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      // uncheck selectAll if not all selected
      const allBoxes = document.querySelectorAll(".sel-checkbox");
      const allChecked = [...allBoxes].every((b) => b.checked);
      document.getElementById("selectAll").checked = allChecked;
    });

    const left = document.createElement("div");
    left.className = "left";
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "10px";

    left.appendChild(sel);

    const desc = document.createElement("div");
    desc.className = "descripcion";
    desc.textContent = t.descripcion;

    const label = document.createElement("span");
    label.className = "priority-label " + priorityClass(t.prioridad);
    label.textContent = t.prioridad || "Media";

    left.appendChild(desc);
    left.appendChild(label);

    const controls = document.createElement("div");
    controls.className = "controls";

    // Editar (usa prompt para simplicidad)
    const btnEdit = document.createElement("button");
btnEdit.className = "small";
btnEdit.textContent = "Editar";

btnEdit.onclick = async () => {
  // Abrir modal de edición
  const nuevo = await openEditPanel(t.id, t.descripcion);

  // Usuario canceló
  if (nuevo === null) return;

  const texto = nuevo.trim();
  if (!texto) {
    showNotification("La descripción no puede estar vacía.", "error");
    return;
  }

  // Validar duplicado local
  const exists = cachedTareas.some(
    (other) =>
      other.id !== t.id &&
      (other.descripcion || "").trim().toLowerCase() === texto.toLowerCase()
  );
  if (exists) {
    showNotification("Otra tarea ya tiene esa descripción.", "error");
    return;
  }

  await editDescripcion(t.id, texto);  
  listarTareas();
};


    // Toggle completed
    const btnToggle = document.createElement("button");
    btnToggle.className = "small toggle";
    btnToggle.textContent = t.completada
      ? "Marcar Pendiente"
      : "Marcar Completada";
    btnToggle.onclick = async () => {
      await updateTarea(t.id, { completada: !t.completada });
      listarTareas();
    };

    // Priority inline select
    const select = document.createElement("select");
    select.className = "inline-select";
    ["Alta", "Media", "Baja"].forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (t.prioridad === p) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = async (e) => {
      await updateTarea(t.id, { prioridad: e.target.value });
      listarTareas();
    };

    const btnDelete = document.createElement("button");
    btnDelete.className = "small delete";
    btnDelete.textContent = "Eliminar";
    btnDelete.onclick = async () => {
      if (!(await confirmAction({
  title: "Eliminar tarea",
  message: "¿Eliminar esta tarea?",
  confirmText: "Eliminar",
  cancelText: "Cancelar",
  danger: true
}))) return;

      try {
        const res = await fetch(`${apiUrl}/${t.id}`, { method: "DELETE" });
        const body = await safeJson(res);
        if (!res.ok) {
          showNotification(body?.error || "Error al eliminar", "error");
          return;
        }
        showNotification(body?.message || "Tarea eliminada", "success");
        listarTareas();
      } catch (err) {
        showNotification("Error al eliminar: " + err, "error");
      }
    };

    controls.appendChild(btnEdit);
    controls.appendChild(btnToggle);
    controls.appendChild(select);
    controls.appendChild(btnDelete);
    // ahora verMas
    const verMas = crearVerMas(desc, t.descripcion);
    if (verMas) {
      if (currentView === "mini") {
        controls.appendChild(verMas);
      } else {
        // en lista, agregar después de descripción para que no quede oculto
        desc.parentElement.appendChild(verMas);
      }
    }
    li.appendChild(left);
    li.appendChild(controls);
    ul.appendChild(li);
  });

  // After render, set selectAll state correctly
  const allBoxes = document.querySelectorAll(".sel-checkbox");
  if (allBoxes.length > 0) {
    const allChecked = [...allBoxes].every((b) => b.checked);
    document.getElementById("selectAll").checked = allChecked;
  } else {
    document.getElementById("selectAll").checked = false;
  }
  
}

/* ============================
    CLASES DE PRIORIDAD
============================ */
function priorityClass(pr) {
  if (!pr) return "priority-media";
  if (pr.toLowerCase() === "alta") return "priority-alta";
  if (pr.toLowerCase() === "baja") return "priority-baja";
  return "priority-media";
}

/* ============================
    ACTUALIZAR TAREA
============================ */
async function updateTarea(id, body) {
  try {
    const res = await fetch(`${apiUrl}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await safeJson(res);
    if (!res.ok) {
      showNotification(b?.error || "Error al actualizar", "error");
    } else {
      showNotification(b?.message || "Tarea actualizada", "success");
    }
  } catch (err) {
    showNotification("Error en la petición: " + err, "error");
  }
}

/* ============================
    EDITAR DESCRIPCIÓN
============================ */
async function editDescripcion(id, descripcion) {
  try {
    const res = await fetch(`${apiUrl}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion }),
    });
    const b = await safeJson(res);
    if (!res.ok) {
      showNotification(b?.error || "Error al editar", "error");
    } else {
      showNotification(b?.message || "Descripción editada", "success");
    }
  } catch (err) {
    showNotification("Error en la petición: " + err, "error");
  }
}

/* ============================
    MARCAR SELECCIONADAS (COMPLETADAS / PENDIENTES)
============================ */
async function markSelectedCompleted(completed) {
  try {
    const ids = Array.from(selectedIds);
    const res = await fetch(`${apiUrl}/batch/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, completed }),
    });
    const b = await safeJson(res);
    if (!res.ok) {
      showNotification(b?.error || "Error al marcar seleccionadas", "error");
    } else {
      showNotification(b?.message || "Batch aplicado", "success");
      selectedIds.clear();
      document.getElementById("selectAll").checked = false;
    }
  } catch (err) {
    showNotification("Error en la petición: " + err, "error");
  }
}

/* ============================
   EXPORTAR DATOS (CSV / JSON)
============================ */
async function exportData(format) {
  try {
    let tareasAExportar = cachedTareas.filter(
      (t) =>
        (currentSearch || "").trim() === "" ||
        t.descripcion.toLowerCase().includes(currentSearch.toLowerCase())
    );

    if (selectedIds.size > 0) {
      tareasAExportar = tareasAExportar.filter((t) => selectedIds.has(t.id));
    }

    let blob;
    let filename;

    if (format === "csv") {
      // BOM para Excel y separación con ;
      const BOM = "\uFEFF";
      let csv =
        BOM +
        `"ID";"Descripción";"Completada";"Fecha de Creación";"Prioridad"\n`;

      tareasAExportar.forEach((t) => {
        const desc = t.descripcion ? t.descripcion.replace(/"/g, '""') : "";
        const completada = t.completada ? "Sí" : "No";
        const fecha = t.fechaCreacion
          ? new Date(t.fechaCreacion).toLocaleString("es-CO", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const prioridad = t.prioridad || "";
        csv += `"${t.id}";"${desc}";"${completada}";"${fecha}";"${prioridad}"\n`;
      });

      blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      filename = "tareas.csv";
    } else {
      blob = new Blob([JSON.stringify(tareasAExportar, null, 2)], {
        type: "application/json",
      });
      filename = "tareas.json";
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showNotification("Exportado correctamente", "success");
  } catch (err) {
    showNotification("Error al exportar: " + err, "error");
  }
}

/* ============================
   TEMA (light / dark)
============================ */
const btnThemeHeader = document.getElementById("btnTheme");
const btnThemeSidebar = document.getElementById("btnThemeSidebar");

const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") document.documentElement.classList.add("dark");

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  const dark = document.documentElement.classList.contains("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
}

btnThemeHeader?.addEventListener("click", toggleTheme);
btnThemeSidebar?.addEventListener("click", toggleTheme);

/* ============================
   VISTA (lista / mini)
============================ */
const VIEW_KEY = "view";
const btnLista = document.getElementById("btnVistaLista");
const btnMini = document.getElementById("btnVistaMini");
const ulLista = document.getElementById("listaTareas");

function isSmallScreen() {
  return window.matchMedia("(max-width:600px)").matches;
}

function viewGetStored() {
  return localStorage.getItem(VIEW_KEY) || "lista";
}

function viewSaveStored(v) {
  localStorage.setItem(VIEW_KEY, v);
}

if (ulLista) {
  window.currentView = isSmallScreen() ? "lista" : viewGetStored();

  window.aplicarVista = function (save = false) {
    let v = window.currentView === "mini" ? "mini" : "lista";
    if (isSmallScreen()) v = "lista";

    ulLista.classList.remove("mini", "lista");
    ulLista.classList.add(v);

    btnLista?.setAttribute("aria-pressed", v === "lista");
    btnMini?.setAttribute("aria-pressed", v === "mini");

    btnLista?.classList.toggle("view-btn-active", v === "lista");
    btnMini?.classList.toggle("view-btn-active", v === "mini");

    if (!isSmallScreen() && save) viewSaveStored(v);
  };

  btnLista?.addEventListener("click", () => {
    if (isSmallScreen()) return;
    window.currentView = "lista";
    aplicarVista(true);
  });

  btnMini?.addEventListener("click", () => {
    if (isSmallScreen()) return;
    window.currentView = "mini";
    aplicarVista(true);
  });

  window.addEventListener("resize", () => {
    if (isSmallScreen()) {
      window.currentView = "lista";
      aplicarVista(false);
    } else {
      const pref = viewGetStored();
      if (pref !== window.currentView) window.currentView = pref;
      aplicarVista(false);
    }
  });

  aplicarVista(false);
}

/* ============================
   SIDEBAR + OVERLAY
============================ */
const btnMenu = document.getElementById("btnMenu");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("overlay");

btnMenu?.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
});

overlay?.addEventListener("click", () => {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
});

/* ============================
   AJUSTE DE CONTROLES EN LISTA
============================ */
function ajustarControles() {
  const tareas = document.querySelectorAll(".task-grid.lista li");

  tareas.forEach((li) => {
    const btnEditar = li.querySelector(".controls .btn-editar");
    const btnVerMas = li.querySelector(".ver-mas-btn");
    const estado = li.querySelector(".status-badge");

    if (!btnEditar || !btnVerMas || !estado) return;

    const r1 = btnEditar.getBoundingClientRect();
    const r2 = btnVerMas.getBoundingClientRect();
    const r3 = estado.getBoundingClientRect();

    const colision =
      (r1.right > r2.left &&
        r1.left < r2.right &&
        r1.bottom > r2.top &&
        r1.top < r2.bottom) ||
      (r1.right > r3.left &&
        r1.left < r3.right &&
        r1.bottom > r3.top &&
        r1.top < r3.bottom);

    btnEditar.style.marginTop = colision ? "10px" : "0";
  });
}

window.addEventListener("resize", ajustarControles);
window.addEventListener("load", ajustarControles);
window.ajustarControles = ajustarControles; // si listas tareas dinámicamente

/* ============================
   EXPANDIR / COLAPSAR SIDEBAR
============================ */
/* ============================
   JS: controlar expandir/colapsar
   ============================ */
(function () {
  const btnExpand = document.getElementById("btnExpandSidebar");
  const sidebar = document.getElementById("appSidebar");
  const controls = document.getElementById("sidebarContent");
  const appBody = document.querySelector(".app-body") || document.documentElement; // fallback

  // Ajustes iniciales: asegura atributos ARIA correctos
  function setAria(expanded) {
    btnExpand.setAttribute("aria-expanded", String(expanded));
    sidebar.setAttribute("aria-expanded", String(expanded));
    controls.setAttribute("aria-hidden", String(!expanded));
  }

  setAria(!sidebar.classList.contains("collapsed"));

  // Toggle principal
  btnExpand.addEventListener("click", () => {
    // only on wide screens (como tenías)
    if (window.innerWidth >= 961) {
      const willCollapse = !sidebar.classList.contains("collapsed");
      // Cambiar clases
      sidebar.classList.toggle("collapsed");
      btnExpand.classList.toggle("active");

      // Actualizar aria
      setAria(!willCollapse);

      // Ajustar grid columnas (suavemente)
      if (appBody && appBody.style) {
        appBody.style.gridTemplateColumns = sidebar.classList.contains("collapsed")
          ? "var(--sidebar-collapsed-w) 1fr"
          : "var(--sidebar-w) 1fr";
      }
    } else {
      // para pantallas pequeñas puedes querer abrir/ocultar distinto; aquí dejamos comportamiento por defecto
      sidebar.classList.remove("collapsed");
      btnExpand.classList.remove("active");
      setAria(true);
    }
  });

  // Responsivo: restaurar estado correcto al redimensionar
  window.addEventListener("resize", () => {
    if (window.innerWidth < 961) {
      // en móvil siempre expandido (o tu lógica)
      sidebar.classList.remove("collapsed");
      btnExpand.classList.remove("active");
      setAria(true);
      if (appBody && appBody.style) appBody.style.gridTemplateColumns = "1fr";
    } else {
      // restaurar grid acorde al estado actual
      if (appBody && appBody.style) {
        appBody.style.gridTemplateColumns = sidebar.classList.contains("collapsed")
          ? "var(--sidebar-collapsed-w) 1fr"
          : "var(--sidebar-w) 1fr";
      }
    }
  });
})();


(function () {
  const overlay = document.getElementById('confirmOverlay');
  const titleEl = document.getElementById('confirmTitle');
  const bodyEl = document.getElementById('confirmBody');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  let queue = [];
  let active = false;
  let resolver = null;
  let lastFocused = null;
  let timeoutId = null;

  function show(opts) {
    titleEl.textContent = opts.title || 'Confirmar';
    bodyEl.textContent = opts.message || '';
    okBtn.textContent = opts.confirmText || 'Confirmar';
    cancelBtn.textContent = opts.cancelText || 'Cancelar';
    okBtn.classList.toggle('danger', !!opts.danger);
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    lastFocused = document.activeElement;
    // focus safety
    cancelBtn.focus();
    document.addEventListener('keydown', keyHandler, true);
  }

  function hide() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', keyHandler, true);
    if (lastFocused?.focus) lastFocused.focus();
  }

  function keyHandler(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === '\n')) { e.preventDefault(); okBtn.click(); }
  }

  async function processQueue() {
    if (active || queue.length === 0) return;
    active = true;
    const item = queue.shift();
    const opts = item.opts || {};

    show(opts);

    function finish(val) {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      hide();
      active = false;
      if (resolver) { resolver(val); resolver = null; }
      setTimeout(processQueue, 50);
    }

    okBtn.onclick = () => finish(true);
    cancelBtn.onclick = () => finish(false);
    overlay.onclick = (ev) => { if (ev.target === overlay) finish(false); };

    if (opts.timeout && Number(opts.timeout) > 0) {
      timeoutId = setTimeout(() => finish(false), Number(opts.timeout));
    }
  }

  window.confirmAction = function confirmAction(opts = {}) {
    return new Promise((resolve) => {
      queue.push({ opts });
      resolver = resolve;
      setTimeout(processQueue, 0);
    });
  };
})();

/* ---------------------------
   Edit modal -> openEditPanel(id, initial) -> Promise<string|null>
   devuelve null si cancelado
--------------------------- */
(function () {
  const overlay = document.getElementById('editOverlay');
  const textarea = document.getElementById('editTextarea');
  const saveBtn = document.getElementById('editSave');
  const cancelBtn = document.getElementById('editCancel');
  const taskIdEl = document.getElementById('editTaskId');

  let resolver = null;
  let currentId = null;
  let lastFocused = null;
  let saving = false;

  function open(id, initial) {
    currentId = id;
    taskIdEl.textContent = id ?? '—';
    textarea.value = initial ?? '';
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden','false');
    lastFocused = document.activeElement;
    setTimeout(() => textarea.focus(), 50);
    document.addEventListener('keydown', keyHandler, true);
  }

  function close() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', keyHandler, true);
    if (lastFocused?.focus) lastFocused.focus();
  }

  function keyHandler(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveBtn.click(); }
  }

  saveBtn.addEventListener('click', async () => {
    if (saving) return;
    const val = (textarea.value || '').trim();
    if (val.length === 0) {
      showNotification?.("La descripción no puede estar vacía", "error");
      textarea.focus();
      return;
    }
    saving = true;
    saveBtn.setAttribute('disabled','true');
    try {
      if (typeof editDescripcion === 'function') {
        await editDescripcion(currentId, val);
      } else {
        await fetch(`${apiUrl}/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descripcion: val }),
        });
      }
      close();
      if (resolver) { resolver(val); resolver = null; }
    } catch (err) {
      showNotification?.("Error al guardar: " + err, "error");
      if (resolver) { resolver(null); resolver = null; }
    } finally {
      saving = false;
      saveBtn.removeAttribute('disabled');
    }
  });

  cancelBtn.addEventListener('click', () => {
    close();
    if (resolver) { resolver(null); resolver = null; }
  });

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) {
      close();
      if (resolver) { resolver(null); resolver = null; }
    }
  });

  window.openEditPanel = function openEditPanel(id, initial = '') {
    return new Promise((resolve) => {
      resolver = resolve;
      open(id, initial);
    });
  };
})();