#!/bin/sh
# entrypoint.sh — monitoring-api
# ---------------------------------------------------------------------------
# Por qué existe: el backend necesita LEER información de Docker (`docker ps`,
# `docker stats`, `docker logs`) a través de /var/run/docker.sock, pero debe
# correr SIN privilegios de root (principio de mínimo privilegio, spec §43).
#
# El problema: el socket pertenece al grupo `docker` del HOST (p. ej. gid
# 999), que no existe dentro del contenedor, así que el usuario `node`
# recibiría "permission denied".
#
# La solución: este script arranca como root, crea un grupo local con el
# MISMO gid que el dueño del socket, mete al usuario `node` en ese grupo y
# después baja privilegios con `su-exec`. El proceso principal (node
# src/index.js) nunca corre como root.
#
# La protección "solo lectura" NO la da el montaje (un socket no se puede
# limitar así): la da el código en src/services/dockerInfo.js, que solo
# ejecuta `ps`, `stats --no-stream` y `logs --tail` sobre una whitelist de
# contenedores. Ver docs/SECURITY.md.
# ---------------------------------------------------------------------------
set -eu

SOCK=/var/run/docker.sock

if [ -S "$SOCK" ]; then
  GID="$(stat -c '%g' "$SOCK")"
  if ! getent group "$GID" >/dev/null 2>&1; then
    addgroup -g "$GID" dockersock 2>/dev/null || true
  fi
  GROUP_NAME="$(getent group "$GID" | cut -d: -f1)"
  if [ -n "$GROUP_NAME" ]; then
    adduser node "$GROUP_NAME" 2>/dev/null || true
    echo "[entrypoint] usuario 'node' añadido al grupo '$GROUP_NAME' (gid $GID) para leer $SOCK"
  else
    echo "[entrypoint] aviso: no se pudo resolver el grupo gid=$GID; Docker quedará no disponible"
  fi
else
  echo "[entrypoint] aviso: $SOCK no existe; Docker quedará no disponible"
fi

# Baja privilegios y ejecuta el comando principal como `node`.
exec su-exec node "$@"
