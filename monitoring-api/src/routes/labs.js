'use strict';

/**
 * labs.js — Laboratorios educativos HTTP / TCP / DNS / ping.
 *
 * SEGURIDAD:
 *  - Todo destino pasa por guards.assertSafeTarget() (anti-SSRF): se bloquean
 *    IPs privadas/reservadas, localhost, metadata cloud y puertos internos.
 *  - Rate limit: 30 peticiones/min por IP (aplicado en index.js).
 *  - Timeouts en todo; sin shell (execFile con args); NUNCA se ejecuta ni se
 *    interpreta contenido remoto (las respuestas se tratan como texto/datos).
 *  - axios con maxRedirects:0: las redirecciones se siguen a mano (máx. 5)
 *    para poder mostrar la cadena y re-validar cada salto con la guardia.
 */

const express = require('express');
const net = require('net');
const tls = require('tls');
const dnsPromises = require('dns').promises;
const { execFile } = require('child_process');
const axios = require('axios');

const asyncHandler = require('../middleware/asyncHandler');
const { httpError, bodyString } = require('../middleware/validate');
const guards = require('../services/guards');

const router = express.Router();
const UA = 'MonitoringLab/1.0 (laboratorio educativo)';

/* ---------------- HTTP ---------------- */

const HTTP_EXPLANATION = {
  dns: 'El DNS traduce el nombre (ej. example.com) a una dirección IP.',
  ip: 'La IP es la dirección numérica del servidor en Internet.',
  https: 'HTTPS cifra la comunicación con TLS: nadie en medio puede leerla.',
  status:
    'El código de estado resume el resultado: 2xx éxito, 3xx redirección, 4xx error del cliente, 5xx error del servidor.',
  redirect: 'Una redirección (3xx + cabecera Location) pide al cliente que repita la petición en otra URL.',
  headers: 'Las cabeceras describen la respuesta: tipo de contenido, servidor, etc.',
};

router.post(
  '/http',
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
    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
    const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;

    const target = await guards.assertSafeTarget(parsed.hostname, port);

    // Fase DNS medida (lookup, sin conectar aún)
    const tDns = Date.now();
    await dnsPromises.lookup(target.host);
    const dnsMs = Date.now() - tDns;

    // Cadena de redirecciones seguida a mano (máx. 5) para mostrarla
    const redirects = [];
    let current = input;
    let status;
    let statusText = '';
    let ms = 0;
    let headers = { contentType: null, server: null };

    for (let i = 0; i <= 5; i++) {
      const u = new URL(current);
      const hopPort = u.port ? parseInt(u.port, 10) : u.protocol === 'https:' ? 443 : 80;
      await guards.assertSafeTarget(u.hostname, hopPort); // re-valida cada salto
      const t0 = Date.now();
      const r = await axios.get(current, {
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: () => true, // aceptamos cualquier status para enseñarlo
        headers: { 'User-Agent': UA },
        responseType: 'text',
        maxContentLength: 2 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
      });
      ms = Date.now() - t0;
      status = r.status;
      statusText = r.statusText || '';
      headers = {
        contentType: r.headers['content-type'] || null,
        server: r.headers['server'] || null,
      };
      if (status >= 300 && status < 400 && r.headers.location) {
        if (i === 5) break;
        redirects.push({ status, url: current });
        current = new URL(r.headers.location, current).toString();
        continue;
      }
      break;
    }

    res.json({
      mode: 'real',
      input,
      dns: { host: target.host, ip: target.ips[0], ms: dnsMs },
      tls: parsed.protocol === 'https:',
      status,
      statusText,
      ms,
      headers,
      redirects,
      explanation: HTTP_EXPLANATION,
    });
  })
);

/* ---------------- TCP ---------------- */

const TCP_EXPLANATION = {
  concepto:
    'Un puerto es una "puerta" numerada de un servidor. La IP dice QUÉ máquina; el puerto dice QUÉ servicio (ej. 443 = web segura).',
  abierto: 'Puerto abierto: el servidor completó el handshake TCP y acepta conexiones.',
  cerrado: 'Puerto cerrado: el servidor respondió rechazando la conexión (no hay servicio ahí).',
  timeout: 'Timeout: no hubo respuesta a tiempo. Puede ser un firewall que descarta paquetes o un servidor caído.',
};

function tcpProbe(ip, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const s = new net.Socket();
    let done = false;
    const fin = (open, reason) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve({ open, ms: Date.now() - t0, reason });
    };
    s.setTimeout(timeoutMs);
    s.on('timeout', () => fin(false, 'timeout'));
    s.on('error', (e) => fin(false, e.code === 'ECONNREFUSED' ? 'refused' : 'error'));
    s.connect(port, ip, () => fin(true, 'open'));
  });
}

