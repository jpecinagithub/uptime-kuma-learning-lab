FROM node:20-alpine

# iputils: necesario para el laboratorio de ping (`ping -c 4 -W 2 <host>`)
# docker-cli: necesario para `docker ps/stats/logs` (solo lectura, ver guards.js)
# su-exec: el entrypoint arranca como root para dar acceso al socket y luego baja a `node`
RUN apk add --no-cache iputils docker-cli su-exec

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# NOTA: no hay `USER node` a propósito. El entrypoint (ver entrypoint.sh)
# mete al usuario `node` en el grupo dueño de /var/run/docker.sock y después
# baja privilegios con su-exec: el proceso principal nunca corre como root.
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
