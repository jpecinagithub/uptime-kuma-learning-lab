'use strict';

/**
 * demoData.test.js — El generador demo debe ser determinista y producir
 * EXACTAMENTE las formas del contrato público.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const demo = require('../src/services/demoData');

const MONITOR_KEYS = [
  'id', 'name', 'url', 'type', 'status', 'uptimePct', 'latencyMs', 'avgLatencyMs',
  'lastCheck', 'incidents', 'lastIncident', 'description', 'intervalSec', 'timeoutSec',
];

test('monitores: 6, forma del contrato y determinismo', () => {
  const a = demo.getDemoMonitors();
  const b = demo.getDemoMonitors();
  assert.deepEqual(a, b, 'debe ser determinista en el mismo proceso/día');
  assert.equal(a.length, 6);
  const statuses = new Set(a.map((m) => m.status));
  assert.ok(statuses.has('down'), 'debe incluir un monitor caído');
  assert.ok(statuses.has('degraded'), 'debe incluir un monitor degradado');
  assert.ok(statuses.has('up'), 'debe incluir monitores operativos');
  for (const m of a) {
    for (const k of MONITOR_KEYS) assert.ok(k in m, `falta la clave ${k}`);
    assert.ok(['http', 'ping', 'tcp', 'dns'].includes(m.type), `tipo raro: ${m.type}`);
    assert.ok(['up', 'down', 'degraded', 'unknown', 'pending'].includes(m.status));
  }
});

test('getDemoMonitor: detalle y 404', () => {
  const m = demo.getDemoMonitor('demo-1');
  assert.ok(m && m.id === 'demo-1');
  assert.equal(demo.getDemoMonitor('nope'), null);
});

test('historial: puntos con forma, ordenados y códigos Kuma', () => {
  for (const range of ['1h', '6h', '24h', '7d', '30d']) {
    const h = demo.getDemoHistory('demo-1', range);
    assert.equal(h.mode, 'demo');
    assert.equal(h.monitorId, 'demo-1');
    assert.equal(h.range, range);
    assert.ok(h.points.length > 5, `pocos puntos en ${range}`);
    let prev = '';
    for (const p of h.points) {
      assert.ok(p.t > prev, 'puntos desordenados');
      prev = p.t;
      assert.ok([0, 1, 2, 3].includes(p.status), 'status debe ser int de Kuma');
      assert.ok('ms' in p && 'code' in p && 'msg' in p);
    }
  }
  assert.equal(demo.getDemoHistory('nope', '24h'), null);
});

test('incidentes: forma y duración coherente', () => {
  const { mode, incidents } = demo.getDemoIncidents('7d');
  assert.equal(mode, 'demo');
  assert.ok(incidents.length > 0, 'el monitor caído debe generar incidentes');
  let prevStart = '9999';
  for (const i of incidents) {
    for (const k of ['id', 'monitorId', 'monitorName', 'start', 'end', 'durationMs', 'events']) {
      assert.ok(k in i, `falta ${k}`);
    }
    assert.ok(i.start <= prevStart, 'incidentes ordenados desc');
    prevStart = i.start;
    assert.ok(i.events.length > 0);
    assert.equal(i.events[0].status, 0, 'un incidente empieza en DOWN');
    if (i.end) {
      assert.equal(i.durationMs, Date.parse(i.end) - Date.parse(i.start));
    } else {
      assert.equal(i.durationMs, null);
    }
  }
});

test('server/docker/logs: formas del contrato', () => {
  const s = demo.getDemoServer();
  assert.equal(s.mode, 'demo');
  for (const k of ['ts', 'cpu', 'mem', 'disk', 'uptime', 'load', 'net']) assert.ok(k in s);
  assert.ok('pct' in s.cpu && 'cores' in s.cpu);

  const d = demo.getDemoContainers();
  assert.equal(d.mode, 'demo');
  assert.equal(d.containers.length, 4);
  for (const c of d.containers) {
    for (const k of ['name', 'image', 'state', 'status', 'uptime', 'cpuPct', 'memMb', 'memPct', 'ports', 'created']) {
      assert.ok(k in c, `falta ${k}`);
    }
    assert.ok(['running', 'exited'].includes(c.state));
  }

  const l = demo.getDemoLogs('monitoring-api', 100);
  assert.equal(l.service, 'monitoring-api');
  assert.equal(l.lines.length, 100);
  assert.ok(l.lines.every((x) => typeof x === 'string'));
});
