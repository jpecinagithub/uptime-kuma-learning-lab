'use strict';

/**
 * demoData.js — Generador DETERMINISTA de datos simulados (modo DEMO).
 *
 * Produce EXACTAMENTE las mismas formas del contrato que el modo real, pero
 * con datos inventados de forma reproducible: mulberry32 con semilla diaria,
 * así el dashboard muestra lo mismo durante todo el día (estable para
 * explorar) y cambia al día siguiente.
 *
 * Incluye 6 monitores: 4 estables, 1 degradado y 1 caído, para que se vean
 * incidentes, latencias y estados variados sin necesidad de Uptime Kuma.
 *
 * El frontend muestra SIEMPRE el badge "DEMO" cuando estos datos están en uso.
 */

const { groupIncidents } = require('./uptimeKumaAdapter');

const RANGES = {
  '1h': { ms: 3600e3, step: 60e3 },
  '6h': { ms: 6 * 3600e3, step: 5 * 60e3 },
  '24h': { ms: 24 * 3600e3, step: 15 * 60e3 },
  '7d': { ms: 7 * 86400e3, step: 3600e3 },
  '30d': { ms: 30 * 86400e3, step: 6 * 3600e3 },
};

const MONITOR_DEFS = [
  {
    id: 'demo-1', name: 'Learning Dashboard', url: 'http://monitoring-frontend/', type: 'http',
    baseMs: 32, jitter: 12, behavior: 'stable',
    description: 'El propio panel educativo (este dashboard).', intervalSec: 60, timeoutSec: 10,
  },
  {
    id: 'demo-2', name: 'Nobel Explorer', url: 'https://nobel-explorer.example.com', type: 'http',
    baseMs: 184, jitter: 40, behavior: 'stable',
    description: 'Web pública de ejemplo.', intervalSec: 60, timeoutSec: 10,
  },
  {
    id: 'demo-3', name: 'API Demo', url: 'https://api-demo.example.com/health', type: 'http',
    baseMs: 210, jitter: 60, behavior: 'down',
    description: 'Endpoint HTTP de pruebas (actualmente caído: simula un incidente real).',
    intervalSec: 60, timeoutSec: 10,
  },
  {
    id: 'demo-4', name: 'Servicio TCP', url: 'tcp://1.1.1.1:443', type: 'tcp',
    baseMs: 28, jitter: 8, behavior: 'stable',
    description: 'Chequeo TCP al puerto 443 de 1.1.1.1.', intervalSec: 60, timeoutSec: 5,
  },
  {
    id: 'demo-5', name: 'Ping 1.1.1.1', url: '1.1.1.1', type: 'ping',
    baseMs: 22, jitter: 6, behavior: 'stable',
    description: 'Latencia ICMP hacia 1.1.1.1.', intervalSec: 60, timeoutSec: 5,
  },
  {
    id: 'demo-6', name: 'Test Service (Chaos)', url: 'http://test-service:3000/', type: 'http',
    baseMs: 120, jitter: 300, behavior: 'degraded',
    description: 'Servicio de pruebas para el Chaos Lab (responde lento a ratos).',
    intervalSec: 20, timeoutSec: 10,
  },
];

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Caché por día para no regenerar en cada petición (determinista de todos modos)
const cache = new Map();
function cacheKey(...parts) {
  return [dayKey(), ...parts].join('|');
}

function downMessage(rng) {
  const opts = ['Timeout', 'HTTP 500', 'Connection refused'];
  return opts[Math.floor(rng() * opts.length)];
}

/**
 * Genera el historial de un monitor para un rango, con la forma:
 * [{ t:ISO, ms, status:0|1|2|3, code, msg }]
 */
function genHistory(def, range) {
  const key = cacheKey('hist', def.id, range);
  if (cache.has(key)) return cache.get(key);

  const { ms: rangeMs, step } = RANGES[range] || RANGES['24h'];
  const rng = mulberry32(hashSeed(`${dayKey()}|${def.id}|${range}`));
  const now = Date.now();
  const points = [];

  for (let t = now - rangeMs; t <= now; t += step) {
    const r = rng();
    let status = 1;
    let ms = null;
    let code = null;
    let msg = null;

    if (def.behavior === 'down') {
      // Caído en los últimos 45 minutos; antes, mayormente estable con algún bache
      if (t > now - 45 * 60e3) status = 0;
      else if (r > 0.97) status = 0;
    } else if (def.behavior === 'degraded') {
      if (r > 0.96) status = 0;
    } else {
      if (r > 0.995) status = 0; // bache raro en estables
    }

    if (status === 1) {
      const spike = def.behavior === 'degraded' && rng() > 0.7 ? 4 : 1;
      ms = Math.max(1, Math.round((def.baseMs + (rng() * 2 - 1) * def.jitter * spike) * 10) / 10);
      code = def.type === 'http' ? 200 : null;
    } else {
      msg = def.type === 'http' ? downMessage(rng) : 'Sin respuesta';
      code = def.type === 'http' && msg === 'HTTP 500' ? 500 : null;
    }

    points.push({ t: new Date(t).toISOString(), ms, status, code, msg });
  }

  cache.set(key, points);
  return points;
}

