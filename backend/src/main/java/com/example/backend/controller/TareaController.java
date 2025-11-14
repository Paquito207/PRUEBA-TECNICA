package com.example.backend.controller;

import com.example.backend.model.Tarea;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    private List<Tarea> tareas = new ArrayList<>();
    private Long idCounter = 1L;
    private static final Set<String> PRIORIDADES = Set.of("Alta", "Media", "Baja");
    private static final File DATA_FILE = new File("tareas.json");
    private final ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public TareaController() {
        cargarTareas();
    }

    // Cargar tareas desde archivo JSON
    private void cargarTareas() {
        if (DATA_FILE.exists()) {
            try {
                tareas = mapper.readValue(DATA_FILE, new TypeReference<List<Tarea>>() {});
                // Ajustar idCounter
                idCounter = tareas.stream().mapToLong(Tarea::getId).max().orElse(0L) + 1;
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    // Guardar tareas a archivo JSON
    private void guardarTareas() {
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(DATA_FILE, tareas);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @GetMapping
    public List<Tarea> getAll() {
        return tareas;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Tarea tarea) {
        if (tarea.getDescripcion() == null || tarea.getDescripcion().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "La descripción es obligatoria"));
        }

        String pr = tarea.getPrioridad();
        if (pr == null || !PRIORIDADES.contains(pr)) {
            pr = "Media";
        }

        tarea.setId(idCounter++);
        tarea.setFechaCreacion(LocalDateTime.now());
        tarea.setCompletada(Boolean.FALSE);
        tarea.setPrioridad(pr);

        tareas.add(tarea);
        guardarTareas();
        return ResponseEntity.ok(tarea);
    }

    @PostMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Tarea updatedTarea) {
        Optional<Tarea> tareaOpt = tareas.stream().filter(t -> t.getId().equals(id)).findFirst();
        if (tareaOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));
        }

        Tarea tarea = tareaOpt.get();

        if (updatedTarea.getCompletada() != null) {
            tarea.setCompletada(updatedTarea.getCompletada());
        }

        if (updatedTarea.getPrioridad() != null) {
            if (!PRIORIDADES.contains(updatedTarea.getPrioridad())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Prioridad inválida. Use: Alta, Media, Baja"));
            }
            tarea.setPrioridad(updatedTarea.getPrioridad());
        }

        if (updatedTarea.getDescripcion() != null && !updatedTarea.getDescripcion().trim().isEmpty()) {
            tarea.setDescripcion(updatedTarea.getDescripcion());
        }

        guardarTareas();
        return ResponseEntity.ok(tarea);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        boolean removed = tareas.removeIf(t -> t.getId().equals(id));
        if (removed) {
            guardarTareas();
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));
        }
    }
}
