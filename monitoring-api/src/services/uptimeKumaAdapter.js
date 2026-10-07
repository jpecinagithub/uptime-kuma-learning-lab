'use strict';

/**
 * ============================================================================
 * uptimeKumaAdapter.js — Capa Adapter AISLADA para Uptime Kuma 2.x
 * ============================================================================
 *
 * El frontend NUNCA habla con Uptime Kuma directamente: solo conoce los
 * endpoints propios de esta API. Toda la integración con el protocolo interno
 * de Kuma vive en este fichero y en ningún otro.
 *
 * HECHOS VERIFICADOS DEL PROTOCOLO (Uptime Kuma 2.x) — documentados aquí:
 *
 *  1. NO existe API REST de gestión: todo va por Socket.IO 4.x, path `/socket.io`.
 *  2. Auth: evento `login` con `{ username, password, token: "" }` y ack
 *     `{ ok, token }` donde token es un JWT. En reconexión se usa `loginByToken`.
 *     El timeout de login es generoso (45s) porque el servidor ejecuta
 *     `afterLogin()` antes de responder el ack.
 *  3. `monitorList` llega como PUSH (diccionario por id en string) justo tras el
 *     login; además se pide `getMonitorList` con ack (estrategia ack-first,
 *     push-fallback: si el ack falla se espera el push unos segundos).
 *  4. Heartbeats (Kuma 2.x, verificado en server/server.js 2.5.X):
 *     `getMonitorBeats(monitorID, periodHours)` con ack `{ ok, data: [...] }`;
 *     el periodo es OBLIGATORIO (sin él el servidor responde { ok:false }).
 *     Además se escuchan los pushes `heartbeatList` (lista) y `heartbeat`
 *     (uno solo). Se cachean en memoria los últimos ~500 heartbeats por
 *     monitor (ventana aproximada de 30 días; con intervalos cortos la caché
 *     cubre menos tiempo — es una aproximación documentada, no exacta).
 *     OJO: `getHeartbeats` NO existe en 2.x (era 1.x); no usarlo.
 *  5. Códigos de estado de heartbeat: 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE.
 *  6. Mutaciones en 2.x: `add` (¡NO `addMonitor` como en 1.x!), `editMonitor`,
 *     `deleteMonitor`, `pauseMonitor`, `resumeMonitor`. Solo se usa `add`
 *     para el seed. Referencia: el migrador fliplafe/uptime-kuma-migrator
 *     (probado contra 2.2.1) emite `add` con ack `{ ok }`.
 *  7. Las API keys de Kuma SOLO sirven para `/metrics` (Prometheus); NO sirven
 *     para autenticación general. Por eso el fallback de métricas solo ofrece
 *     estado+latencia aproximados, nunca gestión.
 *  8. El paquete npm `uptime-kuma-api` solo soporta Kuma ≤ 1.23.2 → NO se usa.
 *     Este cliente es hand-rolled con `socket.io-client@4`.
 *  9. Fallback opcional: si `KUMA_METRICS_API_KEY` está definido y el socket
 *     no conecta, se lee `GET <KUMA_URL>/metrics` con
 *     `Authorization: Bearer <key>` y se parsean los gauges
 *     `monitor_status{monitor_name="..."}` y `monitor_response_time{...}`.
 * 10. JAMÁS se lee ni modifica el SQLite de Kuma directamente mientras está
 *     en ejecución. Reconexión con backoff exponencial (5s → 60s máx).
 * 11. El arranque de ESTA api nunca se bloquea por Kuma: la conexión se intenta
 *     en segundo plano y el modo pasa a "demo" hasta que conecte.
 *
 * Contratos que expone:
 *   status()              → { connected, lastError, kumaVersion }
 *   getMonitors()         → [monitor] (forma del contrato /api/monitors)
 *   getMonitorById(id)    → monitor | null (con description/intervalSec/timeoutSec)
 *   getHistory(id, range) → [{ t, ms, status, code, msg }]
 *   getIncidents(range)   → [incident] (forma del contrato /api/incidents)
 *   ensureSeedMonitors()  → crea monitores de ejemplo si la lista está vacía
 */

const { io } = require('socket.io-client');
const axios = require('axios');

