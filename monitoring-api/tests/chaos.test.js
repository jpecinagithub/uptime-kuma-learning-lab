'use strict';

/**
 * chaos.test.js — Cliente del Chaos Lab en modo DEMO (estado en memoria).
 * No toca red: el modo demo no llama a test-service.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestService, validateMode, MODES } = require('../src/services/testService');

test('MODES es el enum del contrato', () => {
  assert.deepEqual(MODES, ['normal', 'slow', 'error500', 'timeout', 'down']);
});

test('demo: get/set en memoria', async () => {
  const ts = createTestService({ mode: 'demo' });
  assert.equal(await ts.getMode(), 'normal');
  for (const m of MODES) {
    assert.equal(await ts.setMode(m), m);
    assert.equal(await ts.getMode(), m);
  }
  await ts.setMode('normal'); // deja el estado limpio
  assert.equal(await ts.getMode(), 'normal');
});

test('modo inválido → 400 con mensaje en español', async () => {
  const ts = createTestService({ mode: 'demo' });
  await assert.rejects(() => ts.setMode('boom'), (e) => {
    assert.equal(e.status, 400);
    assert.match(e.message, /Modo no válido/);
    return true;
  });
  assert.throws(() => validateMode(''), /Modo no válido/);
});
