# PRUEBA-TECNICA
Mini Sistema de Gestión de Tareas

## Resumen
Proyecto full‑stack simple: backend en Spring Boot (Java) que persiste en `tareas.json` y frontend estático en HTML/CSS/JS (carpeta `frontend`) que consume la API en `http://localhost:8080/api/tareas`.

---

## Requisitos
- Java 17 o superior
- Spring Boot 3.5.8x
- Maven (o wrapper `mvnw`/`mvnw.cmd`)
- Navegador moderno (recomendado: Chrome)
- Opcional: Postman / curl para probar la API
- HTML, CSS, JavaScript (frontend)

---

## Ejecutar backend (Windows)
1. Abrir terminal (PowerShell o CMD).
2. Ir al directorio del backend:
   cd c:\Users\UserExample\Documentos\java\prueba-tecnica\backend
3. Ejecutar con Maven:
   - Si usa Maven instalado:
     mvn spring-boot:run
   - Si usa wrapper (si está presente):
     .\mvnw.cmd spring-boot:run
4. Alternativa (build + jar):
   mvn clean package
   java -jar target/<nombre-artifact>.jar
5. El backend queda por defecto en http://localhost:8080
   - Archivo de datos: `tareas.json` se crea en el directorio de ejecución (user.dir).
   - CORS ya está permitido (CrossOrigin("*")) para pruebas locales.

Endpoints principales:
- GET /api/tareas — listar tareas
- POST /api/tareas — crear tarea (body JSON { descripcion, prioridad })
- POST /api/tareas/{id} — actualización parcial (completada/prioridad/descripcion)
- PUT /api/tareas/{id} — editar descripción
- DELETE /api/tareas/{id} — eliminar individual
- POST /api/tareas/batch/complete — marcar en lote { ids: [..], completed: true }
- DELETE /api/tareas/batch/delete — eliminar en lote { ids: [..] }
- POST /api/tareas/batch/prioridad — cambiar prioridad en lote { ids: [..], prioridad: "Alta" }
- GET /api/tareas/export?format=csv|json — exportar

Ejemplo curl (crear):
curl -X POST http://localhost:8080/api/tareas -H "Content-Type: application/json" -d "{\"descripcion\":\"Prueba\",\"prioridad\":\"Media\"}"

---

## Ejecutar frontend (Windows)
La carpeta frontend contiene `index.html`, `script.js` y `style.css`.

Opciones recomendadas:
1. Servir con un servidor HTTP (evita limitaciones del origen `file://`):
   - Con Python 3:
     cd c:\Users\UserExample\Documentos\java\prueba-tecnica\frontend
     python -m http.server 5500
     Abrir: http://localhost:5500
   - Con npx http-server:
     npx http-server -p 5500
2. O abrir directamente `frontend\index.html` en el navegador (puede haber restricciones CORS en algunos navegadores).

Notas:
- El frontend espera la API en `http://localhost:8080/api/tareas`. Si cambia el puerto del backend, actualizar la constante `apiUrl` en `frontend/script.js`.
- Para pruebas manuales de la API usar Postman o curl.

---

## Tecnologías utilizadas
- Java 17+
- Spring Boot 3.5.8x
- Maven
- JSON
- HTML5, CSS3, JavaScript
- Herramientas opcionales: Postman, curl, Python (servidor estático), npx http-server

---

## Consideraciones especiales / buenas prácticas
- `tareas.json` se crea en el directorio de ejecución; ejecutar desde la raíz del proyecto para localizarlo junto al backend. El controlador hace backups automáticos si el JSON está corrupto.
- El backend guarda de forma atómica (archivo temporal + move) y utiliza un lock para concurrencia básica.
- Verificar que el puerto 8080 esté libre antes de arrancar el backend o cambiar la propiedad `server.port` en `application.properties`.
- Para producción no usar CORS "*" ni servir frontend desde `file://`. Habilitar configuración de seguridad apropiada.
- Si el frontend carga desde `file://`, algunos navegadores podrían bloquear fetch por políticas de origen; usar servidor estático para evitar problemas.

---

## Herramientas usadas en desarrollo
1. Java 17 o superior  
2. Spring Boot 3.5.8x  
3. Maven (o mvnw)  
4. Navegador web moderno (Chrome)  
5. Postman (opcional)  
6. HTML, CSS y JavaScript

---

Si necesita ejemplos adicionales de requests, configuración de puerto o script de build, indicar qué formato prefieres (curl / PowerShell / Postman collection).