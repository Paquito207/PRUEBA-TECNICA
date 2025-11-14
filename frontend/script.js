const apiUrl = "http://localhost:8080/api/tareas";

let currentSort = "fecha";
let currentOrder = "asc";
let currentSearch = "";
const selectedIds = new Set();
let cachedTareas = []; // cache local para validaciones y evitar fetchs extra

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("btnOrdenar").onclick = (e) => {
    e.preventDefault();
    currentSort = document.getElementById("sortSelect").value;
    currentOrder = document.getElementById("orderSelect").value;
    listarTareas();
  };

  document.getElementById("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    listarTareas();
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
    const existe = cachedTareas.some(t => (t.descripcion || "").trim().toLowerCase() === descripcion.toLowerCase());
    if (existe) {
      showNotification("Ya existe una tarea con esa descripción.", "error");
      return;
    }

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion, prioridad })
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
    if (selectedIds.size === 0) { showNotification("No hay tareas seleccionadas.", "info"); return; }
    if (!confirm("Marcar las tareas seleccionadas como completadas?")) return;
    await markSelectedCompleted(true);
    listarTareas();
  };

  document.getElementById("btnMarcarPendientes").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) { showNotification("No hay tareas seleccionadas.", "info"); return; }
    if (!confirm("Marcar las tareas seleccionadas como pendientes?")) return;
    await markSelectedCompleted(false);
    listarTareas();
  };

  document.getElementById("btnEliminarSeleccionadas").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) { showNotification("No hay tareas seleccionadas.", "info"); return; }
    if (!confirm("Eliminar las tareas seleccionadas?")) return;

    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`${apiUrl}/batch/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      const body = await safeJson(res);
      if (!res.ok) {
        showNotification(body?.error || "Error al eliminar", "error");
        return;
      }
      showNotification(body?.message || "Tareas eliminadas", "success");
      selectedIds.clear();
      document.getElementById('selectAll').checked = false;
      listarTareas();
    } catch (err) {
      showNotification("Error al eliminar seleccionadas: " + err, "error");
    }
  };

  document.getElementById("btnAplicarPrioridad").onclick = async (e) => {
    e.preventDefault();
    const prioridad = document.getElementById("selCambiarPrioridad").value;
    if (!prioridad) { showNotification("Seleccione una prioridad.", "info"); return; }
    if (selectedIds.size === 0) { showNotification("No hay tareas seleccionadas.", "info"); return; }
    if (!confirm(`Cambiar prioridad de las seleccionadas a "${prioridad}"?`)) return;

    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`${apiUrl}/batch/prioridad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, prioridad })
      });
      const body = await safeJson(res);
      if (!res.ok) {
        showNotification(body?.error || "Error al cambiar prioridad", "error");
        return;
      }
      showNotification(body?.message || "Prioridad cambiada", "success");
      selectedIds.clear();
      document.getElementById('selectAll').checked = false;
      document.getElementById("selCambiarPrioridad").value = "";
      listarTareas();
    } catch (err) {
      showNotification("Error al cambiar prioridad: " + err, "error");
    }
  };

  document.getElementById("btnExportCSV").onclick = (e) => { e.preventDefault(); exportData('csv'); };
  document.getElementById("btnExportJSON").onclick = (e) => { e.preventDefault(); exportData('json'); };

  document.getElementById("selectAll").addEventListener('change', (e) => {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.sel-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = checked;
      const id = Number(cb.dataset.id);
      if (checked) selectedIds.add(id); else selectedIds.delete(id);
    });
  });

  listarTareas();
});

