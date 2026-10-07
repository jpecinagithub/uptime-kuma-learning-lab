# UPDATE — Actualizar el laboratorio

## Regla de oro: backup primero

```bash
./scripts/backup.sh
```

## Actualizar

```bash
# 1. Trae la imagen nueva de Uptime Kuma:
docker compose pull uptime-kuma

# 2. Reconstruye nuestras imágenes y reinicia (los datos están en el volumen):
docker compose up -d --build

# 3. Verifica:
curl -sf http://localhost:8090/api/health && echo OK
docker compose ps
```

Si algo sale mal, vuelve atrás con el backup:

```bash
./scripts/restore.sh backups/monitoring-lab-<ts>.tar.gz
docker compose up -d
```

## Versiones

- Uptime Kuma está fijado a `louislam/uptime-kuma:2` (rama estable 2.x, sin
  `latest` flotante).
- **No actualices a una versión mayor** (p. ej. un futuro Kuma 3) sin revisar
  antes las notas de la release: la API interna (Socket.IO) puede cambiar y el
  adapter (`monitoring-api/services/uptimeKumaAdapter.js`) podría necesitar
  ajustes. El modo DEMO te cubre mientras tanto.
- Nuestras imágenes (`monitoring-api`, `monitoring-frontend`, `test-service`)
  usan tags fijos (`node:20-alpine`, `nginx:alpine`); revísalos una vez al año.
