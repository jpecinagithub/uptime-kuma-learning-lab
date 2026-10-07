'use strict';

/**
 * index.js — Punto de entrada de monitoring-api.
 *
 * - helmet: cabeceras de seguridad.
 * - express.json({limit:"64kb"}): cuerpos acotados.
 * - Rate limits: global 1000 req/15min; labs y check-journey 30 req/min/IP.
 * - Todas las rutas bajo /api/*. 404 JSON. Error handler sin stack traces.
 * - El adapter de Kuma arranca en segundo plano: NUNCA bloquea el arranque.
 * - No se loguean secretos.
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const config = require('./config');
const mode = require('./services/mode');
const { UptimeKumaAdapter } = require('./services/uptimeKumaAdapter');

const app = express();

// Detrás de nginx (un solo salto) para que el rate-limit vea la IP real
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '64kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo más tarde.' },
});

const labsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite del laboratorio: 30 peticiones por minuto.' },
});

app.use('/api', apiLimiter);
app.use('/api/labs', labsLimiter);
app.use('/api/check-journey', labsLimiter);

app.use('/api/health', require('./routes/health'));
app.use('/api/monitors', require('./routes/monitors'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/server', require('./routes/server'));
app.use('/api/docker', require('./routes/docker'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/labs', require('./routes/labs'));
app.use('/api/chaos', require('./routes/chaos'));
app.use('/api/check-journey', require('./routes/journey'));

// 404 para /api/*
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Error handler: JSON, sin stack traces. Solo el 500 genérico oculta el
// mensaje; los demás códigos (400/403/404/502/503) llevan mensajes
// intencionales en español y se muestran tal cual.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  if (status === 500) console.error('[monitoring-api]', err.message);
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor.' : err.message || 'Error.',
  });
});

// Adapter de Kuma: arranque no bloqueante (modo auto → demo hasta conectar)
const adapter = new UptimeKumaAdapter({
  url: config.kuma.url,
  username: config.kuma.username,
  password: config.kuma.password,
  metricsApiKey: config.kuma.metricsApiKey,
  seedMonitors: config.seedMonitors,
});
mode.init(adapter);
adapter.start();

const server = app.listen(config.port, () => {
  console.log(`[monitoring-api] escuchando en :${config.port} (modo=${config.mode})`);
});

function shutdown(signal) {
  console.log(`[monitoring-api] ${signal}: cerrando…`);
  adapter.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
