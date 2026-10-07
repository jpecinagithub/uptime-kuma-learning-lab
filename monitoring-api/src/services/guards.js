'use strict';

/**
 * guards.js — Protección SSRF (CRÍTICA) para los laboratorios.
 *
 * Los laboratorios HTTP/TCP/DNS/ping aceptan direcciones del usuario. Sin
 * esta guardia serían una herramienta para atacar la red interna. Por eso:
 *
 *  - Se rechazan IPs literales en rangos privados/reservados:
 *    127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7,
 *    fe80::/10, 0.0.0.0/8, 100.64/10, 224/4 (multicast).
 *  - Para hostnames: se resuelven TODAS las IPs con dns.lookup y se
 *    comprueba cada una. Se rechazan `localhost` y sufijos
 *    `.localhost` / `.internal`. Si no resuelve, se bloquea.
 *  - Puertos: 1-65535, pero se bloquean 22, 3001, 3002, 4000, 8000-8100 y 3900-3910
 *    (3001 = otro servicio del host; 3002 = panel admin de Kuma en localhost)
 *    (SSH, Kuma, esta API, dashboard y gateways internos).
 *
 * Los mensajes de error son claros y en español, sin filtrar detalles internos.
 */

const dns = require('dns').promises;
const net = require('net');

class GuardError extends Error {
  constructor(message) {
    super(message);
    this.code = 'SSRF_BLOCKED';
    this.status = 403;
  }
}

// [base, bits] IPv4 bloqueados
const IPV4_BLOCKS = [
  ['0.0.0.0', 8], // "esta red"
  ['10.0.0.0', 8], // privada
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local: ¡metadata cloud (169.254.169.254)!
  ['172.16.0.0', 12], // privada
  ['192.168.0.0', 16], // privada (redes Docker incluidas)
  ['224.0.0.0', 4], // multicast
  ['192.0.2.0', 24], // TEST-NET-1 (documentación, nunca destino real)
  ['198.51.100.0', 24], // TEST-NET-2 (documentación)
  ['203.0.113.0', 24], // TEST-NET-3 (documentación)
  ['198.18.0.0', 15], // benchmarking (RFC 2544, no enrutable en Internet)
];

const BLOCKED_PORTS = new Set([22, 3001, 3002, 4000]);
function isBlockedPort(p) {
  if (BLOCKED_PORTS.has(p)) return true;
  if (p >= 8000 && p <= 8100) return true; // dashboard y rango cercano
  if (p >= 3900 && p <= 3910) return true; // gateways internos
  return false;
}

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return p[0] * 16777216 + p[1] * 65536 + p[2] * 256 + p[3];
}

function inCidrV4(ip, base, bits) {
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  const shift = 32 - bits;
  return Math.floor(a / 2 ** shift) === Math.floor(b / 2 ** shift);
}

function isBlockedIPv4(ip) {
  return IPV4_BLOCKS.some(([base, bits]) => inCidrV4(ip, base, bits));
}

function ipv6ToBigInt(ip) {
  let addr = ip.split('%')[0]; // quita zone id (fe80::1%eth0)
  if (addr.includes('.')) {
    // IPv4-mapeada (::ffff:1.2.3.4): convierte los últimos 32 bits
    const lastColon = addr.lastIndexOf(':');
    const v4 = ipv4ToInt(addr.slice(lastColon + 1));
    if (v4 === null) return null;
    addr =
      addr.slice(0, lastColon) +
      ':' +
      (v4 >>> 16).toString(16) +
      ':' +
      (v4 & 0xffff).toString(16);
  }
  const halves = addr.split('::');
  let groups;
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else if (halves.length === 1) {
    groups = addr.split(':');
  } else {
    return null;
  }
  if (groups.length !== 8) return null;
  try {
    return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || '0', 16)), 0n);
  } catch {
    return null;
  }
}

function isBlockedIPv6(ip) {
  const n = ipv6ToBigInt(ip);
  if (n === null) return true; // si no se puede parsear, bloquear por seguridad
  if (n === 1n) return true; // ::1 loopback
  if (n >> 121n === 126n) return true; // fc00::/7 unique local
  if (n >> 118n === 1018n) return true; // fe80::/10 link-local
  // ::ffff:0:0/96 con IPv4 privada dentro → comprueba la parte IPv4
  const v4part = Number(n & 0xffffffffn);
  const b = [24, 16, 8, 0].map((s) => (v4part >>> s) & 255).join('.');
  if ((n >> 32n) === 0xffffn && isBlockedIPv4(b)) return true;
  return false;
}

/**
 * Valida un objetivo. Devuelve { host, ips } con las IPs resueltas, o lanza
 * GuardError (403) con mensaje en español.
 */
async function assertSafeTarget(host, port) {
  if (typeof host !== 'string' || !host.trim() || host.length > 253) {
    throw new GuardError('Nombre de host no válido.');
  }
  const h = host.trim().toLowerCase().replace(/\.$/, ''); // quita punto final FQDN

  if (port !== undefined) {
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      throw new GuardError('Puerto no válido: usa un número entre 1 y 65535.');
    }
    if (isBlockedPort(p)) {
      throw new GuardError(
        `El puerto ${p} está bloqueado por seguridad (puertos de administración e internos).`
      );
    }
  }

  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) {
    throw new GuardError(`El host "${host}" está bloqueado por seguridad (nombre interno).`);
  }

  const family = net.isIP(h);
  if (family === 4) {
    if (isBlockedIPv4(h)) {
      throw new GuardError(`La IP ${h} está en un rango privado o reservado (bloqueado).`);
    }
    return { host: h, ips: [h] };
  }
  if (family === 6) {
    if (isBlockedIPv6(h)) {
      throw new GuardError(`La IP ${h} está en un rango privado o reservado (bloqueado).`);
    }
    return { host: h, ips: [h] };
  }

  // Hostname: resolver TODAS las IPs y comprobar cada una (anti DNS-rebinding básico)
  let addrs;
  try {
    addrs = await dns.lookup(h, { all: true });
  } catch {
    throw new GuardError(
      `No se pudo resolver "${host}". Por seguridad no se permite continuar sin verificar el destino.`
    );
  }
  if (!addrs.length) {
    throw new GuardError(`"${host}" no resuelve a ninguna dirección IP.`);
  }
  for (const a of addrs) {
    const blocked = a.family === 6 ? isBlockedIPv6(a.address) : isBlockedIPv4(a.address);
    if (blocked) {
      throw new GuardError(
        `"${host}" resuelve a una dirección privada o reservada (bloqueado por seguridad).`
      );
    }
  }
  return { host: h, ips: addrs.map((a) => a.address) };
}

module.exports = {
  GuardError,
  assertSafeTarget,
  // Exportados para tests:
  _isBlockedIPv4: isBlockedIPv4,
  _isBlockedIPv6: isBlockedIPv6,
  _isBlockedPort: isBlockedPort,
};
