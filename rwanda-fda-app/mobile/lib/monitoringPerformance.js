/**
 * Monitoring Tool `TM/performance_api.php` — tasks + applications for a staff member.
 * Unauthenticated browser GET returns HTML login; the app must send the token from auth.php.
 * Many PHP handlers read `?token=` but not the `Authorization` header, so we try both patterns.
 */
import { api } from "../constants/api";
import { isApiSuccess } from "./api";

/**
 * Node/Express login often returns a JWT (`eyJ...`.`...`.`...`).
 * `performance_api.php` on the server usually validates **hex API tokens** from `tbl_api_tokens` (issued by PHP `auth.php`), not JWTs — so the PHP script returns the HTML login page.
 * @param {string|null|undefined} t
 */
export function isLikelyJwtToken(t) {
  const s = String(t || "").trim();
  if (!s) return false;
  const parts = s.split(".");
  if (parts.length !== 3) return false;
  if (parts.some((p) => !p || p.length < 4)) return false;
  return /^[A-Za-z0-9_-]+$/.test(parts.join(""));
}

/**
 * PHP `auth.php` uses `bin2hex(random_bytes(32))` → 64 hex chars.
 * @param {string|null|undefined} t
 */
export function isLikelyPhpHexApiToken(t) {
  const s = String(t || "").trim();
  return /^[a-f0-9]{32,128}$/i.test(s);
}

/**
 * PHP sometimes prints notices/HTML before the JSON body. Extract the first top-level `{...}`.
 * @param {string} text
 * @returns {object | null}
 */
export function parseLenientJson(text) {
  const t = String(text || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    /* continue */
  }
  const slice = extractFirstJsonObject(t);
  if (!slice) return null;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @returns {string | null}
 */
function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * @param {object} payload
 * @returns {Record<string, unknown>|null}
 */
export function performanceDataRoot(payload) {
  if (payload?.data != null && typeof payload.data === "object")
    return payload.data;
  if (payload != null && typeof payload === "object" && !Array.isArray(payload))
    return payload;
  return null;
}

/** Applications list from performance payload (supports alternate keys). */
export function extractPerformanceApplications(payload) {
  const data = performanceDataRoot(payload);
  if (!data) return [];
  const raw =
    data.applications ??
    data.apps ??
    data.application_list ??
    data.assigned_applications;
  return Array.isArray(raw) ? raw : [];
}

/** Tasks list from performance payload (supports alternate keys). */
export function extractPerformanceTasks(payload) {
  const data = performanceDataRoot(payload);
  if (!data) return [];
  const raw = data.tasks ?? data.task_list ?? data.my_tasks;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Inner `data` object from a successful performance API response (handles double-encoded JSON string).
 * @param {object} payload
 * @returns {Record<string, unknown>|null}
 */
export function normalizePerformancePayloadData(payload) {
  let inner = payload?.data != null ? payload.data : payload;
  if (inner == null) return null;
  if (typeof inner === "string") {
    try {
      inner = JSON.parse(inner);
    } catch {
      return null;
    }
  }
  if (inner !== null && typeof inner === "object" && !Array.isArray(inner))
    return inner;
  return null;
}

/** True if body looks like a real performance_api payload (even when `success` is missing or odd). */
export function isPerformancePayloadLooksValid(payload) {
  const data = normalizePerformancePayloadData(payload);
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.applications)) return true;
  if (
    data.applications_summary != null &&
    typeof data.applications_summary === "object"
  )
    return true;
  if (
    data.staff != null &&
    typeof data.staff === "object" &&
    data.staff.staff_id != null
  )
    return true;
  if (Array.isArray(data.tasks)) return true;
  return false;
}

/**
 * @param {{ staffId: string|number, token: string|null|undefined, getToken?: () => string|null|undefined }} opts
 * @returns {Promise<{ res: Response, payload: object }>}
 */
