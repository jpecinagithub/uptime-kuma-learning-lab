'use strict';

/**
 * mode.js — Resolución del modo DEMO / REAL.
 *
 * - MODE=demo  → siempre datos simulados.
 * - MODE=real  → siempre datos reales (las rutas de Kuma devuelven 503 si no hay conexión).
 * - MODE=auto  → reales si el adapter está conectado a Kuma; si no, demo.
 *
 * El frontend puede sobrescribir por petición con ?mode=demo|real
 * (es lo que usa el conmutador DEMO/REAL del dashboard).
 */

const config = require('../config');

let adapter = null;

function init(a) {
  adapter = a;
}

function configured() {
  return config.mode;
}

function resolveOverride(q) {
  if (q === undefined || q === null || q === '') return null;
  const v = String(q).toLowerCase();
  if (v !== 'demo' && v !== 'real') {
    const e = new Error('Parámetro mode no válido. Usa demo o real.');
    e.status = 400;
    throw e;
  }
  return v;
}

function adapterConnected() {
  try {
    return !!(adapter && adapter.status().connected);
  } catch {
    return false;
  }
}

/** Modo efectivo para una petición (override de query tiene prioridad). */
function effective(override) {
  const want = override || configured();
  if (want === 'demo') return 'demo';
  if (want === 'real') return 'real';
  return adapterConnected() ? 'real' : 'demo';
}

/** Lanza 503 si se pidieron datos reales pero Kuma no está conectado. */
function requireRealConnected() {
  if (!adapterConnected()) {
    const e = new Error(
      'Uptime Kuma no está disponible. Activa el modo DEMO o revisa la conexión con Kuma.'
    );
    e.status = 503;
    throw e;
  }
}

module.exports = {
  init,
  configured,
  resolveOverride,
  effective,
  adapterConnected,
  requireRealConnected,
  getAdapter() {
    return adapter;
  },
};
