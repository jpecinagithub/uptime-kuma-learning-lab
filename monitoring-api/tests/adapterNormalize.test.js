'use strict';

/**
 * adapterNormalize.test.js — Funciones puras del adapter (sin socket).
 * Verifica el mapeo de tipos, la normalización de heartbeats y el
 * agrupado de incidentes.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMonitor,
  normalizeHeartbeat,
  groupIncidents,
  STATUS,
  TYPE_MAP,
} = require('../src/services/uptimeKumaAdapter');

test('TYPE_MAP y STATUS documentados', () => {
  assert.deepEqual(STATUS, { DOWN: 0, UP: 1, PENDING: 2, MAINTENANCE: 3 });
  assert.equal(TYPE_MAP.http, 'http');
  assert.equal(TYPE_MAP.port, 'tcp');
  assert.equal(TYPE_MAP.ping, 'ping');
  assert.equal(TYPE_MAP.dns, 'dns');
});

test('normalizeMonitor: tipos y campos', () => {
  assert.equal(normalizeMonitor({ id: 1, name: 'A', url: 'https://a.com', type: 'http' }).type, 'http');
  assert.equal(normalizeMonitor({ id: 2, name: 'B', type: 'port', hostname: 'h', port: 443 }).type, 'tcp');
  assert.equal(normalizeMonitor({ id: 3, name: 'C', type: 'ping', hostname: 'h' }).type, 'ping');
  assert.equal(normalizeMonitor({ id: 4, name: 'D', type: 'dns', hostname: 'h' }).type, 'dns');
  assert.equal(normalizeMonitor({ id: 5, name: 'E', type: 'keyword', url: 'https://a.com' }).type, 'http');
  const m = normalizeMonitor({
    id: 6, name: 'F', url: 'https://a.com', type: 'http',
    interval: 20, timeout: 10, description: 'desc',
  });
  assert.equal(m.id, '6');
  assert.equal(m.intervalSec, 20);
  assert.equal(m.timeoutSec, 10);
  assert.equal(m.description, 'desc');
  assert.equal(normalizeMonitor(null), null);
});

test('normalizeHeartbeat: time, status, ping', () => {
  const b = normalizeHeartbeat({
    monitorID: 7, status: 1, time: '2026-10-07 12:00:00', ping: 123.4, msg: 'OK', code: 200,
  });
  assert.equal(b.monitorId, '7');
  assert.equal(b.ms, 123.4);
  assert.equal(b.status, 1);
  assert.equal(b.code, 200);
  assert.equal(b.msg, 'OK');
  assert.ok(!Number.isNaN(Date.parse(b.t)), 't debe ser ISO parseable');
  // "YYYY-MM-DD HH:mm:ss" se interpreta como UTC
  assert.equal(b.t, '2026-10-07T12:00:00.000Z');

  // status fuera de rango → UP por defecto (defensivo)
  assert.equal(normalizeHeartbeat({ monitorID: 1, status: 9, time: '2026-10-07T12:00:00Z' }).status, 1);
  // sin time → null
  assert.equal(normalizeHeartbeat({ monitorID: 1, status: 0 }), null);
  assert.equal(normalizeHeartbeat(null), null);
});

test('groupIncidents: DOWN→UP forma incidentes', () => {
  const T = (m) => `2026-10-07T12:${String(m).padStart(2, '0')}:00.000Z`;
  const beats = [
    { t: T('00'), status: 1, ms: 10, code: 200, msg: null },
    { t: T('01'), status: 1, ms: 11, code: 200, msg: null },
    { t: T('02'), status: 0, ms: null, code: 500, msg: 'HTTP 500' },
    { t: T('03'), status: 0, ms: null, code: null, msg: 'Timeout' },
    { t: T('04'), status: 1, ms: 12, code: 200, msg: null },
    { t: T('05'), status: 0, ms: null, code: null, msg: 'Timeout' },
  ];
  const inc = groupIncidents(beats, '9', 'Nueve');
  assert.equal(inc.length, 2);

  const first = inc[0];
  assert.equal(first.monitorId, '9');
  assert.equal(first.monitorName, 'Nueve');
  assert.equal(first.start, T('02'));
  assert.equal(first.end, T('04'));
  assert.equal(first.durationMs, 2 * 60 * 1000);
  assert.equal(first.events.length, 3);
  assert.deepEqual(first.events[0], { t: T('02'), status: 0, code: 500, msg: 'HTTP 500' });

  const open = inc[1];
  assert.equal(open.end, null);
  assert.equal(open.durationMs, null);
  assert.equal(open.events.length, 1);
});

test('groupIncidents: sin caídas → sin incidentes', () => {
  const beats = [
    { t: '2026-10-07T12:00:00.000Z', status: 1, ms: 10, code: 200, msg: null },
    { t: '2026-10-07T12:01:00.000Z', status: 1, ms: 11, code: 200, msg: null },
  ];
  assert.deepEqual(groupIncidents(beats, '1', 'Uno'), []);
});
