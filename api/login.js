const crypto = require("crypto");
const { setCookie } = require("./_utils");

const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const STATE_COOKIE = "spotify_oauth_state";
const OAUTH_SCOPES = [
  "user-top-read",
  "user-read-recently-played",
  "playlist-modify-private",
  "playlist-modify-public",
];

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeMessage(value) {
  return String(value || "Authentication setup error.")
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

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
    return;
  }

  try {
    const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
    const redirectUri = getRequiredEnv("SPOTIFY_REDIRECT_URI");
    const appBaseUrl = getRequiredEnv("APP_BASE_URL");
    new URL(appBaseUrl);

    const state = crypto.randomBytes(24).toString("hex");
    setCookie(res, STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 10 * 60,
      path: "/",
    });

    const spotifyUrl = new URL(SPOTIFY_AUTHORIZE_URL);
    spotifyUrl.searchParams.set("response_type", "code");
    spotifyUrl.searchParams.set("client_id", clientId);
    spotifyUrl.searchParams.set("redirect_uri", redirectUri);
    spotifyUrl.searchParams.set("state", state);
    spotifyUrl.searchParams.set("scope", OAUTH_SCOPES.join(" "));

    redirect(res, spotifyUrl.toString());
  } catch (error) {
    const appBaseUrl = safeAppBaseUrl(process.env.APP_BASE_URL);
    const message = normalizeMessage(error && error.message);
    redirect(res, buildAppUrl(appBaseUrl, "/index.html", { error: message }));
  }
};