// safe parse JSON helper
async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// mostrar notificación simple (toast)
function showNotification(message, type = "info", ttl = 4000) {
  const container = document.getElementById('notif-container');
  if (!container) return alert(message);
  const el = document.createElement('div');
  el.className = `notif ${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.remove(); }, 300);
  }, ttl);
}

// Listar tareas con parámetros de orden
async function listarTareas() {
  try {
    const res = await fetch(`${apiUrl}?sort=${currentSort}&order=${currentOrder}`);
    const body = await safeJson(res);
    if (!res.ok) {
      showNotification(body?.error || "Error al obtener tareas", "error");
      return;
    }
    // backend returns { message, tareas }
    const tareas = body?.tareas ?? [];
    cachedTareas = tareas; // actualizar cache local
    // Filtrar por búsqueda (cliente)
    let filtered = tareas;
    if ((currentSearch || "").trim() !== "") {
      const q = currentSearch.toLowerCase();
      filtered = tareas.filter(t => (t.descripcion || "").toLowerCase().includes(q));
    }
    renderList(filtered);
  } catch (err) {
    showNotification("Error al obtener tareas: " + err, "error");
  }
}

function renderList(tareas) {
  const ul = document.getElementById("listaTareas");
  ul.innerHTML = "";

  document.getElementById("total").textContent = `Total: ${tareas.length}`;
  document.getElementById("pendientes").textContent = `Pendientes: ${tareas.filter(t => !t.completada).length}`;

  tareas.forEach(t => {
    const li = document.createElement("li");
    li.className = t.completada ? "completed" : "";

    // Checkbox selección
    const sel = document.createElement("input");
    sel.type = "checkbox";
    sel.className = "sel-checkbox";
    sel.dataset.id = t.id;
    sel.checked = selectedIds.has(t.id);
    sel.addEventListener('change', (e) => {
      const id = Number(e.target.dataset.id);
      if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
      // uncheck selectAll if not all selected
      const allBoxes = document.querySelectorAll('.sel-checkbox');
      const allChecked = [...allBoxes].every(b => b.checked);
      document.getElementById('selectAll').checked = allChecked;
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
      const nuevo = prompt("Editar descripción:", t.descripcion);
      if (nuevo === null) return; // cancel
      const texto = nuevo.trim();
      if (!texto) { showNotification("La descripción no puede estar vacía.", "error"); return; }

      // validar duplicado local (evitar colisiones)
      const exists = cachedTareas.some(other => other.id !== t.id && (other.descripcion || "").trim().toLowerCase() === texto.toLowerCase());
      if (exists) { showNotification("Otra tarea ya tiene esa descripción.", "error"); return; }

      await editDescripcion(t.id, texto);
      listarTareas();
    };

    // Toggle completed
    const btnToggle = document.createElement("button");
    btnToggle.className = "small toggle";
    btnToggle.textContent = t.completada ? "Marcar Pendiente" : "Marcar Completada";
    btnToggle.onclick = async () => {
      await updateTarea(t.id, { completada: !t.completada });
      listarTareas();
    };

    // Priority inline select
    const select = document.createElement("select");
    select.className = "inline-select";
    ["Alta","Media","Baja"].forEach(p => {
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
      if (!confirm("¿Eliminar esta tarea?")) return;
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

    li.appendChild(left);
    li.appendChild(controls);
    ul.appendChild(li);
  });

  // After render, set selectAll state correctly
  const allBoxes = document.querySelectorAll('.sel-checkbox');
  if (allBoxes.length > 0) {
    const allChecked = [...allBoxes].every(b => b.checked);
    document.getElementById('selectAll').checked = allChecked;
  } else {
    document.getElementById('selectAll').checked = false;
  }
}

function priorityClass(pr) {
  if (!pr) return "priority-media";
  if (pr.toLowerCase() === "alta") return "priority-alta";
  if (pr.toLowerCase() === "baja") return "priority-baja";
  return "priority-media";
}

async function updateTarea(id, body) {
  try {
    const res = await fetch(`${apiUrl}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
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

async function editDescripcion(id, descripcion) {
  try {
    const res = await fetch(`${apiUrl}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion })
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

async function markSelectedCompleted(completed) {
  try {
    const ids = Array.from(selectedIds);
    const res = await fetch(`${apiUrl}/batch/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, completed })
    });
    const b = await safeJson(res);
    if (!res.ok) {
      showNotification(b?.error || "Error al marcar seleccionadas", "error");
    } else {
      showNotification(b?.message || "Batch aplicado", "success");
      selectedIds.clear();
      document.getElementById('selectAll').checked = false;
    }
  } catch (err) {
    showNotification("Error en la petición: " + err, "error");
  }
}

async function exportData(format) {
  try {
    const res = await fetch(`${apiUrl}/export?format=${format}`);
    if (!res.ok) {
      const text = await res.text();
      return showNotification("Error al exportar: " + text, "error");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = format === 'csv' ? 'tareas.csv' : 'tareas.json';
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
