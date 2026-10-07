# ARCHITECTURE — Por qué está diseñado así

## Diagrama completo

```
                        INTERNET
                           │
                           ▼
                    Oracle Cloud VM
                    (Ubuntu 24.04, Docker)
                           │
              ┌────────────┴────────────┐
              │      red lab-net        │
              │   (bridge, privada)     │
              │                         │
              ▼                         ▼
   ┌──────────────────┐      ┌──────────────────┐
   │   uptime-kuma    │◄─────│  monitoring-api  │
   │  louislam/...:2  │datos │  Node + Express  │
   │  127.0.0.1:3001  │      │  SIN puertos     │
   └──────────────────┘      └────────┬─────────┘
              ▲                       │ /api/*
              │ monitoriza            ▼
   ┌──────────┴───────┐      ┌──────────────────┐
   │  test-service    │      │ monitoring-      │
   │  (víctima chaos) │      │ frontend (nginx) │
   └──────────────────┘      │   puerto 8090    │
                             └────────┬─────────┘
                                      │ HTTP
                                      ▼
                                   Tu navegador
```

## Red Docker `lab-net`

Todos los contenedores comparten una red `bridge` privada. Dentro de ella se
resuelven **por nombre** (`uptime-kuma`, `monitoring-api`, `test-service`):
sin IPs fijas, sin depender del host. El tráfico entre contenedores nunca sale
a la red del servidor. Desde fuera solo se ven los puertos publicados.

## Decisiones y sus porqués

**Uptime Kuma en `127.0.0.1:3001` (solo localhost).**
Su panel es administrativo: permite crear, pausar y borrar monitores. No hay
motivo para exponerlo a Internet. El túnel SSH (`ssh -L 3001:127.0.0.1:3001`)
cifra el acceso y lo deja disponible en tu máquina como `localhost:3001`.

**Monitoring API sin puertos publicados.**
Es el único que conoce las credenciales de Kuma (viven en `.env`, solo backend).
El frontend no la llama directamente por `http://...:4000`; nginx hace de
*reverse proxy* (`/api/*` → `monitoring-api:4000`). Un solo origen = sin CORS,
sin credenciales en el navegador, menos superficie de ataque.

**`docker.sock` montado en solo lectura (`:ro`).**
Las pantallas "Servidor Oracle" y "Docker Visualizer" necesitan datos reales
(`docker ps`, stats, logs). Con `:ro` el contenedor puede *leer* el socket
pero el backend además solo implementa operaciones de lectura (whitelist):
nunca `exec`, `rm` ni operaciones de escritura desde el navegador.

**`/proc` y `/` del host en solo lectura.**
Para CPU, RAM, disco y uptime *reales* del servidor sin ejecutar comandos
arbitrarios: el backend lee ficheros (`/host/proc/stat`, `/host/proc/meminfo`…)
y calcula las métricas. Lectura de ficheros, no shell.

**Test-service sin publicar (`expose`, no `ports`).**
Solo `monitoring-api` (con el secreto del Chaos Lab) y `uptime-kuma` (como
monitor) pueden hablar con él, y solo dentro de `lab-net`. Desde fuera es
invisible: nadie puede romper tu laboratorio salvo tú.

**Adapter de Uptime Kuma aislado (`services/uptimeKumaAdapter.js`).**
Kuma usa Socket.IO internamente y esa API puede cambiar entre versiones. Todo
el acoplamiento vive en un único módulo con interfaz propia; el frontend solo
conoce `GET /api/monitors`, `/api/incidents`, etc. Si Kuma 3 cambia su API
interna, solo se reescribe el adapter. Nunca se toca su SQLite en caliente.

**Modo DEMO / REAL visible.**
Si Kuma no está configurado o no responde, la API lo dice claramente y el
dashboard muestra datos simulados con la etiqueta **SIMULACIÓN EDUCATIVA**.
Nunca se presentan datos inventados como reales.

**Persistencia en volumen nombrado (no NFS).**
`uptime-kuma-data:/app/data` guarda la SQLite de Kuma. SQLite sobre red (NFS)
es lento y puede corromperse; el volumen local de Docker es la opción segura.
Sobrevive a `docker compose down`, actualizaciones y reinicios.
