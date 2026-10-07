#!/usr/bin/env bash
# =============================================================================
# Uptime Kuma Educational Monitoring Lab — install.sh
# =============================================================================
# Instalador idempotente y educativo: puedes ejecutarlo varias veces sin que
# rompa nada (nunca sobrescribe tu .env sin hacer backup antes).
#
# Uso:
#   ./install.sh          → interactivo (te pregunta lo necesario)
#   ./install.sh --yes    → no interactivo (para automatizar)
#
# Pasos:
#   1. check_system   → analiza la máquina y muestra una tabla (no destructivo)
#   2. check_docker   → instala Docker/Compose SOLO si faltan
#   3. setup_dirs     → crea ~/PROYECTOS/monitoring-lab y backups/
#   4. setup_env      → genera .env desde .env.example (con backup si existe)
#   5. compose_up     → docker compose up -d --build
#   6. health_checks  → verifica que todo responde
#   7. Resumen final  → tabla SERVICIO/ESTADO, IP, puertos, túnel SSH
#
# Las líneas "💡" explican cada comando Docker importante (spec §34).
# =============================================================================
set -euo pipefail

YES=0
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg (usa --yes o --help)"; exit 1 ;;
  esac
done

# sudo solo si no somos root
SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

tip() { echo "💡 $1 — $2"; }
ok()  { echo "✅ $1"; }
warn(){ echo "⚠️  $1"; }

# --- Directorio del proyecto -------------------------------------------------
# Si el script se ejecuta desde la raíz del repo (hay docker-compose.yml),
# trabajamos aquí. Si no, usamos ~/PROYECTOS/monitoring-lab.
if [ -f "docker-compose.yml" ]; then
  PROJECT_DIR="$(pwd)"
else
  PROJECT_DIR="$HOME/PROYECTOS/monitoring-lab"
  mkdir -p "$PROJECT_DIR"
  if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
    echo "El directorio $PROJECT_DIR está vacío."
    echo "Copia aquí los archivos del proyecto (o clona el repo) y vuelve a ejecutar ./install.sh"
    exit 1
  fi
fi
cd "$PROJECT_DIR"

