const apiUrl = "http://localhost:8080/api/tareas";

async function listarTareas() {
    const res = await fetch(apiUrl);
    const tareas = await res.json();
    const ul = document.getElementById("listaTareas");
    ul.innerHTML = "";
    tareas.forEach(t => {
        const li = document.createElement("li");
        li.textContent = t.descripcion;
        if(t.completada) li.classList.add("completed");

        const btnToggle = document.createElement("button");
        btnToggle.textContent = t.completada ? "Pendiente" : "Completada";
        btnToggle.onclick = async () => {
            await fetch(`${apiUrl}/${t.id}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completada: !t.completada })
            });
            listarTareas();
        }

        const btnDelete = document.createElement("button");
        btnDelete.textContent = "Eliminar";
        btnDelete.onclick = async () => {
            await fetch(`${apiUrl}/${t.id}`, { method: "DELETE" });
            listarTareas();
        }

        li.appendChild(btnToggle);
        li.appendChild(btnDelete);
        ul.appendChild(li);
    });
}

document.getElementById("formTarea").onsubmit = async (e) => {
    e.preventDefault();
    const descripcion = document.getElementById("descripcion").value;
    await fetch(apiUrl, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion })
    });
    document.getElementById("descripcion").value = "";
    listarTareas();
}

listarTareas();
