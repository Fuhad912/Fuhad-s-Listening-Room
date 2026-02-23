const { clearCookie, parseCookies, setCookie } = require("./_utils");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const STATE_COOKIE = "spotify_oauth_state";
const ACCESS_COOKIE = "spotify_access_token";
const REFRESH_COOKIE = "spotify_refresh_token";
const EXPIRES_AT_COOKIE = "spotify_token_expires_at";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeMessage(value) {
  return String(value || "Authentication failed.")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function safeAppBaseUrl(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch (_error) {
    return "http://localhost:3000";
  }
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end(`Redirecting to ${location}`);
}

function buildAppUrl(baseUrl, pathname, params) {
  const url = new URL(pathname, baseUrl);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

function firstQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0];
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
  clearCookie(res, STATE_COOKIE);
  clearCookie(res, ACCESS_COOKIE);
  clearCookie(res, REFRESH_COOKIE);
  clearCookie(res, EXPIRES_AT_COOKIE);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
    return;
  }

  const appBaseUrl = safeAppBaseUrl(process.env.APP_BASE_URL);

  try {
    const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
    const redirectUri = getRequiredEnv("SPOTIFY_REDIRECT_URI");
    const configuredBaseUrl = getRequiredEnv("APP_BASE_URL");
    new URL(configuredBaseUrl);

    const query = req.query || {};
    const spotifyError = firstQueryValue(query.error);
    const code = firstQueryValue(query.code);
    const returnedState = firstQueryValue(query.state);

    if (spotifyError) {
      throw new Error(`Spotify authorization error: ${spotifyError}`);
    }
    if (!code) {
      throw new Error("Missing authorization code from Spotify.");
    }
    if (!returnedState) {
      throw new Error("Missing OAuth state from Spotify callback.");
    }

    const cookies = parseCookies(req);
    const expectedState = cookies[STATE_COOKIE];
    if (!expectedState) {
      throw new Error("Missing login state cookie. Start again from /api/login.");
    }
    if (expectedState !== returnedState) {
      throw new Error("Invalid OAuth state. Please try logging in again.");
    }

    clearCookie(res, STATE_COOKIE);

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await readJson(tokenResponse);
    if (!tokenResponse.ok) {
      const details =
        (tokenData && (tokenData.error_description || tokenData.error)) ||
        "Spotify token exchange failed.";
      throw new Error(`Token exchange failed: ${details}`);
    }

    const accessToken = tokenData && tokenData.access_token;
    const refreshToken = tokenData && tokenData.refresh_token;
    const expiresInSeconds = Number(tokenData && tokenData.expires_in);

    if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error("Spotify returned an invalid token response.");
    }
    if (!refreshToken) {
      throw new Error("Spotify did not return a refresh token.");
    }

    const tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    const refreshCookieLifetime = 60 * 60 * 24 * 180;

    setCookie(res, ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: expiresInSeconds,
      path: "/",
    });
    setCookie(res, REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: refreshCookieLifetime,
      path: "/",
    });
    setCookie(res, EXPIRES_AT_COOKIE, String(tokenExpiresAt), {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: refreshCookieLifetime,
      path: "/",
    });

    redirect(res, buildAppUrl(appBaseUrl, "/app.html"));
  } catch (error) {
    clearAuthCookies(res);
    const message = normalizeMessage(error && error.message);
    redirect(res, buildAppUrl(appBaseUrl, "/index.html", { error: message }));
  }
};
