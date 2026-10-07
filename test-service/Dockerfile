# test-service — servicio "víctima" controlada para el Chaos Lab.
# Imagen oficial de Node 20 sobre Alpine (ligera, ~50 MB). Funciona en ARM64 y AMD64.
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero solo los manifiestos para aprovechar la caché de capas de Docker:
# si el código cambia pero las dependencias no, esta capa se reutiliza.
COPY package.json package-lock.json* ./

# Instalamos solo dependencias de producción (sin devDependencies)
RUN npm install --omit=dev && npm cache clean --force

# Ahora sí, el código de la aplicación
COPY server.js ./

# Buena práctica de seguridad: no correr como root dentro del contenedor.
# El usuario "node" ya existe en la imagen oficial.
USER node

# Puerto interno (solo visible dentro de la red Docker lab-net, NO se publica al host)
EXPOSE 3000

# Healthcheck: Docker pregunta periódicamente a /healthz.
# /healthz responde SIEMPRE, incluso en modo "down" (solo / falla),
# para que el Chaos Lab no mate el contenedor por accidente.
# wget viene incluido en Alpine (busybox).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

CMD ["node", "server.js"]
