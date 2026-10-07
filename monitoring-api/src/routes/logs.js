'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { httpError, queryIntIn } = require('../middleware/validate');
const mode = require('../services/mode');
const dockerInfo = require('../services/dockerInfo');
const demoData = require('../services/demoData');

const router = express.Router();

// GET /api/logs/:service?lines=100|500|1000 → {service, lines:[str]}
// SOLO LECTURA: el servicio se valida contra whitelist y las líneas también.
router.get(
  '/:service',
  asyncHandler(async (req, res) => {
    const service = req.params.service;
    if (!dockerInfo.isAllowedService(service)) {
      throw httpError(
        400,
        `Servicio no permitido. Permitidos: ${dockerInfo.ALLOWED_SERVICES.join(', ')}.`
      );
    }
    const lines = queryIntIn(req.query.lines, dockerInfo.ALLOWED_LINES, 100);
    const override = mode.resolveOverride(req.query.mode);
    const m = mode.effective(override);
    if (m === 'demo') {
      return res.json(demoData.getDemoLogs(service, lines));
    }
    const available = await dockerInfo.isAvailable().catch(() => false);
    if (!available) {
      const e = new Error('Docker no está disponible en este entorno.');
      e.status = 502;
      throw e;
    }
    const logLines = await dockerInfo.getLogs(service, lines);
    res.json({ service, lines: logLines });
  })
);

module.exports = router;