function aggregateMonitor(def) {
  const beats = genHistory(def, '30d');
  const last = beats[beats.length - 1];
  const withMs = beats.filter((b) => b.ms !== null);
  const avg = withMs.length ? withMs.reduce((a, b) => a + b.ms, 0) / withMs.length : null;
  const ups = beats.filter((b) => b.status === 1).length;
  const downs = beats.filter((b) => b.status === 0).length;
  const uptimePct = ups + downs > 0 ? Math.round((10000 * ups) / (ups + downs)) / 100 : null;
  const incidents = groupIncidents(beats, def.id, def.name);
  let status = 'unknown';
  if (last) {
    status = last.status === 1 ? 'up' : last.status === 0 ? 'down' : 'pending';
    if (status === 'up' && avg !== null && avg > 2000) status = 'degraded';
    if (def.behavior === 'degraded' && status === 'up') status = 'degraded';
  }
  return {
    id: def.id,
    name: def.name,
    url: def.url,
    type: def.type,
    description: def.description,
    intervalSec: def.intervalSec,
    timeoutSec: def.timeoutSec,
    status,
    uptimePct,
    latencyMs: last ? last.ms : null,
    avgLatencyMs: avg !== null ? Math.round(avg * 10) / 10 : null,
    lastCheck: last ? last.t : null,
    incidents: incidents.length,
    lastIncident: incidents.length ? incidents[incidents.length - 1].start : null,
  };
}

function getDemoMonitors() {
  return MONITOR_DEFS.map(aggregateMonitor);
}

function getDemoMonitor(id) {
  const def = MONITOR_DEFS.find((d) => d.id === id);
  return def ? aggregateMonitor(def) : null;
}

function getDemoHistory(id, range) {
  const def = MONITOR_DEFS.find((d) => d.id === id);
  if (!def) return null;
  return { mode: 'demo', monitorId: id, range, points: genHistory(def, range) };
}

function getDemoIncidents(range) {
  const cutoff = Date.now() - ((RANGES[range] || RANGES['7d']).ms);
  const out = [];
  for (const def of MONITOR_DEFS) {
    const beats = genHistory(def, '30d').filter((b) => Date.parse(b.t) >= cutoff);
    const inc = groupIncidents(beats, def.id, def.name);
    for (const i of inc) {
      if (Date.parse(i.start) >= cutoff) out.push(i);
    }
  }
  return { mode: 'demo', incidents: out.sort((a, b) => (a.start < b.start ? 1 : -1)) };
}

function getDemoServer() {
  return {
    mode: 'demo',
    ts: new Date().toISOString(),
    source: 'demo',
    cpu: { pct: 12, cores: 4 },
    mem: { usedGb: 2.8, totalGb: 12, pct: 23 },
    disk: { usedGb: 18, totalGb: 100, pct: 18 },
    uptime: { days: 14, hours: 3, mins: 22 },
    load: [0.42, 0.35, 0.28],
    net: { rxBytes: 48213920123, txBytes: 12847559201 },
  };
}

function getDemoContainers() {
  const ts = new Date().toISOString();
  const list = [
    { name: 'uptime-kuma', image: 'louislam/uptime-kuma:2', state: 'running', status: 'Up 14 days', uptime: '14 days', cpuPct: 2.1, memMb: 187.4, memPct: 1.6, ports: [{ published: null, target: 3001 }], created: '2026-09-23T10:00:00Z' },
    { name: 'monitoring-api', image: 'monitoring-lab-api:latest', state: 'running', status: 'Up 14 days', uptime: '14 days', cpuPct: 0.8, memMb: 96.2, memPct: 0.8, ports: [], created: '2026-09-23T10:00:00Z' },
    { name: 'monitoring-frontend', image: 'nginx:alpine', state: 'running', status: 'Up 14 days', uptime: '14 days', cpuPct: 0.3, memMb: 24.8, memPct: 0.2, ports: [{ published: 8090, target: 80 }], created: '2026-09-23T10:00:00Z' },
    { name: 'test-service', image: 'monitoring-lab-test-service:latest', state: 'running', status: 'Up 14 days', uptime: '14 days', cpuPct: 0.2, memMb: 61.5, memPct: 0.5, ports: [], created: '2026-09-23T10:00:00Z' },
  ];
  return { mode: 'demo', ts, containers: list };
}

function getDemoLogs(service, lines) {
  const rng = mulberry32(hashSeed(`${dayKey()}|logs|${service}|${lines}`));
  const templates = {
    'uptime-kuma': ['Uptime Kuma ready', 'Monitor check completed', 'Heartbeat stored'],
    'monitoring-api': ['GET /api/health 200', 'GET /api/monitors 200', 'Kuma adapter: heartbeat received'],
    'monitoring-frontend': ['GET / 200', 'GET /assets/index.js 200'],
    'test-service': ['GET / 200 (mode=normal)', 'mode -> slow'],
  };
  const tpl = templates[service] || ['log line'];
  const out = [];
  const now = Date.now();
  for (let i = lines - 1; i >= 0; i--) {
    const t = new Date(now - i * 30000).toISOString();
    out.push(`${t} ${tpl[Math.floor(rng() * tpl.length)]}`);
  }
  return { service, lines: out };
}

module.exports = {
  getDemoMonitors,
  getDemoMonitor,
  getDemoHistory,
  getDemoIncidents,
  getDemoServer,
  getDemoContainers,
  getDemoLogs,
  // Exportados para tests:
  _genHistory: genHistory,
  _MONITOR_DEFS: MONITOR_DEFS,
};
