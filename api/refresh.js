const { clearCookie, getCookie, json, setCookie } = require("./_utils");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const ACCESS_COOKIE = "spotify_access_token";
const REFRESH_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_token_expires_at";
const REFRESH_COOKIE_LIFETIME_SECONDS = 60 * 60 * 24 * 180;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { rawText: await response.text() };
  }
  return response.json();
}

function clearAuthCookies(res) {
  clearCookie(res, ACCESS_COOKIE);
  clearCookie(res, REFRESH_COOKIE);
  clearCookie(res, EXPIRES_AT_COOKIE);
}

async function refreshAccessTokenFromCookies(req, res) {
  const refreshToken = getCookie(req, REFRESH_COOKIE);
  if (!refreshToken) {
    const error = new Error("Missing refresh token. Please log in again.");
    error.statusCode = 401;
    throw error;
  }

  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  const tokenData = await readJson(response);
  if (!response.ok) {
    const details =
      (tokenData && (tokenData.error_description || tokenData.error)) ||
      "Spotify token refresh failed.";
    const error = new Error(`Token refresh failed: ${details}`);
    error.statusCode = response.status === 400 || response.status === 401 ? 401 : 502;
    throw error;
  }

  const accessToken = tokenData && tokenData.access_token;
  const expiresInSeconds = Number(tokenData && tokenData.expires_in);
  const nextRefreshToken = (tokenData && tokenData.refresh_token) || refreshToken;

  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    const error = new Error("Spotify returned an invalid refresh response.");
    error.statusCode = 502;
    throw error;
  }

  const tokenExpiresAt = Date.now() + expiresInSeconds * 1000;

  setCookie(res, ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: expiresInSeconds,
    path: "/",
  });
  setCookie(res, EXPIRES_AT_COOKIE, String(tokenExpiresAt), {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: REFRESH_COOKIE_LIFETIME_SECONDS,
    path: "/",
  });

  if (nextRefreshToken !== refreshToken || (tokenData && tokenData.refresh_token)) {
    setCookie(res, REFRESH_COOKIE, nextRefreshToken, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: REFRESH_COOKIE_LIFETIME_SECONDS,
      path: "/",
    });
  }

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    tokenExpiresAt,
    expiresInSeconds,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: { message: "Method Not Allowed", status: 405 } });
  }

  try {
    await refreshAccessTokenFromCookies(req, res);
    return json(res, 200, { ok: true });
  } catch (error) {
    if (error && error.statusCode === 401) {
      clearAuthCookies(res);
    }
    return json(res, error.statusCode || 500, {
      error: {
        message: error && error.message ? error.message : "Unable to refresh Spotify access token.",
        status: error && error.statusCode ? error.statusCode : 500,
      },
    });
  }
};

module.exports.refreshAccessTokenFromCookies = refreshAccessTokenFromCookies;
module.exports.constants = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  EXPIRES_AT_COOKIE,
};
