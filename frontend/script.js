const apiUrl = "http://localhost:8080/api/tareas";

let currentSort = "fecha";
let currentOrder = "asc";
let currentSearch = "";
const selectedIds = new Set();

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
    if (!descripcion) return alert("La descripción es obligatoria.");

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion, prioridad })
      });
      if (!res.ok) {
        const err = await res.json();
        return alert("Error al crear: " + (err.error || res.statusText));
      }
      document.getElementById("descripcion").value = "";
      document.getElementById("prioridad").value = "Media";
      listarTareas();
    } catch (err) {
      alert("Error al crear tarea: " + err);
    }
  };

  // Marcar seleccionadas como completadas
  document.getElementById("btnMarcarSeleccionadas").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return alert("No hay tareas seleccionadas.");
    if (!confirm("Marcar las tareas seleccionadas como completadas?")) return;
    await markSelectedCompleted(true);
    listarTareas();
  };

  // NUEVO: Marcar seleccionadas como pendientes
  document.getElementById("btnMarcarPendientes").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return alert("No hay tareas seleccionadas.");
    if (!confirm("Marcar las tareas seleccionadas como pendientes?")) return;
    await markSelectedCompleted(false);
    listarTareas();
  };

  // Eliminar seleccionadas
  document.getElementById("btnEliminarSeleccionadas").onclick = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return alert("No hay tareas seleccionadas.");
    if (!confirm("Eliminar las tareas seleccionadas?")) return;

    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`${apiUrl}/batch/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });

      if (!res.ok) {
        const err = await res.json();
        return alert("Error al eliminar: " + (err.error || res.statusText));
      }

      selectedIds.clear();
      document.getElementById('selectAll').checked = false;
      listarTareas();
    } catch (err) {
      alert("Error al eliminar seleccionadas: " + err);
    }
  };

  // Aplicar prioridad en lote
  document.getElementById("btnAplicarPrioridad").onclick = async (e) => {
    e.preventDefault();
    const prioridad = document.getElementById("selCambiarPrioridad").value;
    if (!prioridad) return alert("Seleccione una prioridad.");
    if (selectedIds.size === 0) return alert("No hay tareas seleccionadas.");
    if (!confirm(`Cambiar prioridad de las seleccionadas a "${prioridad}"?`)) return;

    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`${apiUrl}/batch/prioridad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, prioridad })
      });

      if (!res.ok) {
        const err = await res.json();
        return alert("Error al cambiar prioridad: " + (err.error || res.statusText));
      }

      selectedIds.clear();
      document.getElementById('selectAll').checked = false;
      document.getElementById("selCambiarPrioridad").value = "";
      listarTareas();
    } catch (err) {
      alert("Error al cambiar prioridad: " + err);
    }
  };

  document.getElementById("btnExportCSV").onclick = (e) => {
    e.preventDefault();
    exportData('csv');
  };

  document.getElementById("btnExportJSON").onclick = (e) => {
    e.preventDefault();
    exportData('json');
  };

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

// Listar tareas con parámetros de orden
async function listarTareas() {
  try {
    const res = await fetch(`${apiUrl}?sort=${currentSort}&order=${currentOrder}`);
    let tareas = await res.json();

    // Filtrar por búsqueda (cliente)
    if ((currentSearch || "").trim() !== "") {
      const q = currentSearch.toLowerCase();
      tareas = tareas.filter(t => (t.descripcion || "").toLowerCase().includes(q));
    }

    renderList(tareas);
  } catch (err) {
    alert("Error al obtener tareas: " + err);
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
      if (!texto) return alert("La descripción no puede estar vacía.");
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
      await fetch(`${apiUrl}/${t.id}`, { method: "DELETE" });
      listarTareas();
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
    if (!res.ok) {
      const err = await res.json();
      alert("Error al actualizar: " + (err.error || res.statusText));
    }
  } catch (err) {
    alert("Error en la petición: " + err);
  }
}

async function editDescripcion(id, descripcion) {
  try {
    const res = await fetch(`${apiUrl}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion })
    });
    if (!res.ok) {
      const err = await res.json();
      alert("Error al editar: " + (err.error || res.statusText));
    }
  } catch (err) {
    alert("Error en la petición: " + err);
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
    if (!res.ok) {
      const err = await res.json();
      alert("Error al marcar seleccionadas: " + (err.error || res.statusText));
    } else {
      selectedIds.clear();
      document.getElementById('selectAll').checked = false;
    }
  } catch (err) {
    alert("Error en la petición: " + err);
  }
}

async function exportData(format) {
  try {
    const res = await fetch(`${apiUrl}/export?format=${format}`);
    if (!res.ok) {
      const text = await res.text();
      return alert("Error al exportar: " + text);
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
  } catch (err) {
    alert("Error al exportar: " + err);
  }
}
