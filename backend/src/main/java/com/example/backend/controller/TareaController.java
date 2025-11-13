package com.example.backend.controller;

import com.example.backend.model.Tarea;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    private List<Tarea> tareas = new ArrayList<>();
    private Long idCounter = 1L;

    @GetMapping
    public List<Tarea> getAll() {
        return tareas;
    }

    @PostMapping
    public Tarea create(@RequestBody Tarea tarea) {
        tarea.setId(idCounter++);
        tarea.setFechaCreacion(java.time.LocalDateTime.now());
        tarea.setCompletada(false);
        tareas.add(tarea);
        return tarea;
    }

    @PostMapping("/{id}")
    public Tarea update(@PathVariable Long id, @RequestBody Tarea updatedTarea) {
        Optional<Tarea> tareaOpt = tareas.stream().filter(t -> t.getId().equals(id)).findFirst();
        if (tareaOpt.isPresent()) {
            Tarea tarea = tareaOpt.get();
            tarea.setCompletada(updatedTarea.isCompletada());
            return tarea;
        }
        throw new RuntimeException("Tarea no encontrada");
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        tareas.removeIf(t -> t.getId().equals(id));
    }
}
