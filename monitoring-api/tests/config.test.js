'use strict';

/**
 * config.test.js — El .env que generan .env.example e install.sh usa
 * UK_USERNAME / UK_PASSWORD. El backend debe leerlos (además del alias
 * KUMA_USERNAME / KUMA_PASSWORD). Regresión: un desacuerdo de nombres
 * dejaba al adapter sin credenciales y el modo se quedaba en "demo"
 * sin ningún error en los logs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const KEYS = ['MODE', 'PORT', 'KUMA_URL', 'KUMA_USERNAME', 'KUMA_PASSWORD',
  'UK_USERNAME', 'UK_PASSWORD', 'KUMA_METRICS_API_KEY', 'SEED_MONITORS',
  'TEST_SERVICE_URL', 'TEST_SERVICE_SECRET', 'TZ'];

function loadConfig(extra) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, extra);
  delete require.cache[require.resolve('../src/config.js')];
  const cfg = require('../src/config.js');
  for (const k of KEYS) { delete process.env[k]; if (saved[k] !== undefined) process.env[k] = saved[k]; }
  return cfg;
}

test('lee UK_USERNAME / UK_PASSWORD (los de install.sh)', () => {
  const cfg = loadConfig({ UK_USERNAME: 'jpecina', UK_PASSWORD: 'secreto' });
  assert.equal(cfg.kuma.username, 'jpecina');
  assert.equal(cfg.kuma.password, 'secreto');
});

test('acepta KUMA_USERNAME / KUMA_PASSWORD como alias', () => {
  const cfg = loadConfig({ KUMA_USERNAME: 'admin', KUMA_PASSWORD: 'pw' });
  assert.equal(cfg.kuma.username, 'admin');
  assert.equal(cfg.kuma.password, 'pw');
});

test('KUMA_* tiene prioridad si ambos están definidos', () => {
  const cfg = loadConfig({ KUMA_USERNAME: 'a', UK_USERNAME: 'b', KUMA_PASSWORD: 'c', UK_PASSWORD: 'd' });
  assert.equal(cfg.kuma.username, 'a');
  assert.equal(cfg.kuma.password, 'c');
});

test('sin credenciales → cadenas vacías (el adapter no intenta conectar)', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.kuma.username, '');
  assert.equal(cfg.kuma.password, '');
});
