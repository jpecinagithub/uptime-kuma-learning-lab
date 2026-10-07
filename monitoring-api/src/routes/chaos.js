'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { bodyEnum } = require('../middleware/validate');
const mode = require('../services/mode');
const { createTestService, MODES } = require('../services/testService');

const router = express.Router();

// GET /api/chaos → {mode, target:"test-service"}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const override = mode.resolveOverride(req.query.mode);
    const m = mode.effective(override);
    const ts = createTestService({ mode: m });
    res.json({ mode: await ts.getMode(), target: 'test-service' });
  })
);

// POST /api/chaos {mode} → {ok:true, mode}
// Solo afecta a test-service (es el único destino cableado en testService.js).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const override = mode.resolveOverride(req.query.mode);
    const m = mode.effective(override);
    const next = bodyEnum(req.body, 'mode', MODES);
    const ts = createTestService({ mode: m });
    const applied = await ts.setMode(next);
    res.json({ ok: true, mode: applied });
  })
);

module.exports = router;
