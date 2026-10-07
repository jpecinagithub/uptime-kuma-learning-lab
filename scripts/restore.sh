#!/usr/bin/env bash
# =============================================================================
# scripts/restore.sh — Restaura un backup creado con scripts/backup.sh
# =============================================================================
# Uso:
#   ./scripts/restore.sh backups/monitoring-lab-<timestamp>.tar.gz [--yes]
#
# Qué hace:
#   1. Pide confirmación (salvo --yes): SOBREESCRIBE el volumen uptime-kuma-data
#   2. Detiene los servicios (docker compose down) para restaurar de forma segura
#   3. Vacía el volumen y extrae el volcado
#   4. Restaura docker-compose.yml / .env.example (con backup de los actuales)
#   5. Te dice cómo volver a arrancar
#
# Flujo completo de desastre (spec §29):
#   Backup → fallo del servidor → nuevo Oracle VM → instalar Docker →
#   copiar este repo + el .tar.gz → ./scripts/restore.sh → docker compose up -d
#   → Uptime Kuma recuperado con todo su historial.
# =============================================================================
set -euo pipefail

BACKUP="${1:-}"
YES=0
if [ "${2:-}" = "--yes" ]; then YES=1; fi

if [ -z "$BACKUP" ]; then
  echo "Uso: $0 <backups/monitoring-lab-<timestamp>.tar.gz> [--yes]"
  exit 1
fi
[ -f "$BACKUP" ] || { echo "❌ no existe: $BACKUP"; exit 1; }

cd "$(dirname "$0")/.."   # raíz del proyecto

if [ "$YES" = 0 ]; then
  echo "⚠️  Esto SOBREESCRIBIRÁ el volumen uptime-kuma-data con el contenido de:"
  echo "   $BACKUP"
  read -r -p "¿Continuar? [s/N] " RESP || true
  case "$RESP" in
    s|S) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
echo "Extrayendo backup..."
tar xzf "$BACKUP" -C "$STAGE"

# Volumen: lo localizamos (el nombre lleva el prefijo del proyecto compose)
VOL=$(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -E 'uptime-kuma-data$' | head -1 || true)
if [ -z "$VOL" ]; then
  VOL="monitoring-lab_uptime-kuma-data"
  docker volume create "$VOL" >/dev/null
  echo "ℹ️  volumen no existía: creado $VOL"
fi

echo "💡 docker compose down — detenemos los servicios para restaurar de forma segura"
docker compose down 2>/dev/null || true

DATA_TAR=$(ls "$STAGE"/uptime-kuma-data-*.tar.gz 2>/dev/null | head -1 || true)
if [ -n "$DATA_TAR" ]; then
  echo "💡 docker run --rm ... — vacía el volumen y extrae el volcado con un contenedor temporal"
  docker run --rm \
    -v "$VOL:/data" \
    -v "$STAGE:/b" \
    alpine sh -c "find /data -mindepth 1 -delete && tar xzf /b/$(basename "$DATA_TAR") -C /data"
  echo "✅ volumen $VOL restaurado"
else
  echo "⚠️  el backup no trae volcado de datos: solo se restauran ficheros"
fi

# Ficheros de configuración (con backup previo de los actuales)
TS=$(date +%Y%m%d-%H%M%S)
for f in docker-compose.yml .env.example; do
  if [ -f "$STAGE/$f" ]; then
    if [ -f "$f" ]; then cp "$f" "$f.bak.$TS"; fi
    cp "$STAGE/$f" "$f"
    echo "✅ $f restaurado (el anterior, si existía, en $f.bak.$TS)"
  fi
done
if [ -f "$STAGE/.env" ]; then
  echo "⚠️  el backup incluye .env con secretos: NO se restaura automáticamente."
  echo "   Revísalo en $STAGE (temporal) y cópialo a mano si lo necesitas."
fi

echo ""
echo "✅ Restauración completada."
echo "Arranca con:  docker compose up -d"
echo "Y verifica:   curl -sf http://localhost:8090/api/health"