const STATUS = { DOWN: 0, UP: 1, PENDING: 2, MAINTENANCE: 3 };

// Tipos de monitor de Kuma → tipos del contrato público (http|ping|tcp|dns)
const TYPE_MAP = {
  http: 'http',
  keyword: 'http', // monitor HTTP que busca una palabra clave: sigue siendo HTTP
  push: 'http', // monitor push: expone una URL, se trata como HTTP
  ping: 'ping',
  port: 'tcp', // "port" en Kuma = chequeo TCP a host:puerto
  tcp: 'tcp',
  dns: 'dns',
};

const RANGES_MS = {
  '1h': 3600e3,
  '6h': 6 * 3600e3,
  '24h': 24 * 3600e3,
  '7d': 7 * 86400e3,
  '30d': 30 * 86400e3,
};

const MAX_BEATS_PER_MONITOR = 500;
const HISTORY_POINT_LIMIT = 240;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Convierte el `time` de Kuma a ISO.
 * Kuma envía "YYYY-MM-DD HH:mm:ss" sin zona horaria; el contenedor de Kuma
 * corre en UTC (ver docker-compose.yml), así que los naive se interpretan
 * como UTC de forma determinista, sin depender del TZ del host. */
function toISO(t) {
  if (t === undefined || t === null) return null;
  if (typeof t === 'number') {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(t).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/);
  // Formato Kuma sin zona → UTC explícito (no usar new Date(s): V8 lo
  // parsearía como hora LOCAL y el resultado dependería del TZ del host).
  const d = m ? new Date(`${m[1]}T${m[2]}${m[3] || ''}Z`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Normaliza un heartbeat crudo de Kuma a la forma del contrato. */
function normalizeHeartbeat(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = toISO(raw.time ?? raw.createdAt ?? raw.created);
  if (!t) return null;
  const status = [0, 1, 2, 3].includes(raw.status) ? raw.status : 1;
  const ms = typeof raw.ping === 'number' && Number.isFinite(raw.ping) ? raw.ping : null;
  const code = typeof raw.code === 'number' ? raw.code : null;
  const msg = typeof raw.msg === 'string' && raw.msg ? raw.msg : null;
  const monitorId = String(raw.monitorID ?? raw.monitorId ?? raw.monitor_id ?? '');
  return { monitorId, t, ms, status, code, msg };
}

/**
 * Normaliza un monitor crudo de Kuma a la forma del contrato /api/monitors.
 * (Sin agregados: los calculan getMonitors()/getMonitorById a partir de la caché.)
 */
function normalizeMonitor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id);
  const type = TYPE_MAP[raw.type] || 'http';
  let url = raw.url || '';
  if (!url && raw.hostname) {
    url = type === 'tcp' ? `tcp://${raw.hostname}:${raw.port || ''}` : String(raw.hostname);
  }
  return {
    id,
    name: raw.name || `Monitor ${id}`,
    url,
    type,
    description: raw.description || '',
    intervalSec: typeof raw.interval === 'number' ? raw.interval : 60,
    timeoutSec: typeof raw.timeout === 'number' ? raw.timeout : null,
  };
}

/**
 * Agrupa heartbeats (asc por tiempo) en incidentes: un incidente empieza con
 * el primer DOWN y termina con el primer UP posterior. Si sigue caído,
 * end/durationMs quedan en null.
 */
function groupIncidents(beats, monitorId, monitorName) {
  const sorted = [...beats].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  const incidents = [];
  let cur = null;
  for (const b of sorted) {
    if (b.status === STATUS.DOWN && !cur) {
      cur = {
        id: `${monitorId}-${Date.parse(b.t)}`,
        monitorId: String(monitorId),
        monitorName: monitorName || String(monitorId),
        start: b.t,
        end: null,
        durationMs: null,
        events: [],
      };
    }
    if (cur) {
      cur.events.push({ t: b.t, status: b.status, code: b.code ?? null, msg: b.msg ?? null });
      if (b.status === STATUS.UP) {
        cur.end = b.t;
        cur.durationMs = Date.parse(b.t) - Date.parse(cur.start);
        incidents.push(cur);
        cur = null;
      }
    }
  }
  if (cur) incidents.push(cur); // incidente aún abierto
  return incidents;
}

