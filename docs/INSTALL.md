# INSTALL — Instalación paso a paso

## Requisitos

- Servidor Ubuntu 22.04 o 24.04 (probado en 24.04 ARM64 de Oracle Cloud)
- Acceso SSH (usuario con sudo)
- ~2 GB de RAM libres y ~5 GB de disco
- Docker: **si no existe, `install.sh` lo instala** desde el repositorio oficial

## Instalación (un comando)

```bash
# 1. Copia el proyecto al servidor (desde tu ordenador):
scp -r uptime-kuma-learning-lab ubuntu@IP_SERVIDOR:~/PROYECTOS/
# (o clónalo: git clone <tu-repo> ~/PROYECTOS/monitoring-lab)

# 2. En el servidor:
cd ~/PROYECTOS/monitoring-lab   # o monitoring-lab según el nombre que uses
./install.sh
```

El instalador es **idempotente**: puedes ejecutarlo varias veces; nunca
sobrescribe tu `.env` sin hacer backup (`.env.bak.<fecha>`).

Qué hace, en orden:

1. **Analiza** la máquina (Ubuntu, arquitectura, RAM, disco, puertos
   ocupados, Docker, firewall, conectividad) y muestra una tabla. No toca nada.
2. **Instala Docker + plugin Compose** solo si faltan.
3. **Crea** `backups/`.
4. **Genera `.env`** desde `.env.example` (con secreto aleatorio para el Chaos
   Lab). Si ya existe, hace backup y no lo toca. Te pide `UK_USERNAME` /
   `UK_PASSWORD` de Kuma si están vacíos (modo `--yes`: los deja vacíos).
5. **`docker compose up -d --build`**: construye y arranca los 4 contenedores.
6. **Health checks**: espera a `/api/health`, lista contenedores y verifica el volumen.
7. **Resumen final**: tabla SERVICIO/ESTADO, IP, puertos, RAM/disco e
   instrucciones del túnel SSH.

## Primer arranque: crear el admin de Uptime Kuma

1. En tu ordenador, abre el túnel SSH:
   `ssh -L 3002:127.0.0.1:3002 ubuntu@IP_SERVIDOR`
2. En tu navegador: `http://localhost:3002`
3. Crea el usuario administrador (solo la primera vez).
4. Rellena `UK_USERNAME` / `UK_PASSWORD` en el `.env` del servidor y reinicia
   la API: `docker compose up -d monitoring-api`.

## Seed de monitores de ejemplo

Con `SEED_MONITORS=true` (por defecto), la API crea al arrancar monitores de
ejemplo en Kuma: el propio dashboard, una web pública fiable, un endpoint HTTP
de pruebas, un servicio TCP, un ping y el `test-service` (para el Chaos Lab).
Ponlo en `false` si prefieres crear tus monitores a mano desde el panel admin.

## Abrir el puerto 8090 (dashboard público)

El dashboard escucha en el puerto **8090** (el 8080 ya está ocupado en este
servidor). Hay que abrirlo en **dos** sitios (ver [SECURITY.md](SECURITY.md)):

**1. Oracle Cloud (NSG / Security List):**
Consola de Oracle → Networking → Virtual Cloud Networks → tu VCN →
Security Lists → tu security list → *Add Ingress Rule*:
- Source: `0.0.0.0/0`, IP Protocol: TCP, Destination Port: `8090`, Description: `Monitoring Lab dashboard`

**2. Firewall del servidor (Ubuntu):**
```bash
sudo ufw allow 8090/tcp
sudo ufw status
```

El puerto **3002 NO se abre**: Uptime Kuma admin solo vía túnel SSH.
