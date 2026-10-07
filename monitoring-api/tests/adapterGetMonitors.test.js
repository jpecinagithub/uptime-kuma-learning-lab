'use strict';

/**
 * adapterGetMonitors.test.js — getMonitors() sin socket real.
 *
 * Regresión (2026-10-07, despliegue real): con el adapter conectado pero la
 * lista de Kuma vacía (el seed fallaba porque en 2.x el evento es "add",
 * no "addMonitor"), getMonitors() lanzaba 503 y el dashboard mostraba
 * "No se pudieron cargar los monitores". Una lista vacía es un estado
 * válido → debe devolver [], y el 503 queda reservado para "no conectado".
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UptimeKumaAdapter } = require('../src/services/uptimeKumaAdapter');

function makeAdapter() {
  return new UptimeKumaAdapter({
    url: 'http://uptime-kuma:3001',
    username: 'u',
    password: 'p',
    seedMonitors: false,
  });
}

test('getMonitors: conectado y lista vacía → [] (no 503)', async () => {
  const a = makeAdapter();
  a.connected = true;
  const list = await a.getMonitors();
  assert.deepEqual(list, []);
});

test('getMonitors: desconectado → error 503', async () => {
  const a = makeAdapter();
  a.connected = false;
  await assert.rejects(
    () => a.getMonitors(),
    (e) => e && e.status === 503
  );
});