# --- 1. Análisis del sistema (SOLO LECTURA, nada destructivo) -----------------
check_system() {
  echo ""
  echo "=== 1/7 Análisis del sistema (solo lectura) ==="
  echo ""

  OS_NAME=$(grep '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d'"' -f2 || echo "desconocido")
  ARCH=$(uname -m)
  RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
  DISK=$(df -h / | awk 'NR==2{print $2 " total, " $4 " libres (" $5 " usado)"}')

  echo "Sistema operativo : $OS_NAME"
  echo "Arquitectura      : $ARCH"
  echo "RAM               : ${RAM_GB} GB"
  echo "Disco (/)         : $DISK"
  echo ""
  echo "Puertos relevantes:"
  for p in 22 3001 8090 4000; do
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":${p}$"; then
      echo "  puerto $p  → OCUPADO"
    else
      echo "  puerto $p  → libre"
    fi
  done
  echo ""
  if command -v docker >/dev/null 2>&1; then
    echo "Docker            : $(docker --version 2>/dev/null || echo instalado)"
  else
    echo "Docker            : NO INSTALADO (se instalará en el paso 2)"
  fi
  if docker compose version >/dev/null 2>&1; then
    echo "Docker Compose    : $(docker compose version --short 2>/dev/null || echo instalado)"
  else
    echo "Docker Compose    : NO INSTALADO (se instalará en el paso 2)"
  fi
  echo ""
  echo "Firewall del sistema:"
  if command -v ufw >/dev/null 2>&1; then
    $SUDO ufw status 2>/dev/null | head -8 || echo "  (ufw instalado, sin respuesta)"
  elif command -v iptables >/dev/null 2>&1; then
    echo "  (ufw no instalado; primeras reglas de iptables:)"
    $SUDO iptables -L -n 2>/dev/null | head -8 || echo "  (sin permiso de lectura)"
  else
    echo "  No se detectó firewall local (revisa el NSG de Oracle Cloud)"
  fi
  echo ""
  echo -n "Conectividad exterior: "
  if curl -sI -m 10 -o /dev/null https://example.com 2>/dev/null; then
    echo "OK (https://example.com responde)"
  else
    warn "sin conectividad exterior: los monitores a webs públicas fallarán"
  fi
  echo ""
}

# --- 2. Docker / Compose (solo instala lo que falte) --------------------------
check_docker() {
  echo ""
  echo "=== 2/7 Docker y Docker Compose ==="
  echo ""
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker no existe: instalando desde el repositorio oficial..."
    tip "apt-get install ..." "instala Docker Engine desde el repo oficial de Docker"
    $SUDO apt-get update
    $SUDO apt-get install -y ca-certificates curl gnupg
    $SUDO install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
    # shellcheck disable=SC1091
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
    $SUDO apt-get update
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ok "Docker instalado"
    if [ -n "$SUDO" ]; then
      $SUDO usermod -aG docker "$USER" 2>/dev/null || true
      warn "te añadí al grupo 'docker'; si 'docker ps' pide permiso, cierra sesión y vuelve a entrar"
    fi
  else
    ok "Docker ya existe ($(docker --version)), no se toca"
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "Plugin Compose no existe: instalando..."
    $SUDO apt-get update
    $SUDO apt-get install -y docker-compose-plugin
    ok "Docker Compose instalado"
  else
    ok "Docker Compose ya existe, no se toca"
  fi
}

# --- 3. Directorios ------------------------------------------------------------
setup_dirs() {
  echo ""
  echo "=== 3/7 Directorios ==="
  echo ""
  echo "Directorio del proyecto: $PROJECT_DIR"
  mkdir -p "$PROJECT_DIR/backups"
  ok "backups/ listo"
}

# --- 4. Variables de entorno ---------------------------------------------------
setup_env() {
  echo ""
  echo "=== 4/7 Variables de entorno (.env) ==="
  echo ""
  if [ ! -f ".env" ]; then
    cp .env.example .env
    SECRET=$(openssl rand -hex 32)
    # Reemplazo robusto (grep -v + append): evita problemas con sed y caracteres raros.
    # El "|| true" es porque grep devuelve 1 si no queda ninguna línea (con set -e eso mataría el script).
    grep -v '^TEST_SERVICE_SECRET=' .env > .env.tmp || true
    mv .env.tmp .env
    echo "TEST_SERVICE_SECRET=$SECRET" >> .env
    chmod 600 .env
    ok ".env generado desde .env.example (con secreto aleatorio para el Chaos Lab)"
  else
    BK=".env.bak.$(date +%Y%m%d-%H%M%S)"
    cp .env "$BK"
    ok ".env ya existía: backup en $BK (NO se sobrescribe)"
  fi

  # Cargamos .env para comprobar qué falta (solo lectura de variables simples)
  set -a; . ./.env; set +a

  if [ -z "${UK_USERNAME:-}" ] || [ -z "${UK_PASSWORD:-}" ]; then
    echo ""
    echo "Uptime Kuma necesita un usuario administrador. Se crea la PRIMERA vez"
    echo "que entras a http://localhost:3001 (vía túnel SSH, ver resumen final)."
    echo "Si ya lo creaste, indícalo aquí para que monitoring-api pueda leer Kuma."
    echo "(El navegador nunca verá estas credenciales: solo viven en este .env)"
    if [ "$YES" = 1 ]; then
      warn "modo --yes: UK_USERNAME/UK_PASSWORD vacíos; la API usará modo demo hasta que los rellenes"
    else
      read -r -p "UK_USERNAME (vacío = dejar para después): " UK_U || true
      UK_P=""
      if [ -n "$UK_U" ]; then
        read -r -s -p "UK_PASSWORD (no se muestra): " UK_P; echo ""
      fi
      if [ -n "$UK_U" ]; then
        grep -v '^UK_USERNAME=' .env > .env.tmp || true; mv .env.tmp .env
        grep -v '^UK_PASSWORD=' .env > .env.tmp || true; mv .env.tmp .env
        echo "UK_USERNAME=$UK_U" >> .env
        echo "UK_PASSWORD=$UK_P" >> .env
        ok "credenciales guardadas en .env (permiso 600)"
      else
        warn "credenciales vacías: monitoring-api arrancará en modo demo"
      fi
    fi
  else
    ok "UK_USERNAME ya configurado en .env"
  fi
}

# --- 5. Levantar todo ----------------------------------------------------------
compose_up() {
  echo ""
  echo "=== 5/7 Arranque de contenedores ==="
  echo ""
  tip "docker compose pull" "descarga la imagen oficial de Uptime Kuma (la nuestra se construye local)"
  docker compose pull 2>/dev/null || warn "no se pudo hacer pull (¿sin internet?); se intentará con imágenes locales"
  tip "docker compose up -d --build" "construye/inicia los servicios del compose y los deja corriendo en segundo plano"
  docker compose up -d --build
  echo ""
  tip "docker compose ps" "muestra el estado de los contenedores del proyecto"
  docker compose ps
}

# --- 6. Health checks ----------------------------------------------------------
health_checks() {
  echo ""
  echo "=== 6/7 Health checks ==="
  echo ""
  echo "Esperando a que la API responda (máx. 120 s; Kuma tarda en arrancar)..."
  READY=0
  for i in $(seq 1 24); do
    if curl -sf -m 5 http://localhost:8090/api/health >/dev/null 2>&1; then READY=1; break; fi
    sleep 5
  done
  if [ "$READY" = 1 ]; then ok http://localhost:8090/api/health "responde"; else warn "la API aún no responde; revisa con: docker compose logs monitoring-api"; fi

  echo ""
  tip "docker ps --format ..." "lista los contenedores en ejecución (formato compacto)"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|monitoring-lab' || true
  echo ""
  if docker volume ls --format '{{.Name}}' | grep -qE 'uptime-kuma-data$'; then
    ok "volumen uptime-kuma-data existe (persistencia OK)"
  else
    warn "volumen uptime-kuma-data no encontrado"
  fi
}

# --- Utilidad: estado de un servicio ------------------------------------------
svc_state() { # $1 = nombre del servicio en compose
  docker compose ps "$1" --format '{{.State}}' 2>/dev/null | head -1
}

# --- 7. Resumen final -----------------------------------------------------------
final_summary() {
  echo ""
  echo "=== 7/7 Resumen final ==="
  echo ""
  printf '%-22s %s\n' "SERVICIO" "ESTADO"
  printf '%-22s %s\n' "----------------------" "------"

  KUMA_ESTADO="❌"; if curl -sf -m 5 http://127.0.0.1:3001/ >/dev/null 2>&1; then KUMA_ESTADO="✅"; fi
  API_ESTADO="❌";  if curl -sf -m 5 http://localhost:8090/api/health >/dev/null 2>&1; then API_ESTADO="✅"; fi
  DASH_ESTADO="❌"; if curl -sf -m 5 http://localhost:8090/ >/dev/null 2>&1; then DASH_ESTADO="✅"; fi
  TEST_ESTADO="❌"; if [ "$(svc_state test-service)" = "running" ]; then TEST_ESTADO="✅"; fi
  VOL_ESTADO="❌";  if docker volume ls --format '{{.Name}}' | grep -qE 'uptime-kuma-data$'; then VOL_ESTADO="✅"; fi

  printf '%-22s %s\n' "Uptime Kuma"        "$KUMA_ESTADO (127.0.0.1:3001, solo localhost)"
  printf '%-22s %s\n' "Monitoring API"     "$API_ESTADO (/api/health)"
  printf '%-22s %s\n' "Learning Dashboard" "$DASH_ESTADO (puerto 8090)"
  printf '%-22s %s\n' "Test Service"       "$TEST_ESTADO (red interna, Chaos Lab)"
  printf '%-22s %s\n' "Persistencia"       "$VOL_ESTADO (volumen uptime-kuma-data)"
  printf '%-22s %s\n' "Acceso SSH"         "✅ (estás conectado al servidor)"
  echo ""
  IP_PUB=$(curl -s -m 8 https://api.ipify.org 2>/dev/null || echo "no detectada")
  echo "IP pública del servidor : $IP_PUB"
  echo "Puertos                 : 22 (SSH), 8090 (dashboard público), 3001 (Kuma, SOLO localhost)"
  echo "RAM / Disco             : $(free -g | awk '/^Mem:/{print $2}') GB RAM | $(df -h / | awk 'NR==2{print $4}') libres en /"
  echo "Contenedores            : $(docker compose ps -q 2>/dev/null | wc -l) en el proyecto monitoring-lab"
  echo ""
  echo "Acceso al dashboard (desde tu navegador):"
  echo "  http://$IP_PUB:8090"
  echo ""
  echo "Acceso al panel ADMIN de Uptime Kuma (túnel SSH cifrado):"
  echo "  1) En tu ordenador:  ssh -L 3001:127.0.0.1:3001 ubuntu@$IP_PUB"
  echo "  2) En tu navegador:  http://localhost:3001"
  echo "  (La primera vez, crea ahí el usuario administrador de Kuma)"
  echo ""
  warn "Abre el puerto 8090: 1) en Oracle Cloud (VCN → Security Lists → regla de"
  warn "     entrada TCP 8090) y 2) en el servidor:  sudo ufw allow 8090/tcp"
  echo ""
  echo "Comandos útiles:"
  echo "  docker compose logs -f monitoring-api   # ver logs de la API (solo lectura)"
  echo "  docker compose down                     # detener todo (los datos se conservan)"
  echo "  ./scripts/backup.sh                     # crear backup"
}

# --- Main ----------------------------------------------------------------------
check_system
check_docker
setup_dirs
setup_env
compose_up
health_checks
final_summary
echo ""
ok "Instalación completada."
