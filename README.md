# Uptime Kuma Educational Monitoring Lab

Un laboratorio educativo de monitorización sobre tu propio servidor Oracle Cloud:
usas **Uptime Kuma de verdad** para vigilar tus webs, APIs y servidores, y un
dashboard propio (**Monitoring Lab**) te enseña visualmente qué está pasando:
qué es un check HTTP, cómo se mide la latencia, qué significa un incidente,
cómo se comunican los contenedores Docker, etc.

> Principio del proyecto: **distinguir siempre DATO REAL de SIMULACIÓN
> EDUCATIVA**. Nada inventado se presenta como medición real.

## Arquitectura

```
                    INTERNET
                        │
                        ▼
                 ORACLE CLOUD (Ubuntu 24.04 ARM64)
                        │
                      Docker
                        │
        ┌───────────────┼──────────────────┐
        │               │                  │
        ▼               ▼                  ▼
  Uptime Kuma     Monitoring API     Test Service
  127.0.0.1:3001   (red interna)     (red interna)
  (túnel SSH)           │
        │               │
        └───────┬───────┘
                ▼
        Learning Dashboard
          puerto 8090 (público)
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
      HTTP     TCP      DNS
       Lab     Lab      Lab   (sandboxes educativos)
```

Flujo de datos: Uptime Kuma comprueba tus servicios cada X segundos y guarda
cada resultado (latencia, código HTTP, estado) en su base SQLite → Monitoring
API lee esos datos con las credenciales de `.env` (el navegador nunca las ve)
y los expone en endpoints propios `/api/*` → el dashboard los visualiza
(gráficos de latencia, uptime de 90 días, timeline de incidentes).

## Requisitos

- Servidor Ubuntu 22.04/24.04 con Docker (si falta, `install.sh` lo instala)
- ~2 GB de RAM libres, ~5 GB de disco
- Puertos: 22 (SSH, ya abierto) y **8090** (dashboard; ábrelo en el NSG de Oracle + ufw)

## Arranque

```bash
# En el servidor, desde la raíz del proyecto:
./install.sh          # interactivo, idempotente: analiza, instala, configura, arranca
./install.sh --yes    # no interactivo
```

## Parada / actualización

```bash
docker compose down                  # detener (los datos persisten en el volumen)
docker compose pull && docker compose up -d --build   # actualizar (tras backup)
./scripts/backup.sh                  # backup manual
```

Ver [docs/UPDATE.md](docs/UPDATE.md) (siempre backup antes de actualizar).

## Acceso

| Qué | Cómo |
|---|---|
| Learning Dashboard | `http://IP_DEL_SERVIDOR:8090` (puerto público) |
| Panel admin de Uptime Kuma | **túnel SSH**: `ssh -L 3001:127.0.0.1:3001 ubuntu@IP` → `http://localhost:3001` |

El puerto 3001 **nunca** se expone a Internet: es la consola administrativa.

## Estructura del repo

```
.
├── docker-compose.yml        # toda la infraestructura como código (comentada en español)
├── .env.example              # plantilla de variables (el .env real NUNCA se sube a Git)
├── install.sh                # instalador idempotente y educativo
├── scripts/
│   ├── backup.sh             # backup del volumen + configuración
│   └── restore.sh            # restauración ante desastre
├── test-service/             # "víctima" controlada para el Chaos Lab (Node + Express)
├── monitoring-api/           # backend: Express, adapter de Uptime Kuma, labs, métricas
├── monitoring-frontend/      # "Monitoring Lab": Vite + React, español, PWA
└── docs/                     # INSTALL, ARCHITECTURE, SECURITY, BACKUP, UPDATE, LEARNING, TROUBLESHOOTING
```

## Documentación

- [docs/INSTALL.md](docs/INSTALL.md) — instalación paso a paso y apertura del puerto 8090
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — por qué cada decisión técnica
- [docs/SECURITY.md](docs/SECURITY.md) — firewalls, SSRF, secretos, límites del Chaos Lab
- [docs/BACKUP.md](docs/BACKUP.md) — qué se respalda y cómo restaurar
- [docs/LEARNING.md](docs/LEARNING.md) — glosario: Docker, HTTP, DNS, TCP, latencia…
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — problemas típicos y soluciones
