'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { httpError, queryEnum } = require('../middleware/validate');
const mode = require('../services/mode');
const demoData = require('../services/demoData');

const router = express.Router();
const RANGES = ['1h', '6h', '24h', '7d', '30d'];

function resolveMode(req) {
  const override = mode.resolveOverride(req.query.mode);
  const m = mode.effective(override);
  if (m === 'real') mode.requireRealConnected();
  return m;
}

// GET /api/monitors → {mode, monitors:[...]}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const m = resolveMode(req);
    const monitors = m === 'real' ? await mode.getAdapter().getMonitors() : demoData.getDemoMonitors();
    res.json({ mode: m, monitors });
  })
);

// GET /api/monitors/:id → {mode, monitor:{...}}
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const m = resolveMode(req);
    const monitor =
      m === 'real'
        ? await mode.getAdapter().getMonitorById(req.params.id)
        : demoData.getDemoMonitor(req.params.id);
    if (!monitor) throw httpError(404, 'Monitor no encontrado.');
    res.json({ mode: m, monitor });
  })
);

// GET /api/monitors/:id/history?range= → {mode, monitorId, range, points:[...]}
router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const m = resolveMode(req);
    const range = queryEnum(req.query.range, RANGES, '24h');
    if (m === 'real') {
      const adapter = mode.getAdapter();
      const exists = await adapter.getMonitorById(req.params.id);
      if (!exists) throw httpError(404, 'Monitor no encontrado.');
      const points = await adapter.getHistory(req.params.id, range);
      res.json({ mode: m, monitorId: req.params.id, range, points });
    } else {
      const hist = demoData.getDemoHistory(req.params.id, range);
      if (!hist) throw httpError(404, 'Monitor no encontrado.');
      res.json(hist);
    }
  })
);

module.exports = router;
