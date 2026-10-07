FROM node:20-alpine

# iputils: necesario para el laboratorio de ping (`ping -c 4 -W 2 <host>`)
RUN apk add --no-cache iputils

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Ejecuta como usuario sin privilegios
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
