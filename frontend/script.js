const apiUrl = "http://localhost:8080/api/tareas";

let currentSort = "fecha";
let currentOrder = "asc";
let currentSearch = "";

// Listar tareas con parámetros de orden
async function listarTareas() {
  try {
    const res = await fetch(`${apiUrl}?sort=${currentSort}&order=${currentOrder}`);
    let tareas = await res.json();

    // Filtrar por búsqueda si hay texto
    if (currentSearch.trim() !== "") {
      const query = currentSearch.toLowerCase();
      tareas = tareas.filter(t => t.descripcion.toLowerCase().includes(query));
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

    const left = document.createElement("div");
    left.className = "left";

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

    const btnToggle = document.createElement("button");
    btnToggle.className = "small toggle";
    btnToggle.textContent = t.completada ? "Marcar Pendiente" : "Marcar Completada";
    btnToggle.onclick = async () => {
      await updateTarea(t.id, { completada: !t.completada });
      listarTareas();
    };

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

    controls.appendChild(btnToggle);
    controls.appendChild(select);
    controls.appendChild(btnDelete);

    li.appendChild(left);
    li.appendChild(controls);
    ul.appendChild(li);
  });
}

// Búsqueda en tiempo real
document.getElementById("searchInput").addEventListener("input", (e) => {
  currentSearch = e.target.value;
  listarTareas();
});

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

// Ordenamiento dinámico
document.getElementById("btnOrdenar").onclick = (e) => {
  e.preventDefault();
  currentSort = document.getElementById("sortSelect").value;
  currentOrder = document.getElementById("orderSelect").value;
  listarTareas();
};

listarTareas();