router.post(
  '/tcp',
  asyncHandler(async (req, res) => {
    const host = bodyString(req.body, 'host', 253);
    const rawPort = req.body && req.body.port;
    const port = typeof rawPort === 'string' ? parseInt(rawPort, 10) : rawPort;
    const target = await guards.assertSafeTarget(host, port);
    // Conecta a la primera IP verificada (evita re-resolver tras la guardia)
    const probe = await tcpProbe(target.ips[0], Number(port));
    res.json({
      mode: 'real',
      host: target.host,
      ip: target.ips[0],
      port: Number(port),
      open: probe.open,
      ms: probe.ms,
      result:
        probe.reason === 'open'
          ? 'Puerto abierto'
          : probe.reason === 'timeout'
            ? 'Timeout (sin respuesta)'
            : 'Puerto cerrado (conexión rechazada)',
      explanation: TCP_EXPLANATION,
    });
  })
);

/* ---------------- PING ---------------- */

const PING_EXPLANATION = {
  concepto:
    'El ping envía paquetes ICMP "echo request" y mide cuánto tarda el "echo reply". Es la forma más simple de medir latencia.',
  latencia: 'Latencia: tiempo de ida y vuelta de un paquete (ms). Menos es mejor.',
  packetLoss: 'Packet loss: porcentaje de paquetes que no volvieron. 0% es lo normal.',
  timeout: 'Si no hay respuesta en el tiempo límite, el paquete cuenta como perdido.',
};

function pingProbe(ip, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile('ping', ['-c', '4', '-W', '2', ip], { timeout: timeoutMs }, (err, stdout) => {
      // ping devuelve código != 0 si hay pérdida total; igual parseamos lo que haya
      const out = String(stdout || '');
      const packets = [];
      const re = /time=([\d.]+)\s?ms/g;
      let m;
      let n = 0;
      while ((m = re.exec(out))) {
        n += 1;
        packets.push({ n, ms: parseFloat(m[1]) });
      }
      const lossM = /(\d+(?:\.\d+)?)% packet loss/.exec(out);
      const lossPct = lossM ? parseFloat(lossM[1]) : packets.length ? 0 : 100;
      if (!packets.length) {
        const e = new Error(
          err ? 'Sin respuesta al ping (timeout o host inalcanzable).' : 'Sin respuesta al ping.'
        );
        e.status = 502;
        return reject(e);
      }
      const avgMs = Math.round((packets.reduce((a, p) => a + p.ms, 0) / packets.length) * 10) / 10;
      resolve({ packets, avgMs, lossPct });
    });
  });
}

router.post(
  '/ping',
  asyncHandler(async (req, res) => {
    const host = bodyString(req.body, 'host', 253);
    const target = await guards.assertSafeTarget(host);
    const r = await pingProbe(target.ips[0]);
    res.json({
      mode: 'real',
      host: target.host,
      ip: target.ips[0],
      packets: r.packets,
      avgMs: r.avgMs,
      lossPct: r.lossPct,
      explanation: PING_EXPLANATION,
    });
  })
);

/* ---------------- DNS ---------------- */

const DNS_EXPLANATION = {
  a: 'Registro A: la dirección IPv4 del dominio (a dónde ir con IPv4).',
  aaaa: 'Registro AAAA: la dirección IPv6 del dominio.',
  cname: 'Registro CNAME: un alias; este nombre apunta a otro nombre canónico.',
  mx: 'Registro MX: los servidores que reciben el correo de este dominio (con prioridad).',
  txt: 'Registro TXT: textos libres; se usan para verificación y políticas como SPF.',
};

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

router.post(
  '/dns',
  asyncHandler(async (req, res) => {
    const raw = bodyString(req.body, 'domain', 253);
    const domain = raw.toLowerCase().replace(/\.$/, '');
    if (net.isIP(domain)) throw httpError(400, 'Introduce un dominio, no una dirección IP.');
    if (!DOMAIN_RE.test(domain)) throw httpError(400, 'Dominio no válido. Ejemplo: openai.com');
    if (domain === 'localhost' || domain.endsWith('.localhost') || domain.endsWith('.internal')) {
      throw new guards.GuardError('Ese dominio está bloqueado por seguridad (nombre interno).');
    }
    // Solo se CONSULTAN registros: no se abre ninguna conexión al dominio.
    const [a, aaaa, cname, mx, txt] = await Promise.all([
      dnsPromises.resolve4(domain).catch(() => []),
      dnsPromises.resolve6(domain).catch(() => []),
      dnsPromises.resolveCname(domain).catch(() => []),
      dnsPromises
        .resolveMx(domain)
        .catch(() => [])
        .then((r) => r.map((x) => `${x.priority} ${x.exchange}`)),
      dnsPromises
        .resolveTxt(domain)
        .catch(() => [])
        .then((r) => r.map((chunks) => chunks.join(''))),
    ]);
    res.json({ mode: 'real', domain, a, aaaa, cname, mx, txt, explanation: DNS_EXPLANATION });
  })
);

module.exports = router;
