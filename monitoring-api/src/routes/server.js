'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const mode = require('../services/mode');
const hostStats = require('../services/hostStats');
const demoData = require('../services/demoData');

const router = express.Router();

// GET /api/server → {mode, ts, cpu, mem, disk, uptime, load, net}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const override = mode.resolveOverride(req.query.mode);
    const m = mode.effective(override);
    if (m === 'demo') {
      return res.json(demoData.getDemoServer());
    }
    const s = await hostStats.getStats();
    res.json({
      mode: 'real',
      ts: new Date().toISOString(),
      source: s.source, // "host" (montado /host) o "container" (fallback honesto vía os)
      cpu: s.cpu,
      mem: s.mem,
      disk: s.disk,
      uptime: s.uptime,
      load: s.load,
      net: s.net,
    });
  })
);

module.exports = router;
