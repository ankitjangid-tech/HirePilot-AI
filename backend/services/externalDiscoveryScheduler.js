const pool = require("../config/db");
const {
  runAllowlistedSourceDiscovery,
} = require("../controllers/externalJobController");

let schedulerTimer = null;
let cycleRunning = false;

const envBoolean = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
};

const envInteger = (name, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(process.env[name], 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
};

const schedulerConfig = () => ({
  enabled: envBoolean("AUTO_DISCOVERY_ENABLED", false),
  pollIntervalMs: envInteger(
    "AUTO_DISCOVERY_POLL_INTERVAL_MS",
    60000,
    5000,
    3600000
  ),
  maxSourcesPerCycle: envInteger(
    "AUTO_DISCOVERY_MAX_SOURCES_PER_CYCLE",
    3,
    1,
    20
  ),
});

const controllerResponse = () => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
  return response;
};

const updateAutomaticSourceState = async ({
  sourceId,
  intervalMinutes,
  status,
  errorMessage = null,
}) => {
  await pool.query(
    `UPDATE external_sources
     SET last_auto_discovery_at = CURRENT_TIMESTAMP,
         next_discovery_at = CURRENT_TIMESTAMP
           + ($2::integer * INTERVAL '1 minute'),
         auto_discovery_status = $3::varchar(30),
         auto_discovery_error = $4::text,
         updated_at = CURRENT_TIMESTAMP
     WHERE external_source_id = $1::integer`,
    [sourceId, intervalMinutes, status, errorMessage]
  );
};

const runScheduledSource = async (source) => {
  const response = controllerResponse();
  const request = {
    params: { sourceId: String(source.external_source_id) },
    user: { user_id: null },
    discoveryTrigger: "automatic",
  };

  try {
    await pool.query(
      `UPDATE external_sources
       SET auto_discovery_status = 'running',
           auto_discovery_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE external_source_id = $1::integer`,
      [source.external_source_id]
    );
    await runAllowlistedSourceDiscovery(request, response);
    const success =
      response.statusCode >= 200 &&
      response.statusCode < 300 &&
      response.payload?.success === true;
    const message = String(
      response.payload?.message ||
        response.payload?.error ||
        "Automatic discovery did not return a result."
    ).slice(0, 2000);

    await updateAutomaticSourceState({
      sourceId: source.external_source_id,
      intervalMinutes: source.discovery_interval_minutes,
      status: success ? "completed" : "failed",
      errorMessage: success ? null : message,
    });

    if (success) {
      console.log(
        `[AUTO DISCOVERY] Completed source ${source.external_source_id}: ` +
          `${Number(response.payload.discovered_count || 0)} discovered, ` +
          `${Number(response.payload.inserted_count || 0)} inserted, ` +
          `${Number(response.payload.updated_count || 0)} updated.`
      );
    } else {
      console.log(
        `[AUTO DISCOVERY] Failed source ${source.external_source_id}: ${message}`
      );
    }

    return {
      success,
      sourceId: source.external_source_id,
      payload: response.payload,
    };
  } catch (error) {
    const message = String(
      error.message || "Automatic discovery failed unexpectedly."
    ).slice(0, 2000);
    await updateAutomaticSourceState({
      sourceId: source.external_source_id,
      intervalMinutes: source.discovery_interval_minutes,
      status: "failed",
      errorMessage: message,
    });
    console.log(
      `[AUTO DISCOVERY] Failed source ${source.external_source_id}: ${message}`
    );
    return { success: false, sourceId: source.external_source_id, error: message };
  }
};

const runExternalDiscoveryCycle = async () => {
  if (cycleRunning) {
    console.log("[AUTO DISCOVERY] Previous scheduler cycle is still running; skipping overlap.");
    return { skipped: true, reason: "cycle_already_running" };
  }

  cycleRunning = true;
  try {
    const { maxSourcesPerCycle } = schedulerConfig();
    const eligibleResult = await pool.query(
      `SELECT
        external_source_id,
        discovery_interval_minutes
       FROM external_sources
       WHERE is_enabled = TRUE
         AND trust_status = 'approved'
         AND real_crawl_allowed = TRUE
         AND auto_discovery_enabled = TRUE
         AND base_url IS NOT NULL
         AND BTRIM(base_url) <> ''
         AND (next_discovery_at IS NULL OR next_discovery_at <= CURRENT_TIMESTAMP)
       ORDER BY source_priority ASC,
                next_discovery_at ASC NULLS FIRST,
                external_source_id ASC
       LIMIT $1::integer`,
      [maxSourcesPerCycle]
    );

    console.log(
      `[AUTO DISCOVERY] Eligible sources found: ${eligibleResult.rows.length}.`
    );

    const results = [];
    for (const source of eligibleResult.rows) {
      results.push(await runScheduledSource(source));
    }

    return { skipped: false, eligible: eligibleResult.rows.length, results };
  } catch (error) {
    console.log(
      `[AUTO DISCOVERY] Scheduler cycle failed safely: ${String(error.message).slice(0, 1000)}`
    );
    return { skipped: false, eligible: 0, error: error.message };
  } finally {
    cycleRunning = false;
  }
};

const startExternalDiscoveryScheduler = () => {
  const config = schedulerConfig();
  if (!config.enabled) {
    return { started: false, reason: "disabled" };
  }
  if (schedulerTimer) {
    return { started: false, reason: "already_started" };
  }

  console.log(
    `[AUTO DISCOVERY] Scheduler started (poll ${config.pollIntervalMs} ms; max ${config.maxSourcesPerCycle} sources/cycle).`
  );
  void runExternalDiscoveryCycle();
  schedulerTimer = setInterval(
    () => void runExternalDiscoveryCycle(),
    config.pollIntervalMs
  );
  schedulerTimer.unref?.();
  return { started: true };
};

const stopExternalDiscoveryScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
};

module.exports = {
  runExternalDiscoveryCycle,
  startExternalDiscoveryScheduler,
  stopExternalDiscoveryScheduler,
};
