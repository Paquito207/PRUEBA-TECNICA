package com.example.backend.model;

import java.time.LocalDateTime;

public class Tarea {
    private Long id;
    private String descripcion;
    private Boolean completada;
    private LocalDateTime fechaCreacion;
    private String prioridad; // "Alta", "Media", "Baja"

    public Tarea() {}

    public Tarea(Long id, String descripcion, String prioridad) {
        this.id = id;
        this.descripcion = descripcion;
        this.completada = false;
        this.fechaCreacion = LocalDateTime.now();
        this.prioridad = prioridad == null ? "Media" : prioridad;
    }

    // Getters y setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public Boolean getCompletada() { return completada; }
    public void setCompletada(Boolean completada) { this.completada = completada; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    public String getPrioridad() { return prioridad; }
    public void setPrioridad(String prioridad) { this.prioridad = prioridad; }
}
