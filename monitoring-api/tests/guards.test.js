'use strict';

/**
 * guards.test.js — Protección SSRF.
 * Solo usa literales IP y hostnames que no requieren red (localhost,
 * .invalid), para que los tests sean herméticos.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertSafeTarget,
  _isBlockedIPv4,
  _isBlockedIPv6,
  _isBlockedPort,
} = require('../src/services/guards');

test('bloquea literales IPv4 privadas/reservadas', async () => {
  const ips = [
    '127.0.0.1', // loopback
    '10.0.0.5', // privada
    '172.16.0.1', // privada
    '172.31.255.1', // privada (rango Docker por defecto)
    '192.168.1.1', // privada
    '169.254.169.254', // metadata cloud
    '0.0.0.0', // "esta red"
    '100.64.0.1', // CGNAT
    '224.0.0.1', // multicast
  ];
  for (const ip of ips) {
    await assert.rejects(() => assertSafeTarget(ip), /bloqueado|privad|reservado/, ip);
  }
});

test('bloquea literales IPv6 privadas/reservadas', async () => {
  const ips = ['::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'];
  for (const ip of ips) {
    await assert.rejects(() => assertSafeTarget(ip), /bloqueado/, ip);
  }
});

test('permite IPs públicas', async () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2001:4860:4860::8888']) {
    const r = await assertSafeTarget(ip);
    assert.equal(r.ips[0], ip.toLowerCase());
  }
});

test('bloquea localhost y sufijos internos', async () => {
  for (const h of ['localhost', 'LOCALHOST', 'foo.localhost', 'x.internal']) {
    await assert.rejects(() => assertSafeTarget(h), /bloqueado/, h);
  }
});

test('bloquea puertos de administración e internos', async () => {
  for (const p of [22, 3001, 4000, 8000, 8090, 8100, 3900, 3905, 3910]) {
    await assert.rejects(() => assertSafeTarget('8.8.8.8', p), /bloqueado/, `puerto ${p}`);
  }
});

test('permite puertos normales', async () => {
  for (const p of [80, 443, 8443, 53]) {
    const r = await assertSafeTarget('8.8.8.8', p);
    assert.equal(r.host, '8.8.8.8');
  }
});

test('puertos fuera de rango o inválidos → error', async () => {
  await assert.rejects(() => assertSafeTarget('8.8.8.8', 0), /Puerto no válido/);
  await assert.rejects(() => assertSafeTarget('8.8.8.8', 70000), /Puerto no válido/);
  await assert.rejects(() => assertSafeTarget('8.8.8.8', 'abc'), /Puerto no válido/);
});

test('hostname que no resuelve o resuelve a rango reservado → bloqueado', async () => {
  // En esta sandbox .invalid resuelve a 198.18.x (wildcard); en otros entornos
  // da NXDOMAIN. En ambos casos la guardia debe bloquear.
  await assert.rejects(() => assertSafeTarget('noexiste.invalid'), /No se pudo resolver|bloqueado/);
});

test('helpers unitarios de rangos', () => {
  assert.equal(_isBlockedPort(22), true);
  assert.equal(_isBlockedPort(3001), true);
  assert.equal(_isBlockedPort(443), false);
  assert.equal(_isBlockedIPv4('10.1.2.3'), true);
  assert.equal(_isBlockedIPv4('172.15.255.255'), false); // justo fuera de 172.16/12
  assert.equal(_isBlockedIPv4('9.9.9.9'), false);
  assert.equal(_isBlockedIPv6('::1'), true);
  assert.equal(_isBlockedIPv6('2001:4860:4860::8888'), false);
});
