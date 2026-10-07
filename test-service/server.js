/**
 * test-service — Servicio deliberadamente controlable para el Chaos Lab.
 *
 * Es la "víctima" educativa del laboratorio: el Chaos Lab cambia su modo
 * y Uptime Kuma detecta el fallo, genera un incidente y el dashboard lo muestra.
 *
 * Modos (variable global `mode`):
 *   normal   → GET / responde 200 "ok" inmediatamente
 *   slow     → GET / responde 200 tras 2500 ms (latencia alta, pero "online")
 *   error500 → GET / responde 500 (el servidor responde, pero con error interno)
 *   timeout  → GET / tarda 35000 ms (el monitor de Kuma tiene timeout de 10 s → timeout)
 *   down     → GET / rompe la conexión TCP (req.socket.destroy())
 *
 * GET /healthz responde SIEMPRE { ok: true, mode } para que el healthcheck
 * de Docker no marque el contenedor como caído durante los experimentos.
 *
 * POST /admin/mode { mode } cambia el modo. Requiere cabecera
 * `x-admin-secret` igual a la variable de entorno TEST_SERVICE_SECRET.
 * Solo monitoring-api (red interna Docker) conoce ese secreto; el navegador
 * nunca lo ve: el frontend llama a /api/chaos y es el backend quien reenvía
 * la petición con el secreto.
 */
'use strict';

const express = require('express');

const app = express();
app.use(express.json({ limit: '16kb' }));

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_SECRET = process.env.TEST_SERVICE_SECRET || '';

const MODES = ['normal', 'slow', 'error500', 'timeout', 'down'];
let mode = 'normal';

// Retraso del modo "timeout": 35 s > timeout de 10 s del monitor de Uptime Kuma.
const TIMEOUT_DELAY_MS = 35000;
// Retraso del modo "slow": 2.5 s (lento pero dentro del timeout → se ve la latencia).
const SLOW_DELAY_MS = 2500;

app.get('/', (req, res) => {
  switch (mode) {
    case 'slow':
      // Respuesta lenta: Uptime Kuma lo verá "online" pero con latencia alta.
      setTimeout(() => {
        if (!res.headersSent) res.status(200).send('ok (slow)');
      }, SLOW_DELAY_MS);
      break;

    case 'error500':
      // El servidor responde, pero con error interno → Kuma lo marca DOWN.
      res.status(500).send('simulated HTTP 500');
      break;

    case 'timeout': {
      // Nunca respondemos a tiempo: el cliente (Kuma) agota su timeout de 10 s.
      const timer = setTimeout(() => {
        try {
          if (!res.headersSent) res.status(200).send('ok (too late)');
        } catch (_) { /* el cliente ya se fue */ }
      }, TIMEOUT_DELAY_MS);
      // Si el cliente cierra la conexión, limpiamos el temporizador.
      req.on('close', () => clearTimeout(timer));
      break;
    }

    case 'down':
      // Rompemos la conexión TCP sin responder nada: "connection reset".
      req.socket.destroy();
      break;

    case 'normal':
    default:
      res.status(200).send('ok');
      break;
  }
});

// Siempre responde, en cualquier modo: lo usa el healthcheck de Docker.
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, mode });
});

// Cambio de modo. Solo con el secreto de administración.
app.post('/admin/mode', (req, res) => {
  const provided = req.get('x-admin-secret') || '';
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const next = req.body && req.body.mode;
  if (!MODES.includes(next)) {
    return res.status(400).json({ ok: false, error: 'invalid mode', modes: MODES });
  }
  mode = next;
  console.log(`[test-service] mode -> ${mode}`);
  res.json({ ok: true, mode });
});

app.listen(PORT, () => {
  console.log(`[test-service] listening on :${PORT} (mode=${mode})`);
});
