# LEARNING — Glosario del laboratorio

Explicaciones cortas, sin academicismos. Cada pantalla importante del
dashboard tiene además su botón **"¿Qué está ocurriendo aquí?"**.

- **Docker**: programa que ejecuta aplicaciones empaquetadas (contenedores)
  aisladas entre sí, sin necesidad de una máquina virtual completa.
- **Contenedor**: una aplicación empaquetada con todo lo que necesita para
  correr (código, dependencias, configuración). Si se borra, se vuelve a crear
  idéntico desde su imagen.
- **Imagen Docker**: la "plantilla" de solo lectura desde la que se crean
  contenedores (p. ej. `louislam/uptime-kuma:2`).
- **Volumen**: carpeta gestionada por Docker que persiste aunque el contenedor
  se borre. Aquí vive la base de datos de Uptime Kuma.
- **Puerto**: número que identifica un servicio dentro de una máquina.
  *Público* (8090: accesible desde Internet), *localhost* (3001: solo dentro
  del servidor), *interno Docker* (4000: solo entre contenedores).
- **API**: forma pactada de pedirle cosas a un programa por red (normalmente
  HTTP con JSON). Nuestra API expone `/api/monitors`, `/api/health`, etc.
- **HTTP**: el protocolo con el que el navegador pide páginas y las APIs
  responden. Un check HTTP es: conectar → pedir → medir qué responde.
- **DNS**: el sistema que traduce nombres (`example.com`) a IPs
  (`93.184.216.34`). Sin DNS, tendrías que memorizar números.
- **TCP**: protocolo que establece una conexión fiable entre dos máquinas
  (con el famoso apretón de manos SYN → SYN-ACK → ACK) antes de enviar datos.
- **Ping (ICMP)**: envía un "¿estás ahí?" (Echo Request) y mide cuánto tarda
  la respuesta (Echo Reply). Simple y rápido; algunos servidores lo bloquean.
- **Latencia**: tiempo de ida y vuelta entre nuestro servidor y el servicio
  monitorizado, en milisegundos. Menos = mejor.
- **Uptime**: porcentaje de tiempo que un servicio ha estado disponible
  (99,9 % ≈ 8,8 h de caída al año).
- **Timeout**: tiempo máximo que esperamos una respuesta antes de rendirnos
  y declarar el check como fallido.
- **Reverse proxy**: un servidor (aquí nginx) que recibe peticiones y las
  reenvía al servicio correcto. Así el navegador habla con un solo puerto.
- **Handshake TLS**: negociación cifrada antes del HTTP en `https://`:
  Client Hello → Server Hello → Certificate → canal cifrado.
- **Códigos HTTP**: 200 todo bien · 301/302 redirección · 400 petición mal
  formada · 401 falta autenticación · 403 prohibido · 404 no existe ·
  429 demasiadas peticiones · 500 error interno del servidor · 502/503/504
  fallos de puerta de enlace o servicio no disponible.
- **Certificado TLS**: credencial que demuestra que `https://tudominio.com` es
  quien dice ser y cifra la comunicación. Caduca: hay que renovarlo.
- **Incidente**: periodo entre que Uptime Kuma detecta una caída (tras N
  intentos fallidos, para no alarmar por un fallo aislado) y que el servicio
  se recupera.
- **Disponibilidad**: lo mismo que uptime, expresado como objetivo
  (p. ej. "99,9 % mensual").
- **Healthcheck**: prueba automática que Docker hace a cada contenedor
  (`/api/health`, `/healthz`) para saber si sigue sano.
- **Red bridge**: red privada virtual que Docker crea para que los
  contenedores se hablen entre sí por nombre, aislados del exterior.
- **SSRF**: ataque que engaña a un servidor para que haga peticiones a
  destinos internos. Por eso los laboratorios bloquean rangos privados y la
  metadata cloud (ver SECURITY.md).
