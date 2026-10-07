'use strict';

/**
 * validate.js — Pequeños validadores para query params y cuerpos.
 * Todos los errores son 4xx con mensaje en español; nunca incluyen stack traces.
 */

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function queryEnum(value, allowed, def) {
  if (value === undefined || value === null || value === '') return def;
  if (!allowed.includes(value)) {
    throw httpError(400, `Parámetro no válido. Valores permitidos: ${allowed.join(', ')}.`);
  }
  return value;
}

function queryIntIn(value, allowed, def) {
  if (value === undefined || value === null || value === '') return def;
  const n = parseInt(value, 10);
  if (!allowed.includes(n)) {
    throw httpError(400, `Parámetro no válido. Valores permitidos: ${allowed.join(', ')}.`);
  }
  return n;
}

function bodyString(body, key, max = 2048) {
  const v = body && body[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw httpError(400, `Falta el campo "${key}".`);
  }
  if (v.length > max) {
    throw httpError(400, `El campo "${key}" es demasiado largo (máx. ${max} caracteres).`);
  }
  return v.trim();
}

function bodyEnum(body, key, allowed) {
  const v = body && body[key];
  if (!allowed.includes(v)) {
    throw httpError(400, `Valor no válido para "${key}". Permitidos: ${allowed.join(', ')}.`);
  }
  return v;
}

module.exports = { httpError, queryEnum, queryIntIn, bodyString, bodyEnum };
