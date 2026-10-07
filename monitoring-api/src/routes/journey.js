'use strict';

/**
 * journey.js — "Viaje de un Check" (POST /api/check-journey {url}).
 *
 * Mide las fases REALES de un check HTTP por separado:
 *   DNS → TCP → TLS (solo https) → HTTP (hasta primer byte) → respuesta (resto)
 * usando los módulos http/https de Node para poder separar TTFB del total.
 *
 * Si la medición falla o el objetivo está bloqueado por la guardia SSRF,
 * devuelve pasos SIMULADOS plausibles con mode:"simulated" y la nota
 * "SIMULACIÓN EDUCATIVA" (nunca se presenta simulación como medición real).
 */

const express = require('express');
const net = require('net');
const tls = require('tls');
const http = require('http');
const https = require('https');
const dnsPromises = require('dns').promises;

const asyncHandler = require('../middleware/asyncHandler');
const { httpError, bodyString } = require('../middleware/validate');
const guards = require('../services/guards');

const router = express.Router();

function tcpPhase(ip, port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const s = new net.Socket();
    let done = false;
    const fin = (fn, v) => {
      if (done) return;
      done = true;
      s.destroy();
      fn(v);
    };
    s.setTimeout(timeoutMs);
    s.on('timeout', () => fin(reject, new Error('Timeout en la fase TCP')));
    s.on('error', (e) => fin(reject, e));
    s.connect(port, ip, () => fin(resolve, Date.now() - t0));
  });
}

function tlsPhase(ip, port, servername, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let done = false;
    const socket = tls.connect(
      { host: ip, port, servername, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(Date.now() - t0);
      }
    );
    const fail = (e) => {
      if (done) return;
      done = true;
      socket.destroy();
      reject(e);
    };
    socket.on('timeout', () => fail(new Error('Timeout en la fase TLS')));
    socket.on('error', fail);
  });
}

function httpPhase({ useTls, ip, port, hostname, path, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let done = false;
    const fin = (fn, v) => {
      if (done) return;
      done = true;
      fn(v);
    };
    const lib = useTls ? https : http;
    const req = lib.request({
      host: ip,
      port,
      path,
      method: 'GET',
      servername: hostname, // SNI aunque conectemos por IP
      rejectUnauthorized: false,
      timeout: timeoutMs,
      headers: { Host: hostname, 'User-Agent': 'MonitoringLab/1.0 (educational)' },
    });
    req.on('response', (res) => {
      const ttfbMs = Date.now() - t0;
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > 512 * 1024) res.destroy(); // no necesitamos el cuerpo entero
      });
      res.on('end', () =>
        fin(resolve, { ttfbMs, totalMs: Date.now() - t0, status: res.statusCode })
      );
      res.on('close', () =>
        fin(resolve, { ttfbMs, totalMs: Date.now() - t0, status: res.statusCode })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      fin(reject, new Error('Timeout en la fase HTTP'));
    });
    req.on('error', (e) => fin(reject, e));
    req.end();
  });
}

function simulatedSteps(isHttps, reason) {
  const steps = [
    { key: 'dns', ms: 14 },
    { key: 'tcp', ms: 31 },
    { key: 'tls', ms: isHttps ? 48 : null },
    { key: 'http', ms: 72 },
    { key: 'response', ms: 9 },
  ];
  const totalMs = steps.reduce((a, s) => a + (s.ms || 0), 0);
  return {
    mode: 'simulated',
    steps,
    totalMs,
    note: `SIMULACIÓN EDUCATIVA: no se pudo medir el check real (${reason}). Los tiempos son un ejemplo plausible, no una medición.`,
  };
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = bodyString(req.body, 'url', 2048);
    let parsed;
    try {
      parsed = new URL(input);
    } catch {
      throw httpError(400, 'URL no válida. Ejemplo: https://example.com');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw httpError(400, 'Solo se permiten URLs http:// y https://.');
    }
    const isHttps = parsed.protocol === 'https:';
    const port = parsed.port ? parseInt(parsed.port, 10) : isHttps ? 443 : 80;
    const path = (parsed.pathname || '/') + (parsed.search || '');

    // Guardia SSRF primero; si bloquea → simulación marcada (nunca error seco)
    let target;
    try {
      target = await guards.assertSafeTarget(parsed.hostname, port);
    } catch (e) {
      return res.json(simulatedSteps(isHttps, 'el objetivo está bloqueado por seguridad'));
    }
    const ip = target.ips[0];

    try {
      const tAll = Date.now();

      const t0 = Date.now();
      await dnsPromises.lookup(target.host);
      const dnsMs = Date.now() - t0;

      const tcpMs = await tcpPhase(ip, port);
      const tlsMs = isHttps ? await tlsPhase(ip, port, target.host) : null;
      const h = await httpPhase({ useTls: isHttps, ip, port, hostname: target.host, path });
      const responseMs = Math.max(0, h.totalMs - h.ttfbMs);

      const steps = [
        { key: 'dns', ms: dnsMs },
        { key: 'tcp', ms: tcpMs },
        { key: 'tls', ms: tlsMs },
        { key: 'http', ms: h.ttfbMs },
        { key: 'response', ms: responseMs },
      ];
      res.json({
        mode: 'real',
        steps,
        totalMs: Date.now() - tAll,
        httpStatus: h.status,
        note: 'Medición real por fases desde este servidor.',
      });
    } catch (e) {
      res.json(simulatedSteps(isHttps, e.message || 'falló la medición'));
    }
  })
);

module.exports = router;
