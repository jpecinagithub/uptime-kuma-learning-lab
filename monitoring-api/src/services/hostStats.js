'use strict';

/**
 * hostStats.js — Estadísticas REALES del servidor.
 *
 * En el compose, el host se monta como solo-lectura:
 *   /host/proc  -> /proc del anfitrión
 *   /host/root  -> / del anfitrión (para el disco)
 * Si esos mounts no existen (p. ej. corriendo fuera de compose), usa el
 * módulo `os` de Node y marca source:"container" para ser honesto sobre
 * el origen de los datos.
 *
 * Solo LECTURA: nunca ejecuta comandos arbitrarios.
 */

const fs = require('fs');
const os = require('os');

const PROC = fs.existsSync('/host/proc') ? '/host/proc' : null;
const ROOT = fs.existsSync('/host/root') ? '/host/root' : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readCpuTimes() {
  const src = PROC ? `${PROC}/stat` : '/proc/stat';
  const line = fs.readFileSync(src, 'utf8').split('\n').find((l) => l.startsWith('cpu '));
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] || 0) + (parts[4] || 0); // idle + iowait
  const total = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return { idle, total };
}

async function cpuPct() {
  try {
    const a = readCpuTimes();
    await sleep(500);
    const b = readCpuTimes();
    const totalDelta = b.total - a.total;
    const idleDelta = b.idle - a.idle;
    if (totalDelta <= 0) return 0;
    return Math.round((100 * (1 - idleDelta / totalDelta)) * 10) / 10;
  } catch {
    return 0;
  }
}

function memStats() {
  const src = PROC ? `${PROC}/meminfo` : '/proc/meminfo';
  const txt = fs.readFileSync(src, 'utf8');
  const get = (k) => {
    const m = txt.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm'));
    return m ? parseInt(m[1], 10) : null; // kB
  };
  const totalKb = get('MemTotal');
  const availKb = get('MemAvailable');
  if (!totalKb || availKb === null) throw new Error('No se pudo leer meminfo');
  const totalGb = Math.round((totalKb / 1024 / 1024) * 100) / 100;
  const usedGb = Math.round(((totalKb - availKb) / 1024 / 1024) * 100) / 100;
  return { usedGb, totalGb, pct: Math.round((100 * (totalKb - availKb)) / totalKb) };
}

function diskStats() {
  const target = ROOT || '/';
  const st = fs.statfsSync(target);
  const total = st.blocks * st.bsize;
  const free = st.bfree * st.bsize;
  const used = total - free;
  const gb = (b) => Math.round((b / 1024 / 1024 / 1024) * 100) / 100;
  return {
    usedGb: gb(used),
    totalGb: gb(total),
    pct: total > 0 ? Math.round((100 * used) / total) : 0,
  };
}

function uptimeParts() {
  const src = PROC ? `${PROC}/uptime` : '/proc/uptime';
  const secs = Math.floor(parseFloat(fs.readFileSync(src, 'utf8').split(' ')[0]));
  return {
    days: Math.floor(secs / 86400),
    hours: Math.floor((secs % 86400) / 3600),
    mins: Math.floor((secs % 3600) / 60),
  };
}

function loadAvg() {
  const src = PROC ? `${PROC}/loadavg` : '/proc/loadavg';
  return fs
    .readFileSync(src, 'utf8')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((x) => Math.round(parseFloat(x) * 100) / 100);
}

function netStats() {
  const src = PROC ? `${PROC}/net/dev` : '/proc/net/dev';
  let rx = 0;
  let tx = 0;
  for (const line of fs.readFileSync(src, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const iface = m[1].trim();
    if (iface === 'lo') continue; // suma interfaces sin lo
    const f = m[2].trim().split(/\s+/).map(Number);
    if (Number.isFinite(f[0])) rx += f[0];
    if (Number.isFinite(f[8])) tx += f[8];
  }
  return { rxBytes: rx, txBytes: tx };
}

async function getStats() {
  const cores = os.cpus().length;
  if (!PROC) {
    // Fallback honesto: datos del propio contenedor/entorno vía `os`
    const total = os.totalmem();
    const free = os.freemem();
    const gb = (b) => Math.round((b / 1024 / 1024 / 1024) * 100) / 100;
    const upSecs = Math.floor(os.uptime());
    return {
      source: 'container',
      cpu: { pct: await cpuPct(), cores },
      mem: { usedGb: gb(total - free), totalGb: gb(total), pct: Math.round((100 * (total - free)) / total) },
      disk: diskStats(),
      uptime: {
        days: Math.floor(upSecs / 86400),
        hours: Math.floor((upSecs % 86400) / 3600),
        mins: Math.floor((upSecs % 3600) / 60),
      },
      load: os.loadavg().map((x) => Math.round(x * 100) / 100),
      net: { rxBytes: 0, txBytes: 0 },
    };
  }
  return {
    source: 'host',
    cpu: { pct: await cpuPct(), cores },
    mem: memStats(),
    disk: diskStats(),
    uptime: uptimeParts(),
    load: loadAvg(),
    net: netStats(),
  };
}

module.exports = { getStats };