class UptimeKumaAdapter {
  constructor({ url, username, password, metricsApiKey, seedMonitors }) {
    this.url = (url || '').replace(/\/+$/, '');
    this.username = username || '';
    this.password = password || '';
    this.metricsApiKey = metricsApiKey || '';
    this.seedEnabled = !!seedMonitors;

    this.socket = null;
    this.connected = false;
    this.token = null; // JWT de loginByToken
    this.lastError = null;
    this.kumaVersion = null;
    this.monitors = {}; // id(string) -> monitor crudo (push monitorList)
    this.beats = new Map(); // id(string) -> [heartbeat normalizado] asc
    this.stopped = false;
    this.reconnectDelayMs = 5000;
  }

  get enabled() {
    return !!(this.url && this.username && this.password);
  }

  status() {
    return {
      connected: this.connected,
      lastError: this.lastError,
      kumaVersion: this.kumaVersion,
    };
  }

  /** Arranque no bloqueante: bucle de conexión con backoff en segundo plano. */
  start() {
    if (this.stopped) this.stopped = false;
    if (!this.enabled) {
      this.lastError = 'Kuma no configurado (faltan KUMA_URL, KUMA_USERNAME o KUMA_PASSWORD).';
      return;
    }
    this.run().catch((e) => {
      this.lastError = e && e.message ? e.message : String(e);
    });
  }

  stop() {
    this.stopped = true;
    try {
      if (this.socket) this.socket.close();
    } catch {
      /* noop */
    }
    this.socket = null;
    this.connected = false;
  }

  async run() {
    while (!this.stopped) {
      try {
        await this.connectAndServe(); // se resuelve al desconectar
      } catch (e) {
        this.connected = false;
        this.lastError = e && e.message ? e.message : String(e);
      }
      if (this.stopped) break;
      await sleep(this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 60000);
    }
  }

  connectAndServe() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = io(this.url, {
        path: '/socket.io',
        reconnection: false, // el backoff lo gestionamos nosotros
        timeout: 20000,
        transports: ['websocket', 'polling'],
      });
      this.socket = socket;

      const done = (fn, arg) => {
        if (settled) return;
        settled = true;
        fn(arg);
      };

      socket.once('connect', async () => {
        try {
          // Login: primera vez con credenciales, luego con el JWT (loginByToken)
          const loginRes = this.token
            ? await this.emitAck('loginByToken', this.token, 45000)
            : await this.emitAck(
                'login',
                { username: this.username, password: this.password, token: '' },
                45000
              );
          if (!loginRes || !loginRes.ok) {
            throw new Error('Uptime Kuma rechazó el login (revisa KUMA_USERNAME/KUMA_PASSWORD).');
          }
          if (loginRes.token) this.token = loginRes.token;

          this.connected = true;
          this.lastError = null;
          this.reconnectDelayMs = 5000;

          this.attachPushHandlers(socket);
          await this.refreshMonitors();

          // Versión de Kuma: best-effort, puede no existir según versión
          try {
            const v = await this.emitAck('getVersion', {}, 10000);
            this.kumaVersion = typeof v === 'string' ? v : v && v.version ? v.version : null;
          } catch {
            this.kumaVersion = null;
          }

          if (this.seedEnabled) {
            try {
              await this.ensureSeedMonitors();
            } catch (e) {
              console.warn('[kuma-adapter] seed falló:', e && e.message ? e.message : e);
            }
          }

          socket.once('disconnect', () => {
            this.connected = false;
            done(resolve);
          });
        } catch (e) {
          try {
            socket.close();
          } catch {
            /* noop */
          }
          done(reject, e);
        }
      });

      socket.once('connect_error', (e) => {
        try {
          socket.close();
        } catch {
          /* noop */
        }
        done(reject, e instanceof Error ? e : new Error(String((e && e.message) || e)));
      });

