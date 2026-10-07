'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const mode = require('../services/mode');
const dockerInfo = require('../services/dockerInfo');
const hostStats = require('../services/hostStats');

const router = express.Router();

// GET /api/health → {status, mode, uptimeKuma, docker, server, version, kumaVersion}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const m = mode.effective();
    const adapter = mode.getAdapter();
    const st = adapter ? adapter.status() : { connected: false, kumaVersion: null };

    let docker = false;
    let server = false;
    try {
      docker = await dockerInfo.isAvailable();
    } catch {
      docker = false;
    }
    try {
      await hostStats.getStats();
      server = true;
    } catch {
      server = false;
    }

    res.json({
      status: 'ok',
      mode: m,
      uptimeKuma: st.connected,
      docker,
      server,
      version: '1.0.0',
      kumaVersion: st.kumaVersion || null,
    });
  })
);

module.exports = router;
