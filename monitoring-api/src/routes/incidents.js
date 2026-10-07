'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { queryEnum } = require('../middleware/validate');
const mode = require('../services/mode');
const demoData = require('../services/demoData');

const router = express.Router();

// GET /api/incidents?range=24h|7d|30d → {mode, incidents:[...]}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const override = mode.resolveOverride(req.query.mode);
    const m = mode.effective(override);
    if (m === 'real') mode.requireRealConnected();
    const range = queryEnum(req.query.range, ['24h', '7d', '30d'], '7d');
    if (m === 'real') {
      const incidents = await mode.getAdapter().getIncidents(range);
      res.json({ mode: m, incidents });
    } else {
      res.json(demoData.getDemoIncidents(range));
    }
  })
);

module.exports = router;