      setTimeout(() => {
        if (!settled && !this.connected) {
          try {
            socket.close();
          } catch {
            /* noop */
          }
          done(reject, new Error('Timeout conectando con Uptime Kuma.'));
        }
      }, 30000).unref?.();
    });
  }

  /** Emite un evento Socket.IO esperando su ack, con timeout.
   *  payload puede ser un valor único o un ARRAY (se expande como
   *  argumentos: necesario para getMonitorBeats(monitorID, periodHours)). */
  emitAck(event, payload, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket con Uptime Kuma no conectado.'));
      }
      const timer = setTimeout(() => {
        reject(new Error(`Timeout esperando respuesta de "${event}".`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
      const args = Array.isArray(payload) ? payload : [payload];
      this.socket.timeout(timeoutMs).emit(event, ...args, (err, res) => {
        clearTimeout(timer);
        if (err) return reject(err instanceof Error ? err : new Error(String((err && err.message) || err)));
        resolve(res);
      });
    });
  }

  attachPushHandlers(socket) {
    socket.on('monitorList', (list) => {
      if (list && typeof list === 'object') {
        this.monitors = list;
        // Poda beats de monitores que ya no existen
        for (const id of [...this.beats.keys()]) {
          if (!Object.prototype.hasOwnProperty.call(this.monitors, id)) this.beats.delete(id);
        }
      }
    });
    socket.on('heartbeatList', (monitorID, list) => {
      if (monitorID !== undefined && Array.isArray(list)) this.mergeBeats(monitorID, list);
    });
    socket.on('heartbeat', (beat) => {
      if (beat && beat.monitorID !== undefined && beat.monitorID !== null) {
        this.mergeBeats(beat.monitorID, [beat]);
      }
    });
  }

  mergeBeats(monitorID, beats) {
    const key = String(monitorID);
    const norm = beats.map(normalizeHeartbeat).filter((b) => b && b.t);
    if (!norm.length) return;
    const cur = this.beats.get(key) || [];
    const byTime = new Map(cur.map((b) => [b.t, b]));
    for (const b of norm) byTime.set(b.t, b);
    const merged = [...byTime.values()].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
    const cutoff = Date.now() - RANGES_MS['30d'];
    this.beats.set(key, merged.filter((b) => Date.parse(b.t) >= cutoff).slice(-MAX_BEATS_PER_MONITOR));
  }

  async refreshMonitors() {
    let list = null;
    try {
      // ack-first…
      list = await this.emitAck('getMonitorList', {}, 20000);
    } catch {
      // …push-fallback: espera hasta 10s a que llegue el push monitorList
      for (let i = 0; i < 20 && Object.keys(this.monitors).length === 0; i++) {
        await sleep(500);
      }
    }
    if (list && typeof list === 'object' && Object.keys(list).length) this.monitors = list;
    for (const id of Object.keys(this.monitors)) {
      try {
        await this.refreshBeats(id);
      } catch (e) {
        console.warn(`[kuma-adapter] no se pudieron leer heartbeats de ${id}:`, e.message);
      }
    }
  }

  async refreshBeats(monitorID, range = '24h') {
    // Kuma 2.x: getMonitorBeats(monitorID, periodHours) → ack { ok, data }.
    // El periodo (horas) es obligatorio; sin él el servidor responde ok:false.
    const hours = { '1h': 1, '6h': 6, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }[range] || 24;
    try {
      const res = await this.emitAck('getMonitorBeats', [Number(monitorID), hours], 25000);
      if (res && res.ok === false) throw new Error(res.msg || 'getMonitorBeats rechazado');
      const beats = res && Array.isArray(res.data) ? res.data : null;
      if (beats) this.mergeBeats(monitorID, beats);
    } catch (e) {
      console.warn(`[kuma-adapter] no se pudieron leer heartbeats de ${monitorID}:`, e.message);
    }
  }

  /** Construye la lista de monitores con agregados calculados de la caché. */
  buildFromSocket() {
    const incidentsById = new Map();
    for (const id of Object.keys(this.monitors)) {
      const beats = this.beats.get(String(id)) || [];
      incidentsById.set(
        String(id),
        groupIncidents(beats, id, this.monitors[id] && this.monitors[id].name)
      );
    }
    return Object.keys(this.monitors).map((id) => {
      const base = normalizeMonitor(this.monitors[id]);
      const beats = this.beats.get(String(id)) || [];
      const last = beats[beats.length - 1];
      const withMs = beats.filter((b) => b.ms !== null && b.ms !== undefined);
      const avg = withMs.length ? withMs.reduce((a, b) => a + b.ms, 0) / withMs.length : null;
      const ups = beats.filter((b) => b.status === STATUS.UP).length;
      const downs = beats.filter((b) => b.status === STATUS.DOWN).length;
      const uptimePct = ups + downs > 0 ? Math.round((10000 * ups) / (ups + downs)) / 100 : null;
      const inc = incidentsById.get(String(id)) || [];
      let status = 'unknown';
      if (last) {
        status =
          last.status === STATUS.UP
            ? 'up'
            : last.status === STATUS.DOWN
              ? 'down'
              : last.status === STATUS.PENDING
                ? 'pending'
                : 'unknown'; // MAINTENANCE → unknown
        // Heurística documentada de "degraded": responde pero muy lento
        if (status === 'up' && avg !== null && avg > 2000) status = 'degraded';
      }
      return {
        ...base,
        status,
        uptimePct,
        latencyMs: last ? last.ms : null,
        avgLatencyMs: avg !== null ? Math.round(avg * 10) / 10 : null,
        lastCheck: last ? last.t : null,
        incidents: inc.length,
        lastIncident: inc.length ? inc[inc.length - 1].start : null,
      };
    });
  }

  async getMonitors() {
    if (!this.connected) {
      if (this.metricsApiKey) return this.getMonitorsFromMetrics();
      const e = new Error('Uptime Kuma no está disponible.');
      e.status = 503;
      throw e;
    }
    // Conectado pero lista vacía (Kuma recién creado o sin monitores):
    // es un estado válido → [] y no 503.
    return this.buildFromSocket();
  }

  async getMonitorById(id) {
    const list = await this.getMonitors();
    return list.find((m) => m.id === String(id)) || null;
  }

  async getHistory(id, range) {
    if (!this.connected) {
      const e = new Error('Uptime Kuma no está disponible.');
      e.status = 503;
      throw e;
    }
    const key = String(id);
    if (!Object.prototype.hasOwnProperty.call(this.monitors, key)) return null;
    try {
      await this.refreshBeats(key); // intenta traer lo último; si falla usa la caché
    } catch {
      /* usa caché */
    }
    const beats = this.beats.get(key) || [];
    const cutoff = Date.now() - (RANGES_MS[range] || RANGES_MS['24h']);
    let points = beats
      .filter((b) => Date.parse(b.t) >= cutoff)
      .map((b) => ({ t: b.t, ms: b.ms, status: b.status, code: b.code, msg: b.msg }));
    if (points.length > HISTORY_POINT_LIMIT) {
      const step = Math.ceil(points.length / HISTORY_POINT_LIMIT);
      points = points.filter((_, i) => i % step === 0);
      const last = beats[beats.length - 1];
      if (last) {
        const lp = { t: last.t, ms: last.ms, status: last.status, code: last.code, msg: last.msg };
        if (points[points.length - 1].t !== lp.t) points.push(lp);
      }
    }
    return points;
  }

  async getIncidents(range) {
    if (!this.connected) {
      const e = new Error('Uptime Kuma no está disponible.');
      e.status = 503;
      throw e;
    }
    const cutoff = Date.now() - (RANGES_MS[range] || RANGES_MS['7d']);
    const out = [];
    for (const id of Object.keys(this.monitors)) {
      const beats = (this.beats.get(String(id)) || []).filter((b) => Date.parse(b.t) >= cutoff);
      const inc = groupIncidents(beats, id, this.monitors[id] && this.monitors[id].name);
      for (const i of inc) {
        if (Date.parse(i.start) >= cutoff) out.push(i);
      }
    }
    return out.sort((a, b) => (a.start < b.start ? 1 : -1));
  }

  /**
   * Fallback vía /metrics (Prometheus). Requiere KUMA_METRICS_API_KEY.
   * Solo ofrece estado y latencia aproximados (las API keys de Kuma no
   * permiten gestión). Los nombres con comillas escapadas se toman tal cual.
   */
  async getMonitorsFromMetrics() {
    const res = await axios.get(`${this.url}/metrics`, {
      headers: { Authorization: `Bearer ${this.metricsApiKey}` },
      timeout: 10000,
    });
    const byName = new Map();
    for (const line of String(res.data).split('\n')) {
      let m = /^monitor_status\{[^}]*monitor_name="([^"]+)"[^}]*\}\s+([\d.]+)/.exec(line);
      if (m) {
        const e = byName.get(m[1]) || { name: m[1] };
        e.up = Number(m[2]) === 1;
        byName.set(m[1], e);
        continue;
      }
      m = /^monitor_response_time\{[^}]*monitor_name="([^"]+)"[^}]*\}\s+([\d.]+)/.exec(line);
      if (m) {
        const e = byName.get(m[1]) || { name: m[1] };
        e.ms = Number(m[2]);
        byName.set(m[1], e);
      }
    }
    let i = 0;
    return [...byName.values()].map((e) => ({
      id: `metrics-${i++}`,
      name: e.name,
      url: '',
      type: 'http',
      description: 'Vía /metrics de Uptime Kuma (aproximado).',
      intervalSec: null,
      timeoutSec: null,
      status: e.up === true ? 'up' : e.up === false ? 'down' : 'unknown',
      uptimePct: null,
      latencyMs: e.ms ?? null,
      avgLatencyMs: e.ms ?? null,
      lastCheck: null,
      incidents: 0,
      lastIncident: null,
    }));
  }

  /**
   * Crea monitores de ejemplo SOLO si SEED_MONITORS=true y la lista está vacía.
   * Todo en try/catch con logs claros; un fallo aquí nunca rompe nada.
   */
  async ensureSeedMonitors() {
    if (!this.seedEnabled) return;
    if (Object.keys(this.monitors).length > 0) return;
    console.log('[kuma-adapter] lista vacía y SEED_MONITORS=true: creando monitores de ejemplo…');
    // Campos exigidos por el handler "add" de Kuma 2.x (server/server.js):
    // accepted_statuscodes (array de strings; si falta, el servidor rompe con
    // "Cannot read properties of undefined") y conditions (se guarda como
    // JSON; si falta, viola NOT NULL). La UI envía conditions: [] por defecto.
    const base = { accepted_statuscodes: ['200-299'], conditions: [] };
    const seeds = [
      { ...base, type: 'http', name: 'Learning Dashboard', url: 'http://monitoring-frontend/', interval: 60, maxretries: 2 },
      { ...base, type: 'http', name: 'Web pública fiable', url: 'https://example.com', interval: 60, maxretries: 2 },
      { ...base, type: 'http', name: 'Endpoint HTTP de pruebas', url: 'https://httpbin.org/status/200', interval: 60, maxretries: 2 },
      { ...base, type: 'port', name: 'Servicio TCP', hostname: '1.1.1.1', port: 443, interval: 60, maxretries: 2 },
      { ...base, type: 'ping', name: 'Ping', hostname: '1.1.1.1', interval: 60, maxretries: 2 },
      {
        ...base,
        type: 'http',
        name: 'Test Service (Chaos)',
        url: 'http://test-service:3000/',
        interval: 20,
        timeout: 10,
        maxretries: 1,
      },
    ];
    for (const s of seeds) {
      try {
        // Kuma 2.x: el evento de creación es "add" (en 1.x era "addMonitor").
        const res = await this.emitAck('add', s, 20000);
        if (!res || !res.ok) throw new Error((res && res.msg) || 'el servidor no aceptó el monitor');
        console.log(`[kuma-adapter] seed creado: ${s.name}`);
      } catch (e) {
        console.warn(`[kuma-adapter] no se pudo crear "${s.name}":`, e.message);
      }
    }
    // Relee la lista para no servir datos vacíos mientras llega el push monitorList
    try {
      await this.refreshMonitors();
    } catch (e) {
      console.warn('[kuma-adapter] refresh tras seed falló:', e.message);
    }
  }
}

module.exports = {
  UptimeKumaAdapter,
  STATUS,
  TYPE_MAP,
  normalizeMonitor,
  normalizeHeartbeat,
  groupIncidents,
};
