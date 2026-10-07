'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const mode = require('../services/mode');
const dockerInfo = require('../services/dockerInfo');
const demoData = require('../services/demoData');

const router = express.Router();

// GET /api/docker → {mode, ts, containers:[...]}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const override = mode.resolveOverride(req.query.mode);
    const m = mode.effective(override);
    if (m === 'demo') {
      return res.json(demoData.getDemoContainers());
    }
    const available = await dockerInfo.isAvailable().catch(() => false);
    const containers = available ? await dockerInfo.listDetailed() : [];
    res.json({
      mode: 'real',
      ts: new Date().toISOString(),
      available,
      containers,
    });
  })
);

module.exports = router;
