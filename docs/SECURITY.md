# SECURITY — Modelo de seguridad

## Dos niveles de firewall

Existen **dos** cortafuegos independientes; ambos deben permitir un puerto para
que sea accesible desde Internet:

1. **Oracle Cloud (NSG / Security Lists):** el firewall de la nube, fuera de tu
   VM. Se configura en la consola de Oracle (VCN → Security Lists → Ingress Rules).
2. **Ubuntu (ufw / iptables):** el firewall del sistema operativo dentro del VM.
   `sudo ufw allow 8090/tcp` / `sudo ufw status`.

Puertos del proyecto:

| Puerto | Expuesto a Internet | Por qué |
|---|---|---|
| 22 (SSH) | Sí (ya lo estaba) | administración |
| 8090 (dashboard) | Sí (hay que abrirlo) | único puerto público nuevo |
| 3001 (Kuma admin) | **No** — solo `127.0.0.1` | panel administrativo; acceso vía túnel SSH |
| 4000 (API) | No — red Docker interna | nadie externo debe llamarla directamente |
| 3000 (test-service) | No — red Docker interna | solo API y Kuma |

## Protección SSRF en los laboratorios HTTP/TCP/DNS

Los laboratorios aceptan URLs/hosts escritos por el usuario. El backend valida
y **bloquea** antes de conectar:

- `localhost`, `127.0.0.0/8`, `::1` (loopback)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (redes privadas)
- `169.254.169.254` y `169.254.0.0/16` (**metadata cloud** de Oracle/AWS: expone credenciales)
- `0.0.0.0`, `fe80::/10` (link-local IPv6)
- Redirecciones que apunten a esos rangos (se revalidan tras cada redirect)
- Timeouts cortos y límite de tamaño en respuestas

Así los laboratorios no pueden usarse para sondear servicios internos, la red
Docker ni los metadatos de la nube.

## Secretos

- Viven **solo** en `.env` del backend (nunca en el frontend, nunca en Git,
  nunca en backups salvo `--include-secrets` explícito con aviso).
- `UK_USERNAME` / `UK_PASSWORD` / `KUMA_METRICS_API_KEY`: solo `monitoring-api`.
- `TEST_SERVICE_SECRET`: compartido entre `monitoring-api` y `test-service`
  por variable de entorno interna. El navegador **nunca** lo ve: el frontend
  llama a `/api/chaos` y el backend reenvía con la cabecera `x-admin-secret`.

## Docker socket en solo lectura + whitelist

`monitoring-api` monta `/var/run/docker.sock:ro`. Además, el backend **solo
implementa operaciones de lectura** (`list`, `stats`, `logs` con límite).
No existe ningún endpoint que ejecute `exec`, `run`, `rm` o comandos shell.
Los logs están limitados (100/500/1000 líneas) y son de solo lectura.

## Chaos Lab limitado

El Chaos Lab solo puede cambiar el modo de `test-service` (el contenedor
"víctima" diseñado para ello). No hay forma de aplicarlo a otros contenedores
ni a servicios del sistema: el endpoint `/api/chaos` tiene el destino
hardcodeado a `TEST_SERVICE_URL`.

## Cabeceras y límites

- Rate limiting en `/api/*` (los laboratorios son los más estrictos).
- La API valida todas las entradas (URL, host, puerto, dominio).
- El frontend nunca ejecuta código de las webs analizadas (el lab HTTP muestra
  cabeceras y texto; el HTML se presenta como fuente, no se renderiza).
