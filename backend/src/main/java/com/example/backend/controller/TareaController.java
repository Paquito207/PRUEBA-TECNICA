package com.example.backend.controller;

import com.example.backend.model.Tarea;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    private List<Tarea> tareas = new ArrayList<>();
    private Long idCounter = 1L;
    private static final Set<String> PRIORIDADES = Set.of("Alta", "Media", "Baja");

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
        return ResponseEntity.ok(tarea);
    }

    /**
     * Actualiza campos permitidos: completada (Boolean), prioridad (String), descripcion (String).
     * Se permite body parcial.
     */
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

        return ResponseEntity.ok(tarea);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        boolean removed = tareas.removeIf(t -> t.getId().equals(id));
        if (removed) {
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));
        }
    }
}
