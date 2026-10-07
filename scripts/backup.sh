#!/usr/bin/env bash
# =============================================================================
# scripts/backup.sh — Backup del Uptime Kuma Educational Monitoring Lab
# =============================================================================
# Crea backups/monitoring-lab-<timestamp>.tar.gz con:
#   - volcado del volumen Docker uptime-kuma-data (la base SQLite de Kuma)
#   - docker-compose.yml, .env.example
#   - monitoring-api/Dockerfile, monitoring-frontend/nginx.conf (si existen)
#
# NUNCA incluye el .env real (secretos) salvo que pases --include-secrets,
# y en ese caso avisa claramente: ese backup NO debe subirse a ningún sitio.
#
# Uso:
#   ./scripts/backup.sh                 → backup sin secretos
#   ./scripts/backup.sh --include-secrets → incluye .env (úsalo con cuidado)
#
# Idea educativa: el volumen se vuelca con un contenedor TEMPORAL de alpine
# que monta el volumen en solo lectura y escribe un .tar.gz. Así no hay que
# parar Uptime Kuma ni tocar su SQLite mientras corre (spec §20: nunca leer
# la base directamente en caliente; el volcado vía tar del volumen es seguro).
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."   # raíz del proyecto

INCLUDE_SECRETS=0
for arg in "$@"; do
  if [ "$arg" = "--include-secrets" ]; then INCLUDE_SECRETS=1; fi
done

TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

echo "=== Backup del Monitoring Lab ($TS) ==="
echo ""

# 1. Volcado del volumen de Uptime Kuma ---------------------------------------
VOL=$(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -E 'uptime-kuma-data$' | head -1 || true)
if [ -n "$VOL" ]; then
  echo "💡 docker run --rm -v $VOL:/data:ro ... tar ... — vuelca el volumen a un"
  echo "   .tar.gz usando un contenedor temporal (Kuma sigue corriendo)"
  docker run --rm \
    -v "$VOL:/data:ro" \
    -v "$STAGE:/b" \
    alpine tar czf "/b/uptime-kuma-data-$TS.tar.gz" -C /data .
  echo "✅ volumen $VOL volcado"
else
  echo "⚠️  no se encontró el volumen uptime-kuma-data: se omite (¿compose nunca arrancado?)"
fi

# 2. Ficheros de configuración -------------------------------------------------
cp docker-compose.yml .env.example "$STAGE"/
if [ -f monitoring-api/Dockerfile ]; then cp monitoring-api/Dockerfile "$STAGE/monitoring-api.Dockerfile"; fi
if [ -f monitoring-frontend/nginx.conf ]; then cp monitoring-frontend/nginx.conf "$STAGE/monitoring-frontend.nginx.conf"; fi
echo "✅ configuración copiada"

# 3. Secretos: solo con flag explícito ------------------------------------------
if [ "$INCLUDE_SECRETS" = 1 ]; then
  echo "⚠️  ⚠️  --include-secrets: incluyendo .env CON SECRETOS SIN CIFRAR ⚠️  ⚠️"
  echo "   Este archivo NO debe subirse a Git ni a ningún almacenamiento público."
  cp .env "$STAGE/.env"
else
  echo "ℹ️  .env NO incluido (usa --include-secrets si lo necesitas)"
fi

# 4. Empaquetar -----------------------------------------------------------------
OUT="backups/monitoring-lab-$TS.tar.gz"
tar czf "$OUT" -C "$STAGE" .
SIZE=$(du -h "$OUT" | cut -f1)

echo ""
echo "✅ Backup creado: $OUT ($SIZE)"
echo ""
echo "Contenido:"
tar tzf "$OUT"
echo ""
echo "Para restaurar en esta u otra máquina:"
echo "  ./scripts/restore.sh $OUT"
echo ""
echo "Restauración = Backup → fallo → nuevo VM → Docker → restore → Kuma recuperado"
echo "(ver docs/BACKUP.md)"
