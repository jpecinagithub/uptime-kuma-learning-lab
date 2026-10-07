'use strict';

/**
 * config.js — Configuración centralizada desde variables de entorno.
 *
 * NUNCA se loguean secretos (KUMA_PASSWORD, TEST_SERVICE_SECRET, etc.).
 * Ver .env.example en la raíz del proyecto para la lista completa.
 */

require('dotenv').config();

function envMode() {
  const m = String(process.env.MODE || 'auto').toLowerCase();
  return ['auto', 'demo', 'real'].includes(m) ? m : 'auto';
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),

  // auto: usa datos reales si el adapter conecta con Kuma; si no, demo.
  // demo: siempre datos simulados. real: siempre reales (503 si Kuma no responde).
  mode: envMode(),

  kuma: {
    url: process.env.KUMA_URL || 'http://uptime-kuma:3001',
    // Se aceptan ambos nombres: UK_* (los que generan .env.example e
    // install.sh) y KUMA_* (alias). Así un .env ya creado sigue valiendo.
    username: process.env.KUMA_USERNAME || process.env.UK_USERNAME || '',
    password: process.env.KUMA_PASSWORD || process.env.UK_PASSWORD || '',
    metricsApiKey: process.env.KUMA_METRICS_API_KEY || '',
  },

  // Si true, crea monitores de ejemplo cuando la lista de Kuma está vacía.
  seedMonitors: process.env.SEED_MONITORS === 'true',

  testService: {
    url: (process.env.TEST_SERVICE_URL || 'http://test-service:3000').replace(/\/+$/, ''),
    secret: process.env.TEST_SERVICE_SECRET || '',
  },
};
