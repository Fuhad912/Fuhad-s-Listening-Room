const { clearCookie, getCookie, json } = require("./_utils");
const refreshModule = require("./refresh");

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const ACCESS_COOKIE = "spotify_access_token";
const REFRESH_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_token_expires_at";
const TOKEN_EXPIRY_BUFFER_MS = 30 * 1000;

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function validatePath(pathValue) {
  const path = String(pathValue || "");
  if (!path) {
    const error = new Error('Missing required "path" query parameter.');
    error.statusCode = 400;
    throw error;
  }
  if (!path.startsWith("/")) {
    const error = new Error('Invalid "path". It must start with "/".');
    error.statusCode = 400;
    throw error;
  }
  if (path.startsWith("//") || path.includes("..")) {
    const error = new Error('Invalid "path". Path traversal and absolute-host paths are not allowed.');
    error.statusCode = 400;
    throw error;
  }
  return path;
}

function buildSpotifyUrl(path, query) {
  const url = new URL(`${SPOTIFY_API_BASE}${path}`);
  const entries = Object.entries(query || {});
  for (const [key, raw] of entries) {
    if (key === "path") continue;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }
    if (raw !== undefined && raw !== null) {
      url.searchParams.set(key, String(raw));
    }
  }

  if (url.origin !== "https://api.spotify.com" || !url.pathname.startsWith("/v1/")) {
    const error = new Error("Resolved Spotify API path is not allowed.");
    error.statusCode = 400;
    throw error;
  }

  return url;
}

async function readSpotifyResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return {
      body: await response.json(),
      contentType: "application/json; charset=utf-8",
    };
  }

  const text = await response.text();
  return {
    body: { raw: text },
    contentType: "application/json; charset=utf-8",
  };
}

async function getForwardBody(req) {
  if (req.body === undefined || req.body === null || req.body === "") {
    return null;
  }
  if (typeof req.body === "string") {
    const trimmed = req.body.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      const e = new Error("Request body must be valid JSON.");
      e.statusCode = 400;
      throw e;
    }
  }
  if (Buffer.isBuffer(req.body)) {
    const trimmed = req.body.toString("utf8").trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      const e = new Error("Request body must be valid JSON.");
      e.statusCode = 400;
      throw e;
    }
  }
  if (typeof req.body === "object") {
    return req.body;
  }
  const e = new Error("Unsupported request body format.");
  e.statusCode = 400;
  throw e;
}

function tokenExpired(req) {
  const raw = getCookie(req, EXPIRES_AT_COOKIE);
  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() >= expiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

function getAccessToken(req) {
  return getCookie(req, ACCESS_COOKIE) || "";
}

function clearAuthCookies(res) {
  clearCookie(res, ACCESS_COOKIE);
  clearCookie(res, REFRESH_COOKIE);
  clearCookie(res, EXPIRES_AT_COOKIE);
}

async function ensureValidAccessToken(req, res) {
  let accessToken = getAccessToken(req);
  const hasRefreshToken = Boolean(getCookie(req, REFRESH_COOKIE));

  if (!accessToken || tokenExpired(req)) {
    if (!hasRefreshToken) {
      const error = new Error("Not authenticated with Spotify. Please log in.");
      error.statusCode = 401;
      throw error;
    }
    const refreshed = await refreshModule.refreshAccessTokenFromCookies(req, res);
    accessToken = refreshed.accessToken;
  }

  return accessToken;
}

async function proxyToSpotify(url, method, accessToken, requestBody) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const init = { method, headers };

  if (method !== "GET" && requestBody !== null) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(requestBody);
  }

  return fetch(url, init);
}

module.exports = async function handler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT"].includes(method)) {
    res.setHeader("Allow", "GET, POST, PUT");
    return json(res, 405, { error: { message: "Method Not Allowed", status: 405 } });
  }

  try {
    const path = validatePath(firstValue(req.query && req.query.path));
    const spotifyUrl = buildSpotifyUrl(path, req.query || {});
    const requestBody = method === "GET" ? null : await getForwardBody(req);

    let accessToken = await ensureValidAccessToken(req, res);
    let response = await proxyToSpotify(spotifyUrl, method, accessToken, requestBody);

    if (response.status === 401) {
      const refreshed = await refreshModule.refreshAccessTokenFromCookies(req, res);
      accessToken = refreshed.accessToken;
      response = await proxyToSpotify(spotifyUrl, method, accessToken, requestBody);
    }

    const parsed = await readSpotifyResponse(response);
    res.statusCode = response.status;
    res.setHeader("Content-Type", parsed.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(parsed.body));
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    if (statusCode === 401) {
      clearAuthCookies(res);
    }
    return json(res, statusCode, {
      error: {
        message: error && error.message ? error.message : "Spotify proxy request failed.",
        status: statusCode,
      },
    });
  }
};
