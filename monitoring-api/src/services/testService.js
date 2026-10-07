'use strict';

/**
 * testService.js — Cliente del Chaos Lab hacia test-service.
 *
 * Contrato con test-service (implementado por el subproyecto test-service):
 *   GET  <TEST_SERVICE_URL>/healthz      → { ok: true, mode }
 *   POST <TEST_SERVICE_URL>/admin/mode   → { ok: true, mode }
 *        body { mode }, cabecera `x-admin-secret: <TEST_SERVICE_SECRET>`
 *
 * Modos: normal | slow | error500 | timeout | down
 *
 * El Chaos Lab SOLO puede afectar a test-service: este es el único destino
 * cableado aquí. En modo DEMO el estado vive en memoria del proceso.
 */

const axios = require('axios');
const config = require('../config');

const MODES = ['normal', 'slow', 'error500', 'timeout', 'down'];

// Estado en memoria para el modo DEMO (persiste mientras el proceso viva)
let memoryMode = 'normal';

function validateMode(m) {
  if (!MODES.includes(m)) {
    const e = new Error(`Modo no válido. Usa uno de: ${MODES.join(', ')}.`);
    e.status = 400;
    throw e;
  }
  return m;
}

function createTestService({ mode }) {
  const base = config.testService.url;
  const secret = config.testService.secret;

  async function getMode() {
    if (mode === 'demo') return memoryMode;
    try {
      const r = await axios.get(`${base}/healthz`, { timeout: 5000 });
      const m = r.data && r.data.mode;
      return MODES.includes(m) ? m : 'unknown';
    } catch {
      const e = new Error('No se pudo contactar con test-service. ¿Está levantado el contenedor?');
      e.status = 502;
      throw e;
    }
  }

  async function setMode(m) {
    validateMode(m);
    if (mode === 'demo') {
      memoryMode = m;
      return m;
    }
    try {
      const r = await axios.post(
        `${base}/admin/mode`,
        { mode: m },
        { timeout: 5000, headers: { 'x-admin-secret': secret } }
      );
      return r.data && r.data.mode ? r.data.mode : m;
    } catch (err) {
      if (err.response && err.response.status === 401) {
        const e = new Error('test-service rechazó el secreto de administración (revisa TEST_SERVICE_SECRET).');
        e.status = 502;
        throw e;
      }
      const e = new Error('No se pudo aplicar el modo en test-service. ¿Está levantado el contenedor?');
      e.status = 502;
      throw e;
    }
  }

  return { getMode, setMode };
}

module.exports = { createTestService, validateMode, MODES };
