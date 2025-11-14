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
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    private List<Tarea> tareas = new ArrayList<>();
    private Long idCounter = 1L;
    private static final Set<String> PRIORIDADES = Set.of("Alta", "Media", "Baja");
    // Archivo en la raíz del directorio de ejecución
    private static final Path DATA_PATH = Paths.get(System.getProperty("user.dir"), "tareas.json");

    // Jackson configurado para Java Time
    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    // Lock para proteger lecturas/escrituras concurrentes
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
                // crear archivo y escribir array vacío
                Files.createDirectories(DATA_PATH.getParent() == null ? Paths.get(".") : DATA_PATH.getParent());
                mapper.writerWithDefaultPrettyPrinter().writeValue(f, new ArrayList<Tarea>());
            } else {
                // si el archivo existe pero está vacío, inicializar con []
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

            // leer contenido y parsear
            try {
                // Si el archivo está vacío devolvemos lista vacía (ya asegurado en ensureFileExists)
                tareas = mapper.readValue(DATA_PATH.toFile(), new TypeReference<List<Tarea>>() {});
                idCounter = tareas.stream()
                        .filter(Objects::nonNull)
                        .mapToLong(t -> t.getId() == null ? 0L : t.getId())
                        .max().orElse(0L) + 1;
            } catch (Exception ex) {
                // Si falla la lectura (JSON corrupto), hacer backup y reiniciar archivo
                System.err.println("Error al leer tareas.json — realizando backup y reinicializando. Error: " + ex.getMessage());
                backupCorruptFile();
                tareas = new ArrayList<>();
                idCounter = 1L;
                guardarTareas(); // crear archivo válido
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
            // escribir en archivo temporal en la misma carpeta
            Path dir = DATA_PATH.getParent() == null ? Paths.get(".") : DATA_PATH.getParent();
            Path tempFile = Files.createTempFile(dir, "tareas", ".tmp");
            try {
                mapper.writerWithDefaultPrettyPrinter().writeValue(tempFile.toFile(), tareas);
                // mover de forma atómica cuando sea posible
                try {
                    Files.move(tempFile, DATA_PATH, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                } catch (AtomicMoveNotSupportedException amnse) {
                    // fallback si el FS no soporta ATOMIC_MOVE
                    Files.move(tempFile, DATA_PATH, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                // asegurar que el temp no quede
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

    @GetMapping
    public List<Tarea> getAll(@RequestParam(required = false) String sort,
                              @RequestParam(required = false, defaultValue = "asc") String order) {
        // devolver copia para evitar que el cliente modifique la lista interna
        List<Tarea> copy;
        lock.lock();
        try {
            copy = new ArrayList<>(tareas);
        } finally {
            lock.unlock();
        }
        // si se piden parámetros de ordenamiento, aplicar aquí (backend)
        if (sort != null && !sort.isBlank()) {
            applySort(copy, sort, order);
        }
        return copy;
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

    @PostMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Tarea updatedTarea) {
        lock.lock();
        try {
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
        } finally {
            lock.unlock();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        lock.lock();
        try {
            boolean removed = tareas.removeIf(t -> t.getId().equals(id));
            if (removed) {
                guardarTareas();
                return ResponseEntity.noContent().build();
            } else {
                return ResponseEntity.status(404).body(Map.of("error", "Tarea no encontrada"));
            }
        } finally {
            lock.unlock();
        }
    }

    /* ---------- Helpers ---------- */

    private long nextId() {
        // simple pero seguro gracias al lock alrededor de llamadas que mutan la lista
        return idCounter++;
    }

    private void applySort(List<Tarea> lista, String sort, String order) {
        Comparator<Tarea> comparator = null;
        String ord = (order == null) ? "asc" : order.toLowerCase();

        switch (sort.toLowerCase()) {
            case "prioridad":
                // definir prioridad: Alta > Media > Baja
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
                return; // no aplica
        }

        if ("desc".equals(ord)) {
            comparator = comparator.reversed();
        }
        lista.sort(comparator);
    }
}