function payloadFromPerformanceText(raw) {
  const text = raw.replace(/^\uFEFF/, "").trim();
  let payload = parseLenientJson(text);
  if (payload == null || typeof payload !== "object") {
    const preview = text.slice(0, 120).replace(/\s+/g, " ");
    payload = {
      success: false,
      message: preview.startsWith("<")
        ? "Server returned a web page instead of JSON. The API may require a different token parameter or POST body — we try several. If this persists, update performance_api.php to accept the mobile token (see docs/performance-api.md)."
        : `Could not parse JSON. Start of response: ${preview}${text.length > 120 ? "…" : ""}`,
    };
  }
  return { resText: text, payload };
}

export async function fetchMonitoringPerformance(opts) {
  const { staffId, token } = opts;
  const tokenValue = String(token || "").trim();
  if (tokenValue && isLikelyJwtToken(tokenValue)) {
    const e = new Error(
      "Signed in with a Node/JWT token. Applications and performance data use PHP monitoring-tool APIs that expect the hex API token from auth.php (not a JWT). Sign out, then sign in without EXPO_PUBLIC_AUTH_LOGIN_URL (defaults to PHP auth), or ask IT to update performance_api.php to validate your JWT.",
    );
    e.code = "TM_JWT_TOKEN";
    throw e;
  }

  const staffMissing =
    staffId == null || (typeof staffId === "string" && staffId.trim() === "");
  let effectiveStaffId = staffId;
  if (staffMissing) {
    if (!tokenValue) {
      const e = new Error("Missing staff id");
      e.code = "MISSING_STAFF_ID";
      throw e;
    }
    effectiveStaffId = 0;
  }

  const urls = api.performanceGetUrlVariants(
    effectiveStaffId,
    "all",
    tokenValue,
  );
  // GET: no Content-Type. POST: added below with explicit body.
  const headerSets = tokenValue
    ? [
        { Accept: "application/json", Authorization: `Bearer ${tokenValue}` },
        { Accept: "application/json", Authorization: tokenValue },
        { Accept: "application/json", "X-API-Key": tokenValue },
        { Accept: "application/json", "X-API-Token": tokenValue },
        { Accept: "application/json", "X-Auth-Token": tokenValue },
      ]
    : [{ Accept: "application/json" }];

  let lastRes = /** @type {Response|null} */ (null);
  let lastPayload = /** @type {object} */ ({});
  /** Prefer 401/403/400 over 405 so the UI does not hide auth failures (server often rejects POST before GET is fixed). */
  let lastMeaningfulHttpStatus = /** @type {number|null} */ (null);

  const tryReturn = (res, raw) => {
    const { payload } = payloadFromPerformanceText(raw);
    lastRes = res;
    lastPayload = payload;
    if (res.status >= 400 && res.status !== 405) {
      lastMeaningfulHttpStatus = res.status;
    }
    const okBody =
      res.ok &&
      (isApiSuccess(payload) || isPerformancePayloadLooksValid(payload));
    return okBody ? { res, payload } : null;
  };

  for (const url of urls) {
    for (const headers of headerSets) {
      const res = await fetch(url, { method: "GET", headers });
      const raw = await res.text();
      const ok = tryReturn(res, raw);
      if (ok) return ok;
    }
  }

  // Some PHP stacks only validate token on POST (or block API GET without session cookie).
  const postUrl = api.performancePost;
  const jsonBody = JSON.stringify({
    staff_id: effectiveStaffId,
    month: "all",
    token: tokenValue,
    api_token: tokenValue,
    access_token: tokenValue,
    auth_token: tokenValue,
    user_token: tokenValue,
  });
  const formBody = new URLSearchParams({
    staff_id: String(effectiveStaffId),
    month: "all",
    token: tokenValue,
    api_token: tokenValue,
    access_token: tokenValue,
    auth_token: tokenValue,
    user_token: tokenValue,
  });

  for (const headers of headerSets) {
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: jsonBody,
    });
    const raw = await res.text();
    const ok = tryReturn(res, raw);
    if (ok) return ok;
  }

  for (const headers of headerSets) {
    const res = await fetch(postUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });
    const raw = await res.text();
    const ok = tryReturn(res, raw);
    if (ok) return ok;
  }

  const msg =
    typeof lastPayload?.message === "string"
      ? lastPayload.message
      : `Couldn't load data (${lastRes?.status ?? "?"})`;
  const e = new Error(msg);
  e.status = lastMeaningfulHttpStatus ?? lastRes?.status;
  throw e;
}
