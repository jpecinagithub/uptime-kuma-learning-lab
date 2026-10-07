# BACKUP — Qué se respalda y cómo restaurar

## Qué se respalda

`./scripts/backup.sh` crea `backups/monitoring-lab-<fecha-hora>.tar.gz` con:

- **Volcado del volumen `uptime-kuma-data`** (la base SQLite de Uptime Kuma:
  monitores, historial de checks, incidentes). Se vuelca con un contenedor
  temporal de alpine que monta el volumen en solo lectura: Kuma sigue
  corriendo y su base no se toca en caliente.
- `docker-compose.yml`, `.env.example`
- `monitoring-api/Dockerfile`, `monitoring-frontend/nginx.conf` (si existen)

**NO incluye `.env`** (secretos) salvo que pases `--include-secrets`, con aviso
explícito. Ese backup no debe subirse a ningún sitio público.

## Cómo hacer backup

```bash
./scripts/backup.sh                    # sin secretos
./scripts/backup.sh --include-secrets  # incluye .env (¡custodiar!)
```

Backup automático diario a las 03:00 (cron en el servidor):

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * cd ~/PROYECTOS/monitoring-lab && ./scripts/backup.sh >> backups/cron.log 2>&1") | crontab -
```

Limpieza de backups antiguos (conservar 14 días):

```bash
find backups/ -name 'monitoring-lab-*.tar.gz' -mtime +14 -delete
```

## Restauración paso a paso (spec §29)

```
Backup → fallo del servidor → nuevo Oracle VM → instalar Docker →
copiar repo + .tar.gz → ./scripts/restore.sh → docker compose up -d →
Uptime Kuma recuperado con todo su historial
```

Comandos:

```bash
# 1. En el nuevo servidor: Docker (o ./install.sh hasta el paso 2)
# 2. Copia el repo y el backup:
scp -r uptime-kuma-learning-lab ubuntu@NUEVA_IP:~/PROYECTOS/
scp backups/monitoring-lab-<ts>.tar.gz ubuntu@NUEVA_IP:~/PROYECTOS/monitoring-lab/backups/

# 3. Restaura (pide confirmación; --yes para no interactivo):
cd ~/PROYECTOS/monitoring-lab
./scripts/restore.sh backups/monitoring-lab-<ts>.tar.gz

# 4. Recrea tu .env (no venía en el backup) y arranca:
cp .env.example .env   # + rellena UK_USERNAME/UK_PASSWORD y genera el secreto
docker compose up -d
curl -sf http://localhost:8090/api/health && echo "RECUPERADO"
```

`restore.sh` detiene los servicios (`docker compose down`), vacía el volumen y
extrae el volcado, y restaura `docker-compose.yml` / `.env.example` haciendo
backup previo de los actuales (`.bak.<fecha>`).
