package com.example.backend.controller;

import com.example.backend.model.Tarea;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    private List<Tarea> tareas = new ArrayList<>();
    private Long idCounter = 1L;
    private static final Set<String> PRIORIDADES = Set.of("Alta", "Media", "Baja");
    private static final Path DATA_PATH = Paths.get(System.getProperty("user.dir"), "tareas.json");

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final ReentrantLock lock = new ReentrantLock();

    public TareaController() {
        ensureFileExists();
        cargarTareas();
    }

    /* ---------- Persistencia segura ---------- */

    private void ensureFileExists() {
        try {
            File f = DATA_PATH.toFile();
            if (!f.exists()) {
                Files.createDirectories(DATA_PATH.getParent() == null ? Paths.get(".") : DATA_PATH.getParent());
                mapper.writerWithDefaultPrettyPrinter().writeValue(f, new ArrayList<Tarea>());
            } else {
                if (Files.size(DATA_PATH) == 0) {
                    mapper.writerWithDefaultPrettyPrinter().writeValue(DATA_PATH.toFile(), new ArrayList<Tarea>());
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void cargarTareas() {
        lock.lock();
        try {
            if (!Files.exists(DATA_PATH)) {
                tareas = new ArrayList<>();
                idCounter = 1L;
                return;
            }
            try {
                tareas = mapper.readValue(DATA_PATH.toFile(), new TypeReference<List<Tarea>>() {});
                idCounter = tareas.stream()
                        .filter(Objects::nonNull)
                        .mapToLong(t -> t.getId() == null ? 0L : t.getId())
                        .max().orElse(0L) + 1;
            } catch (Exception ex) {
                System.err.println("Error al leer tareas.json — realizando backup y reinicializando. Error: " + ex.getMessage());
                backupCorruptFile();
                tareas = new ArrayList<>();
                idCounter = 1L;
                guardarTareas();
            }
        } finally {
            lock.unlock();
        }
    }

    private void backupCorruptFile() {
        try {
            String ts = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
            Path backup = Paths.get(DATA_PATH.toString() + ".bak." + ts);
            Files.copy(DATA_PATH, backup, StandardCopyOption.REPLACE_EXISTING);
            System.err.println("Backup creado en: " + backup.toString());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void guardarTareas() {
        lock.lock();
        try {
            Path dir = DATA_PATH.getParent() == null ? Paths.get(".") : DATA_PATH.getParent();
            Path tempFile = Files.createTempFile(dir, "tareas", ".tmp");
            try {
                mapper.writerWithDefaultPrettyPrinter().writeValue(tempFile.toFile(), tareas);
                try {
                    Files.move(tempFile, DATA_PATH, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                } catch (AtomicMoveNotSupportedException amnse) {
                    Files.move(tempFile, DATA_PATH, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                if (Files.exists(tempFile)) {
                    try { Files.deleteIfExists(tempFile); } catch (IOException ignored) {}
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            lock.unlock();
        }
    }

    /* ---------- Endpoints ---------- */

    // Listar con orden opcional (sort, order)
    @GetMapping
    public ResponseEntity<?> getAll(@RequestParam(required = false) String sort,
                                    @RequestParam(required = false, defaultValue = "asc") String order) {
        List<Tarea> copy;
        lock.lock();
        try {
            copy = new ArrayList<>(tareas);
        } finally {
            lock.unlock();
        }
        if (sort != null && !sort.isBlank()) {
            applySort(copy, sort, order);
        }
        return ResponseEntity.ok(Map.of("message", "Lista de tareas obtenida", "tareas", copy));
    }

    // Crear (201 Created + body con mensaje)
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Tarea tarea) {
        if (tarea.getDescripcion() == null || tarea.getDescripcion().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "La descripción es obligatoria"));
        }

        // validar duplicado por descripción (case-insensitive)
        String nuevaDesc = tarea.getDescripcion().trim().toLowerCase();
        lock.lock();
        try {
            boolean exists = tareas.stream()
                    .anyMatch(t -> t.getDescripcion() != null && t.getDescripcion().trim().toLowerCase().equals(nuevaDesc));
            if (exists) {
                return ResponseEntity.status(400).body(Map.of("error", "Tarea duplicada"));
            }
        } finally {
            lock.unlock();
        }

        String pr = tarea.getPrioridad();
        if (pr == null || !PRIORIDADES.contains(pr)) pr = "Media";

        tarea.setId(nextId());
        tarea.setFechaCreacion(LocalDateTime.now());
        tarea.setCompletada(Boolean.FALSE);
        tarea.setPrioridad(pr);

        lock.lock();
        try {
            tareas.add(tarea);
            guardarTareas();
        } finally {
            lock.unlock();
        }

        return ResponseEntity.ok(tarea);

    }

    // Actualización parcial (completada/prioridad/descripcion)
    @PostMapping("/{id}")
    public ResponseEntity<?> updatePartial(@PathVariable Long id, @RequestBody Tarea updatedTarea) {
        lock.lock();
        try {
            Optional<Tarea> tareaOpt = tareas.stream().filter(t -> t.getId().equals(id)).findFirst();
            if (tareaOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));

            Tarea tarea = tareaOpt.get();

            if (updatedTarea.getCompletada() != null) tarea.setCompletada(updatedTarea.getCompletada());

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
            return ResponseEntity.ok(Map.of("message", "Tarea actualizada", "tarea", tarea));
        } finally {
            lock.unlock();
        }
    }

    // PUT para editar descripción (gestión avanzada)
    @PutMapping("/{id}")
    public ResponseEntity<?> editDescripcion(@PathVariable Long id, @RequestBody Map<String,String> body) {
        String desc = body.get("descripcion");
        if (desc == null || desc.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "La descripción es obligatoria"));
        }
        lock.lock();
        try {
            Optional<Tarea> tareaOpt = tareas.stream().filter(t -> t.getId().equals(id)).findFirst();
            if (tareaOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));

            Tarea tarea = tareaOpt.get();
            tarea.setDescripcion(desc.trim());
            guardarTareas();
            return ResponseEntity.ok(Map.of("message", "Descripción editada", "tarea", tarea));
        } finally {
            lock.unlock();
        }
    }

    // Eliminar individual
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        lock.lock();
        try {
            boolean removed = tareas.removeIf(t -> t.getId().equals(id));
            if (removed) {
                guardarTareas();
                return ResponseEntity.ok(Map.of("message", "Tarea eliminada", "id", id));
            } else {
                return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));
            }
        } finally {
            lock.unlock();
        }
    }

    // Endpoint batch: marcar varias tareas como completadas/pendientes
    @PostMapping("/batch/complete")
    public ResponseEntity<?> batchComplete(@RequestBody Map<String, Object> payload) {
        Object idsObj = payload.get("ids");
        Object completedObj = payload.get("completed");
        if (idsObj == null || !(idsObj instanceof List) || completedObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payload inválido. Use { ids: [1,2], completed: true }"));
        }
        @SuppressWarnings("unchecked")
        List<Number> idsNum = (List<Number>) idsObj;
        boolean completed = Boolean.parseBoolean(String.valueOf(completedObj));

        lock.lock();
        try {
            List<Long> updated = new ArrayList<>();
            Set<Long> idSet = idsNum.stream().map(Number::longValue).collect(Collectors.toSet());
            for (Tarea t : tareas) {
                if (idSet.contains(t.getId())) {
                    t.setCompletada(completed);
                    updated.add(t.getId());
                }
            }
            if (!updated.isEmpty()) guardarTareas();
            return ResponseEntity.ok(Map.of("message", "Batch actualizado", "updated", updated));
        } finally {
            lock.unlock();
        }
    }

    // Nuevo: eliminar múltiples
    @DeleteMapping("/batch/delete")
    public ResponseEntity<?> batchDelete(@RequestBody Map<String, Object> payload) {
        Object idsObj = payload.get("ids");
        if (idsObj == null || !(idsObj instanceof List)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payload inválido. Use { ids:[1,2,3] }"));
        }
        @SuppressWarnings("unchecked")
        List<Number> idsNum = (List<Number>) idsObj;
        Set<Long> ids = idsNum.stream().map(Number::longValue).collect(Collectors.toSet());

        lock.lock();
        try {
            List<Long> deleted = new ArrayList<>();
            Iterator<Tarea> it = tareas.iterator();
            while (it.hasNext()) {
                Tarea t = it.next();
                if (ids.contains(t.getId())) {
                    deleted.add(t.getId());
                    it.remove();
                }
            }
            if (!deleted.isEmpty()) guardarTareas();
            return ResponseEntity.ok(Map.of("message", "Tareas eliminadas", "deleted", deleted));
        } finally {
            lock.unlock();
        }
    }

    // Nuevo: cambiar prioridad en lote
    @PostMapping("/batch/prioridad")
    public ResponseEntity<?> batchPrioridad(@RequestBody Map<String, Object> payload) {
        Object idsObj = payload.get("ids");
        Object prObj = payload.get("prioridad");

        if (idsObj == null || !(idsObj instanceof List) || prObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error","Payload inválido. Use { ids:[1,2], prioridad:'Alta' }"));
        }

        String nuevaPr = String.valueOf(prObj);
        if (!PRIORIDADES.contains(nuevaPr)) {
            return ResponseEntity.badRequest().body(Map.of("error","Prioridad inválida. Use Alta, Media o Baja"));
        }

        @SuppressWarnings("unchecked")
        List<Number> idsNum = (List<Number>) idsObj;
        Set<Long> ids = idsNum.stream().map(Number::longValue).collect(Collectors.toSet());

        lock.lock();
        try {
            List<Long> updated = new ArrayList<>();
            for (Tarea t : tareas) {
                if (ids.contains(t.getId())) {
                    t.setPrioridad(nuevaPr);
                    updated.add(t.getId());
                }
            }
            if (!updated.isEmpty()) guardarTareas();
            return ResponseEntity.ok(Map.of("message", "Prioridad actualizada en lote", "updated", updated));
        } finally {
            lock.unlock();
        }
    }

    // Exportar tareas: ?format=csv|json
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false, defaultValue = "json") String format) {
        lock.lock();
        try {
            if ("csv".equalsIgnoreCase(format)) {
                StringBuilder sb = new StringBuilder();
                sb.append("id,descripcion,completada,fechaCreacion,prioridad\n");
                for (Tarea t : tareas) {
                    String desc = t.getDescripcion() == null ? "" : t.getDescripcion().replace("\"","\"\"");
                    sb.append(t.getId()).append(",\"").append(desc).append("\",")
                      .append(t.getCompletada() == null ? false : t.getCompletada()).append(",")
                      .append(t.getFechaCreacion() == null ? "" : t.getFechaCreacion().toString()).append(",")
                      .append(t.getPrioridad() == null ? "" : t.getPrioridad()).append("\n");
                }
                byte[] bytes = sb.toString().getBytes();
                HttpHeaders headers = new HttpHeaders();
                headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=tareas.csv");
                headers.setContentType(MediaType.parseMediaType("text/csv; charset=utf-8"));
                return ResponseEntity.ok().headers(headers).body(bytes);
            } else {
                byte[] bytes = mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(tareas);
                HttpHeaders headers = new HttpHeaders();
                headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=tareas.json");
                headers.setContentType(MediaType.APPLICATION_JSON);
                return ResponseEntity.ok().headers(headers).body(bytes);
            }
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(("Error al exportar: "+e.getMessage()).getBytes());
        } finally {
            lock.unlock();
        }
    }

    /* ---------- Helpers ---------- */

    private long nextId() {
        return idCounter++;
    }

    private void applySort(List<Tarea> lista, String sort, String order) {
        Comparator<Tarea> comparator = null;
        String ord = (order == null) ? "asc" : order.toLowerCase();

        switch (sort.toLowerCase()) {
            case "prioridad":
                Map<String, Integer> rank = Map.of("Alta", 3, "Media", 2, "Baja", 1);
                comparator = Comparator.comparingInt(t -> rank.getOrDefault(
                        Optional.ofNullable(t.getPrioridad()).orElse("Media"), 2));
                break;
            case "fecha":
            case "fechacreacion":
                comparator = Comparator.comparing(Tarea::getFechaCreacion, Comparator.nullsLast(Comparator.naturalOrder()));
                break;
            case "descripcion":
                comparator = Comparator.comparing(Tarea::getDescripcion, Comparator.nullsLast(String::compareToIgnoreCase));
                break;
            default:
                return;
        }

        if ("desc".equals(ord)) comparator = comparator.reversed();
        lista.sort(comparator);
    }
}
