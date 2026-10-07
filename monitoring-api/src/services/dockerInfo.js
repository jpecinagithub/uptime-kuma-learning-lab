'use strict';

/**
 * dockerInfo.js — Información de Docker en modo SOLO LECTURA.
 *
 * REGLAS DE SEGURIDAD (estrictas):
 *  - Solo se ejecutan estos subcomandos, siempre vía execFile (sin shell):
 *      docker ps --format {{json .}}
 *      docker stats --no-stream --format {{json .}}
 *      docker logs --tail N --timestamps <nombre>
 *      docker version --format {{.Server.Version}}   (chequeo de disponibilidad)
 *  - PROHIBIDO: exec, rm, run, stop, kill, prune o cualquier otro subcomando.
 *  - El nombre del contenedor para `logs` se valida contra una whitelist y
 *    además se resuelve al nombre real descubierto vía `docker ps` (el input
 *    del usuario nunca llega tal cual a execFile).
 *  - N (líneas) solo puede ser 100, 500 o 1000.
 *  - Timeouts en todas las llamadas; maxBuffer acotado.
 *
 * NO se monta /var/run/docker.sock en el frontend: es este backend quien
 * consulta Docker y expone solo lectura.
 */

const { execFile } = require('child_process');

const ALLOWED_SERVICES = ['uptime-kuma', 'monitoring-api', 'monitoring-frontend', 'test-service'];
const ALLOWED_LINES = [100, 500, 1000];

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`Comando docker falló: ${(stderr || err.message).toString().slice(0, 200)}`);
        e.status = 502;
        return reject(e);
      }
      resolve(stdout);
    });
  });
}

function parseJsonLines(stdout) {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Caché corta de disponibilidad para no lanzar `docker version` en cada /api/health
let availCache = { at: 0, value: false };
async function isAvailable() {
  if (Date.now() - availCache.at < 30000) return availCache.value;
  try {
    await run('docker', ['version', '--format', '{{.Server.Version}}'], 4000);
    availCache = { at: Date.now(), value: true };
  } catch {
    availCache = { at: Date.now(), value: false };
  }
  return availCache.value;
}

/** Nombre corto del servicio: label de compose si existe, si no el Names. */
function serviceName(c) {
  const s = c.Labels && c.Labels['com.docker.compose.service'];
  if (s && ALLOWED_SERVICES.includes(s)) return s;
  return c.Names || c.Name || '';
}

async function listContainers() {
  const out = await run('docker', ['ps', '--format', '{{json .}}'], 8000);
  return parseJsonLines(out).map((c) => ({
    raw: c,
    service: serviceName(c),
    name: c.Names || c.Name || '',
    image: c.Image || '',
    state: c.State || 'unknown', // running | exited | …
    status: c.Status || '',
    runningFor: c.RunningFor || '',
    portsRaw: c.Ports || '',
    created: c.CreatedAt || '',
  }));
}

function parsePct(s) {
  const m = /([\d.]+)%/.exec(String(s || ''));
  return m ? Math.round(parseFloat(m[1]) * 100) / 100 : 0;
}

function memToMb(s) {
  // "12.34MiB" | "1.95GiB" | "512KiB" | "123B"
  const m = /([\d.]+)\s*([KMGT]?i?B)/i.exec(String(s || '').split('/')[0].trim());
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  const factor = { B: 1 / 1048576, KB: 1 / 1024, KIB: 1 / 1024, MB: 1, MIB: 1, GB: 1024, GIB: 1024 }[u];
  return factor === undefined ? 0 : Math.round(v * factor * 10) / 10;
}

function parsePorts(portsRaw) {
  // "0.0.0.0:8090->80/tcp, :::8090->80/tcp" | "3001/tcp"
  const out = [];
  const re = /(?:(\d+\.\d+\.\d+\.\d+|\[::\]|::):)?(\d+)->(\d+)\/(tcp|udp)/g;
  let m;
  while ((m = re.exec(String(portsRaw || '')))) {
    out.push({ published: parseInt(m[2], 10), target: parseInt(m[3], 10) });
  }
  return out;
}

/** Lista detallada fusionando `docker ps` + `docker stats` (forma del contrato). */
async function listDetailed() {
  const containers = await listContainers();
  let statsByName = {};
  try {
    const out = await run('docker', ['stats', '--no-stream', '--format', '{{json .}}'], 10000);
    for (const s of parseJsonLines(out)) {
      const key = s.Name || s.Container || '';
      statsByName[key] = s;
      if (s.ID) statsByName[s.ID] = s;
    }
  } catch {
    statsByName = {}; // stats es opcional; ps ya da lo esencial
  }
  return containers.map((c) => {
    const st = statsByName[c.name] || {};
    return {
      name: c.service || c.name,
      image: c.image,
      state: c.state === 'running' ? 'running' : 'exited',
      status: c.status,
      uptime: c.runningFor ? c.runningFor.replace(/ ago$/, '') : '',
      cpuPct: parsePct(st.CPUPerc),
      memMb: memToMb(st.MemUsage),
      memPct: parsePct(st.MemPerc),
      ports: parsePorts(c.portsRaw),
      created: c.created,
    };
  });
}

function isAllowedService(s) {
  return ALLOWED_SERVICES.includes(s);
}

function isAllowedLines(n) {
  return ALLOWED_LINES.includes(n);
}

/**
 * Logs recientes de un servicio (SOLO LECTURA, con --timestamps).
 * El nombre real del contenedor se descubre vía `docker ps`.
 */
async function getLogs(service, lines) {
  if (!isAllowedService(service)) {
    const e = new Error(`Servicio no permitido. Permitidos: ${ALLOWED_SERVICES.join(', ')}.`);
    e.status = 400;
    throw e;
  }
  if (!isAllowedLines(lines)) {
    const e = new Error(`Líneas no válidas. Permitidas: ${ALLOWED_LINES.join(', ')}.`);
    e.status = 400;
    throw e;
  }
  const containers = await listContainers();
  const found = containers.find((c) => c.service === service || c.name === service);
  if (!found) {
    const e = new Error(`Contenedor "${service}" no encontrado (¿está levantado?).`);
    e.status = 404;
    throw e;
  }
  const out = await run(
    'docker',
    ['logs', '--tail', String(lines), '--timestamps', found.name],
    15000
  );
  const arr = out.split('\n');
  if (arr.length && arr[arr.length - 1] === '') arr.pop();
  return arr;
}

module.exports = {
  ALLOWED_SERVICES,
  ALLOWED_LINES,
  isAvailable,
  listContainers,
  listDetailed,
  getLogs,
  isAllowedService,
  isAllowedLines,
  // Exportados para tests:
  _parsePorts: parsePorts,
  _memToMb: memToMb,
  _parsePct: parsePct,
};
