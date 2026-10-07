# TROUBLESHOOTING — Problemas típicos

## El puerto 8090 está ocupado

```bash
ss -ltnp | grep ':8090'      # ver quién lo usa
```

Si otro servicio lo necesita, cambia el mapeo en `docker-compose.yml`
(`"8091:80"`, por ejemplo), actualiza la regla del firewall y re-arranca.

## El puerto 3001 está ocupado

Otro Kuma u otro servicio lo usa. Localízalo con `ss -ltnp | grep ':3001'`.
El compose fija `127.0.0.1:3001:3001`; si el conflicto es inevitable, cambia
ambos lados del mapeo (y el túnel SSH apuntará al nuevo puerto).

## El dashboard muestra "modo demo" aunque Kuma corre

La API no pudo autenticarse en Kuma. Revisa:

1. `UK_USERNAME` / `UK_PASSWORD` en `.env` (¿creaste el admin en
   `http://localhost:3001` vía túnel SSH?).
2. Logs: `docker compose logs monitoring-api | tail -50`
3. Conectividad interna: `docker compose exec monitoring-api wget -q -O- http://uptime-kuma:3001/ | head -c 200`

## Uptime Kuma tarda mucho en arrancar la primera vez

Normal: ejecuta migraciones de su base de datos (~1-2 min). El healthcheck
tiene `start_period: 120s` por eso. Mira el progreso con
`docker compose logs -f uptime-kuma`.

## `docker compose` no existe

El plugin se llama `docker-compose-plugin` (no el antiguo `docker-compose`
de Python). `install.sh` lo instala; a mano: `sudo apt install docker-compose-plugin`.

## Los monitores a webs públicas fallan todos

Probablemente el servidor no tiene salida a Internet:
`curl -sI -m 10 https://example.com`. Revisa el NSG de Oracle (egress) y el
firewall local. Los monitores internos (dashboard, test-service) seguirán
funcionando.

## Disco lleno

El volumen de Kuma crece con el historial. Comprueba:
`docker system df` y `df -h /`. Limpia con `docker system prune` (borra
imágenes/contenedores no usados; **no** toca volúmenes) y ajusta la retención
de datos en los ajustes de Uptime Kuma.

## Perdí el `.env`

No hay copia en el repo (a propósito). Si hiciste backup con
`--include-secrets`, está dentro del `.tar.gz`. Si no, regenéralo:
`cp .env.example .env`, genera el secreto (`openssl rand -hex 32`) y
re-escribe `UK_USERNAME`/`UK_PASSWORD` (los de Kuma siguen valiendo: viven en
su base de datos, no en el `.env`).

## `ufw` me dejó fuera / bloquea el dashboard

`sudo ufw allow 8090/tcp && sudo ufw allow 22/tcp && sudo ufw status`.
Ojo: activar ufw sin permitir el 22 te deja sin SSH. En Oracle, además,
revisa siempre el Security List (son dos firewalls independientes).

## Quiero reinstalar desde cero sin perder el historial de Kuma

```bash
./scripts/backup.sh
docker compose down
# ... tocas lo que necesites ...
docker compose up -d --build   # el volumen uptime-kuma-data sigue intacto
```

El historial solo se pierde si borras el volumen explícitamente
(`docker volume rm ...`), cosa que ningún script de este proyecto hace.
